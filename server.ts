import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameState, InputState } from './src/shared.js';
import { updateGameState } from './src/gameLogic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: '*' } });

  interface Room {
    id: string;
    hostToken: string;
    hostSocketId: string;
    state: GameState;
    inputs: Map<string, InputState>;
    lastShots: Map<string, number>;
    lastUltimates: Map<string, number>;
    isPaused: boolean;
    connectedSockets: Set<string>;
  }

  const rooms = new Map<string, Room>();
  const socketRooms = new Map<string, string>();

  function generateRoomCode() {
    let code;
    do {
      code = Math.random().toString(36).substring(2, 6).toLowerCase();
    } while (rooms.has(code));
    return code;
  }

  io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('create_room', ({ coins, hostToken, inventory, loadout, customElements }: { coins: number, hostToken: string, inventory?: string[], loadout?: any, customElements?: any }) => {
      const code = generateRoomCode();
      console.log('Created room:', code);
      rooms.set(code, {
        id: code,
        hostToken,
        hostSocketId: socket.id,
        state: { players: {}, projectiles: {}, enemies: {}, lootOrbs: {}, floatingTexts: {}, customElements: customElements || {}, hazards: {}, bosses: {}, impactDecals: {}, tiles: {} },
        inputs: new Map(),
        lastShots: new Map(),
        lastUltimates: new Map(),
        isPaused: false,
        connectedSockets: new Set([socket.id])
      });
      socket.join(code);
      socketRooms.set(socket.id, code);
      socket.emit('room_joined', { code, id: socket.id, coins, isHost: true });
    });

    socket.on('join_room', ({ code, coins, hostToken, inventory, loadout, customElements }: { code: string, coins: number, hostToken: string, inventory?: string[], loadout?: any, customElements?: any }) => {
      console.log('Join room attempt:', code);
      code = code.toLowerCase();
      const room = rooms.get(code);
      if (room) {
        room.connectedSockets.add(socket.id);
        socket.join(code);
        socketRooms.set(socket.id, code);
        
        // Merge custom elements
        if (customElements) {
          Object.assign(room.state.customElements, customElements);
        }

        socket.emit('room_joined', { code, id: socket.id, coins, isHost: room.hostToken === hostToken });
      } else {
        socket.emit('room_error', 'Room not found');
      }
    });

    socket.on('delete_room', ({ hostToken }: { hostToken: string }) => {
      const roomId = socketRooms.get(socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room && room.hostToken === hostToken) {
          io.to(roomId).emit('room_error', 'Server closed by host');
          rooms.delete(roomId);
        }
      }
    });

    socket.on('spawn', ({ pvePenalty, pvpPenalty, coins, inventory, loadout, displayName }) => {
      const roomId = socketRooms.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      room.state.players[socket.id] = {
        id: socket.id,
        displayName: displayName || `Player ${socket.id.substring(0, 4)}`,
        x: Math.random() * 500 - 250,
        y: Math.random() * 500 - 250,
        color: `hsl(${Math.random() * 360}, 80%, 60%)`,
        speed: 5,
        vx: 0,
        vy: 0,
        coins: coins,
        pvePenalty,
        pvpPenalty,
        inventory: inventory || [],
        loadout: loadout || { attack: null, defense: null, mobility: null, healing: null, ultimate: null },
        hp: 100,
        maxHp: 100,
        statusEffects: []
      };
    });

    socket.on('buy', ({ element }) => {
      const roomId = socketRooms.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.state.players[socket.id];
      if (player && player.coins >= 100 && !player.inventory.includes(element)) {
        player.coins -= 100;
        player.inventory.push(element);
      }
    });

    socket.on('equip', ({ slot, element }) => {
      const roomId = socketRooms.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.state.players[socket.id];
      if (player) {
        player.loadout[slot] = element;
      }
    });

    socket.on('forge_element', ({ newElement, cost, consumedElements }) => {
      console.log('Received forge_element:', newElement.id, 'cost:', cost, 'consumed:', consumedElements);
      const roomId = socketRooms.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.state.players[socket.id];
      if (player && player.coins >= cost) {
        player.coins -= cost;
        
        // Remove consumed elements
        if (consumedElements && Array.isArray(consumedElements)) {
          consumedElements.forEach(id => {
            const index = player.inventory.indexOf(id);
            if (index !== -1) {
              player.inventory.splice(index, 1);
            }
          });
        }

        room.state.customElements[newElement.id] = newElement;
        player.inventory.push(newElement.id);
        console.log('Forged element added to room state:', newElement.id);
      } else {
        console.log('Forge failed: player not found or not enough coins', { playerCoins: player?.coins, cost });
      }
    });

    socket.on('input', (input: InputState) => {
      const roomId = socketRooms.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      room.inputs.set(socket.id, input);
    });

    socket.on('toggle_pause', () => {
      const roomId = socketRooms.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.hostSocketId !== socket.id) return;

      room.isPaused = !room.isPaused;
      io.to(roomId).emit('pause_state', room.isPaused);
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      const roomId = socketRooms.get(socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          delete room.state.players[socket.id];
          room.inputs.delete(socket.id);
          room.lastShots.delete(socket.id);
          room.lastUltimates.delete(socket.id);
          room.connectedSockets.delete(socket.id);
          
          // Room runs forever until host deletes it
        }
        socketRooms.delete(socket.id);
      }
    });
  });

  // Server Game Loop (60fps)
  let lastTime = Date.now();
  setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    for (const room of rooms.values()) {
      if (!room.isPaused) {
        updateGameState(room.state, room.inputs, room.lastShots, room.lastUltimates, now, dt, true);
      }
      io.to(room.id).emit('state', room.state);
    }
  }, 1000 / 60);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist/index.html')));
  }

  httpServer.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://localhost:3000');
  });
}

startServer();
