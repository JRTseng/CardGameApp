import type { Card } from '../types/game';
import { numStr } from '../data/cards';

interface Props {
  card: Card;
  selected?: boolean;
  dimmed?: boolean;
  small?: boolean;
  onClick?: () => void;
  faceDown?: boolean;
}

const TYPE_BG: Record<string, string> = {
  sha:          'from-red-800 to-red-600',
  sha_fire:     'from-orange-700 to-red-500',
  shan:         'from-blue-700 to-blue-500',
  tao:          'from-pink-600 to-rose-400',
  wanjian:      'from-yellow-700 to-amber-500',
  nanman:       'from-red-900 to-red-700',
  wuzhong:      'from-emerald-700 to-green-500',
  guohe:        'from-slate-700 to-slate-500',
  shuntian:     'from-purple-700 to-purple-500',
  juedou:       'from-orange-800 to-amber-600',
  taoyuan:      'from-pink-800 to-rose-600',
  wugu:         'from-yellow-800 to-green-600',
  zhuge_nu:     'from-cyan-800 to-cyan-600',
  bagua_zhen:   'from-teal-800 to-teal-600',
  renwang_dun:  'from-gray-700 to-gray-500',
  jueying:      'from-stone-700 to-stone-500',
  dilu:         'from-lime-800 to-lime-600',
  qinglong_dao: 'from-sky-800 to-blue-600',
  zhuque_yu:    'from-red-700 to-orange-500',
};

export default function CardView({ card, selected, dimmed, small, onClick, faceDown }: Props) {
  const bg = TYPE_BG[card.type] ?? 'from-gray-700 to-gray-500';
  const isRed = card.suit === '♥' || card.suit === '♦';
  const suitColor = isRed ? 'text-red-600' : 'text-gray-900';
  const w = small ? 'w-12 h-16' : 'w-16 h-24';

  if (faceDown) {
    return (
      <div className={`${w} rounded-lg border-2 border-amber-900 bg-gradient-to-br from-amber-900 to-amber-700 flex items-center justify-center select-none`}>
        <span className="text-amber-300 text-lg">🀫</span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={[
        w, 'rounded-lg border-2 flex flex-col items-center justify-between p-1',
        'bg-gradient-to-br', bg,
        'transition-all duration-150 select-none',
        onClick ? 'cursor-pointer hover:brightness-125 hover:-translate-y-2 hover:scale-105 hover:shadow-lg hover:shadow-black/60' : 'cursor-default',
        selected ? 'ring-2 ring-yellow-300 -translate-y-4 scale-110 border-yellow-300 shadow-xl shadow-yellow-500/60' : 'border-amber-700',
        dimmed ? 'opacity-40' : 'opacity-100',
      ].join(' ')}
    >
      <div className="w-full flex items-center justify-between text-xs">
        <span className="font-bold text-white">{numStr(card.number)}</span>
        <span className={`${suitColor} font-bold bg-white rounded-sm px-px text-xs`}>{card.suit}</span>
      </div>

      <div className={`text-center text-white font-bold drop-shadow ${small ? 'text-xs' : 'text-sm'} leading-tight`}>
        {card.name.split('').map((ch, i) => (
          <div key={i}>{ch}</div>
        ))}
      </div>

      <div className="w-full flex justify-end text-xs">
        <span className="font-bold text-white opacity-60">{numStr(card.number)}</span>
      </div>
    </div>
  );
}
