var Buildings = {
    init: function() {},

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

    // Busca hacia atrás una entrada de túnel sin pareja con la misma dirección
    linkUnderground: function(b) {
        var d = CFG.DIRECTIONS[b.direction];
        for (var i = 1; i <= CFG.UNDERGROUND_MAX_DIST + 1; i++) {
            var cand = World.getBuildingAt(b.x - d.dx * i, b.y - d.dy * i);
            if (cand && !cand.removed && cand.type === 'underground_belt' &&
                cand.direction === b.direction && cand.ugMode === 'in' &&
                cand.pairId === null && cand.id !== b.id) {
                b.ugMode = 'out';
                b.pairId = cand.id;
                cand.pairId = b.id;
                UI.showToast('Túnel conectado (' + i + ' casillas)');
                return;
            }
        }
        UI.showToast('Entrada de túnel: coloca la salida delante, a máx. ' + (CFG.UNDERGROUND_MAX_DIST + 1) + ' casillas');
    },

    remove: function(id) {
        var b = World.buildings[id];
        if (!b || b.removed) return;

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

        World.removeBuilding(id);
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
        var speedMult = 1 + (Game.prestige ? (Game.prestige.upgrades.craft_speed || 0) * 0.1 : 0);
        var miningMult = 1 + (Game.prestige ? (Game.prestige.upgrades.mining_speed || 0) * 0.1 : 0);

        if (Tech.isCompleted('mass_production')) speedMult *= 1.5;
        var fastInserters = Tech.isCompleted('fast_inserters');

        for (var i = 0; i < World.buildings.length; i++) {
            var b = World.buildings[i];
            if (!b || b.removed || b.type === 'belt' || b.type === 'fast_belt') continue;

            var def = CFG.BUILDING_DEFS[b.type];
            if (!def) continue;

            if (b.type === 'miner' || b.type === 'electric_miner') {
                this.updateMiner(b, def, miningMult);
            } else if (b.type === 'furnace') {
                this.updateFurnace(b, def, speedMult);
            } else if (b.type === 'assembler') {
                this.updateAssembler(b, def, speedMult);
            } else if (b.type === 'steam_engine') {
                this.updateGenerator(b, def);
            } else if (b.type === 'lab') {
                this.updateLab(b, def, speedMult);
            } else if (b.type === 'inserter') {
                this.updateInserter(b, def, fastInserters);
            } else if (b.type === 'splitter') {
                this.updateSplitter(b, def);
            } else if (b.type === 'underground_belt') {
                this.updateUnderground(b, def);
            }

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
        b.progress += def.miningSpeed * mult * pMult;
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
        b.progress += (def.craftSpeed * mult * pMult) / recipe.time;

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
        b.progress += (def.researchSpeed * mult * pMult) / 200;

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
