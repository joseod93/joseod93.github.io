
import { S, saveState } from './state.js';
import { LOCAL_LOCATIONS, LOCAL_POS, LOCAL_CONNECTIONS } from './constants.js';
import { $ } from './utils.js';
import { renderLocationActions } from './actions.js';
import { vibrate } from './utils.js';

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

export function renderSettlement() {
    if (!settlementBody) return;

    const w = 310, h = 230;
    const unlocked = LOCAL_LOCATIONS.filter(isUnlocked);
    const locked = LOCAL_LOCATIONS.filter(l => !isUnlocked(l));

    // --- SVG ---
    const lines = LOCAL_CONNECTIONS.map(([a, b]) => {
        const pa = LOCAL_POS[a];
        const pb = LOCAL_POS[b];
        if (!pa || !pb) return '';
        const aUnlocked = unlocked.some(l => l.id === a);
        const bUnlocked = unlocked.some(l => l.id === b);
        const bothUnlocked = aUnlocked && bUnlocked;
        return `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}"
            stroke="${bothUnlocked ? '#1b263688' : '#1b263644'}" stroke-width="1" stroke-dasharray="4,4"/>`;
    }).join('');

    const unlockedNodes = unlocked.map(loc => {
        const p = LOCAL_POS[loc.id];
        if (!p) return '';
        const isCurrent = S.currentLocation === loc.id;
        const fill = isCurrent ? '#ffe08a' : '#f2a65a';
        const stroke = isCurrent ? '#f59e0b' : '#1b2636';
        const r = isCurrent ? 16 : 12;
        const pulseAnim = !isCurrent ? `<animate attributeName="r" values="${r};${r + 2};${r}" dur="2.5s" repeatCount="indefinite"/>` : '';
        return `<g data-location="${loc.id}" cursor="pointer">
            <circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2" opacity="0.9">${pulseAnim}</circle>
            <text x="${p.x}" y="${p.y + 4}" fill="#0b0e12" font-size="11" font-family="system-ui, sans-serif" text-anchor="middle" font-weight="700">${loc.emoji}</text>
            <text x="${p.x}" y="${p.y - r - 5}" fill="#c1cbe0" font-size="8.5" font-family="system-ui, sans-serif" text-anchor="middle">${loc.name}</text>
        </g>`;
    }).join('');

    const lockedNodes = locked.map(loc => {
        const p = LOCAL_POS[loc.id];
        if (!p) return '';
        return `<g>
            <circle cx="${p.x}" cy="${p.y}" r="9" fill="#2a3040" stroke="#1b2636" stroke-width="1" opacity="0.35"/>
            <text x="${p.x}" y="${p.y + 3}" fill="#4a5568" font-size="8" font-family="system-ui, sans-serif" text-anchor="middle">🔒</text>
            <text x="${p.x}" y="${p.y - 14}" fill="#4a5568" font-size="7.5" font-family="system-ui, sans-serif" text-anchor="middle">${loc.name}</text>
        </g>`;
    }).join('');

    let svgHTML = `<div class="settlement-svg-wrap">
        <svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block;background:#0b1020;border:1px solid #1b2636;border-radius:12px">
            <rect x="0" y="0" width="${w}" height="${h}" fill="#0b1020"/>
            ${lines}
            ${lockedNodes}
            ${unlockedNodes}
        </svg>
    </div>`;

    // --- Location Cards ---
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

    settlementBody.innerHTML = svgHTML + cardsHTML;

    // --- Event Listeners ---
    const svg = settlementBody.querySelector('svg');
    if (svg) {
        svg.querySelectorAll('g[data-location]').forEach(g => {
            g.addEventListener('click', () => {
                openLocation(g.getAttribute('data-location'));
            });
        });
    }

    settlementBody.querySelectorAll('.location-card[data-location]').forEach(card => {
        card.addEventListener('click', () => {
            openLocation(card.getAttribute('data-location'));
        });
    });
}

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

    // Render actions for this location
    if (locationActions) {
        renderLocationActions(locationId, locationActions);
    }

    // Show overlay
    locationOverlay.classList.remove('hidden');

    // Refresh settlement map to show current highlight
    renderSettlement();
}

export function closeLocation() {
    if (!locationOverlay) return;
    S.currentLocation = null;
    locationOverlay.classList.add('hidden');
    renderSettlement();
}

// Refresh the open location panel (for cooldown updates, etc.)
export function refreshOpenLocation() {
    if (S.currentLocation && locationActions && !locationOverlay?.classList.contains('hidden')) {
        renderLocationActions(S.currentLocation, locationActions);
    }
}
