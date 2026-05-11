window.Game = window.Game || {};

Game.Main = {
    state: 'TITLE',
    lastTime: 0,
    starterCursor: 0,
    transitionTimer: 0,
    transitionCallback: null,
    pendingEncounter: null,

    starters: ['flamander', 'aquarion', 'thornleaf'],

    init: function() {
        var canvas = document.getElementById('game');
        canvas.width = Game.Constants.CANVAS_WIDTH;
        canvas.height = Game.Constants.CANVAS_HEIGHT;
        Game.Renderer.init(canvas);

        canvas.addEventListener('click', function() {
            canvas.focus();
        });
        canvas.setAttribute('tabindex', '0');
        canvas.focus();

        Game.Touch.init();

        this.state = 'TITLE';
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    },

    loop: function(timestamp) {
        var dt = Math.min((timestamp - Game.Main.lastTime) / 1000, 0.05);
        Game.Main.lastTime = timestamp;

        Game.Main.update(dt);
        Game.Main.render();
        Game.Input.update();

        requestAnimationFrame(Game.Main.loop);
    },

    update: function(dt) {
        if (this.transitionTimer > 0) {
            this.transitionTimer -= dt;
            if (this.transitionTimer <= 0 && this.transitionCallback) {
                this.transitionCallback();
                this.transitionCallback = null;
            }
            return;
        }

        switch (this.state) {
            case 'TITLE':
                if (Game.Input.confirm()) {
                    this.state = 'STARTER_SELECT';
                    this.starterCursor = 0;
                }
                break;

            case 'STARTER_SELECT':
                this.updateStarterSelect();
                break;

            case 'OVERWORLD':
                var result = Game.Overworld.update(dt);
                if (result && result.type === 'encounter') {
                    this.pendingEncounter = result.monster;
                    this.startTransition(0.5, function() {
                        Game.Battle.start(Game.Overworld.player.team, Game.Main.pendingEncounter);
                        Game.Main.state = 'BATTLE';
                    });
                }
                break;

            case 'BATTLE':
                Game.BattleUI.updateEffects(dt);
                Game.Battle.update();

                if (Game.Battle.state === 'FORCE_SWITCH') {
                    this.updateForceSwitch();
                }

                if (!Game.Battle.active) {
                    if (Game.Battle.result === 'DEFEAT') {
                        for (var i = 0; i < Game.Overworld.player.team.length; i++) {
                            Game.Overworld.player.team[i].heal();
                        }
                        var hp = Game.MapData.healPoint;
                        Game.Overworld.player.gridX = hp.x;
                        Game.Overworld.player.gridY = hp.y;
                        Game.Overworld.player.pixelX = hp.x * Game.Constants.TILE_SIZE;
                        Game.Overworld.player.pixelY = hp.y * Game.Constants.TILE_SIZE;
                        Game.Overworld.player.targetX = Game.Overworld.player.pixelX;
                        Game.Overworld.player.targetY = Game.Overworld.player.pixelY;
                        Game.Overworld.player.moving = false;
                    }
                    this.startTransition(0.4, function() {
                        Game.Main.state = 'OVERWORLD';
                    });
                }
                break;
        }
    },

    updateStarterSelect: function() {
        var input = Game.Input;
        if (input.left() && this.starterCursor > 0) this.starterCursor--;
        if (input.right() && this.starterCursor < 2) this.starterCursor++;

        if (input.confirm()) {
            var speciesId = this.starters[this.starterCursor];
            var starter = Game.createMonster(speciesId, 5);
            Game.Overworld.init([starter]);
            this.startTransition(0.5, function() {
                Game.Main.state = 'OVERWORLD';
            });
        }
    },

    updateForceSwitch: function() {
        var B = Game.Battle;
        var input = Game.Input;
        var alive = B.getAllAliveIndices();

        if (alive.length === 0) {
            B.playerMon = B.getFirstAlive();
            if (B.playerMon) {
                B.events = [];
                B.eventIndex = 0;
                B.pushMessage('Ve, ' + B.playerMon.name + '!');
                B.state = 'ANIMATING';
            }
            return;
        }

        if (input.up() && B.switchCursor > 0) B.switchCursor--;
        if (input.down() && B.switchCursor < alive.length - 1) B.switchCursor++;

        if (input.confirm()) {
            var idx = alive[B.switchCursor];
            B.playerMon = B.playerTeam[idx];
            B.events = [];
            B.eventIndex = 0;
            B.pushMessage('Ve, ' + B.playerMon.name + '!');
            B.state = 'ANIMATING';
        }
    },

    startTransition: function(duration, callback) {
        this.transitionTimer = duration;
        this.transitionCallback = callback;
    },

    render: function() {
        var R = Game.Renderer;

        switch (this.state) {
            case 'TITLE':
                this.renderTitle(R);
                break;
            case 'STARTER_SELECT':
                this.renderStarterSelect(R);
                break;
            case 'OVERWORLD':
                Game.Overworld.draw();
                break;
            case 'BATTLE':
                Game.BattleUI.draw();
                break;
        }

        if (this.transitionTimer > 0) {
            var alpha = Math.min(this.transitionTimer * 3, 1);
            R.fadeOverlay(alpha);
        }
    },

    renderTitle: function(R) {
        R.clear('#1a1a2e');

        var ctx = R.ctx;
        var grd = ctx.createLinearGradient(0, 120, 0, 250);
        grd.addColorStop(0, '#ff6633');
        grd.addColorStop(0.5, '#ffcc00');
        grd.addColorStop(1, '#44bb44');

        ctx.font = '42px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = grd;
        ctx.fillText('MONSTER', 400, 170);
        ctx.fillText('BATTLE', 400, 230);

        R.drawText('Un juego estilo Pokemon', 400, 310, { size: 10, color: '#888', align: 'center' });

        var blink = Math.sin(performance.now() / 500) > 0;
        if (blink) {
            R.drawText('Pulsa ENTER para empezar', 400, 420, { size: 12, color: '#fff', align: 'center' });
        }

        R.drawText('Controles: WASD/Flechas = mover', 400, 510, { size: 8, color: '#555', align: 'center' });
        R.drawText('Z/Enter = confirmar  X/Esc = cancelar', 400, 535, { size: 8, color: '#555', align: 'center' });
        R.drawText('Hierba alta = encuentros  Cruz roja = curar', 400, 560, { size: 8, color: '#555', align: 'center' });
    },

    renderStarterSelect: function(R) {
        R.clear('#1a1a2e');
        R.drawText('Elige tu monstruo inicial', 400, 40, { size: 14, color: '#fff', align: 'center' });

        for (var i = 0; i < 3; i++) {
            var sp = Game.Species[this.starters[i]];
            var x = 120 + i * 220;
            var y = 120;
            var selected = this.starterCursor === i;

            if (selected) {
                R.drawPanel(x - 10, y - 10, 180, 340);
            }

            R.drawMonsterSprite(x + 20, y + 10, sp, {
                width: 120,
                height: 120,
                alpha: selected ? 1 : 0.5
            });

            var nameColor = selected ? '#ffdd44' : '#aaa';
            R.drawText(sp.name, x + 80, y + 150, { size: 12, color: nameColor, align: 'center' });

            var typeColor = Game.Constants.TYPE_COLORS[sp.type];
            R.drawText(sp.type.toUpperCase(), x + 80, y + 180, { size: 10, color: typeColor, align: 'center' });

            R.drawText('HP:  ' + sp.baseStats.hp, x + 20, y + 210, { size: 8, color: '#aaa' });
            R.drawText('ATK: ' + sp.baseStats.attack, x + 20, y + 230, { size: 8, color: '#aaa' });
            R.drawText('DEF: ' + sp.baseStats.defense, x + 20, y + 250, { size: 8, color: '#aaa' });
            R.drawText('SPD: ' + sp.baseStats.speed, x + 20, y + 270, { size: 8, color: '#aaa' });
        }

        var blink = Math.sin(performance.now() / 400) > 0;
        if (blink) {
            R.drawText('< ENTER para elegir >', 400, 500, { size: 12, color: '#fff', align: 'center' });
        }
    }
};

window.addEventListener('load', function() {
    document.fonts.ready.then(function() {
        Game.Main.init();
    }).catch(function() {
        Game.Main.init();
    });
});
