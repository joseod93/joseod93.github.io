
export const RES_META = {
    lenia: { label: 'Leña', icon: '🪵' },
    agua: { label: 'Agua', icon: '💧' },
    aceitunas: { label: 'Aceitunas', icon: '🫒' },
    hierbas: { label: 'Hierbas', icon: '🌿' },
    piedra: { label: 'Piedra', icon: '🪨' },
    hierro: { label: 'Hierro', icon: '⛓️' },
    trigo: { label: 'Trigo', icon: '🌾' },
    sal: { label: 'Sal', icon: '🧂' },
    antorchas: { label: 'Antorchas', icon: '🔥' },
    medicina: { label: 'Medicina', icon: '💊' }
};

export const REGIONS = [
    { name: 'Sevilla', emoji: '🏰', unlockDay: 1, loot: [{ k: 'piedra', n: [2, 4] }, { k: 'hierro', n: [1, 2] }, { k: 'renown', n: [1, 2] }], events: ['Cruzaste el Guadalquivir por un viejo puente.', 'Un mercader te enseña un truco de forja.'] },
    { name: 'Granada', emoji: '🕌', unlockDay: 1, loot: [{ k: 'hierbas', n: [2, 3] }, { k: 'agua', n: [1, 2] }, { k: 'renown', n: [1, 3] }], events: ['El eco de la Alhambra susurra historias antiguas.', 'Las Alpujarras te ofrecen senderos y manantiales.'] },
    { name: 'Cádiz', emoji: '⚓', unlockDay: 1, loot: [{ k: 'sal', n: [2, 3] }, { k: 'piedra', n: [1, 2] }, { k: 'renown', n: [1, 2] }], events: ['Las salinas brillan bajo el sol.', 'Los vientos de la costa te empujan hacia el oeste.'] },
    { name: 'Jaén', emoji: '🫒', unlockDay: 1, loot: [{ k: 'aceitunas', n: [2, 4] }, { k: 'hierbas', n: [1, 2] }, { k: 'renown', n: [1, 2] }], events: ['Un mar de olivos se extiende hasta el horizonte.', 'Aprendes a podar para mejorar la cosecha.'] },
    { name: 'Málaga', emoji: '🏖️', unlockDay: 3, loot: [{ k: 'sal', n: [1, 2] }, { k: 'renown', n: [2, 3] }], events: ['El viento del levante refresca la costa.'] },
    { name: 'Córdoba', emoji: '🏛️', unlockDay: 4, loot: [{ k: 'piedra', n: [2, 3] }, { k: 'renown', n: [2, 3] }], events: ['Sombras bajo los arcos de la Mezquita.'] },
    { name: 'Huelva', emoji: '⛵', unlockDay: 5, loot: [{ k: 'sal', n: [2, 3] }, { k: 'agua', n: [1, 2] }], events: ['Marismas y esteros te guían.'] },
    { name: 'Almería', emoji: '🏜️', unlockDay: 6, loot: [{ k: 'piedra', n: [3, 4] }, { k: 'hierro', n: [1, 2] }], events: ['Tierras áridas, recursos duros.'] },
    { name: 'Toledo', emoji: '🗡️', unlockDay: 8, loot: [{ k: 'hierro', n: [2, 3] }, { k: 'renown', n: [2, 3] }], events: ['Forjas legendarias te inspiran.'] },
    { name: 'Madrid', emoji: '⭐', unlockDay: 10, loot: [{ k: 'renown', n: [3, 4] }], events: ['Un cruce de caminos te abre oportunidades.'] },
    // End-game regions
    { name: 'Valencia', emoji: '🍊', unlockDay: 12, loot: [{ k: 'trigo', n: [3, 5] }, { k: 'agua', n: [2, 3] }, { k: 'renown', n: [2, 3] }], events: ['Los naranjos de la huerta te dan frutos.', 'El Turia fluye con fuerza.'] },
    { name: 'Barcelona', emoji: '🏗️', unlockDay: 14, loot: [{ k: 'piedra', n: [3, 5] }, { k: 'hierro', n: [2, 3] }, { k: 'renown', n: [3, 4] }], events: ['La Sagrada Familia inspira a tus constructores.', 'Comerciantes catalanes te ofrecen tratos.'] },
    { name: 'Zaragoza', emoji: '🏛️', unlockDay: 16, loot: [{ k: 'hierro', n: [3, 4] }, { k: 'piedra', n: [2, 3] }, { k: 'renown', n: [2, 4] }], events: ['La Aljafería guarda secretos ancestrales.'] },
    { name: 'Bilbao', emoji: '⚓', unlockDay: 18, loot: [{ k: 'hierro', n: [4, 6] }, { k: 'sal', n: [2, 3] }, { k: 'renown', n: [3, 4] }], events: ['Los astilleros del Cantábrico producen lo mejor.'] },
    { name: 'Santiago', emoji: '🐚', unlockDay: 20, loot: [{ k: 'hierbas', n: [3, 5] }, { k: 'agua', n: [3, 4] }, { k: 'renown', n: [3, 5] }], events: ['Peregrinos comparten sabiduría del camino.', 'Lluvia gallega nutre la tierra.'] },
    { name: 'Lisboa', emoji: '🌊', unlockDay: 23, loot: [{ k: 'sal', n: [4, 6] }, { k: 'renown', n: [4, 5] }], events: ['El puerto atlántico abre rutas comerciales.', 'Fados resuenan en las callejuelas.'] },
    { name: 'Roma', emoji: '🏟️', unlockDay: 26, loot: [{ k: 'piedra', n: [5, 8] }, { k: 'renown', n: [5, 7] }], events: ['El Coliseo te recuerda la grandeza de antaño.', 'Legionarios veteranos te enseñan tácticas.'] },
    { name: 'Constantinopla', emoji: '🕌', unlockDay: 30, loot: [{ k: 'hierro', n: [4, 6] }, { k: 'sal', n: [3, 5] }, { k: 'renown', n: [6, 8] }], events: ['La puerta entre mundos se abre ante ti.', 'Mercaderes de oriente ofrecen exóticas mercancías.'] }
];

export const BOSSES = [
    { key: 'boss_guadalquivir', name: 'La Sombra del Guadalquivir', icon: '🌊', hp: 12, duration: 90000, region: 'Sevilla', level: 1 },
    { key: 'boss_toro', name: 'Toro de Fuego', icon: '🐂', hp: 20, duration: 120000, region: 'Jaén', level: 3 },
    { key: 'boss_alhambra', name: 'Eco de la Alhambra', icon: '🏯', hp: 28, duration: 150000, region: 'Granada', level: 5 },
    { key: 'boss_cadiz', name: 'Dama de Cádiz', icon: '🧜', hp: 32, duration: 150000, region: 'Cádiz', level: 7 },
    { key: 'boss_sierra', name: 'Centinela de Sierra Morena', icon: '🌲', hp: 18, duration: 120000, region: 'Sevilla', level: 4 },
    // End-game bosses
    { key: 'boss_dragon', name: 'Dragón de Montserrat', icon: '🐉', hp: 45, duration: 180000, region: 'Barcelona', level: 10 },
    { key: 'boss_kraken', name: 'Kraken del Cantábrico', icon: '🦑', hp: 50, duration: 180000, region: 'Bilbao', level: 12 },
    { key: 'boss_fantasma', name: 'Fantasma del Camino', icon: '👻', hp: 38, duration: 150000, region: 'Santiago', level: 9 },
    { key: 'boss_coloso', name: 'Coloso de Roma', icon: '🗿', hp: 60, duration: 200000, region: 'Roma', level: 14 },
    { key: 'boss_sultan', name: 'El Sultán Oscuro', icon: '👁️', hp: 75, duration: 200000, region: 'Constantinopla', level: 16 },
];

// Regular enemies for expeditions
export const ENEMIES = [
    { name: 'Bandido', icon: '🗡️', hp: 5, atk: 4, level: 1, loot: [{ k: 'lenia', n: [1, 2] }] },
    { name: 'Lobo Salvaje', icon: '🐺', hp: 7, atk: 5, level: 2, loot: [{ k: 'hierbas', n: [1, 2] }] },
    { name: 'Jabalí Furioso', icon: '🐗', hp: 9, atk: 6, level: 3, loot: [{ k: 'trigo', n: [1, 3] }] },
    { name: 'Desertor', icon: '⚔️', hp: 12, atk: 7, level: 5, loot: [{ k: 'hierro', n: [1, 2] }] },
    { name: 'Oso Pardo', icon: '🐻', hp: 15, atk: 8, level: 7, loot: [{ k: 'piedra', n: [2, 3] }] },
    { name: 'Contrabandista', icon: '🏴', hp: 10, atk: 6, level: 4, loot: [{ k: 'sal', n: [2, 3] }] },
    { name: 'Espectro Errante', icon: '👤', hp: 18, atk: 9, level: 8, loot: [{ k: 'medicina', n: [1, 2] }] },
    { name: 'Capitán Pirata', icon: '☠️', hp: 22, atk: 10, level: 10, loot: [{ k: 'hierro', n: [2, 4] }, { k: 'sal', n: [2, 3] }] },
];

// Wave system for infinite mode
export const WAVE_CONFIG = {
    baseHp: 8,
    hpPerWave: 5,
    baseAtk: 4,
    atkPerWave: 1.5,
    baseReward: 10,
    rewardPerWave: 5,
    icons: ['🗡️', '🐺', '🐗', '🏴', '⚔️', '🐻', '👤', '☠️', '🐉', '👁️'],
    names: ['Oleada de Bandidos', 'Manada Salvaje', 'Horda de Desertores', 'Legión Oscura', 'Ejército del Sultán'],
};

// Skill tree
export const SKILLS = {
    // Gathering
    sharpAxe:     { name: 'Hacha Afilada', desc: '+1 leña por tala', icon: '🪓', cost: 1, maxLevel: 3, category: 'gather', effect: (lvl) => ({ bonusWood: lvl }) },
    deepWells:    { name: 'Pozos Profundos', desc: '+1 agua por recolección', icon: '🪣', cost: 1, maxLevel: 3, category: 'gather', effect: (lvl) => ({ bonusWater: lvl }) },
    herbalLore:   { name: 'Saber Herbal', desc: '+30% prob. hierbas raras', icon: '🌿', cost: 2, maxLevel: 2, category: 'gather', effect: (lvl) => ({ herbBonus: lvl * 0.15 }) },
    // Combat
    swordMastery: { name: 'Maestría con Espada', desc: '+1 ataque base', icon: '⚔️', cost: 1, maxLevel: 5, category: 'combat', effect: (lvl) => ({ bonusAtk: lvl }) },
    ironSkin:     { name: 'Piel de Hierro', desc: '-10% daño recibido', icon: '🛡️', cost: 2, maxLevel: 3, category: 'combat', effect: (lvl) => ({ dmgReduction: lvl * 0.1 }) },
    criticalEye:  { name: 'Ojo Crítico', desc: '+5% prob. crítico', icon: '🎯', cost: 2, maxLevel: 3, category: 'combat', effect: (lvl) => ({ critBonus: lvl * 0.05 }) },
    dodgeReflex:  { name: 'Reflejos Evasivos', desc: '+8% prob. esquivar', icon: '💨', cost: 2, maxLevel: 3, category: 'combat', effect: (lvl) => ({ dodgeChance: lvl * 0.08 }) },
    // Production
    fastCraft:    { name: 'Artesanía Rápida', desc: '-20% cooldown craft', icon: '🔨', cost: 1, maxLevel: 3, category: 'production', effect: (lvl) => ({ craftCdReduction: lvl * 0.2 }) },
    efficientFire:{ name: 'Fuego Eficiente', desc: '-15% consumo combustible', icon: '🔥', cost: 2, maxLevel: 2, category: 'production', effect: (lvl) => ({ fuelReduction: lvl * 0.15 }) },
    tradeSkill:   { name: 'Comerciante Nato', desc: '-15% coste mercader', icon: '🤝', cost: 2, maxLevel: 3, category: 'production', effect: (lvl) => ({ tradeDiscount: lvl * 0.15 }) },
    leadership:   { name: 'Liderazgo', desc: '+15% producción aldeanos', icon: '👑', cost: 3, maxLevel: 3, category: 'production', effect: (lvl) => ({ villagerBonus: lvl * 0.15 }) },
};

// Expanded crafting recipes
export const CRAFT_RECIPES = {
    antorchas:  { name: 'Antorcha', icon: '🔥', cost: { lenia: 1, aceitunas: 1 }, gives: { antorchas: 1 }, xp: 3 },
    medicina:   { name: 'Medicina', icon: '💊', cost: { hierbas: 2, agua: 1 }, gives: { medicina: 1 }, xp: 4 },
    espada:     { name: 'Espada de Hierro', icon: '🗡️', cost: { hierro: 3, lenia: 2 }, gives: { espada: 1 }, xp: 8, requires: 'forge', desc: '+2 ataque en combate' },
    armadura:   { name: 'Armadura de Cuero', icon: '🦺', cost: { hierro: 2, sal: 2 }, gives: { armadura: 1 }, xp: 8, requires: 'forge', desc: '-20% daño recibido' },
    escudo:     { name: 'Escudo Reforzado', icon: '🛡️', cost: { hierro: 4, piedra: 3 }, gives: { escudo: 1 }, xp: 10, requires: 'forge', desc: '+30% bloqueo' },
    pocion:     { name: 'Poción de Fuerza', icon: '🧪', cost: { hierbas: 3, sal: 1, agua: 2 }, gives: { pocion: 1 }, xp: 6, desc: 'x2 daño 1 turno en combate' },
    bomba:      { name: 'Bomba de Humo', icon: '💣', cost: { sal: 2, lenia: 1, hierro: 1 }, gives: { bomba: 1 }, xp: 5, desc: 'Huir sin penalización' },
    pan:        { name: 'Pan', icon: '🍞', cost: { trigo: 3, agua: 1 }, gives: { pan: 1 }, xp: 3, requires: 'molino', desc: 'Recupera 15 HP fuera de combate' },
};

// Trade goods with dynamic pricing
export const TRADE_GOODS = [
    { key: 'lenia', basePrice: 5, volatility: 0.3 },
    { key: 'agua', basePrice: 4, volatility: 0.2 },
    { key: 'aceitunas', basePrice: 6, volatility: 0.4 },
    { key: 'hierbas', basePrice: 7, volatility: 0.3 },
    { key: 'piedra', basePrice: 8, volatility: 0.25 },
    { key: 'hierro', basePrice: 12, volatility: 0.35 },
    { key: 'trigo', basePrice: 5, volatility: 0.3 },
    { key: 'sal', basePrice: 10, volatility: 0.4 },
];

export const EXTRA_ACHIEVEMENTS = [
    { key: 'ach_aceitunero', name: 'Maestro Aceitunero', icon: '🫒' },
    { key: 'ach_acequia', name: 'Arquitecto del Agua', icon: '🚰' },
    { key: 'ach_herrero', name: 'Herrero Mayor', icon: '⚒️' }
];

// Map positioning constants — tuned so all regions fall within viewBox 0 0 300 220
export const SCALE = 1.5;
export const OFFSET_X = -80;
export const OFFSET_Y = -60;

export const REGION_POS = {
    'Sevilla': { x: 100, y: 120 },
    'Cádiz':   { x: 55,  y: 180 },
    'Huelva':  { x: 25,  y: 135 },
    'Málaga':  { x: 160, y: 180 },
    'Córdoba': { x: 145, y: 120 },
    'Jaén':    { x: 205, y: 120 },
    'Granada': { x: 220, y: 165 },
    'Almería': { x: 265, y: 155 },
    'Toledo':  { x: 175, y: 60  },
    'Madrid':  { x: 205, y: 30  },
    'Valencia': { x: 250, y: 100 },
    'Barcelona': { x: 280, y: 60 },
    'Zaragoza': { x: 240, y: 45 },
    'Bilbao':  { x: 140, y: 10 },
    'Santiago': { x: 30, y: 20 },
    'Lisboa':  { x: 10, y: 100 },
    'Roma':    { x: 290, y: 190 },
    'Constantinopla': { x: 290, y: 210 }
};
