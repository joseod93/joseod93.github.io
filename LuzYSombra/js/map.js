
import { S, saveState } from './state.js';
import { REGIONS, REGION_POS, RES_META } from './constants.js';
import { getRandomPos, now, fmtMs, $ } from './utils.js';
import { log, updateTags, renderResources, renderNotes, addXP, xpFlash } from './ui.js';
import { vibrate } from './utils.js';

const mapBody = $('#mapBody');
const mapFooter = $('#mapFooter');

function regionPicker() {
    const unlocked = REGIONS.filter(r => (r.unlockDay || 1) <= S.time.day);
    const idx = Math.min(unlocked.length - 1, Math.floor(S.stats.renown / 5));
    const slice = unlocked.slice(0, Math.max(2, idx + 2));
    return slice[Math.floor(Math.random() * slice.length)];
}

function lootSummary(region) {
    return region.loot.map(l => {
        if (l.k === 'renown') return '⭐';
        const meta = RES_META[l.k];
        return meta ? meta.icon : l.k;
    }).join(' ');
}

export function renderMap() {
    if (!mapBody) return;
    const w = 310, h = 230;
    const unlocked = REGIONS.filter(r => (r.unlockDay || 1) <= S.time.day);
    const locked = REGIONS.filter(r => (r.unlockDay || 1) > S.time.day);

    // --- SVG Map ---
    const nodes = unlocked.map(r => {
        const p = REGION_POS[r.name] || { x: 150, y: 110 };
        const active = (!S.expedition && S.unlocked.expedition);
        const focused = (S.regionFocus === r.name);
        const isExpTarget = S.expedition && S.expedition.region === r.name;
        const fill = isExpTarget ? '#4dabf7' : focused ? '#ffe08a' : (active ? '#f2a65a' : '#6b7280');
        const stroke = isExpTarget ? '#228be6' : focused ? '#f59e0b' : '#1b2636';
        const radius = focused || isExpTarget ? 14 : 10;
        const pulseAnim = active && !isExpTarget ? `<animate attributeName="r" values="${radius};${radius+3};${radius}" dur="2s" repeatCount="indefinite"/>` : '';
        return `<g data-region="${r.name}" cursor="pointer">
            <circle cx="${p.x}" cy="${p.y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="2" opacity="0.9">${pulseAnim}</circle>
            <text x="${p.x}" y="${p.y - radius - 4}" fill="#c1cbe0" font-size="9" font-family="system-ui, sans-serif" text-anchor="middle">${r.emoji} ${r.name}</text>
        </g>`;
    }).join('');

    const lockedNodes = locked.map(r => {
        const p = REGION_POS[r.name] || { x: 150, y: 110 };
        return `<g>
            <circle cx="${p.x}" cy="${p.y}" r="7" fill="#2a3040" stroke="#1b2636" stroke-width="1" opacity="0.4"/>
            <text x="${p.x}" y="${p.y - 12}" fill="#4a5568" font-size="8" font-family="system-ui, sans-serif" text-anchor="middle">🔒 ${r.name}</text>
        </g>`;
    }).join('');

    // Connection lines between nearby regions
    const connections = [
        ['Huelva', 'Sevilla'], ['Sevilla', 'Córdoba'], ['Sevilla', 'Cádiz'],
        ['Córdoba', 'Jaén'], ['Jaén', 'Granada'], ['Granada', 'Almería'],
        ['Granada', 'Málaga'], ['Cádiz', 'Málaga'], ['Córdoba', 'Toledo'],
        ['Toledo', 'Madrid'], ['Madrid', 'Zaragoza'], ['Zaragoza', 'Barcelona'],
        ['Madrid', 'Valencia'], ['Valencia', 'Barcelona'], ['Bilbao', 'Zaragoza'],
        ['Santiago', 'Bilbao'], ['Huelva', 'Lisboa'], ['Almería', 'Roma'],
        ['Roma', 'Constantinopla']
    ];
    const lines = connections.map(([a, b]) => {
        const pa = REGION_POS[a]; const pb = REGION_POS[b];
        if (!pa || !pb) return '';
        return `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="#1b263688" stroke-width="1" stroke-dasharray="4,4"/>`;
    }).join('');

    // Animated expedition route
    let expRouteLine = '';
    if (S.expedition) {
        const homePos = REGION_POS['Sevilla'] || { x: 100, y: 120 };
        const targetPos = REGION_POS[S.expedition.region];
        if (targetPos) {
            expRouteLine = `<line x1="${homePos.x}" y1="${homePos.y}" x2="${targetPos.x}" y2="${targetPos.y}"
                stroke="#4dabf7" stroke-width="2" stroke-dasharray="6,4" opacity="0.7">
                <animate attributeName="stroke-dashoffset" values="0;-20" dur="1s" repeatCount="indefinite"/>
            </line>`;
        }
    }

    let svgHTML = `<div class="map-svg-wrap">
        <svg id="mapSvg" viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block;background:#0b1020;border:1px solid #1b2636;border-radius:12px">
            <rect x="0" y="0" width="${w}" height="${h}" fill="#0b1020"/>
            ${lines}
            ${expRouteLine}
            ${lockedNodes}
            ${nodes}
        </svg>
    </div>`;

    // --- Region Cards (mobile-friendly touch targets) ---
    let cardsHTML = '<div class="region-cards">';

    unlocked.forEach(r => {
        const focused = (S.regionFocus === r.name);
        const isExpTarget = S.expedition && S.expedition.region === r.name;
        const canSend = S.unlocked.expedition && !S.expedition;
        const remain = isExpTarget ? Math.max(0, S.expedition.endsAt - now()) : 0;
        const ready = isExpTarget && remain <= 0;

        let statusHTML = '';
        if (isExpTarget && remain > 0) {
            const pct = Math.min(100, ((now() - S.expedition.startedAt) / (S.expedition.endsAt - S.expedition.startedAt)) * 100);
            statusHTML = `<div class="region-status expedition">
                <div class="region-progress"><div class="region-progress-fill" style="width:${pct}%"></div></div>
                <span>En ruta ${fmtMs(remain)}</span>
            </div>`;
        } else if (ready) {
            statusHTML = `<div class="region-status ready">🎁 ¡Lista para reclamar!</div>`;
        }

        cardsHTML += `
        <div class="region-card ${focused ? 'focused' : ''} ${isExpTarget ? 'exp-active' : ''} ${canSend && !isExpTarget ? 'available' : ''}" data-region="${r.name}">
            <div class="region-card-header">
                <span class="region-card-name">${r.emoji} ${r.name}</span>
                <span class="region-card-loot">${lootSummary(r)}</span>
            </div>
            ${statusHTML}
            ${canSend && !isExpTarget ? `<button class="action region-send-btn" data-region="${r.name}">🗺️ Enviar expedición</button>` : ''}
        </div>`;
    });

    if (locked.length > 0) {
        cardsHTML += `<div class="region-card locked-card">
            <span style="color:#4a5568;font-size:0.82rem">🔒 ${locked.length} regiones por desbloquear (juega más días)</span>
        </div>`;
    }

    cardsHTML += '</div>';

    mapBody.innerHTML = svgHTML + cardsHTML;

    // --- Event listeners ---
    const svg = document.querySelector('#mapSvg');
    if (svg) {
        svg.querySelectorAll('g[data-region]').forEach(g => {
            g.addEventListener('click', () => handleRegionClick(g.getAttribute('data-region')));
        });
    }

    mapBody.querySelectorAll('.region-card[data-region]').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.region-send-btn')) return;
            handleRegionClick(card.getAttribute('data-region'));
        });
    });

    mapBody.querySelectorAll('.region-send-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const regionName = btn.getAttribute('data-region');
            sendExpedition(regionName);
        });
    });

    // --- Footer ---
    if (mapFooter) {
        if (S.unlocked.expedition && !S.expedition && S.regionFocus) {
            updateBodyBg(S.regionFocus);
            mapFooter.innerHTML = `<button id="mapExpBtn" class="action glow-btn" style="width:100%">🗺️ Expedición a ${S.regionFocus}</button>`;
            const btn = document.querySelector('#mapExpBtn');
            if (btn) btn.onclick = () => sendExpedition(S.regionFocus);
        } else if (S.expedition) {
            const remain = S.expedition.endsAt - now();
            mapFooter.textContent = remain > 0 ? `Expedición: ${S.expedition.region} (${fmtMs(remain)})` : '🎁 Expedición lista — reclama en Aldea';
        } else {
            mapFooter.textContent = S.unlocked.expedition ? 'Toca una región para enviar expedición.' : 'Desbloquea expediciones explorando.';
        }
    }
}

function handleRegionClick(regionName) {
    const region = REGIONS.find(r => r.name === regionName);
    if (!region) return;

    if (S.unlocked.expedition && !S.expedition) {
        S.regionFocus = region.name;
        saveState();
        renderMap();
    } else {
        S.regionFocus = region.name;
        log(`Región: ${region.name} — ${region.events[0]}`, 'dim');
        saveState();
        renderMap();
    }
}

function sendExpedition(regionName) {
    const region = REGIONS.find(r => r.name === regionName) || regionPicker();
    const dur = (3 + Math.floor(Math.random() * 6)) * 60 * 1000;
    S.expedition = { endsAt: now() + dur, startedAt: now(), region: region.name };
    S.regionFocus = region.name;
    log(`${region.emoji} Expedición hacia ${region.name}.`, 'warn');
    addXP(5); xpFlash();
    vibrate(40);
    updateTags(); saveState(); renderMap(); renderNotes();
    window.dispatchEvent(new CustomEvent('lys-actions-refresh'));
}

function updateBodyBg(regionName) {
    document.body.classList.remove('bg-sevilla', 'bg-granada', 'bg-cadiz', 'bg-almeria', 'bg-norte', 'bg-europa', 'time-morning', 'time-afternoon', 'time-sunset', 'time-night');
    const key = regionName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (['sevilla', 'jaen', 'cordoba'].includes(key)) document.body.classList.add('bg-sevilla');
    else if (['granada', 'malaga', 'valencia'].includes(key)) document.body.classList.add('bg-granada');
    else if (['cadiz', 'huelva', 'lisboa'].includes(key)) document.body.classList.add('bg-cadiz');
    else if (['almeria'].includes(key)) document.body.classList.add('bg-almeria');
    else if (['bilbao', 'santiago', 'zaragoza'].includes(key)) document.body.classList.add('bg-norte');
    else if (['barcelona', 'roma', 'constantinopla', 'madrid', 'toledo'].includes(key)) document.body.classList.add('bg-europa');
}

export function getRandomRegion() {
    return regionPicker();
}
