import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '../types/game';
import type { GameAction } from '../game/engine';
import { getShaTargets, getTrickTargets, needsTarget, cardCanBeSha } from '../game/rules';
import PlayerBoard from './PlayerBoard';
import ActionPanel from './ActionPanel';
import CharacterListOverlay from './CharacterListOverlay';

interface Props {
  state: GameState;
  dispatch: (action: GameAction) => void;
  onRestart: () => void;
  turnDeadline?: number | null;
  aiAssist?: boolean;
  onToggleAiAssist?: () => void;
}

const ROLE_NAME: Record<string, string> = {
  lord: '主公', loyalist: '忠臣', rebel: '反賊', spy: '內奸',
};

export default function GameBoard({ state, dispatch, onRestart, turnDeadline, aiAssist, onToggleAiAssist }: Props) {
  const human = state.players.find(p => p.isHuman)!;
  const opponents = state.players.filter(p => !p.isHuman);
  const pa = state.pendingAction;

  const [showTurnAlert, setShowTurnAlert] = useState(false);
  const [showCharList, setShowCharList] = useState(false);
  const wasHumanTurnRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.log.length]);

  const getTargetableIds = useCallback((): Set<number> => {
    if (!state.selectedCardId) return new Set();
    const card = human.hand.find(c => c.id === state.selectedCardId);
    if (!card || !needsTarget(card, human)) return new Set();
    if (cardCanBeSha(card, human)) return new Set(getShaTargets(human, state));
    if (card.type === 'juedou' || card.type === 'guohe' || card.type === 'shuntian') {
      return new Set(getTrickTargets(human, card.type, state));
    }
    return new Set();
  }, [state, human]);

  const targetableIds = getTargetableIds();

  const renderOpponent = (playerId: number) => {
    const player = state.players.find(p => p.id === playerId)!;
    return (
      <PlayerBoard
        key={player.id}
        player={player}
        compact
        isCurrentTurn={state.players[state.currentPlayerIndex].id === player.id}
        isTargetable={targetableIds.has(player.id)}
        isPending={pa?.actorId === player.id}
        onTarget={() => {
          if (targetableIds.has(player.id) && state.selectedCardId) {
            dispatch({ type: 'PLAY_CARD_ON_TARGET', targetId: player.id });
          }
        }}
      />
    );
  };

  return (
    <div className="w-full min-h-[100dvh] flex flex-col bg-gradient-to-br from-stone-950 via-amber-950/20 to-stone-950 overflow-y-auto overflow-x-hidden">

      {/* Your Turn Notification */}
      {showTurnAlert && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 animate-turn-notify pointer-events-none">
          <div className="bg-gradient-to-r from-yellow-600 to-amber-500 text-black font-bold px-6 py-3 rounded-2xl shadow-2xl text-lg border-2 border-yellow-300">
            ⚔️ 輪到你了！
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {state.gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gradient-to-br from-amber-900 to-amber-700 border-2 border-amber-400 rounded-2xl p-6 text-center shadow-2xl w-full max-w-sm">
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="text-2xl font-bold text-amber-100 mb-1">遊戲結束</h2>
            <div className="text-amber-200 text-base mb-4">
              {state.log[state.log.length - 1]}
            </div>
            <div className="flex flex-col gap-1.5 mb-5 max-h-48 overflow-y-auto">
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
                  <span className="truncate">{p.name}</span>
                  <span className="text-gray-500 shrink-0">({p.character.name})</span>
                  <span className="ml-auto shrink-0">{ROLE_NAME[p.role]}</span>
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

      {/* ── OPPONENTS ROW (sticky) ── */}
      <div className="sticky top-0 z-10 bg-stone-950/95 backdrop-blur-sm px-2 pt-2 pb-1 border-b border-amber-900/20">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {opponents.map(p => renderOpponent(p.id))}
        </div>
      </div>

      {/* ── STATUS BAR ── */}
      <div className="flex items-center gap-2 px-2 py-1 text-xs border-b border-amber-900/10">
        <span className="text-gray-500">第{state.round}回合</span>
        <span className="text-gray-600">牌堆:{state.deck.length}</span>
        <span className="text-gray-600">棄牌:{state.discardPile.length}</span>
        <button
          onClick={() => setShowCharList(true)}
          className="ml-auto text-amber-500 border border-amber-800 rounded px-2 py-0.5 hover:bg-amber-900/30"
        >
          武將一覽
        </button>
      </div>

      {showCharList && <CharacterListOverlay onClose={() => setShowCharList(false)} />}

      {/* ── HUMAN + ACTION PANEL ── */}
      <div className="flex flex-col sm:flex-row gap-2 px-2 pt-1">

        {/* Human player board */}
        <div className="flex-shrink-0 self-start">
          <PlayerBoard
            player={human}
            isCurrentTurn={state.players[state.currentPlayerIndex].id === human.id}
            isTargetable={false}
            isPending={pa?.actorId === human.id}
            onTarget={() => {}}
          />
        </div>

        {/* Action panel */}
        <div className="flex-1 bg-black/30 rounded-xl border border-amber-900/30 p-2">
          <ActionPanel state={state} dispatch={dispatch} turnDeadline={turnDeadline} aiAssist={aiAssist} onToggleAiAssist={onToggleAiAssist} />
        </div>
      </div>

      {/* ── GAME LOG ── */}
      <div className="mx-2 mt-2 mb-3 bg-black/40 rounded-xl border border-amber-900/25">
        <div className="px-3 py-1.5 border-b border-amber-900/20">
          <span className="text-amber-600 font-semibold text-xs tracking-wide">出牌紀錄</span>
        </div>
        <div className="h-40 overflow-y-auto px-3 py-2 text-xs flex flex-col-reverse">
          <div ref={logEndRef} />
          {[...state.log].reverse().map((entry, i) => (
            <div key={i} className="text-gray-400 leading-relaxed py-0.5 border-b border-white/5 last:border-0">
              {entry}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
