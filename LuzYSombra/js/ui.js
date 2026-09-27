
import { $, fmtMs, now, formatNumber, prefersReducedMotion } from './utils.js';
import { AudioSystem } from './audio.js';
import { S, saveState, xpForLevel } from './state.js';
import { RES_META, BOSSES, ENEMIES, seasonOf, activeSeasonEvent } from './constants.js';
import { ACHIEVEMENTS, getAchievementProgress } from './achievements.js';
import integrator from './integrator.js';
import { renderHistoryCharts } from './chart.js';
import { addChronicle } from './chronicle.js';

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
const seasonPill = $('#seasonPill');
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
const LOG_MAX = 200;   // tope de entradas en el DOM del Diario
export function log(text, cls) {
    const p = document.createElement('p');
    if (cls) p.className = cls;
    const m = (S.time?.minutes || 0) % 1440;
    const t = document.createElement('span');
    t.className = 'log-time';
    t.textContent = `D${S.time?.day || 1} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    p.append(t, document.createTextNode(text));
    logEl.appendChild(p);
    while (logEl.childElementCount > LOG_MAX) logEl.firstElementChild.remove();
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
    addChronicle('⭐', `Alcanzaste el nivel ${level}.`, `lvl${level}_p${S.prestige || 0}`);
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
// Un único bucle compartido: cada lanzamiento añade partículas (antes cada llamada tenía su propio
// bucle, que borraba el lienzo de los demás y podía dejar restos pintados)
const _confetti = [];
let _confettiRunning = false;
export function fireConfetti() {
    if (!confettiCanvas || prefersReducedMotion()) return;
    const ctx = confettiCanvas.getContext('2d');
    if (confettiCanvas.width !== window.innerWidth) confettiCanvas.width = window.innerWidth;
    if (confettiCanvas.height !== window.innerHeight) confettiCanvas.height = window.innerHeight;
    const colors = ['#f2a65a', '#ffe08a', '#9ad06e', '#ff6b6b', '#4dabf7', '#fff'];
    for (let i = 0; i < 60; i++) {
        _confetti.push({
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
    if (_confettiRunning) return;
    _confettiRunning = true;

    // Avance por tiempo (no por fotograma): dura ~1,4 s también en móviles lentos
    let last = performance.now();
    function draw(ts) {
        const k = Math.min(30, Math.max(0.25, ((ts || performance.now()) - last) / 16.67));
        last = ts || performance.now();
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        for (let i = _confetti.length - 1; i >= 0; i--) {
            const p = _confetti[i];
            p.x += p.vx * k; p.y += p.vy * k; p.vy += 0.3 * k; p.vx *= Math.pow(0.99, k);
            p.rotation += p.rotSpeed * k; p.life -= 0.012 * k;
            if (p.life <= 0 || p.y > confettiCanvas.height + 20) { _confetti.splice(i, 1); continue; }
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            ctx.restore();
        }
        if (_confetti.length) requestAnimationFrame(draw);
        else { ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); _confettiRunning = false; }
    }
    requestAnimationFrame(draw);
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
    const season = seasonOf(S.time.day);
    const sev = activeSeasonEvent(S);
    const sKey = season.key + '|' + (sev ? sev.key : '');
    if (seasonPill && seasonPill.dataset.key !== sKey) {
        seasonPill.dataset.key = sKey;
        seasonPill.textContent = `${season.icon} ${season.name}${sev ? ` · ${sev.icon} ${sev.name}` : ''}`;
        seasonPill.title = `${season.name}: ${season.desc}` + (sev ? `
Hoy: ${sev.name}. ${sev.desc}` : '');
        seasonPill.className = `stat-pill season-pill season-${season.key}${sev ? ' has-event' : ''}`;
    }
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
    renderAchievements();   // tiene su propio dirty-check (progreso)
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
// Ritmo esperado por minuto (lo calcula game.js con las fórmulas del tick)
let _rates = {};
export function setProductionRates(r) { _rates = r || {}; }
// Minutos de comida (trigo + aceitunas) al ritmo actual; Infinity si no se agota
export function foodMinutes() {
    const net = (_rates.trigo || 0) + (_rates.aceitunas || 0);
    if (net >= 0 || !(S.people.villagers > 0)) return Infinity;
    return ((S.resources.trigo || 0) + (S.resources.aceitunas || 0)) / -net;
}
function fmtRate(v) {
    const a = Math.abs(v);
    const n = a >= 10 ? Math.round(a) : a >= 1 ? a.toFixed(1) : a.toFixed(2);
    return `${v > 0 ? '+' : '−'}${String(n).replace('.', ',')}/min`;
}

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
        const rate = _rates[k] || 0;
        const rateHtml = Math.abs(rate) >= 0.05 ? `<em class="res-rate ${rate > 0 ? 'up' : 'down'}">${fmtRate(rate)}</em>` : '';
        d.innerHTML = `<b>${meta.icon} ${formatNumber(rounded)}</b><small>${meta.label}</small>${rateHtml}`;
        d.title = `${meta.label}: ${rounded}` + (rateHtml ? ` (${fmtRate(rate)})` : '');

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
    notesBody.innerHTML = '<ul class="notes-list">' + lines.map(t => `<li>${t}</li>`).join('') + '</ul>';
}

// ===== RENDER ACHIEVEMENTS =====
// Logros: anillo de progreso en los bloqueados, ocultos como ❔, ficha al tocar
function achProgress(a) {
    try { return getAchievementProgress(a.id, S)?.progress || 0; } catch (e) { return 0; }
}
export function renderAchievements() {
    if (!achEl) return;
    const all = Object.values(ACHIEVEMENTS);
    const got = all.filter(a => S.achievements[a.id]).length;
    const key = all.map(a => S.achievements[a.id] ? 'x' : achProgress(a)).join(',');
    if (achEl.dataset.key === key) return;
    achEl.dataset.key = key;
    const cnt = $('#achCount'); if (cnt) cnt.textContent = `${got}/${all.length}`;
    const bar = $('#achBar'); if (bar) bar.style.width = `${Math.round(got / all.length * 100)}%`;

    achEl.innerHTML = '';
    all.forEach(a => {
        const has = !!S.achievements[a.id];
        const secret = a.hidden && !has;
        const p = has ? 100 : achProgress(a);
        const d = document.createElement('button');
        d.type = 'button';
        d.className = 'ach' + (has ? ' unlocked' : ' locked') + (p > 0 && !has ? ' in-progress' : '');
        d.style.setProperty('--p', p);
        d.textContent = secret ? '❔' : a.icon;
        const label = secret ? 'Logro oculto' : `${a.name}${has ? ' (conseguido)' : p ? ` (${p} %)` : ''}`;
        d.title = label;
        d.setAttribute('aria-label', label);
        d.onclick = () => showAchievementSheet(a);
        achEl.appendChild(d);
    });
}

// Deslizar el asa hacia abajo cierra la hoja (lugares, ajustes, fichas). Delegado: vale para las creadas luego.
(function enableSheetSwipe() {
    let drag = null;
    document.addEventListener('pointerdown', (e) => {
        const handle = e.target.closest('.sheet-handle');
        if (!handle) return;
        const panel = handle.closest('.panel');
        if (!panel) return;
        drag = { panel, y0: e.clientY, dy: 0, id: e.pointerId };
        panel.classList.add('dragging');
        panel.style.transition = 'none';
        try { handle.setPointerCapture(e.pointerId); } catch (err) { }
    });
    document.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        drag.dy = Math.max(0, e.clientY - drag.y0);
        drag.panel.style.transform = `translateY(${drag.dy}px)`;
    });
    const end = (e) => {
        if (!drag || (e && e.pointerId !== drag.id)) return;
        const { panel, dy } = drag;
        drag = null;
        panel.classList.remove('dragging');
        panel.style.transition = 'transform .2s ease';
        const overlay = panel.closest('.overlay');
        const closeBtn = overlay && overlay.querySelector('[data-close], #locationCloseBtn, #settingsCloseBtn');
        if (dy > 70 && closeBtn) {
            panel.style.transform = 'translateY(100%)';
            setTimeout(() => {
                panel.classList.add('swiped');   // sin animación de salida: ya está abajo
                closeBtn.click();
                setTimeout(() => { panel.classList.remove('swiped'); panel.style.transform = ''; panel.style.transition = ''; }, 320);
            }, 180);
        } else {
            panel.style.transform = '';
            setTimeout(() => { panel.style.transition = ''; }, 220);
        }
    };
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
})();

// Hoja inferior genérica (móvil) / ventana (escritorio). El botón [data-close] la cierra (y Esc).
export function showSheet(html, cls = '') {
    const modal = document.createElement('div');
    modal.className = 'overlay sheet-overlay';
    modal.innerHTML = `<div class="panel sheet ${cls}" role="dialog" aria-modal="true"><div class="sheet-handle" aria-hidden="true"></div>${html}</div>`;
    const close = () => { modal.classList.add('hidden'); setTimeout(() => modal.remove(), 250); };
    modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close]')) close(); });
    document.body.appendChild(modal);
    const btn = modal.querySelector('[data-close]'); if (btn) btn.focus({ preventScroll: true });
    return modal;
}

function showAchievementSheet(a) {
    const has = !!S.achievements[a.id];
    const secret = a.hidden && !has;
    const p = has ? 100 : achProgress(a);
    const reward = a.reward ? Object.entries(a.reward).map(([k, n]) => `+${n} ${k === 'renown' ? '⭐ renombre' : (RES_META[k]?.icon || '') + ' ' + (RES_META[k]?.label || k)}`).join(' · ') : '';
    const when = has && typeof S.achievements[a.id] === 'number' ? ` · ${new Date(S.achievements[a.id]).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : '';
    showSheet(`
        <div class="ach-sheet-icon${has ? '' : ' locked'}">${secret ? '❔' : a.icon}</div>
        <h2 class="ach-sheet-name">${secret ? 'Logro oculto' : a.name}</h2>
        <p class="ach-sheet-desc">${secret ? 'Sigue jugando para descubrir qué esconde.' : a.description}</p>
        ${has ? `<div class="ach-sheet-state ok">🏅 Conseguido${when}</div>`
            : secret ? '' : `<div class="ach-sheet-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"><div style="width:${p}%"></div></div><div class="ach-sheet-state">${p ? `${p} % completado` : 'Aún sin empezar'}</div>`}
        ${reward && !secret ? `<div class="ach-sheet-reward">Recompensa: ${reward}</div>` : ''}
        <button class="action" data-close>Cerrar</button>`, 'ach-sheet');
}

// ===== BESTIARIO =====
// Colección de criaturas: bosses por key, enemigos por nombre (las oleadas no cuentan)
export function renderBestiary() {
    const body = $('#bestiary');
    if (!body) return;
    const seen = S.bestiary || {};
    const entries = [
        ...ENEMIES.map(e => ({ id: e.name, name: e.name, icon: e.icon, level: e.level, boss: false })),
        ...BOSSES.map(b => ({ id: b.key, name: b.name, icon: b.icon, level: b.level, boss: true, region: b.region })),
    ].sort((a, b) => a.level - b.level || a.boss - b.boss);
    const found = entries.filter(e => seen[e.id] > 0).length;
    const key = `${found}|${Object.values(seen).reduce((a, n) => a + n, 0)}`;
    if (body.dataset.key === key) return;   // dirty-check: solo re-render si cambió
    body.dataset.key = key;

    const count = $('#bestiaryCount');
    if (count) count.textContent = `${found}/${entries.length}`;
    const bar = $('#bestiaryBar');
    if (bar) bar.style.width = `${Math.round(found / entries.length * 100)}%`;

    body.innerHTML = '';
    entries.forEach(e => {
        const n = seen[e.id] || 0;
        const d = document.createElement('div');
        d.className = 'ach bestiary-entry' + (n ? ' unlocked' : ' locked') + (e.boss ? ' boss' : '');
        d.textContent = n ? e.icon : '❔';
        if (n) {
            const where = e.boss ? ` · ${e.region}` : '';
            d.title = `${e.name} (Nv ${e.level}${where}) · ${n} ${n === 1 ? 'victoria' : 'victorias'}`;
            d.setAttribute('aria-label', d.title);
            d.onclick = () => toast(`${e.icon} ${d.title}`);
        } else {
            d.title = e.boss ? 'Boss por descubrir' : 'Criatura por descubrir';
            d.setAttribute('aria-label', d.title);
            d.onclick = () => toast(`❔ ${d.title} (Nv ${e.level})`);
        }
        body.appendChild(d);
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
    const food = foodMinutes();
    if (food < 3) o = { icon: '🍞', text: food < 1 ? '¡La comida se acaba ya! Los aldeanos pasarán hambre' : `La comida se acaba en ${Math.floor(food)} min`, cta: 'Aldea', act: () => openLoc('aldea') };
    else if (S.expedition && (S.expedition.endsAt - now()) <= 0) o = { icon: '🎁', text: 'Expedición lista para reclamar', cta: 'Mapa', act: () => switchTab('tabMapa') };
    // (la amenaza activa ya tiene su barra de boss fija: no duplicarla aquí)
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
        questsContainer.innerHTML = '<p class="empty-hint">No hay misiones activas. ¡Explora más!</p>';
        return;
    }

    questsContainer.innerHTML = activeQuests.map(q => `
        <div class="quest-item${q.completed ? ' done' : ''}">
            <div class="quest-top">
                <span class="quest-name">${q.icon} ${q.name}</span>
                <span class="quest-num">${Math.min(q.progress, q.target.amount)}/${q.target.amount}</span>
            </div>
            <div class="quest-bar"><div style="width:${Math.min(100, (q.progress / q.target.amount) * 100)}%"></div></div>
            ${q.completed ? '<button class="action glow-btn claim-btn" data-id="' + q.id + '">🎁 Reclamar</button>' : ''}
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
const STAT_LABELS = {
    playTime: 'Tiempo de juego', sessions: 'Sesiones', totalResources: 'Recursos reunidos',
    totalActions: 'Acciones totales', actions: 'Acciones', combatWinRate: 'Victorias en combate',
    bossesDefeated: 'Bosses derrotados', avgDamagePerCombat: 'Daño medio por combate',
    expeditions: 'Expediciones', regionsExplored: 'Regiones exploradas', favoriteRegion: 'Región favorita',
    renownEarned: 'Renombre ganado', renownSpent: 'Renombre gastado', netRenown: 'Renombre neto',
    maxVillagers: 'Máx. aldeanos', villagersRecruited: 'Aldeanos reclutados', achievements: 'Logros',
    explore: 'explorar', craft: 'fabricar', build: 'construir', combat: 'combatir', recruit: 'reclutar',
    records: 'Récords', longestFireStreak: 'Fuego más largo', fastestBoss: 'Boss más rápido', highestRenown: 'Renombre máximo',
};
export function showStatistics() {
    const stats = integrator.getStatistics();

    const formatStatValue = (key, value) => {
        if (Array.isArray(value)) {
            if (value.length === 0) return 'Ninguno';
            if (key === 'totalResources') return value.map(i => `${RES_META[i.resource]?.icon || ''} ${i.amount}`).join(' · ');
            return value.join(', ');
        }
        if (typeof value === 'object' && value !== null) {
            if (Object.keys(value).length === 0) return 'Ninguno';
            return Object.entries(value).map(([k, v]) => `${STAT_LABELS[k] || RES_META[k]?.label || k}: ${v}`).join(', ');
        }
        return value;
    };

    const modal = document.createElement('div');
    modal.className = 'overlay';
    modal.style.zIndex = '10000';

    modal.innerHTML = `
        <div class="panel stats-panel">
            <h2>📊 Estadísticas</h2>
            <div class="stats-hero">
                <div class="stat-box hero"><div class="stat-k">Nivel</div><div class="stat-v">${S.player.level}</div></div>
                <div class="stat-box hero"><div class="stat-k">Racha</div><div class="stat-v">${S.streak?.current || 0} 🔥</div></div>
                <div class="stat-box hero"><div class="stat-k">Día</div><div class="stat-v">${S.time.day}</div></div>
            </div>
            <section class="stats-section">
                <h3 class="stats-sub">📈 Evolución de recursos</h3>
                <div id="statsChart"></div>
            </section>
            <h3 class="stats-sub">📋 Resumen</h3>
            <div class="stats-grid">
                ${Object.entries(stats).map(([key, value]) => `
                    <div class="stat-box">
                        <div class="stat-k">${STAT_LABELS[key] || key.replace(/([A-Z])/g, ' $1').trim()}</div>
                        <div class="stat-v small">${formatStatValue(key, value)}</div>
                    </div>
                `).join('')}
            </div>
            <button class="action" id="closeStatsBtn">Cerrar</button>
        </div>
    `;

    document.body.appendChild(modal);
    renderHistoryCharts(modal.querySelector('#statsChart'), S.history);

    const close = () => {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('#closeStatsBtn').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };
}
