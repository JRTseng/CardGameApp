import { useEffect, useRef } from 'react';

interface Props {
  log: string[];
  deckCount: number;
  discardCount: number;
  round: number;
}

export default function GameLog({ log, deckCount, discardCount, round }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex gap-3 text-xs text-gray-400 bg-black/30 rounded p-2">
        <span>第 {round} 輪</span>
        <span>🃏 牌堆: {deckCount}</span>
        <span>🗑 棄牌: {discardCount}</span>
      </div>

      <div className="bg-black/40 rounded-lg border border-amber-900/50 p-2 h-48 overflow-y-auto text-xs space-y-1">
        {log.map((entry, i) => {
          let color = 'text-gray-300';
          if (entry.includes('受到')) color = 'text-red-300';
          else if (entry.includes('使用【殺') || entry.includes('使用【火殺')) color = 'text-orange-300';
          else if (entry.includes('使用【桃') || entry.includes('回復')) color = 'text-green-300';
          else if (entry.includes('陣亡')) color = 'text-red-500 font-bold';
          else if (entry.includes('🎉') || entry.includes('獲勝')) color = 'text-yellow-300 font-bold';
          else if (entry.includes('閃避') || entry.includes('防禦') || entry.includes('抵擋')) color = 'text-blue-300';
          else if (entry.includes('摸') || entry.includes('棄置')) color = 'text-purple-300';
          else if (entry.startsWith('──')) color = 'text-amber-400 font-semibold';
          else if (entry.includes('發起【決鬥')) color = 'text-orange-400';

          return (
            <div key={i} className={color}>
              <span className="text-gray-600 mr-1">{i + 1}.</span>
              {entry}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
