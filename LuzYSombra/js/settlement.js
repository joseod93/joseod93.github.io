
import { S } from './state.js';
import { LOCAL_LOCATIONS, LOCAL_POS, LOCAL_CONNECTIONS } from './constants.js';
import { $ } from './utils.js';
import { renderLocationActions } from './actions.js';
import { vibrate } from './utils.js';
import { AudioSystem } from './audio.js';

const settlementBody = $('#settlementBody');
const locationOverlay = $('#locationOverlay');
const locationActions = $('#locationActions');
const locationTitle = $('#locationTitle');
const locationDesc = $('#locationDesc');
const locationIcon = $('#locationIcon');
const locationCloseBtn = $('#locationCloseBtn');

if (locationCloseBtn) locationCloseBtn.onclick = () => closeLocation();
if (locationOverlay) locationOverlay.onclick = (e) => { if (e.target === locationOverlay) closeLocation(); };

function isUnlocked(loc) { return !loc.unlock || !!S.unlocked[loc.unlock]; }

// ===== TIME =====
function getTimePhase() {
    const m = S.time.minutes;
    if (m >= 360 && m < 720) return 'morning';
    if (m >= 720 && m < 1080) return 'afternoon';
    if (m >= 1080 && m < 1260) return 'sunset';
    return 'night';
}

// ===== 3D BUILDING HTML =====
function buildingHTML(id) {
    switch (id) {
    case 'campamento': {
        const lit = S.fire.lit;
        const hot = S.fire.heat > 15;
        return `<div class="b3-camp">
            <div class="b3-tent"><div class="b3-tent-body"></div><div class="b3-tent-door"></div></div>
            <div class="b3-fire ${lit ? (hot ? 'hot' : 'warm') : ''}">
                ${lit ? `<div class="b3-flame f1"></div><div class="b3-flame f2"></div><div class="b3-flame f3"></div>
                <div class="b3-glow"></div>` : '<div class="b3-ash"></div>'}
            </div>
            ${lit ? '<div class="b3-smoke"><i></i><i></i><i></i></div>' : ''}
        </div>`;
    }
    case 'bosque':
        return `<div class="b3-forest">
            <div class="b3-tree t1"><div class="b3-trunk"></div><div class="b3-leaves l1"></div><div class="b3-leaves l2"></div></div>
            <div class="b3-tree t2"><div class="b3-trunk"></div><div class="b3-pine p1"></div><div class="b3-pine p2"></div><div class="b3-pine p3"></div></div>
            <div class="b3-tree t3"><div class="b3-trunk"></div><div class="b3-leaves l1"></div></div>
        </div>`;
    case 'rio':
        return `<div class="b3-river">
            <div class="b3-water"><div class="b3-ripple"></div><div class="b3-ripple r2"></div><div class="b3-shine"></div></div>
            <div class="b3-rock"></div><div class="b3-rock r2"></div>
        </div>`;
    case 'campos':
        return `<div class="b3-fields">
            <div class="b3-row"><i></i><i></i><i></i><i></i></div>
            <div class="b3-row r2"><i></i><i></i><i></i></div>
        </div>`;
    case 'taller': {
        const forge = S.unlocked.forge;
        return `<div class="b3-workshop">
            <div class="b3-bldg">
                <div class="b3-wall"></div><div class="b3-side"></div>
                <div class="b3-roof"></div><div class="b3-door"></div>
                ${forge ? '<div class="b3-chimney"></div>' : ''}
            </div>
            ${forge ? '<div class="b3-sparks"><i></i><i></i><i></i></div>' : ''}
        </div>`;
    }
    case 'aldea': {
        const pop = S.people?.villagers || 0;
        const n = Math.min(3, 1 + Math.floor(pop / 2));
        let h = '';
        for (let i = 0; i < n; i++) h += `<div class="b3-house h${i}"><div class="b3-hw"></div><div class="b3-hr"></div></div>`;
        return `<div class="b3-village">${h}${pop > 0 ? '<div class="b3-npc"></div>' : ''}</div>`;
    }
    case 'caminos':
        return `<div class="b3-roads">
            <div class="b3-road"></div><div class="b3-sign"></div>
            ${S.expedition ? '<div class="b3-horse"></div>' : ''}
        </div>`;
    default: return '';
    }
}

// ===== MAIN RENDER =====
export function renderSettlement() {
    if (!settlementBody) return;

    const unlocked = LOCAL_LOCATIONS.filter(isUnlocked);
    const locked = LOCAL_LOCATIONS.filter(l => !isUnlocked(l));
    const phase = getTimePhase();
    const fireI = S.fire.lit ? Math.min(1, S.fire.heat / 20) : 0;
    const campP = LOCAL_POS['campamento'];

    // SVG paths
    let paths = '';
    LOCAL_CONNECTIONS.forEach(([a, b]) => {
        const pa = LOCAL_POS[a], pb = LOCAL_POS[b];
        if (!pa || !pb) return;
        if (!unlocked.some(l => l.id === a) || !unlocked.some(l => l.id === b)) return;
        paths += `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="rgba(160,130,80,0.25)" stroke-width="2.5" stroke-dasharray="5,5"/>`;
    });

    // Nodes
    let nodes = '';
    const all = [...unlocked.map(l => ({...l, locked: false})), ...locked.map(l => ({...l, locked: true}))];
    all.forEach(loc => {
        const p = LOCAL_POS[loc.id];
        const active = S.currentLocation === loc.id;
        const cls = `s3-node${active ? ' active' : ''}${loc.locked ? ' locked' : ''}`;

        nodes += `<div class="${cls}" data-location="${loc.id}" style="left:${p.x}px;top:${p.y}px">
            <div class="s3-hitarea"></div>
            <div class="s3-platform"></div>
            <div class="s3-building">${loc.locked ? '<div class="s3-lock">🔒</div>' : buildingHTML(loc.id)}</div>
            <div class="s3-name">${loc.name}</div>
            ${active ? '<div class="s3-ring"></div>' : ''}
        </div>`;
    });

    // Stars
    let stars = '';
    if (phase === 'night') {
        for (let i = 0; i < 15; i++)
            stars += `<div class="s3-star" style="left:${Math.random()*95}%;top:${Math.random()*35}%;animation-delay:${Math.random()*3}s"></div>`;
    }

    // Weather
    let weather = '';
    if (S.weather === 'rain') {
        for (let i = 0; i < 30; i++)
            weather += `<div class="s3-rain" style="left:${Math.random()*100}%;animation-delay:${(Math.random()*1.2).toFixed(2)}s"></div>`;
    } else if (S.weather === 'wind') {
        for (let i = 0; i < 6; i++)
            weather += `<div class="s3-wind" style="top:${20+Math.random()*60}%;animation-delay:${(Math.random()*2.5).toFixed(2)}s"></div>`;
    }

    settlementBody.innerHTML = `
    <div class="s3-scene ${phase}" style="--fi:${fireI};--fx:${campP.x};--fy:${campP.y}">
        ${stars ? `<div class="s3-stars">${stars}</div>` : ''}
        <div class="s3-world" style="--cols:310;--rows:230">
            <svg class="s3-paths" viewBox="0 0 310 230">${paths}</svg>
            ${nodes}
        </div>
        ${weather ? `<div class="s3-weather">${weather}</div>` : ''}
        <div class="s3-night"></div>
        <div class="s3-fireglow"></div>
        <div class="s3-vig"></div>
    </div>

    <div class="s3-strip">
        ${unlocked.map(loc => `
        <button class="s3-btn${S.currentLocation === loc.id ? ' active' : ''}" data-location="${loc.id}">
            <span class="s3-btn-icon">${loc.emoji}</span>
            <span class="s3-btn-name">${loc.name}</span>
        </button>`).join('')}
        ${locked.length > 0 ? `<div class="s3-btn locked"><span class="s3-btn-icon">🔒</span><span class="s3-btn-name">${locked.length} más</span></div>` : ''}
    </div>`;

    // Events — nodes
    settlementBody.querySelectorAll('.s3-node:not(.locked)').forEach(n =>
        n.addEventListener('click', () => openLocation(n.dataset.location))
    );
    // Events — strip buttons
    settlementBody.querySelectorAll('.s3-btn:not(.locked)').forEach(b =>
        b.addEventListener('click', () => openLocation(b.dataset.location))
    );
}

// ===== AMBIENT =====
let ambInt = null, ambNodes = [];

function playAmbient(id) {
    stopAmbient();
    if (AudioSystem.muted || !AudioSystem.ctx) return;
    if (AudioSystem.ctx.state === 'suspended') AudioSystem.ctx.resume();
    const ctx = AudioSystem.ctx;
    const make = {
        bosque() {
            ambInt = setInterval(() => {
                if (AudioSystem.muted) return;
                const o = ctx.createOscillator(), g = ctx.createGain();
                o.connect(g); g.connect(ctx.destination); o.type = 'sine';
                const t = ctx.currentTime, f = 1800 + Math.random() * 1200;
                o.frequency.setValueAtTime(f, t);
                o.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.08);
                o.frequency.exponentialRampToValueAtTime(f * 0.9, t + 0.15);
                g.gain.setValueAtTime(0.012, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                o.start(t); o.stop(t + 0.2);
            }, 1500 + Math.random() * 2000);
        },
        rio() {
            const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.012;
            const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
            const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 700;
            const g = ctx.createGain(); g.gain.value = 0.06;
            src.connect(flt); flt.connect(g); g.connect(ctx.destination); src.start();
            ambNodes.push(src);
        },
        campamento() {
            if (!S.fire.lit) return;
            ambInt = setInterval(() => {
                if (AudioSystem.muted) return;
                const o = ctx.createOscillator(), g = ctx.createGain();
                o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
                const t = ctx.currentTime;
                o.frequency.setValueAtTime(80 + Math.random() * 40, t);
                g.gain.setValueAtTime(0.01, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
                o.start(t); o.stop(t + 0.04);
            }, 200 + Math.random() * 300);
        },
        taller() {
            ambInt = setInterval(() => {
                if (AudioSystem.muted) return;
                const o = ctx.createOscillator(), g = ctx.createGain();
                o.connect(g); g.connect(ctx.destination); o.type = 'square';
                const t = ctx.currentTime;
                o.frequency.setValueAtTime(200, t);
                o.frequency.exponentialRampToValueAtTime(100, t + 0.06);
                g.gain.setValueAtTime(0.02, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
                o.start(t); o.stop(t + 0.06);
            }, 2000 + Math.random() * 1500);
        },
    };
    if (make[id]) make[id]();
}

function stopAmbient() {
    if (ambInt) { clearInterval(ambInt); ambInt = null; }
    ambNodes.forEach(n => { try { n.stop(); } catch(e){} try { n.disconnect(); } catch(e){} });
    ambNodes = [];
}

// ===== OPEN / CLOSE =====
export function openLocation(locationId) {
    const loc = LOCAL_LOCATIONS.find(l => l.id === locationId);
    if (!loc || !isUnlocked(loc) || !locationOverlay) return;
    S.currentLocation = locationId;
    vibrate(15);

    if (locationIcon) locationIcon.textContent = loc.emoji;
    if (locationTitle) locationTitle.textContent = loc.name;
    if (locationDesc) locationDesc.textContent = loc.desc;
    if (locationActions) renderLocationActions(locationId, locationActions);

    locationOverlay.classList.remove('hidden');
    const panel = locationOverlay.querySelector('.location-panel');
    if (panel) { panel.classList.add('panel-enter'); setTimeout(() => panel.classList.remove('panel-enter'), 400); }

    playAmbient(locationId);
    renderSettlement();
}

export function closeLocation() {
    if (!locationOverlay) return;
    const panel = locationOverlay.querySelector('.location-panel');
    if (panel) {
        panel.classList.add('panel-exit');
        setTimeout(() => {
            S.currentLocation = null;
            locationOverlay.classList.add('hidden');
            panel.classList.remove('panel-exit');
            stopAmbient();
            renderSettlement();
        }, 250);
    } else {
        S.currentLocation = null;
        locationOverlay.classList.add('hidden');
        stopAmbient();
        renderSettlement();
    }
}

export function refreshOpenLocation() {
    if (S.currentLocation && locationActions && !locationOverlay?.classList.contains('hidden')) {
        renderLocationActions(S.currentLocation, locationActions);
    }
}
