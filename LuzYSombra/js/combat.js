
import { $, sleep, vibrate } from './utils.js';
import { S, saveState } from './state.js';
import { log, toast, updateTags, renderResources, addXP, xpFlash, screenFlash, fireConfetti } from './ui.js';
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

const encounterOverlay = $('#encounterOverlay');
const encounterTitle = $('#encounterTitle');
const encounterInfo = $('#encounterInfo');
const encounterCountdown = $('#encounterCountdown');
const encounterTimerBar = $('#encounterTimerBar');
const btnEncAccept = $('#btnEncAccept');
const btnEncDecline = $('#btnEncDecline');

let combatState = null;
let encounterTimer = null;

function createDamageNumber(amount, targetEl, type = 'dmg') {
    if (!targetEl) return;
    const el = document.createElement('div');
    el.className = 'dmg-num' + (type === 'heal' ? ' heal' : type === 'crit' ? ' crit' : '');
    el.textContent = type === 'heal' ? `+${amount}` : `-${amount}`;
    targetEl.appendChild(el);
    setTimeout(() => el.remove(), 900);
}

function renderCombatUI() {
    if (!combatState) return;
    const boss = combatState.boss;

    if (!fightUI.hasChildNodes()) {
        fightUI.innerHTML = `
            <div class="fighter" id="warrior">
                <div class="icon">🧑‍⚔️</div>
                <div class="hp-bar"><div class="hp-fill player" style="width:100%"></div></div>
                <div style="margin-top:4px;font-size:0.82rem;color:var(--muted)">Tú (${S.player.hp}/${S.player.maxHp})</div>
            </div>
            <div class="vs">⚔️</div>
            <div class="fighter" id="enemy">
                <div class="icon">${boss.icon}</div>
                <div class="hp-bar"><div class="hp-fill" style="width:100%"></div></div>
                <div style="margin-top:4px;font-size:0.82rem;color:var(--muted)">${boss.name}</div>
            </div>
        `;
    }

    const playerBar = fightUI.querySelector('#warrior .hp-fill');
    if (playerBar) {
        playerBar.style.width = Math.max(0, (S.player.hp / S.player.maxHp) * 100) + '%';
        fightUI.querySelector('#warrior div:last-child').textContent = `Tú (${S.player.hp}/${S.player.maxHp})`;
    }

    const enemyBar = fightUI.querySelector('#enemy .hp-fill');
    if (enemyBar) {
        enemyBar.style.width = Math.max(0, (combatState.boss.hp / combatState.boss.max) * 100) + '%';
        fightUI.querySelector('#enemy div:last-child').textContent = `${boss.name} (${combatState.boss.hp}/${combatState.boss.max})`;
    }
}

export function openCombat() {
    if (!S.threat) return;
    combatState = {
        boss: S.threat,
        turn: 'player',
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        startTime: Date.now()
    };
    fightTitle.textContent = `⚔️ ${S.threat.name}`;
    fightInfo.textContent = 'Tu turno. ¡Elige una acción!';
    fightFooter.textContent = '';
    fightOverlay.classList.remove('hidden');
    renderCombatUI();

    btnAttack.disabled = false;
    btnDefend.disabled = false;
    btnHeal.disabled = false;
}

function closeCombat() {
    fightOverlay.classList.add('hidden');
    combatState = null;
    fightUI.innerHTML = '';
    window.dispatchEvent(new CustomEvent('lys-actions-refresh'));
    updateTags();
    saveState();
}

function disableCombatBtns() {
    btnAttack.disabled = true;
    btnDefend.disabled = true;
    btnHeal.disabled = true;
}

function enableCombatBtns() {
    if (!combatState) return;
    btnAttack.disabled = false;
    btnDefend.disabled = false;
    btnHeal.disabled = false;
}

function enemyTurn() {
    if (!combatState) return;
    const base = 6 + Math.floor(Math.random() * 4);
    let dmg = base;
    if (S.player.guard) {
        dmg = Math.max(0, Math.floor(base * 0.3));
        if (Math.random() < 0.3) {
            const enemyEl = document.querySelector('#enemy');
            if (enemyEl) enemyEl.classList.add('hit');
            setTimeout(() => enemyEl?.classList.remove('hit'), 450);
            combatState.boss.hp = Math.max(0, combatState.boss.hp - 1);
            log('¡Riposte! Devuelves 1 de daño.', 'good');
            createDamageNumber(1, enemyEl);
        }
    }
    S.player.guard = false;
    S.player.hp = Math.max(0, S.player.hp - dmg);
    combatState.totalDamageTaken += dmg;
    fightInfo.textContent = `El enemigo ataca: ${dmg} daño.`;

    const playerEl = document.querySelector('#warrior');
    if (playerEl) {
        playerEl.classList.add('hit');
        setTimeout(() => playerEl.classList.remove('hit'), 450);
        createDamageNumber(dmg, playerEl);
        vibrate(80);
    }

    if (dmg >= 8) screenFlash('red');

    updateTags();
    renderCombatUI();

    if (S.player.hp <= 0) {
        log('Has caído en combate. Pierdes renombre.', 'bad');
        S.stats.renown = Math.max(0, S.stats.renown - 2);
        screenFlash('red');
        closeCombat();
        return;
    }
    combatState.turn = 'player';
    enableCombatBtns();
    fightInfo.textContent += ' ¡Tu turno!';
}

btnAttack.addEventListener('click', () => {
    if (!combatState || combatState.turn !== 'player') return;
    disableCombatBtns();

    const isCrit = Math.random() < 0.15;
    let atk = 1 + (S.resources.antorchas > 0 ? 1 : 0) + (S.unlocked.forge ? 1 : 0);
    const levelBonus = Math.floor(S.player.level / 5);
    atk += levelBonus;
    if (isCrit) atk *= 2;

    if (S.resources.antorchas > 0) S.resources.antorchas--;

    const playerEl = document.querySelector('#warrior');
    if (playerEl) {
        playerEl.classList.remove('attack-rush');
        void playerEl.offsetWidth;
        playerEl.classList.add('attack-rush');
    }

    combatState.boss.hp -= atk;
    combatState.totalDamageDealt += atk;
    fightInfo.textContent = isCrit ? `¡CRÍTICO! ${atk} daño.` : `Atacas: ${atk} daño.`;

    const enemyEl = document.querySelector('#enemy');
    if (enemyEl) {
        const hitClass = isCrit || atk >= 5 ? 'hit-hard' : 'hit';
        enemyEl.classList.remove('hit', 'hit-hard');
        void enemyEl.offsetWidth;
        enemyEl.classList.add(hitClass);
        setTimeout(() => enemyEl.classList.remove(hitClass), 500);
        createDamageNumber(atk, enemyEl, isCrit ? 'crit' : 'dmg');
    }

    if (isCrit) { vibrate([30, 20, 60]); screenFlash('gold'); }
    else vibrate(30);

    renderResources(); renderCombatUI();

    if (combatState.boss.hp <= 0) {
        const t = combatState.boss;
        log(`${t.name} ha sido derrotado.`, 'good');
        S.stats.bossesDefeated++;
        window.dispatchEvent(new CustomEvent('lys-unlock-achievement', { detail: { key: t.key, mk: `Derrotaste a ${t.name}` } }));

        const duration = Date.now() - combatState.startTime;
        integrator.onBossDefeated(S, t.name, combatState.totalDamageDealt, combatState.totalDamageTaken, duration, log);

        const xpReward = 15 + Math.floor(t.max / 2);
        addXP(xpReward);
        xpFlash();
        screenFlash('gold');
        fireConfetti();

        S.threat = null;
        bossTag.textContent = '👁️ Sin amenaza';
        toast(`🏆 ¡Victoria! +${xpReward} XP`);
        closeCombat();
        return;
    }
    combatState.turn = 'enemy';
    setTimeout(enemyTurn, 700);
});

btnDefend.addEventListener('click', () => {
    if (!combatState || combatState.turn !== 'player') return;
    disableCombatBtns();
    S.player.guard = true;
    fightInfo.textContent = '🛡️ Te cubres tras tu escudo.';
    vibrate(20);
    combatState.turn = 'enemy';
    setTimeout(enemyTurn, 600);
});

btnHeal.addEventListener('click', () => {
    if (!combatState || combatState.turn !== 'player') return;
    if (S.resources.medicina > 0) {
        disableCombatBtns();
        S.resources.medicina--;
        const amount = 20 + Math.floor(S.player.level * 2);
        S.player.hp = Math.min(S.player.maxHp, S.player.hp + amount);
        fightInfo.textContent = `💊 Recuperas ${amount} HP.`;
        const playerEl = document.querySelector('#warrior');
        createDamageNumber(amount, playerEl, 'heal');
        if (playerEl) {
            playerEl.classList.add('attack');
            setTimeout(() => playerEl.classList.remove('attack'), 300);
        }
        screenFlash('green');
        renderResources(); updateTags(); saveState();
        renderCombatUI();
        combatState.turn = 'enemy';
        setTimeout(enemyTurn, 600);
    } else {
        fightInfo.textContent = '❌ No te quedan medicinas.';
    }
});

// Encounter
export function showEncounterPrompt() {
    if (!S.threat) return;
    encounterTitle.textContent = S.threat.name;
    encounterInfo.textContent = `${S.threat.icon} ¿Deseas enfrentarte?`;
    let remain = 10;
    encounterCountdown.textContent = String(remain);
    if (encounterTimerBar) encounterTimerBar.style.width = '100%';
    encounterOverlay.classList.remove('hidden');

    clearInterval(encounterTimer);
    encounterTimer = setInterval(() => {
        remain--;
        encounterCountdown.textContent = String(remain);
        if (encounterTimerBar) encounterTimerBar.style.width = (remain / 10 * 100) + '%';
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
    log('Has decidido no luchar.', 'dim');
});
