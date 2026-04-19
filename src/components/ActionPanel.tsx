import { useState, useEffect } from 'react';
import type { GameState, Card, Player } from '../types/game';
import type { GameAction } from '../game/engine';
import CardView from './CardView';
import { CARD_DESCRIPTIONS } from '../data/cards';
import { canPlayCard, cardCanBeSha, cardCanBeShan, needsTarget, attackRange } from '../game/rules';

interface Props {
  state: GameState;
  dispatch: (action: GameAction) => void;
  turnDeadline?: number | null;
}

function useCountdown(deadline: number | null | undefined): number | null {
  const [secsLeft, setSecsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!deadline) { setSecsLeft(null); return; }
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecsLeft(left);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [deadline]);
  return secsLeft;
}

export default function ActionPanel({ state, dispatch, turnDeadline }: Props) {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const isHumanTurn = currentPlayer.isHuman;
  const human = state.players.find(p => p.isHuman)!;
  const pa = state.pendingAction;
  const secsLeft = useCountdown(turnDeadline);

  // ─── Human must respond ───────────────────────────────────────────────────

  if (pa && pa.actorId === human.id) {
    let responseCards: Card[] = [];

    if (pa.type === 'respond_sha' || pa.type === 'respond_wanjian') {
      // 廖化 追襲：shanNeeded >= 99 → undodgeable, no response cards
      const undodgeable = pa.type === 'respond_sha' && (pa.shanNeeded ?? 0) >= 99;
      if (!undodgeable) {
        responseCards = human.character.id === 'daqiao' ? human.hand : human.hand.filter(c => cardCanBeShan(c, human));
      }
    } else if (pa.type === 'respond_nanman' || pa.type === 'respond_juedou') {
      responseCards = human.hand.filter(c => cardCanBeSha(c, human));
    }

    return (
      <div className="flex flex-col gap-3">
        <div className="bg-orange-900/50 border border-orange-500 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-orange-300 font-bold text-sm">⚔️ 需要回應</div>
            {secsLeft !== null && (
              <div className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${secsLeft <= 10 ? 'text-red-400 bg-red-950/60 animate-pulse' : 'text-yellow-400 bg-yellow-950/40'}`}>
                ⏱ {secsLeft}s
              </div>
            )}
          </div>
          <div className="text-white text-sm">{pa.message}</div>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {responseCards.map(card => (
            <CardView
              key={card.id}
              card={card}
              onClick={() => dispatch({ type: 'RESPOND_WITH_CARD', cardId: card.id })}
            />
          ))}
          {responseCards.length === 0 && (
            <div className="text-gray-500 text-sm py-2">無可用回應牌</div>
          )}
        </div>

        <button
          onClick={() => dispatch({ type: 'SKIP_RESPONSE' })}
          className="w-full py-2 bg-red-800 hover:bg-red-700 text-white rounded-lg font-bold transition-colors"
        >
          承受傷害
        </button>
      </div>
    );
  }

  // ─── Discard phase ────────────────────────────────────────────────────────

  if (state.phase === 'discard' && isHumanTurn) {
    return (
      <div className="flex flex-col gap-2">
        <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-3">
          <div className="text-yellow-300 font-bold text-sm">
            棄牌階段：還需棄置 {state.discardCount} 張牌
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {currentPlayer.hand.map(card => (
            <CardView
              key={card.id}
              card={card}
              onClick={() => dispatch({ type: 'DISCARD_CARD', cardId: card.id })}
            />
          ))}
        </div>
      </div>
    );
  }

  // ─── Human's play phase ───────────────────────────────────────────────────

  if (state.phase === 'play' && isHumanTurn && !pa) {
    const char = currentPlayer.character;
    const hasActiveSkill = char.skill.type === 'active' && !currentPlayer.skillUsed && currentPlayer.hand.length >= 2;

    return (
      <div className="flex flex-col gap-2">
        <div className="text-xs text-gray-400 mb-1 flex items-center gap-3 flex-wrap">
          {state.selectedCardId ? (
            <span className="text-yellow-300">✨ 已選擇牌，點選目標使用</span>
          ) : (
            <span>點選手牌使用</span>
          )}
          <span className="text-teal-400">攻距:{attackRange(currentPlayer, state.players)}</span>
          <span className="text-amber-400">{char.skill.name}</span>
          {secsLeft !== null && (
            <span className={`ml-auto font-mono font-bold px-2 py-0.5 rounded ${secsLeft <= 10 ? 'text-red-400 bg-red-950/60 animate-pulse' : 'text-yellow-400 bg-yellow-950/40'}`}>
              ⏱ {secsLeft}s
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {currentPlayer.hand.map(card => {
            const isPlayable = canPlayCard(card, currentPlayer, state);
            const isSelected = state.selectedCardId === card.id;
            let onClick: (() => void) | undefined;

            if (isSelected) {
              onClick = () => dispatch({ type: 'DESELECT_CARD' });
            } else if (isPlayable) {
              if (needsTarget(card, currentPlayer)) {
                onClick = () => dispatch({ type: 'SELECT_CARD', cardId: card.id });
              } else {
                onClick = () => dispatch({ type: 'PLAY_CARD_NO_TARGET', cardId: card.id });
              }
            }

            return (
              <CardView
                key={card.id}
                card={card}
                selected={isSelected}
                dimmed={!isPlayable && !isSelected}
                onClick={onClick}
              />
            );
          })}
          {currentPlayer.hand.length === 0 && (
            <div className="text-gray-500 text-sm py-4">手牌已空</div>
          )}
        </div>

        {/* Card description */}
        {state.selectedCardId && (() => {
          const sel = currentPlayer.hand.find(c => c.id === state.selectedCardId);
          const desc = sel ? CARD_DESCRIPTIONS[sel.type] : null;
          return desc ? (
            <div className="text-xs text-amber-300/80 bg-amber-950/40 rounded px-2 py-1 border border-amber-800/40">
              【{sel!.name}】{desc}
            </div>
          ) : null;
        })()}

        {/* Active skill panels */}
        {hasActiveSkill && char.id === 'sunquan' && (
          <ZhihengPanel player={currentPlayer} onConfirm={ids => dispatch({ type: 'SKILL_ZHIHENG', cardIds: ids })} />
        )}
        {hasActiveSkill && char.id === 'liubei' && (
          <GiveCardPanel
            player={currentPlayer}
            state={state}
            skillName="仁德"
            filterTarget={() => true}
            onConfirm={(tid, ids) => dispatch({ type: 'SKILL_GIVE_CARD', targetId: tid, cardIds: ids })}
          />
        )}
        {/* 黃蓋 苦肉 */}
        {char.id === 'huanggai' && !currentPlayer.skillUsed && currentPlayer.hp > 1 && (
          <button
            onClick={() => dispatch({ type: 'SKILL_KULOU' })}
            className="w-full py-2 bg-orange-800 hover:bg-orange-700 text-white rounded-lg text-sm font-bold border border-orange-600 transition-colors"
          >
            苦肉：失去1血，摸3張牌
          </button>
        )}

        {hasActiveSkill && char.id === 'sunshangxiang' && (
          <GiveCardPanel
            player={currentPlayer}
            state={state}
            skillName="結姻"
            filterTarget={p => p.character.gender === 'male'}
            onConfirm={(tid, ids) => dispatch({ type: 'SKILL_GIVE_CARD', targetId: tid, cardIds: ids })}
          />
        )}

        {/* 甘寧 奇襲 */}
        {char.id === 'ganning' && !currentPlayer.skillUsed && currentPlayer.hand.length >= 1 && (
          <QixiPanel
            player={currentPlayer}
            state={state}
            onConfirm={(tid, cid) => dispatch({ type: 'SKILL_QIXI', targetId: tid, cardId: cid })}
          />
        )}

        {/* 龐統 落鳳 */}
        {char.id === 'pangtong' && !currentPlayer.skillUsed && currentPlayer.hand.length >= 3 && (
          <LuofengPanel player={currentPlayer} onConfirm={ids => dispatch({ type: 'SKILL_LUOFENG', cardIds: ids })} />
        )}

        {/* 魯肅 好施 */}
        {char.id === 'lusu' && !currentPlayer.skillUsed && currentPlayer.hand.length >= 1 && (
          <HaoshiPanel
            player={currentPlayer}
            state={state}
            onConfirm={(tid, cid) => dispatch({ type: 'SKILL_HAOSHI', targetId: tid, cardId: cid })}
          />
        )}

        <button
          onClick={() => dispatch({ type: 'END_PLAY_PHASE' })}
          className="w-full py-2 bg-amber-800 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors border border-amber-600"
        >
          結束出牌
        </button>
      </div>
    );
  }

  // ─── Waiting ──────────────────────────────────────────────────────────────

  const actingPlayer = pa
    ? state.players.find(p => p.id === pa.actorId)
    : currentPlayer;

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="text-gray-400 text-sm animate-pulse">
        等待 {actingPlayer?.name ?? 'AI'} 行動...
      </div>
      <div className="flex flex-wrap gap-1 justify-center opacity-50">
        {human.hand.map(card => (
          <CardView key={card.id} card={card} small />
        ))}
      </div>
    </div>
  );
}

// ─── Skill sub-panels ─────────────────────────────────────────────────────────

function ZhihengPanel({ player, onConfirm }: { player: Player; onConfirm: (ids: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="w-full border border-teal-600 rounded-lg p-2 bg-teal-950/50">
      <div className="text-teal-300 text-xs font-bold mb-1">孫權 制衡 — 棄牌換牌</div>
      <div className="flex flex-wrap gap-1 mb-2">
        {player.hand.map(c => (
          <CardView key={c.id} card={c} small selected={selected.includes(c.id)} onClick={() => toggle(c.id)} />
        ))}
      </div>
      <button
        disabled={selected.length === 0}
        onClick={() => { onConfirm(selected); setSelected([]); }}
        className="w-full py-1 bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white rounded text-xs font-bold"
      >
        棄 {selected.length} 摸 {selected.length}
      </button>
    </div>
  );
}

function QixiPanel({ player, state, onConfirm }: {
  player: Player;
  state: GameState;
  onConfirm: (targetId: number, cardId: string) => void;
}) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const targets = state.players.filter(p => p.isAlive && p.id !== player.id && p.hand.length > 0);
  if (targets.length === 0) return null;

  return (
    <div className="w-full border border-cyan-600 rounded-lg p-2 bg-cyan-950/50">
      <div className="text-cyan-300 text-xs font-bold mb-1">甘寧 奇襲 — 棄1牌奪目標1牌</div>
      <div className="flex gap-1 mb-1 flex-wrap">
        {targets.map(t => (
          <button
            key={t.id}
            onClick={() => setTargetId(t.id)}
            className={`text-xs px-2 py-1 rounded border ${targetId === t.id ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-cyan-900 border-cyan-700 text-cyan-300'}`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {player.hand.map(c => (
          <CardView key={c.id} card={c} small selected={selectedCard === c.id} onClick={() => setSelectedCard(c.id)} />
        ))}
      </div>
      <button
        disabled={!selectedCard || targetId === null}
        onClick={() => { if (selectedCard && targetId !== null) { onConfirm(targetId, selectedCard); setSelectedCard(null); setTargetId(null); } }}
        className="w-full py-1 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white rounded text-xs font-bold"
      >
        奇襲（棄1牌）
      </button>
    </div>
  );
}

function LuofengPanel({ player, onConfirm }: { player: Player; onConfirm: (ids: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="w-full border border-orange-600 rounded-lg p-2 bg-orange-950/50">
      <div className="text-orange-300 text-xs font-bold mb-1">龐統 落鳳 — 棄3牌摸4牌</div>
      <div className="flex flex-wrap gap-1 mb-2">
        {player.hand.map(c => (
          <CardView key={c.id} card={c} small selected={selected.includes(c.id)} onClick={() => toggle(c.id)} />
        ))}
      </div>
      <button
        disabled={selected.length < 3}
        onClick={() => { onConfirm(selected.slice(0, 3)); setSelected([]); }}
        className="w-full py-1 bg-orange-700 hover:bg-orange-600 disabled:opacity-40 text-white rounded text-xs font-bold"
      >
        落鳳（選3張棄置）
      </button>
    </div>
  );
}

function HaoshiPanel({ player, state, onConfirm }: {
  player: Player;
  state: GameState;
  onConfirm: (targetId: number, cardId: string) => void;
}) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const targets = state.players.filter(p => p.isAlive && p.id !== player.id);
  if (targets.length === 0) return null;

  return (
    <div className="w-full border border-emerald-600 rounded-lg p-2 bg-emerald-950/50">
      <div className="text-emerald-300 text-xs font-bold mb-1">魯肅 好施 — 給1牌並摸1牌</div>
      <div className="flex gap-1 mb-1 flex-wrap">
        {targets.map(t => (
          <button
            key={t.id}
            onClick={() => setTargetId(t.id)}
            className={`text-xs px-2 py-1 rounded border ${targetId === t.id ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-emerald-900 border-emerald-700 text-emerald-300'}`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {player.hand.map(c => (
          <CardView key={c.id} card={c} small selected={selectedCard === c.id} onClick={() => setSelectedCard(c.id)} />
        ))}
      </div>
      <button
        disabled={!selectedCard || targetId === null}
        onClick={() => { if (selectedCard && targetId !== null) { onConfirm(targetId, selectedCard); setSelectedCard(null); setTargetId(null); } }}
        className="w-full py-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white rounded text-xs font-bold"
      >
        好施（給1張牌）
      </button>
    </div>
  );
}

function GiveCardPanel({
  player, state, skillName, filterTarget, onConfirm,
}: {
  player: Player;
  state: GameState;
  skillName: string;
  filterTarget: (p: Player) => boolean;
  onConfirm: (targetId: number, cardIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [targetId, setTargetId] = useState<number | null>(null);
  const targets = state.players.filter(p => p.isAlive && p.id !== player.id && filterTarget(p));
  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  if (targets.length === 0) return null;

  return (
    <div className="w-full border border-green-600 rounded-lg p-2 bg-green-950/50">
      <div className="text-green-300 text-xs font-bold mb-1">{skillName} — 給予2張牌</div>
      <div className="flex gap-1 mb-1 flex-wrap">
        {targets.map(t => (
          <button
            key={t.id}
            onClick={() => setTargetId(t.id)}
            className={`text-xs px-2 py-1 rounded border ${targetId === t.id ? 'bg-green-600 border-green-400 text-white' : 'bg-green-900 border-green-700 text-green-300'}`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {player.hand.map(c => (
          <CardView key={c.id} card={c} small selected={selected.includes(c.id)} onClick={() => toggle(c.id)} />
        ))}
      </div>
      <button
        disabled={selected.length < 2 || targetId === null}
        onClick={() => { if (targetId !== null) { onConfirm(targetId, selected.slice(0, 2)); setSelected([]); setTargetId(null); } }}
        className="w-full py-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white rounded text-xs font-bold"
      >
        {skillName}（選2張）
      </button>
    </div>
  );
}
