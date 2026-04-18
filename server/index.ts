import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomManager, type GameAction } from './roomManager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const rooms = new RoomManager();

app.use(cors());
app.use(express.json());

// Serve built frontend
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));
app.get('/{*path}', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

// ─── AI scheduling callback ────────────────────────────────────────────────────

function onAIAction(roomId: string) {
  const state = rooms.triggerAI(roomId, onAIAction);
  if (state) io.to(roomId).emit('state_update', { state });
}

// ─── Socket events ────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  socket.on('create_room', ({ playerName, maxPlayers }, cb) => {
    try {
      const { roomId, room } = rooms.createRoom(socket.id, playerName, maxPlayers);
      socket.join(roomId);
      console.log(`Room ${roomId} created by ${playerName} (${room.maxPlayers}P)`);
      cb({ roomId, room });
    } catch (e) {
      cb({ error: String(e) });
    }
  });

  socket.on('join_room', ({ roomId, playerName }, cb) => {
    const result = rooms.joinRoom(roomId, socket.id, playerName);
    if (!result.ok) { cb({ error: result.error }); return; }
    socket.join(roomId);
    io.to(roomId).emit('room_update', { room: result.room! });
    console.log(`${playerName} joined ${roomId}`);
    cb({ ok: true, room: result.room });
  });

  socket.on('select_char', ({ roomId, characterId }) => {
    const room = rooms.selectCharacter(socket.id, characterId);
    if (room) io.to(roomId).emit('room_update', { room });
  });

  socket.on('reveal_roles', ({ roomId }, cb) => {
    const result = rooms.preAssignRoles(roomId, socket.id);
    if (!result.ok) { cb?.({ error: result.error }); return; }
    result.roleMap!.forEach((role, sid) => {
      io.to(sid).emit('your_role', { role });
    });
    const pub = rooms.toPublic(rooms.rooms.get(roomId)!);
    io.to(roomId).emit('room_update', { room: pub });
    cb?.({ ok: true });
  });

  socket.on('start_game', ({ roomId }, cb) => {
    const result = rooms.startGame(roomId, socket.id, onAIAction);
    if (!result.ok) { cb({ error: result.error }); return; }

    // Send personalized game_started to each human player
    result.playerMap!.forEach((playerId, sid) => {
      io.to(sid).emit('game_started', { state: result.state!, myPlayerId: playerId });
    });

    io.to(roomId).emit('state_update', { state: result.state! });
    console.log(`Game started in ${roomId}`);
    cb({ ok: true });
  });

  socket.on('player_action', ({ roomId, action }) => {
    const result = rooms.handleAction(roomId, socket.id, action as GameAction);
    if (result) {
      io.to(roomId).emit('state_update', { state: result.state });
      const room = rooms.rooms.get(roomId);
      if (room) rooms.scheduleAI(room, onAIAction);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);
    const affected = rooms.handleDisconnect(socket.id, onAIAction);
    affected.forEach(({ roomId, pub, gameState }) => {
      io.to(roomId).emit('room_update', { room: pub });
      if (gameState) io.to(roomId).emit('state_update', { state: gameState });
    });
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 3001;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Server on http://0.0.0.0:${PORT}`);
});
