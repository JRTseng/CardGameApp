import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../socket/client';
import { ALL_CHARACTERS } from '../data/characters';
import { ROLE_DIST_LABEL } from '../data/roles';
import type { RoomState, RoomPlayer } from '../types/room';
import type { GameState, Role } from '../types/game';

interface Props {
  initialRoom: RoomState;
  onGameStart: (state: GameState, myPlayerId: number) => void;
  onBack: () => void;
}

const KINGDOM_LABEL: Record<string, string> = { wei: '魏', shu: '蜀', wu: '吳', neutral: '中' };
const KINGDOM_BG: Record<string, string> = {
  wei: 'border-blue-500 bg-blue-950',
  shu: 'border-green-500 bg-green-950',
  wu:  'border-red-500 bg-red-950',
  neutral: 'border-gray-500 bg-gray-950',
};
const KINGDOM_COLOR: Record<string, string> = {
  wei: 'border-blue-500 bg-blue-950 hover:bg-blue-900',
  shu: 'border-green-500 bg-green-950 hover:bg-green-900',
  wu:  'border-red-500 bg-red-950 hover:bg-red-900',
  neutral: 'border-gray-500 bg-gray-950 hover:bg-gray-900',
};
const ROLE_META: Record<Role, { label: string; color: string; border: string; bg: string; icon: string; desc: string }> = {
  lord:     { label: '主公', color: 'text-yellow-300', border: 'border-yellow-400', bg: 'from-yellow-900 to-amber-800',   icon: '👑', desc: '統領全軍，消滅所有叛逆！' },
  loyalist: { label: '忠臣', color: 'text-green-300',  border: 'border-green-400',  bg: 'from-green-900 to-emerald-800', icon: '🛡️', desc: '忠心護主，輔佐主公奪勝！' },
  rebel:    { label: '反賊', color: 'text-red-300',    border: 'border-red-400',    bg: 'from-red-900 to-rose-800',      icon: '⚔️', desc: '揭竿而起，擊殺主公取天下！' },
  spy:      { label: '內奸', color: 'text-purple-300', border: 'border-purple-400', bg: 'from-purple-900 to-violet-800', icon: '🎭', desc: '心懷異志，最後一人贏天下！' },
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type RoomPhase = 'lobby' | 'revealing' | 'selecting';

export default function RoomScreen({ initialRoom, onGameStart, onBack }: Props) {
  const [room, setRoom] = useState<RoomState>(initialRoom);
  const [phase, setPhase] = useState<RoomPhase>(initialRoom.rolesAssigned ? 'selecting' : 'lobby');
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [animOut, setAnimOut] = useState(false);
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [charPool, setCharPool] = useState(() => shuffle(ALL_CHARACTERS).slice(0, 5));
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const socket = getSocket();
  const myPlayer = room.players.find(p => p.socketId === socket.id);
  const isHost = myPlayer?.isHost ?? false;
  const takenChars = new Set(room.players.map(p => p.characterId).filter(Boolean));

  useEffect(() => {
    socket.on('room_update', ({ room: updated }: { room: RoomState }) => {
      setRoom(updated);
    });

    socket.on('your_role', ({ role }: { role: Role }) => {
      setMyRole(role);
      setAnimOut(false);
      setPhase('revealing');
    });

    socket.on('game_started', ({ state, myPlayerId }: { state: GameState; myPlayerId: number }) => {
      onGameStart(state, myPlayerId);
    });

    return () => {
      socket.off('room_update');
      socket.off('your_role');
      socket.off('game_started');
    };
  }, []);

  useEffect(() => {
    if (phase !== 'revealing') return;
    timerRef.current = setTimeout(() => setAnimOut(true), 2200);
    const t2 = setTimeout(() => setPhase('selecting'), 3000);
    return () => { clearTimeout(timerRef.current!); clearTimeout(t2); };
  }, [phase]);

  const skipReveal = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase('selecting');
  };

  const handleRevealRoles = () => {
    socket.emit('reveal_roles', { roomId: room.id }, (res: { ok?: boolean; error?: string }) => {
      if (res?.error) setError(res.error);
    });
  };

  const handleSelectChar = (charId: string) => {
    const isMine = myPlayer?.characterId === charId;
    if (takenChars.has(charId) && !isMine) return;
    setSelectedChar(charId);
    socket.emit('select_char', { roomId: room.id, characterId: charId });
  };

  const handleStart = () => {
    setStarting(true);
    setError('');
    socket.emit('start_game', { roomId: room.id }, (res: { ok?: boolean; error?: string }) => {
      setStarting(false);
      if (res.error) setError(res.error);
    });
  };

  // ── Phase: Role Reveal ────────────────────────────────────────────────────────
  if (phase === 'revealing' && myRole) {
    const m = ROLE_META[myRole];
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-stone-950 via-amber-950/10 to-stone-950 flex flex-col items-center justify-center p-6 cursor-pointer"
        onClick={skipReveal}
      >
        <div className={`transition-all duration-700 ${animOut ? 'opacity-0 scale-75' : 'opacity-100 scale-100'} role-reveal-enter`}>
          <div className="text-center mb-8">
            <p className="text-gray-400 text-sm tracking-widest uppercase mb-2">身份揭曉</p>
            <div className="w-24 h-px bg-amber-700 mx-auto" />
          </div>
          <div className={`relative w-72 mx-auto rounded-3xl border-4 ${m.border} bg-gradient-to-br ${m.bg} p-8 text-center shadow-2xl`}>
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

  // ── Phase: Character Selection ─────────────────────────────────────────────────
  if (phase === 'selecting') {
    const m = myRole ? ROLE_META[myRole] : null;
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-950 via-amber-950/10 to-stone-950 flex flex-col p-4 gap-4 overflow-auto">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-300 text-sm">← 離開</button>
          <div className="text-center">
            <div className="text-white font-mono text-2xl font-bold tracking-widest">{room.id}</div>
            {m && (
              <div className={`inline-flex items-center gap-1 text-sm px-3 py-0.5 rounded-full border ${m.border} mt-1`}>
                <span>{m.icon}</span>
                <span className={`font-bold ${m.color}`}>{m.label}</span>
              </div>
            )}
          </div>
          <div className="text-gray-500 text-sm">{room.players.length}/{room.maxPlayers}</div>
        </div>

        {/* Players status */}
        <div className="bg-black/30 rounded-xl border border-amber-900/30 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: room.maxPlayers }).map((_, i) => {
              const p: RoomPlayer | undefined = room.players[i];
              if (!p) return (
                <div key={i} className="border border-dashed border-gray-700 rounded-lg p-2 text-center text-gray-600 text-xs">等待加入...</div>
              );
              const char = p.characterId ? ALL_CHARACTERS.find(c => c.id === p.characterId) : null;
              return (
                <div key={i} className={`rounded-lg border p-2 ${char ? KINGDOM_BG[char.kingdom] : 'border-gray-700 bg-gray-900'}`}>
                  <div className="flex items-center gap-1 mb-1">
                    {p.isHost && <span className="text-yellow-400 text-xs">👑</span>}
                    <span className="text-white font-bold text-xs truncate">{p.name}</span>
                    {p.socketId === socket.id && <span className="text-xs text-blue-400">(你)</span>}
                  </div>
                  {char ? (
                    <div className="flex items-center gap-1">
                      <span>{char.portrait}</span>
                      <span className="text-white text-xs font-bold">{char.name}</span>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-xs">選擇中...</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Character selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-amber-400 font-bold text-sm">選擇武將（5選1）</span>
            <button
              onClick={() => { setSelectedChar(null); setCharPool(shuffle(ALL_CHARACTERS).slice(0, 5)); }}
              className="text-sm text-amber-400 border border-amber-700 rounded-lg px-3 py-1 hover:bg-amber-900/30"
            >
              🎲 重新抽取
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {charPool.map(char => {
              const isMine = myPlayer?.characterId === char.id;
              const isTaken = takenChars.has(char.id) && !isMine;
              const isSelected = selectedChar === char.id || isMine;
              return (
                <div
                  key={char.id}
                  onClick={() => !isTaken && handleSelectChar(char.id)}
                  className={[
                    'relative border-2 rounded-xl p-2 transition-all',
                    isTaken ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer',
                    KINGDOM_COLOR[char.kingdom],
                    isSelected ? 'ring-2 ring-yellow-400 scale-105 shadow-lg shadow-yellow-400/20' : '',
                  ].join(' ')}
                >
                  {isMine && <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full w-4 h-4 flex items-center justify-center text-black text-xs font-bold">✓</div>}
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xl">{char.portrait}</span>
                    <div>
                      <div className="text-white font-bold text-sm">{char.name}</div>
                      <div className="text-gray-400 text-xs">{KINGDOM_LABEL[char.kingdom]}</div>
                    </div>
                  </div>
                  <div className="text-amber-300 text-xs font-bold">{char.skill.name}</div>
                  <div className="text-gray-400 text-xs leading-tight mt-0.5 line-clamp-2">{char.skill.description}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Start */}
        <div className="sticky bottom-0 bg-stone-950/90 border-t border-amber-900/30 p-3">
          {error && <div className="text-red-400 text-sm text-center mb-2">{error}</div>}
          {isHost ? (
            <button
              onClick={handleStart}
              disabled={starting || !selectedChar}
              className="w-full py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-xl text-lg transition-colors"
            >
              {starting ? '開始中...' : `開始遊戲（${room.players.length}人 + ${room.maxPlayers - room.players.length}個AI）`}
            </button>
          ) : (
            <div className="text-center text-gray-400 py-3">
              {selectedChar ? '✓ 已選擇武將，等待房主開始...' : '請先選擇武將'}
            </div>
          )}
          <div className="text-center text-gray-600 text-xs mt-2">{ROLE_DIST_LABEL[room.maxPlayers]}</div>
        </div>
      </div>
    );
  }

  // ── Phase: Lobby ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-amber-950/10 to-stone-950 flex flex-col p-4 gap-4 overflow-auto">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-300 text-sm">← 離開</button>
        <div className="text-center">
          <div className="text-amber-400 font-bold text-lg">房間號碼</div>
          <div className="text-white font-mono text-3xl font-bold tracking-widest">{room.id}</div>
          <div className="text-gray-500 text-xs">{ROLE_DIST_LABEL[room.maxPlayers]}</div>
        </div>
        <div className="text-gray-500 text-sm">{room.players.length}/{room.maxPlayers} 人</div>
      </div>

      <div className="bg-black/30 rounded-xl border border-amber-900/30 p-3">
        <h3 className="text-amber-400 font-bold mb-3 text-sm">房間成員</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: room.maxPlayers }).map((_, i) => {
            const p: RoomPlayer | undefined = room.players[i];
            if (!p) return (
              <div key={i} className="border border-dashed border-gray-700 rounded-lg p-3 text-center text-gray-600 text-sm">等待加入...</div>
            );
            return (
              <div key={i} className="rounded-lg border border-gray-700 bg-gray-900 p-2">
                <div className="flex items-center gap-1">
                  {p.isHost && <span className="text-yellow-400 text-xs">👑</span>}
                  <span className="text-white font-bold text-sm truncate">{p.name}</span>
                  {p.socketId === socket.id && <span className="text-xs text-blue-400">(你)</span>}
                </div>
                <div className="text-gray-500 text-xs mt-1">等待陣營揭曉...</div>
              </div>
            );
          })}
        </div>
      </div>

      {error && <div className="text-red-400 text-sm text-center">{error}</div>}

      <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
        {isHost ? (
          <>
            <p className="text-gray-400 text-sm text-center">所有人就位後，點擊按鈕隨機分配陣營</p>
            <button
              onClick={handleRevealRoles}
              className="px-14 py-4 text-xl font-bold rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black shadow-lg transition-all"
            >
              決定命運 🎲
            </button>
            <div className="text-gray-600 text-xs">不足{room.maxPlayers}人的位置將由 AI 填補</div>
          </>
        ) : (
          <p className="text-gray-400 text-center">等待房主決定命運...</p>
        )}
      </div>
    </div>
  );
}
