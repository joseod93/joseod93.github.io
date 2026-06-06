var Save = {
    VERSION: 1,
    autoSaveTimer: 0,
    quotaWarned: false,

    // Migraciones de versión: MIGRATIONS[n] transforma datos de versión n a n+1
    MIGRATIONS: {},

    init: function() {
        this.autoSaveTimer = 0;
    },

    isQuotaError: function(e) {
        return !!e && (e.name === 'QuotaExceededError' ||
            e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            e.code === 22 || e.code === 1014);
    },

    migrate: function(data) {
        var v = data.version || 1;
        while (v < this.VERSION) {
            var fn = this.MIGRATIONS[v];
            if (!fn) break;
            data = fn(data) || data;
            v++;
            data.version = v;
        }
        return data;
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

        var json;
        try {
            json = JSON.stringify(data);
        } catch(e) {
            return false;
        }

        try {
            var prev = localStorage.getItem(key);
            if (prev) localStorage.setItem(key + '_backup', prev);
            localStorage.setItem(key, json);
            this.quotaWarned = false;
            return true;
        } catch(e) {
            if (this.isQuotaError(e)) {
                // Liberar espacio borrando el backup y reintentar
                try {
                    localStorage.removeItem(key + '_backup');
                    localStorage.setItem(key, json);
                    if (!this.quotaWarned) {
                        UI.showToast('Almacenamiento casi lleno: backup eliminado', 'warning');
                        this.quotaWarned = true;
                    }
                    return true;
                } catch(e2) {
                    if (!this.quotaWarned) {
                        UI.showToast('¡Almacenamiento lleno! Exporta tu partida desde Ajustes', 'warning');
                        this.quotaWarned = true;
                    }
                    return false;
                }
            }
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
        data = this.migrate(data);
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

        Game.recalcPowerCache();
        Game.initHistory(); // evita delta gigante falso al cargar en caliente

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
            var entry = {
                t: b.type, x: b.x, y: b.y, d: b.direction,
                i: b.input, o: b.output, f: b.fuel,
                p: b.progress, r: b.recipeId,
                s: b.stored, rp: b.rocketParts
            };
            if (b.filterItem) entry.fl = b.filterItem;
            if (b.outputPriority && b.outputPriority !== 'balanced') entry.pr = b.outputPriority;
            if (b.charge) entry.ch = b.charge;
            if (b.type === 'underground_belt') {
                entry.um = b.ugMode;
                if (b.pairId !== null && b.pairId !== undefined) entry.pi = b.pairId;
                if (b.transit && b.transit.length > 0) {
                    entry.tr = b.transit.map(function(it) { return [it.type, it.left]; });
                }
            }
            arr.push(entry);
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
                b.outputPriority = d.pr || 'balanced';
            }
            if (d.t === 'inserter') {
                b.filterItem = d.fl || null;
            }
            if (d.t === 'accumulator') {
                b.charge = d.ch || 0;
            }
            if (d.t === 'miner' || d.t === 'electric_miner') {
                // Pre-marcar para no disparar toasts de veta agotada al cargar
                var mDef = CFG.BUILDING_DEFS[d.t];
                b.depleted = !World.hasResource(d.x, d.y, mDef.size[0], mDef.size[1]);
            }
            if (d.t === 'underground_belt') {
                b.ugMode = d.um || 'in';
                b.pairId = (d.pi === undefined || d.pi === null) ? null : d.pi;
                b.transit = [];
                if (d.tr) {
                    for (var k = 0; k < d.tr.length; k++) {
                        b.transit.push({type: d.tr[k][0], left: d.tr[k][1]});
                    }
                }
                b.cooldown = 0;
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
            // gap del item de cola siempre 0 (saves antiguos podían traer valores stale)
            if (line.items.length > 0) line.items[0].gap = 0;
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
            this.save(); // persistir ya migrado (no el raw antiguo)
            return true;
        } catch(e) {
            return false;
        }
    }
};
