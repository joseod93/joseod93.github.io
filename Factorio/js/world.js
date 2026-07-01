var World = {
    seed: 0,
    chunks: {},
    buildings: [],
    buildingMap: {},
    chunkBuildings: {},
    deadCount: 0,
    _seenStamp: 0,

    init: function(seed) {
        this.seed = seed || Math.floor(Math.random() * 999999);
        this.chunks = {};
        this.buildings = [];
        this.buildingMap = {};
        this.chunkBuildings = {};
        this.deadCount = 0;
        if (typeof Game !== 'undefined' && Game.powerCache) {
            Game.powerCache.consumptionBase = 0;
            Game.powerCache.solarOutput = 0;
            Game.powerCache.steamIds = [];
            Game.powerCache.accIds = [];
        }
    },

    mulberry32: function(a) {
        return function() {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    },

    hash2d: function(x, y) {
        var n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + this.seed) | 0;
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        n = n ^ (n >>> 16);
        return (n >>> 0) / 4294967296;
    },

    noise2d: function(x, y, scale) {
        var sx = x / scale, sy = y / scale;
        var ix = Math.floor(sx), iy = Math.floor(sy);
        var fx = sx - ix, fy = sy - iy;
        fx = fx * fx * (3 - 2 * fx);
        fy = fy * fy * (3 - 2 * fy);
        var a = this.hash2d(ix, iy);
        var b = this.hash2d(ix + 1, iy);
        var c = this.hash2d(ix, iy + 1);
        var d = this.hash2d(ix + 1, iy + 1);
        return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    },

    chunkKey: function(cx, cy) {
        return cx + ',' + cy;
    },

    tileKey: function(tx, ty) {
        return tx + ',' + ty;
    },

    getChunk: function(cx, cy) {
        var key = this.chunkKey(cx, cy);
        if (!this.chunks[key]) {
            this.chunks[key] = this.generateChunk(cx, cy);
        }
        return this.chunks[key];
    },

    generateChunk: function(cx, cy) {
        var c = CFG.CHUNK;
        var tiles = [];
        var baseX = cx * c, baseY = cy * c;
        var patchMult = 1 + (Game.prestige ? (Game.prestige.upgrades.larger_patches || 0) * 0.2 : 0);

        for (var ly = 0; ly < c; ly++) {
            tiles[ly] = [];
            for (var lx = 0; lx < c; lx++) {
                var wx = baseX + lx, wy = baseY + ly;
                var elevation = this.noise2d(wx, wy, 30);
                var terrain = 'grass';
                if (elevation < 0.15) terrain = 'water';
                else if (elevation < 0.22) terrain = 'sand';
                else if (elevation > 0.8) terrain = 'earth';

                var resource = null;
                if (terrain !== 'water') {
                    var ironN   = this.noise2d(wx + 1000, wy + 1000, 12 * patchMult);
                    var copperN = this.noise2d(wx + 2000, wy + 2000, 13 * patchMult);
                    var coalN   = this.noise2d(wx + 3000, wy + 3000, 11 * patchMult);
                    var stoneN  = this.noise2d(wx + 4000, wy + 4000, 14 * patchMult);

                    if (ironN > 0.76) resource = {type:'iron_ore', amount: Math.floor(80 + ironN * 250)};
                    else if (copperN > 0.78) resource = {type:'copper_ore', amount: Math.floor(60 + copperN * 220)};
                    else if (coalN > 0.77) resource = {type:'coal', amount: Math.floor(80 + coalN * 280)};
                    else if (stoneN > 0.79) resource = {type:'stone', amount: Math.floor(50 + stoneN * 180)};
                }

                var variantSeed = this.hash2d(wx * 7, wy * 13);
                tiles[ly][lx] = {
                    terrain: terrain,
                    resource: resource,
                    buildingId: null,
                    variant: Math.floor(variantSeed * 4)
                };
            }
        }
        return {cx: cx, cy: cy, tiles: tiles, dirty: true, canvas: null};
    },

    getTile: function(tx, ty) {
        var c = CFG.CHUNK;
        var cx = Math.floor(tx / c), cy = Math.floor(ty / c);
        var chunk = this.getChunk(cx, cy);
        var lx = ((tx % c) + c) % c;
        var ly = ((ty % c) + c) % c;
        return chunk.tiles[ly][lx];
    },

    setTileBuilding: function(tx, ty, buildingId) {
        var tile = this.getTile(tx, ty);
        tile.buildingId = buildingId;
        // No se marca el chunk dirty: el canvas horneado solo lleva terreno+recursos
        // (los edificios se dibujan aparte cada frame). Re-hornear aquí era trabajo inútil.
    },

    canPlace: function(tx, ty, w, h) {
        for (var dy = 0; dy < h; dy++) {
            for (var dx = 0; dx < w; dx++) {
                var tile = this.getTile(tx + dx, ty + dy);
                if (tile.terrain === 'water') return false;
                if (tile.buildingId !== null) return false;
            }
        }
        return true;
    },

    hasResource: function(tx, ty, w, h) {
        for (var dy = 0; dy < h; dy++) {
            for (var dx = 0; dx < w; dx++) {
                var tile = this.getTile(tx + dx, ty + dy);
                if (tile.resource && tile.resource.amount > 0) return true;
            }
        }
        return false;
    },

    getResourceType: function(tx, ty, w, h) {
        for (var dy = 0; dy < h; dy++) {
            for (var dx = 0; dx < w; dx++) {
                var tile = this.getTile(tx + dx, ty + dy);
                if (tile.resource && tile.resource.amount > 0) return tile.resource.type;
            }
        }
        return null;
    },

    mineResource: function(tx, ty, w, h) {
        for (var dy = 0; dy < h; dy++) {
            for (var dx = 0; dx < w; dx++) {
                var tile = this.getTile(tx + dx, ty + dy);
                if (tile.resource && tile.resource.amount > 0) {
                    var before = tile.resource.amount;
                    tile.resource.amount--;
                    // Solo invalidar el caché del chunk cuando cambia el aspecto
                    // visual de la veta (nº de puntos: niveles de 50 en 50)
                    var lvBefore = Math.min(4, Math.floor(before / 50));
                    var lvAfter = tile.resource.amount <= 0 ? -1 : Math.min(4, Math.floor(tile.resource.amount / 50));
                    if (lvBefore !== lvAfter) {
                        var c = CFG.CHUNK;
                        var cx = Math.floor((tx+dx) / c), cy = Math.floor((ty+dy) / c);
                        this.getChunk(cx, cy).dirty = true;
                    }
                    return tile.resource.type;
                }
            }
        }
        return null;
    },

    // Itera las claves de chunk que solapa el footprint de un edificio
    forEachChunkOf: function(b, fn) {
        var def = CFG.BUILDING_DEFS[b.type];
        var w = def.size[0], h = def.size[1];
        var c = CFG.CHUNK;
        var minCX = Math.floor(b.x / c), maxCX = Math.floor((b.x + w - 1) / c);
        var minCY = Math.floor(b.y / c), maxCY = Math.floor((b.y + h - 1) / c);
        for (var cy = minCY; cy <= maxCY; cy++) {
            for (var cx = minCX; cx <= maxCX; cx++) {
                fn(this.chunkKey(cx, cy));
            }
        }
    },

    // Devuelve los edificios (sin duplicados) presentes en el rango de chunks dado
    getBuildingsInChunkRange: function(minCX, minCY, maxCX, maxCY) {
        this._seenStamp++;
        var stamp = this._seenStamp;
        var out = [];
        for (var cy = minCY; cy <= maxCY; cy++) {
            for (var cx = minCX; cx <= maxCX; cx++) {
                var list = this.chunkBuildings[cx + ',' + cy];
                if (!list) continue;
                for (var i = 0; i < list.length; i++) {
                    var b = this.buildings[list[i]];
                    if (!b || b.removed || b._seen === stamp) continue;
                    b._seen = stamp;
                    out.push(b);
                }
            }
        }
        return out;
    },

    placeBuilding: function(b) {
        var id = this.buildings.length;
        b.id = id;
        this.buildings.push(b);
        var def = CFG.BUILDING_DEFS[b.type];
        var w = def.size[0], h = def.size[1];
        for (var dy = 0; dy < h; dy++) {
            for (var dx = 0; dx < w; dx++) {
                this.setTileBuilding(b.x + dx, b.y + dy, id);
                this.buildingMap[this.tileKey(b.x + dx, b.y + dy)] = id;
            }
        }
        var self = this;
        this.forEachChunkOf(b, function(key) {
            if (!self.chunkBuildings[key]) self.chunkBuildings[key] = [];
            self.chunkBuildings[key].push(id);
        });
        if (typeof Game !== 'undefined' && Game.onBuildingPlaced) Game.onBuildingPlaced(b);
        return id;
    },

    removeBuilding: function(id) {
        var b = this.buildings[id];
        if (!b || b.removed) return;
        var def = CFG.BUILDING_DEFS[b.type];
        var w = def.size[0], h = def.size[1];
        for (var dy = 0; dy < h; dy++) {
            for (var dx = 0; dx < w; dx++) {
                this.setTileBuilding(b.x + dx, b.y + dy, null);
                delete this.buildingMap[this.tileKey(b.x + dx, b.y + dy)];
            }
        }
        var self = this;
        this.forEachChunkOf(b, function(key) {
            var list = self.chunkBuildings[key];
            if (!list) return;
            var idx = list.indexOf(id);
            if (idx !== -1) list.splice(idx, 1);
        });
        b.removed = true;
        this.deadCount++;
        if (typeof Game !== 'undefined' && Game.onBuildingRemoved) Game.onBuildingRemoved(b);
    },

    // Elimina slots muertos de buildings[] remapeando ids. Los building ids son
    // INESTABLES tras esta llamada: nunca retener ids entre frames fuera de
    // buildingMap/chunkBuildings/powerCache/pairId — retener referencias a objeto.
    compactBuildings: function() {
        var map = {};
        var newArr = [];
        for (var i = 0; i < this.buildings.length; i++) {
            var b = this.buildings[i];
            if (!b || b.removed) continue;
            map[i] = newArr.length;
            newArr.push(b);
        }
        if (newArr.length === this.buildings.length) { this.deadCount = 0; return; }

        this.buildings = newArr;
        for (var j = 0; j < newArr.length; j++) {
            var nb = newArr[j];
            nb.id = j;
            if (nb.type === 'underground_belt' && nb.pairId !== null && nb.pairId !== undefined) {
                nb.pairId = (map[nb.pairId] !== undefined) ? map[nb.pairId] : null;
            }
        }

        // Reconstruir índices espaciales re-estampando footprints. Escritura
        // directa en tile.buildingId sin marcar chunk.dirty: el canvas horneado
        // del chunk solo contiene terreno/recursos.
        this.buildingMap = {};
        this.chunkBuildings = {};
        var self = this;
        for (var k = 0; k < newArr.length; k++) {
            var bb = newArr[k];
            var def = CFG.BUILDING_DEFS[bb.type];
            var w = def.size[0], h = def.size[1];
            for (var dy = 0; dy < h; dy++) {
                for (var dx = 0; dx < w; dx++) {
                    this.getTile(bb.x + dx, bb.y + dy).buildingId = bb.id;
                    this.buildingMap[this.tileKey(bb.x + dx, bb.y + dy)] = bb.id;
                }
            }
            var idK = bb.id;
            this.forEachChunkOf(bb, function(key) {
                if (!self.chunkBuildings[key]) self.chunkBuildings[key] = [];
                self.chunkBuildings[key].push(idK);
            });
        }
        this.deadCount = 0;

        if (typeof Game !== 'undefined' && Game.recalcPowerCache) Game.recalcPowerCache();
        // Cierra la ventana de ids stale en alertas y HTML del panel info
        if (typeof UI !== 'undefined' && UI.checkAlerts) {
            UI.checkAlerts();
            if (Input.selectedBuilding && !Input.selectedBuilding.removed &&
                document.getElementById('info-panel').style.display === 'block') {
                UI.showBuildingInfo(Input.selectedBuilding);
            }
        }
    },

    getBuildingAt: function(tx, ty) {
        var id = this.buildingMap[this.tileKey(tx, ty)];
        if (id === undefined || id === null) return null;
        var b = this.buildings[id];
        if (!b || b.removed) return null;
        return b;
    },

    findStartPosition: function() {
        for (var r = 0; r < 20; r++) {
            for (var tx = -r; tx <= r; tx++) {
                for (var ty = -r; ty <= r; ty++) {
                    if (Math.abs(tx) !== r && Math.abs(ty) !== r) continue;
                    var tile = this.getTile(tx, ty);
                    if (tile.resource && tile.resource.type === 'iron_ore') {
                        return {x: tx - 2, y: ty - 2};
                    }
                }
            }
        }
        return {x: 0, y: 0};
    }
};
