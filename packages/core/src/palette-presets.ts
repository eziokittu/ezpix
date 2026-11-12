/** Original, reusable colour collections shared by editor and capture studio. */
export const PALETTE_PRESETS = {
  editorial: {name:'Editorial - 8',colors:['#13171c','#343c45','#697580','#9ba7b0','#dce0e2','#f8f4ec','#a66f55','#526e70']},
  jewel: {name:'Jewel - 8',colors:['#1c1930','#45325b','#762f56','#b85658','#e3a07c','#f5dcb3','#2c6b69','#438e86']},
  cinema: {name:'Cinema - 8',colors:['#10252b','#24525a','#5b8586','#a5bbb0','#f2deba','#d7a06c','#a56345','#5c3531']},
  mineral: {name:'Mineral - 8',colors:['#24252b','#4e535c','#7b8087','#abb1b2','#d4d8d3','#f1ece0','#b8a28b','#7d6a64']},
  candy: {name:'Candy - 8',colors:['#291b46','#784694','#d363ac','#ff9eb5','#ffd5cb','#fff3dc','#8bcbd4','#5b8db1']},
  earth: {name:'Earth - 8',colors:['#25251d','#514f36','#7a7951','#a8a16c','#d2c49a','#f2e4c8','#a86848','#6a3e32']},
  glacier: {name:'Glacier - 8',colors:['#152840','#244c68','#387d99','#6cabb8','#a6d4d1','#e3f2e9','#aaa9c9','#6c6889']},
  sunset: {name:'Sunset - 8',colors:['#251d4a','#563066','#a64975','#dc6582','#f59085','#ffbd91','#ffddb1','#fff3d1']},
  pop: {name:'Pop - 8',colors:['#18132b','#f63662','#ff9b24','#ffe658','#4de2a8','#2eabef','#905cf2','#ffffff']},
  ink: {name:'Ink - 4',colors:['#171725','#555166','#b6adbf','#faf4ea']},
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
