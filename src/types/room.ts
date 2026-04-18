// Room and socket event types

export interface RoomPlayer {
  socketId: string;
  name: string;
  characterId: string | null;
  isHost: boolean;
  isReady: boolean;
}

export interface RoomState {
  id: string;
  players: RoomPlayer[];
  status: 'waiting' | 'playing';
  maxPlayers: number;
  rolesAssigned: boolean;
}

// GameAction is imported from engine by consumers; use unknown here to avoid circular deps
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAction = Record<string, any>;
