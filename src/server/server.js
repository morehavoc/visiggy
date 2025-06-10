require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const roomsStore = require('./roomsStore');
const { generatePrompt, scoreGuesses, generateJoke } = require('./ai');
const { generateImage } = require('./imageGen');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// Load rooms from file if exists
roomsStore.load();

// Save rooms periodically
setInterval(() => roomsStore.save(), 30000);

// Track WebSocket connections
const connections = new Map(); // ws -> { roomId, team, isHost }

// HTTP Routes
app.post('/api/create-room', (req, res) => {
  const roomId = roomsStore.createRoom();
  res.json({ roomId });
});

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data.type);
      
      switch (data.type) {
        case 'host:join':
          handleHostJoin(ws, data);
          break;
          
        case 'team:join':
          handleTeamJoin(ws, data);
          break;
          
        case 'game:start':
          handleGameStart(ws, data);
          break;
          
        case 'guess:submit':
          handleGuessSubmit(ws, data);
          break;
          
        case 'host:skip-round':
          handleSkipRound(ws, data);
          break;
          
        case 'host:next-round':
          handleNextRound(ws, data);
          break;
          
        case 'host:override-score':
          handleScoreOverride(ws, data);
          break;
          
        case 'reconnect':
          handleReconnect(ws, data);
          break;
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
    }
  });
  
  ws.on('close', () => {
    const conn = connections.get(ws);
    if (conn) {
      console.log(`${conn.isHost ? 'Host' : `Team ${conn.team}`} disconnected from room ${conn.roomId}`);
      connections.delete(ws);
    }
  });
});

function handleHostJoin(ws, data) {
  const room = roomsStore.get(data.roomId);
  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
    return;
  }
  
  connections.set(ws, { roomId: data.roomId, isHost: true });
  room.hostWs = ws;
  
  ws.send(JSON.stringify({
    type: 'host:joined',
    roomId: data.roomId,
    teams: Object.keys(room.teams),
    stage: room.stage
  }));
}

function handleTeamJoin(ws, data) {
  const room = roomsStore.get(data.roomId);
  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
    return;
  }
  
  if (room.stage !== 'lobby') {
    ws.send(JSON.stringify({ type: 'error', message: 'Game already started' }));
    return;
  }
  
  if (room.teams[data.teamName]) {
    ws.send(JSON.stringify({ type: 'error', message: 'Team name already taken' }));
    return;
  }
  
  room.teams[data.teamName] = { score: 0, ws };
  room.scores[data.teamName] = 0;
  connections.set(ws, { roomId: data.roomId, team: data.teamName });
  
  // Notify all clients in room
  broadcastToRoom(room, {
    type: 'team:joined',
    teamName: data.teamName,
    teams: Object.keys(room.teams)
  });
  
  ws.send(JSON.stringify({
    type: 'team:confirmed',
    teamName: data.teamName,
    roomId: data.roomId
  }));
}

async function handleGameStart(ws, data) {
  const conn = connections.get(ws);
  if (!conn || !conn.isHost) {
    ws.send(JSON.stringify({ type: 'error', message: 'Only host can start game' }));
    return;
  }
  
  const room = roomsStore.get(conn.roomId);
  if (!room) return;
  
  if (Object.keys(room.teams).length < 2) {
    ws.send(JSON.stringify({ type: 'error', message: 'Need at least 2 teams' }));
    return;
  }
  
  room.stage = 'playing';
  room.currentRound = 0;
  room.roundsPlayed = 0;
  room.theme = data.theme || null;
  
  broadcastToRoom(room, { type: 'game:started' });
  
  // Pre-generate first round's content
  room.nextPrompt = await generatePrompt(room.theme);
  room.nextImagePromise = generateImage(room.nextPrompt);
  
  // Start first round
  setTimeout(() => startRound(room), 1000);
}

async function startRound(room) {
  try {
    room.currentRound++;
    room.currentGuesses = {};
    room.roundActive = true;
    room.roundStartTime = Date.now();
    
    // Use pre-generated content
    room.currentPrompt = room.nextPrompt;
    
    broadcastToRoom(room, { type: 'round:preparing' });

    // Tell a joke while the image generates
    generateJoke().then(joke => {
      broadcastToRoom(room, { type: 'joke:new', text: joke });
    });

    // Wait for the image to be ready
    const imageUrl = await room.nextImagePromise;
    room.currentImage = imageUrl;

    // Pre-generate content for the *next* round (if not the last round)
    if (room.currentRound < 5) {
        room.nextPrompt = await generatePrompt(room.theme);
        room.nextImagePromise = generateImage(room.nextPrompt);
    } else {
        room.nextPrompt = null;
        room.nextImagePromise = null;
    }
    
    // Notify clients that round is ready to start with a countdown
    broadcastToRoom(room, {
      type: 'round:ready',
      round: room.currentRound,
      imageUrl: room.currentImage,
      duration: 60
    });
    
    // Set timeout for round end
    room.roundTimeout = setTimeout(() => endRound(room), 63000); // 60s + 3s countdown
    
  } catch (error) {
    console.error('Round start error:', error);
    if (room.hostWs) {
      room.hostWs.send(JSON.stringify({
        type: 'error',
        message: 'Failed to start round'
      }));
    }
  }
}

function handleGuessSubmit(ws, data) {
  const conn = connections.get(ws);
  if (!conn || !conn.team) return;
  
  const room = roomsStore.get(conn.roomId);
  if (!room || !room.roundActive) return;
  
  room.currentGuesses[conn.team] = {
    text: data.text,
    timestamp: Date.now()
  };
  
  // Check if all teams have submitted
  if (Object.keys(room.currentGuesses).length === Object.keys(room.teams).length) {
    clearTimeout(room.roundTimeout);
    endRound(room);
  }
}

async function endRound(room) {
  room.roundActive = false;
  
  // Prepare guesses for scoring
  const guesses = Object.entries(room.currentGuesses).map(([team, guessData]) => ({
    team,
    text: guessData.text
  }));
  
  // Add teams that didn't submit with empty guesses
  Object.keys(room.teams).forEach(team => {
    if (!room.currentGuesses[team]) {
      guesses.push({ team, text: '' });
    }
  });
  
  try {
    // Get scores from GPT
    const scoringResult = await scoreGuesses(room.currentPrompt, guesses);
    
    // Update cumulative scores
    scoringResult.forEach(({ team, score }) => {
      const baseScore = score * 100;
      let finalScore = baseScore;
      
      if (room.currentGuesses[team]) {
        const timeTaken = (room.currentGuesses[team].timestamp - room.roundStartTime) / 1000;
        const roundDuration = 60;
        if (timeTaken < roundDuration) {
          // Bonus is a percentage of remaining time, max 50% of base score
          const timeBonusRatio = (roundDuration - timeTaken) / roundDuration;
          const speedBonus = baseScore * timeBonusRatio * 0.5;
          finalScore += speedBonus;
        }
      }
      
      const points = Math.round(finalScore);
      room.scores[team] = (room.scores[team] || 0) + points;
    });
    
    // Prepare results
    const results = scoringResult.map(({ team, score }) => {
      const baseScore = score * 100;
      let finalScore = baseScore;
      if (room.currentGuesses[team]) {
        const timeTaken = (room.currentGuesses[team].timestamp - room.roundStartTime) / 1000;
        const roundDuration = 60;
        if (timeTaken < roundDuration) {
          const timeBonusRatio = (roundDuration - timeTaken) / roundDuration;
          const speedBonus = baseScore * timeBonusRatio * 0.5;
          finalScore += speedBonus;
        }
      }
      
      return {
        team,
        score: Math.round(finalScore),
        guess: room.currentGuesses[team] ? room.currentGuesses[team].text : '(no guess)'
      };
    });
    
    room.roundsPlayed++;
    const isGameOver = room.roundsPlayed >= 5;

    // Broadcast round end
    broadcastToRoom(room, {
      type: 'round:end',
      prompt: room.currentPrompt,
      results,
      leaderboard: Object.entries(room.scores)
        .map(([team, score]) => ({ team, score }))
        .sort((a, b) => b.score - a.score),
      intermission: !isGameOver
    });
    
    if (isGameOver) {
      setTimeout(() => endGame(room), 5000);
    } else {
      room.stage = 'intermission';
    }
    
  } catch (error) {
    console.error('Scoring error:', error);
    // Fallback: give everyone 0 points
    const results = guesses.map(({ team, text }) => ({
      team,
      score: 0,
      guess: text || '(no guess)'
    }));
    
    room.roundsPlayed++;
    const isGameOver = room.roundsPlayed >= 5;

    // Broadcast round end
    broadcastToRoom(room, {
      type: 'round:end',
      prompt: room.currentPrompt,
      results,
      leaderboard: Object.entries(room.scores)
        .map(([team, score]) => ({ team, score }))
        .sort((a, b) => b.score - a.score),
      intermission: !isGameOver
    });
  }
}

function handleNextRound(ws, data) {
    const conn = connections.get(ws);
    if (!conn || !conn.isHost) return;

    const room = roomsStore.get(conn.roomId);
    if (!room || room.stage !== 'intermission') return;

    room.stage = 'playing';
    startRound(room);
}

function endGame(room) {
  room.stage = 'ended';
  
  const finalLeaderboard = Object.entries(room.scores)
    .map(([team, score]) => ({ team, score }))
    .sort((a, b) => b.score - a.score);
  
  broadcastToRoom(room, {
    type: 'game:over',
    leaderboard: finalLeaderboard
  });
  
  // Save final state
  roomsStore.save();
}

function handleSkipRound(ws, data) {
  const conn = connections.get(ws);
  if (!conn || !conn.isHost) return;
  
  const room = roomsStore.get(conn.roomId);
  if (!room || !room.roundActive) return;
  
  clearTimeout(room.roundTimeout);
  room.roundActive = false;
  
  broadcastToRoom(room, {
    type: 'round:skipped',
    message: 'Round skipped by host'
  });
  
  setTimeout(() => startRound(room), 2000);
}

function handleScoreOverride(ws, data) {
  const conn = connections.get(ws);
  if (!conn || !conn.isHost) return;
  
  const room = roomsStore.get(conn.roomId);
  if (!room) return;
  
  if (room.scores[data.team] !== undefined) {
    room.scores[data.team] = data.newScore;
    
    const leaderboard = Object.entries(room.scores)
      .map(([team, score]) => ({ team, score }))
      .sort((a, b) => b.score - a.score);
    
    broadcastToRoom(room, {
      type: 'score:updated',
      team: data.team,
      newScore: data.newScore,
      leaderboard
    });
  }
}

function handleReconnect(ws, data) {
  const room = roomsStore.get(data.roomId);
  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
    return;
  }
  
  if (data.isHost) {
    connections.set(ws, { roomId: data.roomId, isHost: true });
    room.hostWs = ws;
  } else if (data.teamName && room.teams[data.teamName]) {
    connections.set(ws, { roomId: data.roomId, team: data.teamName });
    room.teams[data.teamName].ws = ws;
  } else {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid reconnection' }));
    return;
  }
  
  // Send current state
  ws.send(JSON.stringify({
    type: 'reconnected',
    stage: room.stage,
    teams: Object.keys(room.teams),
    scores: room.scores,
    currentRound: room.currentRound,
    isHost: data.isHost
  }));
}

function broadcastToRoom(room, message) {
  const messageStr = JSON.stringify(message);
  
  // Send to host
  if (room.hostWs && room.hostWs.readyState === WebSocket.OPEN) {
    room.hostWs.send(messageStr);
  }
  
  // Send to all teams
  Object.values(room.teams).forEach(team => {
    if (team.ws && team.ws.readyState === WebSocket.OPEN) {
      team.ws.send(messageStr);
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  roomsStore.save();
  process.exit();
});
