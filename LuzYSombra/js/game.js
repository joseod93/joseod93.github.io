
import { $, now, fmtMs } from './utils.js';
import { S, loadState, saveState, resetState } from './state.js';
import { log, updateCooldownVisuals, updateTags, renderResources, renderNotes, renderAchievements, toast, setTip, renderQuests, showStatistics, initTabs, addXP, xpFlash, screenFlash, fireConfetti, updateStreakDisplay, updateWeatherVisuals, showPassiveGain, showEventBanner } from './ui.js';
import { tryUnlocks, checkAchievements } from './actions.js';
import { renderMap } from './map.js';
import { renderSettlement, refreshOpenLocation } from './settlement.js';
import { showEncounterPrompt, startEnemyEncounter } from './combat.js';
import { BOSSES, ENEMIES } from './constants.js';
import integrator from './integrator.js';

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
    const pool = BOSSES;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    S.threat = { key: pick.key, name: pick.name, icon: pick.icon, hp: pick.hp, max: pick.hp, endsAt: now() + pick.duration, region: pick.region };
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
    const nowTs = now();

    S.time.minutes += 1;
    if (S.time.minutes >= (24 * 60)) {
        S.time.minutes = 0;
        S.time.day++;
        log('Amanece un nuevo día en Andalucía.', 'dim');
        addXP(5);
    }

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
        let fuelCons = 0.05 * (1 - fuelReduction);
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

    const prestigeMult = 1 + ((S.prestige || 0) * 0.5);
    const levelBonus = 1 + (S.player.level - 1) * 0.02;
    const doubleProd = (S._doubleProd && nowTs < S._doubleProd) ? 2 : 1;

    if (S.unlocked.acequia && Math.random() < (0.05 + heatBonus) * levelBonus) { addRes('agua', 1 * doubleProd); showPassiveGain('agua', 1 * doubleProd); }
    if (S.unlocked.molino && Math.random() < (0.05 + heatBonus) * levelBonus && S.resources.trigo > 0) {
        S.resources.trigo--;
        const gained = (1 * prestigeMult);
        S.stats.renown += gained;
        integrator.onRenownGained(S, gained, log);
    }
    if (S.unlocked.forge && Math.random() < 0.02 * levelBonus) { addRes('hierro', 1 * doubleProd); showPassiveGain('hierro', 1 * doubleProd); }

    if (S.people.villagers > 0) {
        const leaderBonus = 1 + ((S.skills?.leadership || 0) * 0.15);
        let needed = S.people.villagers * 0.1;
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
            if (S.people.jobs.lumber > 0 && Math.random() < 0.1 * S.people.jobs.lumber * levelBonus * leaderBonus) { addRes('lenia', 1 * doubleProd); showPassiveGain('lenia', 1 * doubleProd); }
            if (S.people.jobs.farmer > 0) {
                let farmChance = 0.08 + (heatBonus * 2);
                if (S.weather === 'rain') farmChance += 0.05;
                if (Math.random() < farmChance * S.people.jobs.farmer * levelBonus * leaderBonus) { addRes('trigo', 1 * doubleProd); showPassiveGain('trigo', 1 * doubleProd); }
            }
            if (S.people.jobs.miner > 0) {
                const mineChance = 0.05 * S.people.jobs.miner * levelBonus;
                if (Math.random() < mineChance) {
                    const roll = Math.random();
                    if (roll < 0.4) { addRes('piedra', 1); showPassiveGain('piedra', 1); }
                    else if (roll < 0.6) { addRes('hierro', 1); showPassiveGain('hierro', 1); }
                    else {
                        S.stats.renown += 1;
                        integrator.onRenownGained(S, 1, log);
                    }
                }
            }
        }
    }

    if (S.threat && nowTs >= S.threat.endsAt) {
        log(`${S.threat.name} se desvanece entre la bruma.`, 'dim');
        S.threat = null;
    }

    if (!S.threat && S.time.day >= 2 && Math.random() < 0.006) spawnBoss();

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

    updateTags();
    renderResources();
    checkAchievements();
    renderMap();
    renderSettlement();
    refreshOpenLocation();
    renderNotes();
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

// ===== WELCOME BACK SCREEN =====
function showWelcomeBack(elapsed) {
    const overlay = $('#welcomeBackOverlay');
    const timeText = $('#welcomeTime');
    const rewardsEl = $('#welcomeRewards');
    const streakEl = $('#welcomeStreak');
    const closeBtn = $('#welcomeCloseBtn');
    if (!overlay) return;

    timeText.textContent = `Has estado fuera ${fmtMs(elapsed)}.`;

    const idleMins = Math.floor(elapsed / 1000);
    const idleRewards = [];
    const passiveWood = Math.floor(idleMins / 60);
    const passiveWater = S.unlocked.acequia ? Math.floor(idleMins / 90) : 0;
    const passiveWheat = (S.people.jobs?.farmer || 0) > 0 ? Math.floor(idleMins / 80) : 0;
    const xpGained = Math.min(Math.floor(idleMins / 30) * 2, 50);

    if (passiveWood > 0) { S.resources.lenia += passiveWood; idleRewards.push({ icon: '🪵', label: `+${passiveWood} Leña` }); }
    if (passiveWater > 0) { S.resources.agua += passiveWater; idleRewards.push({ icon: '💧', label: `+${passiveWater} Agua` }); }
    if (passiveWheat > 0) { S.resources.trigo += passiveWheat; idleRewards.push({ icon: '🌾', label: `+${passiveWheat} Trigo` }); }
    if (xpGained > 0) { addXP(xpGained); idleRewards.push({ icon: '⭐', label: `+${xpGained} XP` }); }

    S.time.minutes += idleMins;

    const streakRewards = getStreakRewards(S.streak.current);
    if (!S.streak.claimedToday) {
        streakRewards.forEach(r => {
            if (r.key === 'renown') S.stats.renown += r.amount;
            else S.resources[r.key] = (S.resources[r.key] || 0) + r.amount;
            idleRewards.push({ icon: r.icon, label: `+${r.amount} ${r.label}` });
        });
        S.streak.claimedToday = true;
    }

    if (idleRewards.length === 0) {
        idleRewards.push({ icon: '👋', label: '¡Bienvenido!' });
    }

    rewardsEl.innerHTML = idleRewards.map((r, i) => `
        <div class="welcome-reward-item count-anim" style="animation-delay:${i * 0.1}s">
            <div class="reward-icon">${r.icon}</div>
            <div class="reward-text">${r.label}</div>
        </div>
    `).join('');

    streakEl.innerHTML = `
        <div class="streak-num streak-active">${S.streak.current}</div>
        <div class="streak-label">días seguidos jugando</div>
        ${S.streak.current >= S.streak.best && S.streak.current > 1 ? '<div style="color:var(--accent);font-size:0.75rem;margin-top:4px">¡Récord personal!</div>' : ''}
    `;

    overlay.classList.remove('hidden');

    closeBtn.onclick = () => {
        overlay.classList.add('hidden');
        log(`Recompensas de bienvenida aplicadas.`, 'good');
        renderResources();
        saveState();
    };
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

    checkStreak();
    integrator.initializeSystems(S);
    import('./tutorial.js').then(m => {
        if (!m.default.completed) m.default.start();
    });
}

// ===== THEME TOGGLE =====
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    S.theme = theme;
}

// ===== SKILLS UI =====
function renderSkills() {
    const body = $('#skillsBody');
    const badge = $('#skillPointsBadge');
    if (!body) return;
    if (badge) badge.textContent = `${S.skillPoints || 0} pts`;

    let html = '<div class="skills-grid">';
    const categories = { gather: 'Recolección', combat: 'Combate', production: 'Producción' };

    // Lazy-load SKILLS from constants
    import('./constants.js').then(({ SKILLS }) => {
        for (const [cat, catLabel] of Object.entries(categories)) {
            html += `<div class="skill-category-title">${catLabel}</div>`;
            for (const [key, skill] of Object.entries(SKILLS)) {
                if (skill.category !== cat) continue;
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
            const sellPrice = Math.max(1, Math.round(buyPrice * 0.6));
            const trend = fluctuation > 0.1 ? 'up' : fluctuation < -0.1 ? 'down' : '';
            const trendArrow = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—';

            const tradeDiscount = (S.skills?.tradeSkill || 0) * 0.15;
            const discountedBuy = Math.max(1, Math.round(buyPrice * (1 - tradeDiscount)));
            const playerHas = Math.floor(S.resources[good.key] || 0);
            const canBuy = S.stats.renown >= discountedBuy;
            const canSell = playerHas >= 1;

            html += `
            <div class="market-item">
                <span class="market-resource">${meta.icon} ${meta.label} (${playerHas})</span>
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
        const wave = (S.waveMode?.wave || 0) + 1;
        import('./constants.js').then(({ WAVE_CONFIG }) => {
            const hp = Math.floor(WAVE_CONFIG.baseHp + WAVE_CONFIG.hpPerWave * wave);
            const atk = Math.floor(WAVE_CONFIG.baseAtk + WAVE_CONFIG.atkPerWave * wave);
            const icon = WAVE_CONFIG.icons[Math.min(wave - 1, WAVE_CONFIG.icons.length - 1)];
            const name = WAVE_CONFIG.names[Math.min(Math.floor((wave - 1) / 2), WAVE_CONFIG.names.length - 1)] + ` (Oleada ${wave})`;

            S.waveMode = { wave, active: true };
            saveState();

            import('./combat.js').then(({ startEnemyEncounter }) => {
                startEnemyEncounter({
                    name, icon, hp, atk, level: wave * 2,
                    loot: [{ k: 'hierro', n: [wave, wave + 2] }]
                });
            });

            btnStart.textContent = `Comenzar Oleada ${wave + 1}`;
        });
    };

    if (S.waveMode?.wave) {
        btnStart.textContent = `Comenzar Oleada ${(S.waveMode.wave || 0) + 1}`;
    }
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

function init() {
    loadState();
    applyTheme(S.theme || 'dark');
    integrator.initializeSystems(S);
    initTabs();
    checkStreak();
    resumeIdleProgress();

    renderResources();
    tryUnlocks();
    renderSettlement();
    renderAchievements();
    updateTags();
    renderNotes();
    renderMap();
    renderSkills();
    renderMarket();
    renderCrafting();
    initWaveMode();
    updateWeatherVisuals(S.weather);

    setInterval(gameTick, 1000);
    setInterval(saveState, 10000);
    setInterval(updateCooldownVisuals, 100);
    setInterval(() => { renderMarket(); renderCrafting(); }, 30000);

    window.addEventListener('lys-actions-refresh', () => { renderSettlement(); refreshOpenLocation(); renderCrafting(); });
    document.body.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            AudioSystem.playTone('click');
        }
    });

    if (S.started) {
        startOverlay.classList.add('hidden');
    }

    // Check contextual tips periodically
    setInterval(checkContextualTips, 5000);
}

startBtn.addEventListener('click', startGame);
if (audioBtn) {
    if (AudioSystem.muted) audioBtn.textContent = '🔈';
    else audioBtn.textContent = '🔊';

    audioBtn.addEventListener('click', () => {
        const isMuted = AudioSystem.toggle();
        audioBtn.textContent = isMuted ? '🔈' : '🔊';
        if (!isMuted && !AudioSystem.audio) AudioSystem.playMusic('audio1.mp3');
    });
}

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

if (btnExport) {
    btnExport.onclick = () => {
        try {
            const str = btoa(JSON.stringify(S));
            navigator.clipboard.writeText(str).then(() => {
                log('Partida copiada al portapapeles.', 'good');
                toast('📋 Copiado');
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
                    localStorage.setItem('lys_save_v2', JSON.stringify(json));
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
        if (confirm(`¿Ascender? Perderás progreso pero ganarás Prestigio ${S.prestige + 1} (+50% Renombre futuro).`)) {
            const nextLvl = (S.prestige || 0) + 1;
            const keptAch = S.achievements;
            const keptStreak = S.streak;
            const keptLevel = S.player.level;
            localStorage.removeItem('lys_save_v2');
            const newState = {
                resources: { lenia: 0, agua: 0, aceitunas: 0, hierbas: 0, piedra: 0, hierro: 0, trigo: 0, sal: 0, antorchas: 0, medicina: 0 },
                stats: { totalTicks: 0, renown: 0, explore: 0, bossesDefeated: 0 },
                unlocked: { fire: false, water: false, hut: false, farm: false, expedition: false, mine: false, forge: false, molino: false, acequia: false },
                people: { villagers: 0, jobs: { lumber: 0, farmer: 0, miner: 0 } },
                fire: { lit: false, fuel: 0, heat: 0 },
                player: { hp: 100, maxHp: 100 + (keptLevel * 5), guard: false, xp: 0, level: keptLevel },
                time: { day: 1, minutes: 480 },
                cooldowns: { cut: 0, fetch: 0, forage: 0, explore: 0, stoke: 0, boss: 0, craft: 0 },
                expedition: null,
                threat: null,
                trader: null,
                prestige: nextLvl,
                achievements: keptAch,
                streak: keptStreak,
                regionFocus: null,
                weather: 'clear',
                discoveries: { lenia: false, agua: false, aceitunas: false, hierbas: false, piedra: false, hierro: false, trigo: false, sal: false }
            };
            localStorage.setItem('lys_save_v2', JSON.stringify(newState));
            location.reload();
        }
    };
}

if (btnWipe) {
    btnWipe.onclick = () => {
        if (confirm('¿Borrar TODO el progreso? No hay vuelta atrás.')) {
            localStorage.removeItem('lys_save_v2');
            localStorage.removeItem('lys_save_v1');
            location.reload();
        }
    };
}

const btnStats = $('#btnStats');
if (btnStats) {
    btnStats.addEventListener('click', showStatistics);
}

setInterval(renderQuests, 5000);

window.addEventListener('beforeunload', () => {
    S.lastSessionEnd = now();
    integrator.endSession(S);
    saveState();
});

init();

window.S = S;
