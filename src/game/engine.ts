import type { GameState, Player, Card, Role, PendingAction, Equipment } from '../types/game';
import { ALL_CHARACTERS } from '../data/characters';
import { createDeck, cardColor } from '../data/cards';
import { getRolesForCount } from '../data/roles';
import {
  cardCanBeSha, cardCanBeShan, canUseSha,
  getShaTargets, kongchengBlocks,
  handLimit, seatDistance,
} from './rules';

// ─── Utility ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clonePlayers(players: Player[]): Player[] {
  return players.map(p => ({
    ...p,
    hand: [...p.hand],
    equipment: { ...p.equipment },
  }));
}

function removeFromHand(hand: Card[], cardId: string): [Card[], Card | null] {
  const idx = hand.findIndex(c => c.id === cardId);
  if (idx === -1) return [hand, null];
  const card = hand[idx];
  return [hand.filter((_, i) => i !== idx), card];
}

// ─── Draw ─────────────────────────────────────────────────────────────────────

function drawN(state: GameState, playerId: number, n: number): GameState {
  let deck = [...state.deck];
  let discard = [...state.discardPile];
  const players = clonePlayers(state.players);
  const player = players.find(p => p.id === playerId)!;
  const extraLog: string[] = [];

  for (let i = 0; i < n; i++) {
    if (deck.length === 0) {
      if (discard.length === 0) break;
      deck = shuffle(discard);
      discard = [];
      extraLog.push('牌堆已耗盡，棄牌堆重新洗牌');
    }
    player.hand.push(deck.pop()!);
  }

  return { ...state, players, deck, discardPile: discard, log: [...state.log, ...extraLog] };
}

function discardCardFromHand(state: GameState, playerId: number, cardId: string): GameState {
  const players = clonePlayers(state.players);
  const player = players.find(p => p.id === playerId)!;
  const [newHand, card] = removeFromHand(player.hand, cardId);
  if (!card) return state;
  player.hand = newHand;
  return { ...state, players, discardPile: [...state.discardPile, card] };
}

function discardEquipSlot(state: GameState, playerId: number, slot: keyof Equipment): GameState {
  const players = clonePlayers(state.players);
  const player = players.find(p => p.id === playerId)!;
  const card = player.equipment[slot];
  if (!card) return state;
  player.equipment = { ...player.equipment, [slot]: null };
  return { ...state, players, discardPile: [...state.discardPile, card] };
}

// ─── Damage ───────────────────────────────────────────────────────────────────

function applyDamage(
  state: GameState,
  targetId: number,
  dmg: number,
  sourcePlayerId: number,
  isFire = false,
): GameState {
  const players = clonePlayers(state.players);
  const target = players.find(p => p.id === targetId)!;
  const log = [...state.log];
  let discardPile = [...state.discardPile];

  // 典韋 重鎧: damage capped at 1
  let actualDmg = dmg;
  if (target.character.id === 'dianwei' && dmg > 1) {
    log.push(`典韋 重鎧：傷害上限為1點`);
    actualDmg = 1;
  }

  // 小喬 天香: auto-discard a ♥ card to reduce 1 damage
  if (target.character.id === 'xiaoqiao' && actualDmg > 0) {
    const heartIdx = target.hand.findIndex(c => c.suit === '♥');
    if (heartIdx !== -1) {
      const heartCard = target.hand.splice(heartIdx, 1)[0];
      discardPile = [...discardPile, heartCard];
      actualDmg = Math.max(0, actualDmg - 1);
      log.push(`小喬 天香：棄【${heartCard.name}】減少1點傷害`);
    }
  }

  target.hp = Math.max(0, target.hp - actualDmg);
  log.push(`${target.name} 受到 ${actualDmg} 點${isFire ? '火焰' : ''}傷害 (${target.hp}/${target.maxHp})`);

  if (actualDmg > 0) {
    // 曹操 奸雄 / 夏侯惇 剛烈: draw 1 when damaged
    if (target.character.id === 'caocao') {
      log.push(`曹操 奸雄：摸1張牌`);
      return checkDeath(drawN({ ...state, players, log, discardPile }, targetId, 1), targetId, sourcePlayerId);
    }
    if (target.character.id === 'xiahoudun') {
      log.push(`夏侯惇 剛烈：摸1張牌`);
      return checkDeath(drawN({ ...state, players, log, discardPile }, targetId, 1), targetId, sourcePlayerId);
    }
    // 郭嘉 遺計: draw 2 when damaged
    if (target.character.id === 'guojia') {
      log.push(`郭嘉 遺計：摸2張牌`);
      return checkDeath(drawN({ ...state, players, log, discardPile }, targetId, 2), targetId, sourcePlayerId);
    }
  }

  return checkDeath({ ...state, players, log, discardPile }, targetId, sourcePlayerId);
}

function checkDeath(state: GameState, targetId: number, killerId: number): GameState {
  const players = clonePlayers(state.players);
  const target = players.find(p => p.id === targetId)!;
  const log = [...state.log];

  if (target.hp > 0) return { ...state, players, log };

  // Auto-use 桃 if available
  const taoIdx = target.hand.findIndex(c => c.type === 'tao');
  if (taoIdx !== -1) {
    target.hand.splice(taoIdx, 1);
    const taoHeal = target.character.id === 'xunyu' ? 2 : 1; // 荀彧 節命
    target.hp = Math.min(taoHeal, target.maxHp);
    log.push(`${target.name} 使用【桃】脫險，回復至 ${target.hp} 血`);
    if (target.hp > 0) return { ...state, players, log };
  }

  // 周泰 不屈: discard 1 card to survive at 1 HP
  if (target.character.id === 'zhoutai' && target.hand.length > 0) {
    const saveCard = target.hand.splice(0, 1)[0];
    target.hp = 1;
    log.push(`周泰 不屈：棄【${saveCard.name}】以1血存活`);
    return { ...state, players, log, discardPile: [...state.discardPile, saveCard] };
  }

  // Dead
  target.isAlive = false;
  target.roleRevealed = true;
  log.push(`⚔️ ${target.name}（${roleLabel(target.role)}）陣亡！`);

  // Death rewards
  const killer = players.find(p => p.id === killerId);
  if (killer) {
    if (target.role === 'rebel') {
      const s = drawN({ ...state, players, log }, killer.id, 3);
      return checkWin(maybeSunjian({ ...s, log: [...s.log, `${killer.name} 擊殺反賊，摸3張牌`] }));
    }
    if (target.role === 'loyalist' && killer.role === 'lord') {
      log.push(`${killer.name}（主公）錯殺忠臣，棄置所有手牌及裝備！`);
      const lord = players.find(p => p.id === killer.id)!;
      const discards = [...lord.hand];
      lord.hand = [];
      const eq = lord.equipment;
      if (eq.weapon) { discards.push(eq.weapon); lord.equipment.weapon = null; }
      if (eq.armor) { discards.push(eq.armor); lord.equipment.armor = null; }
      if (eq.horse_minus) { discards.push(eq.horse_minus); lord.equipment.horse_minus = null; }
      if (eq.horse_plus) { discards.push(eq.horse_plus); lord.equipment.horse_plus = null; }
      return checkWin(maybeSunjian({ ...state, players, log, discardPile: [...state.discardPile, ...discards] }));
    }
  }

  return checkWin(maybeSunjian({ ...state, players, log }));
}

function maybeSunjian(state: GameState): GameState {
  const sunjian = state.players.find(p => p.isAlive && p.character.id === 'sunjian');
  if (!sunjian) return state;
  const s = drawN(state, sunjian.id, 2);
  return { ...s, log: [...s.log, `孫堅 英武：摸2張牌`] };
}

function checkWin(state: GameState): GameState {
  const { players } = state;
  const lord = players.find(p => p.role === 'lord')!;
  const alivePlayers = players.filter(p => p.isAlive);

  if (!lord.isAlive) {
    const aliveSpies = alivePlayers.filter(p => p.role === 'spy');
    if (aliveSpies.length > 0 && aliveSpies.length === alivePlayers.length) {
      return endGame(state, 'spy', aliveSpies.map(p => p.id), '內奸獲勝！');
    }
    const rebels = alivePlayers.filter(p => p.role === 'rebel');
    return endGame(state, 'rebel', rebels.map(p => p.id), '反賊 推翻主公！');
  }

  const threats = players.filter(p => (p.role === 'rebel' || p.role === 'spy') && p.isAlive);
  if (threats.length === 0) {
    const winners = players.filter(p => p.role === 'lord' || p.role === 'loyalist');
    return endGame(state, 'lord', winners.filter(p => p.isAlive).map(p => p.id), '主公與忠臣獲勝！');
  }

  return state;
}

function endGame(state: GameState, winnerRole: Role, winnerPlayerIds: number[], msg: string): GameState {
  const players = clonePlayers(state.players).map(p => ({ ...p, roleRevealed: true }));
  return {
    ...state,
    players,
    phase: 'game_over',
    gameOver: true,
    winnerRole,
    winnerPlayerIds,
    log: [...state.log, `🎉 ${msg}`],
  };
}

// ─── Equipment ────────────────────────────────────────────────────────────────

function equipCard(state: GameState, playerId: number, card: Card): GameState {
  const players = clonePlayers(state.players);
  const player = players.find(p => p.id === playerId)!;
  const [newHand, removed] = removeFromHand(player.hand, card.id);
  if (!removed) return state;
  player.hand = newHand;

  const slot = card.category as keyof Equipment;
  const old = player.equipment[slot];
  player.equipment = { ...player.equipment, [slot]: card };

  let discard = [...state.discardPile];
  if (old) discard = [...discard, old];

  return {
    ...state,
    players,
    discardPile: discard,
    log: [...state.log, `${player.name} 裝備了【${card.name}】`],
  };
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initGame(humanCharacterId: string, totalPlayers = 4, humanRole: Role = 'lord'): GameState {
  const allRoles = getRolesForCount(totalPlayers);
  // Remove one instance of humanRole from pool, shuffle the rest for AI
  const pool = [...allRoles];
  const hi = pool.findIndex(r => r === humanRole);
  if (hi !== -1) pool.splice(hi, 1);
  const roles: Role[] = [humanRole, ...shuffle(pool)];

  const otherIds = shuffle(
    ALL_CHARACTERS.map(c => c.id).filter(id => id !== humanCharacterId)
  );

  const players: Player[] = [];
  for (let i = 0; i < totalPlayers; i++) {
    const role = roles[i];
    const isHuman = i === 0;
    const charId = isHuman ? humanCharacterId : otherIds[i - 1];
    const char = ALL_CHARACTERS.find(c => c.id === charId) ?? ALL_CHARACTERS[i % ALL_CHARACTERS.length];
    const baseHp = char.baseHp + (role === 'lord' ? 1 : 0);
    players.push({
      id: i,
      name: isHuman ? '玩家' : `AI(${char.name})`,
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
      skipNextDraw: false,
    });
  }

  let deck = createDeck();
  if (totalPlayers > 8) deck = shuffle([...deck, ...createDeck()]);

  const lordIdx = players.findIndex(p => p.role === 'lord');
  const startIdx = lordIdx >= 0 ? lordIdx : 0;

  let state: GameState = {
    phase: 'draw',
    players,
    deck,
    discardPile: [],
    currentPlayerIndex: startIdx,
    round: 1,
    log: [`遊戲開始！${players[startIdx].name}（主公）先行。`],
    gameOver: false,
    winnerRole: null,
    winnerPlayerIds: [],
    pendingAction: null,
    selectedCardId: null,
    discardCount: 0,
  };

  // Deal 4 cards to each player
  for (const p of players) {
    state = drawN(state, p.id, 4);
  }

  state.log.push(`輪到 ${players[startIdx].name} 的回合`);
  return startDrawPhase(state);
}

// ─── Turn Transitions ─────────────────────────────────────────────────────────

function startDrawPhase(state: GameState): GameState {
  const p = state.players[state.currentPlayerIndex];

  // 曹仁 守城: heal 1 at start of turn if below max HP
  let st = state;
  if (p.character.id === 'caoren' && p.hp < p.maxHp) {
    const players = clonePlayers(st.players);
    const cp = players[st.currentPlayerIndex];
    cp.hp = Math.min(cp.hp + 1, cp.maxHp);
    st = { ...st, players, log: [...st.log, `曹仁 守城：回合開始回復1血 (${cp.hp}/${cp.maxHp})`] };
  }

  // 徐晃 斷糧: skip draw phase if flagged
  if (p.skipNextDraw) {
    const players = clonePlayers(st.players);
    players[st.currentPlayerIndex].skipNextDraw = false;
    return {
      ...st,
      players,
      phase: 'play',
      log: [...st.log, `${p.name} 因【斷糧】跳過摸牌階段`],
    };
  }

  const count = (p.character.id === 'diaochan' || p.character.id === 'zhenji') ? 3
              : p.character.id === 'dongzhuo' ? 1
              : 2;
  const s = drawN(st, p.id, count);
  return {
    ...s,
    phase: 'play',
    log: [...s.log, `${p.name} 摸了${count}張牌，進入出牌階段`],
  };
}

function maybeJizhi(state: GameState, playerId: number): GameState {
  const player = state.players.find(p => p.id === playerId);
  if (player?.character.id !== 'huangyueying') return state;
  const s = drawN(state, playerId, 1);
  return { ...s, log: [...s.log, `黃月英 集智：摸1張牌`] };
}

export function endPlayPhase(state: GameState): GameState {
  const p = state.players[state.currentPlayerIndex];
  const limit = handLimit(p);
  const excess = p.hand.length - limit;
  if (excess > 0) {
    return {
      ...state,
      phase: 'discard',
      discardCount: excess,
      log: [...state.log, `${p.name} 需要棄置 ${excess} 張牌`],
    };
  }
  return advanceToNextTurn(state);
}

function advanceToNextTurn(state: GameState): GameState {
  const alive = state.players.filter(p => p.isAlive);
  const currentIdx = alive.findIndex(p => p.id === state.players[state.currentPlayerIndex].id);
  const nextAlive = alive[(currentIdx + 1) % alive.length];
  const nextIdx = state.players.findIndex(p => p.id === nextAlive.id);

  const players = clonePlayers(state.players);
  const np = players[nextIdx];
  np.shaCount = 0;
  np.skillUsed = false;
  np.givenCards = 0;
  // skipNextDraw is cleared in startDrawPhase when triggered

  const newRound = nextIdx <= state.currentPlayerIndex ? state.round + 1 : state.round;

  const s: GameState = {
    ...state,
    players,
    currentPlayerIndex: nextIdx,
    round: newRound,
    phase: 'draw',
    pendingAction: null,
    selectedCardId: null,
    discardCount: 0,
    log: [...state.log, `── 輪到 ${np.name} 的回合（第${newRound}輪）`],
  };

  return startDrawPhase(s);
}

// ─── Play Card helpers ────────────────────────────────────────────────────────

function playFromHand(state: GameState, playerId: number, cardId: string): [GameState, Card | null] {
  const players = clonePlayers(state.players);
  const player = players.find(p => p.id === playerId)!;
  const [newHand, card] = removeFromHand(player.hand, cardId);
  if (!card) return [state, null];
  player.hand = newHand;
  return [{ ...state, players }, card];
}

function resolveWanjian(state: GameState, sourceId: number, card: Card): GameState {
  const targets = state.players
    .filter(p => p.isAlive && p.id !== sourceId && p.character.id !== 'luxun') // 陸遜 謙遜
    .map(p => p.id);
  if (targets.length === 0) return state;
  const [first, ...rest] = targets;
  return {
    ...state,
    discardPile: [...state.discardPile, card],
    log: [...state.log, `${state.players.find(p => p.id === sourceId)!.name} 使用【萬箭齊發】`],
    pendingAction: {
      type: 'respond_wanjian',
      actorId: first,
      sourcePlayerId: sourceId,
      remainingTargets: rest,
      message: `【萬箭齊發】：請出【閃】，否則受1點傷害`,
    },
  };
}

function resolveNanman(state: GameState, sourceId: number, card: Card): GameState {
  const targets = state.players
    .filter(p => p.isAlive && p.id !== sourceId && p.character.id !== 'luxun') // 陸遜 謙遜
    .map(p => p.id);
  if (targets.length === 0) return state;
  const [first, ...rest] = targets;
  return {
    ...state,
    discardPile: [...state.discardPile, card],
    log: [...state.log, `${state.players.find(p => p.id === sourceId)!.name} 使用【南蠻入侵】`],
    pendingAction: {
      type: 'respond_nanman',
      actorId: first,
      sourcePlayerId: sourceId,
      remainingTargets: rest,
      message: `【南蠻入侵】：請出【殺】，否則受1點傷害`,
    },
  };
}

function nextAoeTarget(
  state: GameState,
  type: 'respond_wanjian' | 'respond_nanman',
  sourceId: number,
  remaining: number[],
): GameState {
  if (remaining.length === 0) return { ...state, pendingAction: null };
  const [next, ...rest] = remaining;
  const msg = type === 'respond_wanjian'
    ? `【萬箭齊發】：請出【閃】，否則受1點傷害`
    : `【南蠻入侵】：請出【殺】，否則受1點傷害`;
  return {
    ...state,
    pendingAction: {
      type,
      actorId: next,
      sourcePlayerId: sourceId,
      remainingTargets: rest,
      message: msg,
    },
  };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type GameAction =
  | { type: 'SELECT_CARD'; cardId: string }
  | { type: 'DESELECT_CARD' }
  | { type: 'PLAY_CARD_NO_TARGET'; cardId: string }
  | { type: 'PLAY_CARD_ON_TARGET'; targetId: number }
  | { type: 'END_PLAY_PHASE' }
  | { type: 'DISCARD_CARD'; cardId: string }
  | { type: 'RESPOND_WITH_CARD'; cardId: string }
  | { type: 'SKIP_RESPONSE' }
  | { type: 'SKILL_GIVE_CARD'; targetId: number; cardIds: string[] }
  | { type: 'SKILL_ZHIHENG'; cardIds: string[] }
  | { type: 'SKILL_KULOU' }
  | { type: 'SKILL_QIXI'; targetId: number; cardId: string }
  | { type: 'SKILL_LUOFENG'; cardIds: string[] }
  | { type: 'SKILL_HAOSHI'; targetId: number; cardId: string }
  | { type: 'AI_ACTION' };

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (state.gameOver && action.type !== 'AI_ACTION') return state;

  switch (action.type) {
    case 'SELECT_CARD': {
      if (state.pendingAction || state.phase !== 'play') return state;
      const player = state.players[state.currentPlayerIndex];
      if (!player.isHuman) return state;
      const newId = state.selectedCardId === action.cardId ? null : action.cardId;
      return { ...state, selectedCardId: newId };
    }

    case 'DESELECT_CARD':
      return { ...state, selectedCardId: null };

    case 'PLAY_CARD_NO_TARGET': {
      const player = state.players[state.currentPlayerIndex];
      if (!player.isHuman) return state;
      const card = player.hand.find(c => c.id === action.cardId);
      if (!card) return state;
      return playCardNoTarget(state, player.id, card);
    }

    case 'PLAY_CARD_ON_TARGET': {
      const player = state.players[state.currentPlayerIndex];
      if (!player.isHuman) return state;
      if (!state.selectedCardId) return state;
      const card = player.hand.find(c => c.id === state.selectedCardId);
      if (!card) return state;
      return playCardOnTarget({ ...state, selectedCardId: null }, player.id, card, action.targetId);
    }

    case 'END_PLAY_PHASE': {
      if (state.phase !== 'play') return state;
      if (state.pendingAction) return state;
      const player = state.players[state.currentPlayerIndex];
      if (!player.isHuman) return state;
      return endPlayPhase(state);
    }

    case 'DISCARD_CARD': {
      if (state.phase !== 'discard') return state;
      const player = state.players[state.currentPlayerIndex];
      if (!player.isHuman) return state;
      let s = discardCardFromHand(state, player.id, action.cardId);
      // 姜維 志繼: draw 1 for each card discarded in discard phase
      if (player.character.id === 'jiangwei') {
        s = drawN(s, player.id, 1);
        s = { ...s, log: [...s.log, `姜維 志繼：摸1張牌`] };
      }
      const remaining = s.discardCount - 1;
      if (remaining <= 0) return advanceToNextTurn({ ...s, discardCount: 0 });
      return { ...s, discardCount: remaining };
    }

    case 'RESPOND_WITH_CARD': {
      if (!state.pendingAction) return state;
      const pa = state.pendingAction;
      const actor = state.players.find(p => p.id === pa.actorId);
      if (!actor?.isHuman) return state;
      return respondWithCard(state, pa.actorId, action.cardId);
    }

    case 'SKIP_RESPONSE': {
      if (!state.pendingAction) return state;
      const pa = state.pendingAction;
      const actor = state.players.find(p => p.id === pa.actorId);
      if (!actor?.isHuman) return state;
      return skipResponse(state);
    }

    case 'SKILL_GIVE_CARD': {
      const player = state.players[state.currentPlayerIndex];
      if (!player.isHuman) return state;
      return skillGiveCard(state, player.id, action.targetId, action.cardIds, player.character.id);
    }

    case 'SKILL_ZHIHENG': {
      const player = state.players[state.currentPlayerIndex];
      if (!player.isHuman || player.character.id !== 'sunquan' || player.skillUsed) return state;
      return skillZhiheng(state, player.id, action.cardIds);
    }

    case 'SKILL_KULOU': {
      const player = state.players[state.currentPlayerIndex];
      if (!player.isHuman || player.character.id !== 'huanggai' || player.skillUsed) return state;
      return skillKulou(state, player.id);
    }

    case 'SKILL_QIXI': {
      const player = state.players[state.currentPlayerIndex];
      if (!player.isHuman || player.character.id !== 'ganning' || player.skillUsed) return state;
      return skillQixi(state, player.id, action.targetId, action.cardId);
    }

    case 'SKILL_LUOFENG': {
      const player = state.players[state.currentPlayerIndex];
      if (!player.isHuman || player.character.id !== 'pangtong' || player.skillUsed) return state;
      return skillLuofeng(state, player.id, action.cardIds);
    }

    case 'SKILL_HAOSHI': {
      const player = state.players[state.currentPlayerIndex];
      if (!player.isHuman || player.character.id !== 'lusu' || player.skillUsed) return state;
      return skillHaoshi(state, player.id, action.targetId, action.cardId);
    }

    case 'AI_ACTION':
      return handleAIAction(state);

    default:
      return state;
  }
}

// ─── Play Card (no target) ────────────────────────────────────────────────────

function playCardNoTarget(state: GameState, playerId: number, card: Card): GameState {
  const player = state.players.find(p => p.id === playerId)!;

  if (['weapon', 'armor', 'horse_minus', 'horse_plus'].includes(card.category)) {
    return equipCard(state, playerId, card);
  }

  if (card.type === 'tao') {
    if (player.hp >= player.maxHp) return state;
    const [s, c] = playFromHand(state, playerId, card.id);
    if (!c) return state;
    const players = clonePlayers(s.players);
    const p = players.find(pp => pp.id === playerId)!;
    const taoHeal = p.character.id === 'xunyu' ? 2 : 1; // 荀彧 節命
    p.hp = Math.min(p.hp + taoHeal, p.maxHp);
    return {
      ...s,
      players,
      discardPile: [...s.discardPile, c],
      log: [...s.log, `${p.name} 使用【桃】，回復至 ${p.hp}/${p.maxHp} 血`],
    };
  }

  // 華佗 青嚢: ♣ trick card used as 桃
  if (player.character.id === 'huatuo' && card.suit === '♣' && card.category === 'trick' && player.hp < player.maxHp) {
    const [s, c] = playFromHand(state, playerId, card.id);
    if (!c) return state;
    const players = clonePlayers(s.players);
    const p = players.find(pp => pp.id === playerId)!;
    p.hp = Math.min(p.hp + 1, p.maxHp);
    return {
      ...s,
      players,
      discardPile: [...s.discardPile, c],
      log: [...s.log, `${p.name} 青嚢：棄【${c.name}】回復1血 (→${p.hp}/${p.maxHp})`],
    };
  }

  if (card.type === 'wanjian') {
    const [s, c] = playFromHand(state, playerId, card.id);
    if (!c) return state;
    return maybeJizhi(resolveWanjian(s, playerId, c), playerId);
  }

  if (card.type === 'nanman') {
    const [s, c] = playFromHand(state, playerId, card.id);
    if (!c) return state;
    return maybeJizhi(resolveNanman(s, playerId, c), playerId);
  }

  if (card.type === 'wuzhong') {
    const [s, c] = playFromHand(state, playerId, card.id);
    if (!c) return state;
    const s2 = drawN(s, playerId, 2);
    const s3 = {
      ...s2,
      discardPile: [...s2.discardPile, c],
      log: [...s2.log, `${player.name} 使用【無中生有】，摸2張牌`],
    };
    return maybeJizhi(s3, playerId);
  }

  if (card.type === 'taoyuan') {
    const [s, c] = playFromHand(state, playerId, card.id);
    if (!c) return state;
    let s2 = { ...s, discardPile: [...s.discardPile, c] };
    const healed: string[] = [];
    const players = clonePlayers(s2.players);
    for (const p of players) {
      if (p.isAlive && p.hp < p.maxHp) {
        p.hp = Math.min(p.hp + 1, p.maxHp);
        healed.push(`${p.name}(→${p.hp})`);
      }
    }
    s2 = { ...s2, players, log: [...s2.log, `${player.name} 使用【桃園結義】，${healed.join(' ')} 各回復1血`] };
    return maybeJizhi(s2, playerId);
  }

  if (card.type === 'wugu') {
    const [s, c] = playFromHand(state, playerId, card.id);
    if (!c) return state;
    let s2 = { ...s, discardPile: [...s.discardPile, c] };
    for (const p of s2.players.filter(pp => pp.isAlive)) {
      s2 = drawN(s2, p.id, 1);
    }
    s2 = { ...s2, log: [...s2.log, `${player.name} 使用【五穀豐登】，所有存活玩家各摸1張牌`] };
    return maybeJizhi(s2, playerId);
  }

  return state;
}

// ─── Play Card (with target) ──────────────────────────────────────────────────

function playCardOnTarget(state: GameState, playerId: number, card: Card, targetId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  const target = state.players.find(p => p.id === targetId);
  if (!target?.isAlive) return state;

  if (cardCanBeSha(card, player)) {
    if (!canUseSha(player)) return state;
    if (kongchengBlocks(target, card.type)) return state;

    const [s, c] = playFromHand(state, playerId, card.id);
    if (!c) return state;

    const players = clonePlayers(s.players);
    players.find(p => p.id === playerId)!.shaCount++;
    // 朱雀羽扇 使殺視為火殺
    const isFire = c.type === 'sha_fire' || player.equipment.weapon?.type === 'zhuque_yu';
    // 周瑜 縱火：火殺傷害+1
    let dmg = (isFire && player.character.id === 'zhouyu') ? 2 : 1;
    // 許褚 裸衣：HP ≤ 半血時殺傷害+1
    const isXuchu = player.character.id === 'xuchu';
    if (isXuchu && player.hp <= Math.floor(player.maxHp / 2)) dmg += 1;
    // 黃忠 烈弓：目標血量 ≤ 上限一半時殺傷害+1
    const isHuangzhong = player.character.id === 'huangzhong';
    if (isHuangzhong && target.hp <= Math.floor(target.maxHp / 2)) dmg += 1;
    // 張角 雷擊：黑色殺傷害+1
    const isZhangjue = player.character.id === 'zhangjue';
    if (isZhangjue && (c.suit === '♠' || c.suit === '♣')) dmg += 1;
    // 龐德 猛進：每回合第一張殺傷害+1
    const isPangde = player.character.id === 'pangde';
    if (isPangde && player.shaCount === 0) dmg += 1;
    // 廖化 追襲：目標1血時無法閃避
    const isLiaohua = player.character.id === 'liaohua';
    // 呂布 無雙：目標需出2張閃
    const isLubu = player.character.id === 'lubu';

    const shanNeeded = isLubu ? 2 : (isLiaohua && target.hp === 1) ? 99 : undefined;

    const extraNote = [
      isXuchu && player.hp <= Math.floor(player.maxHp / 2) ? '裸衣+1' : '',
      isHuangzhong && target.hp <= Math.floor(target.maxHp / 2) ? '烈弓+1' : '',
      isZhangjue && (c.suit === '♠' || c.suit === '♣') ? '雷擊+1' : '',
      isPangde && player.shaCount === 0 ? '猛進+1' : '',
      isLiaohua && target.hp === 1 ? '追襲(不可閃)' : '',
    ].filter(Boolean).map(s => `（${s}）`).join('');
    let result: GameState = {
      ...s,
      players,
      discardPile: [...s.discardPile, c],
      log: [...s.log, `${player.name} 對 ${target.name} 使用【${c.name}】${extraNote}`],
      pendingAction: {
        type: 'respond_sha',
        actorId: targetId,
        sourcePlayerId: playerId,
        sourceCardId: c.id,
        isFire,
        damage: dmg,
        shanNeeded,
        message: isLubu
          ? `遭受【無雙】！需出2張【閃】方可閃避！`
          : (isLiaohua && target.hp === 1)
            ? `遭受【追襲】！目標1血，無法閃避！`
            : isFire
              ? `遭受【火殺】！請出【閃】（仁王盾無效），否則受${dmg}點火焰傷害`
              : `遭受【殺】攻擊！請出【閃】，否則受1點傷害`,
      },
    };
    // 太史慈 天義：使用殺後摸1張牌
    if (player.character.id === 'taishici') {
      result = drawN({ ...result, log: [...result.log, `太史慈 天義：摸1張牌`] }, playerId, 1);
    }
    return result;
  }

  if (card.type === 'juedou') {
    if (kongchengBlocks(target, 'juedou')) return state;
    const [s, c] = playFromHand(state, playerId, card.id);
    if (!c) return s;
    const s2 = {
      ...s,
      discardPile: [...s.discardPile, c],
      log: [...s.log, `${player.name} 向 ${target.name} 發起【決鬥】`],
      pendingAction: {
        type: 'respond_juedou' as const,
        actorId: targetId,
        sourcePlayerId: playerId,
        juedouNextAttacker: playerId,
        message: `【決鬥】：請出【殺】，否則受1點傷害`,
      },
    };
    return maybeJizhi(s2, playerId);
  }

  if (card.type === 'guohe') {
    const [s, c] = playFromHand(state, playerId, card.id);
    if (!c) return state;
    const t = s.players.find(p => p.id === targetId)!;
    const all: Array<{ source: 'hand' | keyof Equipment; card: Card }> = [];
    t.hand.forEach(hc => all.push({ source: 'hand', card: hc }));
    if (t.equipment.weapon) all.push({ source: 'weapon', card: t.equipment.weapon });
    if (t.equipment.armor) all.push({ source: 'armor', card: t.equipment.armor });
    if (t.equipment.horse_minus) all.push({ source: 'horse_minus', card: t.equipment.horse_minus });
    if (t.equipment.horse_plus) all.push({ source: 'horse_plus', card: t.equipment.horse_plus });
    if (all.length === 0) return state;

    const pick = all[Math.floor(Math.random() * all.length)];
    let s2 = { ...s, discardPile: [...s.discardPile, c] };
    if (pick.source === 'hand') {
      s2 = discardCardFromHand(s2, targetId, pick.card.id);
    } else {
      s2 = discardEquipSlot(s2, targetId, pick.source as keyof Equipment);
    }
    return maybeJizhi({
      ...s2,
      log: [...s2.log, `${player.name} 使用【過河拆橋】，棄置 ${target.name} 的【${pick.card.name}】`],
    }, playerId);
  }

  if (card.type === 'shuntian') {
    const [s, c] = playFromHand(state, playerId, card.id);
    if (!c) return state;
    const t = s.players.find(p => p.id === targetId)!;
    const all: Array<{ source: 'hand' | keyof Equipment; card: Card }> = [];
    t.hand.forEach(hc => all.push({ source: 'hand', card: hc }));
    if (t.equipment.weapon) all.push({ source: 'weapon', card: t.equipment.weapon });
    if (t.equipment.armor) all.push({ source: 'armor', card: t.equipment.armor });
    if (t.equipment.horse_minus) all.push({ source: 'horse_minus', card: t.equipment.horse_minus });
    if (t.equipment.horse_plus) all.push({ source: 'horse_plus', card: t.equipment.horse_plus });
    if (all.length === 0) return state;

    const pick = all[Math.floor(Math.random() * all.length)];
    let s2 = { ...s, discardPile: [...s.discardPile, c] };

    if (pick.source === 'hand') {
      const players2 = clonePlayers(s2.players);
      const tgt = players2.find(p => p.id === targetId)!;
      const rcv = players2.find(p => p.id === playerId)!;
      const [newHand, stolen] = removeFromHand(tgt.hand, pick.card.id);
      if (stolen) { tgt.hand = newHand; rcv.hand.push(stolen); }
      s2 = { ...s2, players: players2 };
    } else {
      const players2 = clonePlayers(s2.players);
      const tgt = players2.find(p => p.id === targetId)!;
      const rcv = players2.find(p => p.id === playerId)!;
      const eqCard = tgt.equipment[pick.source as keyof Equipment];
      if (eqCard) {
        tgt.equipment = { ...tgt.equipment, [pick.source]: null };
        rcv.hand.push(eqCard);
      }
      s2 = { ...s2, players: players2 };
    }
    return maybeJizhi({
      ...s2,
      log: [...s2.log, `${player.name} 使用【順手牽羊】，奪取 ${target.name} 的【${pick.card.name}】`],
    }, playerId);
  }

  return state;
}

// ─── Respond ──────────────────────────────────────────────────────────────────

function respondWithCard(state: GameState, actorId: number, cardId: string): GameState {
  const pa = state.pendingAction!;
  const actor = state.players.find(p => p.id === actorId)!;

  if (pa.type === 'respond_sha' || pa.type === 'respond_wanjian') {
    // 廖化 追襲：shanNeeded >= 99 → cannot dodge
    if (pa.type === 'respond_sha' && (pa.shanNeeded ?? 0) >= 99) return state;
    const card = actor.hand.find(c => c.id === cardId);
    // 大喬 流離: any card can dodge SHA
    const canDodge = card && (cardCanBeShan(card, actor) || actor.character.id === 'daqiao');
    if (!canDodge) return state;
    const [s, used] = playFromHand(state, actorId, cardId);
    if (!used) return state;
    const s2 = { ...s, discardPile: [...s.discardPile, used] };
    // 呂布 無雙：目標需出2張閃才能閃避
    if (pa.type === 'respond_sha' && pa.shanNeeded && pa.shanNeeded > 1) {
      return {
        ...s2,
        log: [...s2.log, `${actor.name} 出【${used.name}】（呂布 無雙：還需再出1張【閃】）`],
        pendingAction: { ...pa, shanNeeded: pa.shanNeeded - 1, message: `【無雙】：請再出1張【閃】方可閃避！` },
      };
    }
    return resolveAfterDefend({ ...s2, log: [...s2.log, `${actor.name} 使用【${used.name}】閃避`] }, pa);
  }

  if (pa.type === 'respond_nanman') {
    const card = actor.hand.find(c => c.id === cardId);
    if (!card || !cardCanBeSha(card, actor)) return state;
    const [s, used] = playFromHand(state, actorId, cardId);
    if (!used) return state;
    const s2 = { ...s, discardPile: [...s.discardPile, used] };
    return resolveAfterDefend({ ...s2, log: [...s2.log, `${actor.name} 使用【${used.name}】抵擋`] }, pa);
  }

  if (pa.type === 'respond_juedou') {
    const card = actor.hand.find(c => c.id === cardId);
    if (!card || !cardCanBeSha(card, actor)) return state;
    const [s, used] = playFromHand(state, actorId, cardId);
    if (!used) return state;
    const s2 = { ...s, discardPile: [...s.discardPile, used] };

    // Flip: now the OTHER side must respond
    const nextDefender = pa.juedouNextAttacker === pa.actorId ? pa.sourcePlayerId : pa.actorId;
    const nextDefenderName = s2.players.find(p => p.id === nextDefender)?.name ?? '';
    return {
      ...s2,
      log: [...s2.log, `${actor.name} 出【殺】，${nextDefenderName} 需回應`],
      pendingAction: {
        type: 'respond_juedou',
        actorId: nextDefender,
        sourcePlayerId: pa.sourcePlayerId,
        juedouNextAttacker: pa.actorId,
        message: `【決鬥】：請出【殺】，否則受1點傷害`,
      },
    };
  }

  return state;
}

function skipResponse(state: GameState): GameState {
  const pa = state.pendingAction!;

  if (pa.type === 'respond_sha') {
    const s = applyDamage(state, pa.actorId, pa.damage ?? 1, pa.sourcePlayerId, pa.isFire);
    let s2: GameState = { ...s, pendingAction: null };
    if (s2.gameOver) return s2;

    const attacker = state.players.find(p => p.id === pa.sourcePlayerId);
    const victim = s2.players.find(p => p.id === pa.actorId);

    // 司馬懿 鬼才：受傷後從攻擊者手中獲得1張牌
    if (victim?.isAlive && victim.character.id === 'simayi' && attacker) {
      const atk = s2.players.find(p => p.id === attacker.id);
      if (atk?.isAlive && atk.hand.length > 0) {
        const idx = Math.floor(Math.random() * atk.hand.length);
        const stolen = atk.hand[idx];
        const players = clonePlayers(s2.players);
        players.find(p => p.id === atk.id)!.hand.splice(idx, 1);
        players.find(p => p.id === victim.id)!.hand.push(stolen);
        s2 = { ...s2, players, log: [...s2.log, `司馬懿 鬼才：從 ${atk.name} 獲得【${stolen.name}】`] };
      }
    }
    // 馬超 鐵騎：殺命中後，目標棄置一張手牌
    if (attacker?.character.id === 'maochao') {
      const target = s2.players.find(p => p.id === pa.actorId);
      if (target?.isAlive && target.hand.length > 0) {
        const toDiscard = target.hand[Math.floor(Math.random() * target.hand.length)];
        s2 = discardCardFromHand(s2, pa.actorId, toDiscard.id);
        s2 = { ...s2, log: [...s2.log, `馬超 鐵騎：${target.name} 棄置【${toDiscard.name}】`] };
      }
    }
    // 魏延 狂骨：殺命中後摸1張牌
    const attackerNow = s2.players.find(p => p.id === pa.sourcePlayerId);
    if (attackerNow?.isAlive && attackerNow.character.id === 'weiyan') {
      s2 = drawN(s2, pa.sourcePlayerId, 1);
      s2 = { ...s2, log: [...s2.log, `魏延 狂骨：摸1張牌`] };
    }
    // 徐晃 斷糧：殺命中後目標下回合跳過摸牌
    if (attackerNow?.isAlive && attackerNow.character.id === 'xuhuang') {
      const victimNow = s2.players.find(p => p.id === pa.actorId);
      if (victimNow?.isAlive) {
        const players3 = clonePlayers(s2.players);
        players3.find(p => p.id === pa.actorId)!.skipNextDraw = true;
        s2 = { ...s2, players: players3, log: [...s2.log, `徐晃 斷糧：${victimNow.name} 下回合跳過摸牌`] };
      }
    }
    // 孫策 激將：殺命中後奪取目標1張裝備
    if (attackerNow?.isAlive && attackerNow.character.id === 'sunce') {
      const victimNow = s2.players.find(p => p.id === pa.actorId);
      if (victimNow?.isAlive) {
        const eqSlots: (keyof Equipment)[] = ['weapon', 'armor', 'horse_minus', 'horse_plus'];
        const slots = eqSlots.filter(k => victimNow.equipment[k]);
        if (slots.length > 0) {
          const slot = slots[Math.floor(Math.random() * slots.length)];
          const stolen = victimNow.equipment[slot]!;
          const players3 = clonePlayers(s2.players);
          players3.find(p => p.id === pa.actorId)!.equipment[slot] = null;
          players3.find(p => p.id === pa.sourcePlayerId)!.hand.push(stolen);
          s2 = { ...s2, players: players3, log: [...s2.log, `孫策 激將：奪取 ${victimNow.name} 的【${stolen.name}】`] };
        }
      }
    }
    // 丁奉 雪襲：被殺命中後對攻擊者反彈1傷
    if (s2.gameOver) return s2;
    const victimFinal = s2.players.find(p => p.id === pa.actorId);
    if (victimFinal?.isAlive && victimFinal.character.id === 'dingfeng') {
      s2 = applyDamage(s2, pa.sourcePlayerId, 1, pa.actorId);
      s2 = { ...s2, log: [...s2.log, `丁奉 雪襲：對 ${attackerNow?.name ?? ''} 反彈1點傷害`] };
    }
    return s2;
  }

  if (pa.type === 'respond_wanjian') {
    const s = applyDamage(state, pa.actorId, 1, pa.sourcePlayerId);
    const s2 = { ...s, pendingAction: null };
    if (s2.gameOver) return s2;
    return nextAoeTarget(s2, 'respond_wanjian', pa.sourcePlayerId, pa.remainingTargets ?? []);
  }

  if (pa.type === 'respond_nanman') {
    const s = applyDamage(state, pa.actorId, 1, pa.sourcePlayerId);
    const s2 = { ...s, pendingAction: null };
    if (s2.gameOver) return s2;
    return nextAoeTarget(s2, 'respond_nanman', pa.sourcePlayerId, pa.remainingTargets ?? []);
  }

  if (pa.type === 'respond_juedou') {
    const winner = pa.juedouNextAttacker ?? pa.sourcePlayerId;
    const s = applyDamage(state, pa.actorId, 1, winner);
    return { ...s, pendingAction: null };
  }

  return { ...state, pendingAction: null };
}

function resolveAfterDefend(state: GameState, pa: PendingAction): GameState {
  if (pa.type === 'respond_sha') {
    let s: GameState = { ...state, pendingAction: null };
    // 張郃 巧變：成功閃避殺後摸1張牌
    const defender = s.players.find(p => p.id === pa.actorId);
    if (defender?.isAlive && defender.character.id === 'zhanghe') {
      s = drawN(s, defender.id, 1);
      s = { ...s, log: [...s.log, `張郃 巧變：閃避成功，摸1張牌`] };
    }
    return s;
  }
  if (pa.type === 'respond_wanjian') {
    return nextAoeTarget({ ...state, pendingAction: null }, 'respond_wanjian', pa.sourcePlayerId, pa.remainingTargets ?? []);
  }
  if (pa.type === 'respond_nanman') {
    return nextAoeTarget({ ...state, pendingAction: null }, 'respond_nanman', pa.sourcePlayerId, pa.remainingTargets ?? []);
  }
  return { ...state, pendingAction: null };
}

// ─── Skills ───────────────────────────────────────────────────────────────────

function skillGiveCard(state: GameState, playerId: number, targetId: number, cardIds: string[], charId: string): GameState {
  if (cardIds.length < 2) return state;
  let s = state;
  const toGive = cardIds.slice(0, 2);
  for (const cid of toGive) {
    const curP = s.players.find(p => p.id === playerId)!;
    const card = curP.hand.find(c => c.id === cid);
    if (!card) continue;
    const players = clonePlayers(s.players);
    const from = players.find(p => p.id === playerId)!;
    const to = players.find(p => p.id === targetId)!;
    const [newHand, moved] = removeFromHand(from.hand, cid);
    if (moved) { from.hand = newHand; to.hand.push(moved); }
    s = { ...s, players };
  }

  const players = clonePlayers(s.players);
  const giver = players.find(p => p.id === playerId)!;
  giver.givenCards += 2;
  const skillName = charId === 'liubei' ? '仁德' : '結姻';

  // Heal giver for every 2 cards given
  giver.hp = Math.min(giver.hp + 1, giver.maxHp);
  giver.skillUsed = true;

  // If 結姻, also heal target
  if (charId === 'sunshangxiang') {
    const receiver = players.find(p => p.id === targetId)!;
    receiver.hp = Math.min(receiver.hp + 1, receiver.maxHp);
    const targetName = receiver.name;
    return {
      ...s,
      players,
      log: [...s.log, `孫尚香 結姻：給予 ${targetName} 2張牌，雙方各回復1血`],
    };
  }

  const targetName = s.players.find(p => p.id === targetId)?.name ?? '';
  return {
    ...s,
    players,
    log: [...s.log, `劉備 ${skillName}：給予 ${targetName} 2張牌，回復1血`],
  };
}

function skillZhiheng(state: GameState, playerId: number, cardIds: string[]): GameState {
  if (cardIds.length === 0) return state;
  let s = state;
  for (const cid of cardIds) {
    s = discardCardFromHand(s, playerId, cid);
  }
  s = drawN(s, playerId, cardIds.length);
  const players = clonePlayers(s.players);
  players.find(p => p.id === playerId)!.skillUsed = true;
  return {
    ...s,
    players,
    log: [...s.log, `孫權 制衡：棄${cardIds.length}張，摸${cardIds.length}張`],
  };
}

function skillKulou(state: GameState, playerId: number): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  if (player.hp <= 1) return state; // 防止自殺
  let s = applyDamage(state, playerId, 1, playerId);
  if (s.gameOver) return s;
  const p2 = s.players.find(p => p.id === playerId);
  if (!p2?.isAlive) return s;
  s = drawN(s, playerId, 3);
  const players = clonePlayers(s.players);
  players.find(p => p.id === playerId)!.skillUsed = true;
  return { ...s, players, log: [...s.log, `黃蓋 苦肉：失去1血，摸3張牌`] };
}

function skillQixi(state: GameState, playerId: number, targetId: number, discardCardId: string): GameState {
  const players = clonePlayers(state.players);
  const giver = players.find(p => p.id === playerId)!;
  const target = players.find(p => p.id === targetId);
  if (!target?.isAlive || target.hand.length === 0) return state;

  const [newHand, discarded] = removeFromHand(giver.hand, discardCardId);
  if (!discarded) return state;
  giver.hand = newHand;

  const idx = Math.floor(Math.random() * target.hand.length);
  const stolen = target.hand.splice(idx, 1)[0];
  giver.hand.push(stolen);
  giver.skillUsed = true;

  return {
    ...state,
    players,
    discardPile: [...state.discardPile, discarded],
    log: [...state.log, `甘寧 奇襲：棄【${discarded.name}】，從 ${target.name} 手中奪取【${stolen.name}】`],
  };
}

function skillLuofeng(state: GameState, playerId: number, cardIds: string[]): GameState {
  if (cardIds.length < 3) return state;
  let s = state;
  for (const cid of cardIds.slice(0, 3)) {
    s = discardCardFromHand(s, playerId, cid);
  }
  s = drawN(s, playerId, 4);
  const players = clonePlayers(s.players);
  players.find(p => p.id === playerId)!.skillUsed = true;
  return { ...s, players, log: [...s.log, `龐統 落鳳：棄3張牌，摸4張牌`] };
}

function skillHaoshi(state: GameState, playerId: number, targetId: number, cardId: string): GameState {
  const players = clonePlayers(state.players);
  const giver = players.find(p => p.id === playerId)!;
  const target = players.find(p => p.id === targetId);
  if (!target?.isAlive) return state;

  const [newHand, card] = removeFromHand(giver.hand, cardId);
  if (!card) return state;
  giver.hand = newHand;
  target.hand.push(card);
  giver.skillUsed = true;

  let s = { ...state, players, log: [...state.log, `魯肅 好施：給予 ${target.name}【${card.name}】`] };
  s = drawN(s, playerId, 1);
  return s;
}

// ─── AI ───────────────────────────────────────────────────────────────────────

function aiDiscard(state: GameState, player: Player): GameState {
  // Discard least useful cards until hand count <= HP
  const limit = handLimit(player);
  if (player.hand.length <= limit) return advanceToNextTurn({ ...state, discardCount: 0 });

  // Priority to discard: 閃 (less useful when not being attacked), then duplicates
  const sorted = [...player.hand].sort((a, b) => {
    const score = (c: typeof a) => {
      if (c.type === 'tao') return 10;
      if (c.type === 'sha' || c.type === 'sha_fire') return 8;
      if (['weapon','armor','horse_minus','horse_plus'].includes(c.category)) return 6;
      if (c.type === 'wuzhong' || c.type === 'nanman' || c.type === 'wanjian') return 5;
      if (c.type === 'shan') return 2;
      return 3;
    };
    return score(a) - score(b); // discard lowest score first
  });

  let s = state;
  while (s.players.find(p => p.id === player.id)!.hand.length > limit) {
    const curHand = s.players.find(p => p.id === player.id)!.hand;
    const toDiscard = sorted.find(c => curHand.some(h => h.id === c.id));
    if (!toDiscard) break;
    s = discardCardFromHand(s, player.id, toDiscard.id);
    // 姜維 志繼: draw 1 for each discarded card
    if (player.character.id === 'jiangwei') {
      s = drawN(s, player.id, 1);
    }
    sorted.splice(sorted.findIndex(c => c.id === toDiscard.id), 1);
  }
  if (player.character.id === 'jiangwei') {
    const discardCount = player.hand.length - limit;
    if (discardCount > 0) s = { ...s, log: [...s.log, `姜維 志繼：摸${discardCount}張牌`] };
  }

  return advanceToNextTurn({ ...s, discardCount: 0 });
}

function handleAIAction(state: GameState): GameState {
  if (state.gameOver) return state;

  if (state.pendingAction) {
    const pa = state.pendingAction;
    const actor = state.players.find(p => p.id === pa.actorId);
    if (!actor || actor.isHuman) return state;
    return aiRespond(state, actor);
  }

  const current = state.players[state.currentPlayerIndex];
  if (current.isHuman) return state;

  if (state.phase === 'discard') return aiDiscard(state, current);
  if (state.phase !== 'play') return state;

  return aiPlayTurn(state, current);
}

function aiRespond(state: GameState, actor: Player): GameState {
  const pa = state.pendingAction!;

  if (pa.type === 'respond_sha' || pa.type === 'respond_wanjian') {
    // 廖化 追襲：無法閃避
    if (pa.type === 'respond_sha' && (pa.shanNeeded ?? 0) >= 99) return skipResponse(state);
    // Try 閃
    const shan = actor.hand.find(c => cardCanBeShan(c, actor));
    if (shan) return respondWithCard(state, actor.id, shan.id);

    // 大喬 流離: use worst card to dodge
    if (actor.character.id === 'daqiao' && actor.hand.length > 0) {
      const cardScore = (c: Card) => {
        if (c.type === 'tao') return 10;
        if (c.type === 'sha' || c.type === 'sha_fire') return 8;
        if (['weapon', 'armor', 'horse_minus', 'horse_plus'].includes(c.category)) return 6;
        if (c.type === 'wuzhong' || c.type === 'nanman' || c.type === 'wanjian') return 5;
        if (c.type === 'shan') return 2;
        return 3;
      };
      const worst = [...actor.hand].sort((a, b) => cardScore(a) - cardScore(b))[0];
      return respondWithCard(state, actor.id, worst.id);
    }

    // Try 八卦陣
    if (actor.equipment.armor?.type === 'bagua_zhen') {
      let deck = [...state.deck];
      let discard = [...state.discardPile];
      if (deck.length === 0) { deck = shuffle(discard); discard = []; }
      if (deck.length > 0) {
        const flipped = deck.pop()!;
        discard = [...discard, flipped];
        const s: GameState = { ...state, deck, discardPile: discard };
        if (cardColor(flipped) === 'red') {
          return resolveAfterDefend(
            { ...s, log: [...s.log, `${actor.name} 八卦陣判定【${flipped.name}】紅色，閃避！`] },
            pa
          );
        }
        return skipResponse({ ...s, log: [...s.log, `${actor.name} 八卦陣判定黑色，失敗`] });
      }
    }
    return skipResponse(state);
  }

  if (pa.type === 'respond_nanman') {
    const sha = actor.hand.find(c => cardCanBeSha(c, actor));
    if (sha) return respondWithCard(state, actor.id, sha.id);
    return skipResponse(state);
  }

  if (pa.type === 'respond_juedou') {
    const sha = actor.hand.find(c => cardCanBeSha(c, actor));
    if (sha) return respondWithCard(state, actor.id, sha.id);
    return skipResponse(state);
  }

  return skipResponse(state);
}

function aiPlayTurn(state: GameState, player: Player): GameState {
  let s = state;

  // Use 桃 if low HP
  if (player.hp <= 2) {
    const tao = s.players.find(p => p.id === player.id)!.hand.find(c => c.type === 'tao');
    const curP = s.players.find(p => p.id === player.id)!;
    if (tao && curP.hp < curP.maxHp) {
      s = playCardNoTarget(s, player.id, tao);
    }
  }

  // Equip cards
  const toEquip = s.players.find(p => p.id === player.id)!.hand.filter(c =>
    ['weapon', 'armor', 'horse_minus', 'horse_plus'].includes(c.category) &&
    !s.players.find(p => p.id === player.id)!.equipment[c.category as keyof Equipment]
  );
  for (const eq of toEquip) {
    const curEq = s.players.find(p => p.id === player.id)!.equipment[eq.category as keyof Equipment];
    if (!curEq) s = equipCard(s, player.id, eq);
  }

  // Use 無中生有 / 五穀豐登 / 桃園結義
  for (const type of ['wuzhong', 'wugu', 'taoyuan'] as const) {
    const card = s.players.find(p => p.id === player.id)!.hand.find(c => c.type === type);
    if (card) {
      if (type === 'taoyuan' && !s.players.some(p => p.isAlive && p.hp < p.maxHp)) continue;
      s = playCardNoTarget(s, player.id, card);
    }
  }

  // AI skills
  // 黃蓋 苦肉: use when HP > 2 and hand is thin
  const curPHg = s.players.find(p => p.id === player.id)!;
  if (curPHg.character.id === 'huanggai' && !curPHg.skillUsed && curPHg.hp > 2 && curPHg.hand.length < 3) {
    s = skillKulou(s, curPHg.id);
  }

  // 華佗 青嚢: use ♣ trick as tao when HP < max
  const curPHt = s.players.find(p => p.id === player.id)!;
  if (curPHt.character.id === 'huatuo' && curPHt.hp < curPHt.maxHp) {
    const clubTrick = curPHt.hand.find(c => c.suit === '♣' && c.category === 'trick');
    if (clubTrick) s = playCardNoTarget(s, curPHt.id, clubTrick);
  }

  const curP2 = s.players.find(p => p.id === player.id)!;
  if (curP2.character.id === 'sunquan' && !curP2.skillUsed && curP2.hand.length > 0) {
    const badCards = curP2.hand.filter(c =>
      c.type !== 'sha' && c.type !== 'sha_fire' && c.type !== 'tao' &&
      !['weapon','armor','horse_minus','horse_plus'].includes(c.category)
    ).slice(0, 2);
    if (badCards.length >= 2) s = skillZhiheng(s, player.id, badCards.map(c => c.id));
  }

  // 劉備 仁德
  const curP2b = s.players.find(p => p.id === player.id)!;
  if (curP2b.character.id === 'liubei' && !curP2b.skillUsed && curP2b.hand.length >= 2 && curP2b.hp < curP2b.maxHp) {
    const badCards = curP2b.hand.filter(c =>
      c.type !== 'sha' && c.type !== 'sha_fire' && c.type !== 'tao' &&
      !['weapon','armor','horse_minus','horse_plus'].includes(c.category)
    ).slice(0, 2);
    const ally = s.players.find(p => p.isAlive && p.id !== curP2b.id);
    if (badCards.length >= 2 && ally) {
      s = skillGiveCard(s, curP2b.id, ally.id, badCards.map(c => c.id), 'liubei');
    }
  }

  // 龐統 落鳳: discard 3 bad cards, draw 4
  const curPPt = s.players.find(p => p.id === player.id)!;
  if (curPPt.character.id === 'pangtong' && !curPPt.skillUsed && curPPt.hand.length >= 3) {
    const badCards = curPPt.hand.filter(c =>
      c.type !== 'sha' && c.type !== 'sha_fire' && c.type !== 'tao' &&
      !['weapon', 'armor', 'horse_minus', 'horse_plus'].includes(c.category)
    ).slice(0, 3);
    if (badCards.length >= 3) {
      s = skillLuofeng(s, curPPt.id, badCards.map(c => c.id));
    }
  }

  // 魯肅 好施: give worst card to any ally, draw 1
  const curPLs = s.players.find(p => p.id === player.id)!;
  if (curPLs.character.id === 'lusu' && !curPLs.skillUsed && curPLs.hand.length >= 1) {
    const badCards = curPLs.hand.filter(c =>
      c.type !== 'sha' && c.type !== 'sha_fire' && c.type !== 'tao' &&
      !['weapon', 'armor', 'horse_minus', 'horse_plus'].includes(c.category)
    );
    if (badCards.length > 0) {
      const ally = s.players.find(p => p.isAlive && p.id !== curPLs.id);
      if (ally) s = skillHaoshi(s, curPLs.id, ally.id, badCards[0].id);
    }
  }

  // 甘寧 奇襲
  const curPGn = s.players.find(p => p.id === player.id)!;
  if (curPGn.character.id === 'ganning' && !curPGn.skillUsed && curPGn.hand.length >= 1) {
    const enemies = getEnemies(curPGn, s.players).filter(e => e.hand.length > 0);
    if (enemies.length > 0) {
      const badCards = curPGn.hand.filter(c =>
        c.type !== 'sha' && c.type !== 'sha_fire' && c.type !== 'tao' &&
        !['weapon', 'armor', 'horse_minus', 'horse_plus'].includes(c.category)
      );
      const toDiscard = badCards[0] ?? curPGn.hand[curPGn.hand.length - 1];
      s = skillQixi(s, curPGn.id, enemies[0].id, toDiscard.id);
    }
  }

  // 孫尚香 結姻
  const curP2c = s.players.find(p => p.id === player.id)!;
  if (curP2c.character.id === 'sunshangxiang' && !curP2c.skillUsed && curP2c.hand.length >= 2 && curP2c.hp < curP2c.maxHp) {
    const badCards = curP2c.hand.filter(c =>
      c.type !== 'sha' && c.type !== 'sha_fire' && c.type !== 'tao' &&
      !['weapon','armor','horse_minus','horse_plus'].includes(c.category)
    ).slice(0, 2);
    const maleTarget = s.players.find(p => p.isAlive && p.id !== curP2c.id && p.character.gender === 'male');
    if (badCards.length >= 2 && maleTarget) {
      s = skillGiveCard(s, curP2c.id, maleTarget.id, badCards.map(c => c.id), 'sunshangxiang');
    }
  }

  // AOE tricks
  const nanCard = s.players.find(p => p.id === player.id)!.hand.find(c => c.type === 'nanman');
  if (nanCard) {
    s = playCardNoTarget(s, player.id, nanCard);
    if (s.pendingAction) return s;
  }
  const wanCard = s.players.find(p => p.id === player.id)!.hand.find(c => c.type === 'wanjian');
  if (wanCard) {
    s = playCardNoTarget(s, player.id, wanCard);
    if (s.pendingAction) return s;
  }

  // 決鬥 on an enemy (only if we have 殺 in hand to fight back)
  const curP2d = s.players.find(p => p.id === player.id)!;
  const jdCard = curP2d.hand.find(c => c.type === 'juedou');
  const hasSha = curP2d.hand.some(c => cardCanBeSha(c, curP2d));
  if (jdCard && hasSha) {
    const enemies = getEnemies(player, s.players);
    if (enemies.length > 0) {
      const tgt = enemies.sort((a, b) => a.hp - b.hp)[0];
      s = playCardOnTarget(s, player.id, jdCard, tgt.id);
      if (s.pendingAction) return s;
    }
  }

  // 過河拆橋 on strongest enemy
  const guoheCard = s.players.find(p => p.id === player.id)!.hand.find(c => c.type === 'guohe');
  if (guoheCard) {
    const enemies = getEnemies(s.players.find(p => p.id === player.id)!, s.players)
      .filter(e => e.hand.length > 0 || Object.values(e.equipment).some(Boolean));
    if (enemies.length > 0) {
      const tgt = enemies.sort((a, b) => b.hp - a.hp)[0];
      s = playCardOnTarget(s, player.id, guoheCard, tgt.id);
    }
  }

  // 順手牽羊 on adjacent enemy
  const curP2e = s.players.find(p => p.id === player.id)!;
  const shuntianCard = curP2e.hand.find(c => c.type === 'shuntian');
  if (shuntianCard) {
    const adjacentEnemies = getEnemies(curP2e, s.players)
      .filter(e => seatDistance(curP2e.id, e.id, s.players) === 1)
      .filter(e => e.hand.length > 0 || Object.values(e.equipment).some(Boolean));
    if (adjacentEnemies.length > 0) {
      s = playCardOnTarget(s, player.id, shuntianCard, adjacentEnemies[0].id);
    }
  }

  // Attack with 殺
  const curP3 = s.players.find(p => p.id === player.id)!;
  if (canUseSha(curP3)) {
    const shaCard = curP3.hand.find(c => cardCanBeSha(c, curP3));
    if (shaCard) {
      const targets = getShaTargets(curP3, s);
      if (targets.length > 0) {
        const enemies = getEnemies(curP3, s.players).map(e => e.id).filter(id => targets.includes(id));
        const pool = enemies.length > 0 ? enemies : targets;
        const targetId = pool.sort((a, b) => {
          const pa = s.players.find(p => p.id === a)!;
          const pb = s.players.find(p => p.id === b)!;
          return pa.hp - pb.hp;
        })[0];
        s = playCardOnTarget(s, player.id, shaCard, targetId);
        if (s.pendingAction) return s;
      }
    }
  }

  return endPlayPhase(s);
}

function getEnemies(player: Player, players: Player[]): Player[] {
  return players.filter(p => {
    if (!p.isAlive || p.id === player.id) return false;
    const alive = players.filter(pp => pp.isAlive).length;
    if (player.role === 'lord' || player.role === 'loyalist') {
      return p.role === 'rebel' || p.role === 'spy';
    }
    if (player.role === 'rebel') {
      return p.role === 'lord' || p.role === 'loyalist';
    }
    if (player.role === 'spy') {
      // Spy attacks rebels if many players, attacks everyone if few
      return alive > 2 ? p.role === 'rebel' : p.id !== player.id;
    }
    return false;
  });
}

function roleLabel(role: Role): string {
  const map: Record<Role, string> = {
    lord: '主公', loyalist: '忠臣', rebel: '反賊', spy: '內奸',
  };
  return map[role];
}
