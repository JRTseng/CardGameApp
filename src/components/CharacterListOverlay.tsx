import { ALL_CHARACTERS } from '../data/characters';

interface Props {
  onClose: () => void;
}

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

export default function CharacterListOverlay({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-40 bg-black/85 backdrop-blur-sm flex flex-col" onClick={onClose}>
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-amber-900/40 shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-amber-400 font-bold text-base">武將一覽（{ALL_CHARACTERS.length} 位）</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-sm px-2 py-1">✕ 關閉</button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3" onClick={e => e.stopPropagation()}>
        {(['wei', 'shu', 'wu', 'neutral'] as const).map(kingdom => {
          const chars = ALL_CHARACTERS.filter(c => c.kingdom === kingdom);
          return (
            <div key={kingdom} className="mb-5">
              <div className="text-xs text-gray-500 font-semibold tracking-widest uppercase mb-2 px-1">
                {KINGDOM_LABEL[kingdom]}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {chars.map(char => (
                  <div key={char.id} className={`border rounded-xl p-3 ${KINGDOM_COLOR[char.kingdom]}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-3xl">{char.portrait}</span>
                      <div>
                        <div className="text-white font-bold text-sm">{char.name}</div>
                        <div className="flex gap-0.5 mt-0.5">
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
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
