import { useEffect, useMemo, useState } from 'react';
import { getSocket } from '../socket/client';
import { ALL_CHARACTERS } from '../data/characters';
import { ROLE_DIST_LABEL } from '../data/roles';
import type { RoomState, RoomPlayer } from '../types/room';
import type { GameState } from '../types/game';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Props {
  initialRoom: RoomState;
  onGameStart: (state: GameState, myPlayerId: number) => void;
  onBack: () => void;
}

const KINGDOM_LABEL: Record<string, string> = {
  wei: '魏', shu: '蜀', wu: '吳', neutral: '中',
};
const KINGDOM_BG: Record<string, string> = {
  wei: 'border-blue-500 bg-blue-950',
  shu: 'border-green-500 bg-green-950',
  wu:  'border-red-500 bg-red-950',
  neutral: 'border-gray-500 bg-gray-950',
};

export default function RoomScreen({ initialRoom, onGameStart, onBack }: Props) {
  const [room, setRoom] = useState<RoomState>(initialRoom);
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [charPool, setCharPool] = useState(() => shuffle(ALL_CHARACTERS).slice(0, 5));

  const socket = getSocket();
  const myPlayer = room.players.find(p => p.socketId === socket.id);
  const isHost = myPlayer?.isHost ?? false;
  const takenChars = new Set(room.players.map(p => p.characterId).filter(Boolean));

  useEffect(() => {
    socket.on('room_update', ({ room: updated }) => {
      setRoom(updated);
    });

    socket.on('game_started', ({ state, myPlayerId }) => {
      onGameStart(state, myPlayerId);
    });

    return () => {
      socket.off('room_update');
      socket.off('game_started');
    };
  }, []);

  const handleSelectChar = (charId: string) => {
    if (takenChars.has(charId) && myPlayer?.characterId !== charId) return;
    setSelectedChar(charId);
    socket.emit('select_char', { roomId: room.id, characterId: charId });
  };

  const handleStart = () => {
    setStarting(true);
    setError('');
    socket.emit('start_game', { roomId: room.id }, (res) => {
      setStarting(false);
      if (res.error) setError(res.error);
    });
  };

  const allReady = room.players.every(p => p.isReady);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-amber-950/10 to-stone-950 flex flex-col p-4 gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-300 text-sm">← 離開</button>
        <div className="text-center">
          <div className="text-amber-400 font-bold text-lg">房間號碼</div>
          <div className="text-white font-mono text-3xl font-bold tracking-widest">{room.id}</div>
          <div className="text-gray-500 text-xs">{ROLE_DIST_LABEL[room.maxPlayers]}</div>
        </div>
        <div className="text-gray-500 text-sm">{room.players.length}/{room.maxPlayers} 人</div>
      </div>

      {/* Players in room */}
      <div className="bg-black/30 rounded-xl border border-amber-900/30 p-3">
        <h3 className="text-amber-400 font-bold mb-3 text-sm">房間成員</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: room.maxPlayers }).map((_, i) => {
            const p: RoomPlayer | undefined = room.players[i];
            if (!p) {
              return (
                <div key={i} className="border border-dashed border-gray-700 rounded-lg p-3 text-center text-gray-600 text-sm">
                  等待加入...
                </div>
              );
            }
            const char = p.characterId ? ALL_CHARACTERS.find(c => c.id === p.characterId) : null;
            return (
              <div key={i} className={`rounded-lg border p-2 ${char ? KINGDOM_BG[char.kingdom] : 'border-gray-700 bg-gray-900'}`}>
                <div className="flex items-center gap-1 mb-1">
                  {p.isHost && <span className="text-yellow-400 text-xs">👑</span>}
                  <span className="text-white font-bold text-sm truncate">{p.name}</span>
                  {p.socketId === socket.id && <span className="text-xs text-blue-400">(你)</span>}
                </div>
                {char ? (
                  <div className="flex items-center gap-1">
                    <span className="text-lg">{char.portrait}</span>
                    <div>
                      <div className="text-white text-xs font-bold">{char.name}</div>
                      <div className="text-gray-400 text-xs">{KINGDOM_LABEL[char.kingdom]}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-xs">尚未選擇武將</div>
                )}
                <div className={`text-xs mt-1 ${p.isReady ? 'text-green-400' : 'text-gray-500'}`}>
                  {p.isReady ? '✓ 已準備' : '選擇武將中...'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Character selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-amber-400 font-bold text-sm">選擇武將</h3>
          <button
            onClick={() => { setSelectedChar(null); setCharPool(shuffle(ALL_CHARACTERS).slice(0, 5)); }}
            className="text-sm text-amber-400 border border-amber-700 rounded-lg px-3 py-1 hover:bg-amber-900/30 transition-colors"
          >
            🎲 重新抽取
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                  KINGDOM_BG[char.kingdom],
                  isSelected ? 'ring-2 ring-yellow-400 scale-105 shadow-lg shadow-yellow-400/20' : '',
                ].join(' ')}
              >
                {isTaken && !isMine && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 text-sm text-gray-400">已被選</div>
                )}
                {isMine && (
                  <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full w-4 h-4 flex items-center justify-center text-black text-xs font-bold">✓</div>
                )}
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

      {/* Start button / status */}
      <div className="sticky bottom-0 bg-stone-950/90 border-t border-amber-900/30 p-3">
        {error && (
          <div className="text-red-400 text-sm text-center mb-2">{error}</div>
        )}
        {isHost ? (
          <button
            onClick={handleStart}
            disabled={starting}
            className="w-full py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-bold rounded-xl text-lg transition-colors"
          >
            {starting ? '開始中...' : `開始遊戲（${room.players.length}人 + ${room.maxPlayers - room.players.length}個AI）`}
          </button>
        ) : (
          <div className="text-center text-gray-400 py-3">
            等待房主開始遊戲...
            {allReady && <span className="text-green-400 ml-2">所有人已準備</span>}
          </div>
        )}
        <div className="text-center text-gray-600 text-xs mt-2">
          不足{room.maxPlayers}人的位置將由 AI 填補
        </div>
      </div>
    </div>
  );
}
