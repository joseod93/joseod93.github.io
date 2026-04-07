
import { S, saveState } from './state.js';
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

// Close overlay handlers
if (locationCloseBtn) {
    locationCloseBtn.onclick = () => closeLocation();
}
if (locationOverlay) {
    locationOverlay.onclick = (e) => {
        if (e.target === locationOverlay) closeLocation();
    };
}

function isUnlocked(loc) {
    if (!loc.unlock) return true;
    return !!S.unlocked[loc.unlock];
}

// ===== ISOMETRIC 3D BUILDING DEFINITIONS =====
const ISO_BUILDINGS = {
    campamento: {
        emoji: '🔥',
        layers: [
            { type: 'ground', w: 56, h: 20, color: '#2a1f14' },
            { type: 'fire', w: 20, h: 20 },
        ],
        smoke: true,
        label: 'Campamento',
    },
    bosque: {
        emoji: '🌲',
        layers: [
            { type: 'ground', w: 60, h: 18, color: '#1a2e1a' },
            { type: 'trees' },
        ],
        birds: true,
        label: 'Bosque',
    },
    rio: {
        emoji: '💧',
        layers: [
            { type: 'ground', w: 56, h: 16, color: '#0e1a2e' },
            { type: 'water' },
        ],
        label: 'Río',
    },
    campos: {
        emoji: '🌾',
        layers: [
            { type: 'ground', w: 56, h: 18, color: '#2e2a14' },
            { type: 'crops' },
        ],
        label: 'Campos',
    },
    taller: {
        emoji: '🔨',
        layers: [
            { type: 'ground', w: 50, h: 16, color: '#1e1e1e' },
            { type: 'building', w: 36, h: 28, color: '#3a2a1a', roof: '#6b4423' },
        ],
        sparks: true,
        label: 'Taller',
    },
    aldea: {
        emoji: '🏘️',
        layers: [
            { type: 'ground', w: 60, h: 18, color: '#2a2218' },
            { type: 'houses' },
        ],
        label: 'Aldea',
    },
    caminos: {
        emoji: '🛤️',
        layers: [
            { type: 'ground', w: 50, h: 14, color: '#1a1a14' },
            { type: 'road' },
        ],
        label: 'Caminos',
    },
};

// ===== TIME OF DAY HELPERS =====
function getTimePhase() {
    const m = S.time.minutes;
    if (m >= 360 && m < 720) return 'morning';
    if (m >= 720 && m < 1080) return 'afternoon';
    if (m >= 1080 && m < 1260) return 'sunset';
    return 'night';
}

function getSkyGradient() {
    const phase = getTimePhase();
    switch (phase) {
        case 'morning': return 'linear-gradient(180deg, #1a2744 0%, #2a3f5f 40%, #4a6741 100%)';
        case 'afternoon': return 'linear-gradient(180deg, #1e3354 0%, #2a4a6e 40%, #3a5a3a 100%)';
        case 'sunset': return 'linear-gradient(180deg, #2a1a3a 0%, #5a2a2a 40%, #3a2a1a 100%)';
        case 'night': return 'linear-gradient(180deg, #060810 0%, #0a0e18 40%, #0e1420 100%)';
    }
}

function getNightOverlayOpacity() {
    const phase = getTimePhase();
    if (phase === 'night') return 0.45;
    if (phase === 'sunset') return 0.15;
    return 0;
}

function getFireGlow() {
    if (!S.fire.lit) return 'none';
    const intensity = Math.min(1, S.fire.heat / 20);
    const r = 80 + intensity * 60;
    const phase = getTimePhase();
    const spread = phase === 'night' ? r * 1.5 : r;
    return `radial-gradient(circle at 50% 55%, rgba(242,166,90,${intensity * 0.3}) 0%, transparent ${spread}px)`;
}

// ===== WEATHER PARTICLE SYSTEM =====
function renderWeatherParticles() {
    const weather = S.weather;
    if (weather === 'clear') return '';

    let particles = '';
    const count = weather === 'rain' ? 25 : 15;

    for (let i = 0; i < count; i++) {
        const x = Math.random() * 100;
        const delay = Math.random() * 2;
        const dur = 0.5 + Math.random() * 0.8;

        if (weather === 'rain') {
            particles += `<div class="iso-rain" style="left:${x}%;animation-delay:${delay}s;animation-duration:${dur}s"></div>`;
        } else if (weather === 'wind') {
            const y = 20 + Math.random() * 60;
            particles += `<div class="iso-wind-leaf" style="top:${y}%;animation-delay:${delay}s">🍃</div>`;
        }
    }
    return `<div class="iso-weather">${particles}</div>`;
}

// ===== ISOMETRIC RENDERER =====
function renderIsoBuilding(locId, isActive, isLocked) {
    const def = ISO_BUILDINGS[locId];
    if (!def) return '';

    const pos = LOCAL_POS[locId];
    // Convert to isometric coordinates
    const isoX = (pos.x / 310) * 100;
    const isoY = (pos.y / 230) * 100;

    let content = '';
    const activeClass = isActive ? 'iso-active' : '';
    const lockedClass = isLocked ? 'iso-locked' : '';

    // Ground shadow
    content += `<div class="iso-ground" style="width:${def.layers[0].w}px;height:${def.layers[0].h}px;background:${def.layers[0].color}"></div>`;

    // Build specific visuals
    if (locId === 'campamento') {
        const fireState = S.fire.lit ? (S.fire.heat > 15 ? 'hot' : 'warm') : 'cold';
        content += `<div class="iso-campfire ${fireState}">
            <span class="iso-fire-emoji">${S.fire.lit ? '🔥' : '⚫'}</span>
            ${S.fire.lit ? '<div class="iso-fire-glow"></div>' : ''}
        </div>`;
        content += `<div class="iso-tent">⛺</div>`;
        if (S.fire.lit && def.smoke) {
            content += `<div class="iso-smoke">
                <span class="iso-smoke-p" style="animation-delay:0s">💨</span>
                <span class="iso-smoke-p" style="animation-delay:0.8s">💨</span>
                <span class="iso-smoke-p" style="animation-delay:1.6s">💨</span>
            </div>`;
        }
    } else if (locId === 'bosque') {
        content += `<div class="iso-forest">
            <span class="iso-tree" style="left:-12px">🌲</span>
            <span class="iso-tree big" style="left:0px">🌳</span>
            <span class="iso-tree" style="left:12px">🌲</span>
            <span class="iso-tree small" style="left:-8px;top:-2px">🌿</span>
        </div>`;
        if (def.birds) {
            content += `<div class="iso-birds">
                <span class="iso-bird" style="animation-delay:0s">🐦</span>
                <span class="iso-bird" style="animation-delay:2s">🐦</span>
            </div>`;
        }
    } else if (locId === 'rio') {
        content += `<div class="iso-river">
            <div class="iso-water-flow">
                <span class="iso-wave">〰️</span>
                <span class="iso-wave" style="animation-delay:0.5s">〰️</span>
            </div>
            <span class="iso-fish">🐟</span>
        </div>`;
    } else if (locId === 'campos') {
        content += `<div class="iso-fields">
            <span class="iso-crop">🌾</span><span class="iso-crop">🌱</span>
            <span class="iso-crop">🌾</span><span class="iso-crop">🫒</span>
        </div>`;
    } else if (locId === 'taller') {
        const hasForge = S.unlocked.forge;
        const hasMill = S.unlocked.molino;
        content += `<div class="iso-workshop">
            <div class="iso-building-3d">
                <div class="iso-wall-front"></div>
                <div class="iso-wall-side"></div>
                <div class="iso-roof"></div>
            </div>
            <span class="iso-workshop-icon">${hasForge ? '⚒️' : hasMill ? '⚙️' : '🔨'}</span>
        </div>`;
        if (hasForge && def.sparks) {
            content += `<div class="iso-sparks">
                <span class="iso-spark">✨</span>
                <span class="iso-spark" style="animation-delay:0.4s">✨</span>
                <span class="iso-spark" style="animation-delay:0.8s">⚡</span>
            </div>`;
        }
    } else if (locId === 'aldea') {
        const houses = Math.min(3, 1 + Math.floor((S.people?.villagers || 0) / 2));
        const houseEmojis = ['🏠', '🏡', '🏘️'];
        content += `<div class="iso-village">`;
        for (let i = 0; i < houses; i++) {
            content += `<span class="iso-house" style="left:${(i - 1) * 18}px">${houseEmojis[i] || '🏠'}</span>`;
        }
        if (S.people?.villagers > 0) {
            content += `<span class="iso-villager">🧑‍🌾</span>`;
        }
        content += `</div>`;
    } else if (locId === 'caminos') {
        content += `<div class="iso-roads">
            <div class="iso-path"></div>
            <span class="iso-signpost">🪧</span>
            ${S.expedition ? `<span class="iso-traveler-away">🐎</span>` : ''}
        </div>`;
    }

    // Label
    content += `<div class="iso-label">${def.label}</div>`;

    return `<div class="iso-node ${activeClass} ${lockedClass}" data-location="${locId}"
        style="left:${isoX}%;top:${isoY}%">
        ${content}
    </div>`;
}

// ===== WALKING CHARACTER =====
let walkTarget = null;
let walkPos = { x: 50, y: 55 }; // Start at campamento (percentage)

function renderWalkingCharacter() {
    const campPos = LOCAL_POS['campamento'];
    const homeX = (campPos.x / 310) * 100;
    const homeY = (campPos.y / 230) * 100;

    if (S.currentLocation && LOCAL_POS[S.currentLocation]) {
        const target = LOCAL_POS[S.currentLocation];
        walkTarget = {
            x: (target.x / 310) * 100,
            y: (target.y / 230) * 100
        };
    } else {
        walkTarget = { x: homeX, y: homeY };
    }

    // Smooth interpolation toward target
    const speed = 0.15;
    walkPos.x += (walkTarget.x - walkPos.x) * speed;
    walkPos.y += (walkTarget.y - walkPos.y) * speed;

    const moving = Math.abs(walkTarget.x - walkPos.x) > 0.5 || Math.abs(walkTarget.y - walkPos.y) > 0.5;
    const facingRight = walkTarget.x > walkPos.x;

    return `<div class="iso-character ${moving ? 'walking' : 'idle'}"
        style="left:${walkPos.x}%;top:${walkPos.y}%;${facingRight ? '' : 'transform:scaleX(-1)'}">
        🚶
    </div>`;
}

// ===== MAIN RENDER =====
export function renderSettlement() {
    if (!settlementBody) return;

    const unlocked = LOCAL_LOCATIONS.filter(isUnlocked);
    const locked = LOCAL_LOCATIONS.filter(l => !isUnlocked(l));

    // Isometric paths between locations
    let pathsHTML = '';
    LOCAL_CONNECTIONS.forEach(([a, b]) => {
        const pa = LOCAL_POS[a];
        const pb = LOCAL_POS[b];
        if (!pa || !pb) return;
        const aUn = unlocked.some(l => l.id === a);
        const bUn = unlocked.some(l => l.id === b);
        if (!aUn || !bUn) return;

        const x1 = (pa.x / 310) * 100, y1 = (pa.y / 230) * 100;
        const x2 = (pb.x / 310) * 100, y2 = (pb.y / 230) * 100;

        pathsHTML += `<svg class="iso-path-line" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                stroke="#3a2a1a" stroke-width="0.8" stroke-dasharray="2,2" opacity="0.5"/>
        </svg>`;
    });

    // Render nodes
    let nodesHTML = '';
    unlocked.forEach(loc => {
        const isActive = S.currentLocation === loc.id;
        nodesHTML += renderIsoBuilding(loc.id, isActive, false);
    });
    locked.forEach(loc => {
        nodesHTML += renderIsoBuilding(loc.id, false, true);
    });

    // Character
    const characterHTML = renderWalkingCharacter();

    // Night overlay
    const nightOpacity = getNightOverlayOpacity();
    const fireGlow = getFireGlow();

    // Build the scene
    const sceneHTML = `
    <div class="iso-scene" style="background:${getSkyGradient()}">
        <div class="iso-ground-plane">
            ${pathsHTML}
            ${nodesHTML}
            ${characterHTML}
            ${renderWeatherParticles()}
        </div>
        <div class="iso-night-overlay" style="opacity:${nightOpacity}"></div>
        <div class="iso-fire-light" style="background:${fireGlow}"></div>
    </div>`;

    // Location cards (below the isometric view)
    let cardsHTML = '<div class="location-cards">';
    unlocked.forEach(loc => {
        const isCurrent = S.currentLocation === loc.id;
        cardsHTML += `
        <div class="location-card ${isCurrent ? 'focused' : ''}" data-location="${loc.id}">
            <span class="location-card-emoji">${loc.emoji}</span>
            <div class="location-card-info">
                <div class="location-card-name">${loc.name}</div>
                <div class="location-card-desc">${loc.desc}</div>
            </div>
        </div>`;
    });

    if (locked.length > 0) {
        cardsHTML += `<div class="location-card locked">
            <span class="location-card-emoji">🔒</span>
            <div class="location-card-info">
                <div class="location-card-name">${locked.length} por desbloquear</div>
                <div class="location-card-desc">Progresa para descubrir más lugares</div>
            </div>
        </div>`;
    }
    cardsHTML += '</div>';

    settlementBody.innerHTML = sceneHTML + cardsHTML;

    // --- Event Listeners ---
    settlementBody.querySelectorAll('.iso-node[data-location]').forEach(node => {
        if (node.classList.contains('iso-locked')) return;
        node.addEventListener('click', () => {
            openLocation(node.getAttribute('data-location'));
        });
    });

    settlementBody.querySelectorAll('.location-card[data-location]').forEach(card => {
        card.addEventListener('click', () => {
            openLocation(card.getAttribute('data-location'));
        });
    });
}

// ===== AMBIENT SOUND SYSTEM =====
let currentAmbient = null;
let ambientInterval = null;

function playAmbientForLocation(locId) {
    stopAmbient();
    if (AudioSystem.muted) return;

    const ambients = {
        bosque: () => playNatureLoop('forest'),
        rio: () => playNatureLoop('river'),
        taller: () => playNatureLoop('workshop'),
        aldea: () => playNatureLoop('village'),
        campamento: () => { if (S.fire.lit) playNatureLoop('fire'); },
    };

    if (ambients[locId]) {
        ambients[locId]();
    }
}

function playNatureLoop(type) {
    if (!AudioSystem.ctx || AudioSystem.muted) return;
    if (AudioSystem.ctx.state === 'suspended') AudioSystem.ctx.resume();

    const ctx = AudioSystem.ctx;
    currentAmbient = { nodes: [], type };

    if (type === 'forest') {
        // Birds chirping periodically
        ambientInterval = setInterval(() => {
            if (AudioSystem.muted) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            const t = ctx.currentTime;
            const baseFreq = 1800 + Math.random() * 1200;
            osc.frequency.setValueAtTime(baseFreq, t);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, t + 0.05);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, t + 0.1);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.1, t + 0.15);
            gain.gain.setValueAtTime(0.012, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            osc.start(t);
            osc.stop(t + 0.2);
        }, 1500 + Math.random() * 2000);
    } else if (type === 'river') {
        // White noise water
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.015;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        const gain = ctx.createGain();
        gain.gain.value = 0.08;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start();
        currentAmbient.nodes.push(source, gain);
    } else if (type === 'workshop') {
        ambientInterval = setInterval(() => {
            if (AudioSystem.muted) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'square';
            const t = ctx.currentTime;
            osc.frequency.setValueAtTime(200, t);
            osc.frequency.exponentialRampToValueAtTime(100, t + 0.06);
            gain.gain.setValueAtTime(0.02, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            osc.start(t);
            osc.stop(t + 0.06);
        }, 2000 + Math.random() * 1500);
    } else if (type === 'village') {
        ambientInterval = setInterval(() => {
            if (AudioSystem.muted) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            const t = ctx.currentTime;
            osc.frequency.setValueAtTime(300 + Math.random() * 200, t);
            gain.gain.setValueAtTime(0.008, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            osc.start(t);
            osc.stop(t + 0.1);
        }, 3000 + Math.random() * 2000);
    } else if (type === 'fire') {
        // Crackling
        ambientInterval = setInterval(() => {
            if (AudioSystem.muted) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sawtooth';
            const t = ctx.currentTime;
            osc.frequency.setValueAtTime(80 + Math.random() * 40, t);
            gain.gain.setValueAtTime(0.01, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            osc.start(t);
            osc.stop(t + 0.04);
        }, 200 + Math.random() * 300);
    }
}

function stopAmbient() {
    if (ambientInterval) {
        clearInterval(ambientInterval);
        ambientInterval = null;
    }
    if (currentAmbient?.nodes) {
        currentAmbient.nodes.forEach(n => {
            try { n.stop(); } catch (e) { /* already stopped */ }
            try { n.disconnect(); } catch (e) { /* ok */ }
        });
    }
    currentAmbient = null;
}

// ===== OPEN / CLOSE LOCATION =====
export function openLocation(locationId) {
    const loc = LOCAL_LOCATIONS.find(l => l.id === locationId);
    if (!loc || !isUnlocked(loc)) return;
    if (!locationOverlay) return;

    S.currentLocation = locationId;
    vibrate(15);

    // Set overlay content
    if (locationIcon) locationIcon.textContent = loc.emoji;
    if (locationTitle) locationTitle.textContent = loc.name;
    if (locationDesc) locationDesc.textContent = loc.desc;

    // Render actions
    if (locationActions) {
        renderLocationActions(locationId, locationActions);
    }

    // Show overlay with 3D transition
    locationOverlay.classList.remove('hidden');
    locationOverlay.querySelector('.location-panel')?.classList.add('panel-enter');
    setTimeout(() => {
        locationOverlay.querySelector('.location-panel')?.classList.remove('panel-enter');
    }, 400);

    // Start ambient sound
    playAmbientForLocation(locationId);

    renderSettlement();
}

export function closeLocation() {
    if (!locationOverlay) return;

    // 3D exit animation
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

// Refresh the open location panel
export function refreshOpenLocation() {
    if (S.currentLocation && locationActions && !locationOverlay?.classList.contains('hidden')) {
        renderLocationActions(S.currentLocation, locationActions);
    }
}
