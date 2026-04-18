import { io, type Socket } from 'socket.io-client';
import type { GameState, Role } from '../types/game';
import type { RoomState, AnyAction } from '../types/room';

// Typed socket events
export interface ServerToClientEvents {
  room_update:  (data: { room: RoomState }) => void;
  game_started: (data: { state: GameState; myPlayerId: number }) => void;
  state_update: (data: { state: GameState }) => void;
  server_error: (data: { message: string }) => void;
  your_role:    (data: { role: Role }) => void;
}

export interface ClientToServerEvents {
  create_room:   (data: { playerName: string; maxPlayers?: number }, cb: (r: { roomId?: string; room?: RoomState; error?: string }) => void) => void;
  join_room:     (data: { roomId: string; playerName: string }, cb: (r: { ok?: boolean; room?: RoomState; error?: string }) => void) => void;
  select_char:   (data: { roomId: string; characterId: string }) => void;
  reveal_roles:  (data: { roomId: string }, cb: (r: { ok?: boolean; error?: string }) => void) => void;
  start_game:    (data: { roomId: string }, cb: (r: { ok?: boolean; error?: string }) => void) => void;
  player_action: (data: { roomId: string; action: AnyAction }) => void;
}

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let _socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (!_socket) {
    _socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
    });
  }
  return _socket;
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
