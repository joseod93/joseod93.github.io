
import { $, fmtMs, now } from './utils.js';
import { S, saveState } from './state.js';
import { RES_META, BOSSES } from './constants.js';
import { ACHIEVEMENTS } from './achievements.js';
import integrator from './integrator.js';

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
const hpMobile = $('#hpMobile');
const fireMobile = $('#fireMobile');
const peopleMobile = $('#peopleMobile');
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

    // Update mobile bar if visible
    if (hpMobile) hpMobile.textContent = `❤️ ${S.player.hp}/${S.player.maxHp}`;
    if (fireMobile) fireMobile.textContent = `🔥 ${Math.floor(S.fire.heat)}°`;
    if (peopleMobile) peopleMobile.textContent = `👥 ${S.people.villagers || 0}`;

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

    // Convert OBJECT to ARRAY for easier rendering
    const allAchs = Object.values(ACHIEVEMENTS);

    allAchs.forEach(a => {
        const d = document.createElement('div');
        const has = !!S.achievements[a.id];
        d.className = 'ach' + (has ? ' unlocked' : ' locked');
        d.title = `${a.name}: ${a.description}`;
        d.textContent = a.icon;

        // Add click listener to show description as toast on mobile
        d.onclick = () => {
            toast(`${a.name}: ${a.description}`);
        };

        achEl.appendChild(d);
    });
}

// Tip footer helper
export function setTip(text) {
    tipFooter.textContent = text;
}

export function renderQuests() {
    const questsContainer = $('#quests');
    if (!questsContainer) return;

    const activeQuests = integrator.getActiveQuests();

    if (activeQuests.length === 0) {
        questsContainer.innerHTML = '<p style="color: #888; text-align: center; padding: 10px;">No hay misiones activas por ahora. ¡Explora más!</p>';
        return;
    }

    questsContainer.innerHTML = activeQuests.map(q => `
        <div class="quest ${q.completed ? 'completed' : ''}" style="margin-bottom: 12px; padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-weight: bold; color: #e9f0ff;">${q.icon} ${q.name}</span>
                <span style="font-variant-numeric: tabular-nums; color: #94a3b8;">${q.progress} / ${q.target.amount}</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(0,0,0,0.3); border-radius: 3px; overflow: hidden;">
                <div style="width: ${Math.min(100, (q.progress / q.target.amount) * 100)}%; height: 100%; background: linear-gradient(90deg, #f59e0b, #fbbf24); transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);"></div>
            </div>
            ${q.completed ? '<button class="action claim-btn" data-id="' + q.id + '" style="margin-top: 8px; padding: 4px 0; font-size: 0.8rem;">Reclamar Recompensa</button>' : ''}
        </div>
    `).join('');

    // Bind claim buttons
    questsContainer.querySelectorAll('.claim-btn').forEach(btn => {
        btn.onclick = () => {
            const id = btn.dataset.id;
            integrator.claimQuestReward(S, id, log);
            renderQuests();
            renderResources();
            saveState();
        };
    });
}

export function showStatistics() {
    const stats = integrator.getStatistics();

    const formatStatValue = (key, value) => {
        if (Array.isArray(value)) {
            if (value.length === 0) return 'Ninguno';
            // Specific handling for totalResources which is [{resource, amount}, ...]
            if (key === 'totalResources') {
                return value.map(i => `${i.resource}: ${i.amount}`).join(', ');
            }
            return value.join(', ');
        }
        if (typeof value === 'object' && value !== null) {
            if (Object.keys(value).length === 0) return 'Ninguno';
            return Object.entries(value)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');
        }
        return value;
    };

    const modal = document.createElement('div');
    modal.className = 'overlay';
    modal.style.zIndex = '10000';

    modal.innerHTML = `
        <div class="panel" style="max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <h2 style="color: #f59e0b; margin-bottom: 20px;">📊 Estadísticas de tu Reino</h2>
            <div style="display: grid; grid-template-columns: 1fr; gap: 12px; text-align: left;">
                ${Object.entries(stats).map(([key, value]) => `
                    <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">${key.replace(/([A-Z])/g, ' $1').trim()}</div>
                        <div style="font-size: 1rem; color: #e7edf7; margin-top: 4px; line-height: 1.4; word-break: break-word;">${formatStatValue(key, value)}</div>
                    </div>
                `).join('')}
            </div>
            <button id="closeStatsBtn" class="action" style="margin-top: 24px; width: 100%;">Cerrar</button>
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('#closeStatsBtn').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    // Trigger show animation
    requestAnimationFrame(() => modal.classList.remove('hidden'));
}
