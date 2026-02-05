
import { S, saveState } from './state.js';
import { REGIONS, BOSSES, RES_META } from './constants.js';
import { now, fmtMs, $, randomRange, randomChoice, vibrate } from './utils.js';
import { log, setCooldown, renderResources, renderAchievements, toast, updateTags, setTip, BUTTON_REFS } from './ui.js';
import { openCombat, showEncounterPrompt } from './combat.js';
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
    const t = S.cooldowns[action] || 0;
    return now() >= t;
}

function setCd(action, ms) {
    S.cooldowns[action] = now() + ms;
}

function addRes(key, n) {
    S.resources[key] = (S.resources[key] || 0) + n;
    if (S.resources[key] > 0) markDiscovery(key);
    // Hook para el nuevo sistema
    integrator.onResourceGathered(S, key, n, log);
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

function craft(item) {
    if (item === 'antorchas' && S.resources.lenia >= 1 && S.resources.aceitunas >= 1) {
        S.resources.lenia--; S.resources.aceitunas--; S.resources.antorchas++;
        log('Has fabricado una antorcha.', 'good');
        // Hook para el nuevo sistema
        integrator.onItemCrafted(S, item, 1, log);
    }
    if (item === 'medicina' && S.resources.hierbas >= 2 && S.resources.agua >= 1) {
        S.resources.hierbas -= 2; S.resources.agua--; S.resources.medicina++;
        log('Has preparado una medicina.', 'good');
        // Hook para el nuevo sistema
        integrator.onItemCrafted(S, item, 1, log);
    }
    refreshAll();
}

function build(edificio) {
    if (edificio === 'molino' && S.resources.piedra >= 5) {
        S.resources.piedra -= 5; S.unlocked.molino = true;
        log('Has construido un molino.', 'good');
        // Hook para el nuevo sistema
        integrator.onBuildingConstructed(S, edificio, log);
    }
    if (edificio === 'acequia' && S.resources.piedra >= 3 && S.resources.agua >= 2) {
        S.resources.piedra -= 3; S.resources.agua -= 2; S.unlocked.acequia = true;
        log('Has construido una acequia.', 'good');
        // Hook para el nuevo sistema
        integrator.onBuildingConstructed(S, edificio, log);
    }
    if (edificio === 'fragua' && S.resources.hierro >= 5) {
        S.resources.hierro -= 5; S.unlocked.forge = true;
        log('Has construido una fragua.', 'good');
        // Hook para el nuevo sistema
        integrator.onBuildingConstructed(S, edificio, log);
    }
    refreshAll();
}

export function checkAchievements() {
    // Legacy check handled by integrator and achievements.js module now.
    // Keeping function as placeholder if game.js calls it.
}

export function renderActions() {
    if (!actionsEl) return;
    actionsEl.innerHTML = '';

    const reg = (key, btn, ms) => {
        import('./ui.js').then(ui => ui.registerCooldownBtn(btn, key, ms));
    };

    // 1. Fuego (Stoke)
    const btnLight = document.createElement('button');
    btnLight.id = 'btnStoke';
    btnLight.className = 'action';
    btnLight.textContent = S.fire.lit ? 'Mantener la fogata (+calor)' : 'Encender la fogata';
    btnLight.disabled = !can('stoke') || (!S.fire.lit && S.resources.lenia <= 0);
    btnLight.onclick = () => {
        if (!S.fire.lit) {
            if (S.resources.lenia <= 0) return;
            S.resources.lenia--; S.fire.fuel += 3; S.fire.lit = true;
            log('Has encendido la fogata. El frío retrocede.', 'good');
        } else {
            if (S.resources.lenia <= 0) { log('No tienes leña suficiente.', 'warn'); return; }
            S.resources.lenia--; S.fire.fuel += 2;
            log('Avivas la lumbre.', 'dim');
        }
        setCd('stoke', 1500);
        refreshAll(); updateTags(); saveState();
    };
    reg('stoke', btnLight, 1500);
    actionsEl.appendChild(btnLight);

    // 2. Recolecta básica (Wood, Water, Herbs)
    const basicWrap = document.createElement('div');
    basicWrap.className = 'actions';

    // Wood
    const btnWood = document.createElement('button');
    btnWood.id = 'btnCut';
    btnWood.className = 'action';
    btnWood.textContent = 'Cortar leña';
    btnWood.disabled = !can('cut');
    btnWood.onclick = () => {
        const gained = 1;
        addRes('lenia', gained);
        log('Cortas leña del bosque cercano.', '');
        AudioSystem.playTone('wood');
        vibrate(30);
        setCooldown(btnWood, 'cut', 1800);
        saveState(); renderActions();
    };
    reg('cut', btnWood, 1800);
    basicWrap.appendChild(btnWood);

    // Water
    if (S.unlocked.water) {
        const btnWater = document.createElement('button');
        btnWater.className = 'action';
        btnWater.textContent = 'Buscar agua';
        btnWater.disabled = !can('fetch');
        btnWater.onclick = () => {
            addRes('agua', 1);
            log('Llenas un odre con agua fresca.', '');
            setCooldown(btnWater, 'fetch', 3000);
            saveState(); renderActions();
        };
        reg('fetch', btnWater, 3000);
        basicWrap.appendChild(btnWater);
    }

    // Herbs
    if (S.unlocked.herbs) {
        const btnHerb = document.createElement('button');
        btnHerb.className = 'action';
        btnHerb.textContent = 'Forrajear hierbas';
        btnHerb.disabled = !can('forage');
        btnHerb.onclick = () => {
            const roll = Math.random();
            if (roll < 0.6) { addRes('hierbas', 1); log('Recolectas hierbas aromáticas.', ''); }
            else { addRes('aceitunas', 1); log('Encuentras unas aceitunas maduras.', ''); }
            setCooldown(btnHerb, 'forage', 3500);
            saveState(); renderActions();
        };
        reg('forage', btnHerb, 3500);
        basicWrap.appendChild(btnHerb);
    }
    actionsEl.appendChild(basicWrap);

    // 3. Explorar
    const btnExplore = document.createElement('button');
    btnExplore.className = 'action';
    btnExplore.textContent = 'Explorar los contornos';
    btnExplore.disabled = !can('explore');
    btnExplore.onclick = () => {
        const roll = Math.random();
        S.stats.explore++;
        if (roll < 0.4) { addRes('piedra', 1); log('Hallaste piedra útil.', ''); }
        else if (roll < 0.6) { addRes('hierro', 1); log('Recoges vetas de hierro.', ''); }
        else {
            S.stats.renown += 1;
            integrator.onRenownGained(S, 1, log);
            log('Ayudas a un viajero; se corre la voz. (+Renombre)', 'good');
        }
        if (!S.threat && Math.random() < 0.18) { spawnBoss(); }
        integrator.onActionPerformed(S, 'explore', log);
        setCooldown(btnExplore, 'explore', 6000);
        updateTags(); saveState(); renderActions();
    };
    reg('explore', btnExplore, 6000);
    actionsEl.appendChild(btnExplore);

    // 4. Crafteo
    if (ACTION_LOCKS.crafting()) {
        const row = document.createElement('div'); row.className = 'inline';
        const b1 = document.createElement('button'); b1.className = 'action'; b1.textContent = 'Antorcha (-1 leña, -1 aceituna)';
        b1.disabled = !(S.resources.lenia >= 1 && S.resources.aceitunas >= 1) || !can('craft');
        b1.onclick = () => { craft('antorchas'); setCooldown(b1, 'craft', 800); };

        const b2 = document.createElement('button'); b2.className = 'action'; b2.textContent = 'Medicina (-2 hierbas, -1 agua)';
        b2.disabled = !(S.resources.hierbas >= 2 && S.resources.agua >= 1) || !can('craft');
        b2.onclick = () => { craft('medicina'); setCooldown(b2, 'craft', 800); };

        row.appendChild(b1); row.appendChild(b2);
        actionsEl.appendChild(row);
        reg('craft', b1, 800); // Visual mapping for crafting cd
    }

    // 5. Construcciones
    const buildWrap = document.createElement('div'); buildWrap.className = 'inline';
    if (S.discoveries?.piedra) {
        const bm = document.createElement('button'); bm.className = 'action'; bm.textContent = 'Molino (-5 piedra)';
        bm.disabled = S.unlocked.molino || S.resources.piedra < 5;
        bm.onclick = () => { build('molino'); };
        buildWrap.appendChild(bm);
    }
    if (S.discoveries?.agua && S.discoveries?.piedra) {
        const ba = document.createElement('button'); ba.className = 'action'; ba.textContent = 'Acequia (-3 piedra, -2 agua)';
        ba.disabled = S.unlocked.acequia || !(S.resources.piedra >= 3 && S.resources.agua >= 2);
        ba.onclick = () => { build('acequia'); };
        buildWrap.appendChild(ba);
    }
    if (S.discoveries?.hierro) {
        const bf = document.createElement('button'); bf.className = 'action'; bf.textContent = 'Fragua (-5 hierro)';
        bf.disabled = S.unlocked.forge || S.resources.hierro < 5;
        bf.onclick = () => { build('fragua'); };
        buildWrap.appendChild(bf);
    }
    if (buildWrap.children.length > 0) actionsEl.appendChild(buildWrap);

    // 6. Expediciones
    if (S.unlocked.expedition) {
        if (!S.expedition) {
            const bx = document.createElement('button'); bx.className = 'action'; bx.textContent = 'Organizar expedición (3-8 min)';
            bx.onclick = () => {
                const region = getRandomRegion();
                const dur = (3 + Math.floor(Math.random() * 6)) * 60 * 1000;
                S.expedition = { endsAt: now() + dur, startedAt: now(), region: region.name };
                log(`${region.emoji} Una expedición parte hacia ${region.name}.`, 'warn');
                updateTags(); saveState(); renderActions(); renderMap();
            };
            actionsEl.appendChild(bx);
        } else {
            const remain = S.expedition.endsAt - now();
            const bx = document.createElement('button'); bx.className = 'action';
            bx.textContent = remain > 0 ? `Expedición: ${S.expedition.region} (${fmtMs(remain)})` : 'Reclamar expedición';
            bx.disabled = remain > 0;
            bx.onclick = () => {
                const region = REGIONS.find(r => r.name === S.expedition.region) || getRandomRegion();
                region.loot.forEach(item => {
                    const n = randomRange(item.n[0], item.n[1]);
                    if (item.k === 'renown') { S.stats.renown += n; integrator.onRenownGained(S, n, log); }
                    else { addRes(item.k, n); }
                });
                const ev = randomChoice(region.events);
                log(`${region.emoji} La expedición regresa: ${ev}`, 'good');
                S.expedition = null;
                integrator.onExpeditionCompleted(S, region.name, log);
                refreshAll(); updateTags(); saveState(); renderMap();
            };
            actionsEl.appendChild(bx);
        }
    }

    // 7. Trader
    if (S.trader) {
        const div = document.createElement('div');
        div.className = 'card';
        div.style.background = '#151b26'; div.style.marginBottom = '10px'; div.style.padding = '10px';
        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <b>🪵 Mercader Ambulante</b>
                <small>${fmtMs(S.trader.endsAt - now())}</small>
            </div>
            <p style="margin:8px 0;font-size:0.9rem;color:#ccc">"Cambio ${S.trader.rate} ${RES_META[S.trader.wants]?.label || S.trader.wants} por renombre."</p>
        `;
        const btnTrade = document.createElement('button');
        btnTrade.className = 'action';
        btnTrade.textContent = S.resources[S.trader.wants] >= S.trader.rate ? 'Intercambiar' : 'No tienes suficiente';
        btnTrade.disabled = S.resources[S.trader.wants] < S.trader.rate;
        btnTrade.onclick = () => {
            S.resources[S.trader.wants] -= S.trader.rate;
            const gained = 1 + ((S.prestige || 0) * 0.5);
            S.stats.renown += gained;
            integrator.onRenownGained(S, gained, log);
            log('El mercader asiente y habla bien de ti. (+Renombre)', 'good');
            AudioSystem.playTone('metal');
            vibrate(50);
            refreshAll(); saveState();
        };
        div.appendChild(btnTrade);
        actionsEl.appendChild(div);
    }

    // 8. Boss
    if (S.threat) {
        const remain = S.threat.endsAt - now();
        const bb = document.createElement('button'); bb.className = 'action';
        bb.textContent = remain > 0 ? `Enfrentar: ${S.threat.name} (HP ${S.threat.hp})` : 'Amenaza desvanecida';
        bb.disabled = remain <= 0;
        bb.onclick = () => { openCombat(); };
        actionsEl.appendChild(bb);
    }

    // 9. Advanced Explore
    if (ACTION_LOCKS.exploreAdvanced()) {
        const bAdv = document.createElement('button'); bAdv.className = 'action'; bAdv.textContent = 'Explorar rutas andaluzas';
        bAdv.disabled = !can('explore_adv');
        bAdv.onclick = () => {
            const region = getRandomRegion();
            const roll = Math.random();
            if (roll < 0.5) { addRes('piedra', 2); log(`Hallaste materiales en ${region.name}.`, ''); }
            else if (roll < 0.75) { addRes('hierro', 2); log(`Buenas vetas en ${region.name}.`, ''); }
            else { S.stats.renown += 2; integrator.onRenownGained(S, 2, log); log(`Fama en ${region.name}.`, 'good'); }
            integrator.onActionPerformed(S, 'explore', log);
            setCooldown(bAdv, 'explore_adv', 12000);
            refreshAll(); updateTags(); saveState();
        };
        reg('explore_adv', bAdv, 12000);
        actionsEl.appendChild(bAdv);
    }

    // 10. Recruit & Villagers
    if (ACTION_LOCKS.recruit()) {
        const bVill = document.createElement('button'); bVill.className = 'action';
        bVill.textContent = 'Reclutar aldeano (-2 comida)';
        bVill.disabled = (S.resources.trigo + S.resources.aceitunas < 2);
        bVill.onclick = () => {
            let left = 2;
            if (S.resources.trigo >= 1) { S.resources.trigo--; left--; }
            if (left > 0 && S.resources.aceitunas >= left) { S.resources.aceitunas -= left; left = 0; }
            if (left > 0 && S.resources.trigo >= left) { S.resources.trigo -= left; left = 0; }
            if (left > 0) return;
            S.people.villagers = (S.people.villagers || 0) + 1;
            log('Un nuevo aldeano se une a tu poblado.', 'good');
            integrator.onVillagerRecruited(S, log);
            refreshAll(); saveState();
        };
        actionsEl.appendChild(bVill);

        if (S.people.villagers > 0) {
            const jobPanel = document.createElement('div');
            jobPanel.className = 'res';
            jobPanel.style.marginTop = '10px';
            const assigned = (S.people.jobs.lumber || 0) + (S.people.jobs.farmer || 0) + (S.people.jobs.miner || 0);
            const free = S.people.villagers - assigned;
            jobPanel.innerHTML = `<div style="margin-bottom:8px"><b>👥 Gestión de Aldea</b> (Libres: ${free})</div>`;

            const jobs = [
                { key: 'lumber', label: 'Leñadores', icon: '🪵' },
                { key: 'farmer', label: 'Granjeros', icon: '🌾' },
                { key: 'miner', label: 'Mineros', icon: '⛏️' }
            ];

            jobs.forEach(j => {
                if (j.key === 'miner' && !S.discoveries?.piedra) return;
                const row = document.createElement('div');
                row.className = 'inline'; row.style.justifyContent = 'space-between';
                row.innerHTML = `<span>${j.icon} ${j.label}: ${S.people.jobs[j.key] || 0}</span>`;

                const ctrls = document.createElement('div');
                const btnSub = document.createElement('button'); btnSub.textContent = '-'; btnSub.className = 'action';
                btnSub.style.width = '30px'; btnSub.disabled = !S.people.jobs[j.key];
                btnSub.onclick = () => { S.people.jobs[j.key]--; refreshAll(); saveState(); };

                const btnAdd = document.createElement('button'); btnAdd.textContent = '+'; btnAdd.className = 'action';
                btnAdd.style.width = '30px'; btnAdd.disabled = free <= 0;
                btnAdd.onclick = () => { S.people.jobs[j.key]++ || (S.people.jobs[j.key] = 1); refreshAll(); saveState(); };

                ctrls.appendChild(btnSub); ctrls.appendChild(btnAdd);
                row.appendChild(ctrls);
                jobPanel.appendChild(row);
            });
            actionsEl.appendChild(jobPanel);
        }
    }
}

// Achievement Listener (Legacy removal)
// window.addEventListener('lys-unlock-achievement', (e) => { ... });
