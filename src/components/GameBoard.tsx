import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '../types/game';
import type { GameAction } from '../game/engine';
import { getShaTargets, getTrickTargets, needsTarget, cardCanBeSha } from '../game/rules';
import { ALL_CHARACTERS } from '../data/characters';
import PlayerBoard from './PlayerBoard';
import ActionPanel from './ActionPanel';

interface Props {
  state: GameState;
  dispatch: (action: GameAction) => void;
  onRestart: () => void;
}

const ROLE_NAME: Record<string, string> = {
  lord: '主公', loyalist: '忠臣', rebel: '反賊', spy: '內奸',
};

const KINGDOM_LABEL: Record<string, string> = {
  wei: '魏國', shu: '蜀國', wu: '吳國', neutral: '中立',
};
const KINGDOM_COLOR: Record<string, string> = {
  wei:     'border-blue-600 bg-blue-950/60',
  shu:     'border-green-600 bg-green-950/60',
  wu:      'border-red-600 bg-red-950/60',
  neutral: 'border-gray-600 bg-gray-900/60',
};
const SKILL_BADGE: Record<string, string> = {
  passive: 'bg-blue-800 text-blue-200',
  active:  'bg-green-800 text-green-200',
  trigger: 'bg-orange-800 text-orange-200',
};
const SKILL_LABEL: Record<string, string> = {
  passive: '被動', active: '主動', trigger: '觸發',
};

export default function GameBoard({ state, dispatch, onRestart }: Props) {
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

      {/* ── CHARACTER LIST OVERLAY ── */}
      {showCharList && (
        <div className="fixed inset-0 z-40 bg-black/85 backdrop-blur-sm flex flex-col" onClick={() => setShowCharList(false)}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-amber-900/40 shrink-0" onClick={e => e.stopPropagation()}>
            <h2 className="text-amber-400 font-bold text-base">武將一覽（{ALL_CHARACTERS.length} 位）</h2>
            <button onClick={() => setShowCharList(false)} className="text-gray-400 hover:text-white text-sm px-2 py-1">✕ 關閉</button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3" onClick={e => e.stopPropagation()}>
            {/* Group by kingdom */}
            {(['wei', 'shu', 'wu', 'neutral'] as const).map(kingdom => {
              const chars = ALL_CHARACTERS.filter(c => c.kingdom === kingdom);
              if (!chars.length) return null;
              return (
                <div key={kingdom} className="mb-5">
                  <div className="text-xs text-gray-500 font-semibold tracking-widest uppercase mb-2 px-1">
                    {KINGDOM_LABEL[kingdom]}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {chars.map(char => {
                      const inGame = state.players.find(p => p.character.id === char.id);
                      return (
                        <div
                          key={char.id}
                          className={`relative border rounded-xl p-3 ${KINGDOM_COLOR[char.kingdom]} ${inGame ? 'ring-1 ring-amber-500/60' : 'opacity-70'}`}
                        >
                          {inGame && (
                            <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-black text-[10px] font-bold px-1.5 rounded-full">
                              {inGame.name}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-3xl">{char.portrait}</span>
                            <div>
                              <div className="text-white font-bold text-sm">{char.name}</div>
                              <div className="flex gap-1 mt-0.5">
                                {Array.from({ length: char.baseHp }).map((_, i) => (
                                  <span key={i} className="text-[10px]">❤️</span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className={`text-[10px] px-1 py-0.5 rounded ${SKILL_BADGE[char.skill.type]}`}>
                              {SKILL_LABEL[char.skill.type]}
                            </span>
                            <span className="text-amber-300 font-bold text-xs">{char.skill.name}</span>
                          </div>
                          <p className="text-gray-400 text-[11px] leading-snug">{char.skill.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
          <ActionPanel state={state} dispatch={dispatch} />
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
