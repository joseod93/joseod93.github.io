
import { S, saveState } from './state.js';
import { REGIONS, REGION_POS } from './constants.js';
import { getRandomPos, now, fmtMs, $ } from './utils.js';
import { log, updateTags, renderResources, renderNotes } from './ui.js'; // renderResources needed? maybe

const mapBody = $('#mapBody');
const mapFooter = $('#mapFooter');

function regionPicker() {
    // Pondera por renombre para abrir variedad
    const unlocked = REGIONS.filter(r => (r.unlockDay || 1) <= S.time.day);
    const idx = Math.min(unlocked.length - 1, Math.floor(S.stats.renown / 5));
    const slice = unlocked.slice(0, Math.max(2, idx + 2));
    return slice[Math.floor(Math.random() * slice.length)];
}

export function renderMap() {
    if (!mapBody) return;
    const w = 300, h = 220;
    const unlocked = REGIONS.filter(r => (r.unlockDay || 1) <= S.time.day);

    // We don't really use "placed" array logic from original code as it was mapping over unlocked directly
    const nodes = unlocked.map(r => {
        const p = REGION_POS[r.name] || { x: 10 + Math.random() * 280, y: 10 + Math.random() * 200 }; // Fallback (should have pos)
        const active = (!S.expedition && S.unlocked.expedition);
        const focused = (S.regionFocus === r.name);
        const fill = focused ? '#ffe08a' : (active ? '#f2a65a' : '#6b7280');
        const stroke = focused ? '#f59e0b' : '#1b2636';
        const radius = focused ? 12 : 10;
        return `<g data-region="${r.name}" cursor="pointer">
        <circle cx="${p.x}" cy="${p.y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="2" />
        <text x="${p.x + 12}" y="${p.y + 4}" fill="#e9f0ff" font-size="10" font-family="Segoe UI, Arial">${r.emoji} ${r.name}</text>
      </g>`;
    }).join('');

    mapBody.innerHTML = `<svg id="mapSvg" viewBox="0 0 ${w} ${h}" width="100%" height="350px" style="background:#0b1020;border:1px solid #1b2636;border-radius:8px">
      <rect x="0" y="0" width="${w}" height="${h}" fill="#0b1020"/>
      ${nodes}
    </svg>`;

    const svg = document.querySelector('#mapSvg');
    if (svg) {
        svg.querySelectorAll('g[data-region]').forEach(g => {
            g.addEventListener('click', () => {
                const regionName = g.getAttribute('data-region');
                const region = REGIONS.find(r => r.name === regionName);
                if (!region) return;
                // Si hay expedición desbloqueada y libre, permitir organizar desde el mapa
                if (S.unlocked.expedition && !S.expedition) {
                    const dur = (3 + Math.floor(Math.random() * 6)) * 60 * 1000;
                    S.expedition = { endsAt: now() + dur, startedAt: now(), region: region.name };
                    log(`${region.emoji} Expedición organizada hacia ${region.name} desde el mapa.`, 'warn');
                    updateTags(); saveState(); renderMap(); renderNotes();
                    window.dispatchEvent(new CustomEvent('lys-actions-refresh'));
                } else {
                    S.regionFocus = region.name;
                    log(`Región enfocada: ${region.name}.`, 'dim');
                    saveState(); renderMap();
                }
            });
        });
    }

    if (mapFooter) {
        if (S.unlocked.expedition && !S.expedition && S.regionFocus) {
            // Update Body Background
            if (S.regionFocus) {
                document.body.className = ''; // clear
                const key = S.regionFocus.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                // Map known regions to classes, default fallback
                if (['sevilla', 'jaen', 'cordoba'].includes(key)) document.body.classList.add('bg-sevilla'); // Green/Forest
                else if (['granada', 'malaga'].includes(key)) document.body.classList.add('bg-granada'); // Red/Mountain
                else if (['cadiz', 'huelva'].includes(key)) document.body.classList.add('bg-cadiz'); // Blue/Coast
                else if (['almeria'].includes(key)) document.body.classList.add('bg-almeria'); // Orange/Desert
            }

            mapFooter.innerHTML = `<button id="mapExpBtn" class="action" style="width:auto">Organizar expedición a ${S.regionFocus}</button>`;
            const btn = document.querySelector('#mapExpBtn');
            if (btn) {
                btn.onclick = () => {
                    const region = REGIONS.find(r => r.name === S.regionFocus) || regionPicker();
                    const dur = (3 + Math.floor(Math.random() * 6)) * 60 * 1000;
                    S.expedition = { endsAt: now() + dur, startedAt: now(), region: region.name };
                    log(`${region.emoji} Expedición organizada hacia ${region.name}.`, 'warn');
                    updateTags(); saveState(); renderMap();
                    window.dispatchEvent(new CustomEvent('lys-actions-refresh'));
                };
            }
        } else if (S.expedition) {
            const remain = S.expedition.endsAt - now();
            mapFooter.textContent = remain > 0 ? `Expedición en curso: ${S.expedition.region} (${fmtMs(remain)})` : 'Expedición lista para reclamar en Acciones';
        } else {
            mapFooter.textContent = S.unlocked.expedition ? 'Selecciona una región para enviar una expedición.' : 'Desbloquea expediciones explorando.';
        }
    }
}

export function getRandomRegion() {
    return regionPicker();
}
