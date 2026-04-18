import type { GameState, Player, Role } from '../src/types/game';
import { gameReducer, type GameAction } from '../src/game/engine';
import { ALL_CHARACTERS } from '../src/data/characters';
import { createDeck } from '../src/data/cards';
import { getRolesForCount } from '../src/data/roles';

export { type GameAction };

export interface RoomPlayer {
  socketId: string;
  name: string;
  characterId: string | null;
  isHost: boolean;
  isReady: boolean;
}

export interface RoomPublic {
  id: string;
  players: RoomPlayer[];
  status: 'waiting' | 'playing';
  maxPlayers: number;
}

interface Room {
  id: string;
  players: RoomPlayer[];
  status: 'waiting' | 'playing';
  maxPlayers: number;
  gameState: GameState | null;
  socketToPlayerId: Map<string, number>;
  aiTimer: ReturnType<typeof setTimeout> | null;
}

export class RoomManager {
  rooms = new Map<string, Room>();
  private socketToRoom = new Map<string, string>();

  private genId(): string {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  createRoom(socketId: string, playerName: string, maxPlayers = 4): { roomId: string; room: RoomPublic } {
    const id = this.genId();
    const clamped = Math.max(2, Math.min(15, maxPlayers));
    const room: Room = {
      id,
      players: [{ socketId, name: playerName, characterId: null, isHost: true, isReady: false }],
      status: 'waiting',
      maxPlayers: clamped,
      gameState: null,
      socketToPlayerId: new Map(),
      aiTimer: null,
    };
    this.rooms.set(id, room);
    this.socketToRoom.set(socketId, id);
    return { roomId: id, room: this.toPublic(room) };
  }

  joinRoom(roomId: string, socketId: string, playerName: string): { ok: boolean; room?: RoomPublic; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, error: '找不到房間' };
    if (room.status === 'playing') return { ok: false, error: '遊戲已開始' };
    if (room.players.length >= room.maxPlayers) return { ok: false, error: '房間已滿' };
    if (room.players.some(p => p.socketId === socketId)) return { ok: true, room: this.toPublic(room) };
    room.players.push({ socketId, name: playerName, characterId: null, isHost: false, isReady: false });
    this.socketToRoom.set(socketId, roomId);
    return { ok: true, room: this.toPublic(room) };
  }

  selectCharacter(socketId: string, characterId: string): RoomPublic | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;
    const room = this.rooms.get(roomId);
    if (!room || room.status === 'playing') return null;
    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return null;
    if (!ALL_CHARACTERS.find(c => c.id === characterId)) return null;
    const taken = room.players.some(p => p.socketId !== socketId && p.characterId === characterId);
    if (taken) return null;
    player.characterId = characterId;
    player.isReady = true;
    return this.toPublic(room);
  }

  startGame(
    roomId: string,
    hostSocketId: string,
    onAIAction: (rid: string) => void,
  ): { ok: boolean; state?: GameState; playerMap?: Map<string, number>; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, error: '找不到房間' };
    if (room.players[0].socketId !== hostSocketId) return { ok: false, error: '只有房主可以開始遊戲' };
    if (room.status === 'playing') return { ok: false, error: '遊戲進行中' };

    // Fill missing characters with random ones
    const usedChars = new Set(room.players.map(p => p.characterId).filter(Boolean) as string[]);
    const available = shuffle(ALL_CHARACTERS.map(c => c.id).filter(id => !usedChars.has(id)));
    room.players.forEach(p => { if (!p.characterId) { p.characterId = available.pop() ?? ALL_CHARACTERS[0].id; } });

    const state = buildGameState(room.players, room.maxPlayers);
    room.socketToPlayerId = new Map(room.players.map((p, i) => [p.socketId, i]));
    room.gameState = state;
    room.status = 'playing';

    this.scheduleAI(room, onAIAction);
    return { ok: true, state, playerMap: room.socketToPlayerId };
  }

  handleAction(roomId: string, socketId: string, action: GameAction): { state: GameState } | null {
    const room = this.rooms.get(roomId);
    if (!room?.gameState) return null;
    const playerId = room.socketToPlayerId.get(socketId);
    if (playerId === undefined) return null;

    const { gameState: state } = room;
    const pa = state.pendingAction;
    const current = state.players[state.currentPlayerIndex];
    const allowed = (!pa && current.id === playerId) || (pa && pa.actorId === playerId);
    if (!allowed) return null;

    const newState = gameReducer(state, action);
    room.gameState = newState;
    return { state: newState };
  }

  scheduleAI(room: Room, onAIAction: (rid: string) => void): void {
    if (room.aiTimer) clearTimeout(room.aiTimer);
    if (!room.gameState || room.gameState.gameOver) return;

    const { gameState: state } = room;
    const pa = state.pendingAction;
    const current = state.players[state.currentPlayerIndex];
    const isHuman = (id: number) => [...room.socketToPlayerId.values()].includes(id);

    const needsAI =
      (pa && !isHuman(pa.actorId)) ||
      (!pa && (state.phase === 'play' || state.phase === 'discard') && !isHuman(current.id));

    if (!needsAI) return;
    room.aiTimer = setTimeout(() => onAIAction(room.id), 700);
  }

  triggerAI(roomId: string, onAIAction: (rid: string) => void): GameState | null {
    const room = this.rooms.get(roomId);
    if (!room?.gameState) return null;
    room.gameState = gameReducer(room.gameState, { type: 'AI_ACTION' });
    this.scheduleAI(room, onAIAction);
    return room.gameState;
  }

  handleDisconnect(socketId: string, onAIAction: (rid: string) => void): Array<{ roomId: string; pub: RoomPublic; gameState?: GameState }> {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return [];
    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(roomId);
    if (!room) return [];

    if (room.status === 'waiting') {
      room.players = room.players.filter(p => p.socketId !== socketId);
      if (room.players.length === 0) { this.rooms.delete(roomId); return []; }
      if (!room.players.some(p => p.isHost)) room.players[0].isHost = true;
      return [{ roomId, pub: this.toPublic(room) }];
    }

    // Replace with AI
    const playerId = room.socketToPlayerId.get(socketId);
    room.socketToPlayerId.delete(socketId);
    if (playerId !== undefined && room.gameState) {
      room.gameState = {
        ...room.gameState,
        players: room.gameState.players.map(p =>
          p.id === playerId ? { ...p, isHuman: false, name: `AI(${p.character.name})` } : p
        ),
      };
      this.scheduleAI(room, onAIAction);
    }
    return [{ roomId, pub: this.toPublic(room), gameState: room.gameState ?? undefined }];
  }

  toPublic(room: Room): RoomPublic {
    return { id: room.id, players: room.players, status: room.status, maxPlayers: room.maxPlayers };
  }
}

// ─── Build game state from room players ───────────────────────────────────────

function buildGameState(humanPlayers: RoomPlayer[], maxPlayers: number): GameState {
  const allRoles = getRolesForCount(maxPlayers);
  const roles: Role[] = shuffle(allRoles);

  const humanCharIds = new Set(humanPlayers.map(p => p.characterId!));
  const aiChars = shuffle(ALL_CHARACTERS.filter(c => !humanCharIds.has(c.id)));

  const players: Player[] = [];
  for (let i = 0; i < maxPlayers; i++) {
    const isHuman = i < humanPlayers.length;
    const charId = isHuman ? humanPlayers[i].characterId! : (aiChars.shift()?.id ?? ALL_CHARACTERS[i % ALL_CHARACTERS.length].id);
    const char = ALL_CHARACTERS.find(c => c.id === charId) ?? ALL_CHARACTERS[0];
    const role = roles[i];
    const baseHp = char.baseHp + (role === 'lord' ? 1 : 0);
    players.push({
      id: i,
      name: isHuman ? humanPlayers[i].name : `AI(${char.name})`,
      isHuman,
      character: char,
      role,
      hp: baseHp,
      maxHp: baseHp,
      hand: [],
      equipment: { weapon: null, armor: null, horse_minus: null, horse_plus: null },
      isAlive: true,
      shaCount: 0,
      skillUsed: false,
      roleRevealed: role === 'lord',
      givenCards: 0,
    });
  }

  let deck = createDeck();
  // Reshuffle deck if not enough cards (large player counts)
  while (deck.length < players.length * 4 + 2) {
    deck = [...deck, ...createDeck()];
    deck = shuffle(deck);
  }
  for (const p of players) {
    for (let i = 0; i < 4; i++) {
      if (deck.length) p.hand.push(deck.pop()!);
    }
  }

  const lordIdx = players.findIndex(p => p.role === 'lord');
  const startIdx = lordIdx >= 0 ? lordIdx : 0;
  for (let i = 0; i < 2; i++) {
    if (deck.length) players[startIdx].hand.push(deck.pop()!);
  }

  return {
    phase: 'play',
    players,
    deck,
    discardPile: [],
    currentPlayerIndex: startIdx,
    round: 1,
    log: ['遊戲開始！', `輪到 ${players[startIdx].name} 的回合`],
    gameOver: false,
    winnerRole: null,
    winnerPlayerIds: [],
    pendingAction: null,
    selectedCardId: null,
    discardCount: 0,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
