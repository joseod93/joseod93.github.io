window.Game = window.Game || {};

Game.BattleUI = {
    animTimer: 0,
    flashTimer: 0,
    playerSpriteY: 0,
    enemySpriteY: 0,
    shakeX: 0,

    draw: function() {
        var R = Game.Renderer;
        var B = Game.Battle;
        var C = Game.Constants;

        this.drawBackground(R);

        if (B.enemyMon) {
            this.drawEnemySprite(R, B);
            this.drawEnemyHUD(R, B);
        }
        if (B.playerMon) {
            this.drawPlayerSprite(R, B);
            this.drawPlayerHUD(R, B);
        }

        switch (B.state) {
            case 'INTRO':
            case 'ANIMATING':
            case 'VICTORY':
            case 'DEFEAT':
            case 'RAN_AWAY':
            case 'CAPTURE_PROMPT':
                this.drawMessageBox(R, B);
                break;
            case 'SELECT_ACTION':
                this.drawActionMenu(R, B);
                break;
            case 'SELECT_MOVE':
                this.drawMoveMenu(R, B);
                break;
            case 'SELECT_SWITCH':
            case 'FORCE_SWITCH':
                this.drawSwitchMenu(R, B);
                break;
        }

        this.animTimer += 0.016;
    },

    drawBackground: function(R) {
        var ctx = R.ctx;
        var grd = ctx.createLinearGradient(0, 0, 0, 460);
        grd.addColorStop(0, '#88bbee');
        grd.addColorStop(0.6, '#aaddff');
        grd.addColorStop(1, '#66aa55');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, 800, 460);

        ctx.fillStyle = '#55993d';
        ctx.fillRect(0, 340, 800, 120);

        ctx.fillStyle = '#4d8a36';
        ctx.fillRect(0, 350, 800, 2);
        ctx.fillRect(0, 380, 800, 2);
        ctx.fillRect(0, 410, 800, 2);
        ctx.fillRect(0, 440, 800, 2);
    },

    drawEnemySprite: function(R, B) {
        var x = 520 + this.shakeX;
        var y = 60 + this.enemySpriteY;
        var alpha = B.enemyMon.isFainted() ? 0.3 : 1;
        R.drawMonsterSprite(x, y, B.enemyMon.species, {
            width: 120,
            height: 120,
            alpha: alpha,
            flash: this.flashTimer > 0 && this.flashTarget === 'enemy'
        });
    },

    drawPlayerSprite: function(R, B) {
        var x = 120 + this.shakeX;
        var y = 220 + this.playerSpriteY;
        var alpha = B.playerMon.isFainted() ? 0.3 : 1;
        R.drawMonsterSprite(x, y, B.playerMon.species, {
            width: 140,
            height: 140,
            alpha: alpha,
            flash: this.flashTimer > 0 && this.flashTarget === 'player'
        });
    },

    drawEnemyHUD: function(R, B) {
        var mon = B.enemyMon;
        R.drawPanel(30, 30, 280, 70);
        R.drawText(mon.name, 45, 42, { size: 14, color: '#fff' });
        R.drawText('Nv.' + mon.level, 240, 42, { size: 10, color: '#ccc' });
        R.drawHPBar(45, 68, 200, mon.currentHP, mon.maxHP);
        R.drawText(mon.currentHP + '/' + mon.maxHP, 250, 68, { size: 8, color: '#aaa' });
    },

    drawPlayerHUD: function(R, B) {
        var mon = B.playerMon;
        R.drawPanel(480, 300, 290, 85);
        R.drawText(mon.name, 495, 312, { size: 14, color: '#fff' });
        R.drawText('Nv.' + mon.level, 700, 312, { size: 10, color: '#ccc' });
        R.drawHPBar(495, 342, 210, mon.currentHP, mon.maxHP);
        R.drawText(mon.currentHP + '/' + mon.maxHP, 710, 342, { size: 8, color: '#aaa' });
        R.drawXPBar(495, 362, 210, mon.xp, mon.xpToNext);
    },

    drawMessageBox: function(R, B) {
        R.drawPanel(10, 460, 780, 138);
        var evt = B.getCurrentEvent();
        if (evt && evt.type === 'message') {
            R.drawText(evt.text, 35, 490, { size: 14, color: '#fff' });
        } else if (B.state === 'VICTORY') {
            R.drawText('Victoria!', 35, 490, { size: 14, color: '#ffdd44' });
        } else if (B.state === 'DEFEAT') {
            R.drawText('Derrota...', 35, 490, { size: 14, color: '#ff4444' });
        } else if (B.state === 'RAN_AWAY') {
            R.drawText('Escapaste!', 35, 490, { size: 14, color: '#88ff88' });
        }

        if (B.state === 'CAPTURE_PROMPT') {
            R.drawText('[Z] Si    [X] No', 400, 540, { size: 12, color: '#ffdd44', align: 'center' });
        } else {
            var blink = Math.sin(this.animTimer * 5) > 0;
            if (blink) {
                R.drawText('v', 750, 570, { size: 12, color: '#aaa', align: 'center' });
            }
        }
    },

    drawActionMenu: function(R, B) {
        R.drawPanel(10, 460, 400, 138);
        R.drawText('Que deberia hacer', 35, 480, { size: 12, color: '#ccc' });
        R.drawText(B.playerMon.name + '?', 35, 500, { size: 12, color: '#fff' });

        R.drawPanel(420, 460, 370, 138);
        var actions = ['LUCHAR', 'CAMBIAR', 'HUIR'];
        var positions = [
            { x: 445, y: 485 },
            { x: 620, y: 485 },
            { x: 445, y: 535 }
        ];

        for (var i = 0; i < actions.length; i++) {
            var selected = B.menuCursor === i;
            var color = selected ? '#ffdd44' : '#fff';
            var prefix = selected ? '> ' : '  ';
            R.drawText(prefix + actions[i], positions[i].x, positions[i].y, { size: 14, color: color });
        }
    },

    drawMoveMenu: function(R, B) {
        R.drawPanel(10, 460, 780, 138);
        var moves = B.playerMon.moves;
        var positions = [
            { x: 35, y: 480 },
            { x: 420, y: 480 },
            { x: 35, y: 530 },
            { x: 420, y: 530 }
        ];

        for (var i = 0; i < moves.length; i++) {
            var selected = B.moveCursor === i;
            var move = moves[i];
            var typeColor = Game.Constants.TYPE_COLORS[move.type] || '#fff';
            var color = selected ? '#ffdd44' : '#fff';
            var prefix = selected ? '> ' : '  ';

            R.drawText(prefix + move.name, positions[i].x, positions[i].y, { size: 12, color: color });
            R.drawText(move.type.toUpperCase(), positions[i].x + 20, positions[i].y + 22, { size: 8, color: typeColor });
            R.drawText('POD:' + move.power, positions[i].x + 140, positions[i].y + 22, { size: 8, color: '#aaa' });
        }

        R.drawText('[X] Volver', 620, 575, { size: 8, color: '#888' });
    },

    drawSwitchMenu: function(R, B) {
        R.drawPanel(10, 460, 780, 138);
        R.drawText('Elige un monstruo:', 35, 475, { size: 12, color: '#ccc' });

        var alive = B.getAllAliveIndices();
        for (var i = 0; i < alive.length; i++) {
            var mon = B.playerTeam[alive[i]];
            var selected = B.switchCursor === i;
            var color = selected ? '#ffdd44' : '#fff';
            var prefix = selected ? '> ' : '  ';
            var y = 500 + i * 25;

            R.drawText(prefix + mon.name + '  Nv.' + mon.level, 35, y, { size: 11, color: color });
            R.drawText('HP:' + mon.currentHP + '/' + mon.maxHP, 400, y, { size: 10, color: '#aaa' });
        }

        if (B.state !== 'FORCE_SWITCH') {
            R.drawText('[X] Volver', 620, 575, { size: 8, color: '#888' });
        }
    },

    triggerDamageFlash: function(target) {
        this.flashTimer = 0.3;
        this.flashTarget = target;
    },

    updateEffects: function(dt) {
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
        }
    }
};
