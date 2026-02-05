
import { $, sleep, vibrate } from './utils.js';
import { S, saveState } from './state.js';
import { log, toast, updateTags, renderResources } from './ui.js';
import integrator from './integrator.js';

const fightOverlay = $('#fightOverlay');
const fightTitle = $('#fightTitle');
const fightInfo = $('#fightInfo');
const fightFooter = $('#fightFooter');
const btnAttack = $('#btnAttack');
const btnDefend = $('#btnDefend');
const btnHeal = $('#btnHeal');
const fightUI = $('#fightUI');
const bossTag = $('#bossTag');

// Encounter overlay
const encounterOverlay = $('#encounterOverlay');
const encounterTitle = $('#encounterTitle');
const encounterInfo = $('#encounterInfo');
const encounterCountdown = $('#encounterCountdown');
const btnEncAccept = $('#btnEncAccept');
const btnEncDecline = $('#btnEncDecline');

let combatState = null;
let encounterTimer = null;



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

export function openCombat() {
    if (!S.threat) return;
    combatState = {
        boss: S.threat,
        turn: 'player',
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        startTime: Date.now()
    };
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
    combatState.totalDamageTaken += dmg;
    fightInfo.textContent = `El enemigo ataca y te hace ${dmg} de daño.`;
    fightFooter.textContent = ''; // Hide footer text info as bars show it

    // Anim player hit
    const playerEl = document.querySelector('#warrior');
    if (playerEl) {
        playerEl.classList.add('hit');
        setTimeout(() => playerEl.classList.remove('hit'), 450);
        createDamageNumber(dmg, playerEl);
        vibrate(80); // Vibrar al recibir daño
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
    combatState.totalDamageDealt += atk;
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

        // Hook para el nuevo sistema
        const duration = Date.now() - combatState.startTime;
        integrator.onBossDefeated(S, t.name, combatState.totalDamageDealt, combatState.totalDamageTaken, duration, log);

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
export function showEncounterPrompt() {
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
