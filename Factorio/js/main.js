var Game = {
    tick: 0,
    paused: false,
    lastTime: 0,
    accumulator: 0,
    creativeModeOn: false,
    currentResearch: null,
    player: { inventory: {} },
    power: { production: 0, consumption: 0, satisfaction: 1 },
    stats: null,
    milestones: {},
    prestige: null,

    createStats: function() {
        return {
            itemsProduced: {},
            buildingsPlaced: 0,
            rocketsLaunched: 0,
            techsCompleted: 0
        };
    },

    init: function() {
        this.stats = this.createStats();
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

        Input.init(canvas);
        UI.init();
        Save.init();
        Tutorial.init();

        window.addEventListener('resize', function() {
            Renderer.resize();
        });

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

        this.power.production = 0;
        this.power.consumption = 0;

        for (var i = 0; i < World.buildings.length; i++) {
            var b = World.buildings[i];
            if (!b || b.removed) continue;
            var def = CFG.BUILDING_DEFS[b.type];
            if (def.powerDraw) this.power.consumption += def.powerDraw;
            if (b.type === 'solar_panel') {
                b.active = true;
                this.power.production += def.powerOutput;
            }
            if (b.type === 'steam_engine' && b.active) {
                this.power.production += def.powerOutput;
            }
        }
        this.power.satisfaction = this.power.consumption > 0
            ? Math.min(1, this.power.production / this.power.consumption)
            : 1;

        Buildings.update();
        Belts.update();

        if (this.tick % 100 === 0) {
            this.checkMilestones();
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

        Particles.spawn(
            (b.x + 2.5) * CFG.TILE, (b.y + 2.5) * CFG.TILE,
            'achievement'
        );

        UI.showToast('¡COHETE LANZADO! ¡Ya puedes Prestigiar!', 'achievement');
        Audio.play('research');
        UI.updateResources();
    },

    resetForPrestige: function() {
        World.init();
        Belts.init();
        this.tick = 0;
        this.player.inventory = {};
        this.stats = this.createStats();
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
