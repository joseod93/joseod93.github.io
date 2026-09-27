// Gráfica de evolución de recursos (Estadísticas): pequeños múltiplos, uno por recurso.
// Cada mini-gráfica tiene su propia escala (leña y hierro tienen magnitudes muy distintas:
// nada de eje doble) y una sola serie, así que no hace falta leyenda ni distinguir colores.
// Luz y Sombra: El Alba de Hispania

import { formatNumber } from './utils.js';
import { RES_META } from './constants.js';

const H = 64;          // alto del trazado (px)
const PAD_Y = 6;

function agoLabel(ms) {
    const m = Math.round(ms / 60000);
    if (m <= 0) return 'ahora';
    if (m < 60) return `hace ${m} min`;
    const h = Math.floor(m / 60);
    return `hace ${h} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

// history: [{ t, r: {k: n}, rn }]  ->  series [{ key, icon, label, pts: [{t, v}] }]
function buildSeries(history) {
    const keys = new Set();
    history.forEach(h => Object.keys(h.r || {}).forEach(k => keys.add(k)));
    const series = [];
    for (const k of Object.keys(RES_META)) {
        if (!keys.has(k)) continue;
        const pts = history.map(h => ({ t: h.t, v: h.r?.[k] || 0 }));
        if (pts.every(p => p.v === 0)) continue;
        series.push({ key: k, icon: RES_META[k].icon, label: RES_META[k].label, pts });
    }
    const rn = history.map(h => ({ t: h.t, v: h.rn || 0 }));
    if (rn.some(p => p.v > 0)) series.unshift({ key: 'renown', icon: '⭐', label: 'Renombre', pts: rn });
    return series;
}

function sparkSVG(s, w, t0, t1) {
    const vals = s.pts.map(p => p.v);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi === lo) { lo -= 1; hi += 1; }
    const x = t => ((t - t0) / Math.max(1, t1 - t0)) * (w - 2) + 1;
    const y = v => H - PAD_Y - ((v - lo) / (hi - lo)) * (H - PAD_Y * 2);
    const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
    const area = `${d}L${x(s.pts[s.pts.length - 1].t).toFixed(1)},${H}L${x(s.pts[0].t).toFixed(1)},${H}Z`;
    const last = s.pts[s.pts.length - 1];
    return {
        svg: `<svg class="spark-svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" aria-hidden="true">
            <line class="spark-grid" x1="0" y1="${H - PAD_Y}" x2="${w}" y2="${H - PAD_Y}"/>
            <path class="spark-area" d="${area}"/>
            <path class="spark-line" d="${d}"/>
            <circle class="spark-end" cx="${x(last.t).toFixed(1)}" cy="${y(last.v).toFixed(1)}" r="3.5"/>
            <line class="spark-cross" x1="0" y1="0" x2="0" y2="${H}" visibility="hidden"/>
            <circle class="spark-dot" r="4" visibility="hidden"/>
        </svg>`,
        x, y, lo: Math.min(...vals), hi: Math.max(...vals),
    };
}

export function renderHistoryCharts(container, history) {
    if (!container) return;
    const hist = (history || []).filter(h => h && h.t);
    if (hist.length < 2) {
        container.innerHTML = '<p class="empty-hint">Juega unos minutos para ver cómo evolucionan tus recursos (se guarda una muestra por minuto).</p>';
        return;
    }
    const series = buildSeries(hist);
    const t0 = hist[0].t, t1 = hist[hist.length - 1].t;
    const nowTs = Date.now();

    container.innerHTML = `
        <div class="spark-head">
            <span>Últimas ${agoLabel(nowTs - t0).replace('hace ', '')}</span>
            <button class="chip spark-toggle" aria-pressed="false">Ver tabla</button>
        </div>
        <div class="spark-grid-wrap">${series.map(s => `
            <figure class="spark" data-key="${s.key}">
                <figcaption class="spark-cap">
                    <span class="spark-name">${s.icon} ${s.label}</span>
                    <span class="spark-now"></span>
                </figcaption>
                <div class="spark-plot" tabindex="0"></div>
                <div class="spark-foot"><span class="spark-range"></span><span class="spark-delta"></span></div>
                <div class="spark-tip" hidden></div>
            </figure>`).join('')}
        </div>
        <div class="spark-table-wrap" hidden></div>`;

    container.querySelectorAll('.spark').forEach(fig => {
        const s = series.find(x => x.key === fig.dataset.key);
        const plot = fig.querySelector('.spark-plot');
        const w = Math.max(120, Math.floor(plot.clientWidth || 160));
        const g = sparkSVG(s, w, t0, t1);
        plot.innerHTML = g.svg;
        const first = s.pts[0].v, last = s.pts[s.pts.length - 1].v, delta = last - first;
        fig.querySelector('.spark-now').textContent = formatNumber(Math.floor(last));
        fig.querySelector('.spark-range').textContent = `mín ${formatNumber(Math.floor(g.lo))} · máx ${formatNumber(Math.floor(g.hi))}`;
        const dEl = fig.querySelector('.spark-delta');
        dEl.textContent = delta === 0 ? '= 0' : `${delta > 0 ? '▲ +' : '▼ −'}${formatNumber(Math.abs(Math.round(delta)))}`;
        dEl.classList.add(delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat');
        plot.setAttribute('aria-label', `${s.label}: de ${Math.floor(first)} a ${Math.floor(last)} en el periodo`);

        // Cruceta + tooltip (ratón, dedo o teclado ← →)
        const svg = plot.querySelector('svg'), cross = svg.querySelector('.spark-cross'), dot = svg.querySelector('.spark-dot');
        const tip = fig.querySelector('.spark-tip');
        let idx = s.pts.length - 1;
        const show = (i) => {
            idx = Math.max(0, Math.min(s.pts.length - 1, i));
            const p = s.pts[idx], px = g.x(p.t), py = g.y(p.v);
            cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
            dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.setAttribute('visibility', 'visible');
            tip.hidden = false;
            tip.innerHTML = `<b>${formatNumber(Math.floor(p.v))}</b> ${s.icon}<br><small>${agoLabel(nowTs - p.t)}</small>`;
            const left = Math.min(Math.max(px, 40), w - 40);
            tip.style.left = `${left + plot.offsetLeft}px`;   // px es relativo al SVG; el tip, a la figura
        };
        const hide = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
        const nearest = (clientX) => {
            const r = svg.getBoundingClientRect();
            const t = t0 + ((clientX - r.left) / r.width) * (t1 - t0);
            let best = 0;
            s.pts.forEach((p, i) => { if (Math.abs(p.t - t) < Math.abs(s.pts[best].t - t)) best = i; });
            return best;
        };
        plot.addEventListener('pointermove', e => show(nearest(e.clientX)));
        plot.addEventListener('pointerdown', e => show(nearest(e.clientX)));
        plot.addEventListener('pointerleave', hide);
        plot.addEventListener('focus', () => show(idx));
        plot.addEventListener('blur', hide);
        plot.addEventListener('keydown', e => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); show(idx - 1); }
            if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); show(idx + 1); }
        });
    });

    // Vista en tabla (alternativa accesible): una fila cada ~10 min
    const tableWrap = container.querySelector('.spark-table-wrap');
    const toggle = container.querySelector('.spark-toggle');
    toggle.onclick = () => {
        const on = tableWrap.hidden;
        tableWrap.hidden = !on;
        container.querySelector('.spark-grid-wrap').hidden = on;
        toggle.textContent = on ? 'Ver gráficas' : 'Ver tabla';
        toggle.setAttribute('aria-pressed', String(on));
        toggle.classList.toggle('active', on);
        if (on && !tableWrap.innerHTML) {
            const step = Math.max(1, Math.round(hist.length / 12));
            const rows = hist.filter((_, i) => i % step === 0 || i === hist.length - 1);
            tableWrap.innerHTML = `<table class="spark-table">
                <thead><tr><th>Momento</th>${series.map(s => `<th title="${s.label}">${s.icon}</th>`).join('')}</tr></thead>
                <tbody>${rows.map(h => `<tr><td>${agoLabel(nowTs - h.t)}</td>${series.map(s => `<td>${formatNumber(Math.floor(s.key === 'renown' ? (h.rn || 0) : (h.r?.[s.key] || 0)))}</td>`).join('')}</tr>`).reverse().join('')}</tbody>
            </table>`;
        }
    };
}
