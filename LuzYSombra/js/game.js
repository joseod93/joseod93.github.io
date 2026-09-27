
import { $, now, fmtMs, formatNumber, vibrate, setVibrate, vibrateEnabled } from './utils.js';
import { S, loadState, saveState, resetState, blank, backupSave, backupInfo, restoreBackup, restoredFromBackup } from './state.js';
import { log, updateCooldownVisuals, updateTags, renderResources, renderNotes, renderAchievements, toast, setTip, renderQuests, showStatistics, initTabs, addXP, xpFlash, screenFlash, fireConfetti, updateStreakDisplay, updateWeatherVisuals, showPassiveGain, showEventBanner, getActiveTab, renderBestiary, setProductionRates, switchTab } from './ui.js';
import { tryUnlocks, checkAchievements } from './actions.js';
import { renderMap } from './map.js';
import { renderSettlement, refreshOpenLocation } from './settlement.js';
import { showEncounterPrompt, startEnemyEncounter, isCombatOpen } from './combat.js';
import { BOSSES, ENEMIES, LEGACY_UPGRADES, BUILDING_UPGRADES, SEASONS, seasonOf, SEASON_EVENTS, SEASON_EVENT_CHANCE, RES_META } from './constants.js';
import { updateContracts, renderContracts } from './contracts.js';
import { renderScene, bindScene } from './scene.js';
import { addChronicle, renderChronicle } from './chronicle.js';
import integrator from './integrator.js';
import { notifications } from './notifications.js';

// Efectos acumulados del árbol de Legado (Reliquias) — permanentes entre prestigios
function legacyEffects() {
    const e = {};
    for (const [k, up] of Object.entries(LEGACY_UPGRADES)) {
        const lvl = S.legacyUpgrades?.[k] || 0;
        if (lvl > 0) Object.assign(e, up.effect(lvl));
    }
    return e;
}
// Multiplicador de nivel de edificio: +25% por nivel sobre el 1
function buildMul(k) {
    const lvl = (S.buildings && S.buildings[k]) || (S.unlocked[k] ? 1 : 0);
    return 1 + 0.25 * (Math.max(1, lvl) - 1);
}

const startOverlay = $('#startOverlay');
const startBtn = $('#startBtn');
const audioBtn = $('#audioBtn');

function addRes(key, n) {
    S.resources[key] = (S.resources[key] || 0) + n;
    if (S.resources[key] > 0) {
        if (!S.discoveries[key]) S.discoveries[key] = true;
    }
    integrator.onResourceGathered(S, key, n, log);
}

export function spawnBoss() {
    // Elegir un boss acorde al nivel del jugador (no un lvl16 en el día 2)
    const maxLvl = S.player.level + 2;
    let pool = BOSSES.filter(b => (b.level || 1) <= maxLvl);
    if (!pool.length) pool = [...BOSSES].sort((a, b) => (a.level || 1) - (b.level || 1)).slice(0, 3);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    S.threat = { key: pick.key, name: pick.name, icon: pick.icon, hp: pick.hp, max: pick.hp, atk: pick.atk, level: pick.level, endsAt: now() + pick.duration, region: pick.region };
    log(`${pick.name} emerge cerca de ${pick.region}.`, 'bad');
    showEventBanner(`⚔️ ${pick.name} emerge cerca de ${pick.region}`, 'danger');
    integrator.onBossSpawned(S, pick.name, pick.region);
    showEncounterPrompt();
    if (!S.stats.bossTipShown) {
        setTip('Consejo: vuelve cada cierto tiempo para reclamar expediciones y derrotar bosses.');
        S.stats.bossTipShown = true;
    }
}

function gameTick() {
    if (!S.started) return;
    const nowTs = now();
    const gains = [];   // ganancias pasivas a mostrar DESPUÉS de renderResources

    S.time.minutes += 1;
    if (S.time.minutes >= (24 * 60)) {
        const prevSeason = seasonOf(S.time.day);
        S.time.minutes = 0;
        S.time.day++;
        log('Amanece un nuevo día en Andalucía.', 'dim');
        addXP(5);
        const season = seasonOf(S.time.day);
        if (season !== prevSeason) {
            log(`${season.icon} Llega ${season.art} ${season.name}: ${season.desc}.`, '');
            showEventBanner(`${season.icon} ¡Llega ${season.art} ${season.name}! ${season.desc}`, 'weather');
        } else if (Math.random() < SEASON_EVENT_CHANCE) {
            triggerSeasonEvent(season);   // el día del cambio de estación ya tiene su banner
        }
    }
    const sm = seasonOf(S.time.day).mods;

    if (Math.random() < 0.002) {
        const weathers = ['clear', 'clear', 'clear', 'rain', 'wind'];
        const next = weathers[Math.floor(Math.random() * weathers.length)];
        if (next !== S.weather) {
            S.weather = next;
            const wMsg = { clear: '☀️ El cielo se despeja.', rain: '🌧️ Empieza a llover.', wind: '💨 Se levanta un fuerte viento.' };
            log(wMsg[next], 'dim');
            updateWeatherVisuals(next);
            showEventBanner(wMsg[next], 'weather');
        }
    }

    if (S.fire.lit) {
        const fuelReduction = (S.skills?.efficientFire || 0) * 0.15;
        let fuelCons = 0.05 * (1 - fuelReduction) * sm.fuel;
        let heatGain = 0.2 + (S.unlocked.molino ? 0.05 : 0);

        if (S.weather === 'rain') heatGain -= 0.1;
        if (S.weather === 'wind') fuelCons += 0.05;

        if (S.fire.fuel > 0) {
            S.fire.fuel -= fuelCons;
            S.fire.heat = Math.min(30, S.fire.heat + heatGain);
        } else {
            S.fire.heat = Math.max(0, S.fire.heat - 0.5);
        }

        if (S.fire.heat <= 0) { S.fire.lit = false; log('La lumbre se ha apagado.', 'warn'); }
    }

    const heat = S.fire.heat;
    const heatBonus = heat > 20 ? 0.02 : heat > 10 ? 0.01 : 0;

    // Passive HP regeneration when fire is lit
    if (S.fire.lit && S.player.hp < S.player.maxHp) {
        S.stats._hpRegenAcc = (S.stats._hpRegenAcc || 0) + 1;
        const regenRate = heat > 20 ? 5 : 10;
        if (S.stats._hpRegenAcc >= regenRate) {
            const hpGain = heat > 20 ? 2 : 1;
            S.player.hp = Math.min(S.player.maxHp, S.player.hp + hpGain);
            S.stats._hpRegenAcc = 0;
        }
    }

    const legacy = legacyEffects();
    const prestigeMult = (1 + ((S.prestige || 0) * 0.25)) * (1 + (legacy.renownMult || 0));
    const levelBonus = (1 + (S.player.level - 1) * 0.02) * (1 + (legacy.prodMult || 0));
    const doubleProd = (S._doubleProd && nowTs < S._doubleProd) ? 2 : 1;

    if (S.unlocked.acequia && Math.random() < (0.05 + heatBonus) * levelBonus * buildMul('acequia') * sm.water) { addRes('agua', 1 * doubleProd); gains.push(['agua', 1 * doubleProd]); }
    if (S.unlocked.molino && Math.random() < (0.05 + heatBonus) * levelBonus * buildMul('molino') && S.resources.trigo > 0) {
        S.resources.trigo--;
        const gained = (1 * prestigeMult);
        S.stats.renown += gained;
        integrator.onRenownGained(S, gained, log);
    }
    if (S.unlocked.forge && Math.random() < 0.02 * levelBonus * buildMul('forge')) { addRes('hierro', 1 * doubleProd); gains.push(['hierro', 1 * doubleProd]); }

    if (S.people.villagers > 0) {
        const leaderBonus = 1 + ((S.skills?.leadership || 0) * 0.15);
        let needed = S.people.villagers * 0.06;
        if (S.resources.trigo >= needed) {
            S.resources.trigo -= needed;
        } else {
            let remain = needed - S.resources.trigo;
            S.resources.trigo = 0;
            if (S.resources.aceitunas >= remain) {
                S.resources.aceitunas -= remain;
            } else {
                S.resources.aceitunas = 0;
                if (Math.random() < 0.05) {
                    S.people.villagers--;
                    const jobs = Object.keys(S.people.jobs).filter(k => S.people.jobs[k] > 0);
                    if (jobs.length > 0) {
                        const k = jobs[Math.floor(Math.random() * jobs.length)];
                        S.people.jobs[k]--;
                    }
                    log('Un aldeano ha muerto de hambre.', 'bad');
                    showEventBanner('⚠️ Un aldeano ha muerto de hambre', 'danger');
                }
            }
        }

        if (S.people.jobs) {
            if (S.people.jobs.lumber > 0 && Math.random() < 0.1 * S.people.jobs.lumber * levelBonus * leaderBonus * sm.wood) { addRes('lenia', 1 * doubleProd); gains.push(['lenia', 1 * doubleProd]); }
            if (S.people.jobs.farmer > 0) {
                let farmChance = 0.08 + (heatBonus * 2);
                if (S.weather === 'rain') farmChance += 0.05;
                if (Math.random() < farmChance * S.people.jobs.farmer * levelBonus * leaderBonus * sm.farm) { addRes('trigo', 1 * doubleProd); gains.push(['trigo', 1 * doubleProd]); }
            }
            if (S.people.jobs.miner > 0) {
                const mineChance = 0.05 * S.people.jobs.miner * levelBonus * leaderBonus;
                if (Math.random() < mineChance) {
                    const roll = Math.random();
                    if (roll < 0.4) { addRes('piedra', 1); gains.push(['piedra', 1]); }
                    else if (roll < 0.6) { addRes('hierro', 1); gains.push(['hierro', 1]); }
                    else {
                        const rn = 1 * (1 + (legacy.renownMult || 0));   // Fama Imperecedera
                        S.stats.renown += rn;
                        integrator.onRenownGained(S, rn, log);
                    }
                }
            }
        }
    }

    if (S.threat && nowTs >= S.threat.endsAt) {
        log(`${S.threat.name} se desvanece entre la bruma.`, 'dim');
        S.threat = null;
    }

    if (!S.threat && !isCombatOpen() && S.time.day >= 2 && Math.random() < 0.006) spawnBoss();

    if (!S.trader && !S.threat && S.time.day >= 3 && Math.random() < (0.002 + (S.stats.renown * 0.0001))) {
        const wants = Math.random() < 0.5 ? 'lenia' : 'trigo';
        S.trader = {
            endsAt: now() + 60000,
            wants: wants,
            gives: 'renown',
            rate: 20
        };
        log('Un mercader ambulante ha acampado cerca.', 'good');
        showEventBanner('🪵 Un mercader ambulante ha acampado cerca', 'opportunity');
        integrator.onTraderArrived(S);
        renderSettlement(); refreshOpenLocation(); window.dispatchEvent(new CustomEvent('lys-actions-refresh'));
    }

    if (S.trader && nowTs >= S.trader.endsAt) {
        log('El mercader recoge sus cosas y se marcha.', 'dim');
        S.trader = null;
        renderSettlement(); refreshOpenLocation(); window.dispatchEvent(new CustomEvent('lys-actions-refresh'));
    }

    if (nowTs - (S.history[S.history.length - 1]?.t || 0) >= HISTORY_EVERY) recordHistory(nowTs);
    updateContracts();
    renderContracts();

    tryUnlocks();   // la producción pasiva también puede cruzar umbrales de desbloqueo
    updateTags();
    setProductionRates(productionRates());
    renderResources();
    // Pintar flotantes "+N" después de reconstruir las fichas (si no, se borran al instante)
    gains.forEach(([k, n]) => showPassiveGain(k, n));
    checkAchievements();
    if (getActiveTab() === 'tabMapa') renderMap();
    renderSettlement();
    renderScene($('#villageScene'));
    refreshOpenLocation();
    renderNotes();
    updateSectionVisibility();
    updateCooldownVisuals();
    integrator.onGameTick(S, log);
    S.lastTick = now();
}

// ===== STREAK SYSTEM =====
function getDateStr() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function checkStreak() {
    const today = getDateStr();
    if (!S.streak) S.streak = { current: 0, best: 0, lastLoginDate: null, totalLogins: 0, claimedToday: false };

    if (S.streak.lastLoginDate === today) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

    if (S.streak.lastLoginDate === yesterdayStr) {
        S.streak.current++;
    } else if (S.streak.lastLoginDate !== null) {
        S.streak.current = 1;
    } else {
        S.streak.current = 1;
    }

    if (S.streak.current > S.streak.best) S.streak.best = S.streak.current;
    S.streak.totalLogins++;
    S.streak.lastLoginDate = today;
    S.streak.claimedToday = false;
    updateStreakDisplay();
    saveState();
}

function getStreakRewards(streak) {
    const rewards = [];
    const base = Math.min(streak, 10);
    rewards.push({ icon: '🪵', label: 'Leña', amount: 2 + base, key: 'lenia' });
    rewards.push({ icon: '💧', label: 'Agua', amount: 1 + Math.floor(base / 2), key: 'agua' });
    if (streak >= 3) rewards.push({ icon: '🌿', label: 'Hierbas', amount: Math.floor(base / 2), key: 'hierbas' });
    if (streak >= 5) rewards.push({ icon: '💊', label: 'Medicina', amount: 1, key: 'medicina' });
    if (streak >= 7) rewards.push({ icon: '⭐', label: 'Renombre', amount: 2, key: 'renown' });
    return rewards;
}

// ===== EVENTOS DE ESTACIÓN =====
// Uno al amanecer (prob. SEASON_EVENT_CHANCE). Efectos por datos en constants.SEASON_EVENTS.
function triggerSeasonEvent(season, forcedKey) {
    const list = SEASON_EVENTS[season.key] || [];
    const ev = forcedKey ? list.find(e => e.key === forcedKey) : list[Math.floor(Math.random() * list.length)];
    if (!ev) return;
    S.seasonEvent = { season: season.key, key: ev.key, day: S.time.day };
    const scale = 1 + (S.player.level - 1) * 0.1;
    const parts = [];
    for (const [k, base] of Object.entries(ev.res || {})) {
        const n = Math.round(base * scale);
        if (n > 0) { addRes(k, n); parts.push(`+${n} ${RES_META[k]?.icon || k}`); }
        else {
            const lost = Math.min(Math.floor(S.resources[k] || 0), -n);
            if (lost > 0) { S.resources[k] -= lost; parts.push(`−${lost} ${RES_META[k]?.icon || k}`); }
        }
    }
    if (ev.heat) {
        if (ev.heat > 0) { S.fire.lit = true; S.fire.fuel = Math.max(S.fire.fuel, 3); }
        S.fire.heat = Math.max(0, Math.min(30, S.fire.heat + ev.heat));
        if (S.fire.heat <= 0) S.fire.lit = false;
        parts.push(`${ev.heat > 0 ? '+' : '−'}${Math.abs(ev.heat)}° 🔥`);
    }
    if (ev.weather && ev.weather !== S.weather) { S.weather = ev.weather; updateWeatherVisuals(ev.weather); }
    if (ev.trader && !S.trader) {
        S.trader = { endsAt: now() + 120000, wants: Math.random() < 0.5 ? 'lenia' : 'trigo', gives: 'renown', rate: 20 };
        integrator.onTraderArrived(S);
    }
    if (ev.xp) addXP(ev.xp);
    log(`${ev.icon} ${ev.name}: ${ev.desc}${parts.length ? ` (${parts.join(', ')})` : ''}`, ev.res && Object.values(ev.res).some(v => v < 0) || ev.heat < 0 || ev.blockExpeditions ? 'warn' : 'good');
    showEventBanner(`${ev.icon} ${ev.name}: ${ev.desc}`, ev.blockExpeditions || ev.heat < 0 ? 'danger' : 'opportunity');
    try { AudioSystem.playTone('event'); } catch (e) { }
    renderSettlement(); refreshOpenLocation(); renderMap();
    window.dispatchEvent(new CustomEvent('lys-actions-refresh'));
    saveState();
}
window.lysSeasonEvent = (key) => triggerSeasonEvent(seasonOf(S.time.day), key);   // depuración desde consola

// ===== HISTORIAL PARA LA GRÁFICA =====
const HISTORY_EVERY = 60 * 1000;   // una muestra por minuto real
const HISTORY_MAX = 120;           // últimas 2 h
function recordHistory(t) {
    const r = {};
    for (const [k, v] of Object.entries(S.resources)) if (v > 0) r[k] = Math.floor(v);
    S.history.push({ t, r, rn: Math.floor(S.stats.renown || 0) });
    if (S.history.length > HISTORY_MAX) S.history.splice(0, S.history.length - HISTORY_MAX);
}

// ===== RITMO DE PRODUCCIÓN (/min) =====
// Valor esperado por minuto con las MISMAS probabilidades que gameTick (cada tick = 1 s).
// Si cambias una fórmula del tick, cámbiala también aquí.
function productionRates() {
    const legacy = legacyEffects();
    const sm = seasonOf(S.time.day).mods;
    const heat = S.fire.heat;
    const heatBonus = heat > 20 ? 0.02 : heat > 10 ? 0.01 : 0;
    const levelBonus = (1 + (S.player.level - 1) * 0.02) * (1 + (legacy.prodMult || 0));
    const leaderBonus = 1 + ((S.skills?.leadership || 0) * 0.15);
    const doubleProd = (S._doubleProd && now() < S._doubleProd) ? 2 : 1;
    const jobs = S.people.jobs || {};
    const p = (x) => Math.min(1, Math.max(0, x)) * 60;   // probabilidad por tick -> unidades/min
    const r = {};
    const add = (k, v) => { if (v) r[k] = (r[k] || 0) + v; };

    if (S.unlocked.acequia) add('agua', p((0.05 + heatBonus) * levelBonus * buildMul('acequia') * sm.water) * doubleProd);
    if (S.unlocked.forge) add('hierro', p(0.02 * levelBonus * buildMul('forge')) * doubleProd);
    if (S.unlocked.molino && S.resources.trigo > 0) add('trigo', -p((0.05 + heatBonus) * levelBonus * buildMul('molino')));
    if ((S.people.villagers || 0) > 0) {
        if (jobs.lumber > 0) add('lenia', p(0.1 * jobs.lumber * levelBonus * leaderBonus * sm.wood) * doubleProd);
        if (jobs.farmer > 0) {
            const farmChance = 0.08 + heatBonus * 2 + (S.weather === 'rain' ? 0.05 : 0);
            add('trigo', p(farmChance * jobs.farmer * levelBonus * leaderBonus * sm.farm) * doubleProd);
        }
        if (jobs.miner > 0) {
            const m = p(0.05 * jobs.miner * levelBonus * leaderBonus);
            add('piedra', m * 0.4); add('hierro', m * 0.2);
        }
        // Comida: primero trigo y, si no hay, aceitunas
        const food = S.people.villagers * 0.06 * 60;
        add(S.resources.trigo > 0 || !(S.resources.aceitunas > 0) ? 'trigo' : 'aceitunas', -food);
    }
    return r;
}

// ===== DESPENSA Y REPARTO DE ALDEANOS =====
// Granjeros justos para cubrir el consumo (+10 % de margen); el resto, leña y mina a partes iguales
function autoAssignJobs() {
    const V = S.people.villagers || 0;
    if (V <= 0) return;
    const legacy = legacyEffects();
    const sm = seasonOf(S.time.day).mods;
    const heat = S.fire.heat;
    const heatBonus = heat > 20 ? 0.02 : heat > 10 ? 0.01 : 0;
    const levelBonus = (1 + (S.player.level - 1) * 0.02) * (1 + (legacy.prodMult || 0));
    const leaderBonus = 1 + ((S.skills?.leadership || 0) * 0.15);
    const perFarmer = (0.08 + heatBonus * 2 + (S.weather === 'rain' ? 0.05 : 0)) * levelBonus * leaderBonus * sm.farm;
    const mill = S.unlocked.molino ? Math.min(1, (0.05 + heatBonus) * levelBonus * buildMul('molino')) : 0;
    const need = V * 0.06 + mill;
    const farmers = Math.min(V, Math.ceil((need * 1.1) / perFarmer));
    const rest = V - farmers;
    const canMine = !!S.discoveries?.piedra;
    S.people.jobs = { farmer: farmers, lumber: canMine ? Math.ceil(rest / 2) : rest, miner: canMine ? Math.floor(rest / 2) : 0 };
    const j = S.people.jobs;
    const txt = `${j.farmer} 🌾 · ${j.lumber} 🪵${canMine ? ` · ${j.miner} ⛏️` : ''}`;
    if (farmers * perFarmer < need) {
        log(`⚖️ Reparto: ${txt}. Ni con todos en el campo llega la comida: consigue trigo o aceitunas.`, 'warn');
        toast('⚠️ No hay granjeros suficientes para tantas bocas');
    } else {
        log(`⚖️ Reparto: ${txt}.`, '');
        toast(`⚖️ ${txt}`);
    }
    vibrate(30);
    setProductionRates(productionRates());
    renderResources(); saveState();
    window.dispatchEvent(new CustomEvent('lys-actions-refresh'));
}
window.addEventListener('lys-auto-jobs', autoAssignJobs);   // lo pide el panel de la Aldea (actions.js)

// ===== WELCOME BACK SCREEN =====
// Calcula la producción offline con las MISMAS tasas del gameTick (eficiencia reducida + tope 8h)
function computeIdleGains(elapsed) {
    const legacy = legacyEffects();
    const CAP = (8 + (legacy.idleHours || 0)) * 3600;   // tope idle (ampliable con Legado)
    const sec = Math.min(Math.floor(elapsed / 1000), CAP);
    const capped = Math.floor(elapsed / 1000) > CAP;
    const eff = 0.25;                     // eficiencia offline (con "Reclamar DOBLE" = 0.5 previsto)
    const levelBonus = (1 + (S.player.level - 1) * 0.02) * (1 + (legacy.prodMult || 0));
    const leaderBonus = 1 + ((S.skills?.leadership || 0) * 0.15);
    const prestigeMult = (1 + ((S.prestige || 0) * 0.25)) * (1 + (legacy.renownMult || 0));
    const jobs = S.people.jobs || {};
    const sm = seasonOf(S.time.day).mods;

    const res = {};
    const add = (k, v) => { v = Math.floor(v); if (v > 0) res[k] = (res[k] || 0) + v; };

    add('lenia', sec * 0.1 * (jobs.lumber || 0) * levelBonus * leaderBonus * sm.wood * eff);
    add('trigo', sec * 0.08 * (jobs.farmer || 0) * levelBonus * leaderBonus * sm.farm * eff);
    const miner = sec * 0.05 * (jobs.miner || 0) * levelBonus * leaderBonus * eff;
    add('piedra', miner * 0.4);
    add('hierro', miner * 0.2);
    if (S.unlocked.acequia) add('agua', sec * 0.05 * levelBonus * buildMul('acequia') * sm.water * eff);
    if (S.unlocked.forge) add('hierro', sec * 0.02 * levelBonus * buildMul('forge') * eff);

    let renown = S.unlocked.molino ? Math.floor(sec * 0.05 * prestigeMult * buildMul('molino') * eff) : 0;
    let xp = Math.floor((sec / 30) * (1 + S.player.level * 0.1) * eff);

    // Goteo mínimo aunque no tengas producción, para que volver siempre dé algo
    if (Object.keys(res).length === 0 && renown === 0) add('lenia', Math.max(1, Math.floor(sec / 120)));

    return { res, renown, xp, sec, capped };
}

function showWelcomeBack(elapsed) {
    const overlay = $('#welcomeBackOverlay');
    const timeText = $('#welcomeTime');
    const rewardsEl = $('#welcomeRewards');
    const streakEl = $('#welcomeStreak');
    const closeBtn = $('#welcomeCloseBtn');
    if (!overlay) return;

    // Avanzar el reloj del juego (con corrección de desbordamiento de días)
    S.time.minutes += Math.floor(Math.min(elapsed, 8 * 3600 * 1000) / 1000);
    if (S.time.minutes >= 1440) { S.time.day += Math.floor(S.time.minutes / 1440); S.time.minutes %= 1440; }

    const idle = computeIdleGains(elapsed);
    timeText.textContent = `Has estado fuera ${fmtMs(elapsed)}.` + (idle.capped ? ' (tope de 8h)' : '');

    // Recompensa de racha diaria (una vez al día)
    const streakRes = {}, streakItems = [];
    if (!S.streak.claimedToday) {
        getStreakRewards(S.streak.current).forEach(r => {
            streakRes[r.key] = (streakRes[r.key] || 0) + r.amount;
            streakItems.push(r);
        });
    }

    // Construir lista visual combinada
    const items = [];
    const RES_ICON = { lenia: '🪵', agua: '💧', trigo: '🌾', piedra: '🪨', hierro: '⛓️', aceitunas: '🫒', hierbas: '🌿', sal: '🧂', medicina: '💊', renown: '⭐' };
    const RES_LBL = { lenia: 'Leña', agua: 'Agua', trigo: 'Trigo', piedra: 'Piedra', hierro: 'Hierro', aceitunas: 'Aceitunas', hierbas: 'Hierbas', sal: 'Sal', medicina: 'Medicina', renown: 'Renombre' };
    for (const [k, v] of Object.entries(idle.res)) items.push({ icon: RES_ICON[k] || '📦', label: `+${v} ${RES_LBL[k] || k}` });
    if (idle.renown > 0) items.push({ icon: '⭐', label: `+${idle.renown} Renombre` });
    if (idle.xp > 0) items.push({ icon: '✨', label: `+${idle.xp} XP` });
    if (items.length === 0) items.push({ icon: '👋', label: '¡Bienvenido de vuelta!' });

    const subtitle = items.length && idle.sec > 0
        ? `<div style="grid-column:1/-1;font-size:0.78rem;color:var(--muted);margin:-4px 0 4px">Mientras dormías tu aldea siguió trabajando…</div>` : '';

    rewardsEl.innerHTML = subtitle + items.map((r, i) => `
        <div class="welcome-reward-item count-anim" style="animation-delay:${i * 0.08}s">
            <div class="reward-icon">${r.icon}</div>
            <div class="reward-text">${r.label}</div>
        </div>
    `).join('');

    const nextRewards = getStreakRewards(S.streak.current + 1).slice(0, 3).map(r => `${r.icon}`).join(' ');
    streakEl.innerHTML = `
        <div class="streak-num streak-active">${S.streak.current} 🔥</div>
        <div class="streak-label">días seguidos</div>
        ${S.streak.current >= S.streak.best && S.streak.current > 1 ? '<div style="color:var(--accent);font-size:0.75rem;margin-top:4px">¡Récord personal!</div>' : ''}
        <div style="font-size:0.74rem;color:var(--muted);margin-top:6px">Mañana (racha ${S.streak.current + 1}): ${nextRewards}<br>¡Vuelve o perderás tu racha!</div>
    `;

    // Botones: Reclamar y Reclamar x2
    let x2Btn = $('#welcomeClaim2Btn');
    if (!x2Btn) {
        x2Btn = document.createElement('button');
        x2Btn.id = 'welcomeClaim2Btn';
        x2Btn.className = 'action glow-btn';
        x2Btn.style.marginBottom = '8px';
        closeBtn.parentNode.insertBefore(x2Btn, closeBtn);
    }
    x2Btn.textContent = '✨ Reclamar DOBLE';
    closeBtn.textContent = 'Reclamar';
    closeBtn.classList.remove('glow-btn');

    const applyAndClose = (mult) => {
        for (const [k, v] of Object.entries(idle.res)) S.resources[k] = (S.resources[k] || 0) + v * mult;
        if (idle.renown > 0) S.stats.renown += idle.renown * mult;
        if (idle.xp > 0) addXP(idle.xp * mult);
        // Racha (sin multiplicar) una sola vez
        if (!S.streak.claimedToday) {
            for (const [k, v] of Object.entries(streakRes)) {
                if (k === 'renown') S.stats.renown += v; else S.resources[k] = (S.resources[k] || 0) + v;
            }
            S.streak.claimedToday = true;
        }
        if (mult > 1) { fireConfetti(); screenFlash('gold'); }
        log('Recompensas de bienvenida aplicadas.', 'good');
        overlay.classList.add('hidden');
        renderResources(); updateTags(); saveState();
    };

    closeBtn.onclick = () => applyAndClose(1);
    x2Btn.onclick = () => applyAndClose(2);

    overlay.classList.remove('hidden');
}

function resumeIdleProgress() {
    const elapsed = now() - S.lastTick;
    if (elapsed > 10000 && S.started) {
        showWelcomeBack(elapsed);
    } else if (elapsed > 5000) {
        const mins = Math.floor(elapsed / 1000);
        S.time.minutes += mins;
        const passiveWood = Math.floor(mins / 90);
        if (passiveWood > 0) S.resources.lenia += passiveWood;
    }
}

import { AudioSystem } from './audio.js';

function startGame() {
    if (S.started) return;
    S.started = true;
    saveState();
    try {
        AudioSystem.playMusic('audio1.mp3');
    } catch (e) { }
    startOverlay.classList.add('hidden');
    log('Despiertas en una habitación fría. Una fogata apagada te acompaña.', '');
    addChronicle('🌘', 'Despiertas en una habitación fría de Andalucía.', 'start');

    checkStreak();
    integrator.initializeSystems(S);
    updateSectionVisibility();
    import('./tutorial.js').then(m => {
        if (!m.default.completed) m.default.start();
    });
}

// ===== TAMAÑO DE TEXTO (Ajustes) =====
// 1 = normal, 2 = grande, 3 = muy grande. Escala el font-size raíz: casi todo el CSS va en rem.
function readFontScale() {
    try { const v = parseInt(localStorage.getItem('lys_font_scale'), 10); return v >= 1 && v <= 3 ? v : 1; } catch (e) { return 1; }
}
function applyFontScale(v) {
    if (v > 1) document.documentElement.setAttribute('data-font', String(v));
    else document.documentElement.removeAttribute('data-font');
}

// ===== THEME TOGGLE =====
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    S.theme = theme;
}

// ===== SKILLS UI (con senda Luz/Sombra + reespecializar) =====
const RESPEC_COST = 10;
function renderSkills() {
    const body = $('#skillsBody');
    const badge = $('#skillPointsBadge');
    if (!body) return;
    if (badge) badge.textContent = `${S.skillPoints || 0} pts`;

    import('./constants.js').then(({ SKILLS }) => {
        // Sin senda elegida: mostrar selector exclusivo
        if (!S.alignment) {
            body.innerHTML = `
              <p class="align-intro">Elige tu senda. Define qué rama podrás aprender (puedes reespecializar luego).</p>
              <div class="align-choices">
                <button class="align-btn luz" data-align="luz"><span class="align-icon">☀️</span><b>Luz</b><small>Recolección, producción y aldeanos</small></button>
                <button class="align-btn sombra" data-align="sombra"><span class="align-icon">🌙</span><b>Sombra</b><small>Combate, crítico y botín</small></button>
              </div>`;
            body.querySelectorAll('.align-btn').forEach(btn => btn.onclick = () => {
                S.alignment = btn.dataset.align;
                addChronicle(S.alignment === 'luz' ? '☀️' : '🌙', `Elegiste la senda de ${S.alignment === 'luz' ? 'la Luz' : 'la Sombra'}.`);
                log(`Has elegido la senda de ${S.alignment === 'luz' ? 'la Luz ☀️' : 'la Sombra 🌙'}.`, 'good');
                toast(S.alignment === 'luz' ? '☀️ Senda de la Luz' : '🌙 Senda de la Sombra');
                AudioSystem.playTone('levelup'); screenFlash('gold');
                saveState(); renderSkills();
            });
            return;
        }

        const categories = { gather: 'Recolección', combat: 'Combate', production: 'Producción' };
        const branchLabel = S.alignment === 'luz' ? '☀️ Luz' : '🌙 Sombra';
        let html = `<div class="align-header">Senda: <b>${branchLabel}</b></div><div class="skills-grid">`;
        for (const [cat, catLabel] of Object.entries(categories)) {
            const inCat = Object.entries(SKILLS).filter(([k, s]) => s.category === cat && s.branch === S.alignment);
            if (!inCat.length) continue;
            html += `<div class="skill-category-title">${catLabel}</div>`;
            for (const [key, skill] of inCat) {
                const lvl = S.skills[key] || 0;
                const maxed = lvl >= skill.maxLevel;
                const canLearn = S.skillPoints >= skill.cost && !maxed;
                html += `
                <div class="skill-item">
                    <span class="skill-icon">${skill.icon}</span>
                    <div class="skill-info">
                        <div class="skill-name">${skill.name}</div>
                        <div class="skill-desc">${skill.desc}</div>
                        <div class="skill-level">${maxed ? 'MAX' : `Nivel ${lvl}/${skill.maxLevel}`} — Coste: ${skill.cost} pts</div>
                    </div>
                    <button class="skill-btn" data-skill="${key}" ${canLearn ? '' : 'disabled'}>+</button>
                </div>`;
            }
        }
        html += '</div>';
        html += `<button class="action respec-btn" id="respecBtn">🔄 Reespecializar (${RESPEC_COST} renombre)</button>`;
        body.innerHTML = html;

        body.querySelectorAll('.skill-btn').forEach(btn => {
            btn.onclick = () => {
                const sk = btn.dataset.skill;
                const skill = SKILLS[sk];
                if (!skill || S.skillPoints < skill.cost) return;
                if ((S.skills[sk] || 0) >= skill.maxLevel) return;
                S.skills[sk] = (S.skills[sk] || 0) + 1;
                S.skillPoints -= skill.cost;
                log(`Habilidad mejorada: ${skill.name} (Nivel ${S.skills[sk]})`, 'good');
                toast(`${skill.icon} ${skill.name} Nivel ${S.skills[sk]}`);
                saveState();
                renderSkills();
            };
        });

        const rb = body.querySelector('#respecBtn');
        if (rb) rb.onclick = () => {
            if ((S.stats.renown || 0) < RESPEC_COST) { toast(`Necesitas ${RESPEC_COST} de renombre`); return; }
            if (!confirm(`¿Reespecializar? Recuperas tus puntos y eliges senda de nuevo.\nCoste: ${RESPEC_COST} renombre.`)) return;
            let spent = 0;
            for (const [k, s] of Object.entries(SKILLS)) spent += (S.skills[k] || 0) * s.cost;
            S.stats.renown -= RESPEC_COST;
            S.skillPoints = (S.skillPoints || 0) + spent;
            S.skills = {};
            S.alignment = null;
            toast('🔄 Habilidades reiniciadas');
            saveState(); renderSkills(); renderResources();
        };
    });
}

// ===== MARKET UI =====
function renderMarket() {
    const body = $('#marketBody');
    if (!body) return;

    import('./constants.js').then(({ TRADE_GOODS, RES_META }) => {
        // Generate prices (fluctuate based on game time)
        const seed = S.time.day * 7 + Math.floor(S.time.minutes / 360);
        let html = '<div class="market-grid">';
        TRADE_GOODS.forEach(good => {
            const meta = RES_META[good.key];
            if (!meta) return;
            const fluctuation = Math.sin(seed * 0.7 + good.key.length) * good.volatility;
            const buyPrice = Math.max(1, Math.round(good.basePrice * (1 + fluctuation)));
            const trend = fluctuation > 0.1 ? 'up' : fluctuation < -0.1 ? 'down' : '';
            const trendArrow = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—';

            const tradeDiscount = (S.skills?.tradeSkill || 0) * 0.15;
            const discountedBuy = Math.max(1, Math.round(buyPrice * (1 - tradeDiscount)));
            // Vender SIEMPRE por debajo de lo que cuesta comprar (si no, tradeSkill alto = renombre infinito)
            const sellPrice = Math.max(1, Math.round(discountedBuy * 0.5));
            const playerHas = Math.floor(S.resources[good.key] || 0);
            const canBuy = S.stats.renown >= discountedBuy;
            const canSell = playerHas >= 1;

            html += `
            <div class="market-item">
                <span class="market-resource">${meta.icon} ${meta.label} (${formatNumber(playerHas)})</span>
                <span class="market-price ${trend}">${trendArrow} ${discountedBuy}R</span>
                <div class="market-actions">
                    <button class="market-btn buy" data-key="${good.key}" data-price="${discountedBuy}" ${canBuy ? '' : 'disabled'}>Comprar</button>
                    <button class="market-btn sell" data-key="${good.key}" data-price="${sellPrice}" ${canSell ? '' : 'disabled'}>Vender</button>
                </div>
            </div>`;
        });
        html += '</div>';
        html += '<p style="font-size:0.72rem;color:var(--muted);margin:8px 0 0;text-align:center">Los precios cambian según el día. R = Renombre.</p>';
        body.innerHTML = html;

        body.querySelectorAll('.market-btn.buy').forEach(btn => {
            btn.onclick = () => {
                const key = btn.dataset.key;
                const price = parseInt(btn.dataset.price);
                if (S.stats.renown < price) return;
                S.stats.renown -= price;
                S.resources[key] = (S.resources[key] || 0) + 1;
                log(`Compraste 1 ${RES_META[key]?.label} por ${price} renombre.`, '');
                saveState(); renderResources(); renderMarket();
            };
        });
        body.querySelectorAll('.market-btn.sell').forEach(btn => {
            btn.onclick = () => {
                const key = btn.dataset.key;
                const price = parseInt(btn.dataset.price);
                if ((S.resources[key] || 0) < 1) return;
                S.resources[key]--;
                S.stats.renown += price;
                log(`Vendiste 1 ${RES_META[key]?.label} por ${price} renombre.`, '');
                saveState(); renderResources(); renderMarket();
            };
        });
    });
}

// ===== EXPANDED CRAFTING UI =====
function renderCrafting() {
    const body = $('#craftingBody');
    if (!body) return;

    import('./constants.js').then(({ CRAFT_RECIPES, RES_META }) => {
        let html = '<div class="craft-grid">';
        for (const [key, recipe] of Object.entries(CRAFT_RECIPES)) {
            if (recipe.requires && !S.unlocked[recipe.requires]) continue;
            const costStr = Object.entries(recipe.cost).map(([r, n]) => `${RES_META[r]?.icon || r}${n}`).join(' ');
            const canCraft = Object.entries(recipe.cost).every(([r, n]) => (S.resources[r] || 0) >= n);
            html += `
            <div class="craft-item">
                <span class="craft-icon">${recipe.icon}</span>
                <div class="craft-info">
                    <div class="craft-name">${recipe.name}</div>
                    <div class="craft-cost">${costStr}</div>
                    ${recipe.desc ? `<div class="craft-desc">${recipe.desc}</div>` : ''}
                </div>
                <button class="skill-btn" data-craft="${key}" ${canCraft ? '' : 'disabled'}>+</button>
            </div>`;
        }
        html += '</div>';
        body.innerHTML = html;

        body.querySelectorAll('[data-craft]').forEach(btn => {
            btn.onclick = () => {
                const rk = btn.dataset.craft;
                const recipe = CRAFT_RECIPES[rk];
                if (!recipe) return;
                // Check costs
                for (const [r, n] of Object.entries(recipe.cost)) {
                    if ((S.resources[r] || 0) < n) return;
                }
                // Deduct costs
                for (const [r, n] of Object.entries(recipe.cost)) {
                    S.resources[r] -= n;
                }
                // Give items
                for (const [r, n] of Object.entries(recipe.gives)) {
                    if (['espada', 'armadura', 'escudo'].includes(r)) {
                        S.equipment[r] = (S.equipment[r] || 0) + n;
                    } else if (['pocion', 'bomba', 'pan'].includes(r)) {
                        S.consumables[r] = (S.consumables[r] || 0) + n;
                    } else {
                        S.resources[r] = (S.resources[r] || 0) + n;
                    }
                }
                addXP(recipe.xp || 3);
                xpFlash();
                log(`Has fabricado: ${recipe.name}`, 'good');
                toast(`${recipe.icon} ${recipe.name}`);
                integrator.onItemCrafted(S, rk, 1, log);
                saveState(); renderResources(); renderCrafting();
            };
        });
    });
}

// ===== WAVE MODE =====
function initWaveMode() {
    const section = $('#waveSection');
    const body = $('#waveBody');
    const btnStart = $('#btnStartWave');
    if (!section || !btnStart) return;

    // Show wave section after defeating 5 bosses
    if (S.stats.bossesDefeated >= 5) {
        section.style.display = '';
    }

    btnStart.onclick = () => {
        if (isCombatOpen()) return;
        const wave = (S.waveMode?.wave || 0) + 1;   // oleada a intentar (NO se persiste hasta vencer)
        import('./constants.js').then(({ WAVE_CONFIG }) => {
            const hp = Math.floor(WAVE_CONFIG.baseHp + WAVE_CONFIG.hpPerWave * wave);
            const atk = Math.floor(WAVE_CONFIG.baseAtk + WAVE_CONFIG.atkPerWave * wave);
            const icon = WAVE_CONFIG.icons[Math.min(wave - 1, WAVE_CONFIG.icons.length - 1)];
            const name = WAVE_CONFIG.names[Math.min(Math.floor((wave - 1) / 2), WAVE_CONFIG.names.length - 1)] + ` (Oleada ${wave})`;

            import('./combat.js').then(({ startEnemyEncounter }) => {
                startEnemyEncounter({
                    name, icon, hp, atk, level: wave * 2,
                    isWave: true, waveNumber: wave,   // combat avanza S.waveMode.wave SOLO al vencer
                    loot: [{ k: 'hierro', n: [wave, wave + 2] }]
                });
            });
        });
    };

    // Mantener el texto del botón sincronizado con la oleada superada (la victoria actualiza S.waveMode.wave)
    const syncWaveBtn = () => { btnStart.textContent = `Comenzar Oleada ${(S.waveMode?.wave || 0) + 1}`; };
    syncWaveBtn();
    window.addEventListener('lys-actions-refresh', syncWaveBtn);
}

// ===== CONTEXTUAL TIPS =====
function showContextTip(tipKey, message) {
    if (S.tutorialTips[tipKey]) return;
    S.tutorialTips[tipKey] = true;
    saveState();

    const tip = document.createElement('div');
    tip.className = 'context-tip';
    tip.textContent = message;
    tip.onclick = () => tip.remove();
    document.body.appendChild(tip);
    setTimeout(() => tip.remove(), 6000);
}

function checkContextualTips() {
    if (S.unlocked.crafting && !S.tutorialTips.crafting) {
        showContextTip('crafting', 'Has desbloqueado la artesanía. Visita "Más" para fabricar objetos.');
    }
    if (S.unlocked.village && !S.tutorialTips.village) {
        showContextTip('village', 'Puedes reclutar aldeanos para producción pasiva de recursos.');
    }
    if (S.unlocked.expedition && !S.tutorialTips.expedition) {
        showContextTip('expedition', 'Las expediciones te permiten explorar regiones lejanas. Visita el Mapa.');
    }
    if (S.stats.bossesDefeated >= 1 && !S.tutorialTips.equipment) {
        showContextTip('equipment', 'Fabrica armas y armaduras en el Taller para mejorar en combate.');
    }
    if (S.player.level >= 3 && S.skillPoints > 0 && !S.tutorialTips.skills) {
        showContextTip('skills', 'Tienes puntos de habilidad. Visita "Más" para mejorar tus habilidades.');
    }
    if (S.stats.bossesDefeated >= 5 && !S.tutorialTips.waves) {
        showContextTip('waves', 'Has desbloqueado las Oleadas Infinitas. ¿Hasta dónde llegarás?');
    }
}

// ===== REVELADO PROGRESIVO DE SECCIONES (menos agobio inicial, ritmo escalonado) =====
function announceUnlock(label) {
    showEventBanner(`🔓 ¡Desbloqueado: ${label}!`, 'opportunity');
    toast(`🔓 ${label}`);
    try { AudioSystem.playTone('levelup'); } catch (e) { }
    if (navigator.vibrate) navigator.vibrate([40, 30, 60]);
    fireConfetti();
    const masTab = document.querySelector('.tab[data-tab="tabMas"]');
    if (masTab) { masTab.classList.remove('tab-flash'); void masTab.offsetWidth; masTab.classList.add('tab-flash'); }
}

// Brasas ambientales flotantes (puro adorno; se omiten si el usuario prefiere menos movimiento)
function spawnEmbers() {
    const amb = $('#ambient');
    if (!amb) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const count = window.innerWidth < 600 ? 10 : 18;
    let html = '';
    for (let i = 0; i < count; i++) {
        const x = (Math.random() * 100).toFixed(1);
        const dur = (9 + Math.random() * 10).toFixed(1);
        const delay = (-Math.random() * dur).toFixed(1);
        const drift = (Math.random() * 44 - 22).toFixed(0);
        const size = (4 + Math.random() * 5).toFixed(1);
        html += `<span class="ember" style="--x:${x}%;--dur:${dur}s;--delay:${delay}s;--drift:${drift}px;width:${size}px;height:${size}px"></span>`;
    }
    amb.innerHTML = html;
}

let _revealInit = false;
function updateSectionVisibility() {
    const set = (sel, show) => { const el = $(sel); if (!el) return; const v = show ? '' : 'none'; if (el.style.display !== v) el.style.display = v; };
    const skillsOn = S.player.level >= 3 || (S.skillPoints || 0) > 0 || Object.keys(S.skills || {}).length > 0;
    const marketOn = (S.stats.renown || 0) >= 12 || !!S.unlocked.expedition;          // mercado más tarde
    const craftOn = !!S.unlocked.crafting;
    const notesOn = craftOn || S.player.level >= 2;
    const achOn = Object.keys(S.achievements || {}).length >= 1;
    const waveOn = (S.stats.bossesDefeated || 0) >= 5;
    const bestiaryOn = Object.keys(S.bestiary || {}).length > 0;
    const legacyOn = (S.stats.renown || 0) >= 50 || (S.prestige || 0) > 0 || (S.legacy || 0) > 0;

    if (!S.revealed) S.revealed = {};
    const sections = [
        ['craftingSection', craftOn, '🔨 Taller de Artesanía', true],
        ['skillsSection', skillsOn, '⭐ Habilidades', true],
        ['marketSection', marketOn, '🪙 Mercado', true],
        ['waveSection', waveOn, '🌊 Oleadas Infinitas', true],
        ['legacySection', legacyOn, '🏛️ Prestigio y Legado', true],
        ['notesSection', notesOn, 'Notas', false],
        ['achievementsSection', achOn, 'Logros', false],
        ['bestiarySection', bestiaryOn, '📖 Bestiario', true],
    ];
    let changed = false;
    sections.forEach(([sel, show, label, announce]) => {
        set('#' + sel, show);
        if (show && !S.revealed[sel]) {
            S.revealed[sel] = true; changed = true;
            const el = $('#' + sel);
            if (_revealInit) {                 // no anunciar lo ya desbloqueado al cargar
                if (announce) announceUnlock(label);
                if (el) { el.classList.remove('section-reveal'); void el.offsetWidth; el.classList.add('section-reveal'); }
            }
        }
    });
    if (changed) saveState();
    set('#masLockedHint', !(skillsOn || marketOn || craftOn));
    _revealInit = true;
}

function init() {
    loadState();
    // Partidas anteriores a la Crónica: apuntar desde dónde se empieza a escribir
    if (S.started && !S.chronicle.length) addChronicle('📜', `La crónica empieza a escribirse: día ${S.time.day}, nivel ${S.player.level}.`, 'start');
    backupSave();   // copia de seguridad del guardado con el que empieza la sesión
    applyTheme(S.theme || 'dark');
    if (localStorage.getItem('lys_reduce_motion') === '1') document.documentElement.setAttribute('data-reduce-motion', '1');
    applyFontScale(readFontScale());
    integrator.initializeSystems(S);
    initTabs();
    checkStreak();
    resumeIdleProgress();

    setProductionRates(productionRates());
    renderResources();
    tryUnlocks();
    renderSettlement();
    bindScene($('#villageScene'));
    renderScene($('#villageScene'));
    renderAchievements();
    renderBestiary();
    updateTags();
    renderNotes();
    renderMap();
    renderSkills();
    renderMarket();
    renderCrafting();
    renderLegacy();
    updateContracts();
    renderContracts(true);
    initWaveMode();
    updateWeatherVisuals(S.weather);
    updateSectionVisibility();
    spawnEmbers();

    setInterval(gameTick, 1000);
    setInterval(saveState, 10000);
    setInterval(() => { if (saveState()) backupSave(); }, 30 * 60 * 1000);
    setInterval(updateCooldownVisuals, 100);
    setInterval(() => { renderMarket(); renderCrafting(); renderSkills(); renderLegacy(); }, 30000);

    window.addEventListener('lys-actions-refresh', () => { renderSettlement(); refreshOpenLocation(); renderCrafting(); renderSkills(); renderLegacy(); updateSectionVisibility(); });
    window.addEventListener('lys-show-map', renderMap);
    renderChronicle($('#chronicle'), $('#chronicleCount'));
    window.addEventListener('lys-chronicle', () => renderChronicle($('#chronicle'), $('#chronicleCount')));
    window.addEventListener('lys-skills-refresh', () => { renderSkills(); updateSectionVisibility(); });
    document.body.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            AudioSystem.playTone('click');
        }
    });

    if (S.started) {
        startOverlay.classList.add('hidden');
    }
    if (restoredFromBackup) {
        log('⚠️ Tu guardado estaba dañado: se ha recuperado la última copia de seguridad.', 'bad');
        toast('💾 Partida recuperada de la copia de seguridad');
    }
    renderBackupInfo();

    // Check contextual tips periodically
    setInterval(checkContextualTips, 5000);
}

startBtn.addEventListener('click', startGame);
if (audioBtn) {
    const syncAudioBtn = () => {
        audioBtn.textContent = AudioSystem.muted ? '🔈' : '🔊';
        audioBtn.setAttribute('aria-label', AudioSystem.muted ? 'Activar sonido' : 'Silenciar sonido');
        audioBtn.setAttribute('aria-pressed', String(!AudioSystem.muted));
    };
    syncAudioBtn();
    audioBtn.addEventListener('click', () => {
        const isMuted = AudioSystem.toggle();
        if (!isMuted && !AudioSystem.audio) AudioSystem.playMusic('audio1.mp3');
        syncAudioBtn();
    });
}

// ===== INSTALAR PWA =====
let deferredPrompt = null;
const btnInstall = $('#btnInstall');
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstall && (S.player.level >= 2 || (S.streak?.current || 0) >= 1)) btnInstall.style.display = '';
});
if (btnInstall) {
    btnInstall.onclick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        try { await deferredPrompt.userChoice; } catch (e) { }
        deferredPrompt = null;
        btnInstall.style.display = 'none';
    };
}
window.addEventListener('appinstalled', () => {
    if (btnInstall) btnInstall.style.display = 'none';
    deferredPrompt = null;
    toast('📲 ¡App instalada!');
});

// Theme toggle
const btnTheme = $('#btnTheme');
if (btnTheme) {
    btnTheme.onclick = () => {
        const next = S.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        saveState();
        toast(`Tema: ${next === 'dark' ? 'Oscuro' : 'Claro'}`);
    };
}

const btnExport = $('#btnExport');
const btnImport = $('#btnImport');
const btnWipe = $('#btnWipe');
const sysFooter = $('#sysFooter');

// Código de guardado: base64 de UTF-8 (btoa a secas falla con emojis, p. ej. con un boss activo)
function encodeSave(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
}
function decodeSave(str) {
    const bin = atob(str.replace(/\s+/g, ''));
    try {
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    } catch (e) {
        return JSON.parse(bin);   // códigos antiguos: btoa directo sobre texto latin-1
    }
}

if (btnExport) {
    btnExport.onclick = async () => {
        let str;
        try { saveState(); str = encodeSave(S); } catch (e) { log('Error exportando.', 'bad'); return; }
        let copied = false;
        try { await navigator.clipboard.writeText(str); copied = true; } catch (e) { }
        if (copied) { log('Partida copiada al portapapeles.', 'good'); toast('📋 Copiado'); }
        // Menú nativo de compartir: app Android (puente) o navegador móvil (Web Share)
        const text = `Luz y Sombra — código de guardado (Nv ${S.player.level}):\n${str}`;
        if (window.LysAndroid && window.LysAndroid.share) {
            window.LysAndroid.share(text);
        } else if (navigator.share) {
            navigator.share({ title: 'Luz y Sombra', text }).catch(() => { });
        } else if (!copied) {
            prompt('Copia tu código de guardado:', str);
        }
    };
}

if (btnImport) {
    btnImport.onclick = () => {
        let str = prompt('Pega aquí tu código de guardado:');
        if (str) {
            str = str.includes(':') ? str.slice(str.lastIndexOf(':') + 1) : str;   // admite el texto compartido completo
            try {
                const json = decodeSave(str);
                if (json && json.resources) {
                    backupSave();   // por si el código importado no era el bueno
                    localStorage.setItem('lys_save_v2', JSON.stringify(json));
                    reloadWithoutSaving();
                } else {
                    alert('Código inválido.');
                }
            } catch (e) { alert('Error al importar. Código corrupto.'); }
        }
    };
}

// ===== PRESTIGIO / LEGADO =====
const PRESTIGE_COST = 50;
function legacyGain() {
    return Math.floor(Math.sqrt(Math.max(0, S.stats.renown) / 10)) + Math.floor(S.player.level / 4) + 1;
}
function ascend() {
    if (S.stats.renown < PRESTIGE_COST) { toast(`Necesitas ${PRESTIGE_COST} de renombre`); return; }
    const gained = legacyGain();
    if (!confirm(`¿Ascender al Prestigio ${(S.prestige || 0) + 1}?\n\nReinicia nivel, habilidades, recursos y edificios — pero ganas ${gained} ✦ Reliquias PERMANENTES para el árbol de Legado.`)) return;
    const legacy = legacyEffects();
    const keep = legacy.keepResources || 0;
    const ns = blank();
    ns.started = true;
    ns.prestige = (S.prestige || 0) + 1;
    ns.legacy = (S.legacy || 0) + gained;
    ns.legacyUpgrades = S.legacyUpgrades || {};
    ns.achievements = S.achievements;
    ns.bestiary = S.bestiary || {};
    addChronicle('🏛️', `Ascendiste al Prestigio ${(S.prestige || 0) + 1} y ganaste ${gained} ✦ Reliquias.`);
    ns.chronicle = S.chronicle || [];
    ns.chronicleKeys = S.chronicleKeys || {};
    ns.streak = S.streak;
    ns.revealed = S.revealed;
    ns.alignment = null;                 // re-elegir senda
    ns.time = { day: 1, minutes: 480 };
    ns.theme = S.theme;                                   // conservar preferencias visuales
    ns.tutorialTips = S.tutorialTips;
    ns.people.villagers = legacy.startVillagers || 0;     // Clan Fundador
    ns.skillPoints = legacy.startSkillPoints || 0;        // Talento Innato
    if (keep > 0) for (const k of Object.keys(ns.resources)) ns.resources[k] = Math.floor((S.resources[k] || 0) * keep);  // Riquezas Guardadas
    fireConfetti(); screenFlash('gold');
    Object.assign(S, ns);   // sincronizar la S en memoria (un autoguardado concurrente no revierte el ascenso)
    localStorage.setItem('lys_save_v2', JSON.stringify(ns));
    setTimeout(() => location.reload(), 400);
}

function renderLegacy() {
    const body = $('#legacyBody');
    const badge = $('#legacyBadge');
    if (!body) return;
    if (badge) badge.textContent = `${S.legacy || 0} ✦`;
    const gained = legacyGain();
    const canAscend = S.stats.renown >= PRESTIGE_COST;
    let html = `
      <div class="legacy-head">
        <div>Prestigio <b>${S.prestige || 0}</b></div>
        <div>Reliquias <b>${S.legacy || 0} ✦</b></div>
      </div>
      <button class="action glow-btn" id="ascendBtn" ${canAscend ? '' : 'disabled'}>⬆️ Ascender (+${gained} ✦)</button>
      <p class="legacy-note">Cuesta ${PRESTIGE_COST} renombre. Reinicia el progreso; las Reliquias y sus mejoras son permanentes.</p>
      <div class="legacy-grid">`;
    for (const [k, up] of Object.entries(LEGACY_UPGRADES)) {
        const lvl = S.legacyUpgrades?.[k] || 0;
        const maxed = lvl >= up.max;
        const c = up.cost(lvl);
        const can = !maxed && (S.legacy || 0) >= c;
        html += `
        <div class="legacy-item">
            <span class="legacy-icon">${up.icon}</span>
            <div class="legacy-info">
                <div class="legacy-name">${up.name}</div>
                <div class="legacy-desc">${up.desc}</div>
                <div class="legacy-lvl">${maxed ? 'MAX' : `Nv ${lvl}/${up.max} · ${c} ✦`}</div>
            </div>
            <button class="skill-btn" data-legacy="${k}" ${can ? '' : 'disabled'}>+</button>
        </div>`;
    }
    html += '</div>';
    body.innerHTML = html;
    const ab = body.querySelector('#ascendBtn');
    if (ab) ab.onclick = ascend;
    body.querySelectorAll('[data-legacy]').forEach(btn => btn.onclick = () => {
        const k = btn.dataset.legacy, up = LEGACY_UPGRADES[k], lvl = S.legacyUpgrades?.[k] || 0;
        if (!up || lvl >= up.max) return;
        const c = up.cost(lvl);
        if ((S.legacy || 0) < c) return;
        S.legacy -= c;
        if (!S.legacyUpgrades) S.legacyUpgrades = {};
        S.legacyUpgrades[k] = lvl + 1;
        toast(`${up.icon} ${up.name} Nv ${lvl + 1}`);
        AudioSystem.playTone('build'); screenFlash('gold');
        saveState(); renderLegacy();
    });
}

if (btnWipe) {
    btnWipe.onclick = () => {
        if (confirm('¿Borrar TODO el progreso? No hay vuelta atrás.')) {
            localStorage.removeItem('lys_save_v2');
            localStorage.removeItem('lys_save_v1');
            reloadWithoutSaving();
        }
    };
}

// ===== COPIA DE SEGURIDAD =====
const btnRestore = $('#btnRestore');
function renderBackupInfo() {
    if (!btnRestore) return;
    const info = backupInfo();
    btnRestore.style.display = info ? '' : 'none';
    if (info) btnRestore.title = `Copia de hace ${fmtMs(now() - info.at)} (Nv ${info.level}${info.prestige ? `, Prestigio ${info.prestige}` : ''})`;
}
if (btnRestore) {
    btnRestore.onclick = () => {
        const info = backupInfo();
        if (!info) { toast('No hay copia de seguridad'); return; }
        const extra = info.prestige ? `, Prestigio ${info.prestige}` : '';
        if (!confirm(`¿Restaurar la copia de seguridad de hace ${fmtMs(now() - info.at)} (Nivel ${info.level}${extra})?\n\nPerderás el progreso posterior a esa copia.`)) return;
        if (restoreBackup()) reloadWithoutSaving();
        else toast('No se pudo restaurar la copia');
    };
}

const btnStats = $('#btnStats');
if (btnStats) {
    btnStats.addEventListener('click', showStatistics);
}

// ===== FILTROS DEL DIARIO =====
const logFilters = $('#logFilters');
if (logFilters) {
    logFilters.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        logFilters.querySelectorAll('.chip').forEach(c => {
            const on = c === chip;
            c.classList.toggle('active', on);
            c.setAttribute('aria-pressed', String(on));
        });
        const logEl = $('#log');
        if (logEl) { logEl.dataset.filter = chip.dataset.filter; logEl.scrollTop = logEl.scrollHeight; }
    });
}

// ===== COMPARTIR PROGRESO =====
function progressSummary() {
    const season = seasonOf(S.time.day);
    const lines = [
        '🌘 Luz y Sombra: El Alba de Hispania',
        `⭐ Nivel ${S.player.level}${S.prestige ? ` · 🏛️ Prestigio ${S.prestige}` : ''}`,
        `📅 Día ${S.time.day} · ${season.icon} ${season.name}`,
        `🏅 ${formatNumber(Math.floor(S.stats.renown || 0))} de renombre · 👥 ${S.people.villagers || 0} aldeanos`,
        `⚔️ ${S.stats.bossesDefeated || 0} bosses derrotados · 📖 ${Object.keys(S.bestiary || {}).length} criaturas en el bestiario`,
    ];
    if ((S.waveMode?.wave || 0) > 0) lines.push(`🌊 Oleada máxima: ${S.waveMode.wave}`);
    if ((S.streak?.current || 0) > 0) lines.push(`🔥 Racha de ${S.streak.current} ${S.streak.current === 1 ? 'día' : 'días'}`);
    lines.push('¿Te atreves a superarlo?');
    return lines.join('\n');
}
const btnShare = $('#btnShare');
if (btnShare) {
    btnShare.onclick = async () => {
        const text = progressSummary();
        if (window.LysAndroid && window.LysAndroid.share) { window.LysAndroid.share(text); return; }
        if (navigator.share) {
            try { await navigator.share({ title: 'Luz y Sombra', text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
        }
        try { await navigator.clipboard.writeText(text); toast('📋 Resumen copiado'); }
        catch (e) { prompt('Copia tu resumen:', text); }
    };
}

// ===== ATAJOS DE TECLADO (escritorio) =====
const TAB_KEYS = { '1': 'tabAldea', '2': 'tabDiario', '3': 'tabMapa', '4': 'tabMas' };
const COMBAT_KEYS = { a: '#btnAttack', d: '#btnDefend', c: '#btnHeal', e: '#btnDodge', p: '#btnPotion', h: '#btnBomb' };
const isOpen = (sel) => { const el = $(sel); return !!el && !el.classList.contains('hidden'); };
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const k = e.key.toLowerCase();

    if (k === 'escape') {
        // Modales creados al vuelo (Estadísticas, fichas): el más reciente primero
        const dyn = [...document.querySelectorAll('.overlay:not(.hidden)')].reverse().find(o => o.querySelector('#closeStatsBtn, [data-close]'));
        const btn = dyn ? dyn.querySelector('#closeStatsBtn, [data-close]')
            : isOpen('#settingsOverlay') ? $('#settingsCloseBtn')
            : isOpen('#levelUpOverlay') ? $('#levelUpCloseBtn')
            : isOpen('#fightOverlay') ? $('#fightCloseBtn')
            : isOpen('#locationOverlay') ? $('#locationCloseBtn')
            : null;
        if (btn) { e.preventDefault(); btn.click(); }
        return;
    }
    if (isOpen('#fightOverlay')) {
        const b = COMBAT_KEYS[k] && $(COMBAT_KEYS[k]);
        if (b && !b.disabled) { e.preventDefault(); b.click(); }
        return;
    }
    if (TAB_KEYS[k] && !document.querySelector('.overlay:not(.hidden)')) {
        e.preventDefault();
        switchTab(TAB_KEYS[k]);
    }
});

// ===== AJUSTES =====
const btnSettings = $('#btnSettings');
const settingsOverlay = $('#settingsOverlay');
if (btnSettings && settingsOverlay) {
    const volRange = $('#volRange'), vibToggle = $('#vibToggle'), motionToggle = $('#motionToggle'),
        themeToggle2 = $('#themeToggle2'), notifToggle2 = $('#notifToggle2');
    const onoff = (b) => b ? 'Activada' : 'Desactivada';
    let notifsRef = null;
    import('./notifications.js').then(m => { notifsRef = m.notifications; syncSettings(); });
    const syncSettings = () => {
        if (volRange) volRange.value = AudioSystem.volume;
        if (vibToggle) vibToggle.textContent = onoff(vibrateEnabled());
        if (motionToggle) motionToggle.textContent = onoff(document.documentElement.getAttribute('data-reduce-motion') === '1');
        if (themeToggle2) themeToggle2.textContent = S.theme === 'dark' ? '🌙 Oscuro' : '☀️ Claro';
        if (notifToggle2) notifToggle2.textContent = (notifsRef && notifsRef.enabled) ? 'Activados' : 'Desactivados';
        const fs = readFontScale();
        document.querySelectorAll('#fontSeg .seg-btn').forEach(b => {
            const on = parseInt(b.dataset.font, 10) === fs;
            b.classList.toggle('active', on);
            b.setAttribute('aria-checked', String(on));
        });
    };
    const fontSeg = $('#fontSeg');
    if (fontSeg) fontSeg.onclick = (e) => {
        const b = e.target.closest('.seg-btn'); if (!b) return;
        const v = parseInt(b.dataset.font, 10);
        try { localStorage.setItem('lys_font_scale', String(v)); } catch (err) { }
        applyFontScale(v); vibrate(15); syncSettings();
    };
    btnSettings.onclick = () => { syncSettings(); settingsOverlay.classList.remove('hidden'); };
    const closeS = () => settingsOverlay.classList.add('hidden');
    const sc = $('#settingsCloseBtn'); if (sc) sc.onclick = closeS;
    settingsOverlay.onclick = (e) => { if (e.target === settingsOverlay) closeS(); };
    if (volRange) volRange.oninput = () => {
        AudioSystem.setVolume(parseFloat(volRange.value));
        if (!AudioSystem.muted && !AudioSystem.audio) AudioSystem.playMusic('audio1.mp3');
    };
    if (vibToggle) vibToggle.onclick = () => { setVibrate(!vibrateEnabled()); vibrate(30); syncSettings(); };
    if (motionToggle) motionToggle.onclick = () => {
        const on = document.documentElement.getAttribute('data-reduce-motion') === '1';
        if (on) { document.documentElement.removeAttribute('data-reduce-motion'); localStorage.setItem('lys_reduce_motion', '0'); }
        else { document.documentElement.setAttribute('data-reduce-motion', '1'); localStorage.setItem('lys_reduce_motion', '1'); }
        syncSettings();
    };
    if (themeToggle2) themeToggle2.onclick = () => { applyTheme(S.theme === 'dark' ? 'light' : 'dark'); saveState(); syncSettings(); };
    if (notifToggle2) notifToggle2.onclick = async () => {
        if (!notifsRef) return;
        if (notifsRef.enabled) { notifsRef.enabled = false; localStorage.setItem('lys_notifications', 'disabled'); }
        else { await notifsRef.requestPermission(); }
        syncSettings();
    };
}

// Notificaciones (gancho de retorno): permite avisar de bosses, mercaderes y expediciones
const btnNotif = $('#btnNotif');
if (btnNotif) {
    import('./notifications.js').then(({ notifications }) => {
        const sync = () => { btnNotif.textContent = notifications.enabled ? '🔔 Avisos: ON' : '🔕 Activar avisos'; };
        sync();
        btnNotif.onclick = async () => {
            if (notifications.enabled) {
                notifications.enabled = false;
                localStorage.setItem('lys_notifications', 'disabled');
                toast('🔕 Avisos desactivados');
            } else {
                const ok = await notifications.requestPermission();
                toast(ok ? '🔔 Te avisaremos de bosses y mercaderes' : 'Permiso de avisos denegado');
            }
            sync();
        };
    });
}

setInterval(renderQuests, 5000);

// Recarga tras reemplazar/borrar el guardado en localStorage: el guardado de `beforeunload`
// (y el autoguardado) escribirían la S en memoria encima y desharían el cambio.
let _skipUnloadSave = false;
function reloadWithoutSaving() {
    _skipUnloadSave = true;
    location.reload();
}

window.addEventListener('beforeunload', () => {
    if (_skipUnloadSave) return;
    S.lastSessionEnd = now();
    integrator.endSession(S);
    saveState();
});

// ===== RECORDATORIOS (app Android) =====
// Al salir de la app se programan avisos locales nativos; al volver se cancelan.
function buildReminders() {
    const list = [];
    const t = now();
    const streak = S.streak?.current || 0;
    if (streak >= 1) {
        // La racha se pierde si no se entra mañana: avisar mañana por la tarde
        const at = new Date(); at.setDate(at.getDate() + 1); at.setHours(19, 0, 0, 0);
        list.push({
            id: 1, at: at.getTime(),
            title: `🔥 Tu racha de ${streak} ${streak === 1 ? 'día' : 'días'} peligra`,
            body: 'Vuelve hoy para mantenerla y reclamar tu recompensa diaria.'
        });
    }
    const producing = (S.people?.villagers || 0) > 0 || Object.values(S.buildings || {}).some(l => l > 0);
    if (producing) {
        const capHours = 8 + (legacyEffects().idleHours || 0);   // mismo tope que computeIdleGains
        list.push({
            id: 2, at: t + capHours * 3600 * 1000,
            title: '🏚️ Los almacenes de tu aldea están llenos',
            body: `Tu aldea lleva ${capHours} h trabajando sin ti. Vuelve a recoger lo producido.`
        });
    }
    return list.filter(r => r.at > t + 60 * 1000);
}
document.addEventListener('visibilitychange', () => {
    const bridge = window.LysAndroid;
    if (!bridge || !bridge.scheduleReminders) return;
    if (document.visibilityState === 'hidden') {
        if (notifications.enabled && S.started) bridge.scheduleReminders(JSON.stringify(buildReminders()));
    } else {
        bridge.cancelReminders();
    }
});

init();

window.S = S;
