import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import type { GameState, Role } from './types/game';
import type { RoomState } from './types/room';
import { gameReducer, initGame, type GameAction } from './game/engine';
import { getSocket, disconnectSocket } from './socket/client';
import MenuScreen from './screens/MenuScreen';
import LobbyScreen from './screens/LobbyScreen';
import RoomScreen from './screens/RoomScreen';
import GameSetup from './components/GameSetup';
import GameBoard from './components/GameBoard';

const ROLE_META: Record<Role, { label: string; color: string; border: string; bg: string; icon: string; desc: string }> = {
  lord:     { label: '主公', color: 'text-yellow-300', border: 'border-yellow-400', bg: 'from-yellow-900 to-amber-800', icon: '👑', desc: '統領全軍，消滅所有叛逆！' },
  loyalist: { label: '忠臣', color: 'text-green-300',  border: 'border-green-400',  bg: 'from-green-900 to-emerald-800', icon: '🛡️', desc: '忠心護主，輔佐主公奪勝！' },
  rebel:    { label: '反賊', color: 'text-red-300',    border: 'border-red-400',    bg: 'from-red-900 to-rose-800',     icon: '⚔️', desc: '揭竿而起，擊殺主公取天下！' },
  spy:      { label: '內奸', color: 'text-purple-300', border: 'border-purple-400', bg: 'from-purple-900 to-violet-800', icon: '🎭', desc: '心懷異志，最後一人贏天下！' },
};

type Screen = 'menu' | 'setup' | 'lobby' | 'room' | 'game_solo' | 'game_online';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameKey, setGameKey] = useState(0);
  const [soloCharId, setSoloCharId] = useState<string | null>(null);
  const [soloPlayerCount, setSoloPlayerCount] = useState(4);
  const [soloRole, setSoloRole] = useState<Role>('lord');
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [onlineGameState, setOnlineGameState] = useState<GameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<number>(0);

  const handleSoloStart = (charId: string, playerCount: number, role: Role) => {
    setSoloCharId(charId);
    setSoloPlayerCount(playerCount);
    setSoloRole(role);
    setGameKey(k => k + 1);
    setScreen('game_solo');
  };

  const handleOnlineJoined = (room: RoomState) => {
    setRoomState(room);
    setScreen('room');
  };

  const handleGameStart = (state: GameState, pid: number) => {
    setOnlineGameState(state);
    setMyPlayerId(pid);
    setGameKey(k => k + 1);
    setScreen('game_online');
  };

  const handleRestart = () => {
    disconnectSocket();
    setScreen('menu');
    setRoomState(null);
    setOnlineGameState(null);
  };


  switch (screen) {
    case 'menu':
      return <MenuScreen onSolo={() => setScreen('setup')} onOnline={() => setScreen('lobby')} />;

    case 'setup':
      return <GameSetup onStart={handleSoloStart} onBack={() => setScreen('menu')} />;

    case 'lobby':
      return <LobbyScreen onJoined={handleOnlineJoined} onBack={() => setScreen('menu')} />;

    case 'room':
      return roomState ? (
        <RoomScreen
          initialRoom={roomState}
          onGameStart={handleGameStart}
          onBack={() => { disconnectSocket(); setScreen('menu'); }}
        />
      ) : null;

    case 'game_solo':
      return soloCharId ? (
        <SoloGameInstance key={gameKey} characterId={soloCharId} playerCount={soloPlayerCount} role={soloRole} onRestart={handleRestart} />
      ) : null;

    case 'game_online':
      return onlineGameState ? (
        <OnlineGameInstance
          key={gameKey}
          initialState={onlineGameState}
          myPlayerId={myPlayerId}
          roomId={roomState?.id ?? ''}
          onRestart={handleRestart}
        />
      ) : null;

    default:
      return null;
  }
}

// ─── Solo Game ─────────────────────────────────────────────────────────────────

function SoloGameInstance({ characterId, playerCount, role, onRestart }: { characterId: string; playerCount: number; role: Role; onRestart: () => void }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => initGame(characterId, playerCount, role));

  useEffect(() => {
    if (state.gameOver) return;
    const pa = state.pendingAction;
    const current = state.players[state.currentPlayerIndex];
    const needsAI =
      (pa && !state.players.find(p => p.id === pa.actorId)?.isHuman) ||
      (!pa && (state.phase === 'play' || state.phase === 'discard') && !current.isHuman);
    if (!needsAI) return;
    const t = setTimeout(() => dispatch({ type: 'AI_ACTION' }), 600);
    return () => clearTimeout(t);
  }, [state]);

  return <GameBoard state={state} dispatch={dispatch} onRestart={onRestart} />;
}

// ─── Online Game ──────────────────────────────────────────────────────────────

function OnlineGameInstance({
  initialState,
  myPlayerId,
  roomId,
  onRestart,
}: {
  initialState: GameState;
  myPlayerId: number;
  roomId: string;
  onRestart: () => void;
}) {
  const [state, setState] = useState<GameState>(() =>
    personalizeState(initialState, myPlayerId)
  );
  const [connected, setConnected] = useState(true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [revealing, setRevealing] = useState(true);
  const [animOut, setAnimOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socket = getSocket();

  const myRole = state.players.find(p => p.id === myPlayerId)?.role ?? 'rebel';
  const m = ROLE_META[myRole];

  useEffect(() => {
    if (!revealing) return;
    timerRef.current = setTimeout(() => setAnimOut(true), 2200);
    const t2 = setTimeout(() => setRevealing(false), 3000);
    return () => { clearTimeout(timerRef.current!); clearTimeout(t2); };
  }, [revealing]);

  useEffect(() => {
    const onStateUpdate = ({ state: newState }: { state: GameState }) => {
      setState(personalizeState(newState, myPlayerId));
    };
    const onDisconnect = () => setConnected(false);
    const onConnect = () => { setConnected(true); setReconnectAttempts(0); };
    const onReconnectAttempt = (n: number) => setReconnectAttempts(n);
    const onError = ({ message }: { message: string }) => {
      console.error('Server error:', message);
    };

    socket.on('state_update', onStateUpdate);
    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.on('server_error', onError);

    return () => {
      socket.off('state_update', onStateUpdate);
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off('server_error', onError);
    };
  }, [myPlayerId]);

  const dispatch = useCallback((action: GameAction) => {
    setState(prev => personalizeState(gameReducer(prev, action), myPlayerId));
    socket.emit('player_action', { roomId, action });
  }, [roomId, myPlayerId]);

  if (revealing) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-stone-950 via-amber-950/10 to-stone-950 flex flex-col items-center justify-center p-6 cursor-pointer"
        onClick={() => { if (timerRef.current) clearTimeout(timerRef.current); setRevealing(false); }}
      >
        <div className={`transition-all duration-700 ${animOut ? 'opacity-0 scale-75' : 'opacity-100 scale-100'} role-reveal-enter`}>
          <div className="text-center mb-8">
            <p className="text-gray-400 text-sm tracking-widest uppercase mb-2">身份揭曉</p>
            <div className="w-24 h-px bg-amber-700 mx-auto" />
          </div>
          <div
            className={`relative w-72 mx-auto rounded-3xl border-4 ${m.border} bg-gradient-to-br ${m.bg} p-8 text-center shadow-2xl`}
            style={{ boxShadow: `0 0 60px 10px rgba(0,0,0,0.6)` }}
          >
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

  return (
    <div className="relative">
      {!connected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-500 rounded-2xl p-8 text-center shadow-2xl max-w-sm mx-4">
            <div className="text-4xl mb-3 animate-spin">⚡</div>
            <h3 className="text-red-400 font-bold text-lg mb-2">連線已中斷</h3>
            <p className="text-gray-300 text-sm mb-4">
              正在重新連線... (第{reconnectAttempts}次嘗試)
            </p>
            <button
              onClick={onRestart}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-bold"
            >
              返回主選單
            </button>
          </div>
        </div>
      )}
      <GameBoard state={state} dispatch={dispatch} onRestart={onRestart} />
    </div>
  );
}

/** Mark only the current socket's player as isHuman */
function personalizeState(state: GameState, myPlayerId: number): GameState {
  return {
    ...state,
    players: state.players.map(p => ({
      ...p,
      isHuman: p.id === myPlayerId,
    })),
  };
}
