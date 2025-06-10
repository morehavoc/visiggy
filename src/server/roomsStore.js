const fs = require('fs');
const path = require('path');

const rooms = new Map();

function createRoom() {
  const id = Math.random().toString(36).slice(2, 8).toUpperCase();
  const room = {
    id,
    stage: 'lobby',
    teams: {},
    scores: {},
    currentRound: 0,
    roundsPlayed: 0,
    createdAt: Date.now(),
    currentPrompt: null,
    currentImage: null,
    nextPrompt: null,
    nextImagePromise: null,
  };
  rooms.set(id, room);
  return id;
}

function get(id) {
  return rooms.get(id);
}

function save() {
  if (!process.env.ROOMS_FILE) return;
  
  try {
    const data = [];
    rooms.forEach((room, id) => {
      // Don't save WebSocket connections
      const cleanRoom = {
        ...room,
        teams: Object.keys(room.teams).reduce((acc, name) => {
          acc[name] = { score: room.teams[name].score };
          return acc;
        }, {}),
        hostWs: undefined,
        roundTimeout: undefined
      };
      data.push([id, cleanRoom]);
    });
    
    fs.writeFileSync(
      path.join(process.cwd(), process.env.ROOMS_FILE),
      JSON.stringify(data, null, 2)
    );
    console.log('Rooms saved to disk');
  } catch (error) {
    console.error('Failed to save rooms:', error);
  }
}

function load() {
  if (!process.env.ROOMS_FILE) return;
  
  try {
    const filePath = path.join(process.cwd(), process.env.ROOMS_FILE);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      data.forEach(([id, room]) => {
        // Reconstruct teams object
        const teams = {};
        Object.keys(room.teams).forEach(name => {
          teams[name] = { score: room.teams[name].score };
        });
        rooms.set(id, { ...room, teams });
      });
      console.log(`Loaded ${rooms.size} rooms from disk`);
    }
  } catch (error) {
    console.error('Failed to load rooms:', error);
  }
}

module.exports = {
  createRoom,
  get,
  save,
  load
};