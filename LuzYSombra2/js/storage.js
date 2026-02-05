// Storage Module - Manejo de estado y persistencia
// Luz y Sombra: El Alba de Hispania

const now = () => Date.now();

// Estado inicial del juego
const blank = () => ({
    version: 3,
    started: false,
    startedAt: now(),
    lastTick: now(),
    time: { day: 1, minutes: 0 },
    fire: { lit: false, heat: 0, fuel: 0 },
    player: { hp: 100, maxHp: 100, guard: false },
    unlocked: { water: false, olives: false, herbs: false, village: false, expedition: false, forge: false, crafting: false, molino: false, acequia: false },
    stats: { explore: 0, renown: 0, bossesDefeated: 0, bossTipShown: false },
    people: { villagers: 0, jobs: { lumber: 0, farmer: 0, miner: 0 } },
    resources: { lenia: 0, agua: 0, aceitunas: 0, hierbas: 0, piedra: 0, hierro: 0, trigo: 0, sal: 0, antorchas: 0, medicina: 0 },
    cooldowns: { cut: 0, fetch: 0, forage: 0, explore: 0, stoke: 0, boss: 0, craft: 0 },
    discoveries: { lenia: false, agua: false, aceitunas: false, hierbas: false, piedra: false, hierro: false, trigo: false, sal: false },
    achievements: { luzEterna: false },
    expedition: null,
    threat: null,
    trader: null,
    weather: 'clear',
    regionFocus: null,
    prestige: 0,
    notes: []
});

// Estado global del juego
let S = blank();

// Cargar estado desde localStorage
function loadState() {
    try {
        const raw = localStorage.getItem('lys_save_v1');
        if (raw) {
            const loaded = JSON.parse(raw);
            S = { ...blank(), ...loaded };

            // Migraciones de versión
            if (!S.people) S.people = { villagers: 0, jobs: { lumber: 0, farmer: 0, miner: 0 } };
            if (!S.people.jobs) S.people.jobs = { lumber: 0, farmer: 0, miner: 0 };
            if (!S.discoveries) S.discoveries = { lenia: false, agua: false, aceitunas: false, hierbas: false, piedra: false, hierro: false, trigo: false, sal: false };
            if (!S.weather) S.weather = 'clear';
            if (!S.regionFocus) S.regionFocus = null;
            if (S.prestige === undefined) S.prestige = 0;
            if (!S.notes) S.notes = [];
        }
    } catch (e) {
        console.error('Error loading state:', e);
        S = blank();
    }
}

// Guardar estado en localStorage
function saveState() {
    try {
        localStorage.setItem('lys_save_v1', JSON.stringify(S));
    } catch (e) {
        console.error('Error saving state:', e);
    }
}

// Resetear estado
function resetState() {
    S = blank();
    saveState();
}

// Exportar estado para importación
function exportState() {
    try {
        return btoa(JSON.stringify(S));
    } catch (e) {
        console.error('Error exporting state:', e);
        return null;
    }
}

// Importar estado
function importState(encodedState) {
    try {
        const json = JSON.parse(atob(encodedState));
        if (json && json.resources) {
            localStorage.setItem('lys_save_v1', JSON.stringify(json));
            return true;
        }
        return false;
    } catch (e) {
        console.error('Error importing state:', e);
        return false;
    }
}

// Obtener estado
function getState() {
    return S;
}

// Actualizar estado
function setState(newState) {
    S = newState;
}

export {
    S,
    blank,
    loadState,
    saveState,
    resetState,
    exportState,
    importState,
    getState,
    setState,
    now
};
