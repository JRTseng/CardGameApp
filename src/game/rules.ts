import type { Card, CardType, Player, GameState } from '../types/game';
import { cardColor } from '../data/cards';

export function isBasicType(type: CardType): boolean {
  return type === 'sha' || type === 'sha_fire' || type === 'shan' || type === 'tao';
}

export function isShaType(type: CardType): boolean {
  return type === 'sha' || type === 'sha_fire';
}

/** Whether a card can be used/played as 殺 by this player */
export function cardCanBeSha(card: Card, player: Player): boolean {
  if (isShaType(card.type)) return true;
  if (player.character.id === 'guanyu' && cardColor(card) === 'red') return true;
  if (player.character.id === 'zhaoyun' && isBasicType(card.type)) return true;
  return false;
}

/** Whether a card can be used/played as 閃 by this player */
export function cardCanBeShan(card: Card, player: Player): boolean {
  if (card.type === 'shan') return true;
  if (player.character.id === 'zhaoyun' && isBasicType(card.type)) return true;
  return false;
}

/** Whether a player can use another 殺 this turn */
export function canUseSha(player: Player): boolean {
  if (player.character.id === 'zhangfei') return true;
  if (player.equipment.weapon?.type === 'zhuge_nu') return true;
  if (player.character.id === 'zhangliao') return player.shaCount < 2; // 突擊
  return player.shaCount === 0;
}

/** Physical seat distance between two alive players */
export function seatDistance(fromId: number, toId: number, players: Player[]): number {
  const alive = players.filter(p => p.isAlive);
  const fi = alive.findIndex(p => p.id === fromId);
  const ti = alive.findIndex(p => p.id === toId);
  if (fi === -1 || ti === -1) return 999;
  const n = alive.length;
  const cw = (ti - fi + n) % n;
  const ccw = (fi - ti + n) % n;
  return Math.min(cw, ccw);
}

/** Effective attack distance adjusted by horses */
export function effectiveDistance(fromId: number, toId: number, players: Player[]): number {
  const base = seatDistance(fromId, toId, players);
  const from = players.find(p => p.id === fromId)!;
  const to = players.find(p => p.id === toId)!;
  let d = base;
  if (from.equipment.horse_minus) d -= 1;
  if (to.equipment.horse_plus) d += 1;
  return Math.max(1, d);
}

/** Attack range for a player */
export function attackRange(player: Player): number {
  if (player.character.id === 'maochao') return 2;
  if (player.equipment.weapon?.type === 'qinglong_dao') return 3;
  return 1;
}

/** Whether fromId can attack toId with 殺 */
export function inAttackRange(fromId: number, toId: number, players: Player[]): boolean {
  const attacker = players.find(p => p.id === fromId)!;
  return effectiveDistance(fromId, toId, players) <= attackRange(attacker);
}

/** Check if 諸葛亮 空城 blocks this card type */
export function kongchengBlocks(target: Player, cardType: CardType): boolean {
  if (target.character.id !== 'zhugeliang') return false;
  if (target.hand.length > 0) return false;
  return cardType === 'sha' || cardType === 'sha_fire' || cardType === 'juedou';
}

/** Get valid targets for a 殺 from player */
export function getShaTargets(player: Player, state: GameState): number[] {
  return state.players
    .filter(p =>
      p.isAlive &&
      p.id !== player.id &&
      inAttackRange(player.id, p.id, state.players) &&
      !kongchengBlocks(p, 'sha')
    )
    .map(p => p.id);
}

function hasEquipment(player: Player): boolean {
  const e = player.equipment;
  return !!(e.weapon || e.armor || e.horse_minus || e.horse_plus);
}

/** Get valid targets for trick cards */
export function getTrickTargets(
  player: Player,
  cardType: CardType,
  state: GameState,
): number[] {
  const others = state.players.filter(p => p.isAlive && p.id !== player.id);

  switch (cardType) {
    case 'juedou':
      return others
        .filter(p => !kongchengBlocks(p, 'juedou'))
        .map(p => p.id);
    case 'guohe':
      return others
        .filter(p => p.hand.length > 0 || hasEquipment(p))
        .map(p => p.id);
    case 'shuntian':
      return others
        .filter(p =>
          effectiveDistance(player.id, p.id, state.players) === 1 &&
          (p.hand.length > 0 || hasEquipment(p))
        )
        .map(p => p.id);
    default:
      return others.map(p => p.id);
  }
}

/** Hand limit = current HP (+2 for 周瑜 英姿 / 袁紹 雄才) */
export function handLimit(player: Player): number {
  const base = Math.max(player.hp, 1);
  if (player.character.id === 'zhouyu') return base + 2;
  if (player.character.id === 'yuanshao') return base + 2;
  return base;
}

/** Whether a card can be played in current state */
export function canPlayCard(card: Card, player: Player, state: GameState): boolean {
  if (state.phase !== 'play') return false;
  if (state.pendingAction) return false;
  if (state.players[state.currentPlayerIndex].id !== player.id) return false;

  switch (card.category) {
    case 'basic':
      if (card.type === 'tao') return player.hp < player.maxHp;
      if (cardCanBeSha(card, player)) return canUseSha(player) && getShaTargets(player, state).length > 0;
      return false;
    case 'trick':
      // 華佗 青嚢: ♣ trick cards can be used as 桃 when HP < maxHp
      if (player.character.id === 'huatuo' && card.suit === '♣' && player.hp < player.maxHp) return true;
      if (card.type === 'wanjian' || card.type === 'nanman' || card.type === 'wuzhong') return true;
      if (card.type === 'taoyuan') return state.players.some(p => p.isAlive && p.hp < p.maxHp);
      if (card.type === 'wugu') return true;
      if (card.type === 'guohe') return getTrickTargets(player, 'guohe', state).length > 0;
      if (card.type === 'shuntian') return getTrickTargets(player, 'shuntian', state).length > 0;
      if (card.type === 'juedou') return getTrickTargets(player, 'juedou', state).length > 0;
      return false;
    case 'weapon':
    case 'armor':
    case 'horse_minus':
    case 'horse_plus':
      return true;
    default:
      return false;
  }
}

/** Whether this card needs a target when played */
export function needsTarget(card: Card, player: Player): boolean {
  // 華佗 青嚢: ♣ trick cards used as tao need no target
  if (player.character.id === 'huatuo' && card.suit === '♣' && card.category === 'trick') return false;
  if (cardCanBeSha(card, player)) return true;
  if (card.type === 'juedou') return true;
  if (card.type === 'guohe') return true;
  if (card.type === 'shuntian') return true;
  return false;
}
