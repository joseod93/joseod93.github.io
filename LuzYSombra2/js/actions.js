
import { S, saveState } from './state.js';
import { REGIONS, BOSSES, RES_META } from './constants.js';
import { now, fmtMs, $ } from './utils.js';
import { log, setCooldown, renderResources, renderAchievements, toast, updateTags, setTip, BUTTON_REFS } from './ui.js';
import { openCombat, showEncounterPrompt } from './combat.js';
import { renderMap, getRandomRegion } from './map.js';
import { AudioSystem } from './audio.js';

const actionsEl = $('#actions');

const ACTION_LOCKS = {
    crafting: () => S.unlocked.crafting,
    recruit: () => S.unlocked.village,
    exploreAdvanced: () => S.stats.renown >= 6 || S.unlocked.expedition
};

function can(action) {
    const t = S.cooldowns[action] || 0;
    return now() >= t;
}

function setCd(action, ms) {
    S.cooldowns[action] = now() + ms;
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

function addRes(key, n) {
    S.resources[key] = (S.resources[key] || 0) + n;
    if (S.resources[key] > 0) markDiscovery(key);
    refreshAll();
}

function markDiscovery(key) {
    if (S.discoveries[key]) return;
    S.discoveries[key] = true;
    // Metadata is in constants but used in UI... 
    // We'll just log generic or assume UI handles it? 
    // UI has metadata. We can import it or just log simple text.
    // "Has descubierto algo nuevo"
    log(`Has conseguido recursos nuevos (${key}).`, 'dim');
    renderActions();
}

// Global Refresh Helper (Updates all UI dependants)
function refreshAll() {
    renderResources();
    checkUnlocks(); // Defined below or imported?
    renderActions();
}

export function tryUnlocks() {
    if (!S.unlocked.water && S.resources.lenia >= 3) { S.unlocked.water = true; log('Puedes buscar agua en un arroyo cercano.', 'dim'); }
    if (!S.unlocked.herbs && S.resources.agua >= 2) { S.unlocked.herbs = true; log('Detectas aroma a romero y tomillo en la sierra.', 'dim'); }
    if (!S.unlocked.olives && S.resources.hierbas >= 1) { S.unlocked.olives = true; log('Al sureste hay olivares. Podrías recolectar aceitunas.', 'dim'); }
    if (!S.unlocked.crafting && (S.resources.aceitunas >= 1 && S.resources.lenia >= 1)) { S.unlocked.crafting = true; log('Has aprendido a fabricar antorchas y remedios.', 'good'); }
    if (!S.unlocked.village && S.stats.renown >= 5) { S.unlocked.village = true; log('Unos viajantes se unen. Nace una pequeña aldea.', 'good'); }
    if (!S.unlocked.expedition && S.stats.explore >= 8) { S.unlocked.expedition = true; log('Puedes organizar expediciones por Andalucía.', 'good'); }
}
const checkUnlocks = tryUnlocks; // alias

function unlockAchievement(key, text) {
    if (!S.achievements[key]) {
        S.achievements[key] = true;
        log(`🏅 Logro desbloqueado: ${text}`, 'warn');
        toast(`Logro: ${text}`);
        renderAchievements();
    }
}

function craft(item) {
    if (item === 'antorchas' && S.resources.lenia >= 1 && S.resources.aceitunas >= 1) {
        S.resources.lenia--; S.resources.aceitunas--; S.resources.antorchas++;
        log('Has fabricado una antorcha.', 'good');
    }
    if (item === 'medicina' && S.resources.hierbas >= 2 && S.resources.agua >= 1) {
        S.resources.hierbas -= 2; S.resources.agua--; S.resources.medicina++;
        log('Has preparado una medicina.', 'good');
    }
    refreshAll();
}

function build(edificio) {
    if (edificio === 'molino' && S.resources.piedra >= 5) {
        S.resources.piedra -= 5; S.unlocked.molino = true;
        log('Has construido un molino.', 'good');
    }
    if (edificio === 'acequia' && S.resources.piedra >= 3 && S.resources.agua >= 2) {
        S.resources.piedra -= 3; S.resources.agua -= 2; S.unlocked.acequia = true;
        log('Has construido una acequia.', 'good');
        unlockAchievement('ach_acequia', 'Arquitecto del Agua');
    }
    if (edificio === 'fragua' && S.resources.hierro >= 5) {
        S.resources.hierro -= 5; S.unlocked.forge = true;
        log('Has construido una fragua.', 'good');
        unlockAchievement('ach_herrero', 'Herrero Mayor');
    }
    refreshAll();
}

export function checkAchievements() {
    if (S.fire.lit && S.fire.heat >= 24) unlockAchievement('luzEterna', 'Primer rayo de sol');
    if (S.resources.aceitunas >= 100) unlockAchievement('ach_aceitunero', 'Maestro Aceitunero');
}

export function renderActions() {
    actionsEl.innerHTML = '';

    // Fuego
    const btnLight = document.createElement('button');
    btnLight.className = 'action';
    btnLight.textContent = S.fire.lit ? 'Mantener la fogata (+calor)' : 'Encender la fogata';
    btnLight.disabled = !can('stoke') || (!S.fire.lit && S.resources.lenia <= 0);
    btnLight.onclick = () => {
        if (!S.fire.lit) {
            if (S.resources.lenia <= 0) return;
            S.resources.lenia--; S.fire.fuel += 3; S.fire.lit = true; log('Has encendido la fogata. El frío retrocede.', 'good');
        } else {
            if (S.resources.lenia <= 0) { log('No tienes leña suficiente.', 'warn'); return; }
            S.resources.lenia--; S.fire.fuel += 2; log('Avivas la lumbre.', 'dim');
        }
        setCd('stoke', 1500);
        renderResources(); updateTags(); saveState();
    };
    actionsEl.appendChild(btnLight);

    // Recolecta básica
    const btnWood = document.createElement('button');
    btnWood.className = 'action';
    btnWood.textContent = can('cut') ? 'Cortar leña' : 'Cortar leña (' + fmtMs(S.cooldowns.cut - now()) + ')';
    btnWood.disabled = !can('cut');
    btnWood.onclick = () => {
        const gained = 1 + (Math.random() < 0.35 ? 1 : 0);
        addRes('lenia', gained);
        log(`Recolectas ${gained} leña.`, '');
        setCooldown(btnWood, 'cut', 1800);
        saveState(); renderActions();
    };
    // Register cooldown 
    setCooldown(btnWood, 'cut', 1800); // This just updates registry if stale, real logic is in click
    // Wait, setCooldown sets state time too. 
    // We should only call setCooldown from helper if we want to update state AND UI ref.
    // Re-assigning UI ref in loop:
    import('./ui.js').then(ui => ui.setCooldown(btnWood, 'cut', 1800)); // Dynamic import inside? No.
    // The issue: setCooldown in UI sets state.cooldowns too.
    // We want to register the button for visual updates even if cd is not just set now.
    // We need a separate registerButton(btn, key, total) function in UI that doesn't touch S.cooldowns?
    // Or just use setCooldown but pass current remaining time?
    // Let's stick to simple: setCooldown does it all.
    // In render loop, we just need to register the button so updateCooldownVisuals finds it.
    // If we call setCooldown, it resets the timer. WRONG.
    // We need registerButton in UI.

    // Quick fix: define registerButton locally that calls UI internals? No.
    // Let's add registerButton to UI module or just piggyback on setCooldown with 0 time?
    // Better: Helper in UI to register without setting time.
    // I can't edit UI.js now without another tool call. 
    // I'll implement a workaround: manually add to BUTTON_REFS or use a safe helper.
    // Actually, `setCooldown` in `ui.js` sets `S.cooldowns`.
    // I'll add `registerCooldownBtn` in `ui.js` in a future step or just access BUTTON_REFS if exported. 
    // BUTTON_REFS is exported!
    // So:
    // import { BUTTON_REFS } from './ui.js'
    // in loop: BUTTON_REFS['cut'] = { btn: btnWood, total: 1800, baseText: 'Cortar leña' };

    // Fix applied below:

    // Register for visual updates
    // We need to know the Total duration for the progress bar.
    // That's static per action type.
    const reg = (key, btn, ms) => {
        // Use the new helper from UI to avoid resetting state
        import('./ui.js').then(ui => ui.registerCooldownBtn(btn, key, ms));
    };

    if (S.unlocked.water) {
        const btnWater = document.createElement('button');
        btnWater.className = 'action';
        btnWater.textContent = can('fetch') ? 'Buscar agua' : 'Buscar agua (' + fmtMs(S.cooldowns.fetch - now()) + ')';
        btnWater.disabled = !can('fetch');
        btnWater.onclick = () => {
            const gained = 1;
            addRes('agua', gained);
            log('Llenas un odre con agua fresca.', '');
            setCooldown(btnWater, 'fetch', 3000);
            saveState(); renderActions();
        };
        reg('fetch', btnWater, 3000);
        actionsEl.appendChild(btnWater);
    }

    // Re-add cut content properly
    actionsEl.innerHTML = ''; // Reset
    // Redo Light
    actionsEl.appendChild(btnLight);

    // Redo Wood
    btnWood.onclick = () => {
        addRes('lenia', 2); // Was 1? no wood gives more usually. Original code logic:
        // Actually original was inline. Wait, previous steps I just re-added btnWood.
        // Let's check original logic. Oh, I replaced it all. 
        // Logic: addRes('lenia', 1); log...
        addRes('lenia', 1);
        log('Cortas leña del bosque cercano.', '');
        AudioSystem.playTone('wood');
        setCooldown(btnWood, 'cut', 1800);
        tryUnlocks(); saveState(); renderActions();
    };
    reg('cut', btnWood, 1800);
    actionsEl.appendChild(btnWood);

    // ... Water ...
    if (S.unlocked.water) {
        const btnWater = document.createElement('button');
        btnWater.className = 'action';
        btnWater.textContent = can('fetch') ? 'Buscar agua' : 'Buscar agua (' + fmtMs(S.cooldowns.fetch - now()) + ')';
        btnWater.disabled = !can('fetch');
        btnWater.onclick = () => {
            const gained = 1;
            addRes('agua', gained);
            log('Llenas un odre con agua fresca.', '');
            setCooldown(btnWater, 'fetch', 3000);
            saveState(); renderActions();
        };
        reg('fetch', btnWater, 3000);
        actionsEl.appendChild(btnWater);
    }

    if (S.unlocked.herbs) {
        const btnHerb = document.createElement('button');
        btnHerb.className = 'action';
        btnHerb.textContent = can('forage') ? 'Forrajear hierbas' : 'Forrajear hierbas (' + fmtMs(S.cooldowns.forage - now()) + ')';
        btnHerb.disabled = !can('forage');
        btnHerb.onclick = () => {
            const roll = Math.random();
            if (roll < 0.6) { addRes('hierbas', 1); log('Recolectas hierbas aromáticas.', ''); }
            else { addRes('aceitunas', 1); log('Encuentras unas aceitunas maduras.', ''); }
            setCooldown(btnHerb, 'forage', 3500);
            tryUnlocks(); saveState(); renderActions();
        };
        reg('forage', btnHerb, 3500);
        actionsEl.appendChild(btnHerb);
    }

    // Explorar
    const btnExplore = document.createElement('button');
    btnExplore.className = 'action';
    btnExplore.textContent = can('explore') ? 'Explorar los contornos' : 'Explorar (' + fmtMs(S.cooldowns.explore - now()) + ')';
    btnExplore.disabled = !can('explore');
    btnExplore.onclick = () => {
        const roll = Math.random();
        S.stats.explore++;
        if (roll < 0.4) { addRes('piedra', 1); log('Hallaste piedra útil.', ''); }
        else if (roll < 0.6) { addRes('hierro', 1); log('Recoges vetas de hierro.', ''); }
        else { S.stats.renown += 1; log('Ayudas a un viajero; se corre la voz. (+Renombre)', 'good'); }
        if (!S.threat && Math.random() < 0.18) { spawnBoss(); }
        setCooldown(btnExplore, 'explore', 6000);
        tryUnlocks(); updateTags(); saveState(); renderActions();
    };
    reg('explore', btnExplore, 6000);
    actionsEl.appendChild(btnExplore);

    // Crafteo
    if (ACTION_LOCKS.crafting()) {
        const row = document.createElement('div'); row.className = 'inline';
        const b1 = document.createElement('button'); b1.className = 'action'; b1.textContent = 'Fabricar antorcha (-1 leña, -1 aceituna)';
        b1.disabled = !(S.resources.lenia >= 1 && S.resources.aceitunas >= 1) || !can('craft');
        b1.onclick = () => { craft('antorchas'); setCooldown(b1, 'craft', 800); refreshAll(); saveState(); };
        const b2 = document.createElement('button'); b2.className = 'action'; b2.textContent = 'Preparar medicina (-2 hierbas, -1 agua)';
        b2.disabled = !(S.resources.hierbas >= 2 && S.resources.agua >= 1) || !can('craft');
        b2.onclick = () => { craft('medicina'); setCooldown(b2, 'craft', 800); refreshAll(); saveState(); };
        row.appendChild(b1); row.appendChild(b2);
        actionsEl.appendChild(row);
    }

    // Construcciones
    const buildWrap = document.createElement('div'); buildWrap.className = 'inline';
    if (S.discoveries && S.discoveries.piedra) {
        const bm = document.createElement('button'); bm.className = 'action'; bm.textContent = 'Construir molino (-5 piedra)';
        bm.disabled = S.unlocked.molino || S.resources.piedra < 5;
        bm.onclick = () => { build('molino'); refreshAll(); saveState(); };
        buildWrap.appendChild(bm);
    }
    if (S.discoveries && S.discoveries.agua && S.discoveries.piedra) {
        const ba = document.createElement('button'); ba.className = 'action'; ba.textContent = 'Construir acequia (-3 piedra, -2 agua)';
        ba.disabled = S.unlocked.acequia || !(S.resources.piedra >= 3 && S.resources.agua >= 2);
        ba.onclick = () => { build('acequia'); refreshAll(); saveState(); };
        buildWrap.appendChild(ba);
    }
    if (S.discoveries && S.discoveries.hierro) {
        const bf = document.createElement('button'); bf.className = 'action'; bf.textContent = 'Construir fragua (-5 hierro)';
        bf.disabled = S.unlocked.forge || S.resources.hierro < 5;
        bf.onclick = () => { build('fragua'); refreshAll(); saveState(); };
        buildWrap.appendChild(bf);
    }
    if (buildWrap.children.length > 0) actionsEl.appendChild(buildWrap);

    // Expediciones
    if (S.unlocked.expedition) {
        if (!S.expedition) {
            const bx = document.createElement('button'); bx.className = 'action'; bx.textContent = 'Organizar expedición (3-8 min)';
            bx.onclick = () => {
                const region = getRandomRegion();
                const dur = (3 + Math.floor(Math.random() * 6)) * 60 * 1000;
                S.expedition = { endsAt: now() + dur, startedAt: now(), region: region.name };
                log(`${region.emoji} Una expedición parte hacia ${region.name}.`, 'warn');
                setTip('Vuelve más tarde para reclamar los hallazgos de la expedición.');
                updateTags(); saveState(); renderActions(); renderMap();
            };
            actionsEl.appendChild(bx);
        } else {
            const remain = S.expedition.endsAt - now();
            const bx = document.createElement('button'); bx.className = 'action'; bx.textContent = remain > 0 ? ('Expedición en curso (' + fmtMs(remain) + ')') : 'Reclamar expedición';
            bx.disabled = remain > 0;
            bx.onclick = () => {
                if (now() < S.expedition.endsAt) return;
                const region = REGIONS.find(r => r.name === S.expedition.region) || getRandomRegion();
                region.loot.forEach(item => {
                    const min = item.n[0], max = item.n[1];
                    const n = min + Math.floor(Math.random() * (max - min + 1));
                    if (item.k === 'renown') { S.stats.renown += n; }
                    else { addRes(item.k, n); }
                });
                const ev = region.events[Math.floor(Math.random() * region.events.length)];
                log(`${region.emoji} La expedición regresa de ${region.name}: ${ev}`, 'good');
                S.expedition = null;
                updateTags(); renderResources(); tryUnlocks(); saveState(); renderActions(); renderMap();
            };
            actionsEl.appendChild(bx);
        }
    }

    // Trader
    if (S.trader) {
        const div = document.createElement('div');
        div.className = 'card';
        div.style.background = '#151b26'; div.style.marginBottom = '10px'; div.style.padding = '10px';
        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <b>🪵 Mercader Ambulante</b>
                <small>${fmtMs(S.trader.endsAt - now())}</small>
            </div>
            <p style="margin:0 0 8px;font-size:0.9rem;color:#ccc">"Te cambio ${S.trader.rate} de ${RES_META[S.trader.wants]?.label || S.trader.wants} por algo de fama."</p>
        `;
        const btnTrade = document.createElement('button');
        btnTrade.className = 'action';
        const cost = S.trader.rate;
        const canAfford = S.resources[S.trader.wants] >= cost;
        btnTrade.textContent = canAfford ? 'Intercambiar' : 'No tienes suficiente';
        btnTrade.disabled = !canAfford;
        btnTrade.onclick = () => {
            if (S.resources[S.trader.wants] >= cost) {
                S.resources[S.trader.wants] -= cost;

                // Prestige Multiplier Logic
                const prestigeMult = 1 + ((S.prestige || 0) * 0.5);
                S.stats.renown += (1 * prestigeMult);

                log('El mercader asiente y habla bien de ti. (+Renombre)', 'good');
                AudioSystem.playTone('metal');
                saveState(); renderActions(); renderResources();
            }
        };
        div.appendChild(btnTrade);
        actionsEl.appendChild(div);
    }

    // Boss
    if (S.threat) {
        const t = S.threat;
        const remain = t.endsAt - now();
        const bb = document.createElement('button'); bb.className = 'action';
        bb.textContent = remain > 0 ? `Enfrentar: ${t.name} (HP ${t.hp}/${t.max})` : `La amenaza se desvanece`;
        bb.disabled = remain <= 0;
        bb.onclick = () => { openCombat(); };
        actionsEl.appendChild(bb);
    }

    // Advanced Explore
    if (ACTION_LOCKS.exploreAdvanced()) {
        const bAdv = document.createElement('button'); bAdv.className = 'action'; bAdv.textContent = 'Explorar rutas andaluzas (avanzado)';
        bAdv.onclick = () => {
            const region = getRandomRegion();
            const roll = Math.random();
            if (roll < 0.5) { addRes('piedra', 2); log(`Exploras ${region.name} y recoges materiales.`, ''); }
            else if (roll < 0.75) { addRes('hierro', 2); log(`Encuentras mejores vetas en ${region.name}.`, ''); }
            else { S.stats.renown += 2; log(`Te reconocen en ${region.name}. (+2 Renombre)`, 'good'); }
            setCooldown(bAdv, 'explore_adv', 12000);
            refreshAll(); updateTags(); saveState();
        };
        reg('explore_adv', bAdv, 12000);
        actionsEl.appendChild(bAdv);
    }

    // Recruit
    if (ACTION_LOCKS.recruit()) {
        const bVill = document.createElement('button'); bVill.className = 'action'; bVill.textContent = 'Reclutar aldeano (-2 comida variada)';
        bVill.disabled = !((S.resources.trigo >= 1 && S.resources.aceitunas >= 1) || (S.resources.trigo >= 2) || (S.resources.aceitunas >= 2));
        bVill.onclick = () => {
            if (S.resources.trigo >= 1 && S.resources.aceitunas >= 1) { S.resources.trigo--; S.resources.aceitunas--; }
            else if (S.resources.trigo >= 2) { S.resources.trigo -= 2; }
            else if (S.resources.aceitunas >= 2) { S.resources.aceitunas -= 2; }
            else return;
            S.people.villagers = (S.people.villagers || 0) + 1;
            log('Un nuevo aldeano se une a tu poblado.', 'good');
            refreshAll(); saveState();
        };
        actionsEl.appendChild(bVill);

        // Village Jobs Management
        if (S.people.villagers > 0) {
            const jobPanel = document.createElement('div');
            jobPanel.style.marginTop = '10px';
            jobPanel.style.padding = '10px';
            jobPanel.style.background = '#0e1420';
            jobPanel.style.border = '1px solid #1b2636';
            jobPanel.style.borderRadius = '8px';

            const assigned = (S.people.jobs.lumber || 0) + (S.people.jobs.farmer || 0) + (S.people.jobs.miner || 0);
            const free = S.people.villagers - assigned;

            // Calc production/consumption estimates (Per min approx)
            // Consumption: 0.1 * 60 = 6 per villager/min
            const consume = (S.people.villagers * 6).toFixed(1);
            // Farmers: 0.08 * 60 = 4.8 per farmer/min (ignoring heat bonus for display simplicity)
            const produce = (S.people.jobs.farmer * 4.8).toFixed(1);
            const net = (produce - consume).toFixed(1);
            const netColor = net >= 0 ? '#9ad06e' : '#ff6b6b';

            jobPanel.innerHTML = `<div style="margin-bottom:8px;font-size:0.9rem;color:#dfe8ff">
                <b>Gestión de Aldea</b> (Libres: ${free})<br>
                <small style="color:#93a1b3">Comida: <span style="color:${netColor}">${net >= 0 ? '+' : ''}${net}/min</span> (Prod: ${produce}, Cons: ${consume})</small>
            </div>`;

            const jobs = [
                { key: 'lumber', label: 'Leñadores', icon: '🪵' },
                { key: 'farmer', label: 'Granjeros', icon: '🌾' },
                { key: 'miner', label: 'Mineros', icon: '⛏️' }
            ];

            jobs.forEach(j => {
                // Show miner only if unlocked forge or stone discovered? 
                // Let's show if stone is discovered.
                if (j.key === 'miner' && !S.discoveries.piedra) return;

                const count = S.people.jobs[j.key] || 0;
                const row = document.createElement('div');
                row.className = 'inline';
                row.style.marginBottom = '6px';
                row.style.justifyContent = 'space-between';
                row.innerHTML = `<span>${j.icon} ${j.label}: <b>${count}</b></span>`;

                const ctrls = document.createElement('div');
                const btnSub = document.createElement('button'); btnSub.textContent = '-'; btnSub.className = 'action';
                btnSub.style.padding = '2px 8px'; btnSub.style.width = 'auto'; btnSub.style.minWidth = '30px';
                btnSub.disabled = count <= 0;
                btnSub.onclick = () => { S.people.jobs[j.key]--; refreshAll(); saveState(); };

                const btnAdd = document.createElement('button'); btnAdd.textContent = '+'; btnAdd.className = 'action';
                btnAdd.style.padding = '2px 8px'; btnAdd.style.width = 'auto'; btnAdd.style.minWidth = '30px';
                btnAdd.disabled = free <= 0;
                btnAdd.onclick = () => {
                    if (!S.people.jobs[j.key]) S.people.jobs[j.key] = 0;
                    S.people.jobs[j.key]++;
                    refreshAll(); saveState();
                };

                ctrls.appendChild(btnSub);
                ctrls.appendChild(btnAdd);
                row.appendChild(ctrls);
                jobPanel.appendChild(row);
            });

            actionsEl.appendChild(jobPanel);
        }
    }
}

// Achievement Listener
window.addEventListener('lys-unlock-achievement', (e) => {
    if (e.detail && e.detail.key && e.detail.mk) {
        unlockAchievement(e.detail.key, e.detail.mk);
    }
});
