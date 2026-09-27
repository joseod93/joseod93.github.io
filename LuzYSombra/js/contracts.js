// Encargos del mercader: contratos de entrega a plazo (tarjeta en la Aldea)
// Luz y Sombra: El Alba de Hispania

import { $, now, fmtMs, vibrate, formatNumber } from './utils.js';
import { S, saveState } from './state.js';
import { CONTRACTS, TRADE_GOODS, RES_META } from './constants.js';
import { log, toast, addXP, xpFlash, renderResources, screenFlash } from './ui.js';
import { AudioSystem } from './audio.js';
import integrator from './integrator.js';
import { addChronicle } from './chronicle.js';

const card = $('#contractsCard');
const body = $('#contractsBody');

export function contractsUnlocked() {
    return !!S.unlocked.village;
}

function rand(a, b) { return a + Math.random() * (b - a); }

// Ofertas del día: solo recursos ya descubiertos; cantidad según nivel y precio base
function generateOffers() {
    const pool = TRADE_GOODS.filter(g => S.discoveries?.[g.key]);
    const list = [];
    for (let i = 0; i < CONTRACTS.offers && pool.length; i++) {
        const g = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        const base = (4 + S.player.level * 1.5) * (6 / g.basePrice);
        const n = Math.max(2, Math.round(base * rand(0.8, 1.3)));
        const bonus = CONTRACTS.bonus[Math.floor(Math.random() * CONTRACTS.bonus.length)];
        list.push({
            id: `${S.time.day}-${i}-${g.key}`,
            res: g.key, n,
            renown: Math.max(1, Math.floor(n * g.basePrice * CONTRACTS.renownRate)),
            xp: 6 + Math.round(n * 1.5),
            bonus: { k: bonus.k, n: bonus.n },
            minutes: Math.round(rand(CONTRACTS.minutes[0], CONTRACTS.minutes[1]) / 5) * 5,
        });
    }
    return list;
}

function bonusMeta(b) { return CONTRACTS.bonus.find(x => x.k === b.k) || { icon: '🎁', label: b.k }; }

// Llamar en cada tick: renueva ofertas al cambiar de día y caduca el encargo vencido
export function updateContracts() {
    if (!contractsUnlocked()) return;
    const c = S.contracts;
    if (c.active && now() >= c.active.endsAt) {
        const m = RES_META[c.active.res];
        log(`📜 El encargo de ${c.active.n} ${m?.label || c.active.res} ha caducado. El mercader busca a otro.`, 'warn');
        c.active = null;
        saveState();
    }
    if (c.day !== S.time.day) {
        c.day = S.time.day;
        c.offers = generateOffers();
    }
}

function accept(id) {
    const c = S.contracts;
    if (c.active) return;
    const o = c.offers.find(x => x.id === id);
    if (!o) return;
    c.active = { ...o, endsAt: now() + o.minutes * 60 * 1000 };
    c.offers = c.offers.filter(x => x.id !== id);
    const m = RES_META[o.res];
    log(`📜 Encargo aceptado: entregar ${o.n} ${m?.icon || ''} ${m?.label || o.res} en ${o.minutes} min.`, '');
    toast(`📜 Encargo: ${o.n} ${m?.icon || o.res}`);
    AudioSystem.playTone('click');
    vibrate(20);
    saveState();
    renderContracts(true);
}

function deliver() {
    const a = S.contracts.active;
    if (!a || (S.resources[a.res] || 0) < a.n || now() >= a.endsAt) return;
    S.resources[a.res] -= a.n;
    S.stats.renown += a.renown;
    integrator.onRenownGained(S, a.renown, log);
    if (bonusMeta(a.bonus).consumable) S.consumables[a.bonus.k] = (S.consumables[a.bonus.k] || 0) + a.bonus.n;
    else S.resources[a.bonus.k] = (S.resources[a.bonus.k] || 0) + a.bonus.n;
    addXP(a.xp);
    xpFlash();
    S.contracts.done = (S.contracts.done || 0) + 1;
    if ([1, 10, 25].includes(S.contracts.done)) addChronicle('📜', S.contracts.done === 1 ? 'Cumpliste tu primer encargo del mercader.' : `Ya has cumplido ${S.contracts.done} encargos del mercader.`, `contract${S.contracts.done}`);
    S.contracts.active = null;
    const b = bonusMeta(a.bonus);
    log(`📜 Encargo cumplido: +${a.renown} renombre, +${a.xp} XP y ${a.bonus.n} ${b.icon} ${b.label}.`, 'good');
    toast(`🤝 ¡Encargo cumplido! +${a.renown} ⭐`);
    AudioSystem.playTone('metal');
    screenFlash('gold');
    vibrate([30, 30, 60]);
    saveState();
    renderResources();
    renderContracts(true);
}

function rewardText(o) {
    const b = bonusMeta(o.bonus);
    return `+${o.renown} ⭐ · +${o.xp} XP · ${o.bonus.n} ${b.icon}`;
}

export function renderContracts(force = false) {
    if (!card || !body) return;
    const on = contractsUnlocked();
    const disp = on ? '' : 'none';
    if (card.style.display !== disp) card.style.display = disp;
    if (!on) return;

    const c = S.contracts;
    const a = c.active;
    const have = a ? Math.floor(S.resources[a.res] || 0) : 0;
    const remain = a ? a.endsAt - now() : 0;
    // Dirty-check: estructura + progreso + minuto restante (no reconstruir cada segundo)
    const key = [a ? a.id : '-', have, a ? Math.ceil(remain / 60000) : 0, c.offers.map(o => `${o.id}:${Math.floor(S.resources[o.res] || 0)}`).join(','), c.done].join('|');
    if (!force && body.dataset.key === key) return;
    body.dataset.key = key;

    const count = $('#contractsCount');
    if (count) count.textContent = c.done ? `${c.done} cumplidos` : '';

    if (a) {
        const m = RES_META[a.res] || { icon: '📦', label: a.res };
        const pct = Math.min(100, (have / a.n) * 100);
        const ready = have >= a.n;
        body.innerHTML = `
            <div class="contract active${ready ? ' ready' : ''}">
                <div class="contract-top">
                    <span class="contract-name">${m.icon} Entregar ${a.n} ${m.label}</span>
                    <span class="contract-time" title="Tiempo restante">⏳ ${fmtMs(Math.max(0, remain))}</span>
                </div>
                <div class="contract-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${a.n}" aria-valuenow="${Math.min(have, a.n)}"><div style="width:${pct}%"></div></div>
                <div class="contract-meta"><span>${formatNumber(Math.min(have, a.n))}/${a.n}</span><span>${rewardText(a)}</span></div>
                <button class="action${ready ? ' glow-btn' : ''} contract-deliver" ${ready ? '' : 'disabled'}>${ready ? '🤝 Entregar' : `Te faltan ${a.n - have} ${m.icon}`}</button>
            </div>`;
        const btn = body.querySelector('.contract-deliver');
        if (btn) btn.onclick = deliver;
        return;
    }

    if (!c.offers.length) {
        body.innerHTML = '<p class="empty-hint">El mercader no tiene encargos hoy. Vuelve mañana (día de juego).</p>';
        return;
    }
    body.innerHTML = `<p class="contract-intro">Acepta un encargo y entrégalo antes de que acabe el plazo.</p>` + c.offers.map(o => {
        const m = RES_META[o.res] || { icon: '📦', label: o.res };
        return `
            <div class="contract">
                <div class="contract-top">
                    <span class="contract-name">${m.icon} ${o.n} ${m.label}</span>
                    <span class="contract-time">⏳ ${o.minutes} min</span>
                </div>
                <div class="contract-meta"><span>Tienes ${formatNumber(Math.floor(S.resources[o.res] || 0))}</span><span>${rewardText(o)}</span></div>
                <button class="action contract-accept" data-id="${o.id}">📜 Aceptar</button>
            </div>`;
    }).join('');
    body.querySelectorAll('.contract-accept').forEach(b => b.onclick = () => accept(b.dataset.id));
}
