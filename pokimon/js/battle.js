window.Game = window.Game || {};

Game.Battle = {
    active: false,
    playerTeam: null,
    playerMon: null,
    enemyMon: null,
    enemyTeam: null,
    enemyTeamIndex: 0,
    isTrainerBattle: false,
    trainerData: null,
    state: null,
    events: [],
    eventIndex: 0,
    menuCursor: 0,
    moveCursor: 0,
    switchCursor: 0,
    itemCursor: 0,
    itemTargetCursor: 0,
    result: null,
    turnPhase: 0,
    pendingMoves: [],
    pendingEvolutions: [],
    captureResult: false,
    captureShakes: 0,

    start: function(playerTeam, enemyMonOrTeam, trainerData) {
        this.active = true;
        this.playerTeam = playerTeam;
        this.playerMon = this.getFirstAlive();
        this.isTrainerBattle = !!trainerData;
        this.trainerData = trainerData || null;
        this.pendingMoves = [];
        this.pendingEvolutions = [];

        if (Array.isArray(enemyMonOrTeam)) {
            this.enemyTeam = enemyMonOrTeam;
        } else {
            this.enemyTeam = [enemyMonOrTeam];
        }
        this.enemyTeamIndex = 0;
        this.enemyMon = this.enemyTeam[0];

        this.state = 'INTRO';
        this.events = [];
        this.eventIndex = 0;
        this.menuCursor = 0;
        this.moveCursor = 0;
        this.switchCursor = 0;
        this.itemCursor = 0;
        this.result = null;
        this.turnPhase = 0;

        if (this.isTrainerBattle) {
            this.pushMessage(trainerData.name + ': ' + trainerData.preText);
            this.pushMessage(trainerData.name + ' envia a ' + this.enemyMon.name + '!');
        } else {
            this.pushMessage('Un ' + this.enemyMon.name + ' salvaje aparece!');
        }
        this.pushMessage('Ve, ' + this.playerMon.name + '!');

        Game.BattleUI.resetAnim();
    },

    getFirstAlive: function() {
        for (var i = 0; i < this.playerTeam.length; i++) {
            if (!this.playerTeam[i].isFainted()) return this.playerTeam[i];
        }
        return null;
    },

    getAllAliveIndices: function() {
        var result = [];
        for (var i = 0; i < this.playerTeam.length; i++) {
            if (!this.playerTeam[i].isFainted() && this.playerTeam[i] !== this.playerMon) {
                result.push(i);
            }
        }
        return result;
    },

    pushMessage: function(text) {
        this.events.push({ type: 'message', text: text });
    },

    update: function() {
        var input = Game.Input;
        switch (this.state) {
            case 'INTRO': this.updateIntro(); break;
            case 'SELECT_ACTION': this.updateSelectAction(); break;
            case 'SELECT_MOVE': this.updateSelectMove(); break;
            case 'SELECT_SWITCH': this.updateSelectSwitch(); break;
            case 'SELECT_ITEM': this.updateSelectItem(); break;
            case 'SELECT_ITEM_TARGET': this.updateSelectItemTarget(); break;
            case 'ANIMATING': this.updateAnimating(); break;
            case 'FORCE_SWITCH': break;
            case 'CAPTURING': this.updateCapturing(); break;
            case 'VICTORY':
            case 'DEFEAT':
            case 'RAN_AWAY':
                if (input.confirm()) {
                    this.active = false;
                    this.result = this.state;
                }
                break;
        }
    },

    updateIntro: function() {
        if (Game.Input.confirm()) {
            Game.Audio.playConfirm();
            this.eventIndex++;
            if (this.eventIndex >= this.events.length) {
                this.state = 'SELECT_ACTION';
                this.events = [];
                this.eventIndex = 0;
                this.menuCursor = 0;
            }
        }
    },

    updateSelectAction: function() {
        var input = Game.Input;
        var oldCursor = this.menuCursor;
        if (input.up() && this.menuCursor >= 2) this.menuCursor -= 2;
        if (input.down() && this.menuCursor < 2) this.menuCursor += 2;
        if (input.left() && this.menuCursor % 2 === 1) this.menuCursor--;
        if (input.right() && this.menuCursor % 2 === 0) this.menuCursor++;
        this.menuCursor = Game.Utils.clamp(this.menuCursor, 0, 3);
        if (this.menuCursor !== oldCursor) Game.Audio.playSelect();

        if (input.confirm()) {
            Game.Audio.playConfirm();
            switch (this.menuCursor) {
                case 0:
                    this.state = 'SELECT_MOVE';
                    this.moveCursor = 0;
                    break;
                case 1:
                    if (Game.Inventory && Game.Inventory.hasAny()) {
                        this.state = 'SELECT_ITEM';
                        this.itemCursor = 0;
                    } else { Game.Audio.playError(); }
                    break;
                case 2:
                    var alive = this.getAllAliveIndices();
                    if (alive.length > 0) {
                        this.state = 'SELECT_SWITCH';
                        this.switchCursor = 0;
                    } else { Game.Audio.playError(); }
                    break;
                case 3:
                    if (this.isTrainerBattle) {
                        this.events = [];
                        this.eventIndex = 0;
                        this.pushMessage('No puedes huir de un combate!');
                        this.state = 'ANIMATING';
                        Game.Audio.playError();
                    } else {
                        this.attemptRun();
                    }
                    break;
            }
        }
    },

    updateSelectMove: function() {
        var input = Game.Input;
        var moveCount = this.playerMon.moves.length;
        var old = this.moveCursor;
        if (input.up() && this.moveCursor >= 2) this.moveCursor -= 2;
        if (input.down() && this.moveCursor + 2 < moveCount) this.moveCursor += 2;
        if (input.left() && this.moveCursor % 2 !== 0) this.moveCursor--;
        if (input.right() && this.moveCursor % 2 === 0 && this.moveCursor + 1 < moveCount) this.moveCursor++;
        if (this.moveCursor !== old) Game.Audio.playSelect();

        if (input.cancel()) {
            Game.Audio.playCancel();
            this.state = 'SELECT_ACTION';
            this.menuCursor = 0;
            return;
        }
        if (input.confirm()) {
            var move = this.playerMon.moves[this.moveCursor];
            if (move.currentPP <= 0) { Game.Audio.playError(); return; }
            Game.Audio.playConfirm();
            this.executeTurn('move', this.moveCursor);
        }
    },

    updateSelectSwitch: function() {
        var input = Game.Input;
        var alive = this.getAllAliveIndices();
        var old = this.switchCursor;
        if (input.up() && this.switchCursor > 0) this.switchCursor--;
        if (input.down() && this.switchCursor < alive.length - 1) this.switchCursor++;
        if (this.switchCursor !== old) Game.Audio.playSelect();
        if (input.cancel()) {
            Game.Audio.playCancel();
            this.state = 'SELECT_ACTION';
            this.menuCursor = 2;
            return;
        }
        if (input.confirm() && alive.length > 0) {
            Game.Audio.playConfirm();
            var idx = alive[this.switchCursor];
            this.executeTurn('switch', idx);
        }
    },

    updateSelectItem: function() {
        var input = Game.Input;
        var items = Game.Inventory.getBattleItems();
        var old = this.itemCursor;
        if (input.up() && this.itemCursor > 0) this.itemCursor--;
        if (input.down() && this.itemCursor < items.length - 1) this.itemCursor++;
        if (this.itemCursor !== old) Game.Audio.playSelect();
        if (input.cancel()) {
            Game.Audio.playCancel();
            this.state = 'SELECT_ACTION';
            this.menuCursor = 1;
            return;
        }
        if (input.confirm() && items.length > 0) {
            var item = items[this.itemCursor];
            var def = Game.Items[item.id];

            if (def.type === 'capture') {
                if (this.isTrainerBattle) {
                    this.events = []; this.eventIndex = 0;
                    this.pushMessage('No puedes capturar monstruos de entrenador!');
                    this.state = 'ANIMATING';
                    Game.Audio.playError();
                    return;
                }
                if (this.playerTeam.length >= Game.Constants.MAX_TEAM_SIZE) {
                    this.events = []; this.eventIndex = 0;
                    this.pushMessage('Tu equipo esta lleno!');
                    this.state = 'ANIMATING';
                    Game.Audio.playError();
                    return;
                }
                Game.Audio.playConfirm();
                Game.Inventory.remove(item.id);
                this.attemptCapture();
                return;
            }
            if (def.type === 'revive') {
                this.pendingItem = item.id;
                this.itemTargetCursor = 0;
                this.state = 'SELECT_ITEM_TARGET';
                Game.Audio.playConfirm();
            } else if (def.type === 'heal') {
                if (this.playerMon.currentHP < this.playerMon.maxHP && !this.playerMon.isFainted()) {
                    Game.Audio.playConfirm();
                    this.useItemInBattle(item.id, this.playerMon);
                } else { Game.Audio.playError(); }
            } else if (def.type === 'status') {
                if (this.playerMon.status !== null) {
                    Game.Audio.playConfirm();
                    this.useItemInBattle(item.id, this.playerMon);
                } else { Game.Audio.playError(); }
            }
        }
    },

    updateSelectItemTarget: function() {
        var input = Game.Input;
        var targets = this.getItemTargets(this.pendingItem);
        var old = this.itemTargetCursor;
        if (input.up() && this.itemTargetCursor > 0) this.itemTargetCursor--;
        if (input.down() && this.itemTargetCursor < targets.length - 1) this.itemTargetCursor++;
        if (this.itemTargetCursor !== old) Game.Audio.playSelect();
        if (input.cancel()) { Game.Audio.playCancel(); this.state = 'SELECT_ITEM'; return; }
        if (input.confirm() && targets.length > 0) {
            Game.Audio.playConfirm();
            var target = this.playerTeam[targets[this.itemTargetCursor]];
            this.useItemInBattle(this.pendingItem, target);
        }
    },

    getItemTargets: function(itemId) {
        var def = Game.Items[itemId];
        var targets = [];
        for (var i = 0; i < this.playerTeam.length; i++) {
            var mon = this.playerTeam[i];
            if (def.type === 'revive' && mon.isFainted()) targets.push(i);
            else if (def.type === 'heal' && !mon.isFainted() && mon.currentHP < mon.maxHP) targets.push(i);
            else if (def.type === 'status' && !mon.isFainted() && mon.status !== null) targets.push(i);
        }
        return targets;
    },

    useItemInBattle: function(itemId, target) {
        var def = Game.Items[itemId];
        Game.Inventory.remove(itemId);
        this.events = [];
        this.eventIndex = 0;

        if (def.type === 'heal') {
            var before = target.currentHP;
            target.heal(def.value);
            var healed = target.currentHP - before;
            this.pushMessage('Usaste ' + def.name + '!');
            this.pushMessage(target.name + ' recupero ' + healed + ' HP!');
            Game.Audio.playHeal();
        } else if (def.type === 'status') {
            target.clearStatus();
            this.pushMessage('Usaste ' + def.name + '!');
            this.pushMessage(target.name + ' se curo del estado!');
            Game.Audio.playHeal();
        } else if (def.type === 'revive') {
            target.currentHP = Math.floor(target.maxHP * 0.5);
            this.pushMessage('Usaste ' + def.name + '!');
            this.pushMessage(target.name + ' revivio!');
            Game.Audio.playHeal();
        }

        var enemyMove = this.pickEnemyMove();
        this.doAttack(this.enemyMon, this.playerMon, enemyMove, true);
        this.state = 'ANIMATING';
    },

    attemptCapture: function() {
        var mon = this.enemyMon;
        var hpRatio = mon.currentHP / mon.maxHP;
        var catchRate = 1 - hpRatio * 0.666;
        var statusMod = 1;
        if (mon.status === 'paralysis') statusMod = 2;
        else if (mon.status === 'poison' || mon.status === 'burn') statusMod = 1.5;
        catchRate *= statusMod;
        catchRate = Game.Utils.clamp(catchRate, 0.05, 0.95);

        var caught = Game.Utils.chance(catchRate);
        var shakes = caught ? 3 : Math.floor(Math.random() * 3);

        this.captureResult = caught;
        this.captureShakes = shakes;
        this.events = [];
        this.eventIndex = 0;
        this.pushMessage('Lanzaste una Pokeball!');
        this.state = 'CAPTURING';

        Game.BattleUI.startCapture(shakes, caught);
    },

    updateCapturing: function() {
        if (Game.BattleUI.captureAnim) return;

        if (this.captureResult) {
            var wildMon = Game.createMonster(this.enemyMon.species.id, this.enemyMon.level);
            wildMon.currentHP = this.enemyMon.currentHP;
            wildMon.status = this.enemyMon.status;
            for (var i = 0; i < wildMon.moves.length && i < this.enemyMon.moves.length; i++) {
                wildMon.moves[i].currentPP = this.enemyMon.moves[i].currentPP;
            }
            this.playerTeam.push(wildMon);
            this.events = [];
            this.eventIndex = 0;
            this.pushMessage(this.enemyMon.name + ' fue capturado!');
            Game.Audio.playCapture();
            this.state = 'VICTORY';
            if (Game.Save) Game.Save.save();
        } else {
            this.events = [];
            this.eventIndex = 0;
            this.pushMessage('Oh no! Se escapo!');
            Game.Audio.playCaptureFail();
            var enemyMove = this.pickEnemyMove();
            this.doAttack(this.enemyMon, this.playerMon, enemyMove, true);
            this.state = 'ANIMATING';
        }
    },

    updateAnimating: function() {
        var evt = this.getCurrentEvent();
        if (evt && evt.type === 'damage') {
            Game.BattleUI.triggerDamageFlash(evt.target, evt.moveType, evt.amount, evt.crit);
            if (evt.crit) Game.Audio.playCrit();
            else if (evt.amount > 0) Game.Audio.playHit();
            this.eventIndex++;
            return;
        }

        if (Game.Input.confirm()) {
            this.eventIndex++;
            if (this.eventIndex >= this.events.length) {
                if (this.enemyMon.isFainted()) {
                    if (this.isTrainerBattle && this.enemyTeamIndex < this.enemyTeam.length - 1) {
                        this.enemyTeamIndex++;
                        this.enemyMon = this.enemyTeam[this.enemyTeamIndex];
                        this.events = [];
                        this.eventIndex = 0;
                        this.pushMessage(this.trainerData.name + ' envia a ' + this.enemyMon.name + '!');
                        this.state = 'ANIMATING';
                        return;
                    }
                    this.handleVictory();
                    return;
                }
                if (this.playerMon.isFainted()) {
                    this.handlePlayerFaint();
                    return;
                }
                this.state = 'SELECT_ACTION';
                this.events = [];
                this.eventIndex = 0;
                this.menuCursor = 0;
            }
        }
    },

    executeTurn: function(action, param) {
        this.events = [];
        this.eventIndex = 0;

        if (action === 'move') {
            var playerMove = this.playerMon.moves[param];
            var enemyMove = this.pickEnemyMove();
            var playerSpeed = this.playerMon.stats.speed;
            var enemySpeed = this.enemyMon.stats.speed;
            if (this.playerMon.status === 'paralysis') playerSpeed = Math.floor(playerSpeed * 0.5);
            if (this.enemyMon.status === 'paralysis') enemySpeed = Math.floor(enemySpeed * 0.5);
            var playerFirst = true;
            if (playerMove.priority && !enemyMove.priority) playerFirst = true;
            else if (!playerMove.priority && enemyMove.priority) playerFirst = false;
            else {
                playerFirst = playerSpeed >= enemySpeed;
                if (playerSpeed === enemySpeed) playerFirst = Game.Utils.chance(0.5);
            }

            if (playerFirst) {
                this.doAttack(this.playerMon, this.enemyMon, playerMove, false);
                if (!this.enemyMon.isFainted()) this.doAttack(this.enemyMon, this.playerMon, enemyMove, true);
            } else {
                this.doAttack(this.enemyMon, this.playerMon, enemyMove, true);
                if (!this.playerMon.isFainted()) this.doAttack(this.playerMon, this.enemyMon, playerMove, false);
            }
            this.applyEndOfTurnEffects();
        } else if (action === 'switch') {
            var newMon = this.playerTeam[param];
            this.pushMessage(this.playerMon.name + ', vuelve!');
            this.playerMon = newMon;
            this.pushMessage('Ve, ' + this.playerMon.name + '!');
            var enemyMove = this.pickEnemyMove();
            this.doAttack(this.enemyMon, this.playerMon, enemyMove, true);
            this.applyEndOfTurnEffects();
        }
        this.state = 'ANIMATING';
    },

    doAttack: function(attacker, defender, move, isEnemy) {
        var prefix = isEnemy ? (attacker.name + ' enemigo') : this.playerMon.name;

        if (attacker.isFainted()) return;

        if (attacker.status === 'paralysis' && Game.Utils.chance(0.25)) {
            this.pushMessage(prefix + ' esta paralizado!');
            return;
        }

        this.pushMessage(prefix + ' usa ' + move.name + '!');

        if (move.currentPP !== undefined) {
            move.currentPP = Math.max(0, move.currentPP - 1);
        }

        if (move.category === 'status') {
            if (!Game.Utils.chance(move.accuracy / 100)) {
                this.pushMessage('El ataque fallo!');
                Game.Audio.playMiss();
                return;
            }
            if (move.statusEffect && defender.status === null) {
                defender.setStatus(move.statusEffect);
                this.pushMessage(defender.name + ' fue ' + this.getStatusText(move.statusEffect) + '!');
            } else {
                this.pushMessage('No tuvo efecto...');
            }
            return;
        }

        var result = Game.Utils.calcDamage(attacker, defender, move);
        if (result.missed) {
            this.pushMessage('El ataque fallo!');
            Game.Audio.playMiss();
            return;
        }

        defender.takeDamage(result.damage);
        this.events.push({
            type: 'damage',
            target: isEnemy ? 'player' : 'enemy',
            attacker: isEnemy ? 'enemy' : 'player',
            amount: result.damage,
            moveType: move.type,
            crit: result.critical
        });

        if (result.critical) this.pushMessage('Golpe critico!');
        if (result.effectiveness > 1) {
            this.pushMessage('Es super efectivo!');
            Game.Audio.playSuperEffective();
        } else if (result.effectiveness < 1) {
            this.pushMessage('No es muy efectivo...');
            Game.Audio.playNotEffective();
        }

        if (move.statusEffect && !defender.isFainted() && defender.status === null) {
            if (Game.Utils.chance(move.statusChance)) {
                defender.setStatus(move.statusEffect);
                this.pushMessage(defender.name + ' fue ' + this.getStatusText(move.statusEffect) + '!');
            }
        }

        if (defender.isFainted()) {
            defender.clearStatus();
            this.pushMessage(defender.name + ' se debilito!');
            Game.Audio.playFaint();
        }
    },

    getStatusText: function(status) {
        switch (status) {
            case 'poison': return 'envenenado';
            case 'burn': return 'quemado';
            case 'paralysis': return 'paralizado';
            default: return 'afectado';
        }
    },

    applyEndOfTurnEffects: function() {
        this.applyStatusDamage(this.playerMon, false);
        this.applyStatusDamage(this.enemyMon, true);
    },

    applyStatusDamage: function(mon, isEnemy) {
        if (mon.isFainted() || !mon.status) return;
        var dmg = 0;
        if (mon.status === 'poison') {
            dmg = Math.max(1, Math.floor(mon.maxHP / 8));
            mon.takeDamage(dmg);
            this.pushMessage(mon.name + ' sufre por el veneno! (-' + dmg + ')');
        } else if (mon.status === 'burn') {
            dmg = Math.max(1, Math.floor(mon.maxHP / 16));
            mon.takeDamage(dmg);
            this.pushMessage(mon.name + ' sufre por la quemadura! (-' + dmg + ')');
        }
        if (dmg > 0) {
            this.events.push({ type: 'damage', target: isEnemy ? 'enemy' : 'player', attacker: null, amount: dmg, moveType: null, crit: false });
        }
        if (mon.isFainted()) {
            mon.clearStatus();
            this.pushMessage(mon.name + ' se debilito!');
            Game.Audio.playFaint();
        }
    },

    pickEnemyMove: function() {
        var available = [];
        for (var i = 0; i < this.enemyMon.moves.length; i++) {
            if (this.enemyMon.moves[i].currentPP > 0) available.push(this.enemyMon.moves[i]);
        }
        if (available.length === 0) {
            return { id: 'struggle', name: 'Forcejeo', type: 'normal', power: 50, accuracy: 100, category: 'physical', pp: 1, currentPP: 1 };
        }

        var scored = [];
        var C = Game.Constants;
        for (var j = 0; j < available.length; j++) {
            var m = available[j];
            var score = 1;
            if (m.power > 0) {
                var typeEff = C.TYPE_CHART[m.type] && C.TYPE_CHART[m.type][this.playerMon.species.type];
                if (typeEff === undefined) typeEff = 1;
                if (typeEff >= 2) score += 3;
                else if (typeEff > 1) score += 1.5;
                else if (typeEff < 1) score -= 1;
                if (m.type === this.enemyMon.species.type) score += 0.5;
                if (this.playerMon.currentHP <= this.playerMon.maxHP * 0.3 && m.priority) score += 2;
                score += m.power / 80;
            }
            if (m.category === 'status') {
                if (this.playerMon.status !== null) score = 0.1;
                else score = 1.5;
            }
            scored.push({ move: m, score: Math.max(0.1, score) });
        }

        scored.sort(function(a, b) { return b.score - a.score; });
        if (scored.length >= 2 && Game.Utils.chance(0.3)) return scored[1].move;
        return scored[0].move;
    },

    attemptRun: function() {
        var playerSpeed = this.playerMon.stats.speed;
        if (this.playerMon.status === 'paralysis') playerSpeed = Math.floor(playerSpeed * 0.5);
        var runChance = (playerSpeed / this.enemyMon.stats.speed) * 0.5 + 0.3;
        runChance = Game.Utils.clamp(runChance, 0.2, 0.9);
        this.events = [];
        this.eventIndex = 0;
        if (Game.Utils.chance(runChance)) {
            this.pushMessage('Escapaste con exito!');
            Game.Audio.playRun();
            this.state = 'RAN_AWAY';
        } else {
            this.pushMessage('No pudiste escapar!');
            var enemyMove = this.pickEnemyMove();
            this.doAttack(this.enemyMon, this.playerMon, enemyMove, true);
            this.state = 'ANIMATING';
        }
    },

    handleVictory: function() {
        var totalXP = 0;
        for (var e = 0; e < this.enemyTeam.length; e++) {
            totalXP += Game.Utils.calcXP(this.enemyTeam[e].species.xpYield, this.enemyTeam[e].level);
        }

        this.events = [];
        this.eventIndex = 0;

        if (this.isTrainerBattle) {
            var reward = this.trainerData.reward || 0;
            Game.Inventory.money += reward;
            this.pushMessage(this.trainerData.name + ': ' + this.trainerData.postText);
            if (reward > 0) this.pushMessage('Ganaste ' + reward + ' monedas!');
        } else {
            var moneyGain = this.enemyMon.level * 20;
            Game.Inventory.money += moneyGain;
            this.pushMessage('Ganaste ' + moneyGain + ' monedas!');
        }

        this.pushMessage(this.playerMon.name + ' gano ' + totalXP + ' EXP!');
        var result = this.playerMon.addXP(totalXP);

        for (var i = 0; i < result.levels.length; i++) {
            this.pushMessage(this.playerMon.name + ' subio al nivel ' + result.levels[i] + '!');
            Game.Audio.playLevelUp();
        }

        if (result.pendingMoves.length > 0) {
            this.pendingMoves = result.pendingMoves;
        }
        if (result.evolutionReady) {
            this.pendingEvolutions.push(this.playerMon);
        }

        if (!this.isTrainerBattle && Game.Inventory && Game.Utils.chance(0.2)) {
            var drops = ['potion', 'antidote'];
            var drop = Game.Utils.pick(drops);
            Game.Inventory.add(drop);
            this.pushMessage('Encontraste un/a ' + Game.Items[drop].name + '!');
        }

        this.pushMessage('Victoria!');
        this.state = 'VICTORY';
        if (Game.Save) Game.Save.save();
    },

    handlePlayerFaint: function() {
        var nextAlive = this.getFirstAlive();
        if (!nextAlive) {
            this.events = [];
            this.eventIndex = 0;
            this.pushMessage('Todos tus monstruos se debilitaron!');
            this.state = 'DEFEAT';
        } else {
            this.events = [];
            this.eventIndex = 0;
            var alive = this.getAllAliveIndices();
            if (alive.length === 0) {
                this.playerMon = nextAlive;
                this.pushMessage('Ve, ' + this.playerMon.name + '!');
                this.state = 'ANIMATING';
            } else {
                this.state = 'FORCE_SWITCH';
                this.switchCursor = 0;
            }
        }
    },

    getCurrentEvent: function() {
        if (this.eventIndex < this.events.length) return this.events[this.eventIndex];
        return null;
    }
};
