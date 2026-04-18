import type { Card, Suit, CardType, CardCategory } from '../types/game';

let _counter = 0;
function uid() { return `c${++_counter}`; }

type CardInfo = { name: string; category: CardCategory };

const CARD_INFO: Record<CardType, CardInfo> = {
  sha:          { name: '殺',        category: 'basic' },
  sha_fire:     { name: '火殺',      category: 'basic' },
  shan:         { name: '閃',        category: 'basic' },
  tao:          { name: '桃',        category: 'basic' },
  wanjian:      { name: '萬箭齊發',  category: 'trick' },
  nanman:       { name: '南蠻入侵',  category: 'trick' },
  wuzhong:      { name: '無中生有',  category: 'trick' },
  guohe:        { name: '過河拆橋',  category: 'trick' },
  shuntian:     { name: '順手牽羊',  category: 'trick' },
  juedou:       { name: '決鬥',      category: 'trick' },
  taoyuan:      { name: '桃園結義',  category: 'trick' },
  wugu:         { name: '五穀豐登',  category: 'trick' },
  zhuge_nu:     { name: '諸葛連弩',  category: 'weapon' },
  bagua_zhen:   { name: '八卦陣',    category: 'armor' },
  renwang_dun:  { name: '仁王盾',    category: 'armor' },
  jueying:      { name: '絕影',      category: 'horse_minus' },
  dilu:         { name: '的盧',      category: 'horse_plus' },
  qinglong_dao: { name: '青龍偃月刀', category: 'weapon' },
  zhuque_yu:    { name: '朱雀羽扇',  category: 'weapon' },
};

function mk(type: CardType, suit: Suit, num: number): Card {
  const info = CARD_INFO[type];
  return { id: uid(), type, suit, number: num, category: info.category, name: info.name };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createDeck(): Card[] {
  _counter = 0;
  const cards: Card[] = [];

  // ===== 殺 (20 regular, 4 fire) =====
  (['♠', '♣'] as Suit[]).forEach(s =>
    [7, 8, 9, 10, 11, 12].forEach(n => cards.push(mk('sha', s, n)))
  );
  (['♥', '♦'] as Suit[]).forEach(s =>
    [1, 2, 3, 4].forEach(n => cards.push(mk('sha', s, n)))
  );
  (['♥', '♦'] as Suit[]).forEach(s =>
    [5, 6].forEach(n => cards.push(mk('sha_fire', s, n)))
  );

  // ===== 閃 (15) =====
  (['♥'] as Suit[]).forEach(s =>
    [6, 7, 8, 9, 10, 11].forEach(n => cards.push(mk('shan', s, n)))
  );
  (['♦'] as Suit[]).forEach(s =>
    [5, 6, 7, 8, 9, 10].forEach(n => cards.push(mk('shan', s, n)))
  );
  (['♣'] as Suit[]).forEach(s =>
    [2, 3, 4].forEach(n => cards.push(mk('shan', s, n)))
  );

  // ===== 桃 (8) =====
  (['♥'] as Suit[]).forEach(s =>
    [12, 13].forEach(n => cards.push(mk('tao', s, n)))
  );
  (['♦'] as Suit[]).forEach(s =>
    [11, 12, 13].forEach(n => cards.push(mk('tao', s, n)))
  );
  (['♠'] as Suit[]).forEach(s =>
    [2, 3, 4].forEach(n => cards.push(mk('tao', s, n)))
  );

  // ===== Tricks =====
  cards.push(mk('wanjian',  '♦', 1));
  cards.push(mk('wanjian',  '♥', 1));
  cards.push(mk('nanman',   '♠', 7));
  cards.push(mk('nanman',   '♠', 8));
  cards.push(mk('nanman',   '♠', 9));
  cards.push(mk('wuzhong',  '♥', 7));
  cards.push(mk('wuzhong',  '♥', 8));
  cards.push(mk('wuzhong',  '♥', 9));
  cards.push(mk('wuzhong',  '♥', 11));
  cards.push(mk('guohe',    '♠', 3));
  cards.push(mk('guohe',    '♠', 4));
  cards.push(mk('guohe',    '♣', 3));
  cards.push(mk('guohe',    '♣', 4));
  cards.push(mk('shuntian', '♦', 3));
  cards.push(mk('shuntian', '♦', 4));
  cards.push(mk('shuntian', '♣', 5));
  cards.push(mk('juedou',   '♠', 1));
  cards.push(mk('juedou',   '♣', 1));
  cards.push(mk('juedou',   '♦', 2));

  // ===== 桃園結義 (2) =====
  cards.push(mk('taoyuan', '♥', 3));
  cards.push(mk('taoyuan', '♥', 4));

  // ===== 五穀豐登 (2) =====
  cards.push(mk('wugu', '♦', 5));
  cards.push(mk('wugu', '♦', 6));

  // ===== Equipment =====
  cards.push(mk('zhuge_nu',     '♣', 1));
  cards.push(mk('bagua_zhen',   '♣', 2));
  cards.push(mk('renwang_dun',  '♠', 2));
  cards.push(mk('jueying',      '♣', 5));
  cards.push(mk('dilu',         '♦', 8));
  cards.push(mk('qinglong_dao', '♠', 5));
  cards.push(mk('zhuque_yu',    '♥', 10));

  return shuffle(cards);
}

export const CARD_DESCRIPTIONS: Record<string, string> = {
  sha:          '對攻擊範圍內的目標造成1點傷害',
  sha_fire:     '火焰傷害，目標需出【閃】，仁王盾無效',
  shan:         '用於回應【殺】，閃避攻擊傷害',
  tao:          '回復1點血量',
  wanjian:      '對所有其他角色生效，各需出【閃】否則受1傷',
  nanman:       '對所有其他角色生效，各需出【殺】否則受1傷',
  wuzhong:      '立即摸2張牌',
  guohe:        '棄置目標角色任意1張牌（隨機）',
  shuntian:     '獲取距離1以內目標的任意1張牌（隨機）',
  juedou:       '與目標輪流出殺，先不出者受1傷',
  taoyuan:      '所有角色各回復1血',
  wugu:         '所有角色各摸1張牌',
  zhuge_nu:     '裝備武器：每回合可無限次使用【殺】',
  bagua_zhen:   '裝備防具：受攻擊時判定，紅色可自動閃避',
  renwang_dun:  '裝備防具：黑色【殺】對你無效',
  jueying:      '裝備坐騎：攻擊距離-1',
  dilu:         '裝備坐騎：別人攻擊你的距離+1',
  qinglong_dao: '裝備武器：攻擊距離+2',
  zhuque_yu:    '裝備武器：你的【殺】視為【火殺】',
};

export function cardColor(card: Card): 'red' | 'black' {
  return card.suit === '♥' || card.suit === '♦' ? 'red' : 'black';
}

export const NUMBER_NAMES: Record<number, string> = {
  1: 'A', 11: 'J', 12: 'Q', 13: 'K',
};

export function numStr(n: number): string {
  return NUMBER_NAMES[n] ?? String(n);
}
