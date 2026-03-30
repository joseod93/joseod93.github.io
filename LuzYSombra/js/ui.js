
import { $, fmtMs, now } from './utils.js';
import { S, saveState, xpForLevel } from './state.js';
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
const xpBar = $('#xpBar');
const xpLabel = $('#xpLabel');
const levelNum = $('#levelNum');
const levelBadge = $('#levelBadge');
const streakPill = $('#streakPill');
const logBadge = $('#logBadge');
const confettiCanvas = $('#confettiCanvas');

let logCount = 0;
let activeTab = 'tabAldea';

export const BUTTON_REFS = {};

// ===== TAB NAVIGATION =====
export function initTabs() {
    const tabBar = $('#tabBar');
    if (!tabBar) return;

    tabBar.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (!tab) return;
        switchTab(tab.dataset.tab);
    });
}

export function switchTab(tabId) {
    activeTab = tabId;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));

    const content = document.getElementById(tabId);
    if (content) content.classList.add('active');

    const btn = document.querySelector(`.tab[data-tab="${tabId}"]`);
    if (btn) btn.classList.add('active');

    if (tabId === 'tabDiario' && logBadge) {
        logBadge.classList.add('hidden');
    }
}

// ===== TOAST =====
let toastTimer = null;
export function toast(text) {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.textContent = text;
    toastEl.classList.add('show');
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

// ===== LOG =====
export function log(text, cls) {
    const p = document.createElement('p');
    if (cls) p.className = cls;
    p.textContent = text;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;

    if (activeTab !== 'tabDiario' && logBadge) {
        logBadge.classList.remove('hidden');
    }
}

// ===== SAVE INFO =====
export function updateSaveInfo(msg) {
    if (saveInfo) saveInfo.textContent = msg;
}

// ===== COOLDOWNS =====
export function setCooldown(btn, key, totalMs, baseText) {
    S.cooldowns[key] = now() + totalMs;
    BUTTON_REFS[key] = { btn, total: totalMs, baseText: baseText || btn.textContent };
}

export function registerCooldownBtn(btn, key, totalMs, baseText) {
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

// ===== XP / LEVEL SYSTEM =====
export function addXP(amount) {
    S.player.xp += amount;
    const needed = xpForLevel(S.player.level);

    while (S.player.xp >= needed) {
        S.player.xp -= xpForLevel(S.player.level);
        S.player.level++;
        onLevelUp(S.player.level);
    }

    updateXPBar();
}

function updateXPBar() {
    const needed = xpForLevel(S.player.level);
    const pct = Math.min(100, (S.player.xp / needed) * 100);
    if (xpBar) xpBar.style.width = pct + '%';
    if (xpLabel) xpLabel.textContent = `${S.player.xp} / ${needed} XP`;
    if (levelNum) levelNum.textContent = S.player.level;
}

function onLevelUp(level) {
    log(`¡Has alcanzado el nivel ${level}! Tu aldea prospera.`, 'good');
    toast(`🎉 ¡Nivel ${level}!`);
    screenFlash('gold');
    fireConfetti();

    if (levelBadge) {
        levelBadge.classList.remove('level-up');
        void levelBadge.offsetWidth;
        levelBadge.classList.add('level-up');
    }

    const overlay = $('#levelUpOverlay');
    const text = $('#levelUpText');
    const bonus = $('#levelUpBonus');
    const closeBtn = $('#levelUpCloseBtn');

    if (overlay && text) {
        text.textContent = `¡Nivel ${level}!`;
        const bonuses = [];
        if (level % 3 === 0) bonuses.push('+10 HP máximos');
        if (level % 5 === 0) bonuses.push('+1 Renombre');
        bonuses.push(`+${Math.floor(level * 0.5)} a producción pasiva`);

        if (bonus) {
            bonus.innerHTML = bonuses.map(b => `<div>${b}</div>`).join('');
        }

        if (level % 3 === 0) S.player.maxHp += 10;
        if (level % 5 === 0) S.stats.renown += 1;

        overlay.classList.remove('hidden');
        if (closeBtn) {
            closeBtn.onclick = () => overlay.classList.add('hidden');
        }
    }

    if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
    saveState();
}

export function xpFlash() {
    const wrap = document.querySelector('.xp-bar-wrap');
    if (wrap) {
        wrap.classList.remove('flash');
        void wrap.offsetWidth;
        wrap.classList.add('flash');
    }
}

// ===== SCREEN FLASH =====
export function screenFlash(color = 'gold') {
    const el = document.createElement('div');
    el.className = `screen-flash ${color}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 500);
}

// ===== CONFETTI =====
export function fireConfetti() {
    if (!confettiCanvas) return;
    const ctx = confettiCanvas.getContext('2d');
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#f2a65a', '#ffe08a', '#9ad06e', '#ff6b6b', '#4dabf7', '#fff'];

    for (let i = 0; i < 60; i++) {
        particles.push({
            x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
            y: window.innerHeight / 2,
            vx: (Math.random() - 0.5) * 12,
            vy: -Math.random() * 14 - 4,
            size: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 10,
            life: 1
        });
    }

    let frame;
    function draw() {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        let alive = false;

        particles.forEach(p => {
            if (p.life <= 0) return;
            alive = true;
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.3;
            p.rotation += p.rotSpeed;
            p.life -= 0.012;
            p.vx *= 0.99;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            ctx.restore();
        });

        if (alive) frame = requestAnimationFrame(draw);
        else ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }

    draw();
}

// ===== STREAK =====
export function updateStreakDisplay() {
    if (streakPill) {
        const streak = S.streak?.current || 0;
        streakPill.textContent = `🔥 Racha: ${streak}`;
        if (streak >= 3) streakPill.classList.add('hot');
        else streakPill.classList.remove('hot');
    }
}

// ===== TIME LABEL =====
function timeLabel() {
    const m = S.time.minutes % (24 * 60);
    const h = Math.floor(m / 60);
    if (h >= 6 && h < 12) return '🌤️ Mañana';
    if (h >= 12 && h < 19) return '🌞 Tarde';
    if (h >= 19 && h < 23) return '🌆 Atardecer';
    return '🌙 Noche';
}

// ===== UPDATE TAGS =====
export function updateTags() {
    if (fireTag) {
        fireTag.textContent = S.fire.lit ? `🔥 ${Math.floor(S.fire.heat)}°` : '🔥 Apagada';
        if (S.fire.lit && S.fire.heat > 10) fireTag.classList.add('hot');
        else fireTag.classList.remove('hot');
    }

    const weatherIcons = { clear: '☀️', rain: '🌧️', wind: '💨' };
    const wIcon = weatherIcons[S.weather] || '☀️';

    if (expeditionTag) expeditionTag.textContent = S.expedition ? '🧭 En curso' : '🧭 Sin expedición';
    if (bossTag) bossTag.textContent = S.threat ? `👁️ ${S.threat.name}` : '👁️ Sin amenaza';
    if (timeOfDay) timeOfDay.textContent = `${timeLabel()} ${wIcon}`;
    if (hpTag) hpTag.textContent = `❤️ ${S.player.hp}/${S.player.maxHp}`;

    if (hpMobile) hpMobile.textContent = `❤️ ${S.player.hp}`;
    if (fireMobile) fireMobile.textContent = `🔥 ${Math.floor(S.fire.heat)}°`;
    if (peopleMobile) peopleMobile.textContent = `👥 ${S.people.villagers || 0}`;

    updateXPBar();
    updateStreakDisplay();
}

// ===== RENDER RESOURCES =====
export function renderResources() {
    if (!resEl) return;
    const prev = {};
    resEl.querySelectorAll('.res').forEach(el => {
        const key = el.dataset.key;
        if (key) prev[key] = el.querySelector('b')?.textContent;
    });

    resEl.innerHTML = '';
    for (const [k, v] of Object.entries(S.resources)) {
        if (v <= 0) continue;
        const meta = RES_META[k]; if (!meta) continue;
        const d = document.createElement('div');
        d.className = 'res';
        d.dataset.key = k;

        const rounded = Math.floor(v);
        d.innerHTML = `<b>${meta.icon} ${rounded}</b><small>${meta.label}</small>`;

        const prevText = prev[k];
        if (prevText && prevText !== `${meta.icon} ${rounded}`) {
            d.classList.add('gained');
            setTimeout(() => d.classList.remove('gained'), 800);
        }

        resEl.appendChild(d);
    }
}

// ===== RENDER NOTES =====
export function renderNotes() {
    if (!notesBody) return;
    const heat = Math.floor(S.fire.heat);
    const villagers = S.people.villagers || 0;
    const lines = [];
    lines.push(`👥 Aldeanos: ${villagers} — producción pasiva de recursos.`);
    lines.push(`🔥 Fogata: ${heat}° — mejora producción con calor alto.`);
    if (S.unlocked.molino) lines.push(`🏚️ Molino: transforma trigo y da renombre.`);
    if (S.unlocked.acequia) lines.push(`💧 Acequia: genera agua pasiva.`);
    if (S.unlocked.forge) lines.push(`⚒️ Fragua: hierro pasivo y +1 daño.`);
    lines.push(`📊 Nivel: ${S.player.level} | Renombre: ${Math.floor(S.stats.renown)}`);
    notesBody.innerHTML = '<ul style="margin:0;padding-left:18px;list-style:none">' + lines.map(t => `<li style="padding:4px 0;border-bottom:1px solid #1b263633">${t}</li>`).join('') + '</ul>';
}

// ===== RENDER ACHIEVEMENTS =====
export function renderAchievements() {
    if (!achEl) return;
    achEl.innerHTML = '';

    const allAchs = Object.values(ACHIEVEMENTS);
    allAchs.forEach(a => {
        const d = document.createElement('div');
        const has = !!S.achievements[a.id];
        d.className = 'ach' + (has ? ' unlocked' : ' locked');
        d.title = `${a.name}: ${a.description}`;
        d.textContent = a.icon;
        d.onclick = () => toast(`${a.name}: ${a.description}`);
        achEl.appendChild(d);
    });
}

// ===== TIP =====
export function setTip(text) {
    if (tipFooter) tipFooter.textContent = text;
}

// ===== QUESTS =====
export function renderQuests() {
    const questsContainer = $('#quests');
    if (!questsContainer) return;

    const activeQuests = integrator.getActiveQuests();

    if (activeQuests.length === 0) {
        questsContainer.innerHTML = '<p style="color:#666;text-align:center;padding:16px;font-size:0.85rem">No hay misiones activas. ¡Explora más!</p>';
        return;
    }

    questsContainer.innerHTML = activeQuests.map(q => `
        <div style="margin-bottom:10px;padding:12px;background:#0c132088;border:1px solid #1b263688;border-radius:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <span style="font-weight:700;color:#e9f0ff;font-size:0.88rem">${q.icon} ${q.name}</span>
                <span style="font-variant-numeric:tabular-nums;color:#94a3b8;font-size:0.8rem">${q.progress}/${q.target.amount}</span>
            </div>
            <div style="width:100%;height:5px;background:#0d1422;border-radius:99px;overflow:hidden">
                <div style="width:${Math.min(100, (q.progress / q.target.amount) * 100)}%;height:100%;background:linear-gradient(90deg,#f59e0b,#fbbf24);transition:width .4s;border-radius:99px"></div>
            </div>
            ${q.completed ? '<button class="action glow-btn claim-btn" data-id="' + q.id + '" style="margin-top:8px;padding:10px 0!important;font-size:0.85rem!important">🎁 Reclamar</button>' : ''}
        </div>
    `).join('');

    questsContainer.querySelectorAll('.claim-btn').forEach(btn => {
        btn.onclick = () => {
            const id = btn.dataset.id;
            integrator.claimQuestReward(S, id, log);
            addXP(15);
            xpFlash();
            renderQuests();
            renderResources();
            saveState();
        };
    });
}

// ===== STATISTICS MODAL =====
export function showStatistics() {
    const stats = integrator.getStatistics();

    const formatStatValue = (key, value) => {
        if (Array.isArray(value)) {
            if (value.length === 0) return 'Ninguno';
            if (key === 'totalResources') return value.map(i => `${i.resource}: ${i.amount}`).join(', ');
            return value.join(', ');
        }
        if (typeof value === 'object' && value !== null) {
            if (Object.keys(value).length === 0) return 'Ninguno';
            return Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(', ');
        }
        return value;
    };

    const modal = document.createElement('div');
    modal.className = 'overlay';
    modal.style.zIndex = '10000';

    modal.innerHTML = `
        <div class="panel" style="max-width:440px;width:90%;max-height:90vh;overflow-y:auto">
            <h2 style="color:#f59e0b;margin-bottom:16px">📊 Estadísticas</h2>
            <div style="display:grid;gap:8px">
                <div style="background:#0c132088;padding:10px;border-radius:10px;border:1px solid #1b263644">
                    <div style="font-size:0.7rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Nivel</div>
                    <div style="font-size:1.2rem;color:var(--accent);font-weight:800">${S.player.level}</div>
                </div>
                <div style="background:#0c132088;padding:10px;border-radius:10px;border:1px solid #1b263644">
                    <div style="font-size:0.7rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Racha de días</div>
                    <div style="font-size:1.2rem;color:var(--accent);font-weight:800">${S.streak?.current || 0} 🔥</div>
                </div>
                ${Object.entries(stats).map(([key, value]) => `
                    <div style="background:#0c132088;padding:10px;border-radius:10px;border:1px solid #1b263644">
                        <div style="font-size:0.7rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">${key.replace(/([A-Z])/g, ' $1').trim()}</div>
                        <div style="font-size:0.88rem;color:#e7edf7;margin-top:2px;word-break:break-word">${formatStatValue(key, value)}</div>
                    </div>
                `).join('')}
            </div>
            <button class="action" style="margin-top:16px;width:100%" id="closeStatsBtn">Cerrar</button>
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('#closeStatsBtn').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };
}
