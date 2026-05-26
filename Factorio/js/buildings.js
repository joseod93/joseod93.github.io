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
        }

        World.placeBuilding(b);
        Game.stats.buildingsPlaced++;
        Particles.spawn(tx * CFG.TILE + (w * CFG.TILE) / 2, ty * CFG.TILE + (h * CFG.TILE) / 2, 'place');
        Audio.play('place');
        Tutorial.onEvent('place', type);
        UI.updateResources();
        return true;
    },

    remove: function(id) {
        var b = World.buildings[id];
        if (!b || b.removed) return;

        if (b.type === 'belt' || b.type === 'fast_belt') {
            Belts.removeBelt(b.x, b.y);
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

    tryAcceptItem: function(b, itemType) {
        if (b.removed) return false;
        var def = CFG.BUILDING_DEFS[b.type];

        if (b.type === 'furnace') {
            if (itemType === 'coal') {
                if ((b.fuel.coal || 0) < 10) {
                    Inventory.add(b.fuel, 'coal', 1);
                    return true;
                }
                return false;
            }
            var recipe = CFG.SMELTING_RECIPES[itemType];
            if (!recipe) return false;
            if (Inventory.total(b.input) >= CFG.INPUT_BUFFER_MAX) return false;
            Inventory.add(b.input, itemType, 1);
            return true;
        }

        if (b.type === 'assembler') {
            if (!b.recipeId) return false;
            var aRecipe = this.getAssemblyRecipe(b.recipeId);
            if (!aRecipe) return false;
            var needed = false;
            for (var i = 0; i < aRecipe.inputs.length; i++) {
                if (aRecipe.inputs[i].item === itemType) {
                    if (Inventory.count(b.input, itemType) < aRecipe.inputs[i].qty * 3) {
                        needed = true;
                        break;
                    }
                }
            }
            if (!needed) return false;
            Inventory.add(b.input, itemType, 1);
            return true;
        }

        if (b.type === 'lab') {
            if (itemType === 'red_science' || itemType === 'green_science' || itemType === 'blue_science') {
                if (Inventory.count(b.input, itemType) < 5) {
                    Inventory.add(b.input, itemType, 1);
                    return true;
                }
            }
            return false;
        }

        if (b.type === 'steam_engine') {
            if (itemType === 'coal' && (b.fuel.coal || 0) < 10) {
                Inventory.add(b.fuel, 'coal', 1);
                return true;
            }
            return false;
        }

        if (b.type === 'storage') {
            if (Inventory.total(b.stored) < b.capacity) {
                Inventory.add(b.stored, itemType, 1);
                return true;
            }
            return false;
        }

        if (b.type === 'rocket_silo') {
            if (itemType === 'rocket_part' && b.rocketParts < 100) {
                b.rocketParts++;
                if (b.rocketParts >= 100) b.rocketReady = true;
                return true;
            }
            return false;
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
            }

            this.tryPushOutput(b, def);
        }
    },

    updateMiner: function(b, def, mult) {
        var w = def.size[0], h = def.size[1];
        if (!World.hasResource(b.x, b.y, w, h)) { b.active = false; return; }
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
        Particles.spawn((b.x + 1) * CFG.TILE, b.y * CFG.TILE, 'smoke');
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

        var item = null;

        if (fromBuilding && fromBuilding.type !== 'belt' && fromBuilding.type !== 'fast_belt' && !fromBuilding.removed) {
            var src = fromBuilding.type === 'storage' ? fromBuilding.stored : fromBuilding.output;
            item = Inventory.firstItem(src);
            if (item) {
                Inventory.remove(src, item, 1);
            }
        }

        if (!item && fromLine && fromLine.items.length > 0) {
            var headTile = fromLine.tiles[fromLine.tiles.length - 1];
            if (headTile.x === fromX && headTile.y === fromY && fromLine.headGap <= 0.1) {
                item = fromLine.items[fromLine.items.length - 1].type;
                fromLine.items.pop();
                if (fromLine.items.length > 0) {
                    fromLine.headGap = 0;
                } else {
                    fromLine.headGap = fromLine.tiles.length;
                }
                Belts.recalcHeadGap(fromLine);
                Belts.recalcLastPositive(fromLine);
            }
        }

        if (!item) return;

        if (toBuilding && toBuilding.type !== 'belt' && toBuilding.type !== 'fast_belt' && !toBuilding.removed) {
            if (this.tryAcceptItem(toBuilding, item)) {
                b.active = true;
                return;
            }
        }

        if (toLine) {
            var tailTile = toLine.tiles[0];
            if (tailTile.x === toX && tailTile.y === toY) {
                if (Belts.insertItem(toLine, item)) {
                    b.active = true;
                    return;
                }
            }
        }

        if (fromBuilding && fromBuilding.type !== 'belt' && fromBuilding.type !== 'fast_belt') {
            var src2 = fromBuilding.type === 'storage' ? fromBuilding.stored : fromBuilding.output;
            Inventory.add(src2, item, 1);
        }
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

        var outputs = [];
        var straight = Belts.getLineAt(b.x + d.dx, b.y + d.dy);
        var left = Belts.getLineAt(b.x + leftD.dx, b.y + leftD.dy);
        var right = Belts.getLineAt(b.x + rightD.dx, b.y + rightD.dy);

        if (straight) outputs.push(straight);
        if (left) outputs.push(left);
        if (right) outputs.push(right);

        if (outputs.length === 0) { b.active = false; return; }

        var itemType = fromLine.items[fromLine.items.length - 1].type;
        var startIdx = b.splitToggle % outputs.length;

        for (var attempt = 0; attempt < outputs.length; attempt++) {
            var idx = (startIdx + attempt) % outputs.length;
            if (Belts.insertItem(outputs[idx], itemType)) {
                fromLine.items.pop();
                if (fromLine.items.length > 0) {
                    fromLine.headGap = 0;
                } else {
                    fromLine.headGap = fromLine.tiles.length;
                }
                Belts.recalcHeadGap(fromLine);
                Belts.recalcLastPositive(fromLine);
                b.splitToggle = idx + 1;
                b.active = true;
                return;
            }
        }
        b.active = false;
    },

    tryPushOutput: function(b, def) {
        if (b.type === 'belt' || b.type === 'fast_belt' || b.type === 'inserter' || b.type === 'steam_engine' || b.type === 'solar_panel' || b.type === 'splitter') return;
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
                    var tailTile = line.tiles[0];
                    if (tailTile.x === checkX && tailTile.y === checkY) {
                        var item = Inventory.firstItem(b.output);
                        if (item && Belts.insertItem(line, item)) {
                            Inventory.remove(b.output, item, 1);
                            return;
                        }
                    }

                    var info = Belts.tileToLine[checkX + ',' + checkY];
                    if (info) {
                        var item2 = Inventory.firstItem(b.output);
                        if (item2 && Belts.insertItem(line, item2)) {
                            Inventory.remove(b.output, item2, 1);
                            return;
                        }
                    }
                }
            }
        }
    }
};
