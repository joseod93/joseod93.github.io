
import { now } from './utils.js';

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
    expedition: null,
    threat: null,
    trader: null,
    prestige: 0,
    achievements: {},
    regionFocus: null,
    weather: 'clear',
    discoveries: { lenia: false, agua: false, aceitunas: false, hierbas: false, piedra: false, hierro: false, trigo: false, sal: false }
});

export let S = blank(); // Default to blank, will be overwritten by load

export function loadState() {
    try {
        const raw = localStorage.getItem('lys_save_v2');
        if (raw) {
            S = JSON.parse(raw);
            // Migration: Ensure jobs exist
            if (!S.people.jobs) S.people.jobs = { lumber: 0, farmer: 0, miner: 0 };
            if (S.people.jobs.miner === undefined) S.people.jobs.miner = 0;
            // Ensure structure is correct if versions mismatch (simple merge/fallback could go here)
        }
    } catch (e) { S = blank(); }
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
