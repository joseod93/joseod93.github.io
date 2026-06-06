var Renderer = {
    canvas: null,
    ctx: null,
    animOffset: 0,
    time: 0,
    frameCount: 0,
    CHUNK_SCALE: 2,

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
        this.time += dt;
        this.frameCount++;
        if (this.frameCount % 300 === 0) this.evictChunkCanvases();

        ctx.fillStyle = '#111122';
        ctx.fillRect(0, 0, w, h);

        var shake = Camera.getShakeOffset(dt);
        ctx.save();
        ctx.translate(-Camera.x * Camera.zoom + (shake ? shake.x : 0),
                      -Camera.y * Camera.zoom + (shake ? shake.y : 0));
        ctx.scale(Camera.zoom, Camera.zoom);

        this.drawTerrain();
        this.drawResourceLabels();
        this.drawResourceHighlight();
        this.drawGrid();
        this.drawBelts();
        this.drawBuildings();
        this.drawBeltItems();
        if (Game.rocketAnim) this.drawRocketAnim(ctx, dt);
        this.drawGhosts();
        this.drawSelection();

        ctx.restore();

        this.drawVignette(ctx, w, h);
        Particles.render(ctx);
        this.drawMinimap(ctx, w, h);
    },

    drawVignette: function(ctx, w, h) {
        var g = ctx.createRadialGradient(w/2, h/2, w * 0.3, w/2, h/2, w * 0.8);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,10,0.35)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    },

    // Hornea terreno + recursos de un chunk en un canvas offscreen (a 2x para DPR/zoom).
    // Se invalida vía chunk.dirty (place/remove de edificios, cambios visuales de vetas).
    renderChunkCanvas: function(chunk) {
        var c = CFG.CHUNK, t = CFG.TILE, S = this.CHUNK_SCALE;
        var size = c * t;
        if (!chunk.canvas) {
            chunk.canvas = document.createElement('canvas');
            chunk.canvas.width = size * S;
            chunk.canvas.height = size * S;
        }
        var ctx = chunk.canvas.getContext('2d');
        ctx.setTransform(S, 0, 0, S, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, size, size);

        var colors = CFG.COLORS.terrain;
        var waterTiles = [];

        for (var ly = 0; ly < c; ly++) {
            for (var lx = 0; lx < c; lx++) {
                var tile = chunk.tiles[ly][lx];
                var tx = chunk.cx * c + lx, ty = chunk.cy * c + ly;
                var px = lx * t, py = ly * t;

                if (tile.terrain === 'water') {
                    ctx.fillStyle = '#19378f';
                    ctx.fillRect(px, py, t, t);
                    waterTiles.push({tx: tx, ty: ty});
                } else if (tile.terrain === 'sand') {
                    ctx.fillStyle = colors.sand;
                    ctx.fillRect(px, py, t, t);
                    ctx.fillStyle = 'rgba(180,160,130,0.15)';
                    var sx1 = World.hash2d(tx * 3, ty * 5);
                    ctx.fillRect(px + sx1 * 20, py + sx1 * 12, 3, 1);
                } else if (tile.terrain === 'earth') {
                    ctx.fillStyle = colors.earth[tile.variant];
                    ctx.fillRect(px, py, t, t);
                    ctx.fillStyle = 'rgba(100,80,60,0.2)';
                    var ex1 = World.hash2d(tx * 5, ty * 7);
                    ctx.fillRect(px + ex1 * 18, py + 8, 4, 2);
                } else {
                    ctx.fillStyle = colors.grass[tile.variant];
                    ctx.fillRect(px, py, t, t);
                    var gh = World.hash2d(tx, ty);
                    var gh2 = World.hash2d(tx + 100, ty + 100);
                    ctx.fillStyle = 'rgba(80,140,60,0.25)';
                    ctx.fillRect(px + gh * 20, py + gh2 * 20, 2, 3);
                    ctx.fillRect(px + gh2 * 24 + 4, py + gh * 18 + 6, 2, 2);
                }

                if (tile.resource && tile.resource.amount > 0) {
                    var rc = CFG.COLORS.resources[tile.resource.type];
                    if (rc) {
                        var m = 2;
                        ctx.fillStyle = rc.bg;
                        this.roundRect(ctx, px + m, py + m, t - m*2, t - m*2, 4);
                        ctx.fill();

                        ctx.fillStyle = 'rgba(0,0,0,0.15)';
                        ctx.fillRect(px + m, py + t/2, t - m*2, t/2 - m);

                        // Nivel visual cuantizado (debe coincidir con World.mineResource)
                        var level = Math.min(4, Math.floor(tile.resource.amount / 50));
                        var dots = 1 + level;
                        var ds = 2 + (level / 4) * 2.5;
                        ctx.fillStyle = rc.fg;
                        for (var di = 0; di < dots; di++) {
                            var seed = World.hash2d(tx * 7 + di, ty * 13 + di);
                            var ox = (seed - 0.5) * (t - 16);
                            var oy = (World.hash2d(tx * 11 + di, ty * 3 + di) - 0.5) * (t - 16);
                            ctx.beginPath();
                            ctx.arc(px + t/2 + ox, py + t/2 + oy, ds, 0, Math.PI * 2);
                            ctx.fill();
                        }

                        ctx.fillStyle = 'rgba(255,255,255,0.12)';
                        ctx.fillRect(px + m + 1, py + m + 1, t - m*2 - 2, 2);
                    }
                }
            }
        }

        chunk.waterTiles = waterTiles;
        chunk.dirty = false;
    },

    drawTerrain: function() {
        var ctx = this.ctx;
        var t = CFG.TILE, c = CFG.CHUNK;
        var chunkPx = c * t;
        var vc = Camera.getVisibleChunks();

        // Al reducir (zoom < 1) suavizar el escalado del caché para evitar shimmering
        var smooth = Camera.zoom < 1;
        if (smooth) ctx.imageSmoothingEnabled = true;

        for (var cy = vc.minCY; cy <= vc.maxCY; cy++) {
            for (var cx = vc.minCX; cx <= vc.maxCX; cx++) {
                var chunk = World.getChunk(cx, cy);
                if (chunk.dirty || !chunk.canvas) this.renderChunkCanvas(chunk);
                ctx.drawImage(chunk.canvas, cx * chunkPx, cy * chunkPx, chunkPx, chunkPx);
                chunk.lastUsed = this.frameCount;
            }
        }

        if (smooth) ctx.imageSmoothingEnabled = false;

        if (Camera.zoom > 0.5) this.drawWaterOverlay(vc);
    },

    drawWaterOverlay: function(vc) {
        var ctx = this.ctx;
        var t = CFG.TILE;
        var time = this.time;

        for (var cy = vc.minCY; cy <= vc.maxCY; cy++) {
            for (var cx = vc.minCX; cx <= vc.maxCX; cx++) {
                var chunk = World.chunks[cx + ',' + cy];
                if (!chunk || !chunk.waterTiles || chunk.waterTiles.length === 0) continue;

                for (var i = 0; i < chunk.waterTiles.length; i++) {
                    var wt = chunk.waterTiles[i];
                    var px = wt.tx * t, py = wt.ty * t;
                    var wave1 = Math.sin(wt.tx * 0.4 + time * 1.2) * 0.08;
                    var wave2 = Math.sin(wt.ty * 0.3 + time * 0.8) * 0.05;

                    ctx.fillStyle = 'rgba(120,180,255,' + Math.max(0, 0.08 + (wave1 + wave2) * 0.5).toFixed(3) + ')';
                    ctx.fillRect(px, py, t, t);

                    ctx.fillStyle = 'rgba(100,180,255,' + Math.max(0, 0.06 + wave1 * 0.3).toFixed(3) + ')';
                    var wlx = px + ((wt.tx * 7 + Math.floor(time * 8)) % t);
                    ctx.fillRect(wlx, py + t * 0.3, t * 0.4, 1);
                    ctx.fillRect(wlx - 4, py + t * 0.65, t * 0.3, 1);
                }
            }
        }
    },

    // Labels de recursos fuera del caché (el texto horneado se pixelaría con zoom)
    drawResourceLabels: function() {
        if (Camera.zoom <= 0.7) return;
        var ctx = this.ctx;
        var bounds = Camera.getVisibleBounds();
        var t = CFG.TILE;

        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        for (var ty = bounds.minY; ty <= bounds.maxY; ty++) {
            for (var tx = bounds.minX; tx <= bounds.maxX; tx++) {
                var tile = World.getTile(tx, ty);
                if (!tile.resource || tile.resource.amount <= 0) continue;
                var rc = CFG.COLORS.resources[tile.resource.type];
                if (!rc) continue;

                var px = tx * t, py = ty * t;
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillText(rc.label, px + t/2 + 1, py + t - 1);
                ctx.fillStyle = '#fff';
                ctx.fillText(rc.label, px + t/2, py + t - 2);
            }
        }
    },

    // Libera canvases de chunks no vistos recientemente (memoria)
    evictChunkCanvases: function() {
        for (var k in World.chunks) {
            var chunk = World.chunks[k];
            if (chunk.canvas && this.frameCount - (chunk.lastUsed || 0) > 600) {
                chunk.canvas = null;
                chunk.waterTiles = null;
                chunk.dirty = true;
            }
        }
    },

    drawResourceHighlight: function() {
        if (Input.buildMode !== 'miner' && Input.buildMode !== 'electric_miner') return;
        var ctx = this.ctx;
        var bounds = Camera.getVisibleBounds();
        var t = CFG.TILE;
        var pulse = 0.5 + Math.sin(this.time * 4) * 0.3;

        for (var ty = bounds.minY; ty <= bounds.maxY; ty++) {
            for (var tx = bounds.minX; tx <= bounds.maxX; tx++) {
                var tile = World.getTile(tx, ty);
                if (!tile.resource || tile.resource.amount <= 0) continue;

                var rc = CFG.COLORS.resources[tile.resource.type];
                if (!rc) continue;

                var px = tx * t, py = ty * t;

                ctx.globalAlpha = pulse * 0.2;
                ctx.fillStyle = rc.fg;
                ctx.fillRect(px, py, t, t);

                ctx.globalAlpha = pulse;
                ctx.strokeStyle = rc.fg;
                ctx.lineWidth = 2;
                this.roundRect(ctx, px + 1, py + 1, t - 2, t - 2, 3);
                ctx.stroke();
                ctx.globalAlpha = 1;

                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.font = 'bold ' + Math.max(12, Math.floor(t * 0.4)) + 'px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(rc.label, px + t/2 + 1, py + t/2 + 1);
                ctx.fillStyle = '#fff';
                ctx.fillText(rc.label, px + t/2, py + t/2);
            }
        }
    },

    drawGrid: function() {
        if (!Input.buildMode) return;
        var ctx = this.ctx;
        var bounds = Camera.getVisibleBounds();
        var t = CFG.TILE;

        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
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
        var vc = Camera.getVisibleChunks();
        var list = World.getBuildingsInChunkRange(vc.minCX, vc.minCY, vc.maxCX, vc.maxCY);

        for (var i = 0; i < list.length; i++) {
            var b = list[i];
            if (b.type === 'belt' || b.type === 'fast_belt') continue;

            var def = CFG.BUILDING_DEFS[b.type];
            var w = def.size[0], h = def.size[1];

            if (b.x + w < bounds.minX || b.x > bounds.maxX) continue;
            if (b.y + h < bounds.minY || b.y > bounds.maxY) continue;

            var bc = CFG.COLORS.buildings[b.type];
            if (!bc) continue;

            var px = b.x * t, py = b.y * t;
            var pw = w * t, ph = h * t;

            var placeAge = performance.now() - (b.placedAt || 0);
            var hasPlaceAnim = placeAge < 200;
            if (hasPlaceAnim) {
                var sc = 0.8 + 0.2 * (placeAge / 200);
                ctx.save();
                ctx.translate(px + pw/2, py + ph/2);
                ctx.scale(sc, sc);
                ctx.translate(-(px + pw/2), -(py + ph/2));
            }

            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            this.roundRect(ctx, px + 2, py + 2, pw - 1, ph - 1, 3);
            ctx.fill();

            ctx.fillStyle = bc.bg;
            this.roundRect(ctx, px + 1, py + 1, pw - 2, ph - 2, 3);
            ctx.fill();

            ctx.fillStyle = bc.fg;
            this.roundRect(ctx, px + 3, py + 3, pw - 6, ph - 6, 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(px + 4, py + 3, pw - 8, Math.max(2, ph * 0.15));

            if (b.active) {
                var glowPulse = 0.08 + Math.sin(this.time * 3 + b.id) * 0.04;
                ctx.fillStyle = 'rgba(255,255,200,' + glowPulse + ')';
                this.roundRect(ctx, px + 3, py + 3, pw - 6, ph - 6, 2);
                ctx.fill();

                ctx.shadowColor = 'rgba(255,220,100,0.15)';
                ctx.shadowBlur = 6;
                ctx.strokeStyle = 'rgba(255,220,100,0.2)';
                ctx.lineWidth = 1;
                this.roundRect(ctx, px + 1, py + 1, pw - 2, ph - 2, 3);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            if (def.powerDraw > 0 && Game.power.satisfaction < 1) {
                var dimAlpha = 0.3 * (1 - Game.power.satisfaction);
                ctx.fillStyle = 'rgba(0,0,0,' + dimAlpha + ')';
                this.roundRect(ctx, px + 1, py + 1, pw - 2, ph - 2, 3);
                ctx.fill();
                if (Game.power.satisfaction < 0.5) {
                    var flash = 0.08 + Math.sin(this.time * 6) * 0.04;
                    ctx.fillStyle = 'rgba(255,50,50,' + flash + ')';
                    this.roundRect(ctx, px + 1, py + 1, pw - 2, ph - 2, 3);
                    ctx.fill();
                }
            }

            if (def.icon && Camera.zoom > 0.4) {
                var iconChar = def.icon;
                if (b.type === 'underground_belt' && b.ugMode === 'out') iconChar = '⤴';
                var iconSize = Math.min(22, t * 0.5 * Math.min(w, h));
                ctx.font = iconSize + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(iconChar, px + pw/2, py + ph/2);
            } else if (bc.label && Camera.zoom > 0.5) {
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.font = 'bold ' + Math.min(14, t * 0.4 * Math.min(w, h)) + 'px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(bc.label, px + pw/2 + 1, py + ph/2 + 1);
                ctx.fillStyle = '#fff';
                ctx.fillText(bc.label, px + pw/2, py + ph/2);
            }

            if (b.progress > 0 && b.progress < 1) {
                var barW = pw - 8;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                this.roundRect(ctx, px + 4, py + ph - 7, barW, 5, 2);
                ctx.fill();
                ctx.fillStyle = CFG.COLORS.accent;
                if (barW * b.progress > 4) {
                    this.roundRect(ctx, px + 4, py + ph - 7, barW * b.progress, 5, 2);
                    ctx.fill();
                }
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.fillRect(px + 5, py + ph - 7, Math.max(1, barW * b.progress - 2), 1);
            }

            if (b.type === 'inserter') {
                this.drawInserter(ctx, b, t);
            }

            if (b.type === 'underground_belt') {
                this.drawUnderground(ctx, b, t);
            }

            if (b.depleted) {
                var dBlink = 0.5 + Math.sin(this.time * 5) * 0.5;
                ctx.globalAlpha = Math.max(0.25, dBlink);
                ctx.font = '14px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('⚠', px + pw/2, py + 9);
                ctx.globalAlpha = 1;
            }

            if (b.active && Camera.zoom > 0.6) {
                this.drawWorkingAnimation(ctx, b, px, py, pw, ph);
            }

            if (b.direction !== undefined && b.type !== 'inserter') {
                var d = CFG.DIRECTIONS[b.direction];
                var cx = px + pw/2, cy = py + ph/2;
                var arrowSize = Math.min(w, h) * t * 0.13;
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                ctx.moveTo(cx + d.dx * arrowSize * 2.2 + 1, cy + d.dy * arrowSize * 2.2 + 1);
                ctx.lineTo(cx + d.dy * arrowSize - d.dx * arrowSize * 0.5 + 1, cy - d.dx * arrowSize - d.dy * arrowSize * 0.5 + 1);
                ctx.lineTo(cx - d.dy * arrowSize - d.dx * arrowSize * 0.5 + 1, cy + d.dx * arrowSize - d.dy * arrowSize * 0.5 + 1);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.55)';
                ctx.beginPath();
                ctx.moveTo(cx + d.dx * arrowSize * 2.2, cy + d.dy * arrowSize * 2.2);
                ctx.lineTo(cx + d.dy * arrowSize - d.dx * arrowSize * 0.5, cy - d.dx * arrowSize - d.dy * arrowSize * 0.5);
                ctx.lineTo(cx - d.dy * arrowSize - d.dx * arrowSize * 0.5, cy + d.dx * arrowSize - d.dy * arrowSize * 0.5);
                ctx.closePath();
                ctx.fill();
            }

            if (b.type === 'rocket_silo' && b.rocketParts > 0) {
                var rBarW = pw - 12;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                this.roundRect(ctx, px + 6, py + 6, rBarW, 10, 3);
                ctx.fill();

                var rFill = rBarW * (b.rocketParts / 100);
                if (rFill > 6) {
                    var rGrad = ctx.createLinearGradient(px + 6, 0, px + 6 + rFill, 0);
                    rGrad.addColorStop(0, '#2288cc');
                    rGrad.addColorStop(1, '#44ddff');
                    ctx.fillStyle = rGrad;
                    this.roundRect(ctx, px + 6, py + 6, rFill, 10, 3);
                    ctx.fill();
                }

                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.fillRect(px + 7, py + 7, Math.max(1, rFill - 2), 2);

                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.font = 'bold 8px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(b.rocketParts + '/100', px + pw/2 + 1, py + 14);
                ctx.fillStyle = '#fff';
                ctx.fillText(b.rocketParts + '/100', px + pw/2, py + 13);
            }

            if (hasPlaceAnim) ctx.restore();
        }
    },

    drawRocketAnim: function(ctx, dt) {
        var a = Game.rocketAnim;
        a.t += dt;
        if (a.t >= a.dur) { Game.rocketAnim = null; return; }

        var rise = 140 * a.t * a.t;
        var rx = a.x, ry = a.y - rise;
        var alpha = a.t > 2.2 ? Math.max(0, 1 - (a.t - 2.2) / 0.8) : 1;

        ctx.globalAlpha = alpha;

        // Llama parpadeante
        var flameLen = 12 + Math.sin(this.time * 40) * 5;
        ctx.fillStyle = (Math.floor(this.time * 30) % 2) ? '#ffaa33' : '#ff6622';
        ctx.beginPath();
        ctx.moveTo(rx - 5, ry + 18);
        ctx.lineTo(rx + 5, ry + 18);
        ctx.lineTo(rx, ry + 18 + flameLen);
        ctx.closePath();
        ctx.fill();

        // Fuselaje
        ctx.fillStyle = '#dde2ea';
        this.roundRect(ctx, rx - 7, ry - 18, 14, 36, 5);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(rx + 2, ry - 14, 4, 28);

        // Cono
        ctx.fillStyle = '#ee7733';
        ctx.beginPath();
        ctx.moveTo(rx - 7, ry - 16);
        ctx.lineTo(rx + 7, ry - 16);
        ctx.lineTo(rx, ry - 30);
        ctx.closePath();
        ctx.fill();

        // Aletas
        ctx.fillStyle = '#bb5522';
        ctx.beginPath();
        ctx.moveTo(rx - 7, ry + 18);
        ctx.lineTo(rx - 13, ry + 22);
        ctx.lineTo(rx - 7, ry + 8);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(rx + 7, ry + 18);
        ctx.lineTo(rx + 13, ry + 22);
        ctx.lineTo(rx + 7, ry + 8);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = 1;

        // Humo y chispas durante el ascenso inicial
        if (a.t < 2) {
            if (Math.random() < 0.5) {
                Particles.spawn(rx + (Math.random() - 0.5) * 20, ry + 24, 'smoke');
            }
            if (Math.random() < 0.3) {
                Particles.spawn(rx, ry + 24, 'spark');
            }
        }
    },

    // Animaciones de edificios trabajando. Sin shadowBlur ni gradientes por frame.
    // Fase por b.id para desincronizar edificios del mismo tipo.
    drawWorkingAnimation: function(ctx, b, px, py, pw, ph) {
        var time = this.time;

        if (b.type === 'miner' || b.type === 'electric_miner') {
            // Broca giratoria con vibración
            var mcx = px + pw/2;
            var mcy = py + ph/2 + 6 + Math.sin(time * 30) * 0.5;
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(mcx, mcy, 6, 0, Math.PI * 2);
            ctx.fill();
            var ang = time * 6 + b.id;
            ctx.strokeStyle = '#ccc';
            ctx.lineWidth = 2;
            for (var k = 0; k < 3; k++) {
                var a = ang + k * 2.094;
                ctx.beginPath();
                ctx.moveTo(mcx, mcy);
                ctx.lineTo(mcx + Math.cos(a) * 6, mcy + Math.sin(a) * 6);
                ctx.stroke();
            }
        } else if (b.type === 'furnace') {
            // Resplandor pulsante + boca brillante + chispas ocasionales
            var glow = 0.12 + Math.sin(time * 5 + b.id) * 0.08;
            ctx.fillStyle = 'rgba(255,110,30,' + glow.toFixed(3) + ')';
            this.roundRect(ctx, px + 3, py + 3, pw - 6, ph - 6, 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,200,80,' + (glow * 2).toFixed(3) + ')';
            ctx.fillRect(px + pw * 0.3, py + ph - 8, pw * 0.4, 4);
            if (Math.random() < 0.025) {
                Particles.spawn(px + pw/2, py + ph - 6, 'spark');
            }
        } else if (b.type === 'assembler') {
            // Engranaje girando en esquina superior derecha
            ctx.save();
            ctx.translate(px + pw - 12, py + 12);
            ctx.rotate(time * 2 + b.id);
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.stroke();
            for (var k2 = 0; k2 < 6; k2++) {
                var a2 = k2 * 1.047;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a2) * 5, Math.sin(a2) * 5);
                ctx.lineTo(Math.cos(a2) * 8, Math.sin(a2) * 8);
                ctx.stroke();
            }
            ctx.restore();
        } else if (b.type === 'lab') {
            // Burbujas ascendentes sin estado
            for (var k3 = 0; k3 < 3; k3++) {
                var frac = (time * 0.5 + k3 * 0.33 + (b.id % 7) * 0.1) % 1;
                var bx = px + pw * (0.3 + k3 * 0.2);
                var by = py + ph - 8 - frac * (ph - 16);
                ctx.fillStyle = 'rgba(170,120,255,' + ((1 - frac) * 0.6).toFixed(3) + ')';
                ctx.beginPath();
                ctx.arc(bx, by, 1.5 + frac * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (b.type === 'steam_engine') {
            // Pistón oscilante
            var stroke2 = Math.sin(time * 8 + b.id) * 4;
            ctx.fillStyle = '#99aabb';
            ctx.fillRect(px + pw/2 - 4, py + ph * 0.55 + stroke2, 8, 12);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(px + pw/2 - 6, py + ph * 0.55 - 6, 12, 3);
        }
    },

    drawInserter: function(ctx, b, t) {
        var d = CFG.DIRECTIONS[b.direction];
        var cx = b.x * t + t/2;
        var cy = b.y * t + t/2;
        var armLen = t * 0.85;
        var swing = b.active ? Math.sin(this.time * 4 + b.id) * 0.2 : 0;
        var reach = 0.4 + swing;

        ctx.strokeStyle = '#666633';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - d.dx * armLen * 0.35, cy - d.dy * armLen * 0.35);
        ctx.lineTo(cx + d.dx * armLen * reach, cy + d.dy * armLen * reach);
        ctx.stroke();

        ctx.strokeStyle = '#aaaa55';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - d.dx * armLen * 0.35, cy - d.dy * armLen * 0.35);
        ctx.lineTo(cx + d.dx * armLen * reach, cy + d.dy * armLen * reach);
        ctx.stroke();

        ctx.fillStyle = '#dddd77';
        ctx.beginPath();
        ctx.arc(cx + d.dx * armLen * reach, cy + d.dy * armLen * reach, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#555533';
        ctx.beginPath();
        ctx.arc(cx - d.dx * armLen * 0.35, cy - d.dy * armLen * 0.35, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#888855';
        ctx.beginPath();
        ctx.arc(cx - d.dx * armLen * 0.35, cy - d.dy * armLen * 0.35, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineCap = 'butt';

        // Punto de color si tiene filtro configurado
        if (b.filterItem) {
            var fc = Items.color(b.filterItem);
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(cx, cy + t * 0.3, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = fc;
            ctx.beginPath();
            ctx.arc(cx, cy + t * 0.3, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    drawUnderground: function(ctx, b, t) {
        var d = CFG.DIRECTIONS[b.direction];
        var px = b.x * t, py = b.y * t;
        var cx = px + t/2, cy = py + t/2;

        // Boca del túnel: lado frontal para entrada, trasero para salida
        var sign = b.ugMode === 'in' ? 1 : -1;
        var mx = cx + d.dx * sign * t * 0.28;
        var my = cy + d.dy * sign * t * 0.28;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.arc(mx, my, t * 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Aviso si no está emparejado
        if (b.pairId === null || b.pairId === undefined) {
            var blink = 0.5 + Math.sin(this.time * 5) * 0.4;
            ctx.globalAlpha = Math.max(0.2, blink);
            ctx.fillStyle = '#ff5050';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('!', px + t - 6, py + 7);
            ctx.globalAlpha = 1;
        }
    },

    drawBelts: function() {
        var ctx = this.ctx;
        var bounds = Camera.getVisibleBounds();
        var t = CFG.TILE;
        var off = this.animOffset;
        var PI = Math.PI;
        var vc = Camera.getVisibleChunks();
        var list = World.getBuildingsInChunkRange(vc.minCX, vc.minCY, vc.maxCX, vc.maxCY);

        for (var i = 0; i < list.length; i++) {
            var b = list[i];
            if (b.type !== 'belt' && b.type !== 'fast_belt') continue;
            if (b.x < bounds.minX - 1 || b.x > bounds.maxX + 1) continue;
            if (b.y < bounds.minY - 1 || b.y > bounds.maxY + 1) continue;

            var px = b.x * t, py = b.y * t;
            var d = CFG.DIRECTIONS[b.direction];
            var margin = 3;
            var isFast = b.type === 'fast_belt';

            ctx.fillStyle = isFast ? '#665522' : '#554418';
            ctx.fillRect(px, py, t, t);

            var cornerIn = -1;
            var behindX = b.x - d.dx, behindY = b.y - d.dy;
            var behindB = World.getBuildingAt(behindX, behindY);
            var hasStraight = behindB && !behindB.removed &&
                (behindB.type === 'belt' || behindB.type === 'fast_belt') &&
                behindB.direction === b.direction;

            if (!hasStraight) {
                var perpDirs = d.dx !== 0 ? [0, 2] : [1, 3];
                for (var p = 0; p < 2; p++) {
                    var pd = perpDirs[p];
                    var pDir = CFG.DIRECTIONS[pd];
                    var fb = World.getBuildingAt(b.x - pDir.dx, b.y - pDir.dy);
                    if (fb && !fb.removed &&
                        (fb.type === 'belt' || fb.type === 'fast_belt') &&
                        fb.direction === pd) {
                        cornerIn = pd;
                        break;
                    }
                }
            }

            if (cornerIn >= 0) {
                var inD = CFG.DIRECTIONS[cornerIn];
                var cx, cy;
                if (inD.dx !== 0) {
                    cx = px + (inD.dx > 0 ? 0 : t);
                    cy = py + (d.dy > 0 ? t : 0);
                } else {
                    cx = px + (d.dx > 0 ? t : 0);
                    cy = py + (inD.dy > 0 ? 0 : t);
                }

                var ex1 = inD.dx !== 0 ? (px + (inD.dx > 0 ? 0 : t)) : (px + t * 0.5);
                var ey1 = inD.dy !== 0 ? (py + (inD.dy > 0 ? 0 : t)) : (py + t * 0.5);
                var ex2 = d.dx !== 0 ? (px + (d.dx > 0 ? t : 0)) : (px + t * 0.5);
                var ey2 = d.dy !== 0 ? (py + (d.dy > 0 ? t : 0)) : (py + t * 0.5);

                var sa = Math.atan2(ey1 - cy, ex1 - cx);
                var ea = Math.atan2(ey2 - cy, ex2 - cx);
                var acw = ((b.direction - cornerIn + 4) % 4 === 3);

                ctx.lineCap = 'butt';
                ctx.lineWidth = t - margin * 2;
                ctx.strokeStyle = isFast ? '#bb9933' : '#99882e';
                ctx.beginPath();
                ctx.arc(cx, cy, t * 0.5, sa, ea, acw);
                ctx.stroke();

                ctx.lineWidth = t - margin * 2 - 2;
                ctx.strokeStyle = isFast ? '#ddcc55' : '#bbaa44';
                ctx.beginPath();
                ctx.arc(cx, cy, t * 0.5, sa, ea, acw);
                ctx.stroke();

                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(255,255,255,0.06)';
                ctx.beginPath();
                ctx.arc(cx, cy, margin + 0.5, sa, ea, acw);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.beginPath();
                ctx.arc(cx, cy, t - margin - 0.5, sa, ea, acw);
                ctx.stroke();

                var arrowCount = isFast ? 5 : 3;
                ctx.fillStyle = isFast ? 'rgba(100,80,30,0.4)' : 'rgba(80,60,20,0.35)';
                var sweep;
                if (acw) {
                    sweep = sa - ea;
                    if (sweep < 0) sweep += PI * 2;
                } else {
                    sweep = ea - sa;
                    if (sweep < 0) sweep += PI * 2;
                }
                for (var a = 0; a < arrowCount; a++) {
                    var frac = ((a / arrowCount) + off) % 1;
                    var af = acw ? sa - sweep * frac : sa + sweep * frac;
                    var ax = cx + Math.cos(af) * t * 0.5;
                    var ay = cy + Math.sin(af) * t * 0.5;
                    var tdx = acw ? Math.sin(af) : -Math.sin(af);
                    var tdy = acw ? -Math.cos(af) : Math.cos(af);
                    var as = 2.5;
                    ctx.beginPath();
                    ctx.moveTo(ax + tdx * as * 1.2, ay + tdy * as * 1.2);
                    ctx.lineTo(ax + tdy * as * 0.6, ay - tdx * as * 0.6);
                    ctx.lineTo(ax - tdy * as * 0.6, ay + tdx * as * 0.6);
                    ctx.closePath();
                    ctx.fill();
                }
            } else {
                if (d.dx !== 0) {
                    ctx.fillStyle = isFast ? '#bb9933' : '#99882e';
                    ctx.fillRect(px, py + margin, t, t - margin * 2);
                    ctx.fillStyle = isFast ? '#ddcc55' : '#bbaa44';
                    ctx.fillRect(px, py + margin + 1, t, t - margin * 2 - 2);

                    ctx.fillStyle = 'rgba(255,255,255,0.06)';
                    ctx.fillRect(px, py + margin + 1, t, 1);
                    ctx.fillStyle = 'rgba(0,0,0,0.1)';
                    ctx.fillRect(px, py + t - margin - 1, t, 1);

                    var topN = World.getBuildingAt(b.x, b.y - 1);
                    if (topN && (topN.type === 'belt' || topN.type === 'fast_belt') && topN.direction === 2) {
                        ctx.fillStyle = isFast ? '#bb9933' : '#99882e';
                        ctx.fillRect(px + margin, py, t - margin * 2, margin + 1);
                        ctx.fillStyle = isFast ? '#ddcc55' : '#bbaa44';
                        ctx.fillRect(px + margin + 1, py, t - margin * 2 - 2, margin + 2);
                    }
                    var botN = World.getBuildingAt(b.x, b.y + 1);
                    if (botN && (botN.type === 'belt' || botN.type === 'fast_belt') && botN.direction === 0) {
                        ctx.fillStyle = isFast ? '#bb9933' : '#99882e';
                        ctx.fillRect(px + margin, py + t - margin - 1, t - margin * 2, margin + 1);
                        ctx.fillStyle = isFast ? '#ddcc55' : '#bbaa44';
                        ctx.fillRect(px + margin + 1, py + t - margin - 2, t - margin * 2 - 2, margin + 2);
                    }
                } else {
                    ctx.fillStyle = isFast ? '#bb9933' : '#99882e';
                    ctx.fillRect(px + margin, py, t - margin * 2, t);
                    ctx.fillStyle = isFast ? '#ddcc55' : '#bbaa44';
                    ctx.fillRect(px + margin + 1, py, t - margin * 2 - 2, t);

                    ctx.fillStyle = 'rgba(255,255,255,0.06)';
                    ctx.fillRect(px + margin + 1, py, 1, t);
                    ctx.fillStyle = 'rgba(0,0,0,0.1)';
                    ctx.fillRect(px + t - margin - 1, py, 1, t);

                    var leftN = World.getBuildingAt(b.x - 1, b.y);
                    if (leftN && (leftN.type === 'belt' || leftN.type === 'fast_belt') && leftN.direction === 1) {
                        ctx.fillStyle = isFast ? '#bb9933' : '#99882e';
                        ctx.fillRect(px, py + margin, margin + 1, t - margin * 2);
                        ctx.fillStyle = isFast ? '#ddcc55' : '#bbaa44';
                        ctx.fillRect(px, py + margin + 1, margin + 2, t - margin * 2 - 2);
                    }
                    var rightN = World.getBuildingAt(b.x + 1, b.y);
                    if (rightN && (rightN.type === 'belt' || rightN.type === 'fast_belt') && rightN.direction === 3) {
                        ctx.fillStyle = isFast ? '#bb9933' : '#99882e';
                        ctx.fillRect(px + t - margin - 1, py + margin, margin + 1, t - margin * 2);
                        ctx.fillStyle = isFast ? '#ddcc55' : '#bbaa44';
                        ctx.fillRect(px + t - margin - 2, py + margin + 1, margin + 2, t - margin * 2 - 2);
                    }
                }

                var arrowCount2 = isFast ? 5 : 3;
                ctx.fillStyle = isFast ? 'rgba(100,80,30,0.4)' : 'rgba(80,60,20,0.35)';
                for (var a2 = 0; a2 < arrowCount2; a2++) {
                    var frac2 = ((a2 / arrowCount2) + off) % 1;
                    var ax2 = px + t * 0.5 + d.dx * (frac2 - 0.5) * t * 0.75;
                    var ay2 = py + t * 0.5 + d.dy * (frac2 - 0.5) * t * 0.75;
                    var as2 = 2.5;
                    ctx.beginPath();
                    ctx.moveTo(ax2 + d.dx * as2 * 1.2, ay2 + d.dy * as2 * 1.2);
                    ctx.lineTo(ax2 + d.dy * as2 * 0.6, ay2 - d.dx * as2 * 0.6);
                    ctx.lineTo(ax2 - d.dy * as2 * 0.6, ay2 + d.dx * as2 * 0.6);
                    ctx.closePath();
                    ctx.fill();
                }
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

                var bounds = Camera.getVisibleBounds();
                var t = CFG.TILE;
                if (p.x < bounds.minX * t - t || p.x > (bounds.maxX + 1) * t + t) continue;
                if (p.y < bounds.minY * t - t || p.y > (bounds.maxY + 1) * t + t) continue;

                var ic = Items.color(p.type);

                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                ctx.beginPath();
                ctx.arc(p.x + 0.7, p.y + 0.7, 4.5, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = ic;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.beginPath();
                ctx.arc(p.x - 1.2, p.y - 1.2, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    },

    drawGhosts: function() {
        var ctx = this.ctx;
        var t = CFG.TILE;

        if (Input.buildMode && !Input.isBeltMode()) {
            var def = CFG.BUILDING_DEFS[Input.buildMode];
            if (!def) return;
            var tile = Input.mouse.tile;
            var w = def.size[0], h = def.size[1];
            var canPlace = World.canPlace(tile.x, tile.y, w, h);
            if (Input.buildMode === 'miner') canPlace = canPlace && World.hasResource(tile.x, tile.y, w, h);

            ctx.globalAlpha = 0.5;
            ctx.fillStyle = canPlace ? 'rgba(0,220,80,0.2)' : 'rgba(220,0,40,0.2)';
            this.roundRect(ctx, tile.x * t, tile.y * t, w * t, h * t, 4);
            ctx.fill();

            ctx.strokeStyle = canPlace ? 'rgba(0,220,80,0.6)' : 'rgba(220,0,40,0.6)';
            ctx.lineWidth = 2;
            this.roundRect(ctx, tile.x * t + 1, tile.y * t + 1, w * t - 2, h * t - 2, 4);
            ctx.stroke();

            var bc = CFG.COLORS.buildings[Input.buildMode];
            if (bc) {
                ctx.fillStyle = bc.fg;
                this.roundRect(ctx, tile.x * t + 4, tile.y * t + 4, w * t - 8, h * t - 8, 2);
                ctx.fill();
            }

            if (def.icon) {
                ctx.globalAlpha = 0.7;
                ctx.font = Math.min(20, t * 0.45 * Math.min(w, h)) + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(def.icon, tile.x * t + w * t / 2, tile.y * t + h * t / 2 - 2);
            }

            if (Input.buildMode === 'miner' || Input.buildMode === 'electric_miner') {
                var resType = World.getResourceType(tile.x, tile.y, w, h);
                if (resType) {
                    var rn = ITEM_NAMES[resType] || resType;
                    ctx.globalAlpha = 0.9;
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(rn, tile.x * t + w * t / 2 + 1, tile.y * t + h * t - 1);
                    ctx.fillStyle = '#fff';
                    ctx.fillText(rn, tile.x * t + w * t / 2, tile.y * t + h * t - 2);
                }
            }

            ctx.globalAlpha = 0.5;
            var gd = CFG.DIRECTIONS[Input.buildDirection];
            var gcx = tile.x * t + w * t / 2, gcy = tile.y * t + h * t / 2;
            var gas = Math.min(w, h) * t * 0.13;
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.beginPath();
            ctx.moveTo(gcx + gd.dx * gas * 2.2, gcy + gd.dy * gas * 2.2);
            ctx.lineTo(gcx + gd.dy * gas - gd.dx * gas * 0.5, gcy - gd.dx * gas - gd.dy * gas * 0.5);
            ctx.lineTo(gcx - gd.dy * gas - gd.dx * gas * 0.5, gcy + gd.dx * gas - gd.dy * gas * 0.5);
            ctx.closePath();
            ctx.fill();

            ctx.globalAlpha = 1;
        }

        if (Input.isBeltMode()) {
            if (Input.ghostTiles.length > 0) {
                for (var i = 0; i < Input.ghostTiles.length; i++) {
                    var g = Input.ghostTiles[i];
                    var exists = World.getBuildingAt(g.x, g.y);
                    ctx.globalAlpha = 0.55;
                    if (exists) {
                        ctx.fillStyle = 'rgba(220,0,40,0.3)';
                    } else {
                        ctx.fillStyle = Input.buildMode === 'fast_belt' ? '#ddcc55' : '#bbaa44';
                    }
                    this.roundRect(ctx, g.x * t + 1, g.y * t + 1, t - 2, t - 2, 2);
                    ctx.fill();
                    if (!exists) {
                        var gd2 = CFG.DIRECTIONS[g.dir !== undefined ? g.dir : Input.buildDirection];
                        if (!gd2) { ctx.globalAlpha = 1; continue; }
                        ctx.fillStyle = 'rgba(80,60,20,0.5)';
                        var gcx2 = g.x * t + t/2, gcy2 = g.y * t + t/2;
                        ctx.beginPath();
                        ctx.moveTo(gcx2 + gd2.dx * 5, gcy2 + gd2.dy * 5);
                        ctx.lineTo(gcx2 + gd2.dy * 3, gcy2 - gd2.dx * 3);
                        ctx.lineTo(gcx2 - gd2.dy * 3, gcy2 + gd2.dx * 3);
                        ctx.closePath();
                        ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                }
            } else {
                var tile2 = Input.mouse.tile;
                ctx.globalAlpha = 0.55;
                ctx.fillStyle = Input.buildMode === 'fast_belt' ? '#ddcc55' : '#bbaa44';
                this.roundRect(ctx, tile2.x * t + 1, tile2.y * t + 1, t - 2, t - 2, 2);
                ctx.fill();

                var d = CFG.DIRECTIONS[Input.buildDirection];
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                var cx2 = tile2.x * t + t/2, cy2 = tile2.y * t + t/2;
                ctx.beginPath();
                ctx.moveTo(cx2 + d.dx * 8, cy2 + d.dy * 8);
                ctx.lineTo(cx2 + d.dy * 5, cy2 - d.dx * 5);
                ctx.lineTo(cx2 - d.dy * 5, cy2 + d.dx * 5);
                ctx.closePath();
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
    },

    roundRect: function(ctx, x, y, w, h, r) {
        if (w < r * 2) r = w / 2;
        if (h < r * 2) r = h / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    },

    drawSelection: function() {
        var ctx = this.ctx;
        var t = CFG.TILE;
        var b = Input.selectedBuilding;
        if (!b || b.removed) return;

        var def = CFG.BUILDING_DEFS[b.type];
        var w = def.size[0], h = def.size[1];
        var px = b.x * t, py = b.y * t;

        var pulse = 0.5 + Math.sin(this.time * 4) * 0.3;
        ctx.shadowColor = 'rgba(230,168,50,' + pulse * 0.5 + ')';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = 'rgba(230,168,50,' + (0.6 + pulse * 0.4) + ')';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.lineDashOffset = -this.time * 20;
        this.roundRect(ctx, px - 1, py - 1, w * t + 2, h * t + 2, 4);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
    },

    drawMinimap: function(ctx, w, h) {
        var mmSize = 120;
        var mmX = 8, mmY = h - mmSize - 70;
        var mmScale = 0.5;
        var t = CFG.TILE;
        this.minimapRect = {x: mmX, y: mmY, size: mmSize, scale: mmScale};

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(mmX, mmY, mmSize, mmSize);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(mmX, mmY, mmSize, mmSize);

        var centerTX = Math.floor((Camera.x + Camera.vw / Camera.zoom / 2) / t);
        var centerTY = Math.floor((Camera.y + Camera.vh / Camera.zoom / 2) / t);

        var cc = CFG.CHUNK;
        var centerCX = Math.floor(centerTX / cc), centerCY = Math.floor(centerTY / cc);
        var cr = Math.ceil((mmSize / 2) / mmScale / cc) + 1;
        var list = World.getBuildingsInChunkRange(centerCX - cr, centerCY - cr, centerCX + cr, centerCY + cr);

        for (var i = 0; i < list.length; i++) {
            var b = list[i];
            var rx = (b.x - centerTX) * mmScale + mmSize / 2;
            var ry = (b.y - centerTY) * mmScale + mmSize / 2;
            if (rx < 0 || rx > mmSize || ry < 0 || ry > mmSize) continue;
            var bc = CFG.COLORS.buildings[b.type];
            ctx.fillStyle = bc ? bc.fg : '#888';
            var bDef = CFG.BUILDING_DEFS[b.type];
            var bw = bDef ? bDef.size[0] * mmScale : mmScale;
            var bh = bDef ? bDef.size[1] * mmScale : mmScale;
            ctx.fillRect(mmX + rx, mmY + ry, Math.max(1, bw), Math.max(1, bh));
        }

        var vpW = (Camera.vw / Camera.zoom / t) * mmScale;
        var vpH = (Camera.vh / Camera.zoom / t) * mmScale;
        ctx.strokeStyle = '#e6a832';
        ctx.lineWidth = 1;
        ctx.strokeRect(mmX + mmSize / 2 - vpW / 2, mmY + mmSize / 2 - vpH / 2, vpW, vpH);
    }
};
