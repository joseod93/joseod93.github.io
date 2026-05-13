window.Game = window.Game || {};

Game.BattleUI = {
    animTimer: 0,
    flashTimer: 0,
    flashTarget: null,
    playerBounce: 0,
    enemyBounce: 0,
    shakeX: 0,
    introTimer: 0,
    lungeTimer: 0,
    lungeTarget: null,
    faintTimer: 0,
    faintTarget: null,
    captureAnim: null,

    STATUS_COLORS: { poison: '#aa44aa', burn: '#ff6633', paralysis: '#ffcc00' },
    STATUS_LABELS: { poison: 'VEN', burn: 'QUE', paralysis: 'PAR' },

    resetAnim: function() {
        this.introTimer = 0.8;
        this.animTimer = 0;
        this.flashTimer = 0;
        this.lungeTimer = 0;
        this.lungeTarget = null;
        this.faintTimer = 0;
        this.faintTarget = null;
        this.captureAnim = null;
        this.shakeX = 0;
    },

    draw: function() {
        var R = Game.Renderer;
        var B = Game.Battle;
        var E = Game.Effects;
        var ctx = R.ctx;

        ctx.save();
        ctx.translate(E.screenShake.x, E.screenShake.y);
        this.drawBackground(R);

        if (B.enemyMon) { this.drawEnemySprite(R, B); this.drawEnemyHUD(R, B); }
        if (B.playerMon) { this.drawPlayerSprite(R, B); this.drawPlayerHUD(R, B); }

        if (this.captureAnim) this.drawCaptureBall(ctx);
        E.draw(ctx);
        ctx.restore();

        switch (B.state) {
            case 'INTRO': case 'ANIMATING': case 'VICTORY': case 'DEFEAT': case 'RAN_AWAY': case 'CAPTURING':
                this.drawMessageBox(R, B); break;
            case 'SELECT_ACTION': this.drawActionMenu(R, B); break;
            case 'SELECT_MOVE': this.drawMoveMenu(R, B); break;
            case 'SELECT_SWITCH': case 'FORCE_SWITCH': this.drawSwitchMenu(R, B); break;
            case 'SELECT_ITEM': this.drawItemMenu(R, B); break;
            case 'SELECT_ITEM_TARGET': this.drawItemTargetMenu(R, B); break;
        }

        this.animTimer += 0.016;
        this.playerBounce = Math.sin(this.animTimer * 2.5) * 3;
        this.enemyBounce = Math.sin(this.animTimer * 2.2 + 1) * 3;
    },

    drawBackground: function(R) {
        var ctx = R.ctx;
        var t = this.animTimer;

        var sky = ctx.createLinearGradient(0, 0, 0, 280);
        sky.addColorStop(0, '#3a7bbf');
        sky.addColorStop(0.4, '#6aacdd');
        sky.addColorStop(0.7, '#9fd4ee');
        sky.addColorStop(1, '#c8e8f5');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, 800, 280);

        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.12;
        ctx.beginPath(); ctx.ellipse(180, 80, 130, 38, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(220, 75, 90, 30, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(600, 50, 100, 28, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(560, 55, 70, 22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.06;
        ctx.beginPath(); ctx.ellipse(400, 110, 60, 18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;

        var hills = ctx.createLinearGradient(0, 200, 0, 290);
        hills.addColorStop(0, '#5a9a3a');
        hills.addColorStop(1, '#4a8830');
        ctx.fillStyle = hills;
        ctx.beginPath();
        ctx.moveTo(0, 290);
        ctx.bezierCurveTo(100, 220, 250, 240, 400, 250);
        ctx.bezierCurveTo(550, 260, 700, 230, 800, 260);
        ctx.lineTo(800, 290);
        ctx.fill();

        ctx.fillStyle = '#3d7828';
        ctx.beginPath();
        ctx.moveTo(0, 280);
        ctx.bezierCurveTo(200, 260, 350, 275, 500, 265);
        ctx.bezierCurveTo(650, 255, 750, 270, 800, 280);
        ctx.lineTo(800, 300);
        ctx.lineTo(0, 300);
        ctx.fill();

        for (var tr = 0; tr < 5; tr++) {
            var tx = 50 + tr * 180 + Math.sin(tr * 2.3) * 30;
            var ty = 225 + Math.sin(tr * 1.7) * 15;
            var ts = 10 + (tr % 3) * 4;
            ctx.fillStyle = '#664422';
            ctx.fillRect(tx - 2, ty, 4, ts);
            ctx.fillStyle = '#3a7520';
            ctx.beginPath();
            ctx.arc(tx, ty - 2, ts * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#4a9030';
            ctx.beginPath();
            ctx.arc(tx - 3, ty - 4, ts * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        var ground = ctx.createLinearGradient(0, 280, 0, 460);
        ground.addColorStop(0, '#6aaa42');
        ground.addColorStop(0.3, '#5a9838');
        ground.addColorStop(0.7, '#4a882e');
        ground.addColorStop(1, '#3a7824');
        ctx.fillStyle = ground;
        ctx.fillRect(0, 280, 800, 180);

        ctx.fillStyle = 'rgba(0,0,0,0.03)';
        for (var i = 0; i < 20; i++) {
            var lx = (i * 43 + 7) % 800;
            var ly = 290 + (i * 17 + 3) % 150;
            ctx.fillRect(lx, ly, 20 + (i % 3) * 8, 1);
        }

        for (var g = 0; g < 30; g++) {
            var gx = (g * 27 + 11) % 800;
            var gy = 290 + (g * 19 + 5) % 160;
            var sway = Math.sin(t * 1.5 + g * 0.7) * 2;
            ctx.fillStyle = g % 2 === 0 ? 'rgba(80,160,50,0.3)' : 'rgba(55,130,35,0.25)';
            ctx.beginPath();
            ctx.moveTo(gx, gy + 8);
            ctx.quadraticCurveTo(gx + sway, gy, gx + 1 + sway, gy - 2);
            ctx.lineTo(gx + 2 + sway, gy);
            ctx.quadraticCurveTo(gx + 2, gy + 4, gx + 2, gy + 8);
            ctx.fill();
        }

        ctx.save();
        ctx.fillStyle = 'rgba(80,60,40,0.12)';
        ctx.beginPath();
        ctx.ellipse(580, 180, 120, 22, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(90,70,50,0.08)';
        ctx.beginPath();
        ctx.ellipse(580, 178, 110, 18, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.fillStyle = 'rgba(80,60,40,0.12)';
        ctx.beginPath();
        ctx.ellipse(190, 360, 130, 24, 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(90,70,50,0.08)';
        ctx.beginPath();
        ctx.ellipse(190, 358, 120, 20, 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawEnemySprite: function(R, B) {
        if (this.captureAnim && this.captureAnim.phase >= 1 &&
            !(this.captureAnim.phase === 4 && !this.captureAnim.success)) return;

        var slideX = 0;
        if (this.introTimer > 0) slideX = Math.floor(300 * (this.introTimer / 0.8));
        var lungeX = 0;
        if (this.lungeTarget === 'enemy_attack' && this.lungeTimer > 0) {
            var lp = this.lungeTimer / 0.2;
            lungeX = Math.floor(-40 * (1 - Math.abs(lp * 2 - 1)));
        }
        var faintY = 0, faintAlpha = 1;
        if (this.faintTarget === 'enemy' && this.faintTimer > 0) {
            var fp = 1 - this.faintTimer / 0.5;
            faintY = Math.floor(60 * fp);
            faintAlpha = 1 - fp;
        }

        var x = 520 + this.shakeX + slideX + lungeX;
        var y = 60 + this.enemyBounce + faintY;
        var alpha = B.enemyMon.isFainted() ? 0.3 * faintAlpha : faintAlpha;
        this.drawShadow(R.ctx, x + 60, 190, 50, 10);
        R.drawMonsterSprite(x, y, B.enemyMon.species, {
            width: 120, height: 120, alpha: alpha,
            flash: this.flashTimer > 0 && this.flashTarget === 'enemy'
        });
    },

    drawPlayerSprite: function(R, B) {
        var slideX = 0;
        if (this.introTimer > 0) slideX = Math.floor(-300 * (this.introTimer / 0.8));
        var lungeX = 0;
        if (this.lungeTarget === 'player_attack' && this.lungeTimer > 0) {
            var lp = this.lungeTimer / 0.2;
            lungeX = Math.floor(40 * (1 - Math.abs(lp * 2 - 1)));
        }
        var faintY = 0, faintAlpha = 1;
        if (this.faintTarget === 'player' && this.faintTimer > 0) {
            var fp = 1 - this.faintTimer / 0.5;
            faintY = Math.floor(60 * fp);
            faintAlpha = 1 - fp;
        }

        var x = 120 + this.shakeX + slideX + lungeX;
        var y = 220 + this.playerBounce + faintY;
        var alpha = B.playerMon.isFainted() ? 0.3 * faintAlpha : faintAlpha;
        this.drawShadow(R.ctx, x + 70, 370, 60, 12);
        R.drawMonsterSprite(x, y, B.playerMon.species, {
            width: 140, height: 140, alpha: alpha,
            flash: this.flashTimer > 0 && this.flashTarget === 'player'
        });
    },

    drawShadow: function(ctx, x, y, rx, ry) {
        ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    },

    drawStatusBadge: function(R, x, y, status) {
        if (!status) return;
        var color = this.STATUS_COLORS[status] || '#888';
        var label = this.STATUS_LABELS[status] || '???';
        var ctx = R.ctx;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.roundRect(x, y, 32, 14, 3); ctx.fill();
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
        } else if (B.state === 'CAPTURING') {
            R.drawText('...', 35, 490, { size: 14, color: '#fff' });
        }
        var blink = Math.sin(this.animTimer * 5) > 0;
        if (blink && B.state !== 'CAPTURING') {
            R.drawText('v', 750, 570, { size: 12, color: '#aaa', align: 'center' });
        }
    },

    drawActionMenu: function(R, B) {
        R.drawPanel(10, 460, 400, 138);
        R.drawText('Que deberia hacer', 35, 480, { size: 12, color: '#ccc' });
        R.drawText(B.playerMon.name + '?', 35, 500, { size: 12, color: '#fff' });
        R.drawPanel(420, 460, 370, 138);
        var actions = ['LUCHAR', 'MOCHILA', 'CAMBIAR', 'HUIR'];
        var pos = [{ x: 445, y: 485 }, { x: 620, y: 485 }, { x: 445, y: 535 }, { x: 620, y: 535 }];
        for (var i = 0; i < 4; i++) {
            var sel = B.menuCursor === i;
            var color = sel ? '#ffdd44' : '#fff';
            if (i === 1 && Game.Inventory && !Game.Inventory.hasAny()) color = sel ? '#aa8833' : '#666';
            if (i === 3 && B.isTrainerBattle) color = sel ? '#aa8833' : '#666';
            R.drawText((sel ? '> ' : '  ') + actions[i], pos[i].x, pos[i].y, { size: 14, color: color });
        }
    },

    drawMoveMenu: function(R, B) {
        R.drawPanel(10, 460, 780, 138);
        var moves = B.playerMon.moves;
        var pos = [{ x: 35, y: 480 }, { x: 420, y: 480 }, { x: 35, y: 530 }, { x: 420, y: 530 }];
        for (var i = 0; i < moves.length; i++) {
            var sel = B.moveCursor === i;
            var move = moves[i];
            var noPP = move.currentPP <= 0;
            var color = noPP ? '#666' : (sel ? '#ffdd44' : '#fff');
            R.drawText((sel ? '> ' : '  ') + move.name, pos[i].x, pos[i].y, { size: 12, color: color });
            var typeColor = Game.Constants.TYPE_COLORS[move.type] || '#fff';
            R.drawText(move.type.toUpperCase(), pos[i].x + 20, pos[i].y + 22, { size: 8, color: typeColor });
            R.drawText('POD:' + move.power, pos[i].x + 120, pos[i].y + 22, { size: 8, color: '#aaa' });
            var ppColor = noPP ? '#ff4444' : (move.currentPP <= Math.ceil(move.pp * 0.25) ? '#ffaa00' : '#aaa');
            R.drawText('PP:' + move.currentPP + '/' + move.pp, pos[i].x + 220, pos[i].y + 22, { size: 8, color: ppColor });
        }
        R.drawText('[X] Volver', 620, 575, { size: 8, color: '#888' });
    },

    drawSwitchMenu: function(R, B) {
        R.drawPanel(10, 460, 780, 138);
        R.drawText('Elige un monstruo:', 35, 475, { size: 12, color: '#ccc' });
        var alive = B.getAllAliveIndices();
        for (var i = 0; i < alive.length; i++) {
            var mon = B.playerTeam[alive[i]];
            var sel = B.switchCursor === i;
            var y = 500 + i * 25;
            R.drawText((sel ? '> ' : '  ') + mon.name + '  Nv.' + mon.level, 35, y, { size: 11, color: sel ? '#ffdd44' : '#fff' });
            R.drawText('HP:' + mon.currentHP + '/' + mon.maxHP, 350, y, { size: 10, color: '#aaa' });
            this.drawStatusBadge(R, 500, y, mon.status);
        }
        if (B.state !== 'FORCE_SWITCH') R.drawText('[X] Volver', 620, 575, { size: 8, color: '#888' });
    },

    drawItemMenu: function(R, B) {
        R.drawPanel(10, 460, 780, 138);
        R.drawText('Mochila:', 35, 475, { size: 12, color: '#ccc' });
        var items = Game.Inventory.getBattleItems();
        if (items.length === 0) {
            R.drawText('Vacia...', 35, 505, { size: 11, color: '#888' });
        } else {
            for (var i = 0; i < items.length; i++) {
                var sel = B.itemCursor === i;
                var y = 500 + i * 22;
                var def = Game.Items[items[i].id];
                var color = sel ? '#ffdd44' : '#fff';
                if (sel && B.isTrainerBattle && def.type === 'capture') color = '#aa8833';
                R.drawText((sel ? '> ' : '  ') + def.name + ' x' + items[i].count, 35, y, { size: 11, color: color });
                if (sel) R.drawText(def.description, 400, y, { size: 9, color: '#aaa' });
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
            var sel = B.itemTargetCursor === i;
            var y = 500 + i * 22;
            R.drawText((sel ? '> ' : '  ') + mon.name + '  HP:' + mon.currentHP + '/' + mon.maxHP, 35, y, { size: 11, color: sel ? '#ffdd44' : '#fff' });
        }
        R.drawText('[X] Volver', 620, 575, { size: 8, color: '#888' });
    },

    startCapture: function(shakes, success) {
        this.captureAnim = {
            phase: 0, timer: 0.5, shakes: shakes, success: success,
            totalShakes: 0, ballX: 190, ballY: 300
        };
    },

    drawCaptureBall: function(ctx) {
        var c = this.captureAnim;
        if (c.phase === 0) {
            var p = 1 - c.timer / 0.5;
            c.ballX = 190 + (580 - 190) * p;
            c.ballY = 300 + (120 - 300) * p - Math.sin(p * Math.PI) * 100;
        }
        var shakeX = 0;
        if (c.phase >= 1 && c.phase <= 3) shakeX = Math.sin(c.timer * 22) * 8;

        ctx.save();
        ctx.translate(c.ballX + shakeX, c.ballY);

        var glow = 0.3 + Math.sin(this.animTimer * 8) * 0.15;
        ctx.globalAlpha = glow;
        ctx.fillStyle = '#44ddff';
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;

        var cg = ctx.createRadialGradient(-3, -3, 2, 0, 0, 12);
        cg.addColorStop(0, '#aaeeff');
        cg.addColorStop(0.4, '#33bbdd');
        cg.addColorStop(0.8, '#1188aa');
        cg.addColorStop(1, '#0a6688');
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = '#0d7799';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();

        ctx.strokeStyle = 'rgba(180,240,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(-3, -4, 5, -0.8, 1.2); ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.arc(-4, -5, 2, 0, Math.PI * 2); ctx.fill();

        ctx.restore();

        if (c.phase === 4 && c.success) {
            ctx.save();
            ctx.globalAlpha = c.timer / 0.3;
            for (var i = 0; i < 8; i++) {
                var a = i * Math.PI / 4 + this.animTimer * 3;
                var r = 20 + (1 - c.timer / 0.3) * 20;
                ctx.fillStyle = '#44ddff';
                ctx.beginPath();
                ctx.arc(c.ballX + Math.cos(a) * r, c.ballY + Math.sin(a) * r, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    },

    triggerDamageFlash: function(target, moveType, damage, crit) {
        this.flashTimer = 0.3;
        this.flashTarget = target;
        this.lungeTarget = (target === 'enemy') ? 'player_attack' : 'enemy_attack';
        this.lungeTimer = 0.2;

        var E = Game.Effects;
        E.shake(crit ? 14 : 8);
        var px, py;
        if (target === 'enemy') { px = 580; py = 120; }
        else { px = 190; py = 290; }
        if (moveType) E.burstForType(moveType, px, py);
        if (damage) E.spawnDamageNumber(px, py - 20, damage, crit);
    },

    updateEffects: function(dt) {
        if (this.flashTimer > 0) this.flashTimer -= dt;
        if (this.introTimer > 0) this.introTimer -= dt;
        if (this.lungeTimer > 0) {
            this.lungeTimer -= dt;
            if (this.lungeTimer <= 0) this.lungeTarget = null;
        }
        if (this.faintTimer > 0) this.faintTimer -= dt;

        if (this.captureAnim) {
            var c = this.captureAnim;
            c.timer -= dt;
            if (c.timer <= 0) {
                if (c.phase === 0) {
                    c.ballX = 580; c.ballY = 120;
                    if (c.shakes > 0) { c.phase = 1; c.timer = 0.5; }
                    else { c.phase = 4; c.timer = 0.3; }
                } else if (c.phase >= 1 && c.phase <= 3) {
                    c.totalShakes++;
                    if (c.totalShakes < c.shakes) { c.phase++; c.timer = 0.5; }
                    else { c.phase = 4; c.timer = 0.5; }
                } else if (c.phase === 4) {
                    this.captureAnim = null;
                }
            }
        }

        Game.Effects.update(dt);
    }
};
