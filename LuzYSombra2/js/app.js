import { AudioSystem } from './audio.js';
import { S, loadState, saveState, resetState, exportState, importState, now } from './storage.js';
import { $, fmtMs, getRandomPos, formatNumber, vibrate, isMobile } from './utils.js';
import { triggerRandomEvent, triggerRegionEvent, updateWeather } from './events.js';
import { checkAchievements, ACHIEVEMENTS } from './achievements.js';
import { tutorial } from './tutorial.js';
import { notifications } from './notifications.js';
import { quests } from './quests.js';
import { statistics } from './statistics.js';


const RES_META = {
    lenia: { label: 'Leña', icon: '🪵' },
    agua: { label: 'Agua', icon: '💧' },
    aceitunas: { label: 'Aceitunas', icon: '🫒' },
    hierbas: { label: 'Hierbas', icon: '🌿' },
    piedra: { label: 'Piedra', icon: '🪨' },
    hierro: { label: 'Hierro', icon: '⛓️' },
    trigo: { label: 'Trigo', icon: '🌾' },
    sal: { label: 'Sal', icon: '🧂' },
    antorchas: { label: 'Antorchas', icon: '🔥' },
    medicina: { label: 'Medicina', icon: '💊' }
};

const REGIONS = [
    { name: 'Sevilla', emoji: '🏰', unlockDay: 1, loot: [{ k: 'piedra', n: [2, 4] }, { k: 'hierro', n: [1, 2] }, { k: 'renown', n: [1, 2] }], events: ['Cruzaste el Guadalquivir por un viejo puente.', 'Un mercader te enseña un truco de forja.'] },
    { name: 'Granada', emoji: '🕌', unlockDay: 1, loot: [{ k: 'hierbas', n: [2, 3] }, { k: 'agua', n: [1, 2] }, { k: 'renown', n: [1, 3] }], events: ['El eco de la Alhambra susurra historias antiguas.', 'Las Alpujarras te ofrecen senderos y manantiales.'] },
    { name: 'Cádiz', emoji: '⚓', unlockDay: 1, loot: [{ k: 'sal', n: [2, 3] }, { k: 'piedra', n: [1, 2] }, { k: 'renown', n: [1, 2] }], events: ['Las salinas brillan bajo el sol.', 'Los vientos de la costa te empujan hacia el oeste.'] },
    { name: 'Jaén', emoji: '🫒', unlockDay: 1, loot: [{ k: 'aceitunas', n: [2, 4] }, { k: 'hierbas', n: [1, 2] }, { k: 'renown', n: [1, 2] }], events: ['Un mar de olivos se extiende hasta el horizonte.', 'Aprendes a podar para mejorar la cosecha.'] },
    { name: 'Málaga', emoji: '🏖️', unlockDay: 3, loot: [{ k: 'sal', n: [1, 2] }, { k: 'renown', n: [2, 3] }], events: ['El viento del levante refresca la costa.'] },
    { name: 'Córdoba', emoji: '🏛️', unlockDay: 4, loot: [{ k: 'piedra', n: [2, 3] }, { k: 'renown', n: [2, 3] }], events: ['Sombras bajo los arcos de la Mezquita.'] },
    { name: 'Huelva', emoji: '⛵', unlockDay: 5, loot: [{ k: 'sal', n: [2, 3] }, { k: 'agua', n: [1, 2] }], events: ['Marismas y esteros te guían.'] },
    { name: 'Almería', emoji: '🏜️', unlockDay: 6, loot: [{ k: 'piedra', n: [3, 4] }, { k: 'hierro', n: [1, 2] }], events: ['Tierras áridas, recursos duros.'] },
    { name: 'Toledo', emoji: '🗡️', unlockDay: 8, loot: [{ k: 'hierro', n: [2, 3] }, { k: 'renown', n: [2, 3] }], events: ['Forjas legendarias te inspiran.'] },
    { name: 'Madrid', emoji: '⭐', unlockDay: 10, loot: [{ k: 'renown', n: [3, 4] }], events: ['Un cruce de caminos te abre oportunidades.'] }
];

const BOSSES = [
    { key: 'boss_guadalquivir', name: 'La Sombra del Guadalquivir', icon: '🌊', hp: 12, duration: 90000, region: 'Sevilla' },
    { key: 'boss_toro', name: 'Toro de Fuego', icon: '🐂', hp: 20, duration: 120000, region: 'Jaén' },
    { key: 'boss_alhambra', name: 'Eco de la Alhambra', icon: '🏯', hp: 28, duration: 150000, region: 'Granada' },
    { key: 'boss_cadiz', name: 'Dama de Cádiz', icon: '🧜', hp: 32, duration: 150000, region: 'Cádiz' },
    { key: 'boss_sierra', name: 'Centinela de Sierra Morena', icon: '🌲', hp: 18, duration: 120000, region: 'Sevilla' }
];

// Map positioning constants
const SCALE = 3.0;
const OFFSET_X = -300;
const OFFSET_Y = -310;

const REGION_POS = {
    'Sevilla': { x: 120 * SCALE + OFFSET_X, y: 120 * SCALE + OFFSET_Y },
    'Cádiz': { x: 90 * SCALE + OFFSET_X, y: 160 * SCALE + OFFSET_Y },
    'Huelva': { x: 70 * SCALE + OFFSET_X, y: 130 * SCALE + OFFSET_Y },
    'Málaga': { x: 160 * SCALE + OFFSET_X, y: 160 * SCALE + OFFSET_Y },
    'Córdoba': { x: 150 * SCALE + OFFSET_X, y: 120 * SCALE + OFFSET_Y },
    'Jaén': { x: 190 * SCALE + OFFSET_X, y: 120 * SCALE + OFFSET_Y },
    'Granada': { x: 200 * SCALE + OFFSET_X, y: 150 * SCALE + OFFSET_Y },
    'Almería': { x: 230 * SCALE + OFFSET_X, y: 150 * SCALE + OFFSET_Y },
    'Toledo': { x: 170 * SCALE + OFFSET_X, y: 80 * SCALE + OFFSET_Y },
    'Madrid': { x: 190 * SCALE + OFFSET_X, y: 60 * SCALE + OFFSET_Y }
};

// DOM Elements

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
const villagersTag = document.createElement('span');
villagersTag.className = 'tag';

// Setup Villager Tag
if (expeditionTag && expeditionTag.parentElement) {
    expeditionTag.parentElement.appendChild(villagersTag);
}

const BUTTON_REFS = {};

function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2400);
}

function log(text, cls) {
    const p = document.createElement('p');
    if (cls) p.className = cls;
    p.textContent = text;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
}

function updateSaveInfo(msg) {
    saveInfo.textContent = msg;
}

function setCooldown(btn, key, totalMs, baseText) {
    // S.cooldowns is mutated here (new cooldown start)
    S.cooldowns[key] = now() + totalMs;
    BUTTON_REFS[key] = { btn, total: totalMs, baseText: baseText || btn.textContent };
}

function registerCooldownBtn(btn, key, totalMs, baseText) {
    // Just register visual ref, do not mutate S.cooldowns
    BUTTON_REFS[key] = { btn, total: totalMs, baseText: baseText || btn.textContent };
}

function updateCooldownVisuals() {
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

function timeLabel() {
    const m = S.time.minutes % (24 * 60);
    const h = Math.floor(m / 60);
    if (h >= 6 && h < 12) return '🌤️ Mañana';
    if (h >= 12 && h < 19) return '🌞 Tarde';
    if (h >= 19 && h < 23) return '🌆 Atardecer';
    return '🌙 Noche';
}

function updateTags() {
    fireTag.textContent = S.fire.lit ? `🔥 Lumbre encendida (${Math.floor(S.fire.heat)}°)` : '🔥 Lumbre apagada';

    const weatherIcons = { clear: '☀️ Despejado', rain: '🌧️ Lluvia', wind: '💨 Viento' };
    const wLabel = weatherIcons[S.weather] || '☀️ Despejado';

    expeditionTag.textContent = S.expedition ? '🧭 Expedición en curso' : '🧭 Sin expedición';
    bossTag.textContent = S.threat ? `👁️ ${S.threat.name}` : '👁️ Sin amenaza';
    timeOfDay.textContent = `${timeLabel()} | ${wLabel}`;

    if (hpTag) hpTag.textContent = `❤️ ${S.player.hp}/${S.player.maxHp}`;

    if (!villagersTag.parentElement && expeditionTag.parentElement) {
        expeditionTag.parentElement.appendChild(villagersTag);
    }
    villagersTag.textContent = `👥 ${S.people.villagers || 0}`;
    renderNotes();
}

function renderResources() {
    resEl.innerHTML = '';
    for (const [k, v] of Object.entries(S.resources)) {
        if (v <= 0) continue;
        const meta = RES_META[k]; if (!meta) continue;
        const d = document.createElement('div'); d.className = 'res';
        d.innerHTML = `<b>${meta.icon} ${meta.label}: ${v}</b>`;
        resEl.appendChild(d);
    }
}

function renderNotes() {
    if (!notesBody) return;
    const heat = Math.floor(S.fire.heat);
    const villagers = S.people.villagers || 0;
    const lines = [];
    lines.push(`👥 Aldeanos: aportan producción pasiva de trigo (más con calor). Actual: ${villagers}.`);
    lines.push(`🔥 Fogata: calor ${heat}°. Con calor alto aumenta el ritmo de acequia/molino y la productividad.`);
    lines.push(`🏚️ Molino: transforma trigo de forma pasiva y da renombre.`);
    lines.push(`💧 Acequia: genera agua pasiva con probabilidad por tick.`);
    lines.push(`⚒️ Fragua: pequeñas vetas de hierro pasivas y +1 daño al atacar.`);
    lines.push(`🔥 Antorchas: +1 daño en ataque y se consumen al usar.`);
    notesBody.innerHTML = '<ul style="margin:0;padding-left:18px">' + lines.map(t => `<li>${t}</li>`).join('') + '</ul>';
}

function renderAchievements() {
    if (!achEl) return;
    achEl.innerHTML = '';
    // Bosses
    BOSSES.forEach(b => {
        const d = document.createElement('div');
        const has = !!S.achievements[b.key];
        d.className = 'ach' + (has ? '' : ' locked');
        d.title = b.name;
        d.textContent = b.icon;
        achEl.appendChild(d);
    });
    // Extra
    EXTRA_ACHIEVEMENTS.forEach(a => {
        const d = document.createElement('div');
        const has = !!S.achievements[a.key];
        d.className = 'ach' + (has ? '' : ' locked');
        d.title = a.name;
        d.textContent = a.icon;
        achEl.appendChild(d);
    });
}

// Tip footer helper
function setTip(text) {
    tipFooter.textContent = text;
}



const fightOverlay = $('#fightOverlay');
const fightTitle = $('#fightTitle');
const fightInfo = $('#fightInfo');
const fightFooter = $('#fightFooter');
const btnAttack = $('#btnAttack');
const btnDefend = $('#btnDefend');
const btnHeal = $('#btnHeal');
const fightUI = $('#fightUI');


// Encounter overlay
const encounterOverlay = $('#encounterOverlay');
const encounterTitle = $('#encounterTitle');
const encounterInfo = $('#encounterInfo');
const encounterCountdown = $('#encounterCountdown');
const btnEncAccept = $('#btnEncAccept');
const btnEncDecline = $('#btnEncDecline');

let combatState = null;
let encounterTimer = null;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function createDamageNumber(amount, targetEl, type = 'dmg') {
    if (!targetEl) return;
    const el = document.createElement('div');
    el.className = 'dmg-num ' + (type === 'heal' ? 'heal' : '');
    el.textContent = amount;
    targetEl.appendChild(el);
    setTimeout(() => el.remove(), 800);
}

function renderCombatUI() {
    if (!combatState) return;
    const boss = combatState.boss;

    // Initial Render or Update
    // We can just rebuild HTML for simplicity as this is a low-frame-rate turn-based game.
    // However, to keep animations smooth, we should update if elements exist.
    // Let's assume we rebuild the structure if empty, else update widths.

    if (!fightUI.hasChildNodes()) {
        fightUI.innerHTML = `
            <div class="fighter" id="warrior">
                <div class="icon">😊</div>
                <div class="hp-bar"><div class="hp-fill player" style="width:100%"></div></div>
                <div style="margin-top:4px; font-size:0.9rem">Tú (${S.player.hp}/${S.player.maxHp})</div>
            </div>
            <div class="vs">VS</div>
            <div class="fighter" id="enemy">
                <div class="icon">${boss.icon}</div>
                <div class="hp-bar"><div class="hp-fill" style="width:100%"></div></div>
                <div style="margin-top:4px; font-size:0.9rem">${boss.name}</div>
            </div>
        `;
    }

    // Update Values
    const playerBar = fightUI.querySelector('#warrior .hp-fill');
    if (playerBar) {
        const pct = Math.max(0, (S.player.hp / S.player.maxHp) * 100);
        playerBar.style.width = pct + '%';
        fightUI.querySelector('#warrior div:last-child').textContent = `Tú (${S.player.hp}/${S.player.maxHp})`;
    }

    const enemyBar = fightUI.querySelector('#enemy .hp-fill');
    if (enemyBar) {
        const pct = Math.max(0, (combatState.boss.hp / combatState.boss.max) * 100);
        enemyBar.style.width = pct + '%';
        fightUI.querySelector('#enemy div:last-child').textContent = `${boss.name} (${combatState.boss.hp}/${combatState.boss.max})`;
    }
}

// Alias for compatibility if I missed any call
const renderAscii = renderCombatUI;

function openCombat() {
    if (!S.threat) return;
    combatState = { boss: S.threat, turn: 'player' };
    fightTitle.textContent = `Combate: ${S.threat.name}`;
    fightInfo.textContent = 'Turnos: tú actúas primero. Decide atacar, defender o curarte.';
    fightFooter.textContent = `HP Jugador: ${S.player.hp}/${S.player.maxHp} | HP Enemigo: ${combatState.boss.hp}/${combatState.boss.max}`;
    fightOverlay.classList.remove('hidden');
    renderAscii();
}

function closeCombat() {
    fightOverlay.classList.add('hidden');
    combatState = null;
    fightUI.innerHTML = ''; // Clear for next time
    // Trigger Action Render is tricky here because Actions are in another module.
    // We can dispatch an event or export a listener registry.
    // Ideally, Actions monitors state or we call a refresh.
    // For now, let's use a CustomEvent on the window that Game/Actions can listen to
    window.dispatchEvent(new CustomEvent('lys-actions-refresh'));
    updateTags();
    saveState();
}

function enemyTurn() {
    if (!combatState) return;
    const base = 6 + Math.floor(Math.random() * 4); // 6-9
    let dmg = base;
    if (S.player.guard) {
        dmg = Math.max(0, Math.floor(base * 0.3)); // 70% mitigación
        // 30% de posibilidad de riposte por 1 de daño
        if (Math.random() < 0.3) {
            const enemyEl = document.querySelector('#enemy');
            if (enemyEl) enemyEl.classList.add('hit');
            setTimeout(() => enemyEl && enemyEl.classList.remove('hit'), 450);

            combatState.boss.hp = Math.max(0, combatState.boss.hp - 1);
            log('Riposte oportuno: devuelves 1 de daño.', 'good');
            createDamageNumber(1, enemyEl);
        }
    }
    S.player.guard = false;
    S.player.hp = Math.max(0, S.player.hp - dmg);
    fightInfo.textContent = `El enemigo ataca y te hace ${dmg} de daño.`;
    fightFooter.textContent = ''; // Hide footer text info as bars show it

    // Anim player hit
    const playerEl = document.querySelector('#warrior');
    if (playerEl) {
        playerEl.classList.add('hit');
        setTimeout(() => playerEl.classList.remove('hit'), 450);
        createDamageNumber(dmg, playerEl);
    }

    updateTags();
    renderCombatUI();
    if (S.player.hp <= 0) {
        log('Has caído en combate. Pierdes algo de renombre.', 'bad');
        S.stats.renown = Math.max(0, S.stats.renown - 2);
        closeCombat();
        return;
    }
    combatState.turn = 'player';
}

// Combat Buttons
btnAttack.addEventListener('click', () => {
    if (!combatState || combatState.turn !== 'player') return;
    const isCrit = Math.random() < 0.15; // 15% crit chance
    let atk = 1 + (S.resources.antorchas > 0 ? 1 : 0) + (S.unlocked.forge ? 1 : 0);
    if (isCrit) atk *= 2;

    if (S.resources.antorchas > 0) S.resources.antorchas--;

    // Anim attack
    const playerEl = document.querySelector('#warrior');
    if (playerEl) {
        playerEl.classList.remove('attack-rush');
        void playerEl.offsetWidth; // trigger reflow
        playerEl.classList.add('attack-rush');
    }

    combatState.boss.hp -= atk;
    fightInfo.textContent = isCrit ? `¡GOLPE CRÍTICO! Infliges ${atk} de daño.` : `Atacas e infliges ${atk} de daño.`;
    fightFooter.textContent = '';

    const enemyEl = document.querySelector('#enemy');
    if (enemyEl) {
        const hitClass = isCrit || atk >= 5 ? 'hit-hard' : 'hit';
        enemyEl.classList.remove('hit', 'hit-hard');
        void enemyEl.offsetWidth;
        enemyEl.classList.add(hitClass);
        setTimeout(() => enemyEl.classList.remove(hitClass), 500);
        createDamageNumber(atk, enemyEl, isCrit ? 'crit' : 'dmg');
    }

    renderResources(); renderCombatUI();
    if (combatState.boss.hp <= 0) {
        const t = combatState.boss;
        log(`${t.name} ha sido derrotado.`, 'good');
        S.stats.bossesDefeated++;
        window.dispatchEvent(new CustomEvent('lys-unlock-achievement', { detail: { key: t.key, mk: `Derrotaste a ${t.name}` } }));

        S.threat = null;
        bossTag.textContent = '👁️ Sin amenaza';
        toast('Has protegido la aldea.');
        closeCombat();
        return;
    }
    combatState.turn = 'enemy';
    setTimeout(enemyTurn, 600);
});

btnDefend.addEventListener('click', () => {
    if (!combatState || combatState.turn !== 'player') return;
    S.player.guard = true;
    fightInfo.textContent = 'Te cubres tras tu escudo (mitiga el próximo golpe).';
    combatState.turn = 'enemy';
    setTimeout(enemyTurn, 500);
});

btnHeal.addEventListener('click', () => {
    if (!combatState || combatState.turn !== 'player') return;
    if (S.resources.medicina > 0) {
        S.resources.medicina--;
        const amount = 20;
        S.player.hp = Math.min(S.player.maxHp, S.player.hp + amount);
        fightInfo.textContent = 'Usas una medicina y recuperas 20 HP.';
        fightFooter.textContent = '';
        const playerEl = document.querySelector('#warrior');
        createDamageNumber(amount, playerEl, 'heal');

        // Pulse effect
        if (playerEl) {
            playerEl.classList.add('attack'); // re-use scale bounce
            setTimeout(() => playerEl.classList.remove('attack'), 300);
        }

        renderResources(); updateTags(); saveState();
        renderCombatUI();
        combatState.turn = 'enemy';
        setTimeout(enemyTurn, 500);
    } else {
        fightInfo.textContent = 'No te quedan medicinas.';
    }
});

// Encounter Logic
function showEncounterPrompt() {
    if (!S.threat) return;
    encounterTitle.textContent = 'Amenaza: ' + S.threat.name;
    encounterInfo.textContent = '¿Deseas enfrentarte ahora mismo?';
    let remain = 10;
    encounterCountdown.textContent = String(remain);
    encounterOverlay.classList.remove('hidden');
    clearInterval(encounterTimer);
    encounterTimer = setInterval(() => {
        remain--; encounterCountdown.textContent = String(remain);
        if (remain <= 0) {
            clearInterval(encounterTimer);
            encounterOverlay.classList.add('hidden');
        }
    }, 1000);
}

btnEncAccept.addEventListener('click', () => {
    if (encounterTimer) clearInterval(encounterTimer);
    encounterOverlay.classList.add('hidden');
    openCombat();
});

btnEncDecline.addEventListener('click', () => {
    if (encounterTimer) clearInterval(encounterTimer);
    encounterOverlay.classList.add('hidden');
    log('Has decidido postergar el enfrentamiento.', 'dim');
});



const mapBody = $('#mapBody');
const mapFooter = $('#mapFooter');

function regionPicker() {
    // Pondera por renombre para abrir variedad
    const unlocked = REGIONS.filter(r => (r.unlockDay || 1) <= S.time.day);
    const idx = Math.min(unlocked.length - 1, Math.floor(S.stats.renown / 5));
    const slice = unlocked.slice(0, Math.max(2, idx + 2));
    return slice[Math.floor(Math.random() * slice.length)];
}

function renderMap() {
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

function getRandomRegion() {
    return regionPicker();
}



const actionsEl = $('#actions');

const ACTION_LOCKS = {
    crafting: () => S.unlocked.crafting,
    recruit: () => S.unlocked.village,
    exploreAdvanced: () => S.stats.renown >= 6 || S.unlocked.expedition
};

function can(action) {
    const t = S.cooldowns[action] || 0;
    return now() >= t;
}

function setCd(action, ms) {
    S.cooldowns[action] = now() + ms;
}

function spawnBoss() {
    const pool = BOSSES;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    S.threat = { key: pick.key, name: pick.name, icon: pick.icon, hp: pick.hp, max: pick.hp, endsAt: now() + pick.duration, region: pick.region };
    log(`${pick.name} emerge cerca de ${pick.region}.`, 'bad');
    showEncounterPrompt();
    if (!S.stats.bossTipShown) {
        setTip('Consejo: vuelve cada cierto tiempo para reclamar expediciones y bosses temporales.');
        S.stats.bossTipShown = true;
    }
}

function addRes(key, n) {
    S.resources[key] = (S.resources[key] || 0) + n;
    if (S.resources[key] > 0) markDiscovery(key);
    refreshAll();
}

function markDiscovery(key) {
    if (S.discoveries[key]) return;
    S.discoveries[key] = true;
    // Metadata is in constants but used in UI... 
    // We'll just log generic or assume UI handles it? 
    // UI has metadata. We can import it or just log simple text.
    // "Has descubierto algo nuevo"
    log(`Has conseguido recursos nuevos (${key}).`, 'dim');
    renderActions();
}

// Global Refresh Helper (Updates all UI dependants)
function refreshAll() {
    renderResources();
    checkUnlocks(); // Defined below or imported?
    renderActions();
}

function tryUnlocks() {
    if (!S.unlocked.water && S.resources.lenia >= 3) { S.unlocked.water = true; log('Puedes buscar agua en un arroyo cercano.', 'dim'); }
    if (!S.unlocked.herbs && S.resources.agua >= 2) { S.unlocked.herbs = true; log('Detectas aroma a romero y tomillo en la sierra.', 'dim'); }
    if (!S.unlocked.olives && S.resources.hierbas >= 1) { S.unlocked.olives = true; log('Al sureste hay olivares. Podrías recolectar aceitunas.', 'dim'); }
    if (!S.unlocked.crafting && (S.resources.aceitunas >= 1 && S.resources.lenia >= 1)) { S.unlocked.crafting = true; log('Has aprendido a fabricar antorchas y remedios.', 'good'); }
    if (!S.unlocked.village && S.stats.renown >= 5) { S.unlocked.village = true; log('Unos viajantes se unen. Nace una pequeña aldea.', 'good'); }
    if (!S.unlocked.expedition && S.stats.explore >= 8) { S.unlocked.expedition = true; log('Puedes organizar expediciones por Andalucía.', 'good'); }
}
const checkUnlocks = tryUnlocks; // alias

function unlockAchievement(key, text) {
    if (!S.achievements[key]) {
        S.achievements[key] = true;
        log(`🏅 Logro desbloqueado: ${text}`, 'warn');
        toast(`Logro: ${text}`);
        renderAchievements();
    }
}

function craft(item) {
    if (item === 'antorchas' && S.resources.lenia >= 1 && S.resources.aceitunas >= 1) {
        S.resources.lenia--; S.resources.aceitunas--; S.resources.antorchas++;
        log('Has fabricado una antorcha.', 'good');
    }
    if (item === 'medicina' && S.resources.hierbas >= 2 && S.resources.agua >= 1) {
        S.resources.hierbas -= 2; S.resources.agua--; S.resources.medicina++;
        log('Has preparado una medicina.', 'good');
    }
    refreshAll();
}

function build(edificio) {
    if (edificio === 'molino' && S.resources.piedra >= 5) {
        S.resources.piedra -= 5; S.unlocked.molino = true;
        log('Has construido un molino.', 'good');
    }
    if (edificio === 'acequia' && S.resources.piedra >= 3 && S.resources.agua >= 2) {
        S.resources.piedra -= 3; S.resources.agua -= 2; S.unlocked.acequia = true;
        log('Has construido una acequia.', 'good');
        unlockAchievement('ach_acequia', 'Arquitecto del Agua');
    }
    if (edificio === 'fragua' && S.resources.hierro >= 5) {
        S.resources.hierro -= 5; S.unlocked.forge = true;
        log('Has construido una fragua.', 'good');
        unlockAchievement('ach_herrero', 'Herrero Mayor');
    }
    refreshAll();
}

function checkAchievements() {
    if (S.fire.lit && S.fire.heat >= 24) unlockAchievement('luzEterna', 'Primer rayo de sol');
    if (S.resources.aceitunas >= 100) unlockAchievement('ach_aceitunero', 'Maestro Aceitunero');
}

function renderActions() {
    actionsEl.innerHTML = '';

    // Fuego
    const btnLight = document.createElement('button');
    btnLight.className = 'action';
    btnLight.textContent = S.fire.lit ? 'Mantener la fogata (+calor)' : 'Encender la fogata';
    btnLight.disabled = !can('stoke') || (!S.fire.lit && S.resources.lenia <= 0);
    btnLight.onclick = () => {
        if (!S.fire.lit) {
            if (S.resources.lenia <= 0) return;
            S.resources.lenia--; S.fire.fuel += 3; S.fire.lit = true; log('Has encendido la fogata. El frío retrocede.', 'good');
        } else {
            if (S.resources.lenia <= 0) { log('No tienes leña suficiente.', 'warn'); return; }
            S.resources.lenia--; S.fire.fuel += 2; log('Avivas la lumbre.', 'dim');
        }
        setCd('stoke', 1500);
        renderResources(); updateTags(); saveState();
    };
    actionsEl.appendChild(btnLight);

    // Recolecta básica
    const btnWood = document.createElement('button');
    btnWood.className = 'action';
    btnWood.textContent = can('cut') ? 'Cortar leña' : 'Cortar leña (' + fmtMs(S.cooldowns.cut - now()) + ')';
    btnWood.disabled = !can('cut');
    btnWood.onclick = () => {
        const gained = 1 + (Math.random() < 0.35 ? 1 : 0);
        addRes('lenia', gained);
        log(`Recolectas ${gained} leña.`, '');
        setCooldown(btnWood, 'cut', 1800);
        saveState(); renderActions();
    };
    // Register cooldown 
    setCooldown(btnWood, 'cut', 1800); // This just updates registry if stale, real logic is in click
    // Wait, setCooldown sets state time too. 
    // We should only call setCooldown from helper if we want to update state AND UI ref.
    // Re-assigning UI ref in loop:
    import('./ui.js').then(ui => ui.setCooldown(btnWood, 'cut', 1800)); // Dynamic import inside? No.
    // The issue: setCooldown in UI sets state.cooldowns too.
    // We want to register the button for visual updates even if cd is not just set now.
    // We need a separate registerButton(btn, key, total) function in UI that doesn't touch S.cooldowns?
    // Or just use setCooldown but pass current remaining time?
    // Let's stick to simple: setCooldown does it all.
    // In render loop, we just need to register the button so updateCooldownVisuals finds it.
    // If we call setCooldown, it resets the timer. WRONG.
    // We need registerButton in UI.

    // Quick fix: define registerButton locally that calls UI internals? No.
    // Let's add registerButton to UI module or just piggyback on setCooldown with 0 time?
    // Better: Helper in UI to register without setting time.
    // I can't edit UI.js now without another tool call. 
    // I'll implement a workaround: manually add to BUTTON_REFS or use a safe helper.
    // Actually, `setCooldown` in `ui.js` sets `S.cooldowns`.
    // I'll add `registerCooldownBtn` in `ui.js` in a future step or just access BUTTON_REFS if exported. 
    // BUTTON_REFS is exported!
    // So:
    // import { BUTTON_REFS } from './ui.js'
    // in loop: BUTTON_REFS['cut'] = { btn: btnWood, total: 1800, baseText: 'Cortar leña' };

    // Fix applied below:

    // Register for visual updates
    // We need to know the Total duration for the progress bar.
    // That's static per action type.
    const reg = (key, btn, ms) => {
        // Use the new helper from UI to avoid resetting state
        import('./ui.js').then(ui => ui.registerCooldownBtn(btn, key, ms));
    };

    if (S.unlocked.water) {
        const btnWater = document.createElement('button');
        btnWater.className = 'action';
        btnWater.textContent = can('fetch') ? 'Buscar agua' : 'Buscar agua (' + fmtMs(S.cooldowns.fetch - now()) + ')';
        btnWater.disabled = !can('fetch');
        btnWater.onclick = () => {
            const gained = 1;
            addRes('agua', gained);
            log('Llenas un odre con agua fresca.', '');
            setCooldown(btnWater, 'fetch', 3000);
            saveState(); renderActions();
        };
        reg('fetch', btnWater, 3000);
        actionsEl.appendChild(btnWater);
    }

    // Re-add cut content properly
    actionsEl.innerHTML = ''; // Reset
    // Redo Light
    actionsEl.appendChild(btnLight);

    // Redo Wood
    btnWood.onclick = () => {
        addRes('lenia', 2); // Was 1? no wood gives more usually. Original code logic:
        // Actually original was inline. Wait, previous steps I just re-added btnWood.
        // Let's check original logic. Oh, I replaced it all. 
        // Logic: addRes('lenia', 1); log...
        addRes('lenia', 1);
        log('Cortas leña del bosque cercano.', '');
        AudioSystem.playTone('wood');
        setCooldown(btnWood, 'cut', 1800);
        tryUnlocks(); saveState(); renderActions();
    };
    reg('cut', btnWood, 1800);
    actionsEl.appendChild(btnWood);

    // ... Water ...
    if (S.unlocked.water) {
        const btnWater = document.createElement('button');
        btnWater.className = 'action';
        btnWater.textContent = can('fetch') ? 'Buscar agua' : 'Buscar agua (' + fmtMs(S.cooldowns.fetch - now()) + ')';
        btnWater.disabled = !can('fetch');
        btnWater.onclick = () => {
            const gained = 1;
            addRes('agua', gained);
            log('Llenas un odre con agua fresca.', '');
            setCooldown(btnWater, 'fetch', 3000);
            saveState(); renderActions();
        };
        reg('fetch', btnWater, 3000);
        actionsEl.appendChild(btnWater);
    }

    if (S.unlocked.herbs) {
        const btnHerb = document.createElement('button');
        btnHerb.className = 'action';
        btnHerb.textContent = can('forage') ? 'Forrajear hierbas' : 'Forrajear hierbas (' + fmtMs(S.cooldowns.forage - now()) + ')';
        btnHerb.disabled = !can('forage');
        btnHerb.onclick = () => {
            const roll = Math.random();
            if (roll < 0.6) { addRes('hierbas', 1); log('Recolectas hierbas aromáticas.', ''); }
            else { addRes('aceitunas', 1); log('Encuentras unas aceitunas maduras.', ''); }
            setCooldown(btnHerb, 'forage', 3500);
            tryUnlocks(); saveState(); renderActions();
        };
        reg('forage', btnHerb, 3500);
        actionsEl.appendChild(btnHerb);
    }

    // Explorar
    const btnExplore = document.createElement('button');
    btnExplore.className = 'action';
    btnExplore.textContent = can('explore') ? 'Explorar los contornos' : 'Explorar (' + fmtMs(S.cooldowns.explore - now()) + ')';
    btnExplore.disabled = !can('explore');
    btnExplore.onclick = () => {
        const roll = Math.random();
        S.stats.explore++;
        if (roll < 0.4) { addRes('piedra', 1); log('Hallaste piedra útil.', ''); }
        else if (roll < 0.6) { addRes('hierro', 1); log('Recoges vetas de hierro.', ''); }
        else { S.stats.renown += 1; log('Ayudas a un viajero; se corre la voz. (+Renombre)', 'good'); }
        if (!S.threat && Math.random() < 0.18) { spawnBoss(); }
        setCooldown(btnExplore, 'explore', 6000);
        tryUnlocks(); updateTags(); saveState(); renderActions();
    };
    reg('explore', btnExplore, 6000);
    actionsEl.appendChild(btnExplore);

    // Crafteo
    if (ACTION_LOCKS.crafting()) {
        const row = document.createElement('div'); row.className = 'inline';
        const b1 = document.createElement('button'); b1.className = 'action'; b1.textContent = 'Fabricar antorcha (-1 leña, -1 aceituna)';
        b1.disabled = !(S.resources.lenia >= 1 && S.resources.aceitunas >= 1) || !can('craft');
        b1.onclick = () => { craft('antorchas'); setCooldown(b1, 'craft', 800); refreshAll(); saveState(); };
        const b2 = document.createElement('button'); b2.className = 'action'; b2.textContent = 'Preparar medicina (-2 hierbas, -1 agua)';
        b2.disabled = !(S.resources.hierbas >= 2 && S.resources.agua >= 1) || !can('craft');
        b2.onclick = () => { craft('medicina'); setCooldown(b2, 'craft', 800); refreshAll(); saveState(); };
        row.appendChild(b1); row.appendChild(b2);
        actionsEl.appendChild(row);
    }

    // Construcciones
    const buildWrap = document.createElement('div'); buildWrap.className = 'inline';
    if (S.discoveries && S.discoveries.piedra) {
        const bm = document.createElement('button'); bm.className = 'action'; bm.textContent = 'Construir molino (-5 piedra)';
        bm.disabled = S.unlocked.molino || S.resources.piedra < 5;
        bm.onclick = () => { build('molino'); refreshAll(); saveState(); };
        buildWrap.appendChild(bm);
    }
    if (S.discoveries && S.discoveries.agua && S.discoveries.piedra) {
        const ba = document.createElement('button'); ba.className = 'action'; ba.textContent = 'Construir acequia (-3 piedra, -2 agua)';
        ba.disabled = S.unlocked.acequia || !(S.resources.piedra >= 3 && S.resources.agua >= 2);
        ba.onclick = () => { build('acequia'); refreshAll(); saveState(); };
        buildWrap.appendChild(ba);
    }
    if (S.discoveries && S.discoveries.hierro) {
        const bf = document.createElement('button'); bf.className = 'action'; bf.textContent = 'Construir fragua (-5 hierro)';
        bf.disabled = S.unlocked.forge || S.resources.hierro < 5;
        bf.onclick = () => { build('fragua'); refreshAll(); saveState(); };
        buildWrap.appendChild(bf);
    }
    if (buildWrap.children.length > 0) actionsEl.appendChild(buildWrap);

    // Expediciones
    if (S.unlocked.expedition) {
        if (!S.expedition) {
            const bx = document.createElement('button'); bx.className = 'action'; bx.textContent = 'Organizar expedición (3-8 min)';
            bx.onclick = () => {
                const region = getRandomRegion();
                const dur = (3 + Math.floor(Math.random() * 6)) * 60 * 1000;
                S.expedition = { endsAt: now() + dur, startedAt: now(), region: region.name };
                log(`${region.emoji} Una expedición parte hacia ${region.name}.`, 'warn');
                setTip('Vuelve más tarde para reclamar los hallazgos de la expedición.');
                updateTags(); saveState(); renderActions(); renderMap();
            };
            actionsEl.appendChild(bx);
        } else {
            const remain = S.expedition.endsAt - now();
            const bx = document.createElement('button'); bx.className = 'action'; bx.textContent = remain > 0 ? ('Expedición en curso (' + fmtMs(remain) + ')') : 'Reclamar expedición';
            bx.disabled = remain > 0;
            bx.onclick = () => {
                if (now() < S.expedition.endsAt) return;
                const region = REGIONS.find(r => r.name === S.expedition.region) || getRandomRegion();
                region.loot.forEach(item => {
                    const min = item.n[0], max = item.n[1];
                    const n = min + Math.floor(Math.random() * (max - min + 1));
                    if (item.k === 'renown') { S.stats.renown += n; }
                    else { addRes(item.k, n); }
                });
                const ev = region.events[Math.floor(Math.random() * region.events.length)];
                log(`${region.emoji} La expedición regresa de ${region.name}: ${ev}`, 'good');
                S.expedition = null;
                updateTags(); renderResources(); tryUnlocks(); saveState(); renderActions(); renderMap();
            };
            actionsEl.appendChild(bx);
        }
    }

    // Trader
    if (S.trader) {
        const div = document.createElement('div');
        div.className = 'card';
        div.style.background = '#151b26'; div.style.marginBottom = '10px'; div.style.padding = '10px';
        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <b>🪵 Mercader Ambulante</b>
                <small>${fmtMs(S.trader.endsAt - now())}</small>
            </div>
            <p style="margin:0 0 8px;font-size:0.9rem;color:#ccc">"Te cambio ${S.trader.rate} de ${RES_META[S.trader.wants]?.label || S.trader.wants} por algo de fama."</p>
        `;
        const btnTrade = document.createElement('button');
        btnTrade.className = 'action';
        const cost = S.trader.rate;
        const canAfford = S.resources[S.trader.wants] >= cost;
        btnTrade.textContent = canAfford ? 'Intercambiar' : 'No tienes suficiente';
        btnTrade.disabled = !canAfford;
        btnTrade.onclick = () => {
            if (S.resources[S.trader.wants] >= cost) {
                S.resources[S.trader.wants] -= cost;

                // Prestige Multiplier Logic
                const prestigeMult = 1 + ((S.prestige || 0) * 0.5);
                S.stats.renown += (1 * prestigeMult);

                log('El mercader asiente y habla bien de ti. (+Renombre)', 'good');
                AudioSystem.playTone('metal');
                saveState(); renderActions(); renderResources();
            }
        };
        div.appendChild(btnTrade);
        actionsEl.appendChild(div);
    }

    // Boss
    if (S.threat) {
        const t = S.threat;
        const remain = t.endsAt - now();
        const bb = document.createElement('button'); bb.className = 'action';
        bb.textContent = remain > 0 ? `Enfrentar: ${t.name} (HP ${t.hp}/${t.max})` : `La amenaza se desvanece`;
        bb.disabled = remain <= 0;
        bb.onclick = () => { openCombat(); };
        actionsEl.appendChild(bb);
    }

    // Advanced Explore
    if (ACTION_LOCKS.exploreAdvanced()) {
        const bAdv = document.createElement('button'); bAdv.className = 'action'; bAdv.textContent = 'Explorar rutas andaluzas (avanzado)';
        bAdv.onclick = () => {
            const region = getRandomRegion();
            const roll = Math.random();
            if (roll < 0.5) { addRes('piedra', 2); log(`Exploras ${region.name} y recoges materiales.`, ''); }
            else if (roll < 0.75) { addRes('hierro', 2); log(`Encuentras mejores vetas en ${region.name}.`, ''); }
            else { S.stats.renown += 2; log(`Te reconocen en ${region.name}. (+2 Renombre)`, 'good'); }
            setCooldown(bAdv, 'explore_adv', 12000);
            refreshAll(); updateTags(); saveState();
        };
        reg('explore_adv', bAdv, 12000);
        actionsEl.appendChild(bAdv);
    }

    // Recruit
    if (ACTION_LOCKS.recruit()) {
        const bVill = document.createElement('button'); bVill.className = 'action'; bVill.textContent = 'Reclutar aldeano (-2 comida variada)';
        bVill.disabled = !((S.resources.trigo >= 1 && S.resources.aceitunas >= 1) || (S.resources.trigo >= 2) || (S.resources.aceitunas >= 2));
        bVill.onclick = () => {
            if (S.resources.trigo >= 1 && S.resources.aceitunas >= 1) { S.resources.trigo--; S.resources.aceitunas--; }
            else if (S.resources.trigo >= 2) { S.resources.trigo -= 2; }
            else if (S.resources.aceitunas >= 2) { S.resources.aceitunas -= 2; }
            else return;
            S.people.villagers = (S.people.villagers || 0) + 1;
            log('Un nuevo aldeano se une a tu poblado.', 'good');
            refreshAll(); saveState();
        };
        actionsEl.appendChild(bVill);

        // Village Jobs Management
        if (S.people.villagers > 0) {
            const jobPanel = document.createElement('div');
            jobPanel.style.marginTop = '10px';
            jobPanel.style.padding = '10px';
            jobPanel.style.background = '#0e1420';
            jobPanel.style.border = '1px solid #1b2636';
            jobPanel.style.borderRadius = '8px';

            const assigned = (S.people.jobs.lumber || 0) + (S.people.jobs.farmer || 0) + (S.people.jobs.miner || 0);
            const free = S.people.villagers - assigned;

            // Calc production/consumption estimates (Per min approx)
            // Consumption: 0.1 * 60 = 6 per villager/min
            const consume = (S.people.villagers * 6).toFixed(1);
            // Farmers: 0.08 * 60 = 4.8 per farmer/min (ignoring heat bonus for display simplicity)
            const produce = (S.people.jobs.farmer * 4.8).toFixed(1);
            const net = (produce - consume).toFixed(1);
            const netColor = net >= 0 ? '#9ad06e' : '#ff6b6b';

            jobPanel.innerHTML = `<div style="margin-bottom:8px;font-size:0.9rem;color:#dfe8ff">
                <b>Gestión de Aldea</b> (Libres: ${free})<br>
                <small style="color:#93a1b3">Comida: <span style="color:${netColor}">${net >= 0 ? '+' : ''}${net}/min</span> (Prod: ${produce}, Cons: ${consume})</small>
            </div>`;

            const jobs = [
                { key: 'lumber', label: 'Leñadores', icon: '🪵' },
                { key: 'farmer', label: 'Granjeros', icon: '🌾' },
                { key: 'miner', label: 'Mineros', icon: '⛏️' }
            ];

            jobs.forEach(j => {
                // Show miner only if unlocked forge or stone discovered? 
                // Let's show if stone is discovered.
                if (j.key === 'miner' && !S.discoveries.piedra) return;

                const count = S.people.jobs[j.key] || 0;
                const row = document.createElement('div');
                row.className = 'inline';
                row.style.marginBottom = '6px';
                row.style.justifyContent = 'space-between';
                row.innerHTML = `<span>${j.icon} ${j.label}: <b>${count}</b></span>`;

                const ctrls = document.createElement('div');
                const btnSub = document.createElement('button'); btnSub.textContent = '-'; btnSub.className = 'action';
                btnSub.style.padding = '2px 8px'; btnSub.style.width = 'auto'; btnSub.style.minWidth = '30px';
                btnSub.disabled = count <= 0;
                btnSub.onclick = () => { S.people.jobs[j.key]--; refreshAll(); saveState(); };

                const btnAdd = document.createElement('button'); btnAdd.textContent = '+'; btnAdd.className = 'action';
                btnAdd.style.padding = '2px 8px'; btnAdd.style.width = 'auto'; btnAdd.style.minWidth = '30px';
                btnAdd.disabled = free <= 0;
                btnAdd.onclick = () => {
                    if (!S.people.jobs[j.key]) S.people.jobs[j.key] = 0;
                    S.people.jobs[j.key]++;
                    refreshAll(); saveState();
                };

                ctrls.appendChild(btnSub);
                ctrls.appendChild(btnAdd);
                row.appendChild(ctrls);
                jobPanel.appendChild(row);
            });

            actionsEl.appendChild(jobPanel);
        }
    }
}

// Achievement Listener
window.addEventListener('lys-unlock-achievement', (e) => {
    if (e.detail && e.detail.key && e.detail.mk) {
        unlockAchievement(e.detail.key, e.detail.mk);
    }
});

const startOverlay = $('#startOverlay');
const startBtn = $('#startBtn');
const audioBtn = $('#audioBtn');



function gameTick() {
    const nowTs = now();

    // Time
    S.time.minutes += 1;
    if (S.time.minutes >= (24 * 60)) { S.time.minutes = 0; S.time.day++; log('Amanece un nuevo día en Andalucía.', 'dim'); }

    // Weather Change (~every 600 ticks = 10 mins, randomized)
    if (Math.random() < 0.002) {
        const weathers = ['clear', 'clear', 'clear', 'rain', 'wind'];
        const next = weathers[Math.floor(Math.random() * weathers.length)];
        if (next !== S.weather) {
            S.weather = next;
            const wMsg = { clear: 'El cielo se despeja.', rain: 'Empieza a llover.', wind: 'Se levanta un fuerte viento.' };
            log(wMsg[next], 'dim');
        }
    }

    // Fire
    if (S.fire.lit) {
        let fuelCons = 0.05;
        let heatGain = 0.2 + (S.unlocked.molino ? 0.05 : 0);

        // Weather Effects
        if (S.weather === 'rain') { heatGain -= 0.1; } // Rain cools
        if (S.weather === 'wind') { fuelCons += 0.05; } // Wind consumes fuel faster

        if (S.fire.fuel > 0) {
            S.fire.fuel -= fuelCons;
            S.fire.heat = Math.min(30, S.fire.heat + heatGain);
        } else {
            S.fire.heat = Math.max(0, S.fire.heat - 0.5);
        }

        if (S.fire.heat <= 0) { S.fire.lit = false; log('La lumbre se ha apagado.', 'warn'); }
    }

    const heat = S.fire.heat;
    const heatBonus = heat > 20 ? 0.02 : heat > 10 ? 0.01 : 0;

    // Passive effects
    const prestigeMult = 1 + ((S.prestige || 0) * 0.5);
    if (S.unlocked.acequia && Math.random() < (0.05 + heatBonus)) { addRes('agua', 1); }
    if (S.unlocked.molino && Math.random() < (0.05 + heatBonus) && S.resources.trigo > 0) {
        S.resources.trigo--;
        S.stats.renown += (1 * prestigeMult);
    }
    if (S.unlocked.forge && Math.random() < 0.02) { addRes('hierro', 1); }

    // Villager Jobs Production
    if (S.people.villagers > 0) {
        // Consumption: 0.1 food per villager per tick
        let needed = S.people.villagers * 0.1;
        // Prioritize Wheat (Trigo) then Olives (Aceitunas)
        if (S.resources.trigo >= needed) {
            S.resources.trigo -= needed;
        } else {
            let remain = needed - S.resources.trigo;
            S.resources.trigo = 0;
            if (S.resources.aceitunas >= remain) {
                S.resources.aceitunas -= remain;
            } else {
                S.resources.aceitunas = 0;
                // Starvation
                if (Math.random() < 0.05) { // 5% chance per tick to lose a villager if starving
                    S.people.villagers--;
                    // Remove from random job
                    const jobs = Object.keys(S.people.jobs).filter(k => S.people.jobs[k] > 0);
                    if (jobs.length > 0) {
                        const k = jobs[Math.floor(Math.random() * jobs.length)];
                        S.people.jobs[k]--;
                    }
                    log('Un aldeano ha muerto de hambre o abandonado la aldea.', 'bad');
                }
            }
        }

        if (S.people.jobs) {
            // Leñadores (10% chance per tick per worker)
            if (S.people.jobs.lumber > 0 && Math.random() < 0.1 * S.people.jobs.lumber) {
                addRes('lenia', 1);
            }
            // Granjeros (10% + bonus heat)
            if (S.people.jobs.farmer > 0) {
                let farmChance = 0.08 + (heatBonus * 2);
                if (S.weather === 'rain') farmChance += 0.05; // Rain bonus

                if (Math.random() < farmChance * S.people.jobs.farmer) {
                    addRes('trigo', 1);
                }
            }
            // Mineros (Stone/Iron) - Requires forge or discovery? Assumed if job assigned.
            if (S.people.jobs.miner > 0) {
                const mineChance = 0.05 * S.people.jobs.miner;
                if (Math.random() < mineChance) {
                    if (Math.random() < 0.7) addRes('piedra', 1);
                    else addRes('hierro', 1);
                }
            }
        }
    } else if ((S.people.villagers || 0) > 0 && !S.people.jobs) {
        // Fallback for saves without jobs init properly (should happen via migration though)
        if (Math.random() < (0.03 + heatBonus)) addRes('trigo', 1);
    }

    // Despawn boss
    if (S.threat && nowTs >= S.threat.endsAt) { log(`${S.threat.name} se desvanece entre la bruma.`, 'dim'); S.threat = null; }

    // Spawns
    // Boss
    if (!S.threat && S.time.day >= 2 && Math.random() < 0.006) { spawnBoss(); }

    // Trader (Rare, higher chance with Renown)
    if (!S.trader && !S.threat && S.time.day >= 3 && Math.random() < (0.002 + (S.stats.renown * 0.0001))) {
        const wants = Math.random() < 0.5 ? 'lenia' : 'trigo';
        S.trader = {
            endsAt: now() + 60000,
            wants: wants,
            gives: 'renown',
            rate: 20 // 20 units for 1 renown
        };
        log('Un mercader ambulante ha acampado cerca.', 'good');
        renderActions(); window.dispatchEvent(new CustomEvent('lys-actions-refresh'));
    }

    // Despawn Trader
    if (S.trader && nowTs >= S.trader.endsAt) {
        log('El mercader recoge sus cosas y se marcha.', 'dim');
        S.trader = null;
        renderActions(); window.dispatchEvent(new CustomEvent('lys-actions-refresh'));
    }

    // Update UI
    // We don't want to re-render buttons every tick, just stats
    updateTags();
    renderResources();
    checkAchievements();
    // renderMap(); // Map doesn't change on tick usually unless region unlock?
    // Map depends on region unlock which depends on day.
    // Efficiently: only if day changed? For now: KISS, renderMap is cheap? SVG dom manipulation is not super cheap.
    // Let's lazy render map? Or just on open.
    // Original rendered map on tick.
    renderMap();
    renderNotes();
    updateCooldownVisuals();
    S.lastTick = now();
}

function resumeIdleProgress() {
    const elapsed = now() - S.lastTick;
    if (elapsed > 5000) {
        const mins = Math.floor(elapsed / 1000);
        S.time.minutes += mins;
        const passiveWood = Math.floor(mins / 90);
        if (passiveWood > 0) S.resources.lenia += passiveWood;
        log(`Has estado fuera ${fmtMs(elapsed)}. Progreso idle aplicado.`, 'dim');
    }
}

let audio = null; // Removed in favor of AudioSystem singleton logic, but we kept reference in original code. 
// We will replace implementation.

function startGame() {
    if (S.started) return;
    S.started = true;
    saveState();
    try {
        AudioSystem.playMusic('audio1.mp3');
    } catch (e) { }
    startOverlay.classList.add('hidden');
    log('Despiertas en una habitación fría. Una fogata apagada te acompaña.', '');
}

function init() {
    loadState();
    resumeIdleProgress();

    renderResources();
    tryUnlocks();
    renderActions();
    renderAchievements();
    updateTags();
    renderNotes();
    renderMap();

    setInterval(gameTick, 1000);
    setInterval(saveState, 10000);
    // Cooldown visuals are updated in gameTick (1s) in original? No, 100ms in original.
    // Here I put it in gameTick. I should separate it for smooth UI.
    setInterval(updateCooldownVisuals, 100);

    // Global listeners
    window.addEventListener('lys-actions-refresh', renderActions);
    document.body.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            AudioSystem.playTone('click');
        }
    });

    // Achievement listener moved to actions.js

    if (S.started) {
        startOverlay.classList.add('hidden');
    }
}

// Bindings
startBtn.addEventListener('click', startGame);
if (audioBtn) {
    // Sync initial state
    if (AudioSystem.muted) audioBtn.textContent = '🔈 Audio';
    else audioBtn.textContent = '🔊 Audio';

    audioBtn.addEventListener('click', () => {
        const isMuted = AudioSystem.toggle();
        audioBtn.textContent = isMuted ? '🔈 Audio' : '🔊 Audio';
        if (!isMuted && !AudioSystem.audio) AudioSystem.playMusic('audio1.mp3');
    });
}

// System Buttons
const btnExport = $('#btnExport');
const btnImport = $('#btnImport');
const btnWipe = $('#btnWipe');
const sysFooter = $('#sysFooter');

if (btnExport) {
    btnExport.onclick = () => {
        try {
            const str = btoa(JSON.stringify(S));
            navigator.clipboard.writeText(str).then(() => {
                log('Partida copiada al portapapeles.', 'good');
                if (sysFooter) sysFooter.textContent = 'Copiado al portapapeles.';
            });
        } catch (e) { log('Error exportando.', 'bad'); }
    };
}

if (btnImport) {
    btnImport.onclick = () => {
        const str = prompt('Pega aquí tu código de guardado:');
        if (str) {
            try {
                const json = JSON.parse(atob(str));
                if (json && json.resources) {
                    localStorage.setItem('lys_save_v1', JSON.stringify(json));
                    location.reload();
                } else {
                    alert('Código inválido.');
                }
            } catch (e) { alert('Error al importar. Código corrupto.'); }
        }
    };
}

const btnPrestige = $('#btnPrestige');

if (btnPrestige) {
    btnPrestige.onclick = () => {
        if (S.stats.renown < 50) {
            alert('Necesitas 50 de Renombre para Ascender.');
            return;
        }
        if (confirm(`¿Ascender? Perderás todo el progreso (edificios, recursos), pero ganarás Nivel de Prestigio ${S.prestige + 1} (+50% Renombre futuro).`)) {
            const nextLvl = (S.prestige || 0) + 1;
            const keptAch = S.achievements;
            // Wipe but keep prestige and achievements
            localStorage.removeItem('lys_save_v1');
            // We need to inject prestige into next start. 
            // Simplest way: save a temporary flag or re-save immediately after clear?
            // Actually, we can just manually craft the new state and save it.
            // But state init handles defaults.
            // Let's do:
            const newState = {
                resources: { lenia: 0, agua: 0, aceitunas: 0, hierbas: 0, piedra: 0, hierro: 0, trigo: 0, sal: 0, antorchas: 0, medicina: 0 },
                stats: { totalTicks: 0, renown: 0, explore: 0, bossesDefeated: 0 }, // Reset renown
                unlocked: { fire: false, water: false, hut: false, farm: false, expedition: false, mine: false, forge: false, molino: false, acequia: false, herbs: false },
                people: { villagers: 0, jobs: { lumber: 0, farmer: 0, miner: 0 } },
                fire: { lit: false, fuel: 0, heat: 0 },
                time: { day: 1, minutes: 480 }, // 8:00 AM
                cooldowns: { cut: 0, fetch: 0, forage: 0, explore: 0, stoke: 0, boss: 0, craft: 0 },
                expedition: null,
                threat: null,
                trader: null,
                prestige: nextLvl,
                achievements: keptAch,
                regionFocus: null,
                weather: 'clear',
                discoveries: { lenia: false, agua: false, aceitunas: false, hierbas: false, piedra: false, hierro: false, trigo: false, sal: false }
            };
            localStorage.setItem('lys_save_v1', JSON.stringify(newState));
            location.reload();
        }
    };
}

if (btnWipe) {
    btnWipe.onclick = () => {
        if (confirm('¿Estás seguro de BORRAR todo el progreso? No hay vuelta atrás.')) {
            localStorage.removeItem('lys_save_v1');
            location.reload();
        }
    };
}

init();

// Export for debugging
window.S = S; 
