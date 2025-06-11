// Global state
let ws = null;
let gameState = {
  roomId: null,
  teamName: null,
  isHost: false,
  connected: false
};

// Timer state
let timerInterval = null;
let timeRemaining = 0;
let serverEndTime = 0;

// DOM Elements
const screens = {
  start: document.getElementById('startScreen'),
  host: document.getElementById('hostScreen'),
  team: document.getElementById('teamScreen'),
  gameOver: document.getElementById('gameOverScreen')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check for room code in URL
  const urlParams = new URLSearchParams(window.location.search);
  const roomIdFromUrl = urlParams.get('room');
  if (roomIdFromUrl) {
    document.getElementById('joinRoomCode').value = roomIdFromUrl.toUpperCase();
  }

  // Check localStorage for reconnection
  const savedState = localStorage.getItem('gameState');
  if (savedState) {
    const parsed = JSON.parse(savedState);
    if (parsed.roomId) {
      gameState = parsed;
      connectWebSocket();
    }
  }
  
  // Event listeners
  document.getElementById('createRoomBtn').addEventListener('click', createRoom);
  document.getElementById('joinRoomBtn').addEventListener('click', joinRoom);
  document.getElementById('joinTeamBtn').addEventListener('click', joinTeam);
  document.getElementById('startGameBtn').addEventListener('click', startGame);
  document.getElementById('submitGuessBtn').addEventListener('click', submitGuess);
  document.getElementById('skipRoundBtn').addEventListener('click', skipRound);
  document.getElementById('newGameBtn').addEventListener('click', () => location.reload());
  document.getElementById('exitHostBtn').addEventListener('click', exitRoom);
  document.getElementById('exitTeamBtn').addEventListener('click', exitRoom);
  document.getElementById('nextRoundBtn').addEventListener('click', nextRound);
  document.getElementById('copyLinkBtn').addEventListener('click', copyShareLink);
  
  // Enter key handlers
  document.getElementById('joinRoomCode').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoom();
  });
  document.getElementById('teamNameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinTeam();
  });
  document.getElementById('guessInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitGuess();
    }
  });
  document.getElementById('guessInput').addEventListener('input', updateCharCounter);
});

// Exit room
function exitRoom() {
  if (ws) {
    ws.close();
  }
  localStorage.removeItem('gameState');
  location.reload();
}

// Create room
async function createRoom() {
  try {
    const response = await fetch('/api/create-room', { method: 'POST' });
    const data = await response.json();
    
    gameState.roomId = data.roomId;
    gameState.isHost = true;
    
    saveState();
    connectWebSocket();
    
  } catch (error) {
    console.error('Failed to create room:', error);
    alert('Failed to create room. Please try again.');
  }
}

// Join room
function joinRoom() {
  const roomCode = document.getElementById('joinRoomCode').value.toUpperCase();
  if (!roomCode || roomCode.length !== 6) {
    alert('Please enter a valid 6-character room code');
    return;
  }
  
  gameState.roomId = roomCode;
  gameState.isHost = false;
  gameState.teamName = null; // Clear previous team name for a fresh join
  
  saveState();
  connectWebSocket();
}

// Join team
function joinTeam() {
  const teamName = document.getElementById('teamNameInput').value.trim();
  if (!teamName) {
    alert('Please enter a team name');
    return;
  }
  
  gameState.teamName = teamName;
  saveState();
  
  ws.send(JSON.stringify({
    type: 'team:join',
    roomId: gameState.roomId,
    teamName: teamName
  }));
}

// Start game
function startGame() {
  const theme = document.getElementById('gameTheme').value.trim();
  const numRounds = document.getElementById('numRounds').value;
  ws.send(JSON.stringify({ type: 'game:start', theme: theme, numRounds: parseInt(numRounds) }));
}

// Submit guess
function submitGuess() {
  const guess = document.getElementById('guessInput').value.trim();
  if (!guess) return;
  
  ws.send(JSON.stringify({
    type: 'guess:submit',
    team: gameState.teamName,
    text: guess
  }));
  
  document.getElementById('guessInput').value = '';
  document.getElementById('submitGuessBtn').disabled = true;
  document.getElementById('submitGuessBtn').textContent = 'Guess Submitted';
}

// Skip round (host only)
function skipRound() {
  ws.send(JSON.stringify({ type: 'host:skip-round' }));
}

// Next round (host only)
function nextRound() {
  ws.send(JSON.stringify({ type: 'host:next-round' }));
}

// WebSocket connection
function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    gameState.connected = true;
    
    // Send appropriate join message
    if (gameState.isHost) {
      ws.send(JSON.stringify({
        type: 'host:join',
        roomId: gameState.roomId
      }));
    } else if (gameState.teamName) {
      // Reconnecting team
      ws.send(JSON.stringify({
        type: 'reconnect',
        roomId: gameState.roomId,
        teamName: gameState.teamName,
        isHost: false
      }));
    } else {
      // New team member
      showScreen('team');
      document.getElementById('teamRoomCode').textContent = gameState.roomId;
    }
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Received:', data.type);
    handleMessage(data);
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    gameState.connected = false;
    setTimeout(reconnect, 3000);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

// Reconnect logic
function reconnect() {
  if (!gameState.connected && gameState.roomId) {
    console.log('Attempting to reconnect...');
    connectWebSocket();
  }
}

// Handle messages
function handleMessage(data) {
  switch (data.type) {
    case 'host:joined':
      showScreen('host');
      document.getElementById('hostRoomCode').textContent = data.roomId;
      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${data.roomId}`;
      document.getElementById('shareableLink').value = shareUrl;
      updateHostTeamsList(data.teams);
      document.getElementById('startGameBtn').disabled = data.teams.length < 2;
      document.getElementById('startGameBtn').textContent = 
          data.teams.length < 2 ? `Start Game (Need ${2 - data.teams.length} more team)` : 'Start Game';
      break;
      
    case 'team:joined':
      updateTeamsList(data.teams);
      if (gameState.isHost) {
        updateHostTeamsList(data.teams);
        document.getElementById('startGameBtn').disabled = data.teams.length < 2;
        document.getElementById('startGameBtn').textContent = 
          data.teams.length < 2 ? `Start Game (Need ${2 - data.teams.length} more team)` : 'Start Game';
      }
      break;
      
    case 'team:confirmed':
      document.getElementById('teamName').textContent = gameState.teamName;
      document.getElementById('teamWaiting').style.display = 'block';
      document.getElementById('teamNameInput').style.display = 'none';
      document.getElementById('joinTeamBtn').style.display = 'none';
      break;
      
    case 'game:started':
      if (gameState.isHost) {
        document.getElementById('hostLobby').style.display = 'none';
        document.getElementById('hostGame').style.display = 'block';
        document.getElementById('hostTotalRounds').textContent = data.totalRounds;
      } else {
        document.getElementById('teamLobby').style.display = 'none';
        document.getElementById('teamGame').style.display = 'block';
        document.getElementById('teamTotalRounds').textContent = data.totalRounds;
      }
      break;
      
    case 'round:next':
      stopTimer();
      const timerEl = gameState.isHost ? 'hostTimer' : 'teamTimer';
      document.getElementById(timerEl).textContent = '';

      if (gameState.isHost) {
        document.getElementById('hostResults').style.display = 'none';
        document.getElementById('nextRoundBtn').style.display = 'none';
      } else {
        document.getElementById('teamResults').style.display = 'none';
        document.getElementById('teamWaitingNextRound').style.display = 'none';
      }
      const roundNumEl = gameState.isHost ? 'hostRoundNum' : 'teamRoundNum';
      document.getElementById(roundNumEl).textContent = data.round;
      break;

    case 'round:preparing':
      showLoadingIndicator(true);
      break;

    case 'joke:new':
      showJoke(data.text);
      break;

    case 'round:ready':
      showLoadingIndicator(false);
      startCountdown(data);
      break;

    case 'round:start':
      startRoundUI(data);
      break;
      
    case 'round:end':
      endRoundUI(data);
      break;
      
    case 'round:intermission':
      showIntermission();
      break;

    case 'round:failed':
      if (gameState.isHost) {
        alert(data.message);
      }
      break;
      
    case 'round:skipped':
      showMessage(data.message);
      break;
      
    case 'score:updated':
      updateScoreboard(data.leaderboard);
      break;
      
    case 'game:over':
      showGameOver(data.leaderboard, data.imageHistory);
      break;
      
    case 'reconnected':
      handleReconnection(data);
      break;
      
    case 'error':
      alert(data.message);
      break;
  }
}

// UI Functions
function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
}

function updateCharCounter() {
  const guessInput = document.getElementById('guessInput');
  const charCounter = document.getElementById('charCounter');
  const maxLength = guessInput.maxLength;
  const currentLength = guessInput.value.length;
  const remaining = maxLength - currentLength;
  
  charCounter.textContent = remaining;
  if (remaining < 20) {
    charCounter.style.color = '#ffaa00';
  } else if (remaining < 0) {
    charCounter.style.color = '#ff4444';
  } else {
    charCounter.style.color = '#888';
  }
}

function copyShareLink() {
  const linkInput = document.getElementById('shareableLink');
  linkInput.select();
  linkInput.setSelectionRange(0, 99999); // For mobile devices
  
  try {
    navigator.clipboard.writeText(linkInput.value).then(() => {
      const copyBtn = document.getElementById('copyLinkBtn');
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    });
  } catch (err) {
    // Fallback for older browsers
    document.execCommand('copy');
    const copyBtn = document.getElementById('copyLinkBtn');
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
  }
}

function updateHostTeamsList(teams) {
  const list = document.getElementById('hostTeamsList');
  list.innerHTML = teams.length ? teams.map(t => `<div class="team-item">${t}</div>`).join('') : '<p>No teams yet...</p>';
}

function updateTeamsList(teams) {
  const list = document.getElementById('teamsList');
  list.innerHTML = '<h4>Teams in game:</h4>' + teams.map(t => `<div class="team-item">${t}</div>`).join('');
}

function startRoundUI(data) {
  // Reset guess input
  if (!gameState.isHost) {
    document.getElementById('guessInput').value = '';
    document.getElementById('submitGuessBtn').disabled = false;
    document.getElementById('submitGuessBtn').textContent = 'Submit Guess';
  }
  
  // Update round number
  const roundNumEl = gameState.isHost ? 'hostRoundNum' : 'teamRoundNum';
  document.getElementById(roundNumEl).textContent = data.round;
  
  // Show image is now handled by startCountdown
  
  // Start timer
  startTimer(data.duration, data.endTime);
  
  // Hide previous results - This is now handled by 'round:next'
  // if (gameState.isHost) {
  //   document.getElementById('hostResults').style.display = 'none';
  //   document.getElementById('nextRoundBtn').style.display = 'none';
  // } else {
  //   document.getElementById('teamResults').style.display = 'none';
  //   document.getElementById('teamWaitingNextRound').style.display = 'none';
  // }
}

function endRoundUI(data) {
  stopTimer();
  
  // Show results
  const resultsHTML = `
    <h3>Round Over!</h3>
    <div class="prompt-reveal">
      <strong>The prompt was:</strong> "${data.prompt}"
    </div>
    <div class="round-results">
      <h4>Guesses:</h4>
      ${data.results.map(r => `
        <div class="result-item">
          <span class="team-name">${r.team}:</span>
          <span class="guess">"${r.guess}"</span>
          <span class="score">+${r.score} points</span>
        </div>
      `).join('')}
    </div>
  `;
  
  if (gameState.isHost) {
    document.getElementById('hostResultsContent').innerHTML = resultsHTML;
    document.getElementById('hostResults').style.display = 'block';
    if (data.intermission) {
      document.getElementById('nextRoundBtn').style.display = 'block';
    }
  } else {
    document.getElementById('teamResultsContent').innerHTML = resultsHTML;
    document.getElementById('teamResults').style.display = 'block';
    if (data.intermission) {
      document.getElementById('teamWaitingNextRound').style.display = 'block';
    }
  }
  
  // Update scoreboard
  updateScoreboard(data.leaderboard);
}

function showIntermission() {
    if (gameState.isHost) {
        document.getElementById('nextRoundBtn').style.display = 'block';
        document.getElementById('hostResults').style.display = 'block';
    } else {
        document.getElementById('teamWaitingNextRound').style.display = 'block';
        document.getElementById('teamResults').style.display = 'block';
    }
}

function updateScoreboard(leaderboard) {
  const sortedLeaderboard = [...leaderboard].sort((a, b) => b.score - a.score);
  const scoreboardHTML = `
    <h4>Leaderboard:</h4>
    ${sortedLeaderboard.map((entry, i) => `
      <div class="score-item ${i === 0 ? 'leader' : ''}">
        <span class="rank">${i + 1}.</span>
        <span class="team-name">${entry.team}</span>
        <span class="score">${entry.score} pts</span>
      </div>
    `).join('')}
  `;
  
  if (gameState.isHost) {
    document.getElementById('hostScoreboard').innerHTML = scoreboardHTML;
  } else {
    document.getElementById('teamScoreboard').innerHTML = scoreboardHTML;
  }
}

function startTimer(duration, endTime) {
  serverEndTime = endTime;
  
  const update = () => {
    const now = Date.now();
    timeRemaining = Math.max(0, Math.round((serverEndTime - now) / 1000));
    updateTimerDisplay();

    if (timeRemaining === 0) {
      stopTimer();
    }
  };

  stopTimer(); // Clear any existing timer
  timerInterval = setInterval(update, 500);
  update(); // Run immediately
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  const timerEl = gameState.isHost ? 'hostTimer' : 'teamTimer';
  const timer = document.getElementById(timerEl);
  
  if (timeRemaining > 0) {
    timer.textContent = `${timeRemaining}s`;
    timer.className = 'timer';
    if (timeRemaining <= 10) timer.classList.add('warning');
  } else {
    timer.textContent = 'Time\'s up!';
    timer.className = 'timer expired';

    // Auto-submit if player has text and hasn't submitted
    if (!gameState.isHost) {
      const guessInput = document.getElementById('guessInput');
      const submitBtn = document.getElementById('submitGuessBtn');
      if (guessInput.value.trim() && !submitBtn.disabled) {
        submitGuess();
      }
    }
  }
}

function showGameOver(leaderboard, imageHistory) {
  showScreen('gameOver');
  
  const finalHTML = `
    ${leaderboard.map((entry, i) => `
      <div class="final-score-item ${i === 0 ? 'winner' : ''}">
        <span class="rank">${i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
        <span class="team-name">${entry.team}</span>
        <span class="score">${entry.score} points</span>
      </div>
    `).join('')}
  `;
  
  document.getElementById('finalLeaderboard').innerHTML = finalHTML;

  if (imageHistory && imageHistory.length > 0) {
    const historyContainer = document.getElementById('imageHistoryContainer');
    const historyHTML = imageHistory.map(item => `
      <div class="history-item">
        <a href="${item.imageUrl}" download="visiggy-art-${Date.now()}.png" target="_blank">
          <img src="${item.imageUrl}" alt="${item.prompt}">
          <div class="prompt-overlay"><span>${item.prompt}</span></div>
        </a>
      </div>
    `).join('');
    historyContainer.innerHTML = historyHTML;
  }
  
  // Clear saved state
  localStorage.removeItem('gameState');
}

function handleReconnection(data) {
  if (data.isHost) {
    showScreen('host');
    document.getElementById('hostRoomCode').textContent = gameState.roomId;
  } else {
    showScreen('team');
    document.getElementById('teamRoomCode').textContent = gameState.roomId;
    document.getElementById('teamName').textContent = gameState.teamName;
    document.getElementById('teamWaiting').style.display = 'none';
    document.getElementById('teamLobby').style.display = 'none';
    document.getElementById('teamGame').style.display = 'block';
  }
  
  updateScoreboard(Object.entries(data.scores).map(([team, score]) => ({ team, score })));
  
  if (data.stage === 'playing') {
    document.getElementById(data.isHost ? 'hostRoundNum' : 'teamRoundNum').textContent = data.currentRound;
  }
}

function showMessage(message) {
  // Simple message display (could be improved with toast notifications)
  const messageEl = document.createElement('div');
  messageEl.className = 'message';
  messageEl.textContent = message;
  document.body.appendChild(messageEl);
  
  setTimeout(() => messageEl.remove(), 3000);
}

function showJoke(joke) {
  const jokeElements = document.querySelectorAll('.joke-text');
  jokeElements.forEach(el => el.textContent = `"${joke}"`);
}

function showLoadingIndicator(show) {
  const containers = [document.getElementById('hostImageContainer'), document.getElementById('teamImageContainer')];
  containers.forEach(container => {
    if (!container) return;
    const loader = container.querySelector('.loading-indicator');
    const image = container.querySelector('img');
    
    if (show) {
      if (loader) loader.style.display = 'block';
      if (image) image.remove(); // Remove old image
      // Clear previous joke
      const jokeEl = container.querySelector('.joke-text');
      if (jokeEl) jokeEl.textContent = '';
    } else {
      if (loader) loader.style.display = 'none';
    }
  });
}

function startCountdown(data) {
  const containers = [document.getElementById('hostImageContainer'), document.getElementById('teamImageContainer')];
  
  let count = 3;
  const countdownInterval = setInterval(() => {
    containers.forEach(container => {
      if (!container) return;
      const countdownEl = container.querySelector('.countdown');
      if (countdownEl) {
        countdownEl.style.display = 'block';
        countdownEl.textContent = count;
      }
    });
    
    if (count === 0) {
      clearInterval(countdownInterval);
      containers.forEach(container => {
        if (!container) return;
        const countdownEl = container.querySelector('.countdown');
        if (countdownEl) countdownEl.style.display = 'none';
        
        // Create and append image instead of replacing innerHTML
        const img = document.createElement('img');
        img.src = data.imageUrl;
        img.alt = "Guess this image";
        container.appendChild(img);
        
        showLoadingIndicator(false);
      });
      startRoundUI(data);
    }
    count--;
  }, 1000);
}

function saveState() {
  localStorage.setItem('gameState', JSON.stringify(gameState));
}