var World = {
    seed: 0,
    chunks: {},
    buildings: [],
    buildingMap: {},

    init: function(seed) {
        this.seed = seed || Math.floor(Math.random() * 999999);
        this.chunks = {};
        this.buildings = [];
        this.buildingMap = {};
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
        var c = CFG.CHUNK;
        var cx = Math.floor(tx / c), cy = Math.floor(ty / c);
        var chunk = this.getChunk(cx, cy);
        chunk.dirty = true;
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
                    tile.resource.amount--;
                    var c = CFG.CHUNK;
                    var cx = Math.floor((tx+dx) / c), cy = Math.floor((ty+dy) / c);
                    this.getChunk(cx, cy).dirty = true;
                    return tile.resource.type;
                }
            }
        }
        return null;
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
        b.removed = true;
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
