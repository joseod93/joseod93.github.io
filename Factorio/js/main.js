var Game = {
    tick: 0,
    paused: false,
    lastTime: 0,
    accumulator: 0,
    creativeModeOn: false,
    currentResearch: null,
    player: { inventory: {} },
    power: { production: 0, consumption: 0, satisfaction: 1 },
    powerCache: { consumptionBase: 0, solarOutput: 0, steamIds: [], accIds: [] },
    stats: null,
    milestones: {},
    prestige: null,
    rocketAnim: null,

    // Caché de power: mantenido incrementalmente desde World.placeBuilding/removeBuilding
    recalcPowerCache: function() {
        this.powerCache.consumptionBase = 0;
        this.powerCache.solarOutput = 0;
        this.powerCache.steamIds = [];
        this.powerCache.accIds = [];
        for (var i = 0; i < World.buildings.length; i++) {
            var b = World.buildings[i];
            if (!b || b.removed) continue;
            this.onBuildingPlaced(b);
        }
    },

    onBuildingPlaced: function(b) {
        var def = CFG.BUILDING_DEFS[b.type];
        if (!def) return;
        if (def.powerDraw) this.powerCache.consumptionBase += def.powerDraw;
        if (b.type === 'solar_panel') {
            this.powerCache.solarOutput += def.powerOutput;
            b.active = true;
        }
        if (b.type === 'steam_engine') this.powerCache.steamIds.push(b.id);
        if (b.type === 'accumulator') this.powerCache.accIds.push(b.id);
    },

    onBuildingRemoved: function(b) {
        var def = CFG.BUILDING_DEFS[b.type];
        if (!def) return;
        if (def.powerDraw) this.powerCache.consumptionBase -= def.powerDraw;
        if (b.type === 'solar_panel') this.powerCache.solarOutput -= def.powerOutput;
        if (b.type === 'steam_engine') {
            var idx = this.powerCache.steamIds.indexOf(b.id);
            if (idx !== -1) this.powerCache.steamIds.splice(idx, 1);
        }
        if (b.type === 'accumulator') {
            var aidx = this.powerCache.accIds.indexOf(b.id);
            if (aidx !== -1) this.powerCache.accIds.splice(aidx, 1);
        }
    },

    createStats: function() {
        return {
            itemsProduced: {},
            buildingsPlaced: 0,
            rocketsLaunched: 0,
            techsCompleted: 0
        };
    },

    // Historial de producción (no se persiste): 60 muestras de 5s = 5 min
    history: null,

    initHistory: function() {
        this.history = {
            max: 60,
            head: 0,
            count: 0,
            items: {},
            powerProd: this.zeroArray(60),
            powerCons: this.zeroArray(60),
            _lastProduced: {}
        };
    },

    zeroArray: function(n) {
        var a = new Array(n);
        for (var i = 0; i < n; i++) a[i] = 0;
        return a;
    },

    sampleHistory: function() {
        var h = this.history;
        if (!h) return;
        var produced = this.stats.itemsProduced;

        // Delta de producción desde la última muestra; 0 para items conocidos sin producción
        for (var item in produced) {
            if (!h.items[item]) h.items[item] = this.zeroArray(h.max);
            h.items[item][h.head] = produced[item] - (h._lastProduced[item] || 0);
            h._lastProduced[item] = produced[item];
        }
        for (var known in h.items) {
            if (!(known in produced)) h.items[known][h.head] = 0;
        }

        h.powerProd[h.head] = this.power.production;
        h.powerCons[h.head] = this.power.consumption;

        h.head = (h.head + 1) % h.max;
        h.count = Math.min(h.count + 1, h.max);
    },

    init: function() {
        this.stats = this.createStats();
        this.initHistory();
        this.prestige = Prestige;

        var canvas = document.getElementById('gameCanvas');
        Renderer.init(canvas);
        Camera.init(window.innerWidth, window.innerHeight);
        Particles.init();
        Audio.init();
        Belts.init();

        var loaded = Save.hasSave() && Save.load();

        if (!loaded) {
            World.init();
            Tech.init();
            Prestige.init();

            var startRes = Prestige.getUpgradeLevel('start_resources');
            if (startRes > 0) {
                Inventory.add(this.player.inventory, 'iron_plate', startRes * 20);
                Inventory.add(this.player.inventory, 'copper_plate', startRes * 10);
                Inventory.add(this.player.inventory, 'stone', startRes * 10);
                Inventory.add(this.player.inventory, 'coal', startRes * 10);
            } else {
                Inventory.add(this.player.inventory, 'iron_plate', 10);
                Inventory.add(this.player.inventory, 'iron_gear', 5);
                Inventory.add(this.player.inventory, 'copper_plate', 5);
                Inventory.add(this.player.inventory, 'stone', 10);
                Inventory.add(this.player.inventory, 'coal', 5);
            }

            var start = World.findStartPosition();
            Camera.targetX = start.x * CFG.TILE - window.innerWidth / 2;
            Camera.targetY = start.y * CFG.TILE - window.innerHeight / 2;
            Camera.x = Camera.targetX;
            Camera.y = Camera.targetY;

            if (window.innerWidth < 600) {
                Camera.zoom = 1.0;
                Camera.targetZoom = 1.0;
            }
        }

        this.recalcPowerCache();

        Input.init(canvas);
        UI.init();
        Save.init();
        Tutorial.init();

        window.addEventListener('resize', function() {
            Renderer.resize();
        });

        // Arranque de audio/música tras la primera interacción (requisito de los navegadores)
        var firstInteraction = function() {
            document.removeEventListener('pointerdown', firstInteraction);
            document.removeEventListener('keydown', firstInteraction);
            Audio.ensureContext();
            if (Audio.ctx && Audio.ctx.state === 'suspended') {
                Audio.ctx.resume();
            }
            Audio.startMusic();
        };
        document.addEventListener('pointerdown', firstInteraction);
        document.addEventListener('keydown', firstInteraction);

        this.lastTime = performance.now();
        requestAnimationFrame(this.loop.bind(this));
    },

    loop: function(timestamp) {
        var dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        if (dt > 0.25) dt = 0.25;

        Input.updateKeys(dt);
        Camera.update(dt);
        Particles.update(dt);
        UI.update(dt);
        Save.update(dt);

        if (!this.paused) {
            this.accumulator += dt;
            var tickDt = CFG.TICK_MS / 1000;
            var maxTicks = CFG.MAX_TICKS_PER_FRAME;

            while (this.accumulator >= tickDt && maxTicks > 0) {
                this.update();
                this.accumulator -= tickDt;
                maxTicks--;
            }
        }

        Renderer.render(dt);
        requestAnimationFrame(this.loop.bind(this));
    },

    update: function() {
        this.tick++;

        var effMult = Tech.isCompleted('efficiency') ? 0.75 : 1;
        this.power.consumption = this.powerCache.consumptionBase * effMult;

        var prod = this.powerCache.solarOutput;
        var steamOut = CFG.BUILDING_DEFS.steam_engine.powerOutput;
        var steamIds = this.powerCache.steamIds;
        for (var i = 0; i < steamIds.length; i++) {
            var sb = World.buildings[steamIds[i]];
            if (sb && !sb.removed && sb.active) prod += steamOut;
        }
        this.power.production = prod;

        if (prod > 0 && !this._powerEvent) {
            this._powerEvent = true;
            Tutorial.onEvent('power');
        }

        // Acumuladores: cargan con excedente, descargan en déficit
        var accIds = this.powerCache.accIds;
        if (accIds.length > 0) {
            var accDef = CFG.BUILDING_DEFS.accumulator;
            var balance = prod - this.power.consumption;
            for (var ai = 0; ai < accIds.length; ai++) {
                var acc = World.buildings[accIds[ai]];
                if (!acc || acc.removed) continue;
                if (balance > 0) {
                    var take = Math.min(accDef.chargeRate, balance, accDef.capacity - acc.charge);
                    if (take > 0) {
                        acc.charge += take;
                        balance -= take;
                        acc.active = true;
                    } else {
                        acc.active = false;
                    }
                } else if (balance < 0) {
                    var give = Math.min(accDef.dischargeRate, -balance, acc.charge);
                    if (give > 0) {
                        acc.charge -= give;
                        prod += give;
                        balance += give;
                        acc.active = true;
                    } else {
                        acc.active = false;
                    }
                } else {
                    acc.active = false;
                }
                // La barra de progreso existente del renderer muestra la carga
                acc.progress = acc.charge / accDef.capacity;
            }
            this.power.production = prod;
        }

        this.power.satisfaction = this.power.consumption > 0
            ? Math.min(1, this.power.production / this.power.consumption)
            : 1;

        Buildings.update();
        Belts.update();

        if (this.power.satisfaction < 0.5 && this.tick % 200 === 0) {
            Audio.play('power_warning');
        }

        if (this.tick % 100 === 0) {
            this.checkMilestones();
            this.sampleHistory();
        }
    },

    checkMilestones: function() {
        for (var i = 0; i < CFG.MILESTONES.length; i++) {
            var m = CFG.MILESTONES[i];
            if (this.milestones[m.id]) continue;
            if (m.check(this.stats)) {
                this.milestones[m.id] = true;
                UI.showToast('¡Logro: ' + m.name + '!', 'achievement');
                Tutorial.onEvent('produce', m.id === 'first_smelt' ? 'iron_plate' : '');
            }
        }
    },

    launchRocket: function(siloId) {
        var b = World.buildings[siloId];
        if (!b || !b.rocketReady) return;

        b.rocketParts = 0;
        b.rocketReady = false;
        this.stats.rocketsLaunched++;

        // Animación de despegue (coords copiadas: el silo puede borrarse)
        this.rocketAnim = {
            x: (b.x + 2.5) * CFG.TILE,
            y: (b.y + 2.5) * CFG.TILE,
            t: 0,
            dur: 3
        };
        Camera.shake(6, 0.9);
        Audio.play('rocket_launch');

        UI.showToast('¡COHETE LANZADO! ¡Ya puedes Prestigiar!', 'achievement');
        UI.updateResources();
    },

    resetForPrestige: function() {
        World.init();
        Belts.init();
        this.tick = 0;
        this.rocketAnim = null;
        this.player.inventory = {};
        this.stats = this.createStats();
        this.initHistory();
        this._powerEvent = false;
        this.milestones = {};
        this.currentResearch = null;
        this.power = {production:0, consumption:0, satisfaction:1};

        Tech.init();

        var startRes = Prestige.getUpgradeLevel('start_resources');
        if (startRes > 0) {
            Inventory.add(this.player.inventory, 'iron_plate', startRes * 20);
            Inventory.add(this.player.inventory, 'copper_plate', startRes * 10);
            Inventory.add(this.player.inventory, 'stone', startRes * 10);
            Inventory.add(this.player.inventory, 'coal', startRes * 10);
        } else {
            Inventory.add(this.player.inventory, 'iron_plate', 10);
            Inventory.add(this.player.inventory, 'iron_gear', 5);
            Inventory.add(this.player.inventory, 'copper_plate', 5);
            Inventory.add(this.player.inventory, 'stone', 10);
            Inventory.add(this.player.inventory, 'coal', 5);
        }

        var start = World.findStartPosition();
        Camera.targetX = start.x * CFG.TILE - window.innerWidth / 2;
        Camera.targetY = start.y * CFG.TILE - window.innerHeight / 2;
        Camera.x = Camera.targetX;
        Camera.y = Camera.targetY;

        Input.buildMode = null;
        Input.selectedBuilding = null;

        UI.buildToolbar();
        UI.closePanels();
        UI.updateResources();
        Save.save();
    }
};

window.addEventListener('DOMContentLoaded', function() {
    Game.init();
});
