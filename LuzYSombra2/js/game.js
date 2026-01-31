
import { $, now, fmtMs } from './utils.js';
import { S, loadState, saveState, resetState } from './state.js';
import { log, updateCooldownVisuals, updateTags, renderResources, renderNotes, renderAchievements, toast, setTip } from './ui.js';
import { renderActions, tryUnlocks, checkAchievements } from './actions.js';
import { renderMap } from './map.js';
import { showEncounterPrompt } from './combat.js';
import { BOSSES } from './constants.js';

const startOverlay = $('#startOverlay');
const startBtn = $('#startBtn');
const audioBtn = $('#audioBtn');

// Shared helpers (dupped from actions for now to avoid complex exports/refactor mid-flight)
function addRes(key, n) {
    S.resources[key] = (S.resources[key] || 0) + n;
    if (S.resources[key] > 0) {
        // discovery check logic is simple enough to skip or duplicate? 
        // actions.js handles discovery on render. here we are passive.
        // we can just let renderResources handle visual? 
        // discoveries are used to unlock buildings.
        if (!S.discoveries[key]) S.discoveries[key] = true;
    }
}

function spawnBoss() {
    const pool = BOSSES;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    S.threat = { key: pick.key, name: pick.name, icon: pick.icon, hp: pick.hp, max: pick.hp, endsAt: now() + pick.duration, region: pick.region };
    log(`${pick.name} emerge cerca de ${pick.region}.`, 'bad');
    showEncounterPrompt();
    if (!S.stats.bossTipShown) {
        setTip('Consejo: vuelve cada cierto tiempo para reclamar expediciones y bosses temporales.');
        S.stats.bossTipShown = true;
    }
}

function gameTick() {
    const nowTs = now();

    // Time
    S.time.minutes += 1;
    if (S.time.minutes >= (24 * 60)) { S.time.minutes = 0; S.time.day++; log('Amanece un nuevo día en Andalucía.', 'dim'); }

    // Weather Change (~every 600 ticks = 10 mins, randomized)
    if (Math.random() < 0.002) {
        const weathers = ['clear', 'clear', 'clear', 'rain', 'wind'];
        const next = weathers[Math.floor(Math.random() * weathers.length)];
        if (next !== S.weather) {
            S.weather = next;
            const wMsg = { clear: 'El cielo se despeja.', rain: 'Empieza a llover.', wind: 'Se levanta un fuerte viento.' };
            log(wMsg[next], 'dim');
        }
    }

    // Fire
    if (S.fire.lit) {
        let fuelCons = 0.05;
        let heatGain = 0.2 + (S.unlocked.molino ? 0.05 : 0);

        // Weather Effects
        if (S.weather === 'rain') { heatGain -= 0.1; } // Rain cools
        if (S.weather === 'wind') { fuelCons += 0.05; } // Wind consumes fuel faster

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

    // Passive effects
    const prestigeMult = 1 + ((S.prestige || 0) * 0.5);
    if (S.unlocked.acequia && Math.random() < (0.05 + heatBonus)) { addRes('agua', 1); }
    if (S.unlocked.molino && Math.random() < (0.05 + heatBonus) && S.resources.trigo > 0) {
        S.resources.trigo--;
        S.stats.renown += (1 * prestigeMult);
    }
    if (S.unlocked.forge && Math.random() < 0.02) { addRes('hierro', 1); }

    // Villager Jobs Production
    if (S.people.villagers > 0) {
        // Consumption: 0.1 food per villager per tick
        let needed = S.people.villagers * 0.1;
        // Prioritize Wheat (Trigo) then Olives (Aceitunas)
        if (S.resources.trigo >= needed) {
            S.resources.trigo -= needed;
        } else {
            let remain = needed - S.resources.trigo;
            S.resources.trigo = 0;
            if (S.resources.aceitunas >= remain) {
                S.resources.aceitunas -= remain;
            } else {
                S.resources.aceitunas = 0;
                // Starvation
                if (Math.random() < 0.05) { // 5% chance per tick to lose a villager if starving
                    S.people.villagers--;
                    // Remove from random job
                    const jobs = Object.keys(S.people.jobs).filter(k => S.people.jobs[k] > 0);
                    if (jobs.length > 0) {
                        const k = jobs[Math.floor(Math.random() * jobs.length)];
                        S.people.jobs[k]--;
                    }
                    log('Un aldeano ha muerto de hambre o abandonado la aldea.', 'bad');
                }
            }
        }

        if (S.people.jobs) {
            // Leñadores (10% chance per tick per worker)
            if (S.people.jobs.lumber > 0 && Math.random() < 0.1 * S.people.jobs.lumber) {
                addRes('lenia', 1);
            }
            // Granjeros (10% + bonus heat)
            if (S.people.jobs.farmer > 0) {
                let farmChance = 0.08 + (heatBonus * 2);
                if (S.weather === 'rain') farmChance += 0.05; // Rain bonus

                if (Math.random() < farmChance * S.people.jobs.farmer) {
                    addRes('trigo', 1);
                }
            }
            // Mineros (Stone/Iron) - Requires forge or discovery? Assumed if job assigned.
            if (S.people.jobs.miner > 0) {
                const mineChance = 0.05 * S.people.jobs.miner;
                if (Math.random() < mineChance) {
                    if (Math.random() < 0.7) addRes('piedra', 1);
                    else addRes('hierro', 1);
                }
            }
        }
    } else if ((S.people.villagers || 0) > 0 && !S.people.jobs) {
        // Fallback for saves without jobs init properly (should happen via migration though)
        if (Math.random() < (0.03 + heatBonus)) addRes('trigo', 1);
    }

    // Despawn boss
    if (S.threat && nowTs >= S.threat.endsAt) { log(`${S.threat.name} se desvanece entre la bruma.`, 'dim'); S.threat = null; }

    // Spawns
    // Boss
    if (!S.threat && S.time.day >= 2 && Math.random() < 0.006) { spawnBoss(); }

    // Trader (Rare, higher chance with Renown)
    if (!S.trader && !S.threat && S.time.day >= 3 && Math.random() < (0.002 + (S.stats.renown * 0.0001))) {
        const wants = Math.random() < 0.5 ? 'lenia' : 'trigo';
        S.trader = {
            endsAt: now() + 60000,
            wants: wants,
            gives: 'renown',
            rate: 20 // 20 units for 1 renown
        };
        log('Un mercader ambulante ha acampado cerca.', 'good');
        renderActions(); window.dispatchEvent(new CustomEvent('lys-actions-refresh'));
    }

    // Despawn Trader
    if (S.trader && nowTs >= S.trader.endsAt) {
        log('El mercader recoge sus cosas y se marcha.', 'dim');
        S.trader = null;
        renderActions(); window.dispatchEvent(new CustomEvent('lys-actions-refresh'));
    }

    // Update UI
    // We don't want to re-render buttons every tick, just stats
    updateTags();
    renderResources();
    checkAchievements();
    // renderMap(); // Map doesn't change on tick usually unless region unlock?
    // Map depends on region unlock which depends on day.
    // Efficiently: only if day changed? For now: KISS, renderMap is cheap? SVG dom manipulation is not super cheap.
    // Let's lazy render map? Or just on open.
    // Original rendered map on tick.
    renderMap();
    renderNotes();
    updateCooldownVisuals();
    S.lastTick = now();
}

function resumeIdleProgress() {
    const elapsed = now() - S.lastTick;
    if (elapsed > 5000) {
        const mins = Math.floor(elapsed / 1000);
        S.time.minutes += mins;
        const passiveWood = Math.floor(mins / 90);
        if (passiveWood > 0) S.resources.lenia += passiveWood;
        log(`Has estado fuera ${fmtMs(elapsed)}. Progreso idle aplicado.`, 'dim');
    }
}

import { AudioSystem } from './audio.js';

let audio = null; // Removed in favor of AudioSystem singleton logic, but we kept reference in original code. 
// We will replace implementation.

function startGame() {
    if (S.started) return;
    S.started = true;
    saveState();
    try {
        AudioSystem.playMusic('audio1.mp3');
    } catch (e) { }
    startOverlay.classList.add('hidden');
    log('Despiertas en una habitación fría. Una fogata apagada te acompaña.', '');
}

function init() {
    loadState();
    resumeIdleProgress();

    renderResources();
    tryUnlocks();
    renderActions();
    renderAchievements();
    updateTags();
    renderNotes();
    renderMap();

    setInterval(gameTick, 1000);
    setInterval(saveState, 10000);
    // Cooldown visuals are updated in gameTick (1s) in original? No, 100ms in original.
    // Here I put it in gameTick. I should separate it for smooth UI.
    setInterval(updateCooldownVisuals, 100);

    // Global listeners
    window.addEventListener('lys-actions-refresh', renderActions);
    document.body.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            AudioSystem.playTone('click');
        }
    });

    // Achievement listener moved to actions.js

    if (S.started) {
        startOverlay.classList.add('hidden');
    }
}

// Bindings
startBtn.addEventListener('click', startGame);
if (audioBtn) {
    // Sync initial state
    if (AudioSystem.muted) audioBtn.textContent = '🔈 Audio';
    else audioBtn.textContent = '🔊 Audio';

    audioBtn.addEventListener('click', () => {
        const isMuted = AudioSystem.toggle();
        audioBtn.textContent = isMuted ? '🔈 Audio' : '🔊 Audio';
        if (!isMuted && !AudioSystem.audio) AudioSystem.playMusic('audio1.mp3');
    });
}

// System Buttons
const btnExport = $('#btnExport');
const btnImport = $('#btnImport');
const btnWipe = $('#btnWipe');
const sysFooter = $('#sysFooter');

if (btnExport) {
    btnExport.onclick = () => {
        try {
            const str = btoa(JSON.stringify(S));
            navigator.clipboard.writeText(str).then(() => {
                log('Partida copiada al portapapeles.', 'good');
                if (sysFooter) sysFooter.textContent = 'Copiado al portapapeles.';
            });
        } catch (e) { log('Error exportando.', 'bad'); }
    };
}

if (btnImport) {
    btnImport.onclick = () => {
        const str = prompt('Pega aquí tu código de guardado:');
        if (str) {
            try {
                const json = JSON.parse(atob(str));
                if (json && json.resources) {
                    localStorage.setItem('lys_save_v1', JSON.stringify(json));
                    location.reload();
                } else {
                    alert('Código inválido.');
                }
            } catch (e) { alert('Error al importar. Código corrupto.'); }
        }
    };
}

const btnPrestige = $('#btnPrestige');

if (btnPrestige) {
    btnPrestige.onclick = () => {
        if (S.stats.renown < 50) {
            alert('Necesitas 50 de Renombre para Ascender.');
            return;
        }
        if (confirm(`¿Ascender? Perderás todo el progreso (edificios, recursos), pero ganarás Nivel de Prestigio ${S.prestige + 1} (+50% Renombre futuro).`)) {
            const nextLvl = (S.prestige || 0) + 1;
            const keptAch = S.achievements;
            // Wipe but keep prestige and achievements
            localStorage.removeItem('lys_save_v1');
            // We need to inject prestige into next start. 
            // Simplest way: save a temporary flag or re-save immediately after clear?
            // Actually, we can just manually craft the new state and save it.
            // But state init handles defaults.
            // Let's do:
            const newState = {
                resources: { lenia: 0, agua: 0, aceitunas: 0, hierbas: 0, piedra: 0, hierro: 0, trigo: 0, sal: 0, antorchas: 0, medicina: 0 },
                stats: { totalTicks: 0, renown: 0, explore: 0, bossesDefeated: 0 }, // Reset renown
                unlocked: { fire: false, water: false, hut: false, farm: false, expedition: false, mine: false, forge: false, molino: false, acequia: false, herbs: false },
                people: { villagers: 0, jobs: { lumber: 0, farmer: 0, miner: 0 } },
                fire: { lit: false, fuel: 0, heat: 0 },
                time: { day: 1, minutes: 480 }, // 8:00 AM
                cooldowns: { cut: 0, fetch: 0, forage: 0, explore: 0, stoke: 0, boss: 0, craft: 0 },
                expedition: null,
                threat: null,
                trader: null,
                prestige: nextLvl,
                achievements: keptAch,
                regionFocus: null,
                weather: 'clear',
                discoveries: { lenia: false, agua: false, aceitunas: false, hierbas: false, piedra: false, hierro: false, trigo: false, sal: false }
            };
            localStorage.setItem('lys_save_v1', JSON.stringify(newState));
            location.reload();
        }
    };
}

if (btnWipe) {
    btnWipe.onclick = () => {
        if (confirm('¿Estás seguro de BORRAR todo el progreso? No hay vuelta atrás.')) {
            localStorage.removeItem('lys_save_v1');
            location.reload();
        }
    };
}

init();

// Export for debugging
window.S = S; 
