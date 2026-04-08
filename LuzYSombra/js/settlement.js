
import { S } from './state.js';
import { LOCAL_LOCATIONS } from './constants.js';
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

// ===== MAIN RENDER =====
export function renderSettlement() {
    if (!settlementBody) return;

    const unlocked = LOCAL_LOCATIONS.filter(isUnlocked);
    const locked = LOCAL_LOCATIONS.filter(l => !isUnlocked(l));

    // Dirty check: only rebuild if state changed
    const key = unlocked.map(l => l.id).join(',') + '|' + S.currentLocation + '|' + locked.length;
    if (settlementBody.dataset.key === key) return;
    settlementBody.dataset.key = key;

    settlementBody.innerHTML = `<div class="s3-strip">
        ${unlocked.map(loc => `
        <button class="s3-btn${S.currentLocation === loc.id ? ' active' : ''}" data-location="${loc.id}">
            <span class="s3-btn-icon">${loc.emoji}</span>
            <span class="s3-btn-name">${loc.name}</span>
        </button>`).join('')}
        ${locked.length > 0 ? `<div class="s3-btn locked"><span class="s3-btn-icon">🔒</span><span class="s3-btn-name">${locked.length} más</span></div>` : ''}
    </div>`;

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
    if (S.currentLocation && locationActions && locationOverlay && !locationOverlay.classList.contains('hidden')) {
        renderLocationActions(S.currentLocation, locationActions);
    }
}
