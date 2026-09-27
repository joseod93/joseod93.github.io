// Crónica de la aldea: línea de tiempo de hitos de la partida (se conserva al ascender).
// Solo depende de state.js, así que cualquier módulo puede importarla sin ciclos.
// Luz y Sombra: El Alba de Hispania

import { S } from './state.js';

const MAX = 150;

// onceKey: el hito solo se apunta una vez en toda la partida (p. ej. 'fire', 'boss_toro')
export function addChronicle(icon, text, onceKey) {
    if (!Array.isArray(S.chronicle)) S.chronicle = [];
    if (!S.chronicleKeys || typeof S.chronicleKeys !== 'object') S.chronicleKeys = {};
    if (onceKey) {
        if (S.chronicleKeys[onceKey]) return;
        S.chronicleKeys[onceKey] = 1;
    }
    S.chronicle.push({ t: Date.now(), day: S.time?.day || 1, p: S.prestige || 0, icon, text });
    if (S.chronicle.length > MAX) S.chronicle.splice(0, S.chronicle.length - MAX);
    window.dispatchEvent(new CustomEvent('lys-chronicle'));
}

const fmtDate = (t) => {
    try { return new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }); }
    catch (e) { return ''; }
};

export function renderChronicle(el, countEl) {
    if (!el) return;
    const list = Array.isArray(S.chronicle) ? S.chronicle : [];
    const key = `${list.length}|${list[list.length - 1]?.t || 0}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    if (countEl) countEl.textContent = list.length ? `${list.length} hitos` : '';
    if (!list.length) {
        el.innerHTML = '<p class="empty-hint">Aquí quedarán escritos los grandes momentos de tu aldea: la primera fogata, cada nivel, tus edificios y tus victorias.</p>';
        return;
    }
    // Más reciente arriba; separador cuando cambia el prestigio (cada ascenso es una "era")
    let html = '<ol class="chron-list">';
    let era = null;
    for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        if (e.p !== era) {
            era = e.p;
            html += `<li class="chron-era">${era ? `Era del Prestigio ${era}` : 'Los orígenes'}</li>`;
        }
        html += `<li class="chron-item"><span class="chron-icon" aria-hidden="true">${e.icon}</span>
            <div class="chron-body"><div class="chron-text"></div><div class="chron-when">Día ${e.day} · ${fmtDate(e.t)}</div></div></li>`;
    }
    html += '</ol>';
    el.innerHTML = html;
    // Texto con textContent (puede incluir nombres de la partida)
    const texts = el.querySelectorAll('.chron-text');
    let j = 0;
    for (let i = list.length - 1; i >= 0; i--) texts[j++].textContent = list[i].text;
}
