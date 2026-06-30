
import { $, fmtMs, now, formatNumber, prefersReducedMotion } from './utils.js';
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
const masBadge = $('#masBadge');

// Fecha local (idéntica a la usada por racha/ruleta en game/actions)
function getDateStr() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function spinAvailable() {
    return S.streak && S.streak.lastSpinDate !== getDateStr();
}
const comboIndicator = $('#comboIndicator');
const confettiCanvas = $('#confettiCanvas');
const bossBar = $('#bossBar');
const unlockBeacon = $('#unlockBeacon');

let logCount = 0;
let activeTab = 'tabAldea';

export function getActiveTab() { return activeTab; }

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
    if (tabId === 'tabMas' && masBadge) masBadge.classList.add('hidden');

    // Refrescar mapa al entrar (el tick no lo redibuja fuera de la pestaña activa)
    if (tabId === 'tabMapa') window.dispatchEvent(new CustomEvent('lys-show-map'));

    // Empezar arriba al cambiar de pestaña
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (navigator.vibrate) navigator.vibrate(8);
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
// Floating "+N XP" near the level badge (coalesced to avoid spam)
let _xpAccum = 0, _xpFloatTimer = null;
function showXpFloat(amount) {
    if (amount <= 0 || document.hidden) return;
    _xpAccum += amount;
    if (_xpFloatTimer) return;
    _xpFloatTimer = setTimeout(() => {
        const amt = _xpAccum; _xpAccum = 0; _xpFloatTimer = null;
        const anchor = levelBadge || document.querySelector('.header-right');
        if (!anchor || amt <= 0) return;
        const el = document.createElement('div');
        el.className = 'xp-float';
        el.textContent = `+${amt} XP`;
        anchor.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    }, 320);
}

export function addXP(amount) {
    S.player.xp += amount;
    showXpFloat(amount);

    // Subir de nivel: re-evaluar el umbral en CADA vuelta (no fijarlo una vez)
    while (S.player.xp >= xpForLevel(S.player.level)) {
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
    window.dispatchEvent(new CustomEvent('lys-skills-refresh'));

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
    if (!confettiCanvas || prefersReducedMotion()) return;
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
        // Aversión a la pérdida: recuerda que volver mantiene la racha
        streakPill.title = streak > 0
            ? `Racha de ${streak} día${streak > 1 ? 's' : ''}. ¡Vuelve mañana o la perderás! Mañana: racha ${streak + 1}.`
            : 'Juega cada día para construir tu racha y ganar mejores recompensas.';
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
    updateBossBar();
    maybeRefreshAchievements();
    renderNextObjective();
    // updateStarfield();
}

// Re-renderiza el grid de logros solo cuando cambia el nº de desbloqueados (live + reveal progresivo)
let _achCount = -1;
function maybeRefreshAchievements() {
    const n = Object.keys(S.achievements || {}).length;
    if (n !== _achCount) {
        const grew = _achCount >= 0 && n > _achCount;   // no celebrar el conteo inicial al cargar
        _achCount = n;
        renderAchievements();
        if (grew) { screenFlash('gold'); fireConfetti(); if (navigator.vibrate) navigator.vibrate([30, 40, 60]); }
    }
}

// ===== PERSISTENT BOSS BAR (FOMO, clicable desde cualquier pestaña) =====
function updateBossBar() {
    if (!bossBar) return;
    if (S.threat) {
        const remain = S.threat.endsAt - now();
        if (remain > 0) {
            bossBar.classList.remove('hidden');
            bossBar.innerHTML = `<span class="boss-bar-icon">${S.threat.icon || '👁️'}</span><b>${S.threat.name}</b><span class="boss-bar-time">⏳ ${fmtMs(remain)}</span><span class="boss-bar-cta">⚔️ ¡Luchar!</span>`;
            bossBar.onclick = () => window.dispatchEvent(new CustomEvent('lys-open-combat'));
            return;
        }
    }
    bossBar.classList.add('hidden');
}

// ===== NEXT-UNLOCK BEACON (orientación: qué desbloqueas a continuación) =====
const UNLOCK_STEPS = [
    { key: 'water', label: 'Río 💧', cur: s => s.resources.lenia || 0, target: 3, unit: '🪵' },
    { key: 'herbs', label: 'Campos 🌿', cur: s => s.resources.agua || 0, target: 2, unit: '💧' },
    { key: 'crafting', label: 'Taller 🔨', cur: s => Math.min(s.resources.aceitunas || 0, 1) + Math.min(s.resources.lenia || 0, 1), target: 2, unit: '🫒🪵' },
    { key: 'village', label: 'Aldea 🏘️', cur: s => Math.floor(s.stats.renown || 0), target: 5, unit: '⭐' },
    { key: 'expedition', label: 'Caminos 🛤️', cur: s => s.stats.explore || 0, target: 8, unit: '🧭' },
];
function renderUnlockBeacon() {
    if (!unlockBeacon) return;
    const step = UNLOCK_STEPS.find(s => !S.unlocked[s.key]);
    if (!step) { unlockBeacon.classList.add('hidden'); return; }
    const cur = Math.min(step.cur(S), step.target);
    const pct = Math.min(100, (cur / step.target) * 100);
    unlockBeacon.classList.remove('hidden');
    unlockBeacon.innerHTML =
        `<div class="beacon-row"><span>🔓 Próximo: <b>${step.label}</b></span><span class="beacon-num">${Math.floor(cur)}/${step.target} ${step.unit}</span></div>` +
        `<div class="beacon-bar"><div style="width:${pct}%"></div></div>`;
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

    // Aldea badge: boss / trader / ruleta diaria disponible
    if (aldeaBadge) {
        const hasBoss = !!S.threat;
        const hasTrader = !!S.trader;
        const canSpin = spinAvailable();
        if ((hasBoss || hasTrader || canSpin) && activeTab !== 'tabAldea') {
            aldeaBadge.classList.remove('hidden');
            aldeaBadge.textContent = hasBoss ? '⚔' : hasTrader ? '🪵' : '🎰';
        } else {
            aldeaBadge.classList.add('hidden');
        }
    }

    // Diario badge: misión lista para reclamar
    if (logBadge) {
        let claimable = false;
        try { claimable = integrator.getActiveQuests().some(q => q.completed); } catch (e) { }
        if (claimable && activeTab !== 'tabDiario') {
            logBadge.classList.remove('hidden');
            logBadge.textContent = '🎁';
        }
    }

    // Más badge: puntos de habilidad sin gastar
    if (masBadge) {
        if ((S.skillPoints || 0) > 0 && activeTab !== 'tabMas') {
            masBadge.classList.remove('hidden');
            masBadge.textContent = S.skillPoints;
        } else {
            masBadge.classList.add('hidden');
        }
    }
}

// ===== RENDER RESOURCES =====
export function renderResources() {
    if (!resEl) return;
    const prev = {};
    resEl.querySelectorAll('.res').forEach(el => {
        const key = el.dataset.key;
        if (key) prev[key] = el.dataset.val;   // valor crudo (no el texto formateado K/M)
    });

    resEl.innerHTML = '';
    for (const [k, v] of Object.entries(S.resources)) {
        if (v <= 0) continue;
        const meta = RES_META[k]; if (!meta) continue;
        const d = document.createElement('div');
        d.className = 'res';
        d.dataset.key = k;

        const rounded = Math.floor(v);
        d.dataset.val = String(rounded);
        d.innerHTML = `<b>${meta.icon} ${formatNumber(rounded)}</b><small>${meta.label}</small>`;

        const prevText = prev[k];
        if (prevText !== undefined) {
            const prevNum = parseInt(prevText) || 0;
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

    // Estado vacío útil: dile al jugador qué hacer
    if (!resEl.children.length) {
        resEl.innerHTML = '<p class="empty-hint">Aún no tienes recursos. Abre el 🌲 <b>Bosque</b> y corta leña para empezar.</p>';
    }

    renderUnlockBeacon();
}

// ===== RENDER NOTES =====
export function renderNotes() {
    if (!notesBody) return;
    const heat = Math.floor(S.fire.heat);
    const villagers = S.people.villagers || 0;
    const lines = [];
    lines.push(`👥 Aldeanos: ${villagers} — producción pasiva de recursos.`);
    lines.push(`🔥 Fogata: ${heat}° — mejora producción con calor alto.`);
    if (S.unlocked.molino) lines.push(`🏚️ Molino Nv ${S.buildings?.molino || 1}: transforma trigo y da renombre.`);
    if (S.unlocked.acequia) lines.push(`💧 Acequia Nv ${S.buildings?.acequia || 1}: genera agua pasiva.`);
    if (S.unlocked.forge) lines.push(`⚒️ Fragua Nv ${S.buildings?.forge || 1}: hierro pasivo y +1 daño.`);
    lines.push(`📊 Nivel: ${S.player.level} | Renombre: ${formatNumber(S.stats.renown)}`);
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
function questClaimable() {
    try { return integrator.getActiveQuests().some(q => q.completed); } catch (e) { return false; }
}

// Tarjeta "¿Qué hacer ahora?" — la primera acción pendiente, clicable
export function renderNextObjective() {
    const el = $('#nextObjective'); if (!el) return;
    const openLoc = (id) => window.dispatchEvent(new CustomEvent('lys-open-location', { detail: id }));
    let o = null;
    if (S.expedition && (S.expedition.endsAt - now()) <= 0) o = { icon: '🎁', text: 'Expedición lista para reclamar', cta: 'Mapa', act: () => switchTab('tabMapa') };
    else if (S.threat) o = { icon: '⚔️', text: `Amenaza: ${S.threat.name}`, cta: 'Luchar', act: () => window.dispatchEvent(new CustomEvent('lys-open-combat')) };
    else if (questClaimable()) o = { icon: '🎁', text: 'Misión lista para reclamar', cta: 'Diario', act: () => switchTab('tabDiario') };
    else if ((S.skillPoints || 0) > 0 && S.player.level >= 3) o = { icon: '⭐', text: `${S.skillPoints} punto(s) de habilidad sin usar`, cta: 'Mejorar', act: () => switchTab('tabMas') };
    else if (spinAvailable()) o = { icon: '🎰', text: 'Ruleta de la suerte disponible', cta: 'Girar', act: () => openLoc('campamento') };
    else if (!S.fire.lit) o = (S.resources.lenia > 0)
        ? { icon: '🔥', text: '¡Enciende la fogata!', cta: 'Campamento', act: () => openLoc('campamento') }
        : { icon: '🪵', text: 'Consigue leña en el Bosque', cta: 'Bosque', act: () => openLoc('bosque') };
    if (!o) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = `<span class="no-icon">${o.icon}</span><span class="no-text">${o.text}</span><span class="no-cta">${o.cta} →</span>`;
    el.onclick = o.act;
}

// Objetivos diarios visibles en la pantalla principal (Aldea)
export function renderDailyGoals() {
    const card = $('#dailyGoalsCard'), body = $('#dailyGoals'), cnt = $('#dailyGoalsCount');
    if (!body) return;
    if (S.player.level < 2) { if (card) card.style.display = 'none'; return; }
    let dailies = [];
    try { dailies = integrator.getActiveQuests().filter(q => q.type === 'daily'); } catch (e) { }
    if (!dailies.length) { if (card) card.style.display = 'none'; return; }
    if (card) card.style.display = '';
    const done = dailies.filter(q => q.completed).length;
    if (cnt) cnt.textContent = `${done}/${dailies.length}`;
    body.innerHTML = dailies.slice(0, 4).map(q => {
        const pct = Math.min(100, (q.progress / q.target.amount) * 100);
        const right = q.completed ? '🎁 listo' : `${Math.min(q.progress, q.target.amount)}/${q.target.amount}`;
        return `<div class="dg-row"><div class="dg-top"><span class="dg-name">${q.icon} ${q.name}</span><span class="dg-num">${right}</span></div><div class="dg-bar"><div style="width:${pct}%"></div></div></div>`;
    }).join('');
    body.onclick = () => switchTab('tabDiario');
}

export function renderQuests() {
    renderDailyGoals();
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
        comboIndicator.innerHTML = `<span class="combo-label">🔥 x${comboCount}</span><span class="combo-drain"></span>`;
        comboIndicator.classList.remove('hidden', 'combo-hot', 'combo-mega');
        if (comboCount >= 10) comboIndicator.classList.add('combo-mega');
        else if (comboCount >= 5) comboIndicator.classList.add('combo-hot');
        comboIndicator.style.animation = 'none';
        void comboIndicator.offsetWidth;
        comboIndicator.style.animation = '';
        const drain = comboIndicator.querySelector('.combo-drain');
        if (drain) drain.style.animation = `comboDrain ${COMBO_TIMEOUT}ms linear forwards`;
        // Recompensa sensorial creciente por encadenar
        if (comboCount === 5) { AudioSystem.playTone('event'); }
        if (comboCount === 10) { AudioSystem.playTone('levelup'); screenFlash('gold'); }
    }

    const bonusXP = Math.min(comboCount, 5);
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
