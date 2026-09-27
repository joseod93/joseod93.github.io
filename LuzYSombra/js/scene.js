// Escena viva de la aldea: ilustración SVG que refleja el estado real de la partida
// (fogata, casas = aldeanos, edificios con nivel, hora del día, estación y clima).
// Tocar un elemento abre su lugar. Se redibuja solo cuando cambia su firma (dirty-check).
// Luz y Sombra: El Alba de Hispania

import { S } from './state.js';
import { seasonOf } from './constants.js';
import { prefersReducedMotion } from './utils.js';

const W = 360, H = 150, GROUND = 112;

function phase() {
    const h = Math.floor((S.time.minutes % 1440) / 60);
    if (h >= 6 && h < 12) return 'morning';
    if (h >= 12 && h < 19) return 'day';
    if (h >= 19 && h < 23) return 'dusk';
    return 'night';
}

const SKY = {
    morning: ['#f7c68a', '#8fb8de'],
    day: ['#9dd0f2', '#5a9fd6'],
    dusk: ['#f09a6b', '#5b4a7a'],
    night: ['#1a2447', '#070b18'],
};
const GROUND_COLORS = {
    primavera: ['#6aa84f', '#4d8a3a'],
    verano: ['#b9a44c', '#958338'],
    otono: ['#b7773b', '#8f5a2b'],
    invierno: ['#e6edf5', '#c3cfdc'],
};

// Posiciones fijas (x) de hasta 8 casas, de dentro afuera respecto a la fogata
const HOUSE_X = [128, 214, 100, 242, 72, 270, 46, 296];

function house(x, i, snow, lit) {
    const w = 26, h = 18, y = GROUND - h;
    const roof = snow ? '#f4f7fb' : ['#a64b2a', '#8e3f24', '#b35a31'][i % 3];
    const win = lit ? '#ffd27a' : '#3a2c22';
    return `<g class="sc-house" data-loc="aldea">
        <rect x="${x - w / 2}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="#d9c3a0" stroke="#6b5438" stroke-width="1"/>
        <path d="M${x - w / 2 - 3},${y + 1} L${x},${y - 12} L${x + w / 2 + 3},${y + 1} Z" fill="${roof}" stroke="#5a3a26" stroke-width="1"/>
        <rect x="${x - 3}" y="${y + 8}" width="6" height="10" fill="#6b4a2e"/>
        <rect x="${x + 5}" y="${y + 5}" width="5" height="5" fill="${win}"/>
    </g>`;
}

function fire(x) {
    const lit = S.fire.lit && S.fire.heat > 0;
    const heat = Math.max(0, Math.min(30, S.fire.heat || 0));
    const s = lit ? 0.7 + heat / 30 * 0.8 : 0;
    const anim = !prefersReducedMotion();
    return `<g class="sc-fire" data-loc="campamento">
        <rect x="${x - 14}" y="${GROUND - 12}" width="28" height="24" fill="transparent"/>
        <ellipse cx="${x}" cy="${GROUND + 1}" rx="12" ry="3" fill="#00000033"/>
        <path d="M${x - 10},${GROUND} L${x + 10},${GROUND - 4} M${x - 10},${GROUND - 4} L${x + 10},${GROUND}" stroke="#5a3a1e" stroke-width="3" stroke-linecap="round"/>
        ${lit ? `
        <circle cx="${x}" cy="${GROUND - 8}" r="${18 * s}" fill="url(#scGlow)" opacity="${0.5 + heat / 60}"/>
        <g transform="translate(${x} ${GROUND - 2}) scale(${s})">
            <path class="${anim ? 'sc-flame' : ''}" d="M0,0 C-8,-6 -6,-14 -1,-22 C0,-15 5,-14 4,-8 C7,-11 7,-15 6,-17 C11,-10 9,-2 0,0 Z" fill="#ff8a2a"/>
            <path class="${anim ? 'sc-flame sc-flame2' : ''}" d="M0,0 C-4,-4 -3,-9 0,-13 C1,-9 4,-7 3,-3 C4,-4 5,-6 5,-7 C6,-3 4,-1 0,0 Z" fill="#ffd45a"/>
        </g>` : `<path d="M${x - 2},${GROUND - 6} q-3,-6 2,-10 q-2,5 3,7" fill="none" stroke="#9aa3ad" stroke-width="1.2" opacity=".6"/>`}
    </g>`;
}

function mill(x, lvl) {
    const anim = !prefersReducedMotion();
    return `<g class="sc-bld" data-loc="taller">
        <path d="M${x - 11},${GROUND} L${x - 7},${GROUND - 34} L${x + 7},${GROUND - 34} L${x + 11},${GROUND} Z" fill="#e8dcc4" stroke="#6b5438"/>
        <path d="M${x - 9},${GROUND - 34} L${x},${GROUND - 44} L${x + 9},${GROUND - 34} Z" fill="#8e3f24"/>
        <g transform="translate(${x} ${GROUND - 34})"><g class="${anim ? 'sc-blades' : ''}">
            ${[0, 90, 180, 270].map(a => `<rect x="-2" y="-24" width="4" height="22" rx="1" fill="#f3ead6" stroke="#6b5438" stroke-width=".8" transform="rotate(${a})"/>`).join('')}
            <circle r="3" fill="#6b5438"/>
        </g></g>
        ${lvl > 1 ? `<text x="${x}" y="${GROUND + 12}" class="sc-lvl">Nv ${lvl}</text>` : ''}
    </g>`;
}

function forge(x, lvl) {
    return `<g class="sc-bld" data-loc="taller">
        <rect x="${x - 15}" y="${GROUND - 20}" width="30" height="20" fill="#7a7f87" stroke="#44484e"/>
        <rect x="${x + 5}" y="${GROUND - 32}" width="6" height="14" fill="#5a5f66"/>
        <rect x="${x - 9}" y="${GROUND - 12}" width="10" height="8" rx="1" fill="#ff8a2a" opacity=".9"/>
        <path d="M${x - 17},${GROUND - 20} L${x},${GROUND - 28} L${x + 17},${GROUND - 20} Z" fill="#4b4f55"/>
        ${lvl > 1 ? `<text x="${x}" y="${GROUND + 12}" class="sc-lvl">Nv ${lvl}</text>` : ''}
    </g>`;
}

function trees(season, anim) {
    const leaf = { primavera: '#4f9a3c', verano: '#3f7f33', otono: '#c8702c', invierno: '#dfe7ef' }[season];
    const blossom = season === 'primavera';
    const pos = [[18, 1], [40, .8], [332, .9], [352, 1.1]];
    return pos.map(([x, s]) => `<g class="sc-tree" data-loc="bosque" transform="translate(${x} ${GROUND}) scale(${s})">
        <rect x="-2" y="-14" width="4" height="14" fill="#6b4a2e"/>
        <path d="M0,-40 L-12,-12 L12,-12 Z" fill="${leaf}"/>
        <path d="M0,-50 L-9,-26 L9,-26 Z" fill="${leaf}" opacity=".92"/>
        ${blossom ? '<circle cx="-4" cy="-22" r="1.6" fill="#f7b6d2"/><circle cx="4" cy="-30" r="1.6" fill="#f7b6d2"/><circle cx="2" cy="-16" r="1.4" fill="#fff"/>' : ''}
    </g>`).join('');
}

function signature() {
    const season = seasonOf(S.time.day).key;
    return [
        phase(), season, S.weather,
        S.fire.lit ? Math.round(S.fire.heat / 5) : 'off',
        Math.min(8, S.people.villagers || 0),
        S.buildings?.molino || 0, S.buildings?.acequia || 0, S.buildings?.forge || 0,
        !!S.unlocked.water, !!S.threat, prefersReducedMotion() ? 'r' : '',
    ].join('|');
}

export function renderScene(el) {
    if (!el) return;
    const sig = signature();
    if (el.dataset.sig === sig) return;
    el.dataset.sig = sig;

    const ph = phase();
    const season = seasonOf(S.time.day).key;
    const snow = season === 'invierno';
    const night = ph === 'night' || ph === 'dusk';
    const [sky1, sky2] = SKY[ph];
    const [g1, g2] = GROUND_COLORS[season];
    const anim = !prefersReducedMotion();
    const villagers = Math.min(8, S.people.villagers || 0);
    const b = S.buildings || {};
    const fireX = 180;

    const stars = ph === 'night'
        ? Array.from({ length: 18 }, (_, i) => `<circle cx="${(i * 67 + 13) % W}" cy="${(i * 29 + 7) % 60 + 4}" r="${i % 3 ? .8 : 1.2}" fill="#fff" opacity="${.4 + (i % 4) * .15}"/>`).join('')
        : '';
    const celestial = ph === 'night'
        ? `<circle cx="300" cy="26" r="11" fill="#f4f1e2"/><circle cx="305" cy="22" r="10" fill="${sky1}"/>`
        : `<circle cx="${ph === 'morning' ? 60 : ph === 'dusk' ? 300 : 180}" cy="${ph === 'day' ? 22 : 40}" r="13" fill="${ph === 'dusk' ? '#ffb070' : '#ffe38a'}"/>`;
    const rain = S.weather === 'rain'
        ? `<g class="${anim ? 'sc-rain' : ''}" opacity=".55">${Array.from({ length: 40 }, (_, i) => `<line x1="${(i * 37) % W}" y1="${(i * 23) % GROUND}" x2="${(i * 37) % W - 3}" y2="${(i * 23) % GROUND + 8}" stroke="#bcd7f0" stroke-width="1"/>`).join('')}</g>`
        : '';
    const snowflakes = snow && S.weather !== 'rain'
        ? `<g class="${anim ? 'sc-snow' : ''}">${Array.from({ length: 26 }, (_, i) => `<circle cx="${(i * 41) % W}" cy="${(i * 17) % GROUND}" r="${1 + (i % 2) * .6}" fill="#fff" opacity=".8"/>`).join('')}</g>`
        : '';
    const leaves = season === 'otono'
        ? Array.from({ length: 10 }, (_, i) => `<ellipse cx="${(i * 53 + 20) % W}" cy="${GROUND + 6 + (i % 3) * 6}" rx="2.4" ry="1.2" fill="${i % 2 ? '#d9822b' : '#a8531f'}" transform="rotate(${i * 37} ${(i * 53 + 20) % W} ${GROUND + 6 + (i % 3) * 6})"/>`).join('')
        : '';
    const flowers = season === 'primavera'
        ? Array.from({ length: 14 }, (_, i) => `<circle cx="${(i * 47 + 9) % W}" cy="${GROUND + 8 + (i % 3) * 8}" r="1.6" fill="${['#f7b6d2', '#fff4a3', '#fff'][i % 3]}"/>`).join('')
        : '';

    const river = S.unlocked.water
        ? `<g class="sc-river" data-loc="rio"><path d="M0,${GROUND + 26} C80,${GROUND + 18} 150,${GROUND + 34} 230,${GROUND + 24} S330,${GROUND + 20} ${W},${GROUND + 28} L${W},${GROUND + 36} C300,${GROUND + 30} 250,${GROUND + 38} 180,${GROUND + 34} S60,${GROUND + 30} 0,${GROUND + 36} Z" fill="${snow ? '#b9d4ea' : '#4a8fc7'}" opacity=".9"/></g>`
        : '';
    const acequia = b.acequia > 0
        ? `<g class="sc-bld" data-loc="rio"><path d="M200,${GROUND + 4} L250,${GROUND + 4} L262,${GROUND + 24}" fill="none" stroke="#7a8a96" stroke-width="5" stroke-linecap="round"/><path d="M200,${GROUND + 4} L250,${GROUND + 4} L262,${GROUND + 24}" fill="none" stroke="#6fb3e8" stroke-width="2.4" stroke-linecap="round"/></g>`
        : '';

    const houses = HOUSE_X.slice(0, villagers).map((x, i) => house(x, i, snow, night)).join('');
    const threat = S.threat
        ? `<g class="sc-threat" data-loc="combat"><circle cx="336" cy="${GROUND - 60}" r="9" fill="#ff5b5b" opacity=".85"/><text x="336" y="${GROUND - 56}" text-anchor="middle" font-size="11">👁️</text></g>`
        : '';

    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${sceneLabel(ph, season, villagers)}">
        <defs>
            <linearGradient id="scSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky2}"/><stop offset="1" stop-color="${sky1}"/></linearGradient>
            <linearGradient id="scGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${g1}"/><stop offset="1" stop-color="${g2}"/></linearGradient>
            <radialGradient id="scGlow"><stop offset="0" stop-color="#ffb347" stop-opacity=".9"/><stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#scSky)"/>
        ${stars}${celestial}
        <path d="M0,${GROUND - 22} C60,${GROUND - 46} 120,${GROUND - 20} 180,${GROUND - 38} S300,${GROUND - 24} ${W},${GROUND - 42} L${W},${GROUND} L0,${GROUND} Z" fill="${snow ? '#cfd9e4' : '#00000022'}" opacity="${night ? .55 : .35}"/>
        <rect y="${GROUND}" width="${W}" height="${H - GROUND}" fill="url(#scGround)"/>
        ${flowers}${leaves}${river}${acequia}
        ${trees(season, anim)}
        ${b.molino > 0 ? mill(66, b.molino) : ''}
        ${b.forge > 0 ? forge(306, b.forge) : ''}
        ${houses}
        ${fire(fireX)}
        ${threat}
        ${rain}${snowflakes}
        ${night ? `<rect width="${W}" height="${H}" fill="#0a1030" opacity="${ph === 'night' ? .28 : .12}" pointer-events="none"/>` : ''}
    </svg>`;
}

function sceneLabel(ph, season, villagers) {
    const hora = { morning: 'mañana', day: 'mediodía', dusk: 'atardecer', night: 'noche' }[ph];
    return `Tu aldea en ${seasonOf(S.time.day).name.toLowerCase()}, de ${hora}: ${villagers} casas, fogata ${S.fire.lit ? 'encendida' : 'apagada'}.`;
}

// Tocar un elemento de la escena abre su lugar (si está desbloqueado; openLocation lo comprueba)
export function bindScene(el) {
    if (!el || el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener('click', (e) => {
        const g = e.target.closest('[data-loc]');
        if (!g) return;
        if (g.dataset.loc === 'combat') window.dispatchEvent(new CustomEvent('lys-open-combat'));
        else window.dispatchEvent(new CustomEvent('lys-open-location', { detail: g.dataset.loc }));
    });
}
