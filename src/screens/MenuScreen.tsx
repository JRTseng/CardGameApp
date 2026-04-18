interface Props {
  onSolo: () => void;
  onOnline: () => void;
}

export default function MenuScreen({ onSolo, onOnline }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-amber-950/10 to-stone-950 flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-amber-400 tracking-wider mb-3" style={{ fontFamily: 'serif' }}>
          三國決殺
        </h1>
        <p className="text-amber-600 text-xl">— 亂世英雄，沙場征戰 —</p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={onSolo}
          className="w-full py-5 text-xl font-bold rounded-2xl bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white shadow-lg hover:shadow-amber-500/30 transition-all border border-amber-500"
        >
          ⚔️ 單人遊玩
          <div className="text-sm font-normal text-amber-200 mt-1">對戰 3 個 AI</div>
        </button>

        <button
          onClick={onOnline}
          className="w-full py-5 text-xl font-bold rounded-2xl bg-gradient-to-r from-blue-800 to-blue-700 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg hover:shadow-blue-500/30 transition-all border border-blue-500"
        >
          🌐 線上多人
          <div className="text-sm font-normal text-blue-200 mt-1">建立或加入房間</div>
        </button>
      </div>

      <div className="text-center text-gray-600 text-xs space-y-1 max-w-sm">
        <p>主公消滅反賊與內奸即勝 · 反賊擊殺主公即勝 · 內奸最後存活即勝</p>
      </div>
    </div>
  );
}
