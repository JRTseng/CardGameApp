import { useReducer, useEffect, useState, useCallback } from 'react';
import type { GameState, Role } from './types/game';
import type { RoomState } from './types/room';
import { gameReducer, initGame, type GameAction } from './game/engine';
import { getSocket, disconnectSocket } from './socket/client';
import MenuScreen from './screens/MenuScreen';
import LobbyScreen from './screens/LobbyScreen';
import RoomScreen from './screens/RoomScreen';
import GameSetup from './components/GameSetup';
import GameBoard from './components/GameBoard';

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
  const [turnDeadline, setTurnDeadline] = useState<number | null>(null);
  const socket = getSocket();

  useEffect(() => {
    const onStateUpdate = ({ state: newState }: { state: GameState }) => {
      setState(personalizeState(newState, myPlayerId));
    };
    const onTurnTimer = ({ deadline }: { deadline: number | null }) => {
      setTurnDeadline(deadline);
    };
    const onDisconnect = () => setConnected(false);
    const onConnect = () => { setConnected(true); setReconnectAttempts(0); };
    const onReconnectAttempt = (n: number) => setReconnectAttempts(n);
    const onError = ({ message }: { message: string }) => {
      console.error('Server error:', message);
    };

    socket.on('state_update', onStateUpdate);
    socket.on('turn_timer', onTurnTimer);
    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.on('server_error', onError);

    return () => {
      socket.off('state_update', onStateUpdate);
      socket.off('turn_timer', onTurnTimer);
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
      <GameBoard state={state} dispatch={dispatch} onRestart={onRestart} turnDeadline={turnDeadline} />
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
