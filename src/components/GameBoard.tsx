import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '../types/game';
import type { GameAction } from '../game/engine';
import { getShaTargets, getTrickTargets, needsTarget, cardCanBeSha } from '../game/rules';
import PlayerBoard from './PlayerBoard';
import ActionPanel from './ActionPanel';
import GameLog from './GameLog';

interface Props {
  state: GameState;
  dispatch: (action: GameAction) => void;
  onRestart: () => void;
}

const ROLE_NAME: Record<string, string> = {
  lord: '主公', loyalist: '忠臣', rebel: '反賊', spy: '內奸',
};

export default function GameBoard({ state, dispatch, onRestart }: Props) {
  const human = state.players.find(p => p.isHuman)!;
  const pa = state.pendingAction;

  const [showTurnAlert, setShowTurnAlert] = useState(false);
  const wasHumanTurnRef = useRef(false);
  const isHumanTurn = !state.gameOver && !pa && state.phase === 'play'
    && state.players[state.currentPlayerIndex].id === human.id;

  useEffect(() => {
    if (isHumanTurn && !wasHumanTurnRef.current) {
      setShowTurnAlert(true);
      wasHumanTurnRef.current = true;
      const t = setTimeout(() => setShowTurnAlert(false), 1800);
      return () => clearTimeout(t);
    }
    if (!isHumanTurn) wasHumanTurnRef.current = false;
  }, [isHumanTurn]);

  const getTargetableIds = useCallback((): Set<number> => {
    if (!state.selectedCardId) return new Set();
    const card = human.hand.find(c => c.id === state.selectedCardId);
    if (!card || !needsTarget(card, human)) return new Set();

    if (cardCanBeSha(card, human)) {
      return new Set(getShaTargets(human, state));
    }
    if (card.type === 'juedou' || card.type === 'guohe' || card.type === 'shuntian') {
      return new Set(getTrickTargets(human, card.type, state));
    }
    return new Set();
  }, [state, human]);

  const targetableIds = getTargetableIds();

  // Layout: players[0]=human(bottom), [1]=left, [2]=top, [3]=right
  const playerAt = (idx: number) => state.players[idx];

  const renderPlayer = (idx: number) => {
    const player = playerAt(idx);
    const isCurrentTurn = state.players[state.currentPlayerIndex].id === player.id;
    const isTargetable = targetableIds.has(player.id);
    const isPending = pa?.actorId === player.id;
    return (
      <PlayerBoard
        key={player.id}
        player={player}
        isCurrentTurn={isCurrentTurn}
        isTargetable={isTargetable}
        isPending={isPending}
        onTarget={() => {
          if (isTargetable && state.selectedCardId) {
            dispatch({ type: 'PLAY_CARD_ON_TARGET', targetId: player.id });
          }
        }}
      />
    );
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gradient-to-br from-stone-950 via-amber-950/20 to-stone-950 overflow-hidden p-2 gap-2">

      {/* Your Turn Notification */}
      {showTurnAlert && (
        <div className="fixed top-20 left-1/2 z-40 animate-turn-notify pointer-events-none">
          <div className="bg-gradient-to-r from-yellow-600 to-amber-500 text-black font-bold px-6 py-3 rounded-2xl shadow-2xl text-lg border-2 border-yellow-300">
            ⚔️ 輪到你了！
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {state.gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-amber-900 to-amber-700 border-2 border-amber-400 rounded-2xl p-8 text-center shadow-2xl max-w-md mx-4">
            <div className="text-5xl mb-4">🏆</div>
            <h2 className="text-2xl font-bold text-amber-100 mb-2">遊戲結束</h2>
            <div className="text-amber-200 text-lg mb-6">
              {state.log[state.log.length - 1]}
            </div>
            <div className="flex flex-col gap-2 mb-6">
              {state.players.map(p => (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 text-sm px-3 py-1 rounded ${
                    state.winnerPlayerIds.includes(p.id)
                      ? 'bg-yellow-600/30 text-yellow-200 font-bold'
                      : 'text-gray-400'
                  }`}
                >
                  <span>{state.winnerPlayerIds.includes(p.id) ? '🥇' : (p.isAlive ? '😤' : '💀')}</span>
                  <span>{p.name}</span>
                  <span className="text-gray-500">({p.character.name})</span>
                  <span className="ml-auto">{ROLE_NAME[p.role]}</span>
                </div>
              ))}
            </div>
            <button
              onClick={onRestart}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-colors text-lg"
            >
              再來一局
            </button>
          </div>
        </div>
      )}

      {/* Top opponent */}
      <div className="flex justify-center">
        {renderPlayer(2)}
      </div>

      {/* Middle row */}
      <div className="flex-1 flex gap-2 items-center min-h-0">
        {/* Left opponent */}
        <div className="flex-shrink-0">
          {renderPlayer(1)}
        </div>

        {/* Center: log */}
        <div className="flex-1 min-h-0">
          <GameLog
            log={state.log}
            deckCount={state.deck.length}
            discardCount={state.discardPile.length}
            round={state.round}
          />
        </div>

        {/* Right opponent */}
        <div className="flex-shrink-0">
          {renderPlayer(3)}
        </div>
      </div>

      {/* Bottom row: human + action panel */}
      <div className="flex gap-3 items-start">
        {/* Human player board */}
        <div className="flex-shrink-0">
          {renderPlayer(0)}
        </div>

        {/* Action panel */}
        <div className="flex-1 bg-black/30 rounded-xl border border-amber-900/30 p-2 max-h-[200px] overflow-y-auto">
          <ActionPanel state={state} dispatch={dispatch} />
        </div>
      </div>
    </div>
  );
}
