import { useState } from 'react';
import { ALL_CHARACTERS } from '../data/characters';
import type { Character } from '../types/game';

interface Props {
  onStart: (characterId: string) => void;
  onBack?: () => void;
}

const KINGDOM_LABEL: Record<string, string> = {
  wei: '魏國', shu: '蜀國', wu: '吳國', neutral: '中立',
};

const KINGDOM_COLOR: Record<string, string> = {
  wei: 'border-blue-500 bg-blue-950 hover:bg-blue-900',
  shu: 'border-green-500 bg-green-950 hover:bg-green-900',
  wu:  'border-red-500 bg-red-950 hover:bg-red-900',
  neutral: 'border-gray-500 bg-gray-950 hover:bg-gray-900',
};

const SKILL_TYPE_BADGE: Record<string, string> = {
  passive: 'bg-blue-800 text-blue-200',
  active:  'bg-green-800 text-green-200',
  trigger: 'bg-orange-800 text-orange-200',
};
const SKILL_TYPE_LABEL: Record<string, string> = {
  passive: '被動', active: '主動', trigger: '觸發',
};

export default function GameSetup({ onStart, onBack }: Props) {
  const [selected, setSelected] = useState<Character | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-amber-950/10 to-stone-950 flex flex-col items-center justify-center p-6 overflow-auto">
      {onBack && (
        <button onClick={onBack} className="absolute top-4 left-4 text-gray-500 hover:text-gray-300 text-sm">← 返回</button>
      )}
      {/* Title */}
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-amber-400 tracking-wider mb-2" style={{ fontFamily: 'serif' }}>
          三國決殺
        </h1>
        <p className="text-amber-600 text-lg">— 亂世英雄，沙場征戰 —</p>
        <p className="text-gray-500 text-sm mt-2">4人遊戲 · 玩家擔任主公 + 3 AI對手</p>
      </div>

      {/* Roles info */}
      <div className="flex gap-6 mb-8 flex-wrap justify-center">
        {[
          { role: '主公', color: 'text-yellow-400', desc: '你（+1血）' },
          { role: '忠臣', color: 'text-green-400', desc: 'AI輔助主公' },
          { role: '反賊', color: 'text-red-400', desc: 'AI推翻主公' },
          { role: '內奸', color: 'text-purple-400', desc: 'AI孤身取勝' },
        ].map(r => (
          <div key={r.role} className="text-center">
            <div className={`font-bold text-lg ${r.color}`}>{r.role}</div>
            <div className="text-gray-500 text-xs">{r.desc}</div>
          </div>
        ))}
      </div>

      {/* Character selection */}
      <h2 className="text-white text-xl font-bold text-center mb-4">選擇你的武將</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mb-6">
        {ALL_CHARACTERS.map(char => {
          const isSelected = selected?.id === char.id;
          return (
            <div
              key={char.id}
              onClick={() => setSelected(char)}
              className={[
                'relative border-2 rounded-xl p-3 cursor-pointer transition-all duration-150',
                KINGDOM_COLOR[char.kingdom],
                isSelected ? 'ring-2 ring-yellow-400 scale-105 shadow-lg shadow-yellow-400/30' : '',
              ].join(' ')}
            >
              {isSelected && (
                <div className="absolute -top-2 -right-2 bg-yellow-500 rounded-full w-5 h-5 flex items-center justify-center text-black text-xs font-bold">✓</div>
              )}

              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl">{char.portrait}</span>
                <div>
                  <div className="text-white font-bold text-lg">{char.name}</div>
                  <div className="text-gray-400 text-xs">{KINGDOM_LABEL[char.kingdom]}</div>
                </div>
              </div>

              {/* HP as lord */}
              <div className="flex gap-0.5 flex-wrap mb-2 items-center">
                {Array.from({ length: char.baseHp + 1 }).map((_, i) => (
                  <span key={i} className="text-xs">❤️</span>
                ))}
                <span className="text-gray-500 text-xs ml-1">{char.baseHp + 1}血</span>
              </div>

              {/* Skill */}
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <span className={`text-xs px-1 rounded ${SKILL_TYPE_BADGE[char.skill.type]}`}>
                    {SKILL_TYPE_LABEL[char.skill.type]}
                  </span>
                  <span className="text-amber-300 font-bold text-sm">{char.skill.name}</span>
                </div>
                <p className="text-gray-400 text-xs leading-tight">{char.skill.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Start button */}
      <button
        disabled={!selected}
        onClick={() => selected && onStart(selected.id)}
        className="px-12 py-4 text-xl font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black shadow-lg"
      >
        {selected ? `以【${selected.name}】出戰` : '請選擇武將'}
      </button>

      <p className="mt-4 text-gray-600 text-xs text-center max-w-md">
        勝利條件：主公消滅所有反賊和內奸 | 反賊擊殺主公 | 內奸最後一人存活
      </p>
    </div>
  );
}
