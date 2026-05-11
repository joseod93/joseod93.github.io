window.Game = window.Game || {};

Game.Battle = {
    active: false,
    playerTeam: null,
    playerMon: null,
    enemyMon: null,
    state: null,
    events: [],
    eventIndex: 0,
    menuCursor: 0,
    moveCursor: 0,
    switchCursor: 0,
    canCapture: false,
    result: null,

    start: function(playerTeam, enemyMon) {
        this.active = true;
        this.playerTeam = playerTeam;
        this.playerMon = this.getFirstAlive();
        this.enemyMon = enemyMon;
        this.state = 'INTRO';
        this.events = [];
        this.eventIndex = 0;
        this.menuCursor = 0;
        this.moveCursor = 0;
        this.switchCursor = 0;
        this.result = null;
        this.turnPhase = 0;

        this.pushMessage('Un ' + enemyMon.name + ' salvaje aparece!');
        this.pushMessage('Ve, ' + this.playerMon.name + '!');
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
            case 'INTRO':
                this.updateIntro();
                break;
            case 'SELECT_ACTION':
                this.updateSelectAction();
                break;
            case 'SELECT_MOVE':
                this.updateSelectMove();
                break;
            case 'SELECT_SWITCH':
                this.updateSelectSwitch();
                break;
            case 'ANIMATING':
                this.updateAnimating();
                break;
            case 'FORCE_SWITCH':
                break;
            case 'CAPTURE_PROMPT':
                if (input.confirm()) {
                    this.playerTeam.push(this.captureTarget);
                    this.events = [];
                    this.eventIndex = 0;
                    this.pushMessage(this.captureTarget.name + ' se unio a tu equipo!');
                    this.pushMessage('Victoria!');
                    this.state = 'VICTORY';
                } else if (input.cancel()) {
                    this.events = [];
                    this.eventIndex = 0;
                    this.pushMessage('Victoria!');
                    this.state = 'VICTORY';
                }
                break;
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

        if (input.up()) this.menuCursor = (this.menuCursor < 2) ? this.menuCursor : this.menuCursor - 2;
        if (input.down()) this.menuCursor = (this.menuCursor > 1) ? this.menuCursor : this.menuCursor + 2;
        if (input.left()) this.menuCursor = (this.menuCursor % 2 === 0) ? this.menuCursor : this.menuCursor - 1;
        if (input.right()) this.menuCursor = (this.menuCursor % 2 === 1) ? this.menuCursor : this.menuCursor + 1;
        this.menuCursor = Game.Utils.clamp(this.menuCursor, 0, 2);

        if (input.confirm()) {
            switch (this.menuCursor) {
                case 0:
                    this.state = 'SELECT_MOVE';
                    this.moveCursor = 0;
                    break;
                case 1:
                    var alive = this.getAllAliveIndices();
                    if (alive.length > 0) {
                        this.state = 'SELECT_SWITCH';
                        this.switchCursor = 0;
                    }
                    break;
                case 2:
                    this.attemptRun();
                    break;
            }
        }
    },

    updateSelectMove: function() {
        var input = Game.Input;
        var moveCount = this.playerMon.moves.length;

        if (input.up() && this.moveCursor >= 2) this.moveCursor -= 2;
        if (input.down() && this.moveCursor + 2 < moveCount) this.moveCursor += 2;
        if (input.left() && this.moveCursor % 2 !== 0) this.moveCursor--;
        if (input.right() && this.moveCursor % 2 === 0 && this.moveCursor + 1 < moveCount) this.moveCursor++;

        if (input.cancel()) {
            this.state = 'SELECT_ACTION';
            this.menuCursor = 0;
            return;
        }

        if (input.confirm()) {
            this.executeTurn('move', this.moveCursor);
        }
    },

    updateSelectSwitch: function() {
        var input = Game.Input;
        var alive = this.getAllAliveIndices();

        if (input.up() && this.switchCursor > 0) this.switchCursor--;
        if (input.down() && this.switchCursor < alive.length - 1) this.switchCursor++;

        if (input.cancel()) {
            this.state = 'SELECT_ACTION';
            this.menuCursor = 1;
            return;
        }

        if (input.confirm() && alive.length > 0) {
            var idx = alive[this.switchCursor];
            this.executeTurn('switch', idx);
        }
    },

    updateAnimating: function() {
        if (Game.Input.confirm()) {
            this.eventIndex++;
            if (this.eventIndex >= this.events.length) {
                if (this.enemyMon.isFainted()) {
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

        var playerFirst = true;

        if (action === 'move') {
            var playerMove = this.playerMon.moves[param];
            var enemyMove = this.pickEnemyMove();

            if (playerMove.priority && !enemyMove.priority) {
                playerFirst = true;
            } else if (!playerMove.priority && enemyMove.priority) {
                playerFirst = false;
            } else {
                playerFirst = this.playerMon.stats.speed >= this.enemyMon.stats.speed;
                if (this.playerMon.stats.speed === this.enemyMon.stats.speed) {
                    playerFirst = Game.Utils.chance(0.5);
                }
            }

            if (playerFirst) {
                this.doAttack(this.playerMon, this.enemyMon, playerMove, false);
                if (!this.enemyMon.isFainted()) {
                    this.doAttack(this.enemyMon, this.playerMon, enemyMove, true);
                }
            } else {
                this.doAttack(this.enemyMon, this.playerMon, enemyMove, true);
                if (!this.playerMon.isFainted()) {
                    this.doAttack(this.playerMon, this.enemyMon, playerMove, false);
                }
            }
        } else if (action === 'switch') {
            var newMon = this.playerTeam[param];
            this.pushMessage(this.playerMon.name + ', vuelve!');
            this.playerMon = newMon;
            this.pushMessage('Ve, ' + this.playerMon.name + '!');

            var enemyMove = this.pickEnemyMove();
            this.doAttack(this.enemyMon, this.playerMon, enemyMove, true);
        }

        this.state = 'ANIMATING';
    },

    doAttack: function(attacker, defender, move, isEnemy) {
        var prefix = isEnemy ? (attacker.name + ' enemigo') : this.playerMon.name;
        this.pushMessage(prefix + ' usa ' + move.name + '!');

        var result = Game.Utils.calcDamage(attacker, defender, move);

        if (result.missed) {
            this.pushMessage('El ataque fallo!');
            return;
        }

        defender.takeDamage(result.damage);
        this.events.push({ type: 'damage', target: isEnemy ? 'player' : 'enemy', amount: result.damage });

        if (result.critical) {
            this.pushMessage('Golpe critico!');
        }
        if (result.effectiveness > 1) {
            this.pushMessage('Es super efectivo!');
        } else if (result.effectiveness < 1) {
            this.pushMessage('No es muy efectivo...');
        }

        if (defender.isFainted()) {
            var defName = (isEnemy ? '' : '') + defender.name;
            this.pushMessage(defName + ' se debilito!');
        }
    },

    pickEnemyMove: function() {
        return Game.Utils.pick(this.enemyMon.moves);
    },

    attemptRun: function() {
        var runChance = (this.playerMon.stats.speed / this.enemyMon.stats.speed) * 0.5 + 0.3;
        runChance = Game.Utils.clamp(runChance, 0.2, 0.9);

        this.events = [];
        this.eventIndex = 0;

        if (Game.Utils.chance(runChance)) {
            this.pushMessage('Escapaste con exito!');
            this.state = 'ANIMATING';
            setTimeout(function() {
                Game.Battle.state = 'RAN_AWAY';
            }, 100);
        } else {
            this.pushMessage('No pudiste escapar!');
            var enemyMove = this.pickEnemyMove();
            this.doAttack(this.enemyMon, this.playerMon, enemyMove, true);
            this.state = 'ANIMATING';
        }
    },

    handleVictory: function() {
        var xp = Game.Utils.calcXP(this.enemyMon.species.xpYield, this.enemyMon.level);
        this.events = [];
        this.eventIndex = 0;
        this.pushMessage(this.playerMon.name + ' gano ' + xp + ' puntos de exp!');

        var levels = this.playerMon.addXP(xp);
        for (var i = 0; i < levels.length; i++) {
            this.pushMessage(this.playerMon.name + ' subio al nivel ' + levels[i] + '!');
        }

        if (this.playerTeam.length < Game.Constants.MAX_TEAM_SIZE) {
            this.captureTarget = Game.createMonster(this.enemyMon.species.id, this.enemyMon.level);
            this.pushMessage('Capturar ' + this.enemyMon.name + '? (Z=Si / X=No)');
            this.state = 'CAPTURE_PROMPT';
            return;
        }

        this.pushMessage('Victoria!');
        this.state = 'VICTORY';
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
        if (this.eventIndex < this.events.length) {
            return this.events[this.eventIndex];
        }
        return null;
    }
};
