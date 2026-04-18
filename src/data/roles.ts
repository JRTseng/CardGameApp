import type { Role } from '../types/game';

// Standard Sanguosha balanced role distribution (2–12 players)
const ROLE_TABLE: Role[][] = [
  [],                                                                                                                                       // 0
  [],                                                                                                                                       // 1
  ['lord', 'rebel'],                                                                                                                        // 2
  ['lord', 'rebel', 'spy'],                                                                                                                 // 3
  ['lord', 'loyalist', 'rebel', 'spy'],                                                                                                    // 4
  ['lord', 'loyalist', 'rebel', 'rebel', 'spy'],                                                                                           // 5
  ['lord', 'loyalist', 'rebel', 'rebel', 'rebel', 'spy'],                                                                                  // 6
  ['lord', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'spy'],                                                                     // 7
  ['lord', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'rebel', 'spy'],                                                            // 8
  ['lord', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'rebel', 'spy', 'spy'],                                                    // 9
  ['lord', 'loyalist', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'rebel', 'spy', 'spy'],                                        // 10
  ['lord', 'loyalist', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'rebel', 'rebel', 'spy', 'spy'],                               // 11
  ['lord', 'loyalist', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'rebel', 'rebel', 'rebel', 'spy', 'spy'],                      // 12
  ['lord', 'loyalist', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'rebel', 'rebel', 'rebel', 'rebel', 'spy', 'spy'],             // 13
  ['lord', 'loyalist', 'loyalist', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'rebel', 'rebel', 'rebel', 'rebel', 'spy', 'spy'], // 14
  ['lord', 'loyalist', 'loyalist', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'rebel', 'rebel', 'rebel', 'rebel', 'rebel', 'spy', 'spy'], // 15
];

export function getRolesForCount(n: number): Role[] {
  const clamped = Math.max(2, Math.min(15, n));
  return [...ROLE_TABLE[clamped]];
}

export const ROLE_DIST_LABEL: Record<number, string> = {
  2:  '主公×1 反賊×1',
  3:  '主公×1 反賊×1 內奸×1',
  4:  '主公×1 忠臣×1 反賊×1 內奸×1',
  5:  '主公×1 忠臣×1 反賊×2 內奸×1',
  6:  '主公×1 忠臣×1 反賊×3 內奸×1',
  7:  '主公×1 忠臣×2 反賊×3 內奸×1',
  8:  '主公×1 忠臣×2 反賊×4 內奸×1',
  9:  '主公×1 忠臣×2 反賊×4 內奸×2',
  10: '主公×1 忠臣×3 反賊×4 內奸×2',
  11: '主公×1 忠臣×3 反賊×5 內奸×2',
  12: '主公×1 忠臣×3 反賊×6 內奸×2',
  13: '主公×1 忠臣×3 反賊×7 內奸×2',
  14: '主公×1 忠臣×4 反賊×7 內奸×2',
  15: '主公×1 忠臣×4 反賊×8 內奸×2',
};
