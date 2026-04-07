
import { S, saveState } from './state.js';
import { REGIONS, BOSSES, RES_META, ENEMIES } from './constants.js';
import { now, fmtMs, $, randomRange, randomChoice, vibrate } from './utils.js';
import { log, setCooldown, renderResources, renderAchievements, toast, updateTags, setTip, BUTTON_REFS, addXP, xpFlash, screenFlash, incrementCombo, fireConfetti } from './ui.js';
import { openCombat, showEncounterPrompt, startEnemyEncounter } from './combat.js';
import { renderMap, getRandomRegion } from './map.js';
import { AudioSystem } from './audio.js';
import { spawnBoss } from './game.js';
import integrator from './integrator.js';

const actionsEl = $('#actions');

const ACTION_LOCKS = {
    crafting: () => S.unlocked.crafting,
    recruit: () => S.unlocked.village,
    exploreAdvanced: () => S.stats.renown >= 6 || S.unlocked.expedition
};

function can(action) {
    return now() >= (S.cooldowns[action] || 0);
}

function addRes(key, n) {
    S.resources[key] = (S.resources[key] || 0) + n;
    if (S.resources[key] > 0) markDiscovery(key);
    integrator.onResourceGathered(S, key, n, log);
    refreshAll();
}

function markDiscovery(key) {
    if (S.discoveries[key]) return;
    S.discoveries[key] = true;
    log(`Has descubierto: ${RES_META[key]?.label || key}.`, 'good');
    addXP(10);
    renderActions();
}

function refreshAll() {
    renderResources();
    checkUnlocks();
    renderActions();
}

export function tryUnlocks() {
    if (!S.unlocked.water && S.resources.lenia >= 3) { S.unlocked.water = true; log('Puedes buscar agua en un arroyo cercano.', 'dim'); }
    if (!S.unlocked.herbs && S.resources.agua >= 2) { S.unlocked.herbs = true; log('Detectas aroma a romero y tomillo.', 'dim'); }
    if (!S.unlocked.olives && S.resources.hierbas >= 1) { S.unlocked.olives = true; log('Al sureste hay olivares.', 'dim'); }
    if (!S.unlocked.crafting && (S.resources.aceitunas >= 1 && S.resources.lenia >= 1)) { S.unlocked.crafting = true; log('Has aprendido a fabricar objetos.', 'good'); addXP(15); }
    if (!S.unlocked.village && S.stats.renown >= 5) { S.unlocked.village = true; log('Viajantes se unen. Nace una aldea.', 'good'); addXP(25); }
    if (!S.unlocked.expedition && S.stats.explore >= 8) { S.unlocked.expedition = true; log('Puedes organizar expediciones.', 'good'); addXP(30); }
}
const checkUnlocks = tryUnlocks;

function craft(item) {
    if (item === 'antorchas' && S.resources.lenia >= 1 && S.resources.aceitunas >= 1) {
        S.resources.lenia--; S.resources.aceitunas--; S.resources.antorchas++;
        log('Has fabricado una antorcha.', 'good');
        integrator.onItemCrafted(S, item, 1, log);
        addXP(3);
        xpFlash();
    }
    if (item === 'medicina' && S.resources.hierbas >= 2 && S.resources.agua >= 1) {
        S.resources.hierbas -= 2; S.resources.agua--; S.resources.medicina++;
        log('Has preparado una medicina.', 'good');
        integrator.onItemCrafted(S, item, 1, log);
        addXP(4);
        xpFlash();
    }
    refreshAll();
}

function build(edificio) {
    if (edificio === 'molino' && S.resources.piedra >= 5) {
        S.resources.piedra -= 5; S.unlocked.molino = true;
        log('Has construido un molino.', 'good');
        AudioSystem.playTone('build');
        integrator.onBuildingConstructed(S, edificio, log);
        addXP(20);
        screenFlash('gold');
    }
    if (edificio === 'acequia' && S.resources.piedra >= 3 && S.resources.agua >= 2) {
        S.resources.piedra -= 3; S.resources.agua -= 2; S.unlocked.acequia = true;
        log('Has construido una acequia.', 'good');
        AudioSystem.playTone('build');
        integrator.onBuildingConstructed(S, edificio, log);
        addXP(20);
        screenFlash('gold');
    }
    if (edificio === 'fragua' && S.resources.hierro >= 5) {
        S.resources.hierro -= 5; S.unlocked.forge = true;
        log('Has construido una fragua.', 'good');
        AudioSystem.playTone('build');
        integrator.onBuildingConstructed(S, edificio, log);
        addXP(25);
        screenFlash('gold');
    }
    refreshAll();
}

export function checkAchievements() {
    // Handled by integrator
}

function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function canSpin() {
    if (!S.streak) return false;
    return S.streak.lastSpinDate !== getTodayStr();
}

const SPIN_REWARDS = [
    { icon: '🪵', label: '+5 Leña', apply: () => { S.resources.lenia += 5; } },
    { icon: '💧', label: '+4 Agua', apply: () => { S.resources.agua += 4; } },
    { icon: '🌿', label: '+3 Hierbas', apply: () => { S.resources.hierbas += 3; } },
    { icon: '🪨', label: '+3 Piedra', apply: () => { S.resources.piedra += 3; } },
    { icon: '⛓️', label: '+2 Hierro', apply: () => { S.resources.hierro += 2; } },
    { icon: '🌾', label: '+4 Trigo', apply: () => { S.resources.trigo += 4; } },
    { icon: '💊', label: '+2 Medicina', apply: () => { S.resources.medicina += 2; } },
    { icon: '⭐', label: '+20 XP', apply: () => { addXP(20); } },
    { icon: '🏅', label: '+3 Renombre', apply: () => { S.stats.renown += 3; } },
    { icon: '🔥', label: '¡Producción x2 60s!', rare: true, apply: () => { S._doubleProd = now() + 60000; } },
];

function doSpin(container) {
    if (!canSpin()) return;
    S.streak.lastSpinDate = getTodayStr();

    const resultEl = container.querySelector('.spin-result');
    const btnEl = container.querySelector('.spin-btn');
    if (btnEl) btnEl.disabled = true;

    let ticks = 0;
    const totalTicks = 18;
    const finalIdx = Math.floor(Math.random() * SPIN_REWARDS.length);
    const rareBoost = Math.random() < 0.12;
    const picked = rareBoost ? SPIN_REWARDS[SPIN_REWARDS.length - 1] : SPIN_REWARDS[finalIdx];

    const interval = setInterval(() => {
        ticks++;
        const showIdx = Math.floor(Math.random() * SPIN_REWARDS.length);
        if (resultEl) resultEl.textContent = `${SPIN_REWARDS[showIdx].icon} ${SPIN_REWARDS[showIdx].label}`;

        if (ticks >= totalTicks) {
            clearInterval(interval);
            if (resultEl) resultEl.textContent = `${picked.icon} ${picked.label}`;
            picked.apply();
            log(`🎰 Rueda diaria: ${picked.icon} ${picked.label}`, 'good');
            toast(`🎰 ${picked.label}`);
            vibrate([30, 50, 30]);
            if (picked.rare) {
                screenFlash('gold');
                fireConfetti();
            }
            xpFlash();
            renderResources();
            saveState();
            setTimeout(() => renderActions(), 2000);
        }
    }, 80 + ticks * 12);
}

export function renderActions() {
    if (!actionsEl) return;
    actionsEl.innerHTML = '';

    const reg = (key, btn, ms) => {
        import('./ui.js').then(ui => ui.registerCooldownBtn(btn, key, ms));
    };

    // Daily Spin Wheel
    if (canSpin()) {
        const spinDiv = document.createElement('div');
        spinDiv.className = 'spin-container';
        spinDiv.innerHTML = `
            <div class="spin-title">🎰 Rueda de la Suerte</div>
            <div class="spin-result">Gira para descubrir tu premio diario</div>
            <button class="spin-btn">🎲 ¡Girar Rueda!</button>
        `;
        const spinBtn = spinDiv.querySelector('.spin-btn');
        spinBtn.onclick = () => doSpin(spinDiv);
        actionsEl.appendChild(spinDiv);
    }

    // Fire
    const btnLight = document.createElement('button');
    btnLight.id = 'btnStoke';
    btnLight.className = 'action';
    btnLight.textContent = S.fire.lit ? '🔥 Avivar fogata' : '🔥 Encender fogata';
    btnLight.disabled = !can('stoke') || (!S.fire.lit && S.resources.lenia <= 0);
    btnLight.onclick = () => {
        if (!S.fire.lit) {
            if (S.resources.lenia <= 0) return;
            S.resources.lenia--; S.fire.fuel += 3; S.fire.lit = true;
            log('Has encendido la fogata.', 'good');
            addXP(2);
        } else {
            if (S.resources.lenia <= 0) { log('No tienes leña.', 'warn'); return; }
            S.resources.lenia--; S.fire.fuel += 2;
            log('Avivas la lumbre.', 'dim');
            addXP(1);
        }
        xpFlash();
        vibrate(30);
        setCooldown(btnLight, 'stoke', 1500, S.fire.lit ? '🔥 Avivar fogata' : '🔥 Encender fogata');
        refreshAll(); updateTags(); saveState();
    };
    reg('stoke', btnLight, 1500);
    actionsEl.appendChild(btnLight);

    // Basic gather
    const basicWrap = document.createElement('div');
    basicWrap.className = 'actions';

    const btnWood = document.createElement('button');
    btnWood.className = 'action';
    btnWood.textContent = '🪵 Cortar leña';
    btnWood.disabled = !can('cut');
    btnWood.onclick = () => {
        const bonus = S.skills?.sharpAxe || 0;
        addRes('lenia', 1 + bonus);
        log(`Cortas leña del bosque.${bonus > 0 ? ` (+${bonus} bonus)` : ''}`, '');
        AudioSystem.playTone('wood');
        vibrate(30);
        addXP(2);
        xpFlash();
        incrementCombo();
        setCooldown(btnWood, 'cut', 1800, '🪵 Cortar leña');
        saveState(); renderActions();
    };
    reg('cut', btnWood, 1800);
    basicWrap.appendChild(btnWood);

    if (S.unlocked.water) {
        const btnWater = document.createElement('button');
        btnWater.className = 'action';
        btnWater.textContent = '💧 Buscar agua';
        btnWater.disabled = !can('fetch');
        btnWater.onclick = () => {
            const wBonus = S.skills?.deepWells || 0;
            addRes('agua', 1 + wBonus);
            log(`Llenas un odre con agua fresca.${wBonus > 0 ? ` (+${wBonus} bonus)` : ''}`, '');
            AudioSystem.playTone('water');
            vibrate(20);
            addXP(2);
            xpFlash();
            incrementCombo();
            setCooldown(btnWater, 'fetch', 3000, '💧 Buscar agua');
            saveState(); renderActions();
        };
        reg('fetch', btnWater, 3000);
        basicWrap.appendChild(btnWater);
    }

    if (S.unlocked.herbs) {
        const btnHerb = document.createElement('button');
        btnHerb.className = 'action';
        btnHerb.textContent = '🌿 Forrajear';
        btnHerb.disabled = !can('forage');
        btnHerb.onclick = () => {
            const herbBonus = (S.skills?.herbalLore || 0) * 0.15;
            const roll = Math.random();
            if (roll < 0.6 + herbBonus) { addRes('hierbas', 1); log('Recolectas hierbas aromáticas.', ''); }
            else { addRes('aceitunas', 1); log('Encuentras aceitunas maduras.', ''); }
            AudioSystem.playTone('herb');
            vibrate(20);
            addXP(2);
            xpFlash();
            incrementCombo();
            setCooldown(btnHerb, 'forage', 3500, '🌿 Forrajear');
            saveState(); renderActions();
        };
        reg('forage', btnHerb, 3500);
        basicWrap.appendChild(btnHerb);
    }
    actionsEl.appendChild(basicWrap);

    // Explore
    const btnExplore = document.createElement('button');
    btnExplore.className = 'action';
    btnExplore.textContent = '🧭 Explorar contornos';
    btnExplore.disabled = !can('explore');
    btnExplore.onclick = () => {
        const roll = Math.random();
        S.stats.explore++;
        AudioSystem.playTone('explore');
        if (roll < 0.4) { addRes('piedra', 1); log('Hallaste piedra útil.', ''); }
        else if (roll < 0.6) { addRes('hierro', 1); log('Recoges vetas de hierro.', ''); }
        else {
            S.stats.renown += 1;
            integrator.onRenownGained(S, 1, log);
            log('Ayudas a un viajero. (+Renombre)', 'good');
        }
        if (!S.threat && Math.random() < 0.18) spawnBoss();
        integrator.onActionPerformed(S, 'explore', log);
        addXP(4);
        xpFlash();
        vibrate(40);
        setCooldown(btnExplore, 'explore', 6000, '🧭 Explorar contornos');
        updateTags(); saveState(); renderActions();
    };
    reg('explore', btnExplore, 6000);
    actionsEl.appendChild(btnExplore);

    // Crafting
    if (ACTION_LOCKS.crafting()) {
        const row = document.createElement('div'); row.className = 'inline';
        const b1 = document.createElement('button');
        b1.className = 'action';
        b1.textContent = '🔥 Antorcha';
        b1.disabled = !(S.resources.lenia >= 1 && S.resources.aceitunas >= 1) || !can('craft');
        b1.onclick = () => { craft('antorchas'); setCooldown(b1, 'craft', 800, '🔥 Antorcha'); };

        const b2 = document.createElement('button');
        b2.className = 'action';
        b2.textContent = '💊 Medicina';
        b2.disabled = !(S.resources.hierbas >= 2 && S.resources.agua >= 1) || !can('craft');
        b2.onclick = () => { craft('medicina'); setCooldown(b2, 'craft', 800, '💊 Medicina'); };

        row.appendChild(b1); row.appendChild(b2);
        actionsEl.appendChild(row);
        reg('craft', b1, 800);
    }

    // Buildings
    const buildWrap = document.createElement('div'); buildWrap.className = 'inline';
    if (S.discoveries?.piedra && !S.unlocked.molino) {
        const bm = document.createElement('button');
        bm.className = 'action';
        bm.textContent = `🏚️ Molino (${S.resources.piedra}/5 🪨)`;
        bm.disabled = S.resources.piedra < 5;
        bm.onclick = () => build('molino');
        buildWrap.appendChild(bm);
    }
    if (S.discoveries?.agua && S.discoveries?.piedra && !S.unlocked.acequia) {
        const ba = document.createElement('button');
        ba.className = 'action';
        ba.textContent = `💧 Acequia (${S.resources.piedra}/3 🪨, ${S.resources.agua}/2 💧)`;
        ba.disabled = !(S.resources.piedra >= 3 && S.resources.agua >= 2);
        ba.onclick = () => build('acequia');
        buildWrap.appendChild(ba);
    }
    if (S.discoveries?.hierro && !S.unlocked.forge) {
        const bf = document.createElement('button');
        bf.className = 'action';
        bf.textContent = `⚒️ Fragua (${S.resources.hierro}/5 ⛓️)`;
        bf.disabled = S.resources.hierro < 5;
        bf.onclick = () => build('fragua');
        buildWrap.appendChild(bf);
    }
    if (buildWrap.children.length > 0) actionsEl.appendChild(buildWrap);

    // Expeditions
    if (S.unlocked.expedition) {
        if (!S.expedition) {
            const bx = document.createElement('button');
            bx.className = 'action';
            bx.textContent = '🗺️ Organizar expedición (3-8 min)';
            bx.onclick = () => {
                const region = getRandomRegion();
                const dur = (3 + Math.floor(Math.random() * 6)) * 60 * 1000;
                S.expedition = { endsAt: now() + dur, startedAt: now(), region: region.name };
                log(`${region.emoji} Expedición hacia ${region.name}.`, 'warn');
                addXP(5);
                xpFlash();
                updateTags(); saveState(); renderActions(); renderMap();
            };
            actionsEl.appendChild(bx);
        } else {
            const remain = S.expedition.endsAt - now();
            const bx = document.createElement('button');
            bx.className = 'action' + (remain <= 0 ? ' glow-btn' : '');
            bx.textContent = remain > 0 ? `🗺️ ${S.expedition.region} (${fmtMs(remain)})` : '🎁 Reclamar expedición';
            bx.disabled = remain > 0;
            bx.onclick = () => {
                const region = REGIONS.find(r => r.name === S.expedition.region) || getRandomRegion();
                region.loot.forEach(item => {
                    const n = randomRange(item.n[0], item.n[1]);
                    if (item.k === 'renown') { S.stats.renown += n; integrator.onRenownGained(S, n, log); }
                    else addRes(item.k, n);
                });
                const ev = randomChoice(region.events);
                log(`${region.emoji} Expedición: ${ev}`, 'good');
                S.expedition = null;
                integrator.onExpeditionCompleted(S, region.name, log);
                addXP(12);
                xpFlash();
                screenFlash('green');
                vibrate([30, 30, 60]);
                refreshAll(); updateTags(); saveState(); renderMap();

                // Random enemy encounter (25% chance)
                if (Math.random() < 0.25) {
                    const eligible = ENEMIES.filter(e => e.level <= S.player.level + 2);
                    if (eligible.length > 0) {
                        const enemy = randomChoice(eligible);
                        setTimeout(() => {
                            log(`Un ${enemy.name} te embosca en el camino de vuelta.`, 'bad');
                            startEnemyEncounter(enemy);
                        }, 1500);
                    }
                }
            };
            actionsEl.appendChild(bx);
        }
    }

    // Trader
    if (S.trader) {
        const div = document.createElement('div');
        div.style.cssText = 'margin:8px 0;padding:12px;background:#151b2688;border:1px solid #1b263688;border-radius:12px';
        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <b>🪵 Mercader</b>
                <small style="color:var(--muted)">${fmtMs(S.trader.endsAt - now())}</small>
            </div>
            <p style="margin:0 0 8px;font-size:0.82rem;color:#aaa">"Cambio ${S.trader.rate} ${RES_META[S.trader.wants]?.label || S.trader.wants} por renombre."</p>
        `;
        const btnTrade = document.createElement('button');
        btnTrade.className = 'action' + (S.resources[S.trader.wants] >= S.trader.rate ? ' glow-btn' : '');
        btnTrade.textContent = S.resources[S.trader.wants] >= S.trader.rate ? '🤝 Intercambiar' : 'No tienes suficiente';
        btnTrade.disabled = S.resources[S.trader.wants] < S.trader.rate;
        btnTrade.onclick = () => {
            S.resources[S.trader.wants] -= S.trader.rate;
            const gained = 1 + ((S.prestige || 0) * 0.5);
            S.stats.renown += gained;
            integrator.onRenownGained(S, gained, log);
            log('El mercader habla bien de ti. (+Renombre)', 'good');
            AudioSystem.playTone('metal');
            vibrate(50);
            addXP(8);
            xpFlash();
            refreshAll(); saveState();
        };
        div.appendChild(btnTrade);
        actionsEl.appendChild(div);
    }

    // Consume bread for healing outside combat
    if (S.consumables?.pan > 0 && S.player.hp < S.player.maxHp) {
        const bPan = document.createElement('button');
        bPan.className = 'action';
        bPan.textContent = `🍞 Comer pan (+15 HP) x${S.consumables.pan}`;
        bPan.onclick = () => {
            S.consumables.pan--;
            const heal = 15;
            S.player.hp = Math.min(S.player.maxHp, S.player.hp + heal);
            log(`Comes pan y recuperas ${heal} HP.`, 'good');
            vibrate(20);
            refreshAll(); updateTags(); saveState();
        };
        actionsEl.appendChild(bPan);
    }

    // Boss
    if (S.threat) {
        const remain = S.threat.endsAt - now();
        const bb = document.createElement('button');
        bb.className = 'action combat-btn atk';
        bb.textContent = remain > 0 ? `⚔️ ${S.threat.name} (HP ${S.threat.hp})` : 'Amenaza desvanecida';
        bb.disabled = remain <= 0;
        bb.onclick = () => openCombat();
        actionsEl.appendChild(bb);
    }

    // Advanced Explore
    if (ACTION_LOCKS.exploreAdvanced()) {
        const bAdv = document.createElement('button');
        bAdv.className = 'action';
        bAdv.textContent = '🏛️ Explorar rutas andaluzas';
        bAdv.disabled = !can('explore_adv');
        bAdv.onclick = () => {
            const region = getRandomRegion();
            const roll = Math.random();
            AudioSystem.playTone('explore');
            if (roll < 0.5) { addRes('piedra', 2); log(`Materiales en ${region.name}.`, ''); }
            else if (roll < 0.75) { addRes('hierro', 2); log(`Vetas en ${region.name}.`, ''); }
            else { S.stats.renown += 2; integrator.onRenownGained(S, 2, log); log(`Fama en ${region.name}.`, 'good'); }
            integrator.onActionPerformed(S, 'explore', log);
            addXP(6);
            xpFlash();
            vibrate(40);
            setCooldown(bAdv, 'explore_adv', 12000, '🏛️ Explorar rutas andaluzas');
            refreshAll(); updateTags(); saveState();
        };
        reg('explore_adv', bAdv, 12000);
        actionsEl.appendChild(bAdv);
    }

    // Recruit & Villagers
    if (ACTION_LOCKS.recruit()) {
        const bVill = document.createElement('button');
        bVill.className = 'action';
        bVill.textContent = '👥 Reclutar aldeano (-2 comida)';
        bVill.disabled = (S.resources.trigo + S.resources.aceitunas < 2);
        bVill.onclick = () => {
            let left = 2;
            if (S.resources.trigo >= 1) { S.resources.trigo--; left--; }
            if (left > 0 && S.resources.aceitunas >= left) { S.resources.aceitunas -= left; left = 0; }
            if (left > 0 && S.resources.trigo >= left) { S.resources.trigo -= left; left = 0; }
            if (left > 0) return;
            S.people.villagers = (S.people.villagers || 0) + 1;
            log('Nuevo aldeano se une a tu poblado.', 'good');
            integrator.onVillagerRecruited(S, log);
            addXP(10);
            xpFlash();
            vibrate(50);
            refreshAll(); saveState();
        };
        actionsEl.appendChild(bVill);

        if (S.people.villagers > 0) {
            const jobPanel = document.createElement('div');
            jobPanel.style.cssText = 'margin-top:8px;padding:12px;background:#0c132088;border:1px solid #1b263688;border-radius:12px';
            const assigned = (S.people.jobs.lumber || 0) + (S.people.jobs.farmer || 0) + (S.people.jobs.miner || 0);
            const free = S.people.villagers - assigned;
            jobPanel.innerHTML = `<div style="margin-bottom:10px;font-weight:700;font-size:0.88rem">👥 Aldea (Libres: ${free})</div>`;

            const jobs = [
                { key: 'lumber', label: 'Leñadores', icon: '🪵' },
                { key: 'farmer', label: 'Granjeros', icon: '🌾' },
                { key: 'miner', label: 'Mineros', icon: '⛏️' }
            ];

            jobs.forEach(j => {
                if (j.key === 'miner' && !S.discoveries?.piedra) return;
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #1b263633';
                row.innerHTML = `<span style="font-size:0.85rem">${j.icon} ${j.label}: <b>${S.people.jobs[j.key] || 0}</b></span>`;

                const ctrls = document.createElement('div');
                ctrls.style.cssText = 'display:flex;gap:6px';

                const btnSub = document.createElement('button');
                btnSub.textContent = '−';
                btnSub.className = 'action';
                btnSub.style.cssText = 'width:36px;height:36px;padding:0;font-size:1.1rem;min-height:36px';
                btnSub.disabled = !S.people.jobs[j.key];
                btnSub.onclick = () => { S.people.jobs[j.key]--; vibrate(20); refreshAll(); saveState(); };

                const btnAdd = document.createElement('button');
                btnAdd.textContent = '+';
                btnAdd.className = 'action';
                btnAdd.style.cssText = 'width:36px;height:36px;padding:0;font-size:1.1rem;min-height:36px';
                btnAdd.disabled = free <= 0;
                btnAdd.onclick = () => { S.people.jobs[j.key] = (S.people.jobs[j.key] || 0) + 1; vibrate(20); refreshAll(); saveState(); };

                ctrls.appendChild(btnSub);
                ctrls.appendChild(btnAdd);
                row.appendChild(ctrls);
                jobPanel.appendChild(row);
            });
            actionsEl.appendChild(jobPanel);
        }
    }

    // Mejora 11: Mark available buttons with pulse animation
    actionsEl.querySelectorAll('button.action').forEach(btn => {
        if (!btn.disabled) btn.classList.add('available');
    });
}

// ===== LOCATION-AWARE ACTION RENDERING =====
export function renderLocationActions(locationId, container) {
    if (!container) return;
    container.innerHTML = '';

    const reg = (key, btn, ms) => {
        import('./ui.js').then(ui => ui.registerCooldownBtn(btn, key, ms));
    };

    const markAvailable = () => {
        container.querySelectorAll('button.action').forEach(btn => {
            if (!btn.disabled) btn.classList.add('available');
        });
    };

    switch (locationId) {
        case 'campamento': {
            // Daily Spin Wheel
            if (canSpin()) {
                const spinDiv = document.createElement('div');
                spinDiv.className = 'spin-container';
                spinDiv.innerHTML = `
                    <div class="spin-title">🎰 Rueda de la Suerte</div>
                    <div class="spin-result">Gira para descubrir tu premio diario</div>
                    <button class="spin-btn">🎲 ¡Girar Rueda!</button>
                `;
                const spinBtn = spinDiv.querySelector('.spin-btn');
                spinBtn.onclick = () => doSpin(spinDiv);
                container.appendChild(spinDiv);
            }

            // Fire
            const btnLight = document.createElement('button');
            btnLight.id = 'btnStoke';
            btnLight.className = 'action';
            btnLight.textContent = S.fire.lit ? '🔥 Avivar fogata' : '🔥 Encender fogata';
            btnLight.disabled = !can('stoke') || (!S.fire.lit && S.resources.lenia <= 0);
            btnLight.onclick = () => {
                if (!S.fire.lit) {
                    if (S.resources.lenia <= 0) return;
                    S.resources.lenia--; S.fire.fuel += 3; S.fire.lit = true;
                    log('Has encendido la fogata.', 'good');
                    addXP(2);
                } else {
                    if (S.resources.lenia <= 0) { log('No tienes leña.', 'warn'); return; }
                    S.resources.lenia--; S.fire.fuel += 2;
                    log('Avivas la lumbre.', 'dim');
                    addXP(1);
                }
                xpFlash();
                vibrate(30);
                setCooldown(btnLight, 'stoke', 1500, S.fire.lit ? '🔥 Avivar fogata' : '🔥 Encender fogata');
                refreshAll(); updateTags(); saveState();
                renderLocationActions(locationId, container);
            };
            reg('stoke', btnLight, 1500);
            container.appendChild(btnLight);

            // Consume bread
            if (S.consumables?.pan > 0 && S.player.hp < S.player.maxHp) {
                const bPan = document.createElement('button');
                bPan.className = 'action';
                bPan.textContent = `🍞 Comer pan (+15 HP) x${S.consumables.pan}`;
                bPan.onclick = () => {
                    S.consumables.pan--;
                    const heal = 15;
                    S.player.hp = Math.min(S.player.maxHp, S.player.hp + heal);
                    log(`Comes pan y recuperas ${heal} HP.`, 'good');
                    vibrate(20);
                    refreshAll(); updateTags(); saveState();
                    renderLocationActions(locationId, container);
                };
                container.appendChild(bPan);
            }

            // Boss
            if (S.threat) {
                const remain = S.threat.endsAt - now();
                const bb = document.createElement('button');
                bb.className = 'action combat-btn atk';
                bb.textContent = remain > 0 ? `⚔️ ${S.threat.name} (HP ${S.threat.hp})` : 'Amenaza desvanecida';
                bb.disabled = remain <= 0;
                bb.onclick = () => openCombat();
                container.appendChild(bb);
            }
            break;
        }

        case 'bosque': {
            const btnWood = document.createElement('button');
            btnWood.className = 'action';
            btnWood.textContent = '🪵 Cortar leña';
            btnWood.disabled = !can('cut');
            btnWood.onclick = () => {
                const bonus = S.skills?.sharpAxe || 0;
                addRes('lenia', 1 + bonus);
                log(`Cortas leña del bosque.${bonus > 0 ? ` (+${bonus} bonus)` : ''}`, '');
                AudioSystem.playTone('wood');
                vibrate(30);
                addXP(2);
                xpFlash();
                incrementCombo();
                setCooldown(btnWood, 'cut', 1800, '🪵 Cortar leña');
                saveState();
                renderLocationActions(locationId, container);
            };
            reg('cut', btnWood, 1800);
            container.appendChild(btnWood);

            // Basic explore
            const btnExplore = document.createElement('button');
            btnExplore.className = 'action';
            btnExplore.textContent = '🧭 Explorar contornos';
            btnExplore.disabled = !can('explore');
            btnExplore.onclick = () => {
                const roll = Math.random();
                S.stats.explore++;
                AudioSystem.playTone('explore');
                if (roll < 0.4) { addRes('piedra', 1); log('Hallaste piedra útil.', ''); }
                else if (roll < 0.6) { addRes('hierro', 1); log('Recoges vetas de hierro.', ''); }
                else {
                    S.stats.renown += 1;
                    integrator.onRenownGained(S, 1, log);
                    log('Ayudas a un viajero. (+Renombre)', 'good');
                }
                if (!S.threat && Math.random() < 0.18) spawnBoss();
                integrator.onActionPerformed(S, 'explore', log);
                addXP(4);
                xpFlash();
                vibrate(40);
                setCooldown(btnExplore, 'explore', 6000, '🧭 Explorar contornos');
                updateTags(); saveState();
                renderLocationActions(locationId, container);
            };
            reg('explore', btnExplore, 6000);
            container.appendChild(btnExplore);
            break;
        }

        case 'rio': {
            const btnWater = document.createElement('button');
            btnWater.className = 'action';
            btnWater.textContent = '💧 Buscar agua';
            btnWater.disabled = !can('fetch');
            btnWater.onclick = () => {
                const wBonus = S.skills?.deepWells || 0;
                addRes('agua', 1 + wBonus);
                log(`Llenas un odre con agua fresca.${wBonus > 0 ? ` (+${wBonus} bonus)` : ''}`, '');
                AudioSystem.playTone('water');
                vibrate(20);
                addXP(2);
                xpFlash();
                incrementCombo();
                setCooldown(btnWater, 'fetch', 3000, '💧 Buscar agua');
                saveState();
                renderLocationActions(locationId, container);
            };
            reg('fetch', btnWater, 3000);
            container.appendChild(btnWater);
            break;
        }

        case 'campos': {
            // Forage
            const btnHerb = document.createElement('button');
            btnHerb.className = 'action';
            btnHerb.textContent = '🌿 Forrajear';
            btnHerb.disabled = !can('forage');
            btnHerb.onclick = () => {
                const herbBonus = (S.skills?.herbalLore || 0) * 0.15;
                const roll = Math.random();
                if (roll < 0.6 + herbBonus) { addRes('hierbas', 1); log('Recolectas hierbas aromáticas.', ''); }
                else { addRes('aceitunas', 1); log('Encuentras aceitunas maduras.', ''); }
                AudioSystem.playTone('herb');
                vibrate(20);
                addXP(2);
                xpFlash();
                incrementCombo();
                setCooldown(btnHerb, 'forage', 3500, '🌿 Forrajear');
                saveState();
                renderLocationActions(locationId, container);
            };
            reg('forage', btnHerb, 3500);
            container.appendChild(btnHerb);
            break;
        }

        case 'taller': {
            // Crafting
            if (ACTION_LOCKS.crafting()) {
                const row = document.createElement('div'); row.className = 'inline';
                const b1 = document.createElement('button');
                b1.className = 'action';
                b1.textContent = '🔥 Antorcha';
                b1.disabled = !(S.resources.lenia >= 1 && S.resources.aceitunas >= 1) || !can('craft');
                b1.onclick = () => { craft('antorchas'); setCooldown(b1, 'craft', 800, '🔥 Antorcha'); renderLocationActions(locationId, container); };

                const b2 = document.createElement('button');
                b2.className = 'action';
                b2.textContent = '💊 Medicina';
                b2.disabled = !(S.resources.hierbas >= 2 && S.resources.agua >= 1) || !can('craft');
                b2.onclick = () => { craft('medicina'); setCooldown(b2, 'craft', 800, '💊 Medicina'); renderLocationActions(locationId, container); };

                row.appendChild(b1); row.appendChild(b2);
                container.appendChild(row);
                reg('craft', b1, 800);
            }

            // Buildings
            const buildWrap = document.createElement('div'); buildWrap.className = 'inline';
            if (S.discoveries?.piedra && !S.unlocked.molino) {
                const bm = document.createElement('button');
                bm.className = 'action';
                bm.textContent = `🏚️ Molino (${S.resources.piedra}/5 🪨)`;
                bm.disabled = S.resources.piedra < 5;
                bm.onclick = () => { build('molino'); renderLocationActions(locationId, container); };
                buildWrap.appendChild(bm);
            }
            if (S.discoveries?.agua && S.discoveries?.piedra && !S.unlocked.acequia) {
                const ba = document.createElement('button');
                ba.className = 'action';
                ba.textContent = `💧 Acequia (${S.resources.piedra}/3 🪨, ${S.resources.agua}/2 💧)`;
                ba.disabled = !(S.resources.piedra >= 3 && S.resources.agua >= 2);
                ba.onclick = () => { build('acequia'); renderLocationActions(locationId, container); };
                buildWrap.appendChild(ba);
            }
            if (S.discoveries?.hierro && !S.unlocked.forge) {
                const bf = document.createElement('button');
                bf.className = 'action';
                bf.textContent = `⚒️ Fragua (${S.resources.hierro}/5 ⛓️)`;
                bf.disabled = S.resources.hierro < 5;
                bf.onclick = () => { build('fragua'); renderLocationActions(locationId, container); };
                buildWrap.appendChild(bf);
            }
            if (buildWrap.children.length > 0) container.appendChild(buildWrap);

            // Show message if nothing available
            if (container.children.length === 0) {
                const p = document.createElement('p');
                p.style.cssText = 'color:var(--muted);font-size:0.85rem;text-align:center;padding:12px';
                p.textContent = 'Descubre más recursos para desbloquear construcciones.';
                container.appendChild(p);
            }
            break;
        }

        case 'aldea': {
            // Recruit
            if (ACTION_LOCKS.recruit()) {
                const bVill = document.createElement('button');
                bVill.className = 'action';
                bVill.textContent = '👥 Reclutar aldeano (-2 comida)';
                bVill.disabled = (S.resources.trigo + S.resources.aceitunas < 2);
                bVill.onclick = () => {
                    let left = 2;
                    if (S.resources.trigo >= 1) { S.resources.trigo--; left--; }
                    if (left > 0 && S.resources.aceitunas >= left) { S.resources.aceitunas -= left; left = 0; }
                    if (left > 0 && S.resources.trigo >= left) { S.resources.trigo -= left; left = 0; }
                    if (left > 0) return;
                    S.people.villagers = (S.people.villagers || 0) + 1;
                    log('Nuevo aldeano se une a tu poblado.', 'good');
                    integrator.onVillagerRecruited(S, log);
                    addXP(10);
                    xpFlash();
                    vibrate(50);
                    refreshAll(); saveState();
                    renderLocationActions(locationId, container);
                };
                container.appendChild(bVill);

                if (S.people.villagers > 0) {
                    const jobPanel = document.createElement('div');
                    jobPanel.style.cssText = 'margin-top:8px;padding:12px;background:#0c132088;border:1px solid #1b263688;border-radius:12px';
                    const assigned = (S.people.jobs.lumber || 0) + (S.people.jobs.farmer || 0) + (S.people.jobs.miner || 0);
                    const free = S.people.villagers - assigned;
                    jobPanel.innerHTML = `<div style="margin-bottom:10px;font-weight:700;font-size:0.88rem">👥 Aldea (Libres: ${free})</div>`;

                    const jobs = [
                        { key: 'lumber', label: 'Leñadores', icon: '🪵' },
                        { key: 'farmer', label: 'Granjeros', icon: '🌾' },
                        { key: 'miner', label: 'Mineros', icon: '⛏️' }
                    ];

                    jobs.forEach(j => {
                        if (j.key === 'miner' && !S.discoveries?.piedra) return;
                        const row = document.createElement('div');
                        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #1b263633';
                        row.innerHTML = `<span style="font-size:0.85rem">${j.icon} ${j.label}: <b>${S.people.jobs[j.key] || 0}</b></span>`;

                        const ctrls = document.createElement('div');
                        ctrls.style.cssText = 'display:flex;gap:6px';

                        const btnSub = document.createElement('button');
                        btnSub.textContent = '\u2212';
                        btnSub.className = 'action';
                        btnSub.style.cssText = 'width:36px;height:36px;padding:0;font-size:1.1rem;min-height:36px';
                        btnSub.disabled = !S.people.jobs[j.key];
                        btnSub.onclick = () => { S.people.jobs[j.key]--; vibrate(20); refreshAll(); saveState(); renderLocationActions(locationId, container); };

                        const btnAdd = document.createElement('button');
                        btnAdd.textContent = '+';
                        btnAdd.className = 'action';
                        btnAdd.style.cssText = 'width:36px;height:36px;padding:0;font-size:1.1rem;min-height:36px';
                        btnAdd.disabled = free <= 0;
                        btnAdd.onclick = () => { S.people.jobs[j.key] = (S.people.jobs[j.key] || 0) + 1; vibrate(20); refreshAll(); saveState(); renderLocationActions(locationId, container); };

                        ctrls.appendChild(btnSub);
                        ctrls.appendChild(btnAdd);
                        row.appendChild(ctrls);
                        jobPanel.appendChild(row);
                    });
                    container.appendChild(jobPanel);
                }
            }

            // Trader
            if (S.trader) {
                const div = document.createElement('div');
                div.style.cssText = 'margin:8px 0;padding:12px;background:#151b2688;border:1px solid #1b263688;border-radius:12px';
                div.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                        <b>🪵 Mercader</b>
                        <small style="color:var(--muted)">${fmtMs(S.trader.endsAt - now())}</small>
                    </div>
                    <p style="margin:0 0 8px;font-size:0.82rem;color:#aaa">"Cambio ${S.trader.rate} ${RES_META[S.trader.wants]?.label || S.trader.wants} por renombre."</p>
                `;
                const btnTrade = document.createElement('button');
                btnTrade.className = 'action' + (S.resources[S.trader.wants] >= S.trader.rate ? ' glow-btn' : '');
                btnTrade.textContent = S.resources[S.trader.wants] >= S.trader.rate ? '🤝 Intercambiar' : 'No tienes suficiente';
                btnTrade.disabled = S.resources[S.trader.wants] < S.trader.rate;
                btnTrade.onclick = () => {
                    S.resources[S.trader.wants] -= S.trader.rate;
                    const gained = 1 + ((S.prestige || 0) * 0.5);
                    S.stats.renown += gained;
                    integrator.onRenownGained(S, gained, log);
                    log('El mercader habla bien de ti. (+Renombre)', 'good');
                    AudioSystem.playTone('metal');
                    vibrate(50);
                    addXP(8);
                    xpFlash();
                    refreshAll(); saveState();
                    renderLocationActions(locationId, container);
                };
                div.appendChild(btnTrade);
                container.appendChild(div);
            }

            if (container.children.length === 0) {
                const p = document.createElement('p');
                p.style.cssText = 'color:var(--muted);font-size:0.85rem;text-align:center;padding:12px';
                p.textContent = 'Gana renombre para atraer aldeanos.';
                container.appendChild(p);
            }
            break;
        }

        case 'caminos': {
            // Expeditions
            if (S.unlocked.expedition) {
                if (!S.expedition) {
                    const bx = document.createElement('button');
                    bx.className = 'action';
                    bx.textContent = '🗺️ Organizar expedición (3-8 min)';
                    bx.onclick = () => {
                        const region = getRandomRegion();
                        const dur = (3 + Math.floor(Math.random() * 6)) * 60 * 1000;
                        S.expedition = { endsAt: now() + dur, startedAt: now(), region: region.name };
                        log(`${region.emoji} Expedición hacia ${region.name}.`, 'warn');
                        addXP(5);
                        xpFlash();
                        updateTags(); saveState(); renderMap();
                        renderLocationActions(locationId, container);
                    };
                    container.appendChild(bx);
                } else {
                    const remain = S.expedition.endsAt - now();
                    const bx = document.createElement('button');
                    bx.className = 'action' + (remain <= 0 ? ' glow-btn' : '');
                    bx.textContent = remain > 0 ? `🗺️ ${S.expedition.region} (${fmtMs(remain)})` : '🎁 Reclamar expedición';
                    bx.disabled = remain > 0;
                    bx.onclick = () => {
                        const region = REGIONS.find(r => r.name === S.expedition.region) || getRandomRegion();
                        region.loot.forEach(item => {
                            const n = randomRange(item.n[0], item.n[1]);
                            if (item.k === 'renown') { S.stats.renown += n; integrator.onRenownGained(S, n, log); }
                            else addRes(item.k, n);
                        });
                        const ev = randomChoice(region.events);
                        log(`${region.emoji} Expedición: ${ev}`, 'good');
                        S.expedition = null;
                        integrator.onExpeditionCompleted(S, region.name, log);
                        addXP(12);
                        xpFlash();
                        screenFlash('green');
                        vibrate([30, 30, 60]);
                        refreshAll(); updateTags(); saveState(); renderMap();
                        renderLocationActions(locationId, container);

                        if (Math.random() < 0.25) {
                            const eligible = ENEMIES.filter(e => e.level <= S.player.level + 2);
                            if (eligible.length > 0) {
                                const enemy = randomChoice(eligible);
                                setTimeout(() => {
                                    log(`Un ${enemy.name} te embosca en el camino de vuelta.`, 'bad');
                                    startEnemyEncounter(enemy);
                                }, 1500);
                            }
                        }
                    };
                    container.appendChild(bx);
                }
            }

            // Advanced Explore
            if (ACTION_LOCKS.exploreAdvanced()) {
                const bAdv = document.createElement('button');
                bAdv.className = 'action';
                bAdv.textContent = '🏛️ Explorar rutas andaluzas';
                bAdv.disabled = !can('explore_adv');
                bAdv.onclick = () => {
                    const region = getRandomRegion();
                    const roll = Math.random();
                    AudioSystem.playTone('explore');
                    if (roll < 0.5) { addRes('piedra', 2); log(`Materiales en ${region.name}.`, ''); }
                    else if (roll < 0.75) { addRes('hierro', 2); log(`Vetas en ${region.name}.`, ''); }
                    else { S.stats.renown += 2; integrator.onRenownGained(S, 2, log); log(`Fama en ${region.name}.`, 'good'); }
                    integrator.onActionPerformed(S, 'explore', log);
                    addXP(6);
                    xpFlash();
                    vibrate(40);
                    setCooldown(bAdv, 'explore_adv', 12000, '🏛️ Explorar rutas andaluzas');
                    refreshAll(); updateTags(); saveState();
                    renderLocationActions(locationId, container);
                };
                reg('explore_adv', bAdv, 12000);
                container.appendChild(bAdv);
            }

            if (container.children.length === 0) {
                const p = document.createElement('p');
                p.style.cssText = 'color:var(--muted);font-size:0.85rem;text-align:center;padding:12px';
                p.textContent = 'Explora más para desbloquear expediciones.';
                container.appendChild(p);
            }
            break;
        }

        default: {
            const p = document.createElement('p');
            p.style.cssText = 'color:var(--muted);font-size:0.85rem;text-align:center;padding:12px';
            p.textContent = 'Nada que hacer aquí... por ahora.';
            container.appendChild(p);
        }
    }

    markAvailable();
}
