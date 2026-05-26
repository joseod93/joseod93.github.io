var Save = {
    VERSION: 1,
    autoSaveTimer: 0,

    init: function() {
        this.autoSaveTimer = 0;
    },

    save: function(slot) {
        var key = slot ? 'factoryEmpire_' + slot : 'factoryEmpire_auto';
        var data = {
            version: this.VERSION,
            seed: World.seed,
            tick: Game.tick,
            timestamp: Date.now(),
            camera: {x: Camera.targetX, y: Camera.targetY, zoom: Camera.targetZoom},
            player: {inventory: Game.player.inventory},
            buildings: this.serializeBuildings(),
            belts: this.serializeBelts(),
            research: {
                completed: Tech.completed,
                progress: Tech.progress,
                current: Game.currentResearch
            },
            prestige: Prestige.getSaveData(),
            stats: Game.stats,
            milestones: Game.milestones,
            creativeModeOn: Game.creativeModeOn
        };

        try {
            var prev = localStorage.getItem(key);
            if (prev) localStorage.setItem(key + '_backup', prev);
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch(e) {
            return false;
        }
    },

    load: function(slot) {
        var key = slot ? 'factoryEmpire_' + slot : 'factoryEmpire_auto';
        try {
            var raw = localStorage.getItem(key);
            if (!raw) return false;
            var data = JSON.parse(raw);
            this.applyLoad(data);
            return true;
        } catch(e) {
            return false;
        }
    },

    hasSave: function(slot) {
        var key = slot ? 'factoryEmpire_' + slot : 'factoryEmpire_auto';
        return !!localStorage.getItem(key);
    },

    deleteSave: function(slot) {
        var key = slot ? 'factoryEmpire_' + slot : 'factoryEmpire_auto';
        localStorage.removeItem(key);
    },

    loadBackup: function(slot) {
        var key = slot ? 'factoryEmpire_' + slot : 'factoryEmpire_auto';
        try {
            var raw = localStorage.getItem(key + '_backup');
            if (!raw) return false;
            var data = JSON.parse(raw);
            this.applyLoad(data);
            return true;
        } catch(e) {
            return false;
        }
    },

    applyLoad: function(data) {
        if (!data || typeof data !== 'object') return;
        if (!data.player) data.player = {inventory:{}};
        if (!data.camera) data.camera = {x:0, y:0, zoom:1};
        if (!data.buildings) data.buildings = [];
        if (!data.belts) data.belts = [];
        if (!data.stats) data.stats = null;
        if (!data.research) data.research = {};

        World.init(data.seed);
        Belts.init();
        Game.tick = data.tick || 0;
        Game.player.inventory = data.player.inventory || {};
        Game.stats = data.stats || Game.createStats();
        Game.milestones = data.milestones || {};
        Game.currentResearch = data.research ? data.research.current : null;
        Game.creativeModeOn = data.creativeModeOn || false;

        Camera.targetX = data.camera.x;
        Camera.targetY = data.camera.y;
        Camera.x = data.camera.x;
        Camera.y = data.camera.y;
        Camera.targetZoom = data.camera.zoom;
        Camera.zoom = data.camera.zoom;

        Prestige.init(data.prestige);
        Tech.completed = data.research ? data.research.completed : {};
        Tech.progress = data.research ? data.research.progress : {};

        try { this.deserializeBuildings(data.buildings); } catch(e) {}
        try { this.deserializeBelts(data.belts); } catch(e) {}

        var elapsed = Date.now() - (data.timestamp || Date.now());
        var offlineTicks = Math.min(Math.floor(elapsed / CFG.TICK_MS), 20 * 60 * 60 * 8);
        if (offlineTicks > 20) {
            this.simulateOffline(offlineTicks);
        }

        UI.updateResources();
    },

    serializeBuildings: function() {
        var arr = [];
        for (var i = 0; i < World.buildings.length; i++) {
            var b = World.buildings[i];
            if (!b || b.removed) { arr.push(null); continue; }
            arr.push({
                t: b.type, x: b.x, y: b.y, d: b.direction,
                i: b.input, o: b.output, f: b.fuel,
                p: b.progress, r: b.recipeId,
                s: b.stored, rp: b.rocketParts
            });
        }
        return arr;
    },

    deserializeBuildings: function(arr) {
        if (!arr) return;
        for (var i = 0; i < arr.length; i++) {
            var d = arr[i];
            if (!d) { World.buildings.push(null); continue; }

            var b = {
                type: d.t, x: d.x, y: d.y, direction: d.d || 0,
                input: d.i || {}, output: d.o || {}, fuel: d.f || {},
                progress: d.p || 0, active: false, removed: false,
                recipe: null, recipeId: d.r || null,
                stored: d.s || {}, rocketParts: d.rp || 0
            };

            if (d.t === 'storage') {
                b.capacity = (CFG.BUILDING_DEFS.storage && CFG.BUILDING_DEFS.storage.capacity) || 200;
            }
            if (d.t === 'rocket_silo') {
                b.rocketReady = b.rocketParts >= 100;
            }
            if (d.t === 'splitter') {
                b.splitToggle = 0;
            }

            World.placeBuilding(b);
        }
    },

    serializeBelts: function() {
        var arr = [];
        for (var i = 0; i < Belts.lines.length; i++) {
            var line = Belts.lines[i];
            if (line.removed) { arr.push(null); continue; }
            var items = [];
            for (var j = 0; j < line.items.length; j++) {
                items.push([line.items[j].type, line.items[j].gap]);
            }
            arr.push({
                d: line.dir,
                t: line.tiles.map(function(t) { return [t.x, t.y]; }),
                it: items,
                hg: line.headGap,
                sp: line.speed
            });
        }
        return arr;
    },

    deserializeBelts: function(arr) {
        if (!arr) return;
        for (var i = 0; i < arr.length; i++) {
            var d = arr[i];
            if (!d) { Belts.lines.push({removed: true, id: i, tiles:[], items:[], dir:0, headGap:0, lastPositiveGapIndex:-1, speed:0}); continue; }
            var line = {
                id: Belts.lines.length,
                dir: d.d,
                tiles: d.t.map(function(t) { return {x:t[0], y:t[1]}; }),
                items: d.it.map(function(it) { return {type:it[0], gap:it[1]}; }),
                headGap: d.hg,
                lastPositiveGapIndex: -1,
                speed: d.sp || CFG.BELT_SPEED,
                removed: false
            };
            Belts.lines.push(line);
            Belts.rebuildTileIndex(line);
            Belts.recalcLastPositive(line);
        }
    },

    simulateOffline: function(ticks) {
        var produced = {};
        for (var t = 0; t < ticks; t++) {
            Buildings.update();
            Belts.update();
            Game.tick++;
        }
        UI.showToast('¡Bienvenido! Tu fábrica produjo durante ' + Math.floor(ticks / 20) + 's.', 'achievement');
    },

    update: function(dt) {
        this.autoSaveTimer += dt * 1000;
        if (this.autoSaveTimer >= CFG.AUTOSAVE_INTERVAL) {
            this.autoSaveTimer = 0;
            this.save();
        }
    },

    exportSave: function() {
        var key = 'factoryEmpire_auto';
        var raw = localStorage.getItem(key);
        if (!raw) return '';
        return btoa(raw);
    },

    importSave: function(b64) {
        try {
            var raw = atob(b64);
            var data = JSON.parse(raw);
            this.applyLoad(data);
            localStorage.setItem('factoryEmpire_auto', raw);
            return true;
        } catch(e) {
            return false;
        }
    }
};
