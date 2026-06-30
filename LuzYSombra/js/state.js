
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
    legacyUpgrades: {}  // mejoras de Legado compradas: key -> nivel
});

export let S = blank();

export function xpForLevel(lvl) {
    return Math.floor(80 * Math.pow(1.35, lvl - 1));
}

export function loadState() {
    try {
        let raw = localStorage.getItem('lys_save_v2');

        if (!raw) {
            const v1 = localStorage.getItem('lys_save_v1');
            if (v1) {
                raw = v1;
                localStorage.setItem('lys_save_v2', v1);
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
        }
    } catch (e) {
        console.error('Error al cargar estado:', e);
        S = blank();
    }
    return S;
}

export function saveState() {
    try {
        localStorage.setItem('lys_save_v2', JSON.stringify(S));
        return true;
    } catch (e) { return false; }
}

export function resetState() {
    S = blank();
    saveState();
}
