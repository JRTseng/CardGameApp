// Game types for 三國決殺
export type Suit = '♠' | '♥' | '♦' | '♣';

export type CardType =
  | 'sha' | 'sha_fire'
  | 'shan' | 'tao'
  | 'wanjian' | 'nanman' | 'wuzhong'
  | 'guohe' | 'shuntian' | 'juedou'
  | 'taoyuan' | 'wugu'
  | 'zhuge_nu' | 'bagua_zhen' | 'renwang_dun'
  | 'jueying' | 'dilu'
  | 'qinglong_dao' | 'zhuque_yu';

export type CardCategory = 'basic' | 'trick' | 'weapon' | 'armor' | 'horse_minus' | 'horse_plus';

export type Role = 'lord' | 'loyalist' | 'rebel' | 'spy';

export type Phase = 'not_started' | 'draw' | 'play' | 'discard' | 'game_over';

export type Kingdom = 'wei' | 'shu' | 'wu' | 'neutral';

export interface Card {
  id: string;
  type: CardType;
  suit: Suit;
  number: number;
  category: CardCategory;
  name: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  type: 'passive' | 'active' | 'trigger';
}

export interface Character {
  id: string;
  name: string;
  kingdom: Kingdom;
  baseHp: number;
  gender: 'male' | 'female';
  skill: Skill;
  color: string;
  portrait: string;
}

export interface Equipment {
  weapon: Card | null;
  armor: Card | null;
  horse_minus: Card | null;
  horse_plus: Card | null;
}

export interface Player {
  id: number;
  name: string;
  isHuman: boolean;
  character: Character;
  role: Role;
  hp: number;
  maxHp: number;
  hand: Card[];
  equipment: Equipment;
  isAlive: boolean;
  shaCount: number;
  skillUsed: boolean;
  roleRevealed: boolean;
  givenCards: number; // for 劉備 仁德
}

export type PendingType =
  | 'respond_sha'
  | 'respond_nanman'
  | 'respond_wanjian'
  | 'respond_juedou'
  | 'selecting_target'
  | 'discard_down'
  | 'bagua_judgment';

export interface PendingAction {
  type: PendingType;
  actorId: number;
  sourcePlayerId: number;
  sourceCardId?: string;
  isFire?: boolean;
  damage?: number;
  remainingTargets?: number[];
  juedouNextAttacker?: number;
  juedouLastShaPlayerId?: number;
  message: string;
  // for selecting target
  selectingCardId?: string;
  selectingCardType?: CardType;
}

export interface GameState {
  phase: Phase;
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  currentPlayerIndex: number;
  round: number;
  log: string[];
  gameOver: boolean;
  winnerRole: Role | null;
  winnerPlayerIds: number[];
  pendingAction: PendingAction | null;
  selectedCardId: string | null;
  discardCount: number;
}
