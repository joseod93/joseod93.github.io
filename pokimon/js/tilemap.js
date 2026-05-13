window.Game = window.Game || {};

Game.Tilemap = {
    groundCanvas: null,
    canopyCanvas: null,
    dirty: true,
    _trunkPositions: null,

    invalidate: function() {
        this.dirty = true;
        this._trunkPositions = null;
    },

    hash: function(x, y) {
        var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        return n - Math.floor(n);
    },

    smoothNoise: function(x, y, scale) {
        x = x / scale;
        y = y / scale;
        var ix = Math.floor(x), iy = Math.floor(y);
        var fx = x - ix, fy = y - iy;
        fx = fx * fx * (3 - 2 * fx);
        fy = fy * fy * (3 - 2 * fy);
        var a = this.hash(ix, iy);
        var b = this.hash(ix + 1, iy);
        var c = this.hash(ix, iy + 1);
        var d = this.hash(ix + 1, iy + 1);
        return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    },

    fbm: function(x, y, scale) {
        return this.smoothNoise(x, y, scale) * 0.65 +
               this.smoothNoise(x, y, scale * 0.5) * 0.35;
    },

    getTile: function(x, y) {
        if (x < 0 || x >= Game.Constants.MAP_COLS || y < 0 || y >= Game.Constants.MAP_ROWS) return 1;
        return Game.MapData.tiles[y][x];
    },

    isPathLike: function(x, y) {
        var t = this.getTile(x, y);
        return t === 4 || t === 3 || t === 5;
    },

    build: function() {
        this.buildGround();
        this.buildCanopy();
        this.dirty = false;
    },

    buildGround: function() {
        var C = Game.Constants;
        var TS = C.TILE_SIZE;
        var W = C.MAP_COLS * TS;
        var H = C.MAP_ROWS * TS;

        var canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        var ctx = canvas.getContext('2d');

        var step = 4;
        for (var py = 0; py < H; py += step) {
            for (var px = 0; px < W; px += step) {
                var n = this.fbm(px, py, 80);
                var r = Math.floor(62 + n * 30);
                var g = Math.floor(122 + n * 45);
                var b = Math.floor(28 + n * 18);
                ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
                ctx.fillRect(px, py, step, step);
            }
        }

        for (var row = 0; row < C.MAP_ROWS; row++) {
            for (var col = 0; col < C.MAP_COLS; col++) {
                var tile = Game.MapData.tiles[row][col];
                var tx = col * TS;
                var ty = row * TS;
                if (tile === 4) this.paintPath(ctx, tx, ty, col, row, TS);
                else if (tile === 1) this.paintForestFloor(ctx, tx, ty, col, row, TS);
                else if (tile === 2) this.paintGrassBase(ctx, tx, ty, col, row, TS);
                else if (tile === 3) this.paintHealBase(ctx, tx, ty, TS);
                else if (tile === 5) this.paintShopBase(ctx, tx, ty, TS);
            }
        }

        for (var row = 0; row < C.MAP_ROWS; row++) {
            for (var col = 0; col < C.MAP_COLS; col++) {
                if (Game.MapData.tiles[row][col] !== 1) continue;
                var tx = col * TS;
                var ty = row * TS;
                if (this.getTile(col, row + 1) !== 1) {
                    var grd = ctx.createLinearGradient(tx, ty + TS, tx, ty + TS + 14);
                    grd.addColorStop(0, 'rgba(0,15,0,0.35)');
                    grd.addColorStop(1, 'rgba(0,15,0,0)');
                    ctx.fillStyle = grd;
                    ctx.fillRect(tx - 6, ty + TS, TS + 12, 14);
                }
                if (this.getTile(col + 1, row) !== 1) {
                    var grd = ctx.createLinearGradient(tx + TS, ty, tx + TS + 8, ty);
                    grd.addColorStop(0, 'rgba(0,15,0,0.2)');
                    grd.addColorStop(1, 'rgba(0,15,0,0)');
                    ctx.fillStyle = grd;
                    ctx.fillRect(tx + TS, ty, 8, TS);
                }
            }
        }

        for (var row = 0; row < C.MAP_ROWS; row++) {
            for (var col = 0; col < C.MAP_COLS; col++) {
                var tile = Game.MapData.tiles[row][col];
                if (tile !== 0 && tile !== 2) continue;
                var tx = col * TS;
                var ty = row * TS;
                for (var g = 0; g < 4; g++) {
                    var gn = this.hash(col * 5 + g, row * 7 + g);
                    var gx = tx + gn * (TS - 4) + 2;
                    var gy = ty + this.hash(col * 3 + g, row * 11 + g) * (TS - 8) + 4;
                    ctx.fillStyle = tile === 2 ? 'rgba(35,100,25,0.35)' : 'rgba(55,120,40,0.2)';
                    ctx.fillRect(gx, gy, 2, Math.floor(4 + gn * 3));
                }
            }
        }

        this.groundCanvas = canvas;
    },

    paintPath: function(ctx, tx, ty, col, row, TS) {
        var n = this.fbm(tx + 500, ty + 500, 60);
        var base = Math.floor(170 + n * 30);
        ctx.fillStyle = 'rgb(' + base + ',' + Math.floor(base * 0.85) + ',' + Math.floor(base * 0.55) + ')';
        ctx.fillRect(tx, ty, TS, TS);

        for (var i = 0; i < 8; i++) {
            var gn = this.hash(col * 13 + i, row * 17 + i);
            ctx.fillStyle = 'rgba(140,120,80,' + (0.1 + gn * 0.15) + ')';
            ctx.fillRect(
                tx + 2 + gn * (TS - 6),
                ty + 2 + this.hash(col * 19 + i, row * 7 + i) * (TS - 6),
                Math.floor(2 + gn * 2), Math.floor(1 + gn)
            );
        }

        var edge = 8;
        var isPN = this.isPathLike(col, row - 1) || this.getTile(col, row - 1) === 1;
        var isPS = this.isPathLike(col, row + 1) || this.getTile(col, row + 1) === 1;
        var isPE = this.isPathLike(col + 1, row) || this.getTile(col + 1, row) === 1;
        var isPW = this.isPathLike(col - 1, row) || this.getTile(col - 1, row) === 1;

        if (!isPN) {
            var g = ctx.createLinearGradient(tx, ty, tx, ty + edge);
            g.addColorStop(0, 'rgba(70,130,45,0.75)');
            g.addColorStop(1, 'rgba(70,130,45,0)');
            ctx.fillStyle = g;
            ctx.fillRect(tx, ty, TS, edge);
        }
        if (!isPS) {
            var g = ctx.createLinearGradient(tx, ty + TS, tx, ty + TS - edge);
            g.addColorStop(0, 'rgba(70,130,45,0.75)');
            g.addColorStop(1, 'rgba(70,130,45,0)');
            ctx.fillStyle = g;
            ctx.fillRect(tx, ty + TS - edge, TS, edge);
        }
        if (!isPW) {
            var g = ctx.createLinearGradient(tx, ty, tx + edge, ty);
            g.addColorStop(0, 'rgba(70,130,45,0.75)');
            g.addColorStop(1, 'rgba(70,130,45,0)');
            ctx.fillStyle = g;
            ctx.fillRect(tx, ty, edge, TS);
        }
        if (!isPE) {
            var g = ctx.createLinearGradient(tx + TS, ty, tx + TS - edge, ty);
            g.addColorStop(0, 'rgba(70,130,45,0.75)');
            g.addColorStop(1, 'rgba(70,130,45,0)');
            ctx.fillStyle = g;
            ctx.fillRect(tx + TS - edge, ty, edge, TS);
        }

        var isNW = !isPN && !isPW && this.getTile(col - 1, row - 1) !== 4;
        var isNE = !isPN && !isPE && this.getTile(col + 1, row - 1) !== 4;
        var isSW = !isPS && !isPW && this.getTile(col - 1, row + 1) !== 4;
        var isSE = !isPS && !isPE && this.getTile(col + 1, row + 1) !== 4;

        ctx.fillStyle = 'rgba(70,130,45,0.5)';
        if (isNW) { ctx.beginPath(); ctx.arc(tx + 4, ty + 4, 6, 0, Math.PI * 2); ctx.fill(); }
        if (isNE) { ctx.beginPath(); ctx.arc(tx + TS - 4, ty + 4, 6, 0, Math.PI * 2); ctx.fill(); }
        if (isSW) { ctx.beginPath(); ctx.arc(tx + 4, ty + TS - 4, 6, 0, Math.PI * 2); ctx.fill(); }
        if (isSE) { ctx.beginPath(); ctx.arc(tx + TS - 4, ty + TS - 4, 6, 0, Math.PI * 2); ctx.fill(); }
    },

    paintForestFloor: function(ctx, tx, ty, col, row, TS) {
        ctx.fillStyle = 'rgba(10,35,8,0.55)';
        ctx.fillRect(tx, ty, TS, TS);
        for (var i = 0; i < 3; i++) {
            var n = this.hash(col * 11 + i, row * 7 + i);
            ctx.fillStyle = 'rgba(55,85,28,' + (0.15 + n * 0.15) + ')';
            ctx.fillRect(tx + 4 + n * 20, ty + 4 + this.hash(col * 3 + i, row * 13 + i) * 20, 3, 2);
        }
    },

    paintGrassBase: function(ctx, tx, ty, col, row, TS) {
        ctx.fillStyle = 'rgba(12,50,8,0.25)';
        ctx.fillRect(tx, ty, TS, TS);

        var edge = 6;
        var nN = this.getTile(col, row - 1);
        var nS = this.getTile(col, row + 1);
        var nE = this.getTile(col + 1, row);
        var nW = this.getTile(col - 1, row);

        if (nN !== 2 && nN !== 1) {
            var g = ctx.createLinearGradient(tx, ty, tx, ty + edge);
            g.addColorStop(0, 'rgba(12,50,8,0)');
            g.addColorStop(1, 'rgba(12,50,8,0.25)');
            ctx.fillStyle = g;
            ctx.fillRect(tx, ty, TS, edge);
        }
        if (nS !== 2 && nS !== 1) {
            var g = ctx.createLinearGradient(tx, ty + TS, tx, ty + TS - edge);
            g.addColorStop(0, 'rgba(12,50,8,0)');
            g.addColorStop(1, 'rgba(12,50,8,0.25)');
            ctx.fillStyle = g;
            ctx.fillRect(tx, ty + TS - edge, TS, edge);
        }
    },

    paintHealBase: function(ctx, tx, ty, TS) {
        ctx.fillStyle = 'rgb(175,135,135)';
        ctx.fillRect(tx, ty, TS, TS);
        ctx.strokeStyle = 'rgba(155,115,115,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx + 4, ty + 4, TS - 8, TS - 8);
    },

    paintShopBase: function(ctx, tx, ty, TS) {
        ctx.fillStyle = 'rgb(160,120,70)';
        ctx.fillRect(tx, ty, TS, TS);
        ctx.strokeStyle = 'rgba(120,80,40,0.25)';
        ctx.lineWidth = 1;
        for (var i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(tx, ty + 6 + i * 10);
            ctx.lineTo(tx + TS, ty + 6 + i * 10);
            ctx.stroke();
        }
    },

    buildCanopy: function() {
        var C = Game.Constants;
        var TS = C.TILE_SIZE;
        var W = C.MAP_COLS * TS;
        var H = C.MAP_ROWS * TS;

        var canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        var ctx = canvas.getContext('2d');

        for (var row = 0; row < C.MAP_ROWS; row++) {
            for (var col = 0; col < C.MAP_COLS; col++) {
                if (Game.MapData.tiles[row][col] !== 1) continue;
                this.paintCanopy(ctx, col * TS, row * TS, col, row, TS);
            }
        }

        this.canopyCanvas = canvas;
    },

    paintCanopy: function(ctx, tx, ty, col, row, TS) {
        var n = this.smoothNoise(tx, ty, 64);
        var hasN = this.getTile(col, row - 1) === 1;
        var hasS = this.getTile(col, row + 1) === 1;
        var hasE = this.getTile(col + 1, row) === 1;
        var hasW = this.getTile(col - 1, row) === 1;

        var r = Math.floor(18 + n * 25);
        var g = Math.floor(85 + n * 50);
        var b = Math.floor(10 + n * 18);

        ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
        ctx.fillRect(tx, ty, TS, TS);

        var er = r + 10;
        var eg = g + 18;
        var eb = b + 6;
        ctx.fillStyle = 'rgb(' + er + ',' + eg + ',' + eb + ')';

        var bulge = 7;
        if (!hasN) {
            ctx.beginPath();
            ctx.ellipse(tx + TS / 2, ty + 2, TS / 2 + 3, bulge, 0, Math.PI, 0);
            ctx.fill();
        }
        if (!hasS) {
            ctx.beginPath();
            ctx.ellipse(tx + TS / 2, ty + TS - 2, TS / 2 + 3, bulge, 0, 0, Math.PI);
            ctx.fill();
        }
        if (!hasW) {
            ctx.beginPath();
            ctx.ellipse(tx + 2, ty + TS / 2, bulge, TS / 2 + 3, 0, -Math.PI / 2, Math.PI / 2);
            ctx.fill();
        }
        if (!hasE) {
            ctx.beginPath();
            ctx.ellipse(tx + TS - 2, ty + TS / 2, bulge, TS / 2 + 3, 0, Math.PI / 2, -Math.PI / 2);
            ctx.fill();
        }

        var hasNE = this.getTile(col + 1, row - 1) === 1;
        var hasNW = this.getTile(col - 1, row - 1) === 1;
        var hasSE = this.getTile(col + 1, row + 1) === 1;
        var hasSW = this.getTile(col - 1, row + 1) === 1;

        ctx.fillStyle = 'rgb(' + (er - 3) + ',' + (eg - 5) + ',' + (eb - 2) + ')';
        if (!hasN && !hasE && !hasNE) { ctx.beginPath(); ctx.arc(tx + TS - 3, ty + 3, 5, 0, Math.PI * 2); ctx.fill(); }
        if (!hasN && !hasW && !hasNW) { ctx.beginPath(); ctx.arc(tx + 3, ty + 3, 5, 0, Math.PI * 2); ctx.fill(); }
        if (!hasS && !hasE && !hasSE) { ctx.beginPath(); ctx.arc(tx + TS - 3, ty + TS - 3, 5, 0, Math.PI * 2); ctx.fill(); }
        if (!hasS && !hasW && !hasSW) { ctx.beginPath(); ctx.arc(tx + 3, ty + TS - 3, 5, 0, Math.PI * 2); ctx.fill(); }

        for (var i = 0; i < 5; i++) {
            var ln = this.hash(col * 7 + i, row * 13 + i);
            var lx = tx + 3 + ln * (TS - 6);
            var ly = ty + 3 + this.hash(col * 11 + i, row * 3 + i) * (TS - 6);
            var lr = 3 + ln * 5;
            var lg = Math.floor(105 + ln * 55);
            ctx.fillStyle = 'rgba(' + Math.floor(22 + ln * 28) + ',' + lg + ',' + Math.floor(12 + ln * 15) + ',0.4)';
            ctx.beginPath();
            ctx.arc(lx, ly, lr, 0, Math.PI * 2);
            ctx.fill();
        }

        for (var i = 0; i < 2; i++) {
            var sn = this.hash(col * 23 + i, row * 31 + i);
            ctx.fillStyle = 'rgba(110,175,70,' + (0.08 + sn * 0.12) + ')';
            ctx.beginPath();
            ctx.arc(
                tx + 4 + sn * (TS - 8),
                ty + 4 + this.hash(col * 29 + i, row * 37 + i) * (TS - 8),
                2 + sn * 3, 0, Math.PI * 2
            );
            ctx.fill();
        }
    },

    getTrunkPositions: function() {
        if (this._trunkPositions) return this._trunkPositions;
        var result = [];
        var TS = Game.Constants.TILE_SIZE;
        for (var row = 0; row < Game.Constants.MAP_ROWS; row++) {
            for (var col = 0; col < Game.Constants.MAP_COLS; col++) {
                if (Game.MapData.tiles[row][col] !== 1) continue;
                if (this.getTile(col, row + 1) === 1) continue;
                result.push({ x: col * TS, y: row * TS, col: col, row: row });
            }
        }
        this._trunkPositions = result;
        return result;
    },

    drawTrunk: function(ctx, trunk, camX, camY) {
        var TS = Game.Constants.TILE_SIZE;
        var tx = trunk.x - camX;
        var ty = trunk.y - camY;
        var n = this.hash(trunk.col, trunk.row);

        var tw = Math.floor(8 + n * 6);
        var th = Math.floor(10 + n * 6);
        var bx = tx + (TS - tw) / 2;
        var by = ty + TS - th;

        var tr = Math.floor(82 + n * 28);
        var tg = Math.floor(58 + n * 18);
        var tb = Math.floor(28 + n * 12);
        ctx.fillStyle = 'rgb(' + tr + ',' + tg + ',' + tb + ')';
        ctx.fillRect(bx, by, tw, th);

        ctx.fillStyle = 'rgba(50,35,15,0.3)';
        ctx.fillRect(bx + 2, by + 2, 1, th - 4);
        ctx.fillRect(bx + tw - 3, by + 3, 1, th - 5);

        ctx.fillStyle = 'rgba(65,45,22,0.45)';
        ctx.beginPath();
        ctx.ellipse(bx + tw / 2, by + th, tw / 2 + 3, 3, 0, 0, Math.PI);
        ctx.fill();
    },

    drawGround: function(ctx, camX, camY) {
        if (this.dirty) this.build();
        ctx.drawImage(this.groundCanvas, -camX, -camY);
    },

    drawCanopy: function(ctx, camX, camY) {
        if (this.dirty) this.build();
        ctx.drawImage(this.canopyCanvas, -camX, -camY);
    }
};
