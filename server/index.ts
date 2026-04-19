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

// ─── AI / turn-timer callbacks ────────────────────────────────────────────────

function emitTurnTimer(roomId: string) {
  const deadline = rooms.getTurnDeadline(roomId);
  io.to(roomId).emit('turn_timer', { deadline });
}

function onAIAction(roomId: string) {
  const state = rooms.triggerAI(roomId, onAIAction, onTurnExpire);
  if (state) {
    io.to(roomId).emit('state_update', { state });
    emitTurnTimer(roomId);
  }
}

function onTurnExpire(roomId: string) {
  const room = rooms.rooms.get(roomId);
  // Mark the timed-out player as ai-assisted before triggering action
  if (room?.gameState) {
    const { gameState: gs } = room;
    const pa = gs.pendingAction;
    const actorId = pa ? pa.actorId : gs.players[gs.currentPlayerIndex].id;
    room.aiAssistPlayers.add(actorId);
  }
  const state = rooms.triggerTimeout(roomId, onAIAction, onTurnExpire);
  if (state) {
    io.to(roomId).emit('state_update', { state });
    emitTurnTimer(roomId);
    // Notify human players to enter AI assist mode in their client
    if (room) {
      for (const sid of room.socketToPlayerId.keys()) {
        io.to(sid).emit('ai_takeover');
      }
      io.to(roomId).emit('ai_assist_update', { playerIds: rooms.getAiAssistPlayerIds(roomId) });
    }
  }
}

// ─── Socket events ────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  socket.on('create_room', ({ playerName, maxPlayers, turnTimeLimit }, cb) => {
    try {
      const { roomId, room } = rooms.createRoom(socket.id, playerName, maxPlayers, turnTimeLimit ?? 60);
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
    const result = rooms.startGame(roomId, socket.id, onAIAction, onTurnExpire);
    if (!result.ok) { cb({ error: result.error }); return; }

    // Send personalized game_started to each human player
    result.playerMap!.forEach((playerId, sid) => {
      io.to(sid).emit('game_started', { state: result.state!, myPlayerId: playerId });
    });

    io.to(roomId).emit('state_update', { state: result.state! });
    emitTurnTimer(roomId);
    console.log(`Game started in ${roomId}`);
    cb({ ok: true });
  });

  socket.on('player_action', ({ roomId, action }) => {
    const result = rooms.handleAction(roomId, socket.id, action as GameAction);
    if (result) {
      io.to(roomId).emit('state_update', { state: result.state });
      const room = rooms.rooms.get(roomId);
      if (room) rooms.scheduleAI(room, onAIAction, onTurnExpire);
      emitTurnTimer(roomId);
    }
  });

  socket.on('set_ai_assist', ({ active }: { active: boolean }) => {
    const result = rooms.setAiAssist(socket.id, active);
    if (result) {
      io.to(result.roomId).emit('ai_assist_update', { playerIds: result.aiAssistPlayerIds });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);
    const affected = rooms.handleDisconnect(socket.id, onAIAction);
    affected.forEach(({ roomId, pub, gameState }) => {
      io.to(roomId).emit('room_update', { room: pub });
      if (gameState) io.to(roomId).emit('state_update', { state: gameState });
      // Broadcast cleared AI assist state
      io.to(roomId).emit('ai_assist_update', { playerIds: rooms.getAiAssistPlayerIds(roomId) });
    });
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 3001;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Server on http://0.0.0.0:${PORT}`);
});
