
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
    { name: 'Madrid', emoji: '⭐', unlockDay: 10, loot: [{ k: 'renown', n: [3, 4] }], events: ['Un cruce de caminos te abre oportunidades.'] }
];

export const BOSSES = [
    { key: 'boss_guadalquivir', name: 'La Sombra del Guadalquivir', icon: '🌊', hp: 12, duration: 90000, region: 'Sevilla' },
    { key: 'boss_toro', name: 'Toro de Fuego', icon: '🐂', hp: 20, duration: 120000, region: 'Jaén' },
    { key: 'boss_alhambra', name: 'Eco de la Alhambra', icon: '🏯', hp: 28, duration: 150000, region: 'Granada' },
    { key: 'boss_cadiz', name: 'Dama de Cádiz', icon: '🧜', hp: 32, duration: 150000, region: 'Cádiz' },
    { key: 'boss_sierra', name: 'Centinela de Sierra Morena', icon: '🌲', hp: 18, duration: 120000, region: 'Sevilla' }
];

export const EXTRA_ACHIEVEMENTS = [
    { key: 'ach_aceitunero', name: 'Maestro Aceitunero', icon: '🫒' },
    { key: 'ach_acequia', name: 'Arquitecto del Agua', icon: '🚰' },
    { key: 'ach_herrero', name: 'Herrero Mayor', icon: '⚒️' }
];

// Map positioning constants
export const SCALE = 3.0;
export const OFFSET_X = -300;
export const OFFSET_Y = -310;

export const REGION_POS = {
    'Sevilla': { x: 120 * SCALE + OFFSET_X, y: 120 * SCALE + OFFSET_Y },
    'Cádiz': { x: 90 * SCALE + OFFSET_X, y: 160 * SCALE + OFFSET_Y },
    'Huelva': { x: 70 * SCALE + OFFSET_X, y: 130 * SCALE + OFFSET_Y },
    'Málaga': { x: 160 * SCALE + OFFSET_X, y: 160 * SCALE + OFFSET_Y },
    'Córdoba': { x: 150 * SCALE + OFFSET_X, y: 120 * SCALE + OFFSET_Y },
    'Jaén': { x: 190 * SCALE + OFFSET_X, y: 120 * SCALE + OFFSET_Y },
    'Granada': { x: 200 * SCALE + OFFSET_X, y: 150 * SCALE + OFFSET_Y },
    'Almería': { x: 230 * SCALE + OFFSET_X, y: 150 * SCALE + OFFSET_Y },
    'Toledo': { x: 170 * SCALE + OFFSET_X, y: 80 * SCALE + OFFSET_Y },
    'Madrid': { x: 190 * SCALE + OFFSET_X, y: 60 * SCALE + OFFSET_Y }
};
