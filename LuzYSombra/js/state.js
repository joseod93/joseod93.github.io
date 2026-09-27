
import { now } from './utils.js';

export const blank = () => ({
    version: 3,
    started: false,
    startedAt: now(),
    lastTick: now(),
    time: { day: 1, minutes: 0 },
    fire: { lit: false, heat: 0, fuel: 0 },
    player: { hp: 100, maxHp: 100, guard: false, xp: 0, level: 1 },
    unlocked: { water: false, olives: false, herbs: false, village: false, expedition: false, forge: false, crafting: false, molino: false, acequia: false },
    stats: { explore: 0, renown: 0, bossesDefeated: 0, bossTipShown: false },
    people: { villagers: 0, jobs: { lumber: 0, farmer: 0, miner: 0 } },
    resources: { lenia: 0, agua: 0, aceitunas: 0, hierbas: 0, piedra: 0, hierro: 0, trigo: 0, sal: 0, antorchas: 0, medicina: 0 },
    cooldowns: { cut: 0, fetch: 0, forage: 0, explore: 0, stoke: 0, boss: 0, craft: 0 },
    expedition: null,
    threat: null,
    trader: null,
    prestige: 0,
    achievements: {},
    regionFocus: null,
    weather: 'clear',
    discoveries: { lenia: false, agua: false, aceitunas: false, hierbas: false, piedra: false, hierro: false, trigo: false, sal: false },
    streak: { current: 0, best: 0, lastLoginDate: null, totalLogins: 0, claimedToday: false, lastSpinDate: null },
    lastSessionEnd: null,
    // New systems
    skills: {},         // skill key -> level
    skillPoints: 0,
    equipment: { espada: 0, armadura: 0, escudo: 0 },
    consumables: { pocion: 0, bomba: 0, pan: 0 },
    market: null,       // dynamic trade session
    waveMode: null,     // { wave: N, active: bool, hp: N }
    theme: 'dark',      // dark | light
    tutorialTips: {},   // tipKey -> shown bool
    enemiesDefeated: 0,
    currentLocation: null,  // open settlement location id
    revealed: {},       // secciones del "Más" ya anunciadas (revelado progresivo)
    buildings: { molino: 0, acequia: 0, forge: 0 },  // nivel de cada edificio (0 = sin construir)
    alignment: null,    // null | 'luz' | 'sombra' (rama del árbol de habilidades)
    legacy: 0,          // moneda permanente de prestigio (Reliquias)
    legacyUpgrades: {}, // mejoras de Legado compradas: key -> nivel
    bestiary: {},       // victorias por criatura: boss.key | enemy.name -> nº (persiste al ascender)
    contracts: { day: 0, offers: [], active: null, done: 0 },   // encargos del mercader
    seasonEvent: null,  // { season, key, day } evento de estación del día
    history: [],        // [{ t, r: {recurso: n}, rn }] muestra por minuto real (últimas 2 h) para la gráfica
    chronicle: [],      // [{ t, day, p, icon, text }] hitos de la partida (persiste al ascender)
    chronicleKeys: {}   // hitos "una sola vez" ya apuntados
});

export let S = blank();

export function xpForLevel(lvl) {
    return Math.floor(80 * Math.pow(1.35, lvl - 1));
}

const SAVE_KEY = 'lys_save_v2';
const BACKUP_KEY = 'lys_save_backup';    // { at, data } — copia del guardado bueno más reciente
const CORRUPT_KEY = 'lys_save_corrupt';  // guardado ilegible apartado (no se machaca)

// true si loadState tuvo que recuperar la partida desde la copia de seguridad
export let restoredFromBackup = false;

export function loadState() {
    try {
        let raw = localStorage.getItem(SAVE_KEY);
        // Guardado corrupto: apartarlo y recuperar la copia (si no, el autoguardado lo machacaría)
        if (raw) {
            try { JSON.parse(raw); } catch (e) {
                localStorage.setItem(CORRUPT_KEY, raw);
                const backup = getBackup();
                raw = backup ? backup.data : null;
                if (raw) { localStorage.setItem(SAVE_KEY, raw); restoredFromBackup = true; }
                else localStorage.removeItem(SAVE_KEY);
            }
        }

        if (!raw) {
            const v1 = localStorage.getItem('lys_save_v1');
            if (v1) {
                raw = v1;
                localStorage.setItem(SAVE_KEY, v1);
            }
        }

        if (raw) {
            const loaded = JSON.parse(raw);
            S = { ...blank(), ...loaded };

            // Merge superficial -> backfill por objeto canónico (saves antiguos sin campos anidados darían NaN)
            const b = blank();
            ['fire', 'time', 'player', 'people', 'stats', 'resources', 'cooldowns', 'unlocked', 'discoveries', 'streak', 'equipment', 'consumables', 'buildings', 'legacyUpgrades'].forEach(k => {
                if (S[k] && typeof S[k] === 'object' && !Array.isArray(S[k])) S[k] = { ...b[k], ...S[k] };
                else S[k] = b[k];
            });
            // Edificios booleanos antiguos -> nivel 1
            ['molino', 'acequia', 'forge'].forEach(k => { if (S.unlocked[k] && !S.buildings[k]) S.buildings[k] = 1; });
            if (S.alignment === undefined) S.alignment = null;
            if (S.legacy === undefined) S.legacy = 0;

            if (!S.people.jobs) S.people.jobs = { lumber: 0, farmer: 0, miner: 0 };
            if (S.people.jobs.miner === undefined) S.people.jobs.miner = 0;
            if (!S.discoveries) S.discoveries = blank().discoveries;
            if (!S.player.xp && S.player.xp !== 0) S.player.xp = 0;
            if (!S.player.level) S.player.level = 1;
            if (!S.streak) S.streak = blank().streak;
            // New systems migration
            if (!S.skills) S.skills = {};
            if (S.skillPoints === undefined) S.skillPoints = 0;
            if (!S.equipment) S.equipment = { espada: 0, armadura: 0, escudo: 0 };
            if (!S.consumables) S.consumables = { pocion: 0, bomba: 0, pan: 0 };
            if (!S.tutorialTips) S.tutorialTips = {};
            if (S.enemiesDefeated === undefined) S.enemiesDefeated = 0;
            if (!S.theme) S.theme = 'dark';
            if (S.currentLocation === undefined) S.currentLocation = null;
            if (!S.bestiary || typeof S.bestiary !== 'object') S.bestiary = {};
            if (!S.contracts || typeof S.contracts !== 'object') S.contracts = blank().contracts;
            else S.contracts = { ...blank().contracts, ...S.contracts, offers: Array.isArray(S.contracts.offers) ? S.contracts.offers : [] };
            if (S.seasonEvent === undefined) S.seasonEvent = null;
            if (!Array.isArray(S.history)) S.history = [];
            if (!Array.isArray(S.chronicle)) S.chronicle = [];
            if (!S.chronicleKeys || typeof S.chronicleKeys !== 'object') S.chronicleKeys = {};
        }
    } catch (e) {
        console.error('Error al cargar estado:', e);
        S = blank();
    }
    return S;
}

export function saveState() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(S));
        return true;
    } catch (e) { return false; }
}

// ===== Copias de seguridad =====
function getBackup() {
    try {
        const b = JSON.parse(localStorage.getItem(BACKUP_KEY));
        if (b && typeof b.data === 'string') { JSON.parse(b.data); return b; }
    } catch (e) { }
    return null;
}

// Copia el guardado actual (ya escrito y válido) como copia de seguridad
export function backupSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.started) return false;
        localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: now(), data: raw }));
        return true;
    } catch (e) { return false; }
}

export function backupInfo() {
    const b = getBackup();
    if (!b) return null;
    try {
        const d = JSON.parse(b.data);
        return { at: b.at, level: d.player?.level || 1, prestige: d.prestige || 0 };
    } catch (e) { return null; }
}

// Sustituye el guardado por la copia. El llamante debe recargar la página.
export function restoreBackup() {
    const b = getBackup();
    if (!b) return false;
    try { localStorage.setItem(SAVE_KEY, b.data); return true; } catch (e) { return false; }
}

export function resetState() {
    S = blank();
    saveState();
}
