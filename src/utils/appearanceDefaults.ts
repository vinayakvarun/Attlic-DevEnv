/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Assessment Appearance & Customization Studio Defaults
 * 10 Carefully Curated Dark-Background Fruit-Inspired Themes
 */

import type {
  AssessmentAppearance,
  PredefinedTheme,
  AppearanceColors,
  AppearanceTypography,
  AppearanceLayout,
  AppearanceBranding,
  AppearanceCandidateExperience,
  FontSizeScale,
} from '../types/index.ts';

export const DEFAULT_PREMADE_THEME_KEYS: PredefinedTheme[] = [
  'default_white_mono',
  'default_black_mono',
  'default_dark_grey',
  'default_light_grey',
];

export const FRUIT_THEME_KEYS: PredefinedTheme[] = [
  'kiwi',
  'coconut',
  'banana',
  'litchi',
  'orange',
  'plum',
  'peanut',
  'blueberry',
  'dragonfruit',
  'pomegranate',
  'mango',
  'papaya',
  'guava',
  'passionfruit',
  'watermelon',
  'avocado',
  'fig',
  'cherry',
  'blackberry',
  'raspberry',
  'cranberry',
  'mulberry',
  'starfruit',
  'persimmon',
  'apricot',
  'peach',
  'nectarine',
  'grapefruit',
  'lime',
  'lemon',
  'tangerine',
  'yuzu',
  'kumquat',
  'jackfruit',
  'durian',
  'rambutan',
  'mangosteen',
  'acai',
  'elderberry',
  'gooseberry',
];

export interface ThemePresetMeta {
  name: string;
  fruit: string;
  badge: string;
  description: string;
  colors: AppearanceColors;
}

export const THEME_PRESETS: Record<PredefinedTheme, ThemePresetMeta> = {
  default_white_mono: {
    name: 'Default White Mono',
    fruit: 'White Mono',
    badge: 'Default #1 • Orange Accent',
    description: 'Crisp pure white monochrome canvas (#FFFFFF) paired with clean black typography and default pastel-orange accents.',
    colors: {
      background: '#ffffff',
      cardBackground: '#f8f9fa',
      secondary: '#e5e7eb',
      primary: '#f08a43',
      buttonPrimary: '#e07830',
      accent: '#ffb37b',
      timerColor: '#d96b27',
      progressIndicator: '#f08a43',
      textMain: '#111113',
      textSecondary: '#52525b',
    },
  },
  default_black_mono: {
    name: 'Default Black Mono',
    fruit: 'Black Mono',
    badge: 'Default #2 • Orange Accent',
    description: 'Pure pitch-black monochrome canvas (#050506) paired with crisp white typography and default pastel-orange accents.',
    colors: {
      background: '#050506',
      cardBackground: '#0e0e10',
      secondary: '#1c1c20',
      primary: '#ffb37b',
      buttonPrimary: '#f08a43',
      accent: '#ffd0a8',
      timerColor: '#ffb37b',
      progressIndicator: '#ffb37b',
      textMain: '#ffffff',
      textSecondary: '#a1a1aa',
    },
  },
  default_dark_grey: {
    name: 'Default Dark Grey',
    fruit: 'Dark Grey',
    badge: 'Default #3 • Orange Accent',
    description: 'Balanced charcoal dark-grey workspace (#141417) with elevated slate-grey cards (#1E1E24) and default pastel-orange accents.',
    colors: {
      background: '#141417',
      cardBackground: '#1e1e24',
      secondary: '#2c2c34',
      primary: '#ffb37b',
      buttonPrimary: '#f08a43',
      accent: '#ffcfa3',
      timerColor: '#ffb37b',
      progressIndicator: '#f08a43',
      textMain: '#f4f4f5',
      textSecondary: '#a1a1aa',
    },
  },
  default_light_grey: {
    name: 'Default Light Grey',
    fruit: 'Light Grey',
    badge: 'Default #4 • Orange Accent',
    description: 'Soft architectural light-grey surface (#F1F3F5) with crisp white cards (#FFFFFF), charcoal text, and default pastel-orange accents.',
    colors: {
      background: '#f1f3f5',
      cardBackground: '#ffffff',
      secondary: '#e2e5e9',
      primary: '#f08a43',
      buttonPrimary: '#df742b',
      accent: '#ffb37b',
      timerColor: '#c85e1a',
      progressIndicator: '#f08a43',
      textMain: '#18181b',
      textSecondary: '#52525b',
    },
  },
  kiwi: {
    name: 'Kiwi Emerald',
    fruit: 'Kiwi',
    badge: 'ATTLIC Signature',
    description: 'Deep botanical forest-jade dark canvas paired with luminous kiwi-mint (#4CBBA1) and zesty lime accents.',
    colors: {
      background: '#071411',
      cardBackground: '#0d211c',
      secondary: '#143029',
      primary: '#4cbba1',
      buttonPrimary: '#359e86',
      accent: '#a3e635',
      timerColor: '#50e3c2',
      progressIndicator: '#4cbba1',
      textMain: '#f0fdf9',
      textSecondary: '#8ce0cc',
    },
  },
  coconut: {
    name: 'Toasted Coconut',
    fruit: 'Coconut',
    badge: 'Warm Husk Dark',
    description: 'Rich dark roasted coconut-husk umber backdrop with creamy coconut-milk ivory and golden caramel highlights.',
    colors: {
      background: '#14100d',
      cardBackground: '#1e1814',
      secondary: '#2b221c',
      primary: '#e6ccb2',
      buttonPrimary: '#b08968',
      accent: '#ddb892',
      timerColor: '#f5ebe1',
      progressIndicator: '#d4a373',
      textMain: '#faf5f0',
      textSecondary: '#c9b7a7',
    },
  },
  banana: {
    name: 'Sunlit Banana',
    fruit: 'Banana',
    badge: 'Midnight Gold',
    description: 'Deep charcoal-bronze night canvas with high-contrast sunlit banana yellow (#FACC15) and warm honey amber.',
    colors: {
      background: '#121007',
      cardBackground: '#1c180b',
      secondary: '#292310',
      primary: '#facc15',
      buttonPrimary: '#ca8a04',
      accent: '#fde047',
      timerColor: '#fbbf24',
      progressIndicator: '#facc15',
      textMain: '#fefce8',
      textSecondary: '#e5d283',
    },
  },
  litchi: {
    name: 'Velvet Litchi',
    fruit: 'Litchi',
    badge: 'Crimson Nocturne',
    description: 'Deep dark wine-bordeaux night backdrop with vivid litchi rose-crimson (#F43F5E) and soft pearl-pink typography.',
    colors: {
      background: '#16080d',
      cardBackground: '#230d15',
      secondary: '#331320',
      primary: '#f43f5e',
      buttonPrimary: '#e11d48',
      accent: '#fb7185',
      timerColor: '#fda4af',
      progressIndicator: '#f43f5e',
      textMain: '#fff1f2',
      textSecondary: '#f9a8b8',
    },
  },
  orange: {
    name: 'Blood Orange',
    fruit: 'Orange',
    badge: 'Tangerine Dusk',
    description: 'Deep volcanic citrus-peel dark slate with zesty blood orange (#F97316), mandarin coral, and solar marigold.',
    colors: {
      background: '#140a05',
      cardBackground: '#211109',
      secondary: '#301a0e',
      primary: '#f97316',
      buttonPrimary: '#ea580c',
      accent: '#fbbf24',
      timerColor: '#fb923c',
      progressIndicator: '#f97316',
      textMain: '#fff7ed',
      textSecondary: '#fdba74',
    },
  },
  plum: {
    name: 'Black Plum',
    fruit: 'Plum',
    badge: 'Royal Aubergine',
    description: 'Deep midnight aubergine dark canvas with luminous velvet plum (#A855F7), electric lavender, and orchid glow.',
    colors: {
      background: '#0f071a',
      cardBackground: '#190d2b',
      secondary: '#261440',
      primary: '#a855f7',
      buttonPrimary: '#9333ea',
      accent: '#e879f9',
      timerColor: '#c084fc',
      progressIndicator: '#a855f7',
      textMain: '#faf5ff',
      textSecondary: '#d8b4fe',
    },
  },
  peanut: {
    name: 'Roasted Peanut',
    fruit: 'Peanut',
    badge: 'Espresso Praline',
    description: 'Deep dark roasted mocha-mahogany surfaces paired with warm peanut amber (#F59E0B) and toasted almond tones.',
    colors: {
      background: '#130d08',
      cardBackground: '#1e150d',
      secondary: '#2c1f14',
      primary: '#f59e0b',
      buttonPrimary: '#d97706',
      accent: '#fbbf24',
      timerColor: '#fcd34d',
      progressIndicator: '#f59e0b',
      textMain: '#fef3c7',
      textSecondary: '#d6b07a',
    },
  },
  blueberry: {
    name: 'Wild Blueberry',
    fruit: 'Blueberry',
    badge: 'Nordic Sapphire',
    description: 'Deep midnight Nordic navy-slate backdrop with crisp wild blueberry cobalt (#3B82F6) and glacier sky highlights.',
    colors: {
      background: '#070d19',
      cardBackground: '#0e172a',
      secondary: '#172542',
      primary: '#3b82f6',
      buttonPrimary: '#2563eb',
      accent: '#38bdf8',
      timerColor: '#60a5fa',
      progressIndicator: '#3b82f6',
      textMain: '#f0f7ff',
      textSecondary: '#93c5fd',
    },
  },
  dragonfruit: {
    name: 'Dragonfruit Neon',
    fruit: 'Dragonfruit',
    badge: 'Pitaya Cyber-Dusk',
    description: 'Deep pitaya obsidian dark canvas with electric dragonfruit magenta (#EC4899) and tropical mint-leaf contrast.',
    colors: {
      background: '#130714',
      cardBackground: '#1f0c21',
      secondary: '#2e1332',
      primary: '#ec4899',
      buttonPrimary: '#db2777',
      accent: '#2dd4bf',
      timerColor: '#f472b6',
      progressIndicator: '#ec4899',
      textMain: '#fdf2f8',
      textSecondary: '#f9a8d4',
    },
  },
  pomegranate: {
    name: 'Pomegranate Ruby',
    fruit: 'Pomegranate',
    badge: 'Garnet Ember',
    description: 'Deep dark garnet-charcoal background with jewel-toned pomegranate ruby (#EF4444) and warm rose-gold details.',
    colors: {
      background: '#140707',
      cardBackground: '#210c0c',
      secondary: '#311212',
      primary: '#ef4444',
      buttonPrimary: '#dc2626',
      accent: '#f87171',
      timerColor: '#fca5a5',
      progressIndicator: '#ef4444',
      textMain: '#fef2f2',
      textSecondary: '#fca5a5',
    },
  },
  mango: {
    name: 'Alphonso Mango',
    fruit: 'Mango',
    badge: 'Saffron Nectar',
    description: 'Deep saffron-bark night canvas paired with radiant Alphonso mango gold (#FFB703) and warm sun-ripened amber.',
    colors: {
      background: '#161004',
      cardBackground: '#231a07',
      secondary: '#33260b',
      primary: '#ffb703',
      buttonPrimary: '#d99100',
      accent: '#ffd166',
      timerColor: '#ffca3a',
      progressIndicator: '#ffb703',
      textMain: '#fffbeb',
      textSecondary: '#f3cf7a',
    },
  },
  papaya: {
    name: 'Tropical Papaya',
    fruit: 'Papaya',
    badge: 'Sunset Melba',
    description: 'Rich volcanic terracotta dark backdrop with lush papaya coral (#FF7B54) and warm apricot highlights.',
    colors: {
      background: '#170c08',
      cardBackground: '#24130d',
      secondary: '#351d14',
      primary: '#ff7b54',
      buttonPrimary: '#e05a33',
      accent: '#ffb26b',
      timerColor: '#ff9b73',
      progressIndicator: '#ff7b54',
      textMain: '#fff5f0',
      textSecondary: '#f7b6a1',
    },
  },
  guava: {
    name: 'Pink Guava',
    fruit: 'Guava',
    badge: 'Tropical Blossom',
    description: 'Deep tropical rosewood night canvas with vibrant pink guava (#FF6B8B) and fresh botanical leaf accents.',
    colors: {
      background: '#17090e',
      cardBackground: '#240f17',
      secondary: '#361723',
      primary: '#ff6b8b',
      buttonPrimary: '#e0486b',
      accent: '#7ae582',
      timerColor: '#ff8fa8',
      progressIndicator: '#ff6b8b',
      textMain: '#fff0f4',
      textSecondary: '#f5adc0',
    },
  },
  passionfruit: {
    name: 'Passionfruit Maracuja',
    fruit: 'Passionfruit',
    badge: 'Electric Maracuja',
    description: 'Deep dark maracuja-rind purple canvas with glowing passionfruit violet (#C77DFF) and citrus pulp gold.',
    colors: {
      background: '#12081c',
      cardBackground: '#1c0d2c',
      secondary: '#2b1542',
      primary: '#c77dff',
      buttonPrimary: '#9d4edd',
      accent: '#ffbe0b',
      timerColor: '#e0aaff',
      progressIndicator: '#c77dff',
      textMain: '#f9f2ff',
      textSecondary: '#d4a5fa',
    },
  },
  watermelon: {
    name: 'Watermelon Crush',
    fruit: 'Watermelon',
    badge: 'Melon & Rind',
    description: 'Deep dark rind-emerald slate paired with juicy watermelon crimson (#FF4D6D) and crisp mint-rind highlights.',
    colors: {
      background: '#0a1511',
      cardBackground: '#11221b',
      secondary: '#1a3329',
      primary: '#ff4d6d',
      buttonPrimary: '#d93252',
      accent: '#52b788',
      timerColor: '#ff758f',
      progressIndicator: '#ff4d6d',
      textMain: '#fff0f3',
      textSecondary: '#a3d9c2',
    },
  },
  avocado: {
    name: 'Hass Avocado',
    fruit: 'Avocado',
    badge: 'Botanical Sage',
    description: 'Deep dark pebble-olive canvas with velvety avocado sage (#84A98C) and warm pistachio cream.',
    colors: {
      background: '#0b130e',
      cardBackground: '#132018',
      secondary: '#1d3024',
      primary: '#84a98c',
      buttonPrimary: '#52796f',
      accent: '#b7e4c7',
      timerColor: '#a3c9a8',
      progressIndicator: '#84a98c',
      textMain: '#f2f7f4',
      textSecondary: '#b0cbb7',
    },
  },
  fig: {
    name: 'Mediterranean Fig',
    fruit: 'Fig',
    badge: 'Byzantine Dusk',
    description: 'Deep twilight fig-skin plum canvas with dusty rose-mulberry (#B56576) and warm honey-seed accents.',
    colors: {
      background: '#140b11',
      cardBackground: '#20121c',
      secondary: '#301b2a',
      primary: '#b56576',
      buttonPrimary: '#96495a',
      accent: '#eaac8b',
      timerColor: '#d88c9a',
      progressIndicator: '#b56576',
      textMain: '#fbf2f5',
      textSecondary: '#d1a3ae',
    },
  },
  cherry: {
    name: 'Morello Cherry',
    fruit: 'Cherry',
    badge: 'Dark Amarena',
    description: 'Rich black-forest cherry noir backdrop with intense Morello cherry red (#D90429) and ruby cordial luster.',
    colors: {
      background: '#150509',
      cardBackground: '#220910',
      secondary: '#330e18',
      primary: '#d90429',
      buttonPrimary: '#b00220',
      accent: '#ff4d6d',
      timerColor: '#ff758f',
      progressIndicator: '#d90429',
      textMain: '#fff0f3',
      textSecondary: '#f294a5',
    },
  },
  blackberry: {
    name: 'Bramble Blackberry',
    fruit: 'Blackberry',
    badge: 'Midnight Bramble',
    description: 'Deep bramble-indigo night canvas with electric blackberry violet-blue (#6366F1) and periwinkle frost.',
    colors: {
      background: '#090a1a',
      cardBackground: '#10122b',
      secondary: '#191d42',
      primary: '#6366f1',
      buttonPrimary: '#4f46e5',
      accent: '#818cf8',
      timerColor: '#a5b4fc',
      progressIndicator: '#6366f1',
      textMain: '#eef2ff',
      textSecondary: '#a5b4fc',
    },
  },
  raspberry: {
    name: 'Wild Raspberry',
    fruit: 'Raspberry',
    badge: 'Framboise Vivid',
    description: 'Deep dark berry-press canvas paired with vibrant wild raspberry (#E63976) and rose-sorbet highlights.',
    colors: {
      background: '#170710',
      cardBackground: '#250c19',
      secondary: '#371226',
      primary: '#e63976',
      buttonPrimary: '#c2235c',
      accent: '#ff70a6',
      timerColor: '#ff85b3',
      progressIndicator: '#e63976',
      textMain: '#fff0f6',
      textSecondary: '#f4a2bf',
    },
  },
  cranberry: {
    name: 'Nordic Cranberry',
    fruit: 'Cranberry',
    badge: 'Tart Carmine',
    description: 'Deep dark Nordic peat-burgundy canvas with crisp tart cranberry (#C9184A) and frosted berry highlights.',
    colors: {
      background: '#16060b',
      cardBackground: '#230a12',
      secondary: '#34101c',
      primary: '#c9184a',
      buttonPrimary: '#a4133c',
      accent: '#ff4d6d',
      timerColor: '#ff758f',
      progressIndicator: '#c9184a',
      textMain: '#fff0f3',
      textSecondary: '#eba0b5',
    },
  },
  mulberry: {
    name: 'Silk Mulberry',
    fruit: 'Mulberry',
    badge: 'Imperial Orchid',
    description: 'Deep silk-loom dark violet canvas with regal mulberry purple (#9D4EDD) and soft lilac sheen.',
    colors: {
      background: '#11071b',
      cardBackground: '#1b0c2b',
      secondary: '#291340',
      primary: '#9d4edd',
      buttonPrimary: '#7b2cbf',
      accent: '#e0aaff',
      timerColor: '#c77dff',
      progressIndicator: '#9d4edd',
      textMain: '#f8f0ff',
      textSecondary: '#cfa5f0',
    },
  },
  starfruit: {
    name: 'Golden Starfruit',
    fruit: 'Starfruit',
    badge: 'Carambola Zest',
    description: 'Deep tropical night-moss canvas with luminous starfruit chartreuse (#B5E48C) and crisp citrus-lime glow.',
    colors: {
      background: '#0c1407',
      cardBackground: '#14210c',
      secondary: '#1e3213',
      primary: '#b5e48c',
      buttonPrimary: '#76c893',
      accent: '#d9ed92',
      timerColor: '#c7f9cc',
      progressIndicator: '#99d98c',
      textMain: '#f4fce8',
      textSecondary: '#b7e094',
    },
  },
  persimmon: {
    name: 'Fuyu Persimmon',
    fruit: 'Persimmon',
    badge: 'Autumn Cinnabar',
    description: 'Deep charred-wood dark canvas with blazing Fuyu persimmon cinnabar (#F35B04) and warm harvest gold.',
    colors: {
      background: '#180904',
      cardBackground: '#260f07',
      secondary: '#38170b',
      primary: '#f35b04',
      buttonPrimary: '#cc4b02',
      accent: '#f7b801',
      timerColor: '#ff8833',
      progressIndicator: '#f35b04',
      textMain: '#fff6f0',
      textSecondary: '#f5b087',
    },
  },
  apricot: {
    name: 'Velvet Apricot',
    fruit: 'Apricot',
    badge: 'Golden Nectar',
    description: 'Deep warm orchard-umber dark canvas with sunlit apricot nectar (#FF9F1C) and soft honeyed cream.',
    colors: {
      background: '#160e05',
      cardBackground: '#231709',
      secondary: '#33220e',
      primary: '#ff9f1c',
      buttonPrimary: '#e08200',
      accent: '#ffbf69',
      timerColor: '#ffb74d',
      progressIndicator: '#ff9f1c',
      textMain: '#fff8ed',
      textSecondary: '#f2c68a',
    },
  },
  peach: {
    name: 'Georgia Peach',
    fruit: 'Peach',
    badge: 'Soft Bellini',
    description: 'Deep velvet dusk-rosewood canvas with warm Georgia peach blush (#FF8FA3) and champagne-gold accents.',
    colors: {
      background: '#180c10',
      cardBackground: '#251319',
      secondary: '#361c25',
      primary: '#ff8fa3',
      buttonPrimary: '#e06c82',
      accent: '#ffb3c1',
      timerColor: '#ffccd5',
      progressIndicator: '#ff8fa3',
      textMain: '#fff5f7',
      textSecondary: '#f2b6c1',
    },
  },
  nectarine: {
    name: 'Sunburst Nectarine',
    fruit: 'Nectarine',
    badge: 'Radiant Vermilion',
    description: 'Deep volcanic ember dark backdrop with high-energy sunburst nectarine (#FF5400) and solar amber.',
    colors: {
      background: '#190803',
      cardBackground: '#270d06',
      secondary: '#391409',
      primary: '#ff5400',
      buttonPrimary: '#d94600',
      accent: '#ff9e00',
      timerColor: '#ff7933',
      progressIndicator: '#ff5400',
      textMain: '#fff4ed',
      textSecondary: '#f7a983',
    },
  },
  grapefruit: {
    name: 'Ruby Grapefruit',
    fruit: 'Grapefruit',
    badge: 'Pomelo Rose',
    description: 'Deep dark citrus-slate canvas with tangy ruby grapefruit pink (#FF5D8F) and sparkling zest highlights.',
    colors: {
      background: '#18080f',
      cardBackground: '#250d18',
      secondary: '#371424',
      primary: '#ff5d8f',
      buttonPrimary: '#d93d6e',
      accent: '#ff97b7',
      timerColor: '#ff85ab',
      progressIndicator: '#ff5d8f',
      textMain: '#fff0f5',
      textSecondary: '#f5a6bf',
    },
  },
  lime: {
    name: 'Key Lime',
    fruit: 'Key Lime',
    badge: 'Electric Zest',
    description: 'Deep rainforest-obsidian dark canvas with electrifying Key lime zest (#80ED99) and emerald mint.',
    colors: {
      background: '#06150c',
      cardBackground: '#0b2214',
      secondary: '#12331f',
      primary: '#80ed99',
      buttonPrimary: '#38b000',
      accent: '#b7efc5',
      timerColor: '#9ef01a',
      progressIndicator: '#57cc99',
      textMain: '#f0fff4',
      textSecondary: '#9ce2ad',
    },
  },
  lemon: {
    name: 'Amalfi Lemon',
    fruit: 'Lemon',
    badge: 'Citron Canary',
    description: 'Deep Mediterranean basalt-charcoal canvas with vivid Amalfi lemon citron (#FFEE32) and coastal gold.',
    colors: {
      background: '#141305',
      cardBackground: '#201e09',
      secondary: '#302d0e',
      primary: '#ffee32',
      buttonPrimary: '#d4c000',
      accent: '#fff775',
      timerColor: '#ffd100',
      progressIndicator: '#ffee32',
      textMain: '#fffff0',
      textSecondary: '#e8e087',
    },
  },
  tangerine: {
    name: 'Mandarin Tangerine',
    fruit: 'Tangerine',
    badge: 'Solar Clementine',
    description: 'Deep dark amber-slate canvas with vibrant mandarin tangerine (#FF8500) and luminous clementine glow.',
    colors: {
      background: '#170c03',
      cardBackground: '#241306',
      secondary: '#361d0a',
      primary: '#ff8500',
      buttonPrimary: '#d96e00',
      accent: '#ffaa00',
      timerColor: '#ff9e00',
      progressIndicator: '#ff8500',
      textMain: '#fff7ed',
      textSecondary: '#f5bd7d',
    },
  },
  yuzu: {
    name: 'Japanese Yuzu',
    fruit: 'Yuzu',
    badge: 'Hinoki & Citrus',
    description: 'Deep dark hinoki-cypress slate paired with aromatic Japanese yuzu gold (#E9C46A) andbamboo-teal accents.',
    colors: {
      background: '#0d1311',
      cardBackground: '#151f1c',
      secondary: '#202f2b',
      primary: '#e9c46a',
      buttonPrimary: '#2a9d8f',
      accent: '#f4a261',
      timerColor: '#e9c46a',
      progressIndicator: '#2a9d8f',
      textMain: '#f7f9f8',
      textSecondary: '#b8ccc6',
    },
  },
  kumquat: {
    name: 'Candied Kumquat',
    fruit: 'Kumquat',
    badge: 'Copper Citrus',
    description: 'Deep dark roasted-copper backdrop with warm candied kumquat (#E76F51) and spiced marmalade highlights.',
    colors: {
      background: '#170b08',
      cardBackground: '#24120e',
      secondary: '#361b15',
      primary: '#e76f51',
      buttonPrimary: '#c85538',
      accent: '#f4a261',
      timerColor: '#ee8972',
      progressIndicator: '#e76f51',
      textMain: '#fff4f0',
      textSecondary: '#e8afa0',
    },
  },
  jackfruit: {
    name: 'Artisan Jackfruit',
    fruit: 'Jackfruit',
    badge: 'Tropical Ochre',
    description: 'Deep dark forest-bark canvas with golden jackfruit pod ochre (#EAB308) and warm tropical olive.',
    colors: {
      background: '#131108',
      cardBackground: '#1f1b0d',
      secondary: '#2e2914',
      primary: '#eab308',
      buttonPrimary: '#b88a04',
      accent: '#a3e635',
      timerColor: '#facc15',
      progressIndicator: '#eab308',
      textMain: '#fefce8',
      textSecondary: '#dcd08a',
    },
  },
  durian: {
    name: 'Royal Durian',
    fruit: 'Durian',
    badge: 'Thorn & Custard',
    description: 'Deep thorny olive-charcoal dark canvas with rich durian lime-custard (#BEF264) and golden-husk highlights.',
    colors: {
      background: '#0f1508',
      cardBackground: '#17210d',
      secondary: '#233214',
      primary: '#bef264',
      buttonPrimary: '#65a30d',
      accent: '#fde047',
      timerColor: '#d9f99d',
      progressIndicator: '#84cc16',
      textMain: '#f7fee7',
      textSecondary: '#c5e394',
    },
  },
  rambutan: {
    name: 'Scarlet Rambutan',
    fruit: 'Rambutan',
    badge: 'Spiny Scarlet',
    description: 'Deep dark crimson-obsidian canvas with exotic scarlet rambutan (#FF2A55) and translucent pearl-nectar text.',
    colors: {
      background: '#18060a',
      cardBackground: '#260a10',
      secondary: '#380f18',
      primary: '#ff2a55',
      buttonPrimary: '#d4193f',
      accent: '#a3e635',
      timerColor: '#ff6685',
      progressIndicator: '#ff2a55',
      textMain: '#fff0f3',
      textSecondary: '#f59eb0',
    },
  },
  mangosteen: {
    name: 'Queen Mangosteen',
    fruit: 'Mangosteen',
    badge: 'Deep Claret',
    description: 'Deep royal claret-aubergine canvas with vibrant mangosteen fuchsia-plum (#C026D3) and snow-white pulp contrast.',
    colors: {
      background: '#150618',
      cardBackground: '#220a26',
      secondary: '#331039',
      primary: '#c026d3',
      buttonPrimary: '#a21caf',
      accent: '#f0abfc',
      timerColor: '#e879f9',
      progressIndicator: '#c026d3',
      textMain: '#fdf4ff',
      textSecondary: '#e5a8f0',
    },
  },
  acai: {
    name: 'Amazonian Acai',
    fruit: 'Acai',
    badge: 'Rainforest Berry',
    description: 'Deep Amazonian midnight-purple canvas with superfood acai berry violet (#7C3AED) and electric indigo.',
    colors: {
      background: '#0c0618',
      cardBackground: '#140a28',
      secondary: '#1f103d',
      primary: '#7c3aed',
      buttonPrimary: '#6d28d9',
      accent: '#a78bfa',
      timerColor: '#c4b5fd',
      progressIndicator: '#7c3aed',
      textMain: '#f5f3ff',
      textSecondary: '#bdb2fa',
    },
  },
  elderberry: {
    name: 'Alpine Elderberry',
    fruit: 'Elderberry',
    badge: 'Twilight Slate',
    description: 'Deep alpine-twilight slate canvas with cool elderberry periwinkle (#818CF8) and silver-mist typography.',
    colors: {
      background: '#090c1c',
      cardBackground: '#101530',
      secondary: '#182047',
      primary: '#818cf8',
      buttonPrimary: '#4f46e5',
      accent: '#38bdf8',
      timerColor: '#a5b4fc',
      progressIndicator: '#818cf8',
      textMain: '#f0f4ff',
      textSecondary: '#a8b8f0',
    },
  },
  gooseberry: {
    name: 'Cape Gooseberry',
    fruit: 'Gooseberry',
    badge: 'Physalis Teal',
    description: 'Deep dark ocean-lantern canvas with luminous gooseberry cyan-teal (#06B6D4) and golden physalis accents.',
    colors: {
      background: '#051318',
      cardBackground: '#092028',
      secondary: '#0f303c',
      primary: '#06b6d4',
      buttonPrimary: '#0891b2',
      accent: '#fbbf24',
      timerColor: '#22d3ee',
      progressIndicator: '#06b6d4',
      textMain: '#ecfeff',
      textSecondary: '#8ce0f0',
    },
  },
  // Legacy theme keys mapped cleanly to darkish fruit palettes
  dark: {
    name: 'Kiwi Emerald',
    fruit: 'Kiwi',
    badge: 'ATTLIC Signature',
    description: 'Deep botanical forest-jade dark canvas paired with luminous kiwi-mint (#4CBBA1).',
    colors: {
      background: '#071411',
      cardBackground: '#0d211c',
      secondary: '#143029',
      primary: '#4cbba1',
      buttonPrimary: '#359e86',
      accent: '#a3e635',
      timerColor: '#50e3c2',
      progressIndicator: '#4cbba1',
      textMain: '#f0fdf9',
      textSecondary: '#8ce0cc',
    },
  },
  light: {
    name: 'Toasted Coconut',
    fruit: 'Coconut',
    badge: 'Warm Husk Dark',
    description: 'Rich dark roasted coconut-husk umber backdrop with creamy coconut-milk ivory.',
    colors: {
      background: '#14100d',
      cardBackground: '#1e1814',
      secondary: '#2b221c',
      primary: '#e6ccb2',
      buttonPrimary: '#b08968',
      accent: '#ddb892',
      timerColor: '#f5ebe1',
      progressIndicator: '#d4a373',
      textMain: '#faf5f0',
      textSecondary: '#c9b7a7',
    },
  },
  minimal: {
    name: 'Wild Blueberry',
    fruit: 'Blueberry',
    badge: 'Nordic Sapphire',
    description: 'Deep midnight Nordic navy-slate backdrop with crisp wild blueberry cobalt.',
    colors: {
      background: '#070d19',
      cardBackground: '#0e172a',
      secondary: '#172542',
      primary: '#3b82f6',
      buttonPrimary: '#2563eb',
      accent: '#38bdf8',
      timerColor: '#60a5fa',
      progressIndicator: '#3b82f6',
      textMain: '#f0f7ff',
      textSecondary: '#93c5fd',
    },
  },
  professional: {
    name: 'Black Plum',
    fruit: 'Plum',
    badge: 'Royal Aubergine',
    description: 'Deep midnight aubergine dark canvas with luminous velvet plum.',
    colors: {
      background: '#0f071a',
      cardBackground: '#190d2b',
      secondary: '#261440',
      primary: '#a855f7',
      buttonPrimary: '#9333ea',
      accent: '#e879f9',
      timerColor: '#c084fc',
      progressIndicator: '#a855f7',
      textMain: '#faf5ff',
      textSecondary: '#d8b4fe',
    },
  },
  high_contrast: {
    name: 'Sunlit Banana',
    fruit: 'Banana',
    badge: 'Midnight Gold',
    description: 'Deep charcoal-bronze night canvas with high-contrast sunlit banana yellow.',
    colors: {
      background: '#121007',
      cardBackground: '#1c180b',
      secondary: '#292310',
      primary: '#facc15',
      buttonPrimary: '#ca8a04',
      accent: '#fde047',
      timerColor: '#fbbf24',
      progressIndicator: '#facc15',
      textMain: '#fefce8',
      textSecondary: '#e5d283',
    },
  },
};

/**
 * Curated quick-select swatches for the Color Customization tab in Appearance Studio.
 * Ensures backgrounds stay darkish and accents remain vibrant and readable.
 */
export const CURATED_COLOR_SWATCHES: Record<keyof AppearanceColors, string[]> = {
  background: [
    '#071411', // Kiwi Obsidian
    '#14100d', // Coconut Husk
    '#121007', // Banana Bronze
    '#16080d', // Litchi Wine
    '#140a05', // Blood Orange Dusk
    '#0f071a', // Black Plum Abyss
    '#130d08', // Roasted Peanut Mocha
    '#070d19', // Wild Blueberry Navy
    '#130714', // Dragonfruit Obsidian
    '#140707', // Pomegranate Garnet
  ],
  cardBackground: [
    '#0d211c', // Kiwi Card
    '#1e1814', // Coconut Card
    '#1c180b', // Banana Card
    '#230d15', // Litchi Card
    '#211109', // Orange Card
    '#190d2b', // Plum Card
    '#1e150d', // Peanut Card
    '#0e172a', // Blueberry Card
    '#1f0c21', // Dragonfruit Card
    '#210c0c', // Pomegranate Card
  ],
  secondary: [
    '#143029',
    '#2b221c',
    '#292310',
    '#331320',
    '#301a0e',
    '#261440',
    '#2c1f14',
    '#172542',
    '#2e1332',
    '#311212',
  ],
  primary: [
    '#4cbba1', // Kiwi Mint
    '#e6ccb2', // Coconut Cream
    '#facc15', // Banana Gold
    '#f43f5e', // Litchi Rose
    '#f97316', // Blood Orange
    '#a855f7', // Velvet Plum
    '#f59e0b', // Peanut Amber
    '#3b82f6', // Blueberry Cobalt
    '#ec4899', // Dragonfruit Pink
    '#ef4444', // Pomegranate Ruby
  ],
  buttonPrimary: [
    '#359e86',
    '#b08968',
    '#ca8a04',
    '#e11d48',
    '#ea580c',
    '#9333ea',
    '#d97706',
    '#2563eb',
    '#db2777',
    '#dc2626',
  ],
  accent: [
    '#a3e635',
    '#ddb892',
    '#fde047',
    '#fb7185',
    '#fbbf24',
    '#e879f9',
    '#fcd34d',
    '#38bdf8',
    '#2dd4bf',
    '#f87171',
  ],
  timerColor: [
    '#50e3c2',
    '#f5ebe1',
    '#fbbf24',
    '#fda4af',
    '#fb923c',
    '#c084fc',
    '#fcd34d',
    '#60a5fa',
    '#f472b6',
    '#fca5a5',
  ],
  progressIndicator: [
    '#4cbba1',
    '#d4a373',
    '#facc15',
    '#f43f5e',
    '#f97316',
    '#a855f7',
    '#f59e0b',
    '#3b82f6',
    '#ec4899',
    '#ef4444',
  ],
  textMain: [
    '#f0fdf9',
    '#faf5f0',
    '#fefce8',
    '#fff1f2',
    '#fff7ed',
    '#faf5ff',
    '#fef3c7',
    '#f0f7ff',
    '#fdf2f8',
    '#fef2f2',
  ],
  textSecondary: [
    '#8ce0cc',
    '#c9b7a7',
    '#e5d283',
    '#f9a8b8',
    '#fdba74',
    '#d8b4fe',
    '#d6b07a',
    '#93c5fd',
    '#f9a8d4',
    '#fca5a5',
  ],
};

export const DEFAULT_TYPOGRAPHY: AppearanceTypography = {
  fontFamily: 'sans',
  headingSize: 'lg',
  questionSize: 'md',
  optionSize: 'sm',
  generalTextSize: 'sm',
  lineSpacing: 'normal',
};

export const DEFAULT_LAYOUT: AppearanceLayout = {
  headerLayout: 'standard',
  questionCardDesign: 'bordered',
  sidebarVisibility: 'visible',
  questionNavigationPanel: 'palette',
  progressBar: 'bar',
  sectionNavigation: 'tabs',
  buttonAppearance: 'rounded-md',
  questionNumberVisibility: true,
  marksVisibility: true,
};

export const DEFAULT_BRANDING: AppearanceBranding = {
  showCompanyLogo: true,
  showWelcomeScreen: true,
  showTitleDisplay: true,
  welcomeMessage: 'Welcome to your verified placement examination. Please read the instructions carefully before launching the test.',
  footerBrandingText: 'Powered by ATTLIC assessment infrastructure • Assess. Evaluate. Select.',
};

export const DEFAULT_CANDIDATE_EXPERIENCE: AppearanceCandidateExperience = {
  showQuestionNumbers: true,
  showTotalQuestionCount: true,
  showQuestionMarks: true,
  showProgressPercentage: true,
  showAnswerStatus: true,
  showTimer: true,
  showSectionProgress: true,
};

export function getDefaultAppearance(companyName = 'ATTLIC'): AssessmentAppearance {
  return {
    theme: 'kiwi',
    colors: { ...THEME_PRESETS.kiwi.colors },
    typography: { ...DEFAULT_TYPOGRAPHY },
    layout: { ...DEFAULT_LAYOUT },
    branding: {
      ...DEFAULT_BRANDING,
      companyDisplayName: companyName,
    },
    candidateExperience: { ...DEFAULT_CANDIDATE_EXPERIENCE },
  };
}

export function applyThemeToAppearance(theme: PredefinedTheme, current?: AssessmentAppearance): AssessmentAppearance {
  const base = current ? { ...current } : getDefaultAppearance();
  const themePreset = THEME_PRESETS[theme] || THEME_PRESETS.kiwi;

  return {
    ...base,
    theme,
    colors: {
      ...themePreset.colors,
    },
  };
}

export const FONT_FAMILY_CLASSES: Record<string, string> = {
  sans: 'font-sans',
  serif: 'font-serif',
  mono: 'font-mono',
  roboto: 'font-sans font-normal',
  poppins: 'font-sans tracking-wide',
};

export const FONT_SIZE_CLASSES: Record<'heading' | 'question' | 'option' | 'general', Record<FontSizeScale, string>> = {
  heading: {
    sm: 'text-base font-bold',
    md: 'text-lg font-bold',
    lg: 'text-xl font-bold',
    xl: 'text-2xl font-bold',
  },
  question: {
    sm: 'text-xs font-semibold',
    md: 'text-sm font-semibold',
    lg: 'text-base font-semibold',
    xl: 'text-lg font-semibold',
  },
  option: {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
  },
  general: {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
  },
};

export const LINE_SPACING_CLASSES = {
  tight: 'leading-tight',
  normal: 'leading-normal',
  relaxed: 'leading-relaxed',
};

export const BUTTON_RADIUS_CLASSES = {
  'rounded-md': 'rounded-lg',
  'rounded-full': 'rounded-full',
  'rounded-none': 'rounded-none',
  'pill': 'rounded-2xl',
};

const ACTIVE_THEME_STORAGE_KEY = 'attlic_active_theme_state';

function parseHexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = (hex || '#4cbba1').replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return {
      r: Number.isNaN(r) ? 76 : r,
      g: Number.isNaN(g) ? 187 : g,
      b: Number.isNaN(b) ? 161 : b,
    };
  }
  const num = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(num)) {
    return { r: 76, g: 187, b: 161 };
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')
  );
}

export function mixHexColors(hexA: string, hexB: string, weightA: number): string {
  const w = Math.max(0, Math.min(1, weightA));
  const a = parseHexToRgb(hexA);
  const b = parseHexToRgb(hexB);
  return rgbToHex(
    a.r * w + b.r * (1 - w),
    a.g * w + b.g * (1 - w),
    a.b * w + b.b * (1 - w)
  );
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Pure helper that computes a complete, uniform CSS custom property map from any
 * AppearanceColors palette so all Tailwind indigo-*, slate-*, and theme tokens
 * harmonize with the selected fruit theme without any leftover mint bleed.
 */
export function generateThemeCssVariables(colors: AppearanceColors): Record<string, string> {
  const primary = colors.primary || THEME_PRESETS.kiwi.colors.primary;
  const buttonPrimary = colors.buttonPrimary || mixHexColors(primary, '#000000', 0.82);
  const accent = colors.accent || primary;
  const timerColor = colors.timerColor || mixHexColors(primary, '#ffffff', 0.75);
  const progressIndicator = colors.progressIndicator || primary;
  const background = colors.background || THEME_PRESETS.kiwi.colors.background;
  const cardBackground = colors.cardBackground || THEME_PRESETS.kiwi.colors.cardBackground;
  const secondary = colors.secondary || THEME_PRESETS.kiwi.colors.secondary;
  const textMain = colors.textMain || '#f8fafc';
  const textSecondary = colors.textSecondary || mixHexColors(primary, '#ffffff', 0.65);

  const bgRgb = parseHexToRgb(background);
  const isLightCanvas = bgRgb.r * 0.299 + bgRgb.g * 0.587 + bgRgb.b * 0.114 > 150;

  return {
    // Dynamic primary accent scale (replaces static mint --color-indigo-*)
    '--color-indigo-50': textMain,
    '--color-indigo-100': mixHexColors('#ffffff', primary, 0.78),
    '--color-indigo-200': mixHexColors(textMain, primary, 0.55),
    '--color-indigo-300': isLightCanvas ? primary : mixHexColors('#ffffff', primary, 0.32),
    '--color-indigo-400': isLightCanvas ? buttonPrimary : mixHexColors('#ffffff', primary, 0.16),
    '--color-indigo-500': primary,
    '--color-indigo-600': buttonPrimary,
    '--color-indigo-700': mixHexColors(buttonPrimary, background, 0.78),
    '--color-indigo-800': mixHexColors(buttonPrimary, background, 0.58),
    '--color-indigo-900': mixHexColors(primary, cardBackground, 0.36),
    '--color-indigo-950': mixHexColors(primary, background, 0.2),

    // Dynamic canvas & card surfaces so slate-950/900/800/700 match the selected theme canvas
    '--color-slate-950': background,
    '--color-slate-900': cardBackground,
    '--color-slate-800': secondary,
    '--color-slate-700': mixHexColors(secondary, textSecondary, 0.78),
    ...(isLightCanvas
      ? {
          '--color-slate-50': textMain,
          '--color-slate-100': textMain,
          '--color-slate-200': textMain,
          '--color-slate-300': textSecondary,
          '--color-slate-400': textSecondary,
          '--color-slate-500': textSecondary,
        }
      : {}),

    // Semantic theme tokens
    '--theme-bg': background,
    '--theme-card-bg': cardBackground,
    '--theme-secondary': secondary,
    '--theme-primary': primary,
    '--theme-button': buttonPrimary,
    '--theme-accent': accent,
    '--theme-timer': timerColor,
    '--theme-progress': progressIndicator,
    '--theme-text-main': textMain,
    '--theme-text-secondary': textSecondary,

    // Scrollbar tokens
    '--theme-scrollbar-track': hexToRgba(cardBackground, 0.7),
    '--theme-scrollbar-thumb': hexToRgba(primary, 0.38),
    '--theme-scrollbar-thumb-hover': hexToRgba(primary, 0.65),
  };
}

/**
 * Returns a scoped inline style object (CSS custom properties + base surface colors)
 * to be applied ONLY on the student test-taking container (CandidateTestRunner) and
 * the AppearanceStudio Live Preview frame—never on document.documentElement (:root).
 */
export function getScopedStudentThemeStyle(colors: AppearanceColors): Record<string, string> {
  const vars = generateThemeCssVariables(colors);
  return {
    ...vars,
    backgroundColor: colors.background,
    color: colors.textMain,
  };
}

/**
 * Ensures document.documentElement (:root) has zero dynamic theme overrides so the
 * overall website always retains its fixed dark, minimal, glassmorphic identity.
 */
export function clearGlobalThemeOverrides(): void {
  if (typeof document !== 'undefined' && document.documentElement) {
    const rootStyle = document.documentElement.style;
    const keysToRemove = [
      '--color-indigo-50',
      '--color-indigo-100',
      '--color-indigo-200',
      '--color-indigo-300',
      '--color-indigo-400',
      '--color-indigo-500',
      '--color-indigo-600',
      '--color-indigo-700',
      '--color-indigo-800',
      '--color-indigo-900',
      '--color-indigo-950',
      '--color-slate-950',
      '--color-slate-900',
      '--color-slate-800',
      '--color-slate-700',
      '--theme-bg',
      '--theme-card-bg',
      '--theme-secondary',
      '--theme-primary',
      '--theme-button',
      '--theme-accent',
      '--theme-timer',
      '--theme-progress',
      '--theme-text-main',
      '--theme-text-secondary',
      '--theme-scrollbar-track',
      '--theme-scrollbar-thumb',
      '--theme-scrollbar-thumb-hover',
    ];
    for (const k of keysToRemove) {
      rootStyle.removeProperty(k);
    }
    document.documentElement.removeAttribute('data-attlic-theme');
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(ACTIVE_THEME_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}


