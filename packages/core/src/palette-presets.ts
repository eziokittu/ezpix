/** Original, reusable colour collections shared by editor and capture studio. */
export const PALETTE_PRESETS = {
  pocket: { name: 'Pocket · 4', colors: ['#0f380f','#306230','#8bac0f','#9bbc0f'] },
  neon: { name: 'Neon · 8', colors: ['#0a0008','#39ff14','#a855f7','#ffd700','#f0e6ff','#ff647c','#49bfff','#6042a6'] },
  graphite: { name: 'Graphite · 8', colors: ['#161b22','#30363d','#484f58','#6e7681','#8b949e','#b1bac4','#d0d7de','#f0f6fc'] },
  dusk: { name: 'Dusk · 8', colors: ['#211d35','#413353','#644567','#956081','#c38191','#e8ac9d','#f3d4b0','#fff0d5'] },
  coastal: { name: 'Coastal · 8', colors: ['#142c46','#225777','#368ca0','#6db9ad','#afdbc0','#f1e6bb','#d8b177','#a66c51'] },
  woodland: { name: 'Woodland · 8', colors: ['#1c2826','#344a38','#57734a','#859855','#b7b875','#e4d4a3','#ad855f','#695345'] },
  ember: { name: 'Ember · 8', colors: ['#251e2b','#4c2b3a','#803b45','#b85546','#de7d4c','#f3ad62','#ffda8a','#fff1c1'] },
  arcade: { name: 'Arcade · 16', colors: ['#15192d','#34305a','#59428b','#8d5db5','#cf7bc2','#f1aac9','#f4d6d5','#fff1de','#2d5963','#368884','#71bba1','#b8d5a0','#e6c86e','#d58d51','#ab574a','#673d48'] },
} as const;
export type PalettePreset = keyof typeof PALETTE_PRESETS;
