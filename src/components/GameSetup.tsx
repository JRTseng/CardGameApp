import { useEffect, useRef, useState } from 'react';
import { ALL_CHARACTERS } from '../data/characters';
import { ROLE_DIST_LABEL, getRolesForCount } from '../data/roles';
import type { Character, Role } from '../types/game';
import CharacterListOverlay from './CharacterListOverlay';

interface Props {
  onStart: (characterId: string, playerCount: number, role: Role) => void;
  onBack?: () => void;
}

const KINGDOM_LABEL: Record<string, string> = {
  wei: '魏國', shu: '蜀國', wu: '吳國', neutral: '中立',
};
const KINGDOM_COLOR: Record<string, string> = {
  wei:     'border-blue-500 bg-blue-950 hover:bg-blue-900',
  shu:     'border-green-500 bg-green-950 hover:bg-green-900',
  wu:      'border-red-500 bg-red-950 hover:bg-red-900',
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

const ROLE_META: Record<Role, { label: string; color: string; border: string; bg: string; icon: string; desc: string }> = {
  lord:     { label: '主公', color: 'text-yellow-300', border: 'border-yellow-400', bg: 'from-yellow-900 to-amber-800', icon: '👑', desc: '統領全軍，消滅所有叛逆！' },
  loyalist: { label: '忠臣', color: 'text-green-300',  border: 'border-green-400',  bg: 'from-green-900 to-emerald-800', icon: '🛡️', desc: '忠心護主，輔佐主公奪勝！' },
  rebel:    { label: '反賊', color: 'text-red-300',    border: 'border-red-400',    bg: 'from-red-900 to-rose-800',     icon: '⚔️', desc: '揭竿而起，擊殺主公取天下！' },
  spy:      { label: '內奸', color: 'text-purple-300', border: 'border-purple-400', bg: 'from-purple-900 to-violet-800', icon: '🎭', desc: '心懷異志，最後一人贏天下！' },
};

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = 'setup' | 'revealing' | 'selecting';

export default function GameSetup({ onStart, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [playerCount, setPlayerCount] = useState(4);
  const [humanRole, setHumanRole] = useState<Role>('lord');
  const [choices, setChoices] = useState<Character[]>([]);
  const [selected, setSelected] = useState<Character | null>(null);
  const [animOut, setAnimOut] = useState(false);
  const [showCharList, setShowCharList] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kick off the reveal when phase changes to 'revealing'
  useEffect(() => {
    if (phase !== 'revealing') return;
    setAnimOut(false);
    timerRef.current = setTimeout(() => setAnimOut(true), 2200);
    const t2 = setTimeout(() => setPhase('selecting'), 3000);
    return () => {
      clearTimeout(timerRef.current!);
      clearTimeout(t2);
    };
  }, [phase]);

  const handleConfirmSetup = () => {
    const roles = getRolesForCount(playerCount);
    const role = roles[Math.floor(Math.random() * roles.length)] as Role;
    setHumanRole(role);
    setChoices(shuffleArr(ALL_CHARACTERS).slice(0, 5));
    setSelected(null);
    setPhase('revealing');
  };

  const skipReveal = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase('selecting');
  };

  // ── Phase 1: Setup ────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-950 via-amber-950/10 to-stone-950 flex flex-col items-center justify-center p-6 gap-6 overflow-auto">
        {showCharList && <CharacterListOverlay onClose={() => setShowCharList(false)} />}
        {onBack && (
          <button onClick={onBack} className="absolute top-4 left-4 text-gray-500 hover:text-gray-300 text-sm">← 返回</button>
        )}
        <button
          onClick={() => setShowCharList(true)}
          className="absolute top-4 right-4 text-amber-500 border border-amber-800 rounded-lg px-3 py-1.5 text-sm hover:bg-amber-900/30"
        >
          武將一覽
        </button>

        <div className="text-center mb-2">
          <h1 className="text-5xl font-bold text-amber-400 tracking-wider mb-2" style={{ fontFamily: 'serif' }}>
            三國決殺
          </h1>
          <p className="text-amber-600 text-lg">— 亂世英雄，沙場征戰 —</p>
        </div>

        {/* Player count */}
        <div className="w-full max-w-sm bg-black/30 rounded-xl border border-amber-900/30 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-300 font-bold text-lg">遊戲人數</span>
            <span className="text-amber-400 font-bold text-2xl">{playerCount} 人</span>
          </div>
          <input
            type="range" min={2} max={15} value={playerCount}
            onChange={e => setPlayerCount(Number(e.target.value))}
            className="w-full accent-amber-500 mb-3"
          />
          <div className="text-gray-400 text-sm text-center font-medium">{ROLE_DIST_LABEL[playerCount]}</div>
          <div className="text-gray-600 text-xs text-center mt-1">玩家擔任隨機陣營 + {playerCount - 1} 個AI</div>
        </div>

        {/* Role legend */}
        <div className="flex gap-4 flex-wrap justify-center">
          {(['lord', 'loyalist', 'rebel', 'spy'] as Role[]).map(r => {
            const m = ROLE_META[r];
            return (
              <div key={r} className="text-center">
                <div className={`font-bold text-lg ${m.color}`}>{m.icon} {m.label}</div>
                <div className="text-gray-500 text-xs">{m.desc}</div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleConfirmSetup}
          className="px-14 py-4 text-xl font-bold rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black shadow-lg transition-all"
        >
          決定命運 🎲
        </button>
      </div>
    );
  }

  // ── Phase 2: Role Reveal ──────────────────────────────────────────────────────
  if (phase === 'revealing') {
    const m = ROLE_META[humanRole];
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-stone-950 via-amber-950/10 to-stone-950 flex flex-col items-center justify-center p-6 cursor-pointer"
        onClick={skipReveal}
      >
        <div className={`transition-all duration-700 ${animOut ? 'opacity-0 scale-75' : 'opacity-100 scale-100'} role-reveal-enter`}>
          {/* Title */}
          <div className="text-center mb-8">
            <p className="text-gray-400 text-sm tracking-widest uppercase mb-2">身份揭曉</p>
            <div className="w-24 h-px bg-amber-700 mx-auto" />
          </div>

          {/* Role card */}
          <div className={`relative w-72 mx-auto rounded-3xl border-4 ${m.border} bg-gradient-to-br ${m.bg} p-8 text-center shadow-2xl`}
            style={{ boxShadow: `0 0 60px 10px rgba(0,0,0,0.6), 0 0 30px 5px var(--role-glow, #fbbf24)` }}
          >
            {/* Decorative corner lines */}
            <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-white/20 rounded-tl-xl" />
            <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-white/20 rounded-tr-xl" />
            <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-white/20 rounded-bl-xl" />
            <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-white/20 rounded-br-xl" />

            <div className="text-6xl mb-4 animate-bounce">{m.icon}</div>
            <div className={`text-5xl font-bold mb-3 ${m.color}`} style={{ fontFamily: 'serif', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
              {m.label}
            </div>
            <div className="w-16 h-px bg-white/20 mx-auto mb-3" />
            <p className="text-gray-300 text-base leading-relaxed">{m.desc}</p>
          </div>

          <p className="text-gray-600 text-sm text-center mt-8 animate-pulse">點擊任意處繼續</p>
        </div>
      </div>
    );
  }

  // ── Phase 3: Character Selection ──────────────────────────────────────────────
  const m = ROLE_META[humanRole];
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-amber-950/10 to-stone-950 flex flex-col items-center justify-center p-6 overflow-auto">
      <div className="mb-4 text-center">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${m.border} bg-gradient-to-r ${m.bg}`}>
          <span>{m.icon}</span>
          <span className={`font-bold ${m.color}`}>{m.label}</span>
          <span className="text-gray-400 text-sm">— 選擇你的武將</span>
        </div>
      </div>

      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-gray-400 text-sm">從5位隨機武將中選擇1位</span>
          <button
            onClick={() => { setSelected(null); setChoices(shuffleArr(ALL_CHARACTERS).slice(0, 5)); }}
            className="text-sm text-amber-400 border border-amber-700 rounded-lg px-3 py-1 hover:bg-amber-900/30 transition-colors"
          >
            🎲 重新抽取
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-5">
          {choices.map(char => {
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
                    <div className="text-white font-bold text-base">{char.name}</div>
                    <div className="text-gray-400 text-xs">{KINGDOM_LABEL[char.kingdom]}</div>
                  </div>
                </div>
                <div className="flex gap-0.5 flex-wrap mb-2">
                  {Array.from({ length: char.baseHp + (humanRole === 'lord' ? 1 : 0) }).map((_, i) => (
                    <span key={i} className="text-xs">❤️</span>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <span className={`text-xs px-1 rounded ${SKILL_TYPE_BADGE[char.skill.type]}`}>
                      {SKILL_TYPE_LABEL[char.skill.type]}
                    </span>
                    <span className="text-amber-300 font-bold text-sm">{char.skill.name}</span>
                  </div>
                  <p className="text-gray-400 text-xs leading-tight line-clamp-2">{char.skill.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-gray-600 text-xs text-center mb-5">
          共 {ALL_CHARACTERS.length} 位武將 · AI 從剩餘武將中隨機選取，不重複
        </div>
      </div>

      <button
        disabled={!selected}
        onClick={() => selected && onStart(selected.id, playerCount, humanRole)}
        className="px-12 py-4 text-xl font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black shadow-lg"
      >
        {selected ? `以【${selected.name}】出戰` : '請選擇武將'}
      </button>
    </div>
  );
}
