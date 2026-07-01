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
            objective: Game.objectiveIndex,
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
            // No pisar un backup bueno con un main corrupto (check estructural
            // barato; un JSON.parse completo cada 60s también sería aceptable)
            if (prev && prev.charAt(0) === '{' && prev.indexOf('"version"') !== -1) {
                localStorage.setItem(key + '_backup', prev);
            }
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
            console.error('Error cargando partida:', e);
            return false;
        }
    },

    hasSave: function(slot) {
        var key = slot ? 'factoryEmpire_' + slot : 'factoryEmpire_auto';
        return !!localStorage.getItem(key);
    },

    hasBackup: function(slot) {
        var key = slot ? 'factoryEmpire_' + slot : 'factoryEmpire_auto';
        return !!localStorage.getItem(key + '_backup');
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
            // Promover el backup a main: si no, el próximo autosave copiaría
            // el main corrupto encima del backup recién usado
            try { localStorage.setItem(key, raw); } catch(e2) {}
            return true;
        } catch(e) {
            console.error('Error cargando backup:', e);
            return false;
        }
    },

    applyLoad: function(data) {
        if (!data || typeof data !== 'object') return;
        data = this.migrate(data);
        if (!data.player) data.player = {inventory:{}};
        if (!data.camera || typeof data.camera !== 'object') data.camera = {};
        if (typeof data.camera.x !== 'number') data.camera.x = 0;
        if (typeof data.camera.y !== 'number') data.camera.y = 0;
        if (typeof data.camera.zoom !== 'number' || data.camera.zoom <= 0) data.camera.zoom = 1;
        data.camera.zoom = Math.max(CFG.ZOOM_MIN, Math.min(CFG.ZOOM_MAX, data.camera.zoom)); // save corrupto/editado
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
        Game.objectiveIndex = data.objective || 0;
        Game.currentResearch = data.research ? data.research.current : null;
        Game.creativeModeOn = data.creativeModeOn || false;

        Camera.targetX = data.camera.x;
        Camera.targetY = data.camera.y;
        Camera.x = data.camera.x;
        Camera.y = data.camera.y;
        Camera.targetZoom = data.camera.zoom;
        Camera.zoom = data.camera.zoom;

        Prestige.init(data.prestige);
        Tech.completed = (data.research && data.research.completed) || {};
        Tech.progress = (data.research && data.research.progress) || {};

        // La selección y los snapshots de undo apuntan al mundo anterior
        Input.selectedBuilding = null;
        Buildings.clearUndo();
        UI.closePanels();

        try { this.deserializeBuildings(data.buildings); } catch(e) {
            console.error('Error deserializando edificios:', e);
            UI.showToast('Aviso: datos de edificios dañados — partida parcial', 'warning');
        }
        try { this.deserializeBelts(data.belts); } catch(e) {
            console.error('Error deserializando cintas:', e);
            UI.showToast('Aviso: datos de cintas dañados — partida parcial', 'warning');
        }

        this.validateLoaded();
        World.compactBuildings();
        Belts.compactLines();

        Game.recalcPowerCache();
        Belts.recomputeSpeeds(); // aplica mejoras de velocidad de cinta a líneas ya colocadas

        // Objetivos ya completos al GUARDAR: saltarlos sin recompensa (ya se concedieron en
        // vivo, o es un save legacy previo al sistema). Debe ir ANTES del offline para no
        // re-recompensar lo ya hecho.
        Game.syncObjectivesSilently();

        var elapsed = Date.now() - (data.timestamp || Date.now());
        // Cap de catch-up: el bucle es síncrono O(ticks×edificios); 30 min evita congelar la pestaña
        var requested = Math.floor(elapsed / CFG.TICK_MS);
        var offlineTicks = Math.min(requested, 20 * 60 * 30);
        if (offlineTicks > 20) {
            this.simulateOffline(offlineTicks, requested > offlineTicks);
        }

        // initHistory DESPUÉS del offline: su línea base incluye la producción offline,
        // así el primer muestreo no marca un pico gigante falso en la gráfica.
        Game.initHistory();
        UI.resetRates(); // ídem para las tasas +X/s de la barra de recursos

        // Objetivos cruzados DURANTE el offline sí dan recompensa + fanfarria
        Game.checkObjectives();

        UI.updateResources();
        UI.renderObjective();
    },

    // Compacto: emite solo edificios vivos, con pi (pairId) remapeado al índice
    // del array serializado. Dos pasadas porque pairId puede apuntar hacia
    // delante. Los nulls posicionales de saves viejos se siguen aceptando al
    // cargar; ya no se emiten.
    serializeBuildings: function() {
        var remap = {};
        var next = 0;
        for (var i = 0; i < World.buildings.length; i++) {
            var b = World.buildings[i];
            if (b && !b.removed) { remap[i] = next; next++; }
        }

        var arr = [];
        for (var j = 0; j < World.buildings.length; j++) {
            var b2 = World.buildings[j];
            if (!b2 || b2.removed) continue;
            var entry = {
                t: b2.type, x: b2.x, y: b2.y, d: b2.direction,
                i: b2.input, o: b2.output, f: b2.fuel,
                p: b2.progress, r: b2.recipeId,
                s: b2.stored, rp: b2.rocketParts
            };
            if (b2.filterItem) entry.fl = b2.filterItem;
            if (b2.outputPriority && b2.outputPriority !== 'balanced') entry.pr = b2.outputPriority;
            if (b2.charge) entry.ch = b2.charge;
            if (b2.modules && b2.modules.length > 0) entry.md = b2.modules;
            if (b2.type === 'underground_belt') {
                entry.um = b2.ugMode;
                if (b2.pairId !== null && b2.pairId !== undefined &&
                    remap[b2.pairId] !== undefined) {
                    entry.pi = remap[b2.pairId];
                }
                if (b2.transit && b2.transit.length > 0) {
                    entry.tr = b2.transit.map(function(it) { return [it.type, it.left]; });
                }
            }
            arr.push(entry);
        }
        return arr;
    },

    deserializeBuildings: function(arr) {
        if (!arr) return;
        var skipped = 0;
        for (var i = 0; i < arr.length; i++) {
            var d = arr[i];
            if (!d) { World.buildings.push(null); continue; }

            var lenBefore = World.buildings.length;
            try {
                if (!CFG.BUILDING_DEFS[d.t]) throw new Error('tipo desconocido: ' + d.t);

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

                // Módulos ANTES de placeBuilding: el hook de power lee b.modEnergy.
                // Filtro y clamp protegen contra saves manipulados o defs cambiadas.
                var bDef = CFG.BUILDING_DEFS[d.t];
                if (bDef.moduleSlots) {
                    b.modules = [];
                    if (d.md) {
                        for (var mk = 0; mk < d.md.length && b.modules.length < bDef.moduleSlots; mk++) {
                            if (CFG.MODULES[d.md[mk]]) b.modules.push(d.md[mk]);
                        }
                    }
                    Buildings.recalcModuleStats(b);
                }

                World.placeBuilding(b);
            } catch(e) {
                console.error('Edificio dañado en save (entrada ' + i + '):', e);
                // null posicional: conserva los índices (pi) del resto de
                // entradas. validateLoaded limpia restos de un place parcial.
                World.buildings.length = lenBefore;
                World.buildings.push(null);
                skipped++;
            }
        }
        if (skipped > 0) {
            UI.showToast('Se omitieron ' + skipped + ' edificios dañados', 'warning');
        }
    },

    serializeBelts: function() {
        var arr = [];
        for (var i = 0; i < Belts.lines.length; i++) {
            var line = Belts.lines[i];
            if (line.removed) continue;
            var items = [];
            for (var j = 0; j < line.items.length; j++) {
                items.push([line.items[j].type, line.items[j].gap]);
            }
            arr.push({
                d: line.dir,
                t: line.tiles.map(function(t) { return [t.x, t.y]; }),
                it: items,
                hg: line.headGap,
                sp: line.speed,
                fa: line.fast ? 1 : 0
            });
        }
        return arr;
    },

    deserializeBelts: function(arr) {
        if (!arr) return;
        for (var i = 0; i < arr.length; i++) {
            var d = arr[i];
            // Nada del save referencia índices de línea: los nulls de saves
            // viejos se saltan sin placeholder
            if (!d) continue;
            // Resiliencia por entrada: una línea corrupta no debe tirar el resto
            try {
                var sp = d.sp || CFG.BELT_SPEED;
                var fast = (d.fa !== undefined) ? !!d.fa : (sp >= CFG.FAST_BELT_SPEED - 0.001);
                var line = {
                    id: Belts.lines.length,
                    dir: d.d,
                    tiles: d.t.map(function(t) { return {x:t[0], y:t[1]}; }),
                    items: d.it.map(function(it) { return {type:it[0], gap:it[1]}; }),
                    headGap: d.hg,
                    lastPositiveGapIndex: -1,
                    fast: fast,
                    speed: sp,
                    removed: false
                };
                // gap del item de cola siempre 0 (saves antiguos podían traer valores stale)
                if (line.items.length > 0) line.items[0].gap = 0;
                Belts.lines.push(line);
                Belts.rebuildTileIndex(line);
                Belts.recalcLastPositive(line);
            } catch (e) {
                console.error('Cinta dañada en save (entrada ' + i + '):', e);
            }
        }
    },

    // Repara referencias rotas tras deserializar (saves corruptos o manipulados)
    validateLoaded: function() {
        var fixes = 0;
        var n = World.buildings.length;

        for (var i = 0; i < n; i++) {
            var b = World.buildings[i];
            if (!b || b.removed) continue;

            if (b.id !== i) { b.id = i; fixes++; }

            if (b.type === 'underground_belt') {
                if (!b.transit || Object.prototype.toString.call(b.transit) !== '[object Array]') {
                    b.transit = [];
                    fixes++;
                }
                if (b.ugMode !== 'in' && b.ugMode !== 'out') {
                    b.ugMode = 'in';
                    b.pairId = null;
                    fixes++;
                }
                if (b.pairId !== null && b.pairId !== undefined) {
                    var p = b.pairId;
                    var pair = (typeof p === 'number' && p >= 0 && p < n) ? World.buildings[p] : null;
                    var valid = pair && !pair.removed && pair.type === 'underground_belt' &&
                        pair.id !== b.id && pair.ugMode !== b.ugMode;
                    if (!valid) { b.pairId = null; fixes++; }
                }
            }

            if (b.type === 'assembler' && b.recipeId && !Buildings.getAssemblyRecipe(b.recipeId)) {
                b.recipeId = null;
                fixes++;
            }
        }

        // Reciprocidad de pares: solo se rompe el lado no correspondido
        // (no tocar al otro, que puede formar par válido con un tercero)
        for (var j = 0; j < n; j++) {
            var ub = World.buildings[j];
            if (!ub || ub.removed || ub.type !== 'underground_belt') continue;
            if (ub.pairId === null || ub.pairId === undefined) continue;
            var mate = World.buildings[ub.pairId];
            if (!mate || mate.pairId !== ub.id) {
                ub.pairId = null;
                fixes++;
            }
        }

        // Índices espaciales: ids muertos o fuera de rango
        for (var key in World.buildingMap) {
            var id = World.buildingMap[key];
            var mb = (typeof id === 'number') ? World.buildings[id] : null;
            if (!mb || mb.removed) {
                delete World.buildingMap[key];
                fixes++;
            }
        }
        for (var ck in World.chunkBuildings) {
            var list = World.chunkBuildings[ck];
            for (var li = list.length - 1; li >= 0; li--) {
                var cb = World.buildings[list[li]];
                if (!cb || cb.removed) { list.splice(li, 1); fixes++; }
            }
        }

        if (fixes > 0) {
            console.warn('validateLoaded: ' + fixes + ' referencias corregidas');
            UI.showToast('Partida reparada: ' + fixes + ' referencias corregidas', 'warning');
        }
        return fixes;
    },

    simulateOffline: function(ticks, capped) {
        // Snapshot para el resumen "mientras no estabas"
        var before = {};
        var produced = Game.stats.itemsProduced;
        for (var k in produced) before[k] = produced[k];

        for (var t = 0; t < ticks; t++) {
            Buildings.update();
            Belts.update();
            Game.tick++;
        }

        // Diferencia: qué se fabricó durante la ausencia
        var gains = [];
        for (var item in produced) {
            var delta = produced[item] - (before[item] || 0);
            if (delta > 0) gains.push({item: item, n: delta});
        }
        gains.sort(function(a, b) { return b.n - a.n; });

        Game._offlineReport = {
            seconds: Math.floor(ticks / 20),
            capped: !!capped,
            gains: gains
        };

        // La presentación rica (modal "mientras no estabas") la hace UI.maybeShowOfflineModal
        // en UI.init si hay gains; aquí solo un toast de respaldo para ausencias sin producción.
        var mins = Math.floor(ticks / 20 / 60);
        var timeStr = mins >= 1 ? (mins + ' min') : (Math.floor(ticks / 20) + 's');
        if (gains.length === 0) {
            UI.showToast('🏭 ¡Bienvenido de vuelta! (' + timeStr + ')', 'achievement');
        }
    },

    update: function(dt) {
        this.autoSaveTimer += dt * 1000;
        if (this.autoSaveTimer >= CFG.AUTOSAVE_INTERVAL) {
            this.autoSaveTimer = 0;
            // Punto seguro para compactar: 1 vez/min máx., con histéresis
            if (World.deadCount >= 500 && World.deadCount * 2 > World.buildings.length) {
                World.compactBuildings();
            }
            if (Belts.deadCount >= 500) {
                Belts.compactLines();
            }
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
