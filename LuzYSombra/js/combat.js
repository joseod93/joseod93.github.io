
import { $, sleep, vibrate } from './utils.js';
import { AudioSystem } from './audio.js';
import { S, saveState } from './state.js';
import { log, toast, updateTags, renderResources, addXP, xpFlash, screenFlash, fireConfetti } from './ui.js';
import integrator from './integrator.js';
import { ENEMIES } from './constants.js';

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

const btnDodge = $('#btnDodge');
const btnPotion = $('#btnPotion');
const btnBomb = $('#btnBomb');
const combatDifficulty = $('#combatDifficulty');

let combatState = null;
let encounterTimer = null;

function createDamageNumber(amount, targetEl, type = 'dmg') {
    if (!targetEl) return;
    const el = document.createElement('div');
    el.className = 'dmg-num' + (type === 'heal' ? ' heal' : type === 'crit' ? ' crit' : '');
    el.textContent = type === 'crit' ? `💥 -${amount}` : type === 'heal' ? `+${amount}` : `-${amount}`;
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

function getDifficultyLabel(bossLevel) {
    const playerLevel = S.player.level;
    const diff = bossLevel - playerLevel;
    if (diff <= -3) return { text: 'Fácil', cls: 'difficulty-easy' };
    if (diff <= 0)  return { text: 'Normal', cls: 'difficulty-medium' };
    if (diff <= 3)  return { text: 'Difícil', cls: 'difficulty-hard' };
    return { text: 'Extremo', cls: 'difficulty-extreme' };
}

function getSkillEffects() {
    try {
        // Dynamic import not ideal but avoids circular deps at load time
        const skills = S.skills || {};
        const effects = {};
        // Manually aggregate from state — no import needed
        if (skills.swordMastery) effects.bonusAtk = skills.swordMastery;
        if (skills.ironSkin) effects.dmgReduction = skills.ironSkin * 0.1;
        if (skills.criticalEye) effects.critBonus = skills.criticalEye * 0.05;
        if (skills.dodgeReflex) effects.dodgeChance = skills.dodgeReflex * 0.08;
        return effects;
    } catch { return {}; }
}

export function openCombat(enemy = null) {
    const target = enemy || S.threat;
    if (!target) return;
    combatState = {
        boss: target,
        isRegularEnemy: !!enemy,
        turn: 'player',
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        startTime: Date.now(),
        potionUsed: false
    };
    fightTitle.textContent = `⚔️ ${target.name}`;
    fightInfo.textContent = 'Tu turno. ¡Elige una acción!';
    fightFooter.textContent = '';

    // Difficulty indicator
    const bossLevel = target.level || Math.ceil(target.max / 5);
    const diff = getDifficultyLabel(bossLevel);
    if (combatDifficulty) {
        combatDifficulty.textContent = `Nivel recomendado: ${bossLevel} — ${diff.text}`;
        combatDifficulty.className = `combat-difficulty ${diff.cls}`;
    }

    fightOverlay.classList.remove('hidden');
    renderCombatUI();
    enableCombatBtns();
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
    if (btnDodge) btnDodge.disabled = false;
    if (btnPotion) {
        btnPotion.disabled = !(S.consumables?.pocion > 0) || combatState.potionUsed;
        btnPotion.textContent = `🧪 Poción (${S.consumables?.pocion || 0})`;
    }
    if (btnBomb) {
        btnBomb.disabled = !(S.consumables?.bomba > 0);
        btnBomb.textContent = `💣 Huir (${S.consumables?.bomba || 0})`;
    }
}

function disableAllCombatBtns() {
    disableCombatBtns();
    if (btnDodge) btnDodge.disabled = true;
    if (btnPotion) btnPotion.disabled = true;
    if (btnBomb) btnBomb.disabled = true;
}

function enemyTurn() {
    if (!combatState) return;
    AudioSystem.playTone('fight');

    const enemyAtk = combatState.boss.atk || (6 + Math.floor(Math.random() * 4));
    const base = enemyAtk + Math.floor(Math.random() * 3);
    let dmg = base;

    // Armor reduction
    const armorReduction = (S.equipment?.armadura || 0) * 0.2;
    const effects = getSkillEffects();
    const skillReduction = effects.dmgReduction || 0;
    dmg = Math.max(1, Math.floor(dmg * (1 - armorReduction - skillReduction)));

    if (S.player.guard === 'dodge') {
        dmg = 0;
        fightInfo.textContent = '💨 ¡Esquivaste el ataque!';
        S.player.guard = false;
        renderCombatUI();
        combatState.turn = 'player';
        enableCombatBtns();
        fightInfo.textContent += ' ¡Tu turno!';
        return;
    }

    if (S.player.guard) {
        const shieldBonus = (S.equipment?.escudo || 0) * 0.1;
        dmg = Math.max(0, Math.floor(base * (0.3 - shieldBonus)));
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

    // Enemy rush animation
    const rushEl = document.querySelector('#enemy');
    if (rushEl) {
        rushEl.classList.remove('enemy-rush');
        void rushEl.offsetWidth;
        rushEl.classList.add('enemy-rush');
        setTimeout(() => rushEl.classList.remove('enemy-rush'), 400);
    }

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
    disableAllCombatBtns();

    const effects = getSkillEffects();
    const critChance = 0.15 + (effects.critBonus || 0);
    const isCrit = Math.random() < critChance;
    let atk = 1 + (S.resources.antorchas > 0 ? 1 : 0) + (S.unlocked.forge ? 1 : 0);
    atk += (effects.bonusAtk || 0);
    atk += (S.equipment?.espada || 0) * 2;
    const levelBonus = Math.floor(S.player.level / 5);
    atk += levelBonus;
    if (combatState.potionUsed) { atk *= 2; combatState.potionUsed = false; }
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

    AudioSystem.playTone('fight');
    if (isCrit) {
        vibrate([30, 20, 60]); screenFlash('gold');
        document.body.classList.remove('screen-shake');
        void document.body.offsetWidth;
        document.body.classList.add('screen-shake');
        setTimeout(() => document.body.classList.remove('screen-shake'), 500);
    }
    else vibrate(30);

    renderResources(); renderCombatUI();

    if (combatState.boss.hp <= 0) {
        const t = combatState.boss;
        const isRegular = combatState.isRegularEnemy;

        if (isRegular) {
            // Regular enemy rewards
            log(`${t.name} ha sido derrotado.`, 'good');
            S.enemiesDefeated = (S.enemiesDefeated || 0) + 1;
            if (t.loot) {
                t.loot.forEach(l => {
                    const n = l.n[0] + Math.floor(Math.random() * (l.n[1] - l.n[0] + 1));
                    S.resources[l.k] = (S.resources[l.k] || 0) + n;
                });
            }
            const xpReward = 5 + Math.floor((t.max || t.hp) / 2);
            addXP(xpReward);
            xpFlash();
            screenFlash('green');
            toast(`Victoria: ${t.name} +${xpReward} XP`);
        } else {
            // Boss rewards
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
            if (bossTag) bossTag.textContent = '👁️ Sin amenaza';
            toast(`🏆 ¡Victoria! +${xpReward} XP`);
        }

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
    AudioSystem.playTone('block');
    vibrate(20);
    const defPlayerEl = document.querySelector('#warrior');
    if (defPlayerEl) {
        defPlayerEl.classList.add('defending');
        setTimeout(() => defPlayerEl.classList.remove('defending'), 1000);
    }
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
        AudioSystem.playTone('heal');
        const playerEl = document.querySelector('#warrior');
        createDamageNumber(amount, playerEl, 'heal');
        if (playerEl) {
            playerEl.classList.add('attack');
            setTimeout(() => playerEl.classList.remove('attack'), 300);
            // Heal particles
            for (let i = 0; i < 5; i++) {
                const p = document.createElement('span');
                p.className = 'heal-particle';
                p.textContent = '✚';
                p.style.left = (30 + Math.random() * 60) + 'px';
                p.style.bottom = '20px';
                p.style.animationDelay = (Math.random() * 0.3) + 's';
                playerEl.appendChild(p);
                setTimeout(() => p.remove(), 1000);
            }
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
    const bossLevel = S.threat.level || Math.ceil(S.threat.max / 5);
    const diff = getDifficultyLabel(bossLevel);
    encounterTitle.textContent = S.threat.name;
    encounterInfo.textContent = `${S.threat.icon} ¿Deseas enfrentarte?`;
    encounterInfo.innerHTML += `<br><small class="${diff.cls}">Nivel ${bossLevel} — ${diff.text}</small>`;
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

// Dodge action
if (btnDodge) btnDodge.addEventListener('click', () => {
    if (!combatState || combatState.turn !== 'player') return;
    disableAllCombatBtns();

    const effects = getSkillEffects();
    const dodgeChance = 0.4 + (effects.dodgeChance || 0);
    const escaped = Math.random() < dodgeChance;

    if (escaped) {
        fightInfo.textContent = '💨 ¡Esquivas el siguiente ataque!';
        S.player.guard = 'dodge';
    } else {
        fightInfo.textContent = '💨 Intentas esquivar pero fallas...';
    }
    AudioSystem.playTone('explore');
    vibrate(20);
    combatState.turn = 'enemy';
    setTimeout(enemyTurn, 600);
});

// Potion (strength boost)
if (btnPotion) btnPotion.addEventListener('click', () => {
    if (!combatState || combatState.turn !== 'player') return;
    if (!S.consumables?.pocion || S.consumables.pocion <= 0) return;
    S.consumables.pocion--;
    combatState.potionUsed = true;
    fightInfo.textContent = '🧪 ¡Poción de fuerza! Tu próximo ataque hará x2 daño.';
    AudioSystem.playTone('heal');
    vibrate(30);
    enableCombatBtns();
    // Don't end turn — player still needs to attack
});

// Bomb (escape combat)
if (btnBomb) btnBomb.addEventListener('click', () => {
    if (!combatState || combatState.turn !== 'player') return;
    if (!S.consumables?.bomba || S.consumables.bomba <= 0) return;
    S.consumables.bomba--;
    fightInfo.textContent = '💣 ¡Bomba de humo! Escapas del combate.';
    log('Usas una bomba de humo para huir.', 'dim');
    AudioSystem.playTone('explore');
    vibrate([30, 20, 30]);
    closeCombat();
});

// Regular enemy combat (exported for use in expeditions)
export function startEnemyEncounter(enemy) {
    const instance = {
        key: 'enemy_' + Date.now(),
        name: enemy.name,
        icon: enemy.icon,
        hp: enemy.hp,
        max: enemy.hp,
        atk: enemy.atk,
        level: enemy.level,
        loot: enemy.loot,
        endsAt: Date.now() + 120000,
        region: ''
    };
    openCombat(instance);
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
