
import { S, saveState } from './state.js';
import { REGIONS, BOSSES, RES_META, ENEMIES, LOCAL_LOCATIONS, BUILDING_UPGRADES } from './constants.js';
import { now, fmtMs, $, randomRange, randomChoice, vibrate } from './utils.js';
import { log, setCooldown, renderResources, renderAchievements, toast, updateTags, setTip, BUTTON_REFS, addXP, xpFlash, screenFlash, incrementCombo, fireConfetti, getComboCount } from './ui.js';
import { openCombat, showEncounterPrompt, startEnemyEncounter } from './combat.js';
import { renderMap, getRandomRegion } from './map.js';
import { AudioSystem } from './audio.js';
import { spawnBoss } from './game.js';
import integrator from './integrator.js';
import { triggerRegionEvent } from './events.js';

const ACTION_LOCKS = {
    crafting: () => S.unlocked.crafting,
    recruit: () => S.unlocked.village,
    exploreAdvanced: () => S.stats.renown >= 6 || S.unlocked.expedition
};

function can(action) {
    return now() >= (S.cooldowns[action] || 0);
}

// Multiplicador por combo: encadenar acciones rinde más recursos (cap x2)
function comboMult() {
    return Math.min(2, 1 + getComboCount() * 0.1);
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
}

function refreshAll() {
    renderResources();
    checkUnlocks();
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

// Construir (nivel 0->1) o mejorar (nivel>=1) un edificio con coste escalado
function buildOrUpgrade(key) {
    const up = BUILDING_UPGRADES[key];
    if (!up) return;
    const lvl = S.buildings?.[key] || 0;
    if (lvl >= up.max) return;
    const cost = up.cost(lvl);
    for (const [r, n] of Object.entries(cost)) if ((S.resources[r] || 0) < n) return;
    for (const [r, n] of Object.entries(cost)) S.resources[r] -= n;
    if (!S.buildings) S.buildings = { molino: 0, acequia: 0, forge: 0 };
    S.buildings[key] = lvl + 1;
    S.unlocked[key] = true;   // molino/acequia/forge coinciden con S.unlocked
    AudioSystem.playTone('build');
    screenFlash('gold');
    vibrate(40);
    if (lvl === 0) { log(`Has construido: ${up.name}.`, 'good'); integrator.onBuildingConstructed(S, key, log); addXP(20); }
    else { log(`${up.name} mejorado a nivel ${lvl + 1}.`, 'good'); addXP(10); }
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
    if (!canSpin() || window.__lysSpinning) return;
    window.__lysSpinning = true;   // evita re-giro y que el refresh del overlay destruya la ruleta a mitad

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
            S.streak.lastSpinDate = getTodayStr();   // marcar consumida AL aplicar el premio (no antes)
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
            window.__lysSpinning = false;
            window.dispatchEvent(new CustomEvent('lys-actions-refresh'));
        }
    }, 80 + ticks * 12);
}

// ===== LOCATION-AWARE ACTION RENDERING =====
export function renderLocationActions(locationId, container) {
    if (!container) return;
    container.innerHTML = '';

    // Mini-tira de cambio rápido: saltar entre lugares sin cerrar el overlay (encadenar acciones)
    const others = LOCAL_LOCATIONS.filter(l => !l.unlock || S.unlocked[l.unlock]);
    if (others.length > 1) {
        const strip = document.createElement('div');
        strip.className = 's3-strip mini-strip';
        others.forEach(l => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 's3-btn mini' + (l.id === locationId ? ' active' : '');
            b.title = l.name;
            b.innerHTML = `<span class="s3-btn-icon">${l.emoji}</span>`;
            b.onclick = () => window.dispatchEvent(new CustomEvent('lys-open-location', { detail: l.id }));
            strip.appendChild(b);
        });
        container.appendChild(strip);
    }
    const baseCount = container.children.length;   // hijos "base" (mini-tira) para detectar "sin contenido"

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
            btnWood.id = 'btnCut';
            btnWood.className = 'action';
            btnWood.textContent = '🪵 Cortar leña';
            btnWood.disabled = !can('cut');
            btnWood.onclick = () => {
                const bonus = S.skills?.sharpAxe || 0;
                const got = Math.round((1 + bonus) * comboMult());
                addRes('lenia', got);
                log(`Cortas leña del bosque.${got > 1 + bonus ? ` (combo +${got - 1 - bonus})` : bonus > 0 ? ` (+${bonus} bonus)` : ''}`, '');
                AudioSystem.playTone('wood');
                vibrate(30);
                addXP(2);
                xpFlash();
                incrementCombo();
                setCooldown(btnWood, 'cut', 1000, '🪵 Cortar leña');
                saveState();
                renderLocationActions(locationId, container);
            };
            reg('cut', btnWood, 1000);
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
                if (!S.threat && S.player.level >= 2 && Math.random() < 0.12) spawnBoss();
                integrator.onActionPerformed(S, 'explore', log);
                addXP(4);
                xpFlash();
                vibrate(40);
                setCooldown(btnExplore, 'explore', 4000, '🧭 Explorar contornos');
                updateTags(); saveState();
                renderLocationActions(locationId, container);
            };
            reg('explore', btnExplore, 4000);
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
                const got = Math.round((1 + wBonus) * comboMult());
                addRes('agua', got);
                log(`Llenas un odre con agua fresca.${got > 1 + wBonus ? ` (combo +${got - 1 - wBonus})` : wBonus > 0 ? ` (+${wBonus} bonus)` : ''}`, '');
                AudioSystem.playTone('water');
                vibrate(20);
                addXP(2);
                xpFlash();
                incrementCombo();
                setCooldown(btnWater, 'fetch', 1500, '💧 Buscar agua');
                saveState();
                renderLocationActions(locationId, container);
            };
            reg('fetch', btnWater, 1500);
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
                const got = Math.max(1, Math.round(comboMult()));
                if (roll < 0.6 + herbBonus) { addRes('hierbas', got); log(`Recolectas hierbas aromáticas.${got > 1 ? ` (combo +${got - 1})` : ''}`, ''); }
                else { addRes('aceitunas', got); log(`Encuentras aceitunas maduras.${got > 1 ? ` (combo +${got - 1})` : ''}`, ''); }
                AudioSystem.playTone('herb');
                vibrate(20);
                addXP(2);
                xpFlash();
                incrementCombo();
                setCooldown(btnHerb, 'forage', 1800, '🌿 Forrajear');
                saveState();
                renderLocationActions(locationId, container);
            };
            reg('forage', btnHerb, 1800);
            container.appendChild(btnHerb);
            break;
        }

        case 'taller': {
            // Crafting
            if (ACTION_LOCKS.crafting()) {
                const craftCd = Math.max(200, Math.round(800 * (1 - (S.skills?.fastCraft || 0) * 0.2)));   // Artesanía Rápida
                const row = document.createElement('div'); row.className = 'inline';
                const b1 = document.createElement('button');
                b1.className = 'action';
                b1.textContent = '🔥 Antorcha';
                b1.disabled = !(S.resources.lenia >= 1 && S.resources.aceitunas >= 1) || !can('craft');
                b1.onclick = () => { craft('antorchas'); setCooldown(b1, 'craft', craftCd, '🔥 Antorcha'); renderLocationActions(locationId, container); };

                const b2 = document.createElement('button');
                b2.className = 'action';
                b2.textContent = '💊 Medicina';
                b2.disabled = !(S.resources.hierbas >= 2 && S.resources.agua >= 1) || !can('craft');
                b2.onclick = () => { craft('medicina'); setCooldown(b2, 'craft', craftCd, '💊 Medicina'); renderLocationActions(locationId, container); };

                row.appendChild(b1); row.appendChild(b2);
                container.appendChild(row);
                reg('craft', b1, craftCd);
            }

            // Buildings (construir + mejorar por niveles)
            const buildWrap = document.createElement('div'); buildWrap.className = 'actions';
            const RICON = { piedra: '🪨', agua: '💧', hierro: '⛓️' };
            const buildDefs = [
                { key: 'molino', icon: '🏚️', name: 'Molino', disc: S.discoveries?.piedra },
                { key: 'acequia', icon: '💧', name: 'Acequia', disc: S.discoveries?.agua && S.discoveries?.piedra },
                { key: 'forge', icon: '⚒️', name: 'Fragua', disc: S.discoveries?.hierro },
            ];
            buildDefs.forEach(d => {
                if (!d.disc) return;
                const up = BUILDING_UPGRADES[d.key];
                const lvl = S.buildings?.[d.key] || 0;
                const b = document.createElement('button');
                b.className = 'action';
                if (lvl >= up.max) {
                    b.textContent = `${d.icon} ${d.name} · MAX (Nv ${up.max})`;
                    b.disabled = true;
                } else {
                    const cost = up.cost(lvl);
                    const costStr = Object.entries(cost).map(([r, n]) => `${RICON[r] || r}${n}`).join(' ');
                    const can = Object.entries(cost).every(([r, n]) => (S.resources[r] || 0) >= n);
                    b.textContent = lvl === 0
                        ? `${d.icon} Construir ${d.name} (${costStr})`
                        : `${d.icon} Mejorar ${d.name} Nv ${lvl}→${lvl + 1} (${costStr})`;
                    b.disabled = !can;
                    b.onclick = () => { buildOrUpgrade(d.key); renderLocationActions(locationId, container); };
                }
                buildWrap.appendChild(b);
            });
            if (buildWrap.children.length > 0) container.appendChild(buildWrap);

            // Show message if nothing available
            if (container.children.length === baseCount) {
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
                    // Comprobar el total ANTES de gastar (no restar comida si no llega a 2)
                    if (((S.resources.trigo || 0) + (S.resources.aceitunas || 0)) < 2) return;
                    let need = 2;
                    const t = Math.min(S.resources.trigo || 0, need);
                    S.resources.trigo -= t; need -= t;
                    if (need > 0) S.resources.aceitunas -= need;
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
                    const gained = 1 + ((S.prestige || 0) * 0.25);
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

            if (container.children.length === baseCount) {
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
                        // Avisar al terminar (gancho de retorno si activó notificaciones)
                        import('./notifications.js').then(({ notifications }) => setTimeout(() => notifications.expeditionComplete(region.name), dur));
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
                        triggerRegionEvent(region.name, S, log);   // evento temático de la región (variedad)
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
                    triggerRegionEvent(region.name, S, log);
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

            if (container.children.length === baseCount) {
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
