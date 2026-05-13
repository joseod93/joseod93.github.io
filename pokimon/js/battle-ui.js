window.Game = window.Game || {};

Game.BattleUI = {
    animTimer: 0,
    flashTimer: 0,
    playerSpriteY: 0,
    enemySpriteY: 0,
    shakeX: 0,
    playerBounce: 0,
    enemyBounce: 0,

    STATUS_COLORS: {
        poison: '#aa44aa',
        burn: '#ff6633',
        paralysis: '#ffcc00'
    },
    STATUS_LABELS: {
        poison: 'VEN',
        burn: 'QUE',
        paralysis: 'PAR'
    },

    draw: function() {
        var R = Game.Renderer;
        var B = Game.Battle;
        var C = Game.Constants;
        var E = Game.Effects;

        var ctx = R.ctx;
        ctx.save();
        ctx.translate(E.screenShake.x, E.screenShake.y);

        this.drawBackground(R);

        if (B.enemyMon) {
            this.drawEnemySprite(R, B);
            this.drawEnemyHUD(R, B);
        }
        if (B.playerMon) {
            this.drawPlayerSprite(R, B);
            this.drawPlayerHUD(R, B);
        }

        E.draw(ctx);

        ctx.restore();

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
            case 'SELECT_ITEM':
                this.drawItemMenu(R, B);
                break;
            case 'SELECT_ITEM_TARGET':
                this.drawItemTargetMenu(R, B);
                break;
        }

        this.animTimer += 0.016;
        this.playerBounce = Math.sin(this.animTimer * 2.5) * 3;
        this.enemyBounce = Math.sin(this.animTimer * 2.2 + 1) * 3;
    },

    drawBackground: function(R) {
        var ctx = R.ctx;
        var grd = ctx.createLinearGradient(0, 0, 0, 460);
        grd.addColorStop(0, '#5599cc');
        grd.addColorStop(0.3, '#88ccee');
        grd.addColorStop(0.6, '#aaddff');
        grd.addColorStop(0.8, '#77bb55');
        grd.addColorStop(1, '#55993d');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, 800, 460);

        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.ellipse(200, 100, 120, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(600, 60, 80, 25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(150, 70, 60, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        var groundGrd = ctx.createLinearGradient(0, 320, 0, 460);
        groundGrd.addColorStop(0, '#66aa44');
        groundGrd.addColorStop(1, '#448830');
        ctx.fillStyle = groundGrd;
        ctx.fillRect(0, 320, 800, 140);

        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        for (var i = 0; i < 6; i++) {
            ctx.fillRect(0, 335 + i * 22, 800, 2);
        }

        ctx.fillStyle = 'rgba(100,180,60,0.3)';
        for (var j = 0; j < 8; j++) {
            var gx = 50 + j * 100 + Math.sin(j) * 20;
            var gy = 340 + (j % 3) * 30;
            ctx.beginPath();
            ctx.ellipse(gx, gy, 15 + j * 2, 6, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    drawEnemySprite: function(R, B) {
        var x = 520 + this.shakeX;
        var y = 60 + this.enemySpriteY + this.enemyBounce;
        var alpha = B.enemyMon.isFainted() ? 0.3 : 1;

        this.drawShadow(R.ctx, x + 60, 190, 50, 10);

        R.drawMonsterSprite(x, y, B.enemyMon.species, {
            width: 120,
            height: 120,
            alpha: alpha,
            flash: this.flashTimer > 0 && this.flashTarget === 'enemy'
        });
    },

    drawPlayerSprite: function(R, B) {
        var x = 120 + this.shakeX;
        var y = 220 + this.playerSpriteY + this.playerBounce;
        var alpha = B.playerMon.isFainted() ? 0.3 : 1;

        this.drawShadow(R.ctx, x + 70, 370, 60, 12);

        R.drawMonsterSprite(x, y, B.playerMon.species, {
            width: 140,
            height: 140,
            alpha: alpha,
            flash: this.flashTimer > 0 && this.flashTarget === 'player'
        });
    },

    drawShadow: function(ctx, x, y, rx, ry) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawStatusBadge: function(R, x, y, status) {
        if (!status) return;
        var color = this.STATUS_COLORS[status] || '#888';
        var label = this.STATUS_LABELS[status] || '???';
        var ctx = R.ctx;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, 32, 14, 3);
        ctx.fill();
        R.drawText(label, x + 4, y + 2, { size: 7, color: '#fff', shadow: false });
    },

    drawEnemyHUD: function(R, B) {
        var mon = B.enemyMon;
        R.drawPanel(30, 30, 280, 70);
        R.drawText(mon.name, 45, 42, { size: 14, color: '#fff' });
        R.drawText('Nv.' + mon.level, 240, 42, { size: 10, color: '#ccc' });
        this.drawStatusBadge(R, 200, 43, mon.status);
        R.drawHPBar(45, 68, 200, mon.currentHP, mon.maxHP);
        R.drawText(mon.currentHP + '/' + mon.maxHP, 250, 68, { size: 8, color: '#aaa' });
    },

    drawPlayerHUD: function(R, B) {
        var mon = B.playerMon;
        R.drawPanel(480, 300, 290, 85);
        R.drawText(mon.name, 495, 312, { size: 14, color: '#fff' });
        R.drawText('Nv.' + mon.level, 700, 312, { size: 10, color: '#ccc' });
        this.drawStatusBadge(R, 660, 313, mon.status);
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
        var actions = ['LUCHAR', 'MOCHILA', 'CAMBIAR', 'HUIR'];
        var positions = [
            { x: 445, y: 485 },
            { x: 620, y: 485 },
            { x: 445, y: 535 },
            { x: 620, y: 535 }
        ];

        for (var i = 0; i < actions.length; i++) {
            var selected = B.menuCursor === i;
            var color = selected ? '#ffdd44' : '#fff';
            if (i === 1 && Game.Inventory && !Game.Inventory.hasAny()) color = selected ? '#aa8833' : '#666';
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
            var noPP = move.currentPP <= 0;
            var color = noPP ? '#666' : (selected ? '#ffdd44' : '#fff');
            var prefix = selected ? '> ' : '  ';

            R.drawText(prefix + move.name, positions[i].x, positions[i].y, { size: 12, color: color });
            R.drawText(move.type.toUpperCase(), positions[i].x + 20, positions[i].y + 22, { size: 8, color: typeColor });
            R.drawText('POD:' + move.power, positions[i].x + 120, positions[i].y + 22, { size: 8, color: '#aaa' });

            var ppColor = noPP ? '#ff4444' : (move.currentPP <= Math.ceil(move.pp * 0.25) ? '#ffaa00' : '#aaa');
            R.drawText('PP:' + move.currentPP + '/' + move.pp, positions[i].x + 220, positions[i].y + 22, { size: 8, color: ppColor });
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
            R.drawText('HP:' + mon.currentHP + '/' + mon.maxHP, 350, y, { size: 10, color: '#aaa' });
            this.drawStatusBadge(R, 500, y, mon.status);
        }

        if (B.state !== 'FORCE_SWITCH') {
            R.drawText('[X] Volver', 620, 575, { size: 8, color: '#888' });
        }
    },

    drawItemMenu: function(R, B) {
        R.drawPanel(10, 460, 780, 138);
        R.drawText('Mochila:', 35, 475, { size: 12, color: '#ccc' });

        var items = Game.Inventory.getAvailable();
        if (items.length === 0) {
            R.drawText('Vacia...', 35, 505, { size: 11, color: '#888' });
        } else {
            for (var i = 0; i < items.length; i++) {
                var selected = B.itemCursor === i;
                var color = selected ? '#ffdd44' : '#fff';
                var prefix = selected ? '> ' : '  ';
                var y = 500 + i * 22;
                var def = Game.Items[items[i].id];
                R.drawText(prefix + def.name + ' x' + items[i].count, 35, y, { size: 11, color: color });
                if (selected) {
                    R.drawText(def.description, 400, y, { size: 9, color: '#aaa' });
                }
            }
        }

        R.drawText('[X] Volver', 620, 575, { size: 8, color: '#888' });
    },

    drawItemTargetMenu: function(R, B) {
        R.drawPanel(10, 460, 780, 138);
        R.drawText('Usar en:', 35, 475, { size: 12, color: '#ccc' });

        var targets = B.getItemTargets(B.pendingItem);
        for (var i = 0; i < targets.length; i++) {
            var mon = B.playerTeam[targets[i]];
            var selected = B.itemTargetCursor === i;
            var color = selected ? '#ffdd44' : '#fff';
            var prefix = selected ? '> ' : '  ';
            var y = 500 + i * 22;
            R.drawText(prefix + mon.name + '  HP:' + mon.currentHP + '/' + mon.maxHP, 35, y, { size: 11, color: color });
        }

        R.drawText('[X] Volver', 620, 575, { size: 8, color: '#888' });
    },

    triggerDamageFlash: function(target, moveType, damage, crit) {
        this.flashTimer = 0.3;
        this.flashTarget = target;

        var E = Game.Effects;
        E.shake(crit ? 14 : 8);

        var px, py;
        if (target === 'enemy') {
            px = 580; py = 120;
        } else {
            px = 190; py = 290;
        }

        if (moveType) {
            E.burstForType(moveType, px, py);
        }
        if (damage) {
            E.spawnDamageNumber(px, py - 20, damage, crit);
        }
    },

    updateEffects: function(dt) {
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
        }
        Game.Effects.update(dt);
    }
};
