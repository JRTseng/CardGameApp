import { useEffect, useRef, useState } from 'react';
import type { Player } from '../types/game';

interface Props {
  player: Player;
  isCurrentTurn: boolean;
  isTargetable: boolean;
  isPending: boolean;
  onTarget: () => void;
}

const KINGDOM_COLORS: Record<string, string> = {
  wei:     'border-blue-500 bg-blue-950',
  shu:     'border-green-500 bg-green-950',
  wu:      'border-red-500 bg-red-950',
  neutral: 'border-gray-500 bg-gray-950',
};

const ROLE_LABELS: Record<string, string> = {
  lord:     '主公',
  loyalist: '忠臣',
  rebel:    '反賊',
  spy:      '內奸',
};

const ROLE_COLORS: Record<string, string> = {
  lord:     'bg-yellow-700 text-yellow-100',
  loyalist: 'bg-green-700 text-green-100',
  rebel:    'bg-red-700 text-red-100',
  spy:      'bg-purple-700 text-purple-100',
};

const KINGDOM_LABEL: Record<string, string> = {
  wei: '魏', shu: '蜀', wu: '吳', neutral: '中',
};

export default function PlayerBoard({ player, isCurrentTurn, isTargetable, isPending, onTarget }: Props) {
  const char = player.character;
  const borderColor = KINGDOM_COLORS[char.kingdom] ?? 'border-gray-500 bg-gray-950';
  const isDead = !player.isAlive;

  const [flash, setFlash] = useState<'damage' | 'heal' | null>(null);
  const prevHpRef = useRef(player.hp);

  useEffect(() => {
    if (!player.isAlive) { prevHpRef.current = player.hp; return; }
    if (player.hp < prevHpRef.current) {
      setFlash('damage');
      const t = setTimeout(() => setFlash(null), 700);
      prevHpRef.current = player.hp;
      return () => clearTimeout(t);
    } else if (player.hp > prevHpRef.current) {
      setFlash('heal');
      const t = setTimeout(() => setFlash(null), 700);
      prevHpRef.current = player.hp;
      return () => clearTimeout(t);
    }
    prevHpRef.current = player.hp;
  }, [player.hp, player.isAlive]);

  return (
    <div
      className={[
        'relative rounded-xl border-2 p-2 min-w-[140px] max-w-[180px] flex flex-col gap-1 transition-all duration-200',
        borderColor,
        isCurrentTurn ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/30' : '',
        isTargetable ? 'ring-2 ring-red-400 cursor-pointer hover:shadow-lg hover:shadow-red-400/40 hover:scale-105' : '',
        isPending ? 'ring-2 ring-orange-400 shadow-lg shadow-orange-400/50 animate-pulse' : '',
        isDead ? 'opacity-40 grayscale' : '',
        flash === 'damage' ? 'animate-damage' : '',
        flash === 'heal' ? 'animate-heal' : '',
      ].join(' ')}
      onClick={isTargetable ? onTarget : undefined}
    >
      {/* Kingdom badge */}
      <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-amber-700 text-amber-100 border border-amber-500 shadow">
        {KINGDOM_LABEL[char.kingdom]}
      </div>

      {isCurrentTurn && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs bg-yellow-500 text-black px-1 rounded font-bold whitespace-nowrap">
          ▶ 行動中
        </div>
      )}

      {isTargetable && (
        <div className="absolute -top-2 right-2 text-xs bg-red-500 text-white px-1 rounded font-bold animate-bounce">
          ⚔ 選
        </div>
      )}

      {isPending && (
        <div className="absolute -top-2 right-2 text-xs bg-orange-500 text-white px-1 rounded font-bold">
          ⏳
        </div>
      )}

      {/* Portrait + Name */}
      <div className="flex items-center gap-1">
        <span className="text-2xl">{char.portrait}</span>
        <div className="flex flex-col">
          <span className="text-white font-bold text-sm leading-tight">{char.name}</span>
          <span className="text-gray-400 text-xs leading-tight">{player.name}</span>
        </div>
      </div>

      {/* Role */}
      {(player.roleRevealed || player.isHuman) ? (
        <span className={`text-xs px-1 rounded w-fit ${ROLE_COLORS[player.role]}`}>
          {ROLE_LABELS[player.role]}{player.isHuman && !player.roleRevealed ? ' 🤫' : ''}
        </span>
      ) : (
        <span className="text-xs px-1 rounded w-fit bg-gray-700 text-gray-300">???</span>
      )}

      {/* HP */}
      <div className="flex flex-wrap gap-0.5">
        {Array.from({ length: player.maxHp }).map((_, i) => (
          <span key={i} className="text-sm leading-none">
            {i < player.hp ? '❤️' : '🖤'}
          </span>
        ))}
      </div>
      <div className="text-xs text-gray-400">{player.hp}/{player.maxHp}</div>

      {/* Hand count */}
      <div className="text-xs text-gray-300">🃏 {player.hand.length}張</div>

      {/* Equipment */}
      <div className="flex flex-wrap gap-0.5">
        {player.equipment.weapon && (
          <span className="text-xs bg-cyan-900 text-cyan-200 px-1 rounded border border-cyan-700">⚔{player.equipment.weapon.name}</span>
        )}
        {player.equipment.armor && (
          <span className="text-xs bg-teal-900 text-teal-200 px-1 rounded border border-teal-700">🛡{player.equipment.armor.name}</span>
        )}
        {player.equipment.horse_minus && (
          <span className="text-xs bg-stone-800 text-stone-200 px-1 rounded border border-stone-600">🐎-1</span>
        )}
        {player.equipment.horse_plus && (
          <span className="text-xs bg-lime-900 text-lime-200 px-1 rounded border border-lime-700">🐎+1</span>
        )}
      </div>

      {/* Skill */}
      <div className="mt-auto pt-1 border-t border-white/10">
        <div className="text-xs font-bold text-amber-300">{char.skill.name}</div>
      </div>

      {isDead && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
          <span className="text-4xl">💀</span>
        </div>
      )}
    </div>
  );
}
