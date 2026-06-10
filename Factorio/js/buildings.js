var Buildings = {
    init: function() {},

    undoStack: [],
    UNDO_MAX: 20,
    _undoBatch: null,

    tryPlace: function(tx, ty, type, dir) {
        var def = CFG.BUILDING_DEFS[type];
        if (!def) return false;
        if (def.unlocked === false && !Tech.isUnlocked(type)) {
            UI.showToast('Requiere investigar: ' + (CFG.TECH_TREE[def.tech] ? CFG.TECH_TREE[def.tech].name : def.tech));
            Audio.play('error');
            return false;
        }

        var w = def.size[0], h = def.size[1];
        if (!World.canPlace(tx, ty, w, h)) {
            UI.showToast('No se puede colocar aquí');
            return false;
        }

        if ((type === 'miner' || type === 'electric_miner') && !World.hasResource(tx, ty, w, h)) {
            UI.showToast('Necesita veta de recurso debajo');
            return false;
        }

        if (!Game.creativeModeOn) {
            if (def.cost && def.cost.length > 0) {
                if (!Inventory.hasAll(Game.player.inventory, def.cost)) {
                    var missing = [];
                    for (var i = 0; i < def.cost.length; i++) {
                        var have = Inventory.count(Game.player.inventory, def.cost[i].item);
                        if (have < def.cost[i].qty) {
                            missing.push((ITEM_NAMES[def.cost[i].item] || def.cost[i].item) + ' (' + have + '/' + def.cost[i].qty + ')');
                        }
                    }
                    UI.showToast('Faltan: ' + missing.join(', '));
                    Audio.play('error');
                    return false;
                }
                Inventory.removeAll(Game.player.inventory, def.cost);
            }
        }

        var b = this.createBuildingObject(type, tx, ty, dir);

        World.placeBuilding(b);
        if (type === 'underground_belt') {
            this.linkUnderground(b);
        }
        Game.stats.buildingsPlaced++;
        Particles.spawn(tx * CFG.TILE + (w * CFG.TILE) / 2, ty * CFG.TILE + (h * CFG.TILE) / 2, 'place');
        Audio.play('place');
        Tutorial.onEvent('place', type);
        UI.updateResources();
        return true;
    },

    // Crea el objeto edificio con sus campos por tipo (la usan tryPlace y el undo)
    createBuildingObject: function(type, tx, ty, dir) {
        var def = CFG.BUILDING_DEFS[type];
        var b = {
            type: type, x: tx, y: ty, direction: dir || 0,
            input: {}, output: {}, fuel: {},
            progress: 0, active: false, removed: false,
            recipe: null, recipeId: null,
            placedAt: performance.now()
        };

        if (type === 'storage') {
            b.stored = {};
            b.capacity = def.capacity || 200;
        }

        if (type === 'rocket_silo') {
            b.rocketParts = 0;
            b.rocketReady = false;
        }

        if (type === 'splitter') {
            b.splitToggle = 0;
            b.outputPriority = 'balanced';
        }

        if (type === 'inserter') {
            b.filterItem = null;
        }

        if (type === 'accumulator') {
            b.charge = 0;
        }

        if (type === 'underground_belt') {
            b.ugMode = 'in';
            b.pairId = null;
            b.transit = [];
            b.cooldown = 0;
        }

        // Antes de placeBuilding: el hook de power lee b.modEnergy
        if (def.moduleSlots) {
            b.modules = [];
            b.modSpeed = 1;
            b.modEnergy = 1;
        }

        return b;
    },

    // ===== Módulos =====

    // Recalcula los multiplicadores cacheados del edificio (no por tick)
    recalcModuleStats: function(b) {
        var speed = 1, energy = 1;
        if (b.modules) {
            for (var i = 0; i < b.modules.length; i++) {
                var m = CFG.MODULES[b.modules[i]];
                if (!m) continue;
                speed += m.speed;
                energy += m.energy;
            }
        }
        if (energy < CFG.MODULE_MIN_ENERGY) energy = CFG.MODULE_MIN_ENERGY;
        b.modSpeed = speed;
        b.modEnergy = energy;
    },

    insertModule: function(buildingId, itemType) {
        var b = World.buildings[buildingId];
        if (!b || b.removed) return;
        var def = CFG.BUILDING_DEFS[b.type];
        if (!def || !def.moduleSlots || !CFG.MODULES[itemType]) return;
        if (!b.modules) b.modules = [];
        if (b.modules.length >= def.moduleSlots) {
            UI.showToast('No hay slots libres');
            return;
        }
        if (!Inventory.has(Game.player.inventory, itemType, 1)) return;

        Inventory.remove(Game.player.inventory, itemType, 1);
        // Delta incremental de power: restar con el mult viejo, sumar con el nuevo
        Game.powerCache.consumptionBase -= (def.powerDraw || 0) * (b.modEnergy || 1);
        b.modules.push(itemType);
        this.recalcModuleStats(b);
        Game.powerCache.consumptionBase += (def.powerDraw || 0) * b.modEnergy;

        Audio.play('place');
        UI.updateResources();
        if (Input.selectedBuilding && Input.selectedBuilding.id === buildingId) {
            UI.showBuildingInfo(b);
        }
    },

    removeModule: function(buildingId, slotIdx) {
        var b = World.buildings[buildingId];
        if (!b || b.removed || !b.modules) return;
        if (slotIdx < 0 || slotIdx >= b.modules.length) return;
        var def = CFG.BUILDING_DEFS[b.type];

        var itemType = b.modules[slotIdx];
        Game.powerCache.consumptionBase -= (def.powerDraw || 0) * (b.modEnergy || 1);
        b.modules.splice(slotIdx, 1);
        this.recalcModuleStats(b);
        Game.powerCache.consumptionBase += (def.powerDraw || 0) * b.modEnergy;
        Inventory.add(Game.player.inventory, itemType, 1);

        Audio.play('place');
        UI.updateResources();
        if (Input.selectedBuilding && Input.selectedBuilding.id === buildingId) {
            UI.showBuildingInfo(b);
        }
    },

    // Busca hacia atrás una entrada de túnel sin pareja con la misma dirección.
    // Devuelve {b, dist} o null. La usa también la preview del ghost (dry-run).
    findUndergroundPair: function(tx, ty, direction) {
        var d = CFG.DIRECTIONS[direction];
        for (var i = 1; i <= CFG.UNDERGROUND_MAX_DIST + 1; i++) {
            var cand = World.getBuildingAt(tx - d.dx * i, ty - d.dy * i);
            if (cand && !cand.removed && cand.type === 'underground_belt' &&
                cand.direction === direction && cand.ugMode === 'in' &&
                cand.pairId === null) {
                return {b: cand, dist: i};
            }
        }
        return null;
    },

    linkUnderground: function(b, quiet) {
        var found = this.findUndergroundPair(b.x, b.y, b.direction);
        if (found && found.b.id !== b.id) {
            b.ugMode = 'out';
            b.pairId = found.b.id;
            found.b.pairId = b.id;
            if (!quiet) UI.showToast('Túnel conectado (' + found.dist + ' casillas)');
            return;
        }
        if (!quiet) UI.showToast('Entrada de túnel: coloca la salida delante, a máx. ' + (CFG.UNDERGROUND_MAX_DIST + 1) + ' casillas');
    },

    remove: function(id) {
        var b = World.buildings[id];
        if (!b || b.removed) return;

        // Único choke point de demolición: clic derecho, panel info, menú
        // contextual y removeArea pasan todos por aquí
        this.pushUndo(this.makeSnapshot(b));

        if (b.type === 'belt' || b.type === 'fast_belt') {
            Belts.removeBelt(b.x, b.y);
        }

        if (b.type === 'underground_belt') {
            if (b.transit) {
                for (var ti = 0; ti < b.transit.length; ti++) {
                    Inventory.add(Game.player.inventory, b.transit[ti].type, 1);
                }
            }
            if (b.pairId !== null && b.pairId !== undefined) {
                var pairB = World.buildings[b.pairId];
                if (pairB && !pairB.removed) pairB.pairId = null;
            }
        }

        if (!Game.creativeModeOn) {
            var def = CFG.BUILDING_DEFS[b.type];
            if (def && def.cost) {
                for (var i = 0; i < def.cost.length; i++) {
                    Inventory.add(Game.player.inventory, def.cost[i].item, def.cost[i].qty);
                }
            }
        }

        for (var item in b.output) {
            Inventory.add(Game.player.inventory, item, b.output[item]);
        }
        for (var item2 in b.input) {
            Inventory.add(Game.player.inventory, item2, b.input[item2]);
        }
        for (var item3 in b.fuel) {
            if (b.fuel[item3] > 0) Inventory.add(Game.player.inventory, item3, b.fuel[item3]);
        }
        if (b.stored) {
            for (var item4 in b.stored) {
                if (b.stored[item4] > 0) Inventory.add(Game.player.inventory, item4, b.stored[item4]);
            }
        }
        if (b.rocketParts > 0) {
            Inventory.add(Game.player.inventory, 'rocket_part', b.rocketParts);
        }
        // Devolver módulos SIN mutar b.modules/b.modEnergy: el hook
        // onBuildingRemoved debe restar exactamente lo registrado en el cache
        if (b.modules) {
            for (var mi = 0; mi < b.modules.length; mi++) {
                Inventory.add(Game.player.inventory, b.modules[mi], 1);
            }
        }

        World.removeBuilding(id);
        UI.updateResources();
    },

    // ===== Copy/paste de configuración (C/V, menú contextual, panel info) =====

    // Config copiable por tipo; null = este edificio no tiene ajustes
    getConfigSnapshot: function(b) {
        if (b.type === 'inserter') return {filterItem: b.filterItem || null};
        if (b.type === 'assembler') return b.recipeId ? {recipeId: b.recipeId} : null;
        if (b.type === 'splitter') return {outputPriority: b.outputPriority || 'balanced'};
        return null;
    },

    applyConfigSnapshot: function(b, props) {
        if (!props) return;
        if (b.type === 'inserter' && props.filterItem !== undefined) {
            b.filterItem = props.filterItem;
        }
        if (b.type === 'assembler' && props.recipeId !== undefined) {
            if (b.recipeId !== props.recipeId) {
                // Misma semántica que UI.setRecipe: cambiar receta vacía el input
                b.recipeId = props.recipeId;
                b.progress = 0;
                b.input = {};
            }
        }
        if (b.type === 'splitter' && props.outputPriority !== undefined) {
            b.outputPriority = props.outputPriority;
        }
    },

    // ===== Deconstrucción en área =====

    // Ids únicos de edificios cuyo footprint toca el rectángulo (en tiles)
    getIdsInRect: function(minX, minY, maxX, maxY) {
        // El drag está limitado a pantalla; el clamp es solo defensa
        if (maxX - minX > 200) maxX = minX + 200;
        if (maxY - minY > 200) maxY = minY + 200;
        var seen = {};
        var ids = [];
        for (var ty = minY; ty <= maxY; ty++) {
            for (var tx = minX; tx <= maxX; tx++) {
                var id = World.buildingMap[World.tileKey(tx, ty)];
                if (id === undefined || id === null || seen[id]) continue;
                var b = World.buildings[id];
                if (!b || b.removed) continue;
                seen[id] = true;
                ids.push(id);
            }
        }
        return ids;
    },

    removeArea: function(x0, y0, x1, y1) {
        var minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
        var minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
        var ids = this.getIdsInRect(minX, minY, maxX, maxY);
        if (ids.length === 0) {
            UI.showToast('Nada que demoler');
            return 0;
        }
        this.beginUndoBatch();
        for (var i = 0; i < ids.length; i++) {
            this.remove(ids[i]);
        }
        this.commitUndoBatch();
        Audio.play('remove');
        Camera.shake(2, 0.25);
        UI.showToast('Demolidos: ' + ids.length + ' edificios');
        return ids.length;
    },

    // ===== Undo de demolición =====
    // Semántica: restaurar re-cobra el coste (el refund de la demolición quedó
    // en el inventario: neto cero). El contenido NO se restaura (también fue al
    // inventario). Stack de 20 lotes, solo sesión (no se persiste).

    // Data plana sin ids: los ids no sobreviven compactación ni load
    makeSnapshot: function(b) {
        var snap = {
            type: b.type, x: b.x, y: b.y,
            direction: b.direction || 0,
            props: this.getConfigSnapshot(b)
        };
        if (b.type === 'underground_belt') snap.ugMode = b.ugMode;
        return snap;
    },

    pushUndo: function(snap) {
        if (this._undoBatch) {
            this._undoBatch.push(snap);
            return;
        }
        this.undoStack.push([snap]);
        if (this.undoStack.length > this.UNDO_MAX) this.undoStack.shift();
    },

    beginUndoBatch: function() {
        this._undoBatch = [];
    },

    commitUndoBatch: function() {
        if (this._undoBatch && this._undoBatch.length > 0) {
            this.undoStack.push(this._undoBatch);
            if (this.undoStack.length > this.UNDO_MAX) this.undoStack.shift();
        }
        this._undoBatch = null;
    },

    clearUndo: function() {
        this.undoStack = [];
        this._undoBatch = null;
    },

    restoreFromSnapshot: function(snap) {
        var def = CFG.BUILDING_DEFS[snap.type];
        if (!def) return false;

        if (snap.type === 'belt' || snap.type === 'fast_belt') {
            return Belts.tryPlaceSingle(snap.x, snap.y, snap.direction, snap.type);
        }

        var w = def.size[0], h = def.size[1];
        if (!World.canPlace(snap.x, snap.y, w, h)) return false;
        if ((snap.type === 'miner' || snap.type === 'electric_miner') &&
            !World.hasResource(snap.x, snap.y, w, h)) return false;

        if (!Game.creativeModeOn && def.cost && def.cost.length > 0) {
            if (!Inventory.hasAll(Game.player.inventory, def.cost)) return false;
            Inventory.removeAll(Game.player.inventory, def.cost);
        }

        var b = this.createBuildingObject(snap.type, snap.x, snap.y, snap.direction);
        if (snap.props) this.applyConfigSnapshot(b, snap.props);
        World.placeBuilding(b);

        if (snap.type === 'underground_belt') {
            if (snap.ugMode === 'out') {
                this.linkUnderground(b, true);
            } else {
                // linkUnderground solo escanea hacia atrás; una boca 'in'
                // restaurada busca su salida superviviente hacia DELANTE
                var d = CFG.DIRECTIONS[b.direction];
                for (var i = 1; i <= CFG.UNDERGROUND_MAX_DIST + 1; i++) {
                    var cand = World.getBuildingAt(b.x + d.dx * i, b.y + d.dy * i);
                    if (cand && !cand.removed && cand.type === 'underground_belt' &&
                        cand.direction === b.direction && cand.ugMode === 'out' &&
                        (cand.pairId === null || cand.pairId === undefined)) {
                        b.pairId = cand.id;
                        cand.pairId = b.id;
                        break;
                    }
                }
            }
        }
        // Sin stats.buildingsPlaced ni Tutorial.onEvent: es restauración, no
        // construcción (evita inflar milestones con ciclos demoler+deshacer)
        return true;
    },

    undo: function() {
        if (this.undoStack.length === 0) {
            UI.showToast('Nada que deshacer');
            return;
        }
        var batch = this.undoStack.pop();
        var restored = 0, failed = 0;

        // Dos pasadas: las salidas de túnel al final, para que sus entradas
        // ya existan al re-emparejar
        for (var pass = 0; pass < 2; pass++) {
            for (var i = 0; i < batch.length; i++) {
                var snap = batch[i];
                var isOut = snap.type === 'underground_belt' && snap.ugMode === 'out';
                if ((pass === 0 && isOut) || (pass === 1 && !isOut)) continue;
                if (this.restoreFromSnapshot(snap)) restored++;
                else failed++;
            }
        }

        if (restored > 0) {
            Audio.play('place');
            var msg = 'Deshecho: ' + restored + ' edificio' + (restored === 1 ? '' : 's') + ' restaurado' + (restored === 1 ? '' : 's');
            if (failed > 0) msg += ', ' + failed + ' no (casilla ocupada o faltan recursos)';
            UI.showToast(msg, failed > 0 ? 'warning' : undefined);
        } else {
            UI.showToast('No se pudo deshacer: casilla ocupada o faltan recursos', 'warning');
        }
        UI.updateResources();
    },

    playerTransfer: function(buildingId, itemType, qty) {
        var b = World.buildings[buildingId];
        if (!b || b.removed) return;
        if (!qty) qty = 1;
        var transferred = 0;
        for (var i = 0; i < qty; i++) {
            if (!Inventory.has(Game.player.inventory, itemType, 1)) break;
            if (this.tryAcceptItem(b, itemType)) {
                Inventory.remove(Game.player.inventory, itemType, 1);
                transferred++;
            } else {
                break;
            }
        }
        if (transferred > 0) {
            Audio.play('place');
            UI.updateResources();
            if (Input.selectedBuilding && Input.selectedBuilding.id === buildingId) {
                UI.showBuildingInfo(b);
            }
        }
    },

    playerExtract: function(buildingId, source, itemType, qty) {
        var b = World.buildings[buildingId];
        if (!b || b.removed) return;
        if (!qty) qty = 1;

        var container;
        if (source === 'output') container = b.output;
        else if (source === 'input') container = b.input;
        else if (source === 'fuel') container = b.fuel;
        else if (source === 'stored') container = b.stored;
        else return;

        if (!container) return;
        var available = container[itemType] || 0;
        var toExtract = Math.min(qty, available);
        if (toExtract <= 0) return;

        Inventory.remove(container, itemType, toExtract);
        Inventory.add(Game.player.inventory, itemType, toExtract);
        Audio.play('place');
        UI.updateResources();
        if (Input.selectedBuilding && Input.selectedBuilding.id === buildingId) {
            UI.showBuildingInfo(b);
        }
    },

    canAcceptItem: function(b, itemType) {
        if (b.removed) return false;

        if (b.type === 'furnace') {
            if (itemType === 'coal') return (b.fuel.coal || 0) < 10;
            if (!CFG.SMELTING_RECIPES[itemType]) return false;
            return Inventory.total(b.input) < CFG.INPUT_BUFFER_MAX;
        }

        if (b.type === 'assembler') {
            if (!b.recipeId) return false;
            var aRecipe = this.getAssemblyRecipe(b.recipeId);
            if (!aRecipe) return false;
            for (var i = 0; i < aRecipe.inputs.length; i++) {
                if (aRecipe.inputs[i].item === itemType &&
                    Inventory.count(b.input, itemType) < aRecipe.inputs[i].qty * 3) {
                    return true;
                }
            }
            return false;
        }

        if (b.type === 'lab') {
            return (itemType === 'red_science' || itemType === 'green_science' || itemType === 'blue_science') &&
                Inventory.count(b.input, itemType) < 5;
        }

        if (b.type === 'steam_engine') {
            return itemType === 'coal' && (b.fuel.coal || 0) < 10;
        }

        if (b.type === 'storage') {
            return Inventory.total(b.stored) < b.capacity;
        }

        if (b.type === 'rocket_silo') {
            return itemType === 'rocket_part' && b.rocketParts < 100;
        }

        if (b.type === 'underground_belt') {
            if (b.ugMode !== 'in' || b.pairId === null || b.cooldown > 0) return false;
            var pair = World.buildings[b.pairId];
            if (!pair || pair.removed) return false;
            var dist = Math.abs(pair.x - b.x) + Math.abs(pair.y - b.y);
            var capacity = Math.max(1, Math.floor(dist / CFG.ITEM_SPACING));
            return b.transit.length < capacity;
        }

        return false;
    },

    tryAcceptItem: function(b, itemType) {
        if (!this.canAcceptItem(b, itemType)) return false;

        if (b.type === 'furnace') {
            if (itemType === 'coal') Inventory.add(b.fuel, 'coal', 1);
            else Inventory.add(b.input, itemType, 1);
            return true;
        }

        if (b.type === 'assembler' || b.type === 'lab') {
            Inventory.add(b.input, itemType, 1);
            return true;
        }

        if (b.type === 'steam_engine') {
            Inventory.add(b.fuel, 'coal', 1);
            return true;
        }

        if (b.type === 'storage') {
            Inventory.add(b.stored, itemType, 1);
            return true;
        }

        if (b.type === 'rocket_silo') {
            b.rocketParts++;
            if (b.rocketParts >= 100) b.rocketReady = true;
            return true;
        }

        if (b.type === 'underground_belt') {
            var pair = World.buildings[b.pairId];
            var dist = Math.abs(pair.x - b.x) + Math.abs(pair.y - b.y);
            var def = CFG.BUILDING_DEFS.underground_belt;
            b.transit.push({type: itemType, left: Math.ceil(dist / def.transitSpeed)});
            b.cooldown = Math.ceil(CFG.ITEM_SPACING / def.transitSpeed);
            return true;
        }

        return false;
    },

    getAssemblyRecipe: function(id) {
        for (var i = 0; i < CFG.ASSEMBLY_RECIPES.length; i++) {
            if (CFG.ASSEMBLY_RECIPES[i].id === id) return CFG.ASSEMBLY_RECIPES[i];
        }
        return null;
    },

    update: function() {
        var ctx = this._ctx || (this._ctx = {});
        ctx.speedMult = 1 + (Game.prestige ? (Game.prestige.upgrades.craft_speed || 0) * 0.1 : 0);
        ctx.miningMult = 1 + (Game.prestige ? (Game.prestige.upgrades.mining_speed || 0) * 0.1 : 0);

        if (Tech.isCompleted('mass_production')) ctx.speedMult *= 1.5;
        ctx.fastInserters = Tech.isCompleted('fast_inserters');

        for (var i = 0; i < World.buildings.length; i++) {
            var b = World.buildings[i];
            if (!b || b.removed || b.type === 'belt' || b.type === 'fast_belt') continue;

            var def = CFG.BUILDING_DEFS[b.type];
            if (!def) continue;

            var fn = this.UPDATERS[b.type];
            if (fn) fn(b, def, ctx);

            this.tryPushOutput(b, def);
        }
    },

    updateMiner: function(b, def, mult) {
        var w = def.size[0], h = def.size[1];
        if (!World.hasResource(b.x, b.y, w, h)) {
            if (!b.depleted) {
                b.depleted = true;
                UI.showToast('¡Veta agotada bajo ' + def.name + '!', 'warning');
                Audio.play('error');
            }
            b.active = false;
            return;
        }
        b.depleted = false;
        if (Inventory.total(b.output) >= CFG.OUTPUT_BUFFER_MAX) { b.active = false; return; }

        if (def.powerDraw > 0 && Game.power.satisfaction < 0.1) { b.active = false; return; }

        b.active = true;
        var pMult = def.powerDraw > 0 ? Game.power.satisfaction : 1;
        b.progress += def.miningSpeed * mult * pMult * (b.modSpeed || 1);
        if (b.progress >= 1) {
            b.progress = 0;
            var resType = World.mineResource(b.x, b.y, w, h);
            if (resType) {
                Inventory.add(b.output, resType, 1);
                Game.stats.itemsProduced[resType] = (Game.stats.itemsProduced[resType] || 0) + 1;
                Particles.spawn(
                    (b.x + w/2) * CFG.TILE, (b.y + h/2) * CFG.TILE,
                    'produce', resType
                );
            }
        }
    },

    updateFurnace: function(b, def, mult) {
        var inputItem = Inventory.firstItem(b.input);
        if (!inputItem) { b.active = false; return; }

        var recipe = CFG.SMELTING_RECIPES[inputItem];
        if (!recipe) { b.active = false; return; }
        if (Inventory.total(b.output) >= CFG.OUTPUT_BUFFER_MAX) { b.active = false; return; }

        if (def.fuelBurner && Inventory.isEmpty(b.fuel)) { b.active = false; return; }

        b.active = true;
        b.currentRecipe = recipe;
        b.progress += (def.craftSpeed * mult) / recipe.time;

        if (b.progress >= 1) {
            b.progress = 0;
            var inputQty = recipe.inputQty || 1;
            Inventory.remove(b.input, inputItem, inputQty);
            Inventory.add(b.output, recipe.output, recipe.qty);
            Game.stats.itemsProduced[recipe.output] = (Game.stats.itemsProduced[recipe.output] || 0) + recipe.qty;

            if (def.fuelBurner && Math.random() < 0.1) {
                Inventory.remove(b.fuel, 'coal', 1);
            }

            var w = def.size[0], h = def.size[1];
            Particles.spawn((b.x + w/2) * CFG.TILE, (b.y + h/2) * CFG.TILE, 'produce', recipe.output);
            Particles.spawn((b.x + w/2) * CFG.TILE, (b.y) * CFG.TILE, 'smoke');
        }
    },

    updateAssembler: function(b, def, mult) {
        if (!b.recipeId) { b.active = false; return; }
        var recipe = this.getAssemblyRecipe(b.recipeId);
        if (!recipe) { b.active = false; return; }
        if (Inventory.total(b.output) >= CFG.OUTPUT_BUFFER_MAX) { b.active = false; return; }
        if (!Inventory.hasAll(b.input, recipe.inputs)) { b.active = false; return; }

        if (def.powerDraw > 0 && Game.power.satisfaction < 0.1) { b.active = false; return; }

        b.active = true;
        var pMult = def.powerDraw > 0 ? Game.power.satisfaction : 1;
        b.progress += (def.craftSpeed * mult * pMult * (b.modSpeed || 1)) / recipe.time;

        if (b.progress >= 1) {
            b.progress = 0;
            Inventory.removeAll(b.input, recipe.inputs);
            Inventory.add(b.output, recipe.output, recipe.qty);
            Game.stats.itemsProduced[recipe.output] = (Game.stats.itemsProduced[recipe.output] || 0) + recipe.qty;

            var w = def.size[0], h = def.size[1];
            Particles.spawn((b.x + w/2) * CFG.TILE, (b.y + h/2) * CFG.TILE, 'produce', recipe.output);
        }
    },

    updateGenerator: function(b, def) {
        if (Inventory.isEmpty(b.fuel)) { b.active = false; return; }
        b.active = true;

        if (Math.random() < 0.005) {
            Inventory.remove(b.fuel, 'coal', 1);
        }
        // Throttle: a 20 TPS sin esto serían 40 partículas/s por motor
        if (Math.random() < 0.12) {
            Particles.spawn((b.x + 1) * CFG.TILE, b.y * CFG.TILE, 'smoke');
        }
    },

    updateLab: function(b, def, mult) {
        if (!Game.currentResearch) { b.active = false; return; }
        var tech = CFG.TECH_TREE[Game.currentResearch];
        if (!tech) { b.active = false; return; }

        var hasScience = true;
        for (var sciType in tech.cost) {
            if (!Inventory.has(b.input, sciType, 1)) { hasScience = false; break; }
        }
        if (!hasScience) { b.active = false; return; }

        if (def.powerDraw > 0 && Game.power.satisfaction < 0.1) { b.active = false; return; }

        b.active = true;
        var pMult = def.powerDraw > 0 ? Game.power.satisfaction : 1;
        b.progress += (def.researchSpeed * mult * pMult * (b.modSpeed || 1)) / 200;

        if (b.progress >= 1) {
            b.progress = 0;
            for (var sciType2 in tech.cost) {
                Inventory.remove(b.input, sciType2, 1);
            }
            Tech.addProgress(Game.currentResearch, 1);
        }
    },

    updateInserter: function(b, def, fastInserters) {
        var grabMult = fastInserters ? 2 : 1;
        b.progress += def.grabSpeed * grabMult;
        if (b.progress < 1) return;
        b.progress = 0;

        var d = CFG.DIRECTIONS[b.direction];
        var fromX = b.x - d.dx, fromY = b.y - d.dy;
        var toX = b.x + d.dx, toY = b.y + d.dy;

        var fromBuilding = World.getBuildingAt(fromX, fromY);
        var toBuilding = World.getBuildingAt(toX, toY);
        var fromLine = Belts.getLineAt(fromX, fromY);
        var toLine = Belts.getLineAt(toX, toY);

        // Fase 1: mirar el origen sin tomar nada
        var item = null, sourceKind = null, src = null;

        if (fromBuilding && fromBuilding.type !== 'belt' && fromBuilding.type !== 'fast_belt' && !fromBuilding.removed) {
            src = fromBuilding.type === 'storage' ? fromBuilding.stored : fromBuilding.output;
            if (b.filterItem) {
                if ((src[b.filterItem] || 0) > 0) item = b.filterItem;
            } else {
                item = Inventory.firstItem(src);
            }
            if (item) sourceKind = 'building';
        }

        if (!item && fromLine && fromLine.items.length > 0) {
            var headTile = fromLine.tiles[fromLine.tiles.length - 1];
            if (headTile.x === fromX && headTile.y === fromY && fromLine.headGap <= 0.1) {
                var headType = fromLine.items[fromLine.items.length - 1].type;
                if (!b.filterItem || headType === b.filterItem) {
                    item = headType;
                    sourceKind = 'line';
                }
            }
        }

        if (!item) return;

        // Fase 2: validar destino antes de tomar
        var dest = null;
        if (toBuilding && toBuilding.type !== 'belt' && toBuilding.type !== 'fast_belt' && !toBuilding.removed &&
            this.canAcceptItem(toBuilding, item)) {
            dest = 'building';
        } else if (toLine && toLine.tiles[0].x === toX && toLine.tiles[0].y === toY && Belts.canInsertItem(toLine)) {
            dest = 'line';
        }
        if (!dest) return;

        // Fase 3: commit — insertar en destino primero, luego retirar del origen
        var ok = dest === 'building'
            ? this.tryAcceptItem(toBuilding, item)
            : Belts.insertItem(toLine, item);
        if (!ok) return;

        if (sourceKind === 'building') {
            Inventory.remove(src, item, 1);
        } else {
            var popped = fromLine.items.pop();
            fromLine.headGap = fromLine.items.length > 0
                ? fromLine.headGap + (popped.gap || 0)
                : fromLine.tiles.length;
            Belts.recalcLastPositive(fromLine);
        }
        b.active = true;
    },

    updateUnderground: function(b, def) {
        if (b.cooldown > 0) b.cooldown--;

        if (b.ugMode === 'out') {
            // La salida solo empuja hacia delante
            var item = Inventory.firstItem(b.output);
            if (!item) { b.active = false; return; }
            var d = CFG.DIRECTIONS[b.direction];
            var nx = b.x + d.dx, ny = b.y + d.dy;

            var line = Belts.getLineAt(nx, ny);
            if (line && line.tiles[0].x === nx && line.tiles[0].y === ny) {
                if (Belts.insertItem(line, item)) {
                    Inventory.remove(b.output, item, 1);
                    b.active = true;
                    return;
                }
            }
            var nb = World.getBuildingAt(nx, ny);
            if (nb && !nb.removed && nb.type !== 'belt' && nb.type !== 'fast_belt') {
                if (this.tryAcceptItem(nb, item)) {
                    Inventory.remove(b.output, item, 1);
                    b.active = true;
                    return;
                }
            }
            return;
        }

        // Entrada: avanzar items en tránsito y entregar al pair
        if (b.pairId === null || b.pairId === undefined) { b.active = false; return; }
        var pair = World.buildings[b.pairId];
        if (!pair || pair.removed) { b.pairId = null; b.active = false; return; }

        for (var i = 0; i < b.transit.length; i++) {
            if (b.transit[i].left > 0) b.transit[i].left--;
        }

        if (b.transit.length > 0 && b.transit[0].left <= 0) {
            // Mini-buffer en la salida: backpressure natural si está lleno
            if (Inventory.total(pair.output) < 4) {
                Inventory.add(pair.output, b.transit[0].type, 1);
                b.transit.shift();
            }
        }
        b.active = b.transit.length > 0;
    },

    updateSplitter: function(b, def) {
        var d = CFG.DIRECTIONS[b.direction];
        var fromX = b.x - d.dx, fromY = b.y - d.dy;

        var fromLine = Belts.getLineAt(fromX, fromY);
        if (!fromLine || fromLine.items.length === 0) { b.active = false; return; }

        var headTile = fromLine.tiles[fromLine.tiles.length - 1];
        if (headTile.x !== fromX || headTile.y !== fromY) { b.active = false; return; }
        if (fromLine.headGap > 0.1) { b.active = false; return; }

        if (!b.splitToggle) b.splitToggle = 0;

        var leftDir = (b.direction + 3) % 4;
        var rightDir = (b.direction + 1) % 4;
        var leftD = CFG.DIRECTIONS[leftDir];
        var rightD = CFG.DIRECTIONS[rightDir];

        // Solo aceptar líneas cuya cola sea el tile adyacente (si no, insertItem
        // teletransportaría el item a la cola de una línea lejana)
        var grabOutput = function(ox, oy) {
            var cand = Belts.getLineAt(ox, oy);
            if (cand && cand !== fromLine && cand.tiles[0].x === ox && cand.tiles[0].y === oy) {
                return cand;
            }
            return null;
        };
        var straight = grabOutput(b.x + d.dx, b.y + d.dy);
        var left = grabOutput(b.x + leftD.dx, b.y + leftD.dy);
        var right = grabOutput(b.x + rightD.dx, b.y + rightD.dy);

        // Orden de intento según prioridad configurada
        var ordered;
        var priority = b.outputPriority || 'balanced';
        if (priority === 'left') ordered = [left, straight, right];
        else if (priority === 'right') ordered = [right, straight, left];
        else ordered = [straight, left, right];

        var outputs = [];
        for (var oi = 0; oi < ordered.length; oi++) {
            if (ordered[oi]) outputs.push(ordered[oi]);
        }
        if (outputs.length === 0) { b.active = false; return; }

        var itemType = fromLine.items[fromLine.items.length - 1].type;
        var startIdx = priority === 'balanced' ? (b.splitToggle % outputs.length) : 0;

        for (var attempt = 0; attempt < outputs.length; attempt++) {
            var idx = (startIdx + attempt) % outputs.length;
            if (Belts.insertItem(outputs[idx], itemType)) {
                var popped = fromLine.items.pop();
                fromLine.headGap = fromLine.items.length > 0
                    ? fromLine.headGap + (popped.gap || 0)
                    : fromLine.tiles.length;
                Belts.recalcLastPositive(fromLine);
                if (priority === 'balanced') b.splitToggle = idx + 1;
                b.active = true;
                return;
            }
        }
        b.active = false;
    },

    tryPushOutput: function(b, def) {
        if (b.type === 'belt' || b.type === 'fast_belt' || b.type === 'inserter' || b.type === 'steam_engine' || b.type === 'solar_panel' || b.type === 'splitter' || b.type === 'accumulator' || b.type === 'underground_belt') return;
        if (Inventory.isEmpty(b.output)) return;

        var w = def.size[0], h = def.size[1];
        var dirs = [b.direction, (b.direction+1)%4, (b.direction+3)%4, (b.direction+2)%4];

        for (var di = 0; di < dirs.length; di++) {
            var dir = dirs[di];
            var d = CFG.DIRECTIONS[dir];

            for (var s = 0; s < Math.max(w, h); s++) {
                var checkX, checkY;
                if (d.dx !== 0) {
                    checkX = d.dx > 0 ? b.x + w : b.x - 1;
                    checkY = b.y + Math.min(s, h - 1);
                } else {
                    checkX = b.x + Math.min(s, w - 1);
                    checkY = d.dy > 0 ? b.y + h : b.y - 1;
                }

                var line = Belts.getLineAt(checkX, checkY);
                if (line) {
                    // Solo insertar si el tile adyacente es la cola de la línea
                    // (insertar en mitad de línea teletransportaría el item a su cola)
                    var tailTile = line.tiles[0];
                    if (tailTile.x === checkX && tailTile.y === checkY) {
                        var item = Inventory.firstItem(b.output);
                        if (item && Belts.insertItem(line, item)) {
                            Inventory.remove(b.output, item, 1);
                            return;
                        }
                    }
                }
            }
        }
    }
};

// Dispatch por tipo. Asignada tras el literal (Buildings.init() nunca se invoca).
// Tipos sin handler (storage, solar_panel, accumulator, rocket_silo) solo reciben tryPushOutput.
Buildings.UPDATERS = {
    miner:            function(b, def, ctx) { Buildings.updateMiner(b, def, ctx.miningMult); },
    electric_miner:   function(b, def, ctx) { Buildings.updateMiner(b, def, ctx.miningMult); },
    furnace:          function(b, def, ctx) { Buildings.updateFurnace(b, def, ctx.speedMult); },
    assembler:        function(b, def, ctx) { Buildings.updateAssembler(b, def, ctx.speedMult); },
    steam_engine:     function(b, def, ctx) { Buildings.updateGenerator(b, def); },
    lab:              function(b, def, ctx) { Buildings.updateLab(b, def, ctx.speedMult); },
    inserter:         function(b, def, ctx) { Buildings.updateInserter(b, def, ctx.fastInserters); },
    splitter:         function(b, def, ctx) { Buildings.updateSplitter(b, def); },
    underground_belt: function(b, def, ctx) { Buildings.updateUnderground(b, def); }
};
