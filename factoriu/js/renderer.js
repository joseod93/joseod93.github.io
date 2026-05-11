var Renderer = {
    canvas: null,
    ctx: null,
    animOffset: 0,

    init: function(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
    },

    resize: function() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = window.innerWidth;
        var h = window.innerHeight;
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.ctx.imageSmoothingEnabled = false;
        Camera.resize(w, h);
    },

    render: function(dt) {
        var ctx = this.ctx;
        var w = window.innerWidth, h = window.innerHeight;
        this.animOffset = (this.animOffset + dt * 2) % 1;

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(-Camera.x * Camera.zoom, -Camera.y * Camera.zoom);
        ctx.scale(Camera.zoom, Camera.zoom);

        this.drawTerrain();
        this.drawResources();
        this.drawGrid();
        this.drawBuildings();
        this.drawBelts();
        this.drawBeltItems();
        this.drawGhosts();
        this.drawSelection();

        ctx.restore();

        Particles.render(ctx);
    },

    drawTerrain: function() {
        var ctx = this.ctx;
        var bounds = Camera.getVisibleBounds();
        var t = CFG.TILE;
        var colors = CFG.COLORS.terrain;

        for (var ty = bounds.minY; ty <= bounds.maxY; ty++) {
            for (var tx = bounds.minX; tx <= bounds.maxX; tx++) {
                var tile = World.getTile(tx, ty);
                if (tile.terrain === 'water') {
                    ctx.fillStyle = colors.water;
                } else if (tile.terrain === 'sand') {
                    ctx.fillStyle = colors.sand;
                } else if (tile.terrain === 'earth') {
                    ctx.fillStyle = colors.earth[tile.variant];
                } else {
                    ctx.fillStyle = colors.grass[tile.variant];
                }
                ctx.fillRect(tx * t, ty * t, t, t);
            }
        }
    },

    drawResources: function() {
        var ctx = this.ctx;
        var bounds = Camera.getVisibleBounds();
        var t = CFG.TILE;

        for (var ty = bounds.minY; ty <= bounds.maxY; ty++) {
            for (var tx = bounds.minX; tx <= bounds.maxX; tx++) {
                var tile = World.getTile(tx, ty);
                if (!tile.resource || tile.resource.amount <= 0) continue;

                var rc = CFG.COLORS.resources[tile.resource.type];
                if (!rc) continue;

                ctx.fillStyle = rc.bg;
                ctx.fillRect(tx * t + 2, ty * t + 2, t - 4, t - 4);

                ctx.fillStyle = rc.fg;
                var size = Math.min(8, 3 + tile.resource.amount / 50);
                ctx.beginPath();
                ctx.arc(tx * t + t/2, ty * t + t/2, size, 0, Math.PI * 2);
                ctx.fill();

                if (Camera.zoom > 0.8) {
                    ctx.fillStyle = '#fff';
                    ctx.font = '8px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(rc.label, tx * t + t/2, ty * t + t - 3);
                }
            }
        }
    },

    drawGrid: function() {
        if (!Input.buildMode) return;
        var ctx = this.ctx;
        var bounds = Camera.getVisibleBounds();
        var t = CFG.TILE;

        ctx.strokeStyle = CFG.COLORS.gridBuild;
        ctx.lineWidth = 0.5;
        for (var tx = bounds.minX; tx <= bounds.maxX; tx++) {
            ctx.beginPath();
            ctx.moveTo(tx * t, bounds.minY * t);
            ctx.lineTo(tx * t, (bounds.maxY + 1) * t);
            ctx.stroke();
        }
        for (var ty = bounds.minY; ty <= bounds.maxY; ty++) {
            ctx.beginPath();
            ctx.moveTo(bounds.minX * t, ty * t);
            ctx.lineTo((bounds.maxX + 1) * t, ty * t);
            ctx.stroke();
        }
    },

    drawBuildings: function() {
        var ctx = this.ctx;
        var bounds = Camera.getVisibleBounds();
        var t = CFG.TILE;

        for (var i = 0; i < World.buildings.length; i++) {
            var b = World.buildings[i];
            if (!b || b.removed) continue;
            if (b.type === 'belt') continue;

            var def = CFG.BUILDING_DEFS[b.type];
            var w = def.size[0], h = def.size[1];

            if (b.x + w < bounds.minX || b.x > bounds.maxX) continue;
            if (b.y + h < bounds.minY || b.y > bounds.maxY) continue;

            var bc = CFG.COLORS.buildings[b.type];
            if (!bc) continue;

            var px = b.x * t, py = b.y * t;
            var pw = w * t, ph = h * t;

            ctx.fillStyle = bc.bg;
            ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);

            ctx.fillStyle = bc.fg;
            ctx.fillRect(px + 3, py + 3, pw - 6, ph - 6);

            if (b.active) {
                ctx.fillStyle = 'rgba(255,255,200,0.1)';
                ctx.fillRect(px + 3, py + 3, pw - 6, ph - 6);
            }

            if (bc.label && Camera.zoom > 0.5) {
                ctx.fillStyle = '#fff';
                ctx.font = 'bold ' + Math.min(14, t * 0.4 * Math.min(w, h)) + 'px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(bc.label, px + pw/2, py + ph/2);
            }

            if (b.progress > 0 && b.progress < 1) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(px + 2, py + ph - 6, pw - 4, 4);
                ctx.fillStyle = CFG.COLORS.accent;
                ctx.fillRect(px + 2, py + ph - 6, (pw - 4) * b.progress, 4);
            }

            if (b.type === 'inserter') {
                this.drawInserter(ctx, b, t);
            }

            if (b.direction !== undefined && b.type !== 'inserter') {
                var d = CFG.DIRECTIONS[b.direction];
                var cx = px + pw/2, cy = py + ph/2;
                var arrowSize = Math.min(w, h) * t * 0.15;
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.beginPath();
                ctx.moveTo(cx + d.dx * arrowSize * 2, cy + d.dy * arrowSize * 2);
                ctx.lineTo(cx + d.dy * arrowSize - d.dx * arrowSize, cy - d.dx * arrowSize - d.dy * arrowSize);
                ctx.lineTo(cx - d.dy * arrowSize - d.dx * arrowSize, cy + d.dx * arrowSize - d.dy * arrowSize);
                ctx.closePath();
                ctx.fill();
            }

            if (b.type === 'rocket_silo' && b.rocketParts > 0) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(px + 4, py + 4, pw - 8, 8);
                ctx.fillStyle = '#44ddff';
                ctx.fillRect(px + 4, py + 4, (pw - 8) * (b.rocketParts / 100), 8);
                ctx.fillStyle = '#fff';
                ctx.font = '8px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(b.rocketParts + '/100', px + pw/2, py + 11);
            }
        }
    },

    drawInserter: function(ctx, b, t) {
        var d = CFG.DIRECTIONS[b.direction];
        var cx = b.x * t + t/2;
        var cy = b.y * t + t/2;
        var armLen = t * 0.8;

        ctx.strokeStyle = '#aaaa66';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - d.dx * armLen * 0.4, cy - d.dy * armLen * 0.4);
        ctx.lineTo(cx + d.dx * armLen * 0.4, cy + d.dy * armLen * 0.4);
        ctx.stroke();

        ctx.fillStyle = '#dddd88';
        ctx.beginPath();
        ctx.arc(cx + d.dx * armLen * 0.4, cy + d.dy * armLen * 0.4, 3, 0, Math.PI * 2);
        ctx.fill();
    },

    drawBelts: function() {
        var ctx = this.ctx;
        var bounds = Camera.getVisibleBounds();
        var t = CFG.TILE;

        for (var i = 0; i < World.buildings.length; i++) {
            var b = World.buildings[i];
            if (!b || b.removed || b.type !== 'belt') continue;
            if (b.x < bounds.minX - 1 || b.x > bounds.maxX + 1) continue;
            if (b.y < bounds.minY - 1 || b.y > bounds.maxY + 1) continue;

            var px = b.x * t, py = b.y * t;
            var bc = CFG.COLORS.buildings.belt;

            ctx.fillStyle = bc.bg;
            ctx.fillRect(px, py, t, t);

            ctx.fillStyle = bc.fg;
            var d = CFG.DIRECTIONS[b.direction];
            var margin = 4;

            if (d.dx !== 0) {
                ctx.fillRect(px, py + margin, t, t - margin * 2);
            } else {
                ctx.fillRect(px + margin, py, t - margin * 2, t);
            }

            var arrowCount = 2;
            var off = this.animOffset;
            ctx.fillStyle = 'rgba(60,50,20,0.5)';
            for (var a = 0; a < arrowCount; a++) {
                var frac = ((a / arrowCount) + off) % 1;
                var ax = px + t * 0.5 + d.dx * (frac - 0.5) * t * 0.6;
                var ay = py + t * 0.5 + d.dy * (frac - 0.5) * t * 0.6;
                var as = 3;
                ctx.beginPath();
                ctx.moveTo(ax + d.dx * as, ay + d.dy * as);
                ctx.lineTo(ax + d.dy * as * 0.7, ay - d.dx * as * 0.7);
                ctx.lineTo(ax - d.dy * as * 0.7, ay + d.dx * as * 0.7);
                ctx.closePath();
                ctx.fill();
            }
        }
    },

    drawBeltItems: function() {
        var ctx = this.ctx;

        for (var i = 0; i < Belts.lines.length; i++) {
            var line = Belts.lines[i];
            if (line.removed || line.items.length === 0) continue;

            var positions = Belts.getItemPositions(line);
            for (var j = 0; j < positions.length; j++) {
                var p = positions[j];
                var screenPos = {x: p.x, y: p.y};

                var bounds = Camera.getVisibleBounds();
                var t = CFG.TILE;
                if (p.x < bounds.minX * t - t || p.x > (bounds.maxX + 1) * t + t) continue;
                if (p.y < bounds.minY * t - t || p.y > (bounds.maxY + 1) * t + t) continue;

                ctx.fillStyle = Items.color(p.type);
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    },

    drawGhosts: function() {
        var ctx = this.ctx;
        var t = CFG.TILE;

        if (Input.buildMode && Input.buildMode !== 'belt') {
            var def = CFG.BUILDING_DEFS[Input.buildMode];
            if (!def) return;
            var tile = Input.mouse.tile;
            var w = def.size[0], h = def.size[1];
            var canPlace = World.canPlace(tile.x, tile.y, w, h);
            if (Input.buildMode === 'miner') canPlace = canPlace && World.hasResource(tile.x, tile.y, w, h);

            ctx.globalAlpha = 0.5;
            ctx.fillStyle = canPlace ? CFG.COLORS.validPlace : CFG.COLORS.invalidPlace;
            ctx.fillRect(tile.x * t, tile.y * t, w * t, h * t);

            var bc = CFG.COLORS.buildings[Input.buildMode];
            if (bc) {
                ctx.fillStyle = bc.fg;
                ctx.fillRect(tile.x * t + 3, tile.y * t + 3, w * t - 6, h * t - 6);
            }
            ctx.globalAlpha = 1;
        }

        if (Input.buildMode === 'belt') {
            if (Input.ghostTiles.length > 0) {
                for (var i = 0; i < Input.ghostTiles.length; i++) {
                    var g = Input.ghostTiles[i];
                    var exists = World.getBuildingAt(g.x, g.y);
                    ctx.globalAlpha = 0.5;
                    ctx.fillStyle = exists ? CFG.COLORS.invalidPlace : '#ccaa44';
                    ctx.fillRect(g.x * t + 1, g.y * t + 1, t - 2, t - 2);
                    ctx.globalAlpha = 1;
                }
            } else {
                var tile2 = Input.mouse.tile;
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = '#ccaa44';
                ctx.fillRect(tile2.x * t + 1, tile2.y * t + 1, t - 2, t - 2);

                var d = CFG.DIRECTIONS[Input.buildDirection];
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                var cx = tile2.x * t + t/2, cy = tile2.y * t + t/2;
                ctx.beginPath();
                ctx.moveTo(cx + d.dx * 8, cy + d.dy * 8);
                ctx.lineTo(cx + d.dy * 5, cy - d.dx * 5);
                ctx.lineTo(cx - d.dy * 5, cy + d.dx * 5);
                ctx.closePath();
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
    },

    drawSelection: function() {
        var ctx = this.ctx;
        var t = CFG.TILE;
        var b = Input.selectedBuilding;
        if (!b || b.removed) return;

        var def = CFG.BUILDING_DEFS[b.type];
        var w = def.size[0], h = def.size[1];
        var px = b.x * t, py = b.y * t;

        ctx.strokeStyle = CFG.COLORS.accent;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -this.animOffset * 16;
        ctx.strokeRect(px - 1, py - 1, w * t + 2, h * t + 2);
        ctx.setLineDash([]);
    }
};
