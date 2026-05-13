window.Game = window.Game || {};

Game.Main = {
    state: 'TITLE',
    lastTime: 0,
    starterCursor: 0,
    transitionTimer: 0,
    transitionCallback: null,
    pendingEncounter: null,
    titleCursor: 0,

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

        this.state = 'LOADING';
        this.lastTime = performance.now();
        this.loop(this.lastTime);

        Game.Assets.load(function() {
            Game.Sprites.cache = {};
            Game.Main.state = 'TITLE';
            Game.Main.titleCursor = 0;
        });
    },

    loop: function(timestamp) {
        var dt = Math.min((timestamp - Game.Main.lastTime) / 1000, 0.05);
        Game.Main.lastTime = timestamp;

        Game.Main.update(dt);
        Game.Main.render();
        Game.Effects.update(dt);
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
                this.updateTitle();
                break;

            case 'STARTER_SELECT':
                this.updateStarterSelect();
                break;

            case 'OVERWORLD':
                var result = Game.Overworld.update(dt);
                if (result && result.type === 'encounter') {
                    this.pendingEncounter = result.monster;
                    Game.Effects.encounterFlash();
                    this.startTransition(0.5, function() {
                        Game.Effects.clear();
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

    updateTitle: function() {
        var input = Game.Input;
        var hasSave = Game.Save.exists();

        if (hasSave) {
            if (input.up() && this.titleCursor > 0) this.titleCursor--;
            if (input.down() && this.titleCursor < 1) this.titleCursor++;

            if (input.confirm()) {
                if (this.titleCursor === 0) {
                    var saveData = Game.Save.load();
                    if (saveData) {
                        Game.Overworld.init(saveData.team);
                        Game.Overworld.player.gridX = saveData.position.gridX;
                        Game.Overworld.player.gridY = saveData.position.gridY;
                        Game.Overworld.player.pixelX = saveData.position.gridX * Game.Constants.TILE_SIZE;
                        Game.Overworld.player.pixelY = saveData.position.gridY * Game.Constants.TILE_SIZE;
                        Game.Overworld.player.targetX = Game.Overworld.player.pixelX;
                        Game.Overworld.player.targetY = Game.Overworld.player.pixelY;
                        Game.Overworld.player.direction = saveData.position.direction || 'down';
                        this.startTransition(0.5, function() {
                            Game.Main.state = 'OVERWORLD';
                        });
                    }
                } else {
                    Game.Save.clear();
                    Game.Inventory.reset();
                    this.state = 'STARTER_SELECT';
                    this.starterCursor = 0;
                }
            }
        } else {
            if (input.confirm()) {
                this.state = 'STARTER_SELECT';
                this.starterCursor = 0;
            }
        }
    },

    updateStarterSelect: function() {
        var input = Game.Input;
        if (input.left() && this.starterCursor > 0) this.starterCursor--;
        if (input.right() && this.starterCursor < 2) this.starterCursor++;

        if (input.confirm()) {
            var speciesId = this.starters[this.starterCursor];
            var starter = Game.createMonster(speciesId, 5);
            Game.Inventory.reset();
            Game.Inventory.add('potion', 3);
            Game.Inventory.add('antidote', 1);
            Game.Overworld.init([starter]);
            this.startTransition(0.5, function() {
                Game.Main.state = 'OVERWORLD';
                Game.Save.save();
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
            case 'LOADING':
                this.renderLoading(R);
                break;
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

    titleParticles: [],
    titleInited: false,

    renderLoading: function(R) {
        var ctx = R.ctx;
        ctx.fillStyle = '#0d0d2b';
        ctx.fillRect(0, 0, 800, 608);
        R.drawText('Cargando...', 400, 270, { size: 16, color: '#fff', align: 'center' });
        var progress = Game.Assets.progress();
        ctx.fillStyle = '#222';
        ctx.fillRect(250, 310, 300, 20);
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(250, 310, Math.floor(300 * progress), 20);
    },

    renderTitle: function(R) {
        var ctx = R.ctx;
        var t = performance.now();

        var bgGrd = ctx.createLinearGradient(0, 0, 0, 608);
        bgGrd.addColorStop(0, '#0d0d2b');
        bgGrd.addColorStop(0.5, '#1a1a3e');
        bgGrd.addColorStop(1, '#0a0a20');
        ctx.fillStyle = bgGrd;
        ctx.fillRect(0, 0, 800, 608);

        if (!this.titleInited) {
            this.titleParticles = [];
            for (var i = 0; i < 40; i++) {
                this.titleParticles.push({
                    x: Math.random() * 800,
                    y: Math.random() * 608,
                    size: 1 + Math.random() * 2.5,
                    speed: 0.2 + Math.random() * 0.5,
                    phase: Math.random() * Math.PI * 2
                });
            }
            this.titleInited = true;
        }

        for (var s = 0; s < this.titleParticles.length; s++) {
            var star = this.titleParticles[s];
            var alpha = 0.4 + Math.sin(t / 800 + star.phase) * 0.4;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
            star.y -= star.speed;
            if (star.y < -5) { star.y = 612; star.x = Math.random() * 800; }
        }
        ctx.globalAlpha = 1;

        var species = ['flamander', 'aquarion', 'thornleaf'];
        for (var m = 0; m < 3; m++) {
            var mx = 100 + m * 250;
            var my = 400 + Math.sin(t / 1000 + m * 2) * 8;
            ctx.globalAlpha = 0.15;
            R.drawMonsterSprite(mx, my, Game.Species[species[m]], { width: 80, height: 80, alpha: 0.15 });
            ctx.globalAlpha = 1;
        }

        var grd = ctx.createLinearGradient(0, 120, 0, 260);
        grd.addColorStop(0, '#ff6633');
        grd.addColorStop(0.4, '#ffcc00');
        grd.addColorStop(0.7, '#44bb44');
        grd.addColorStop(1, '#3399ff');

        var offset = Math.sin(t / 2000) * 3;
        ctx.font = '44px "Press Start 2P", monospace';
        ctx.textAlign = 'center';

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillText('MONSTER', 402, 172 + offset);
        ctx.fillText('BATTLE', 402, 237 + offset);

        ctx.fillStyle = grd;
        ctx.fillText('MONSTER', 400, 170 + offset);
        ctx.fillText('BATTLE', 400, 235 + offset);

        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.strokeText('MONSTER', 400, 170 + offset);
        ctx.strokeText('BATTLE', 400, 235 + offset);

        R.drawText('Un juego estilo Pokemon', 400, 310, { size: 10, color: '#667', align: 'center' });

        var hasSave = Game.Save.exists();
        var blink = Math.sin(t / 500) > 0;

        if (hasSave) {
            var contColor = this.titleCursor === 0 ? '#ffdd44' : '#888';
            var newColor = this.titleCursor === 1 ? '#ffdd44' : '#888';
            var contPrefix = this.titleCursor === 0 ? '> ' : '  ';
            var newPrefix = this.titleCursor === 1 ? '> ' : '  ';
            R.drawText(contPrefix + 'Continuar', 400, 390, { size: 14, color: contColor, align: 'center' });
            R.drawText(newPrefix + 'Nueva Partida', 400, 420, { size: 14, color: newColor, align: 'center' });
        } else {
            if (blink) {
                R.drawText('Pulsa ENTER para empezar', 400, 420, { size: 12, color: '#ddd', align: 'center' });
            }
        }

        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(50, 500, 700, 1);

        R.drawText('WASD/Flechas = mover', 400, 520, { size: 8, color: '#445', align: 'center' });
        R.drawText('Z/Enter = confirmar  X/Esc = cancelar', 400, 543, { size: 8, color: '#445', align: 'center' });
        R.drawText('Hierba alta = encuentros  Cruz roja = curar', 400, 566, { size: 8, color: '#445', align: 'center' });
    },

    renderStarterSelect: function(R) {
        var ctx = R.ctx;
        var t = performance.now();

        var bgGrd = ctx.createLinearGradient(0, 0, 0, 608);
        bgGrd.addColorStop(0, '#0d0d2b');
        bgGrd.addColorStop(1, '#1a1a3e');
        ctx.fillStyle = bgGrd;
        ctx.fillRect(0, 0, 800, 608);

        R.drawText('Elige tu monstruo inicial', 400, 40, { size: 14, color: '#fff', align: 'center' });

        for (var i = 0; i < 3; i++) {
            var sp = Game.Species[this.starters[i]];
            var x = 120 + i * 220;
            var y = 120;
            var selected = this.starterCursor === i;

            if (selected) {
                var glowAlpha = 0.15 + Math.sin(t / 400) * 0.08;
                ctx.fillStyle = 'rgba(' + this.hexToRgb(Game.Constants.TYPE_COLORS[sp.type]) + ',' + glowAlpha + ')';
                ctx.beginPath();
                ctx.roundRect(x - 14, y - 14, 188, 388, 12);
                ctx.fill();

                R.drawPanel(x - 10, y - 10, 180, 380);
            }

            var spriteY = selected ? y + 10 + Math.sin(t / 600 + i) * 4 : y + 10;
            R.drawMonsterSprite(x + 20, spriteY, sp, {
                width: 120,
                height: 120,
                alpha: selected ? 1 : 0.4
            });

            var nameColor = selected ? '#ffdd44' : '#777';
            R.drawText(sp.name, x + 80, y + 150, { size: 12, color: nameColor, align: 'center' });

            var typeColor = Game.Constants.TYPE_COLORS[sp.type];
            ctx.globalAlpha = selected ? 1 : 0.5;

            ctx.fillStyle = typeColor;
            ctx.beginPath();
            ctx.roundRect(x + 45, y + 172, 70, 20, 4);
            ctx.fill();
            ctx.globalAlpha = 1;

            R.drawText(sp.type.toUpperCase(), x + 80, y + 175, { size: 8, color: '#fff', align: 'center' });

            var statColor = selected ? '#bbb' : '#666';
            var labels = ['HP', 'ATK', 'DEF', 'SPA', 'SPD', 'VEL'];
            var values = [sp.baseStats.hp, sp.baseStats.attack, sp.baseStats.defense, sp.baseStats.spAttack, sp.baseStats.spDefense, sp.baseStats.speed];
            for (var s = 0; s < 6; s++) {
                var sy = y + 205 + s * 22;
                R.drawText(labels[s], x + 10, sy, { size: 7, color: statColor });

                var barW = Math.floor(values[s] / 100 * 75);
                ctx.fillStyle = '#222';
                ctx.fillRect(x + 55, sy + 2, 75, 8);
                ctx.fillStyle = selected ? typeColor : '#555';
                ctx.fillRect(x + 55, sy + 2, barW, 8);

                R.drawText('' + values[s], x + 135, sy, { size: 7, color: statColor });
            }
        }

        var blink = Math.sin(t / 400) > 0;
        if (blink) {
            R.drawText('< ENTER para elegir >', 400, 520, { size: 12, color: '#ddd', align: 'center' });
        }
    },

    hexToRgb: function(hex) {
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        return r + ',' + g + ',' + b;
    }
};

window.addEventListener('load', function() {
    document.fonts.ready.then(function() {
        Game.Main.init();
    }).catch(function() {
        Game.Main.init();
    });
});
