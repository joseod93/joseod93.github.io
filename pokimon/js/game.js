window.Game = window.Game || {};

Game.Main = {
    state: 'TITLE',
    lastTime: 0,
    starterCursor: 0,
    transitionTimer: 0,
    transitionCallback: null,
    pendingEncounter: null,
    titleCursor: 0,
    audioInited: false,

    shopCursor: 0,
    shopConfirm: false,

    learnMoveMon: null,
    learnMoveNew: null,
    learnMoveCursor: 0,

    evolutionMon: null,
    evolutionTimer: 0,
    evolutionCursor: 0,

    pendingPostBattle: null,

    starters: ['flamander', 'aquarion', 'thornleaf'],

    init: function() {
        var canvas = document.getElementById('game');
        canvas.width = Game.Constants.CANVAS_WIDTH;
        canvas.height = Game.Constants.CANVAS_HEIGHT;
        Game.Renderer.init(canvas);

        var self = this;
        canvas.addEventListener('click', function() {
            canvas.focus();
            self.initAudio();
        });
        canvas.setAttribute('tabindex', '0');
        canvas.focus();

        window.addEventListener('keydown', function() {
            self.initAudio();
        }, { once: true });

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

    initAudio: function() {
        if (this.audioInited) return;
        this.audioInited = true;
        Game.Audio.init();
        if (this.state === 'OVERWORLD') Game.Audio.playMusic('overworld');
        else if (this.state === 'BATTLE') Game.Audio.playMusic('battle');
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
                if (result) this.handleOverworldResult(result);
                break;

            case 'BATTLE':
                Game.BattleUI.updateEffects(dt);
                Game.Battle.update();

                if (Game.Battle.state === 'FORCE_SWITCH') {
                    this.updateForceSwitch();
                }

                if (!Game.Battle.active) {
                    this.handleBattleEnd();
                }
                break;

            case 'SHOP':
                this.updateShop();
                break;

            case 'LEARN_MOVE':
                this.updateLearnMove();
                break;

            case 'EVOLUTION':
                this.updateEvolution(dt);
                break;
        }
    },

    handleOverworldResult: function(result) {
        if (result.type === 'encounter') {
            this.pendingEncounter = result.monster;
            Game.Effects.encounterFlash();
            Game.Audio.playEncounter();
            this.startTransition(0.5, function() {
                Game.Effects.clear();
                Game.Audio.playMusic('battle');
                Game.Battle.start(Game.Overworld.player.team, Game.Main.pendingEncounter);
                Game.Main.state = 'BATTLE';
            });
        } else if (result.type === 'trainer') {
            var npc = result.npc;
            var enemyTeam = [];
            for (var i = 0; i < npc.team.length; i++) {
                enemyTeam.push(Game.createMonster(npc.team[i].speciesId, npc.team[i].level));
            }
            this.startTransition(0.5, function() {
                Game.Effects.clear();
                Game.Audio.playMusic('battle');
                Game.Battle.start(Game.Overworld.player.team, enemyTeam, {
                    id: npc.id, name: npc.name,
                    preText: npc.preText, postText: npc.postText,
                    reward: npc.reward
                });
                Game.Main.state = 'BATTLE';
            });
        } else if (result.type === 'shop') {
            this.state = 'SHOP';
            this.shopCursor = 0;
            this.shopConfirm = false;
        }
    },

    handleBattleEnd: function() {
        var B = Game.Battle;

        if (B.result === 'DEFEAT') {
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

        if (B.isTrainerBattle && B.result === 'VICTORY' && B.trainerData) {
            Game.Overworld.defeatNPC(B.trainerData.id);
        }

        if (B.result === 'VICTORY' && (B.pendingMoves.length > 0 || B.pendingEvolutions.length > 0)) {
            this.pendingPostBattle = {
                moves: B.pendingMoves.slice(),
                evolutions: B.pendingEvolutions.slice(),
                mon: B.playerMon
            };
        } else {
            this.pendingPostBattle = null;
        }

        this.startTransition(0.4, function() {
            Game.Audio.playMusic('overworld');
            Game.Main.processPostBattle();
        });
    },

    processPostBattle: function() {
        var pb = this.pendingPostBattle;

        if (pb && pb.moves.length > 0) {
            var newMove = pb.moves.shift();
            this.learnMoveMon = pb.mon;
            this.learnMoveNew = newMove;
            this.learnMoveCursor = 0;
            this.state = 'LEARN_MOVE';
            return;
        }

        if (pb && pb.evolutions.length > 0) {
            var mon = pb.evolutions.shift();
            if (mon.canEvolve()) {
                this.evolutionMon = mon;
                this.evolutionTimer = 3;
                this.evolutionCursor = 0;
                this.state = 'EVOLUTION';
                Game.Audio.playEvolution();
                return;
            }
        }

        this.pendingPostBattle = null;
        this.state = 'OVERWORLD';
        if (Game.Save) Game.Save.save();
    },

    updateTitle: function() {
        var input = Game.Input;
        var hasSave = Game.Save.exists();

        if (hasSave) {
            if (input.up() && this.titleCursor > 0) this.titleCursor--;
            if (input.down() && this.titleCursor < 1) this.titleCursor++;

            if (input.confirm()) {
                this.initAudio();
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
                            Game.Audio.playMusic('overworld');
                        });
                    }
                } else {
                    Game.Save.clear();
                    Game.Inventory.reset();
                    Game.Overworld.defeatedNPCs = [];
                    this.state = 'STARTER_SELECT';
                    this.starterCursor = 0;
                }
            }
        } else {
            if (input.confirm()) {
                this.initAudio();
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
            Game.Inventory.add('pokeball', 5);
            Game.Overworld.defeatedNPCs = [];
            Game.Overworld.init([starter]);
            this.startTransition(0.5, function() {
                Game.Main.state = 'OVERWORLD';
                Game.Audio.playMusic('overworld');
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

    updateShop: function() {
        var input = Game.Input;
        var items = Game.ShopItems;

        if (this.shopConfirm) {
            if (input.confirm()) {
                var itemId = items[this.shopCursor];
                var def = Game.Items[itemId];
                if (Game.Inventory.money >= def.price) {
                    Game.Inventory.money -= def.price;
                    Game.Inventory.add(itemId);
                    Game.Audio.playBuy();
                } else {
                    Game.Audio.playError();
                }
                this.shopConfirm = false;
            }
            if (input.cancel()) {
                this.shopConfirm = false;
                Game.Audio.playCancel();
            }
            return;
        }

        var old = this.shopCursor;
        if (input.up() && this.shopCursor > 0) this.shopCursor--;
        if (input.down() && this.shopCursor < items.length - 1) this.shopCursor++;
        if (this.shopCursor !== old) Game.Audio.playSelect();

        if (input.cancel()) {
            this.state = 'OVERWORLD';
            Game.Audio.playCancel();
            return;
        }

        if (input.confirm()) {
            Game.Audio.playConfirm();
            this.shopConfirm = true;
        }
    },

    updateLearnMove: function() {
        var input = Game.Input;

        var old = this.learnMoveCursor;
        if (input.up() && this.learnMoveCursor > 0) this.learnMoveCursor--;
        if (input.down() && this.learnMoveCursor < 4) this.learnMoveCursor++;
        if (this.learnMoveCursor !== old) Game.Audio.playSelect();

        if (input.confirm()) {
            if (this.learnMoveCursor < 4) {
                this.learnMoveMon.forgetMove(this.learnMoveCursor);
                this.learnMoveMon.addMove(this.learnMoveNew);
                Game.Audio.playLevelUp();
            } else {
                Game.Audio.playCancel();
            }
            this.processPostBattle();
        }

        if (input.cancel()) {
            Game.Audio.playCancel();
            this.processPostBattle();
        }
    },

    updateEvolution: function(dt) {
        this.evolutionTimer -= dt;

        if (this.evolutionTimer <= 0) {
            var input = Game.Input;
            var old = this.evolutionCursor;
            if (input.left() && this.evolutionCursor > 0) this.evolutionCursor--;
            if (input.right() && this.evolutionCursor < 1) this.evolutionCursor++;
            if (this.evolutionCursor !== old) Game.Audio.playSelect();

            if (input.confirm()) {
                if (this.evolutionCursor === 0) {
                    this.evolutionMon.evolve();
                    Game.Audio.playEvolution();
                }
                this.processPostBattle();
            }
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
            case 'SHOP':
                Game.Overworld.draw();
                this.renderShop(R);
                break;
            case 'LEARN_MOVE':
                this.renderLearnMove(R);
                break;
            case 'EVOLUTION':
                this.renderEvolution(R);
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

        R.drawText('WASD/Flechas = mover  ESC = pausa', 400, 520, { size: 8, color: '#445', align: 'center' });
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
            for (var ss = 0; ss < 6; ss++) {
                var sy = y + 205 + ss * 22;
                R.drawText(labels[ss], x + 10, sy, { size: 7, color: statColor });

                var barW = Math.floor(values[ss] / 100 * 75);
                ctx.fillStyle = '#222';
                ctx.fillRect(x + 55, sy + 2, 75, 8);
                ctx.fillStyle = selected ? typeColor : '#555';
                ctx.fillRect(x + 55, sy + 2, barW, 8);

                R.drawText('' + values[ss], x + 135, sy, { size: 7, color: statColor });
            }
        }

        var blink = Math.sin(t / 400) > 0;
        if (blink) {
            R.drawText('< ENTER para elegir >', 400, 520, { size: 12, color: '#ddd', align: 'center' });
        }
    },

    renderShop: function(R) {
        var ctx = R.ctx;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, 800, 608);

        R.drawPanel(150, 80, 500, 450);
        R.drawText('TIENDA', 400, 100, { size: 18, color: '#ffdd44', align: 'center' });
        R.drawText('Dinero: $' + Game.Inventory.money, 400, 130, { size: 12, color: '#88ff88', align: 'center' });

        var items = Game.ShopItems;
        for (var i = 0; i < items.length; i++) {
            var def = Game.Items[items[i]];
            var sel = this.shopCursor === i;
            var y = 170 + i * 50;
            var canBuy = Game.Inventory.money >= def.price;

            if (sel) {
                R.drawRect(170, y - 5, 460, 42, 'rgba(255,255,255,0.06)');
            }

            var nameColor = sel ? '#ffdd44' : '#fff';
            if (!canBuy) nameColor = sel ? '#aa8833' : '#666';

            R.drawText((sel ? '> ' : '  ') + def.name, 190, y, { size: 14, color: nameColor });
            R.drawText('$' + def.price, 480, y, { size: 12, color: canBuy ? '#88ff88' : '#884444' });
            R.drawText('x' + Game.Inventory.count(items[i]), 560, y, { size: 10, color: '#aaa' });
            R.drawText(def.description, 210, y + 22, { size: 8, color: '#888' });
        }

        if (this.shopConfirm) {
            R.drawPanel(270, 420, 260, 50);
            var cDef = Game.Items[items[this.shopCursor]];
            R.drawText('Comprar ' + cDef.name + '?', 300, 430, { size: 10, color: '#fff' });
            R.drawText('[Z] Si  [X] No', 300, 450, { size: 9, color: '#aaa' });
        }

        R.drawText('[ESC] Salir', 400, 510, { size: 8, color: '#666', align: 'center' });
    },

    renderLearnMove: function(R) {
        var ctx = R.ctx;
        ctx.fillStyle = '#0d0d2b';
        ctx.fillRect(0, 0, 800, 608);

        var mon = this.learnMoveMon;
        var newMove = this.learnMoveNew;

        R.drawText(mon.name + ' quiere aprender ' + newMove.name + '!', 400, 50, { size: 14, color: '#fff', align: 'center' });
        R.drawText('Elige un movimiento para olvidar:', 400, 80, { size: 10, color: '#ccc', align: 'center' });

        for (var i = 0; i < mon.moves.length; i++) {
            var m = mon.moves[i];
            var sel = this.learnMoveCursor === i;
            var y = 130 + i * 60;
            var color = sel ? '#ffdd44' : '#ccc';

            R.drawPanel(200, y - 5, 400, 50);
            R.drawText((sel ? '> ' : '  ') + m.name, 220, y + 5, { size: 14, color: color });
            var typeCol = Game.Constants.TYPE_COLORS[m.type] || '#aaa';
            R.drawText(m.type.toUpperCase(), 420, y + 5, { size: 8, color: typeCol });
            R.drawText('POD:' + m.power + '  PP:' + m.pp, 220, y + 28, { size: 8, color: '#888' });
        }

        var newSel = this.learnMoveCursor === 4;
        R.drawPanel(200, 375, 400, 50);
        R.drawText((newSel ? '> ' : '  ') + 'No aprender ' + newMove.name, 220, 385, { size: 12, color: newSel ? '#ff6644' : '#888' });

        R.drawPanel(200, 460, 400, 80);
        R.drawText('NUEVO: ' + newMove.name, 220, 475, { size: 14, color: '#44ff44' });
        var ntc = Game.Constants.TYPE_COLORS[newMove.type] || '#aaa';
        R.drawText(newMove.type.toUpperCase(), 480, 475, { size: 8, color: ntc });
        R.drawText('POD:' + newMove.power + '  PP:' + newMove.pp + '  ACC:' + newMove.accuracy, 220, 500, { size: 8, color: '#aaa' });
    },

    renderEvolution: function(R) {
        var ctx = R.ctx;
        var t = performance.now();
        ctx.fillStyle = '#0d0d2b';
        ctx.fillRect(0, 0, 800, 608);

        var mon = this.evolutionMon;
        var evoSpec = Game.Species[mon.species.evolution.to];

        R.drawText('Que? ' + mon.name + ' esta evolucionando!', 400, 50, { size: 14, color: '#fff', align: 'center' });

        var flash = Math.sin(t / 100) * 0.3 + 0.7;
        ctx.globalAlpha = flash;
        R.drawMonsterSprite(200, 180, mon.species, { width: 160, height: 160 });
        ctx.globalAlpha = 1;

        R.drawText('->', 400, 250, { size: 24, color: '#ffdd44', align: 'center' });

        if (evoSpec) {
            ctx.globalAlpha = 0.5 + Math.sin(t / 200) * 0.3;
            R.drawMonsterSprite(480, 180, evoSpec, { width: 160, height: 160 });
            ctx.globalAlpha = 1;
            R.drawText(evoSpec.name, 560, 360, { size: 14, color: '#ffdd44', align: 'center' });
        }

        if (this.evolutionTimer <= 0) {
            R.drawPanel(200, 420, 400, 80);
            var yesColor = this.evolutionCursor === 0 ? '#44ff44' : '#888';
            var noColor = this.evolutionCursor === 1 ? '#ff4444' : '#888';
            R.drawText('Evolucionar?', 400, 435, { size: 14, color: '#fff', align: 'center' });
            R.drawText((this.evolutionCursor === 0 ? '> ' : '  ') + 'Si', 320, 465, { size: 14, color: yesColor });
            R.drawText((this.evolutionCursor === 1 ? '> ' : '  ') + 'No', 440, 465, { size: 14, color: noColor });
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
