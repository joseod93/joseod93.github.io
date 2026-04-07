
import { $, fmtMs, now } from './utils.js';
import { AudioSystem } from './audio.js';
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
const mapaBadge = $('#mapaBadge');
const aldeaBadge = $('#aldeaBadge');
const comboIndicator = $('#comboIndicator');
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
    document.querySelectorAll('.tab').forEach(el => {
        el.classList.remove('active');
        el.setAttribute('aria-selected', 'false');
    });

    const content = document.getElementById(tabId);
    if (content) content.classList.add('active');

    const btn = document.querySelector(`.tab[data-tab="${tabId}"]`);
    if (btn) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
    }

    if (tabId === 'tabDiario' && logBadge) logBadge.classList.add('hidden');
    if (tabId === 'tabMapa' && mapaBadge) mapaBadge.classList.add('hidden');
    if (tabId === 'tabAldea' && aldeaBadge) aldeaBadge.classList.add('hidden');
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
    AudioSystem.playTone('levelup');
    screenFlash('gold');
    fireConfetti();

    if (levelBadge) {
        levelBadge.classList.remove('level-up');
        void levelBadge.offsetWidth;
        levelBadge.classList.add('level-up');
    }

    // Skill points
    const skillPts = (level % 5 === 0) ? 2 : 1;
    S.skillPoints = (S.skillPoints || 0) + skillPts;

    const overlay = $('#levelUpOverlay');
    const text = $('#levelUpText');
    const bonus = $('#levelUpBonus');
    const closeBtn = $('#levelUpCloseBtn');

    if (overlay && text) {
        text.textContent = `¡Nivel ${level}!`;
        const bonuses = [];
        if (level % 3 === 0) bonuses.push('+10 HP máximos');
        if (level % 5 === 0) bonuses.push('+1 Renombre');
        bonuses.push(`+${skillPts} punto${skillPts > 1 ? 's' : ''} de habilidad`);
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

    // Dynamic fireplace (Mejora 4)
    const fireIndicator = $('#fireIndicator');
    const headerEl = document.querySelector('header');
    if (fireIndicator) {
        fireIndicator.classList.toggle('lit', S.fire.lit);
        fireIndicator.classList.toggle('hot', S.fire.heat > 20);
        fireIndicator.classList.toggle('warm', S.fire.heat > 10 && S.fire.heat <= 20);
    }
    if (headerEl) {
        headerEl.classList.remove('fire-glow-hot', 'fire-glow-warm');
        if (S.fire.heat > 20) headerEl.classList.add('fire-glow-hot');
        else if (S.fire.heat > 10) headerEl.classList.add('fire-glow-warm');
    }

    updateXPBar();
    updateStreakDisplay();
    updateTabBadges();
    updateTimeClass();
    // updateStarfield();
}

// ===== TAB BADGES =====
function updateTabBadges() {
    // Mapa badge: expedition ready to claim
    if (mapaBadge) {
        const expReady = S.expedition && (S.expedition.endsAt - now() <= 0);
        if (expReady && activeTab !== 'tabMapa') {
            mapaBadge.classList.remove('hidden');
            mapaBadge.textContent = '!';
        } else {
            mapaBadge.classList.add('hidden');
        }
    }

    // Aldea badge: boss or trader present
    if (aldeaBadge) {
        const hasBoss = !!S.threat;
        const hasTrader = !!S.trader;
        if ((hasBoss || hasTrader) && activeTab !== 'tabAldea') {
            aldeaBadge.classList.remove('hidden');
            aldeaBadge.textContent = hasBoss ? '⚔' : '🪵';
        } else {
            aldeaBadge.classList.add('hidden');
        }
    }
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
        if (prevText) {
            const prevNum = parseInt(prevText.replace(/[^\d]/g, '')) || 0;
            const b = d.querySelector('b');
            if (rounded > prevNum) {
                d.classList.add('gained');
                b.classList.add('count-up');
                setTimeout(() => { d.classList.remove('gained'); b.classList.remove('count-up'); }, 800);
            } else if (rounded < prevNum) {
                d.classList.add('lost');
                b.classList.add('count-down');
                setTimeout(() => { d.classList.remove('lost'); b.classList.remove('count-down'); }, 500);
            } else {
                // Idle breathe animation for unchanged resources
                d.classList.add('idle-breathe');
            }
        } else {
            d.classList.add('idle-breathe');
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

// ===== COMBO COUNTER =====
let comboCount = 0;
let comboTimer = null;
const COMBO_TIMEOUT = 8000;

export function incrementCombo() {
    comboCount++;
    if (comboTimer) clearTimeout(comboTimer);

    if (comboIndicator) {
        comboIndicator.textContent = `🔥 x${comboCount}`;
        comboIndicator.classList.remove('hidden');
        comboIndicator.style.animation = 'none';
        void comboIndicator.offsetWidth;
        comboIndicator.style.animation = '';
    }

    const bonusXP = Math.min(comboCount, 10);
    if (comboCount >= 2) {
        addXP(bonusXP);
    }

    comboTimer = setTimeout(() => {
        if (comboCount >= 3) {
            toast(`Combo x${comboCount} terminado (+${Math.floor(comboCount * (comboCount + 1) / 2)} XP bonus)`);
        }
        comboCount = 0;
        if (comboIndicator) comboIndicator.classList.add('hidden');
    }, COMBO_TIMEOUT);
}

export function getComboCount() { return comboCount; }

// ===== ACTION SCENE ANIMATIONS =====
// ===== WEATHER VISUALS (Mejora 1) =====
let currentWeatherType = null;
export function updateWeatherVisuals(weather) {
    const overlay = $('#weatherOverlay');
    if (!overlay || weather === currentWeatherType) return;
    currentWeatherType = weather;
    overlay.innerHTML = '';
    overlay.classList.remove('active');

    const isMobile = window.innerWidth < 600;

    if (weather === 'rain') {
        const count = isMobile ? 20 : 40;
        for (let i = 0; i < count; i++) {
            const drop = document.createElement('div');
            drop.className = 'rain-drop';
            drop.style.setProperty('--x', Math.random() * 100 + '%');
            drop.style.setProperty('--dur', (0.6 + Math.random() * 0.6) + 's');
            drop.style.setProperty('--delay', Math.random() * 2 + 's');
            overlay.appendChild(drop);
        }
        overlay.classList.add('active');
    } else if (weather === 'wind') {
        const count = isMobile ? 6 : 12;
        for (let i = 0; i < count; i++) {
            const streak = document.createElement('div');
            streak.className = 'wind-streak';
            streak.style.setProperty('--y', Math.random() * 100 + '%');
            streak.style.setProperty('--dur', (1.5 + Math.random() * 1.5) + 's');
            streak.style.setProperty('--delay', Math.random() * 3 + 's');
            overlay.appendChild(streak);
        }
        overlay.classList.add('active');
    } else {
        const ray = document.createElement('div');
        ray.className = 'sun-ray';
        overlay.appendChild(ray);
        overlay.classList.add('active');
    }
}

// ===== DAY/NIGHT CYCLE (Mejora 2) =====
function updateTimeClass() {
    const m = S.time.minutes % (24 * 60);
    const h = Math.floor(m / 60);
    const body = document.body;
    body.classList.remove('time-morning', 'time-afternoon', 'time-sunset', 'time-night');
    // Don't override region background
    if (body.className.match(/bg-/)) return;
    if (h >= 6 && h < 12) body.classList.add('time-morning');
    else if (h >= 12 && h < 19) body.classList.add('time-afternoon');
    else if (h >= 19 && h < 23) body.classList.add('time-sunset');
    else body.classList.add('time-night');
}

// ===== STARFIELD (Mejora 11) =====
let starsCreated = false;
function updateStarfield() {
    const m = S.time.minutes % (24 * 60);
    const h = Math.floor(m / 60);
    const isNight = h < 6 || h >= 23;
    if (isNight && !starsCreated) {
        const container = document.createElement('div');
        container.id = 'starfield';
        for (let i = 0; i < 30; i++) {
            const star = document.createElement('div');
            star.className = 'star-particle';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 60 + '%';
            star.style.setProperty('--dur', (2 + Math.random() * 4) + 's');
            star.style.setProperty('--delay', Math.random() * 3 + 's');
            container.appendChild(star);
        }
        document.body.appendChild(container);
        starsCreated = true;
    } else if (!isNight && starsCreated) {
        const sf = $('#starfield');
        if (sf) sf.remove();
        starsCreated = false;
    }
}

// ===== PASSIVE GAIN FLOATERS (Mejora 5) =====
export function showPassiveGain(resKey, amount) {
    const resItem = document.querySelector(`.res[data-key="${resKey}"]`);
    if (!resItem) return;
    const meta = RES_META[resKey];
    if (!meta) return;
    const el = document.createElement('div');
    el.className = 'passive-gain';
    el.textContent = `+${amount} ${meta.icon}`;
    resItem.appendChild(el);
    setTimeout(() => el.remove(), 1300);
}

// ===== EVENT BANNER (Mejora 8) =====
let bannerTimer = null;
export function showEventBanner(text, type = 'neutral') {
    const banner = $('#eventBanner');
    if (!banner) return;
    if (bannerTimer) clearTimeout(bannerTimer);
    banner.textContent = text;
    banner.className = `event-banner ${type}`;
    requestAnimationFrame(() => {
        banner.classList.add('show');
        bannerTimer = setTimeout(() => {
            banner.classList.remove('show');
            setTimeout(() => banner.classList.add('hidden'), 500);
        }, 2500);
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
