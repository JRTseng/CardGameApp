import { useState } from 'react';
import { getSocket } from '../socket/client';
import type { RoomState } from '../types/room';
import { ROLE_DIST_LABEL } from '../data/roles';

interface Props {
  onJoined: (roomState: RoomState) => void;
  onBack: () => void;
}

export default function LobbyScreen({ onJoined, onBack }: Props) {
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = () => {
    if (!playerName.trim()) { setError('請輸入名稱'); return; }
    setLoading(true);
    setError('');
    const socket = getSocket();
    socket.emit('create_room', { playerName: playerName.trim(), maxPlayers }, (res) => {
      setLoading(false);
      if (res.error) { setError(res.error); return; }
      onJoined(res.room!);
    });
  };

  const handleJoin = () => {
    if (!playerName.trim()) { setError('請輸入名稱'); return; }
    if (!joinCode.trim()) { setError('請輸入房間號碼'); return; }
    setLoading(true);
    setError('');
    const socket = getSocket();
    socket.emit('join_room', { roomId: joinCode.trim().toUpperCase(), playerName: playerName.trim() }, (res) => {
      setLoading(false);
      if (res.error) { setError(res.error); return; }
      onJoined(res.room!);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-amber-950/10 to-stone-950 flex flex-col items-center justify-center p-6 gap-6">
      <button onClick={onBack} className="absolute top-4 left-4 text-gray-500 hover:text-gray-300 text-sm">
        ← 返回
      </button>

      <h2 className="text-3xl font-bold text-amber-400">線上多人</h2>

      <div className="w-full max-w-sm flex flex-col gap-4">
        {/* Player Name */}
        <div>
          <label className="text-gray-400 text-sm mb-1 block">玩家名稱</label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="輸入名稱..."
            maxLength={12}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Player Count */}
        <div>
          <label className="text-gray-400 text-sm mb-1 block">房間人數（2–15）</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={2}
              max={15}
              value={maxPlayers}
              onChange={e => setMaxPlayers(Number(e.target.value))}
              className="flex-1 accent-amber-500"
            />
            <span className="text-amber-400 font-bold text-lg w-6 text-center">{maxPlayers}</span>
          </div>
          <div className="text-gray-500 text-xs mt-1">{ROLE_DIST_LABEL[maxPlayers]}</div>
        </div>

        {/* Create Room */}
        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full py-4 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
        >
          {loading ? '建立中...' : '🏠 建立新房間'}
        </button>

        <div className="flex items-center gap-3 text-gray-600">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-sm">或</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* Join Room */}
        <div>
          <label className="text-gray-400 text-sm mb-1 block">房間號碼</label>
          <input
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="輸入6位房間碼..."
            maxLength={6}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 uppercase tracking-widest text-center text-lg font-mono"
          />
        </div>
        <button
          onClick={handleJoin}
          disabled={loading}
          className="w-full py-4 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
        >
          {loading ? '加入中...' : '🚪 加入房間'}
        </button>

        {error && (
          <div className="text-red-400 text-sm text-center bg-red-950/50 rounded-lg py-2 px-4">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
