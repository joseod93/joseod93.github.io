
import { $, fmtMs, now } from './utils.js';
import { S } from './state.js';
import { RES_META, BOSSES, EXTRA_ACHIEVEMENTS } from './constants.js';

const resEl = $('#resources');
const logEl = $('#log');
const fireTag = $('#fireTag');
const expeditionTag = $('#expeditionTag');
const bossTag = $('#bossTag');
const hpTag = $('#hpTag');
const timeOfDay = $('#timeOfDay');
const saveInfo = $('#saveInfo');
const toastEl = $('#toast');
const tipFooter = $('#tipFooter');
const achEl = $('#achievements');
const notesBody = $('#notesBody');
const villagersTag = document.createElement('span');
villagersTag.className = 'tag';

// Setup Villager Tag
if (expeditionTag && expeditionTag.parentElement) {
    expeditionTag.parentElement.appendChild(villagersTag);
}

export const BUTTON_REFS = {};

export function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2400);
}

export function log(text, cls) {
    const p = document.createElement('p');
    if (cls) p.className = cls;
    p.textContent = text;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
}

export function updateSaveInfo(msg) {
    saveInfo.textContent = msg;
}

export function setCooldown(btn, key, totalMs, baseText) {
    // S.cooldowns is mutated here (new cooldown start)
    S.cooldowns[key] = now() + totalMs;
    BUTTON_REFS[key] = { btn, total: totalMs, baseText: baseText || btn.textContent };
}

export function registerCooldownBtn(btn, key, totalMs, baseText) {
    // Just register visual ref, do not mutate S.cooldowns
    BUTTON_REFS[key] = { btn, total: totalMs, baseText: baseText || btn.textContent };
}

export function updateCooldownVisuals() {
    const entries = Object.entries(BUTTON_REFS);
    entries.forEach(([key, ref]) => {
        let t = now();
        const remain = Math.max(0, (S.cooldowns[key] || 0) - t);
        const ratio = Math.min(1, remain / ref.total);
        if (ref.btn) {
            ref.btn.classList.add('cooldown');
            ref.btn.style.setProperty('--cd', String(ratio));
            const shouldDisable = remain > 0;
            if (ref.btn.disabled !== shouldDisable) {
                ref.btn.disabled = shouldDisable;
            }
            if (remain > 0) {
                const secs = Math.ceil(remain / 1000);
                const txt = ref.baseText || ref.btn.textContent.replace(/ \(.*\)$/, '');
                ref.btn.textContent = `${txt} (${secs}s)`;
            } else {
                if (ref.baseText) ref.btn.textContent = ref.baseText;
                ref.btn.classList.remove('cooldown');
                ref.btn.style.removeProperty('--cd');
            }
        }
        if (remain <= 0) { delete BUTTON_REFS[key]; }
    });
}

function timeLabel() {
    const m = S.time.minutes % (24 * 60);
    const h = Math.floor(m / 60);
    if (h >= 6 && h < 12) return '🌤️ Mañana';
    if (h >= 12 && h < 19) return '🌞 Tarde';
    if (h >= 19 && h < 23) return '🌆 Atardecer';
    return '🌙 Noche';
}

export function updateTags() {
    fireTag.textContent = S.fire.lit ? `🔥 Lumbre encendida (${Math.floor(S.fire.heat)}°)` : '🔥 Lumbre apagada';

    const weatherIcons = { clear: '☀️ Despejado', rain: '🌧️ Lluvia', wind: '💨 Viento' };
    const wLabel = weatherIcons[S.weather] || '☀️ Despejado';

    expeditionTag.textContent = S.expedition ? '🧭 Expedición en curso' : '🧭 Sin expedición';
    bossTag.textContent = S.threat ? `👁️ ${S.threat.name}` : '👁️ Sin amenaza';
    timeOfDay.textContent = `${timeLabel()} | ${wLabel}`;

    if (hpTag) hpTag.textContent = `❤️ ${S.player.hp}/${S.player.maxHp}`;

    if (!villagersTag.parentElement && expeditionTag.parentElement) {
        expeditionTag.parentElement.appendChild(villagersTag);
    }
    villagersTag.textContent = `👥 ${S.people.villagers || 0}`;
    renderNotes();
}

export function renderResources() {
    resEl.innerHTML = '';
    for (const [k, v] of Object.entries(S.resources)) {
        if (v <= 0) continue;
        const meta = RES_META[k]; if (!meta) continue;
        const d = document.createElement('div'); d.className = 'res';
        d.innerHTML = `<b>${meta.icon} ${meta.label}: ${v}</b>`;
        resEl.appendChild(d);
    }
}

export function renderNotes() {
    if (!notesBody) return;
    const heat = Math.floor(S.fire.heat);
    const villagers = S.people.villagers || 0;
    const lines = [];
    lines.push(`👥 Aldeanos: aportan producción pasiva de trigo (más con calor). Actual: ${villagers}.`);
    lines.push(`🔥 Fogata: calor ${heat}°. Con calor alto aumenta el ritmo de acequia/molino y la productividad.`);
    lines.push(`🏚️ Molino: transforma trigo de forma pasiva y da renombre.`);
    lines.push(`💧 Acequia: genera agua pasiva con probabilidad por tick.`);
    lines.push(`⚒️ Fragua: pequeñas vetas de hierro pasivas y +1 daño al atacar.`);
    lines.push(`🔥 Antorchas: +1 daño en ataque y se consumen al usar.`);
    notesBody.innerHTML = '<ul style="margin:0;padding-left:18px">' + lines.map(t => `<li>${t}</li>`).join('') + '</ul>';
}

export function renderAchievements() {
    if (!achEl) return;
    achEl.innerHTML = '';
    // Bosses
    BOSSES.forEach(b => {
        const d = document.createElement('div');
        const has = !!S.achievements[b.key];
        d.className = 'ach' + (has ? '' : ' locked');
        d.title = b.name;
        d.textContent = b.icon;
        achEl.appendChild(d);
    });
    // Extra
    EXTRA_ACHIEVEMENTS.forEach(a => {
        const d = document.createElement('div');
        const has = !!S.achievements[a.key];
        d.className = 'ach' + (has ? '' : ' locked');
        d.title = a.name;
        d.textContent = a.icon;
        achEl.appendChild(d);
    });
}

// Tip footer helper
export function setTip(text) {
    tipFooter.textContent = text;
}
