var Renderer = {
    canvas: null,
    ctx: null,
    animOffset: 0,
    time: 0,
    frameNow: 0,
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
        this.frameNow = performance.now();
        this.frameCount++;
        if (this.frameCount % 300 === 0) this.evictChunkCanvases();

        // Ciclo día/noche ambiental. Offset de medio ciclo: time=0 arranca a mediodía
        // (luz plena), no a medianoche, para no recibir al jugador a oscuras.
        var dayPhase = ((this.time + this.DAY_LENGTH * 0.5) % this.DAY_LENGTH) / this.DAY_LENGTH;
        var light = (Math.sin(dayPhase * Math.PI * 2 - Math.PI / 2) + 1) / 2;
        this.nightFactor = Math.max(0, (0.55 - light) / 0.55); // 0 de día, ~1 noche cerrada
        // Calidez de amanecer/atardecer: pico en la banda de transición (luz ~0.4)
        this.duskFactor = Math.max(0, 1 - Math.abs(light - 0.4) * 4);

        // Fondo con gradiente radial sutil (profundidad) en vez de relleno plano
        this.drawBackground(ctx, w, h);

        var shake = Camera.getShakeOffset(dt);
        ctx.save();
        ctx.translate(-Camera.x * Camera.zoom + (shake ? shake.x : 0),
                      -Camera.y * Camera.zoom + (shake ? shake.y : 0));
        ctx.scale(Camera.zoom, Camera.zoom);

        this.drawTerrain();
        this.drawCloudShadows();
        this.drawResourceLabels();
        this.drawResourceHighlight();
        this.drawGrid();
        this.drawBelts();
        this.drawBuildings();
        this.drawBeltItems();
        if (Game.rocketAnim) this.drawRocketAnim(ctx, dt);
        this.drawRangeOverlay();
        this.drawGhosts();
        this.drawDemolitionPreview();
        this.drawSelection();

        ctx.restore();

        this.applyDayNight(ctx, w, h);
        this.drawVignette(ctx, w, h);

        // Fogonazo de pantalla (lanzamiento de cohete u otros clímax)
        if (this.flash > 0.01) {
            ctx.fillStyle = 'rgba(255,250,235,' + (this.flash * 0.7).toFixed(3) + ')';
            ctx.fillRect(0, 0, w, h);
            this.flash -= dt * 1.8;
            if (this.flash < 0) this.flash = 0;
        }

        Particles.render(ctx);
        this.drawDust(ctx, w, h);
        this.drawMinimap(ctx, w, h);
    },

    // Sombras de nubes a la deriva (mundo): elipses radiales suaves, se atenúan de noche
    drawCloudShadows: function() {
        var sun = 1 - this.nightFactor;
        if (sun <= 0.05) return;
        var ctx = this.ctx, t = CFG.TILE, b = Camera.getVisibleBounds();
        var CELL = 520;
        var driftX = this.time * 9, driftY = this.time * 4;
        var minWX = b.minX * t, maxWX = (b.maxX + 1) * t, minWY = b.minY * t, maxWY = (b.maxY + 1) * t;
        var c0x = Math.floor((minWX - driftX) / CELL) - 1, c1x = Math.floor((maxWX - driftX) / CELL) + 1;
        var c0y = Math.floor((minWY - driftY) / CELL) - 1, c1y = Math.floor((maxWY - driftY) / CELL) + 1;
        var alpha = 0.08 * sun;
        for (var cy = c0y; cy <= c1y; cy++) {
            for (var cx = c0x; cx <= c1x; cx++) {
                var h = World.hash2d(cx * 3 + 1, cy * 7 + 2);
                var pxc = cx * CELL + driftX + h * 200;
                var pyc = cy * CELL + driftY + World.hash2d(cx * 5, cy * 3) * 200;
                var r = 150 + h * 130;
                var g = ctx.createRadialGradient(pxc, pyc, 0, pxc, pyc, r);
                g.addColorStop(0, 'rgba(0,0,18,' + alpha.toFixed(3) + ')');
                g.addColorStop(1, 'rgba(0,0,18,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.ellipse(pxc, pyc, r, r * 0.62, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    },

    // Motas de polvo flotando (espacio de pantalla): atmósfera ambiental barata
    drawDust: function(ctx, w, h) {
        var n = 14;
        ctx.fillStyle = 'rgba(255,250,220,0.35)';
        for (var i = 0; i < n; i++) {
            var sx = World.hash2d(i * 17 + 1, 3) * w;
            var sy = World.hash2d(i * 13 + 5, 9) * h;
            var spd = 6 + (i % 5) * 4;
            var x = (sx + this.time * spd) % (w + 40) - 20;
            var y = (sy + this.time * spd * 0.4 + Math.sin(this.time * 0.6 + i) * 12) % (h + 40) - 20;
            var a = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(this.time * 1.3 + i * 2));
            ctx.globalAlpha = a;
            ctx.beginPath();
            ctx.arc(x, y, 1 + (i % 3) * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    },

    flash: 0,

    DAY_LENGTH: 150, // segundos por ciclo completo día→noche→día
    nightFactor: 0,
    duskFactor: 0,

    // Tipos sin E/S direccional: no dibujar la flecha (inserter se dibuja aparte)
    NO_ARROW: {inserter:1, storage:1, solar_panel:1, accumulator:1, steam_engine:1, lab:1},

    drawBackground: function(ctx, w, h) {
        // Gradiente cacheado (solo cambia al redimensionar)
        if (!this._bgGrad || this._gradW !== w || this._gradH !== h) this.buildScreenGradients(ctx, w, h);
        ctx.fillStyle = this._bgGrad;
        ctx.fillRect(0, 0, w, h);
    },

    buildScreenGradients: function(ctx, w, h) {
        var R = Math.max(w, h);
        var bg = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, R * 0.75);
        bg.addColorStop(0, '#1b1d33');
        bg.addColorStop(1, '#0c0d18');
        this._bgGrad = bg;
        var vg = ctx.createRadialGradient(w/2, h/2, R * 0.35, w/2, h/2, R * 0.72);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,10,0.38)');
        this._vigGrad = vg;
        this._gradW = w; this._gradH = h;
    },

    // Tinte global día/noche: oscurece de noche, baña de cálido al amanecer/atardecer
    applyDayNight: function(ctx, w, h) {
        if (this.nightFactor > 0.01) {
            ctx.fillStyle = 'rgba(14,22,54,' + (this.nightFactor * 0.42).toFixed(3) + ')';
            ctx.fillRect(0, 0, w, h);
        }
        if (this.duskFactor > 0.01) {
            ctx.fillStyle = 'rgba(255,140,55,' + (this.duskFactor * 0.15).toFixed(3) + ')';
            ctx.fillRect(0, 0, w, h);
        }
    },

    drawVignette: function(ctx, w, h) {
        if (!this._vigGrad || this._gradW !== w || this._gradH !== h) this.buildScreenGradients(ctx, w, h);
        ctx.fillStyle = this._vigGrad;
        ctx.fillRect(0, 0, w, h);
    },

    // Aclara (amt>0) u oscurece (amt<0) un color hex #rrggbb
    shade: function(hex, amt) {
        var n = parseInt(hex.slice(1), 16);
        var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
        else { r *= (1 + amt); g *= (1 + amt); b *= (1 + amt); }
        return 'rgb(' + (r|0) + ',' + (g|0) + ',' + (b|0) + ')';
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
                    // Espuma de orilla: banda clara hacia los vecinos de tierra
                    var edges = [[0,-1,px,py,t,3],[0,1,px,py+t-3,t,3],[-1,0,px,py,3,t],[1,0,px+t-3,py,3,t]];
                    for (var ne = 0; ne < 4; ne++) {
                        var nt = World.getTile(tx + edges[ne][0], ty + edges[ne][1]);
                        if (nt.terrain !== 'water') {
                            ctx.fillStyle = 'rgba(150,205,235,0.40)';
                            ctx.fillRect(edges[ne][2], edges[ne][3], edges[ne][4], edges[ne][5]);
                        }
                    }
                    waterTiles.push({tx: tx, ty: ty});
                } else if (tile.terrain === 'sand') {
                    ctx.fillStyle = colors.sand;
                    ctx.fillRect(px, py, t, t);
                    ctx.fillStyle = 'rgba(180,160,130,0.18)';
                    var sx1 = World.hash2d(tx * 3, ty * 5);
                    ctx.fillRect(px + sx1 * 20, py + sx1 * 12, 3, 1);
                    ctx.fillStyle = 'rgba(120,100,75,0.18)';
                    ctx.fillRect(px + World.hash2d(tx*2,ty*4) * 22, py + 6 + sx1 * 14, 2, 2);
                } else if (tile.terrain === 'earth') {
                    ctx.fillStyle = colors.earth[tile.variant];
                    ctx.fillRect(px, py, t, t);
                    var ex1 = World.hash2d(tx * 5, ty * 7);
                    var ex2 = World.hash2d(tx * 2 + 3, ty * 9 + 5);
                    ctx.fillStyle = 'rgba(125,98,72,0.28)';
                    ctx.fillRect(px + ex1 * 18 + 3, py + 8, 4, 2);
                    ctx.fillStyle = 'rgba(55,42,28,0.28)';
                    ctx.fillRect(px + ex2 * 20 + 2, py + ex1 * 16 + 6, 3, 2);
                } else {
                    ctx.fillStyle = colors.grass[tile.variant];
                    ctx.fillRect(px, py, t, t);
                    var gh = World.hash2d(tx, ty);
                    var gh2 = World.hash2d(tx + 100, ty + 100);
                    var gh3 = World.hash2d(tx * 3 + 7, ty * 5 + 1);
                    // Briznas claras y oscuras
                    ctx.fillStyle = 'rgba(125,180,85,0.28)';
                    ctx.fillRect(px + gh * 20 + 2, py + gh2 * 20 + 2, 1.5, 4);
                    ctx.fillRect(px + gh2 * 22 + 6, py + gh * 16 + 8, 1.5, 3);
                    ctx.fillStyle = 'rgba(28,55,28,0.22)';
                    ctx.fillRect(px + gh3 * 20 + 5, py + gh * 18 + 11, 2, 2);
                    // Flor ocasional
                    if (gh3 > 0.94) {
                        ctx.fillStyle = gh2 > 0.5 ? '#e6cf4e' : '#e088c8';
                        ctx.fillRect(px + gh * 22 + 5, py + gh2 * 18 + 5, 2, 2);
                    }
                }

                // Mottling de luz de baja frecuencia: patrón de ~3 tiles continuo entre
                // chunks (se basa en coords de mundo, no de chunk → sin rejilla visible)
                if (tile.terrain !== 'water') {
                    var lv = World.hash2d(Math.floor(tx / 3), Math.floor(ty / 3));
                    if (lv > 0.6) {
                        ctx.fillStyle = 'rgba(255,255,215,' + ((lv - 0.6) * 0.18).toFixed(3) + ')';
                        ctx.fillRect(px, py, t, t);
                    } else if (lv < 0.4) {
                        ctx.fillStyle = 'rgba(0,8,20,' + ((0.4 - lv) * 0.20).toFixed(3) + ')';
                        ctx.fillRect(px, py, t, t);
                    }
                }

                // Decoración dispersa (árboles/rocas/arbustos) en hierba/tierra sin recurso.
                // Horneada en el chunk → coste 0 por frame; determinista vía hash2d.
                if (!tile.resource && (tile.terrain === 'grass' || tile.terrain === 'earth')) {
                    var dh = World.hash2d(tx * 13 + 1, ty * 17 + 3);
                    if (dh > 0.945) {
                        // Árbol: sombra + tronco + copa con brillo
                        var txc = px + t * 0.5, tyc = py + t * 0.58;
                        ctx.fillStyle = 'rgba(0,0,0,0.18)';
                        ctx.beginPath(); ctx.ellipse(txc, py + t - 4, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = '#5a3a1e';
                        ctx.fillRect(txc - 1.5, tyc, 3, t * 0.32);
                        ctx.fillStyle = '#27521f';
                        ctx.beginPath(); ctx.arc(txc, tyc, 6.5, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = '#367a2c';
                        ctx.beginPath(); ctx.arc(txc - 2, tyc - 2.5, 4.5, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = 'rgba(140,200,100,0.55)';
                        ctx.beginPath(); ctx.arc(txc - 3, tyc - 3.5, 2, 0, Math.PI * 2); ctx.fill();
                    } else if (dh > 0.895) {
                        // Roca
                        ctx.fillStyle = 'rgba(0,0,0,0.15)';
                        ctx.beginPath(); ctx.ellipse(px + t * 0.5, py + t * 0.68, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = '#6b6b73';
                        ctx.beginPath(); ctx.arc(px + t * 0.5, py + t * 0.55, 4.5, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = '#8c8c95';
                        ctx.beginPath(); ctx.arc(px + t * 0.5 - 1.2, py + t * 0.55 - 1.2, 2, 0, Math.PI * 2); ctx.fill();
                    } else if (dh > 0.84) {
                        // Arbusto
                        ctx.fillStyle = '#2c5526';
                        ctx.beginPath();
                        ctx.arc(px + t * 0.4, py + t * 0.6, 3, 0, Math.PI * 2);
                        ctx.arc(px + t * 0.6, py + t * 0.62, 3.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = 'rgba(120,170,90,0.4)';
                        ctx.beginPath(); ctx.arc(px + t * 0.55, py + t * 0.58, 1.5, 0, Math.PI * 2); ctx.fill();
                    }
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
                        for (var di = 0; di < dots; di++) {
                            var seed = World.hash2d(tx * 7 + di, ty * 13 + di);
                            var ox = (seed - 0.5) * (t - 16);
                            var oy = (World.hash2d(tx * 11 + di, ty * 3 + di) - 0.5) * (t - 16);
                            var ccx = px + t/2 + ox, ccy = py + t/2 + oy;
                            // Trozo de mineral con relieve: sombra + cuerpo + brillo
                            ctx.fillStyle = 'rgba(0,0,0,0.28)';
                            ctx.beginPath(); ctx.arc(ccx + 0.5, ccy + 0.9, ds, 0, Math.PI * 2); ctx.fill();
                            ctx.fillStyle = rc.fg;
                            ctx.beginPath(); ctx.arc(ccx, ccy, ds, 0, Math.PI * 2); ctx.fill();
                            ctx.fillStyle = 'rgba(255,255,255,0.38)';
                            ctx.beginPath(); ctx.arc(ccx - ds * 0.32, ccy - ds * 0.32, ds * 0.42, 0, Math.PI * 2); ctx.fill();
                        }

                        // Rim + brillo superior para definir la veta
                        ctx.fillStyle = 'rgba(255,255,255,0.14)';
                        ctx.fillRect(px + m + 1, py + m + 1, t - m*2 - 2, 2);
                        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
                        ctx.lineWidth = 1;
                        this.roundRect(ctx, px + m + 0.5, py + m + 0.5, t - m*2 - 1, t - m*2 - 1, 4);
                        ctx.stroke();
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

            var placeAge = this.frameNow - (b.placedAt || 0);
            var hasPlaceAnim = placeAge < 200;
            if (hasPlaceAnim) {
                var sc = 0.8 + 0.2 * (placeAge / 200);
                ctx.save();
                ctx.translate(px + pw/2, py + ph/2);
                ctx.scale(sc, sc);
                ctx.translate(-(px + pw/2), -(py + ph/2));
            }

            // Sombra proyectada
            ctx.fillStyle = 'rgba(0,0,0,0.38)';
            this.roundRect(ctx, px + 2, py + 3, pw - 2, ph - 2, 4);
            ctx.fill();

            // Cuerpo con gradiente vertical (da volumen top-down); plano a zoom bajo
            if (Camera.zoom > 0.45) {
                var grad = ctx.createLinearGradient(0, py, 0, py + ph);
                grad.addColorStop(0, this.shade(bc.fg, 0.18));
                grad.addColorStop(0.14, bc.bg);
                grad.addColorStop(1, this.shade(bc.bg, -0.40));
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = bc.bg;
            }
            this.roundRect(ctx, px + 1, py + 1, pw - 2, ph - 2, 4);
            ctx.fill();

            // Cara interior
            ctx.fillStyle = bc.fg;
            this.roundRect(ctx, px + 3, py + 3, pw - 6, ph - 6, 3);
            ctx.fill();

            // Bisel: brillo superior + línea de sombra inferior
            ctx.fillStyle = 'rgba(255,255,255,0.16)';
            ctx.fillRect(px + 4, py + 4, pw - 8, Math.max(2, ph * 0.13));
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.fillRect(px + 4, py + ph - 5, pw - 8, 2);

            // Detalle estático por tipo (identidad: paneles, barras de carga, listones...)
            this.drawStaticDetail(ctx, b, px, py, pw, ph);

            if (b.active) {
                var glowPulse = 0.10 + Math.sin(this.time * 3 + b.id) * 0.05;
                ctx.fillStyle = 'rgba(255,248,200,' + glowPulse.toFixed(3) + ')';
                this.roundRect(ctx, px + 3, py + 3, pw - 6, ph - 6, 3);
                ctx.fill();
                // Marco cálido sin shadowBlur (mucho más barato por frame)
                ctx.strokeStyle = 'rgba(255,220,120,0.28)';
                ctx.lineWidth = 1.5;
                this.roundRect(ctx, px + 1.5, py + 1.5, pw - 3, ph - 3, 4);
                ctx.stroke();

                // Resplandor cálido de "ventanas" en edificios activos de noche
                if (this.nightFactor > 0.15) {
                    ctx.fillStyle = 'rgba(255,200,90,' + (this.nightFactor * 0.22).toFixed(3) + ')';
                    this.roundRect(ctx, px + 4, py + 4, pw - 8, ph - 8, 2);
                    ctx.fill();
                }
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

            if (b.modules && b.modules.length > 0 && Camera.zoom > 0.5) {
                for (var mdi = 0; mdi < b.modules.length; mdi++) {
                    ctx.fillStyle = Items.color(b.modules[mdi]);
                    ctx.beginPath();
                    ctx.arc(px + pw - 7 - mdi * 8, py + 7, 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
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

            // La flecha de dirección solo en edificios donde importa (salida/lógica).
            // Energía/almacén/lab no tienen E/S direccional: la flecha sería ruido.
            if (b.direction !== undefined && !this.NO_ARROW[b.type]) {
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

    // Detalle estático por tipo (siempre visible, da identidad a los edificios que
    // de otro modo serían cajas planas). Solo con zoom suficiente.
    drawStaticDetail: function(ctx, b, px, py, pw, ph) {
        if (Camera.zoom <= 0.5) return;

        if (b.type === 'solar_panel') {
            // Rejilla de celdas fotovoltaicas + brillo de sol
            ctx.strokeStyle = 'rgba(8,28,58,0.5)';
            ctx.lineWidth = 1;
            var n = 3, cw = (pw - 10) / n, chh = (ph - 10) / n;
            for (var gx = 0; gx < n; gx++) {
                for (var gy = 0; gy < n; gy++) {
                    ctx.strokeRect(px + 5 + gx * cw, py + 5 + gy * chh, cw, chh);
                }
            }
            ctx.fillStyle = 'rgba(255,255,255,0.16)';
            ctx.beginPath();
            ctx.moveTo(px + 6, py + 6);
            ctx.lineTo(px + pw * 0.45, py + 6);
            ctx.lineTo(px + 6, py + ph * 0.45);
            ctx.closePath();
            ctx.fill();
        } else if (b.type === 'accumulator') {
            // Barras de carga (refleja b.charge)
            var cap = CFG.BUILDING_DEFS.accumulator.capacity;
            var lvl = Math.max(0, Math.min(1, (b.charge || 0) / cap));
            var bars = 4, bw = (pw - 12) / bars;
            for (var ba = 0; ba < bars; ba++) {
                var on = (ba + 1) / bars <= lvl + 0.001;
                ctx.fillStyle = on ? 'rgba(130,255,210,0.9)' : 'rgba(0,0,0,0.32)';
                ctx.fillRect(px + 6 + ba * bw, py + ph - 11, bw - 2, 7);
            }
        } else if (b.type === 'storage') {
            // Listones de caja + nivel de llenado
            ctx.strokeStyle = 'rgba(0,0,0,0.28)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(px + 4, py + ph * 0.42); ctx.lineTo(px + pw - 4, py + ph * 0.42); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(px + 4, py + ph * 0.66); ctx.lineTo(px + pw - 4, py + ph * 0.66); ctx.stroke();
            var tot = Inventory.total(b.stored || {});
            var fill = Math.min(1, tot / (b.capacity || 200));
            if (fill > 0) {
                ctx.fillStyle = 'rgba(120,210,130,0.55)';
                ctx.fillRect(px + 4, py + ph - 6, (pw - 8) * fill, 3);
            }
        } else if (b.type === 'rocket_silo') {
            // Plataforma de lanzamiento: foso circular + anillos + chevrons de aviso
            var rcx = px + pw / 2, rcy = py + ph / 2;
            ctx.fillStyle = 'rgba(16,18,26,0.55)';
            ctx.beginPath(); ctx.arc(rcx, rcy, pw * 0.34, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(230,168,50,0.55)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(rcx, rcy, pw * 0.34, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = 'rgba(230,168,50,0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(rcx, rcy, pw * 0.22, 0, Math.PI * 2); ctx.stroke();
            // Chevrons de aviso amarillo/negro en la base
            ctx.fillStyle = 'rgba(255,200,40,0.3)';
            for (var s = 0; s < 5; s++) {
                ctx.fillRect(px + 6 + s * (pw / 5), py + ph - 7, pw / 10, 4);
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
            // Chevrons de cinta rápida avanzan al doble: la velocidad se ve de un vistazo
            var beltOff = isFast ? (off * 2 % 1) : off;

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
                    var frac = ((a / arrowCount) + beltOff) % 1;
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
                    var frac2 = ((a2 / arrowCount2) + beltOff) % 1;
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
        var bounds = Camera.getVisibleBounds();
        var t = CFG.TILE;
        var minPX = bounds.minX * t - t, maxPX = (bounds.maxX + 1) * t + t;
        var minPY = bounds.minY * t - t, maxPY = (bounds.maxY + 1) * t + t;

        for (var i = 0; i < Belts.lines.length; i++) {
            var line = Belts.lines[i];
            if (line.removed || line.items.length === 0) continue;
            if (line.tiles.length === 0) continue;

            // Cull por línea antes de calcular posiciones. Las líneas son siempre
            // colineales por construcción (addToLine/mergeLines solo unen misma dir),
            // así que el bbox exacto son sus dos endpoints. Si algún día hubiera
            // líneas con giros, calcular min/max sobre todos los tiles.
            var t0 = line.tiles[0], t1 = line.tiles[line.tiles.length - 1];
            var lminX = Math.min(t0.x, t1.x) * t - t, lmaxX = (Math.max(t0.x, t1.x) + 1) * t + t;
            var lminY = Math.min(t0.y, t1.y) * t - t, lmaxY = (Math.max(t0.y, t1.y) + 1) * t + t;
            if (lmaxX < minPX || lminX > maxPX || lmaxY < minPY || lminY > maxPY) continue;

            var positions = Belts.getItemPositions(line);
            for (var j = 0; j < positions.length; j++) {
                var p = positions[j];
                if (p.x < minPX || p.x > maxPX) continue;
                if (p.y < minPY || p.y > maxPY) continue;

                var ic = Items.color(p.type);
                var s = 4.6; // semi-lado del item (cuadro redondeado tipo Factorio)

                // Sombra proyectada
                ctx.fillStyle = 'rgba(0,0,0,0.38)';
                this.roundRect(ctx, p.x - s + 0.9, p.y - s + 1.2, s * 2, s * 2, 2);
                ctx.fill();

                // Cuerpo
                ctx.fillStyle = ic;
                this.roundRect(ctx, p.x - s, p.y - s, s * 2, s * 2, 2);
                ctx.fill();

                // Brillo superior (bisel)
                ctx.fillStyle = 'rgba(255,255,255,0.30)';
                this.roundRect(ctx, p.x - s + 1, p.y - s + 1, s * 2 - 2, s - 0.5, 1.5);
                ctx.fill();

                // Sombra inferior + contorno
                ctx.fillStyle = 'rgba(0,0,0,0.22)';
                ctx.fillRect(p.x - s + 1, p.y + s - 1.6, s * 2 - 2, 1.4);
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
                ctx.lineWidth = 0.75;
                this.roundRect(ctx, p.x - s, p.y - s, s * 2, s * 2, 2);
                ctx.stroke();
            }
        }
    },

    drawGhosts: function() {
        var ctx = this.ctx;
        var t = CFG.TILE;

        if (Input.buildMode && !Input.isBeltMode()) {
            var def = CFG.BUILDING_DEFS[Input.buildMode];
            if (!def) return;

            // Arrastre para colocar fila de 1×1: ghost en cada tile del camino
            if (Input.isDragPlaceMode() && Input.ghostTiles.length > 0) {
                var bcl = CFG.COLORS.buildings[Input.buildMode];
                for (var gi = 0; gi < Input.ghostTiles.length; gi++) {
                    var gg = Input.ghostTiles[gi];
                    var canP = World.canPlace(gg.x, gg.y, 1, 1);
                    ctx.globalAlpha = 0.55;
                    ctx.fillStyle = canP ? 'rgba(0,220,80,0.25)' : 'rgba(220,0,40,0.3)';
                    this.roundRect(ctx, gg.x * t + 1, gg.y * t + 1, t - 2, t - 2, 3);
                    ctx.fill();
                    if (canP && bcl) {
                        ctx.fillStyle = bcl.fg;
                        this.roundRect(ctx, gg.x * t + 4, gg.y * t + 4, t - 8, t - 8, 2);
                        ctx.fill();
                    }
                }
                ctx.globalAlpha = 1;
                return;
            }

            var tile = Input.mouse.tile;
            var w = def.size[0], h = def.size[1];
            var canPlace = World.canPlace(tile.x, tile.y, w, h);
            if (Input.buildMode === 'miner' || Input.buildMode === 'electric_miner') canPlace = canPlace && World.hasResource(tile.x, tile.y, w, h);

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

            if (Input.buildMode === 'underground_belt') {
                this.drawUndergroundPreview(tile);
            }
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

    // Preview de túnel: conexión con la entrada candidata, o franja de alcance
    drawUndergroundPreview: function(tile) {
        var ctx = this.ctx;
        var t = CFG.TILE;
        var dir = Input.buildDirection;
        var d = CFG.DIRECTIONS[dir];
        var found = Buildings.findUndergroundPair(tile.x, tile.y, dir);

        if (found) {
            var pulse = 0.5 + Math.sin(this.time * 4) * 0.3;
            var fx = (found.b.x + 0.5) * t, fy = (found.b.y + 0.5) * t;
            var gx = (tile.x + 0.5) * t, gy = (tile.y + 0.5) * t;

            ctx.strokeStyle = 'rgba(230,200,60,0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(fx, fy);
            ctx.lineTo(gx, gy);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.globalAlpha = pulse;
            ctx.strokeStyle = '#00dc50';
            ctx.lineWidth = 2;
            this.roundRect(ctx, found.b.x * t + 1, found.b.y * t + 1, t - 2, t - 2, 3);
            ctx.stroke();
            ctx.globalAlpha = 1;

            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillText('Conecta (' + found.dist + ')', gx + 1, tile.y * t - 3);
            ctx.fillStyle = '#fff';
            ctx.fillText('Conecta (' + found.dist + ')', gx, tile.y * t - 4);
        } else {
            // Franja de alcance hacia delante: donde podrá ir la futura salida
            for (var i = 1; i <= CFG.UNDERGROUND_MAX_DIST + 1; i++) {
                var nx = tile.x + d.dx * i, ny = tile.y + d.dy * i;
                var nTile = World.getTile(nx, ny);
                var free = nTile.terrain !== 'water' && nTile.buildingId === null;
                ctx.strokeStyle = free ? 'rgba(230,200,60,0.35)' : 'rgba(150,150,150,0.25)';
                ctx.lineWidth = (i === CFG.UNDERGROUND_MAX_DIST + 1) ? 2.5 : 1;
                this.roundRect(ctx, nx * t + 2, ny * t + 2, t - 4, t - 4, 3);
                ctx.stroke();
            }
        }
    },

    // Overlay de alcance: inserter (origen/destino) y minero (footprint sobre veta)
    drawRangeOverlay: function() {
        var b = null;
        if (Input.selectedBuilding && !Input.selectedBuilding.removed) {
            b = Input.selectedBuilding;
        } else if (Input.buildMode === 'inserter' || Input.buildMode === 'miner' || Input.buildMode === 'electric_miner') {
            b = {type: Input.buildMode, x: Input.mouse.tile.x, y: Input.mouse.tile.y, direction: Input.buildDirection};
        }
        if (!b) return;
        if (b.type === 'inserter') this.drawInserterRange(b);
        else if (b.type === 'miner' || b.type === 'electric_miner') this.drawMinerRange(b);
    },

    drawInserterRange: function(b) {
        var ctx = this.ctx;
        var t = CFG.TILE;
        var d = CFG.DIRECTIONS[b.direction || 0];
        var pulse = 0.5 + Math.sin(this.time * 4) * 0.25;

        var fromX = b.x - d.dx, fromY = b.y - d.dy;
        var toX = b.x + d.dx, toY = b.y + d.dy;

        ctx.globalAlpha = 0.22 + pulse * 0.1;
        ctx.fillStyle = '#e6a832';
        ctx.fillRect(fromX * t, fromY * t, t, t);
        ctx.fillStyle = '#44cc66';
        ctx.fillRect(toX * t, toY * t, t, t);

        ctx.globalAlpha = pulse;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#e6a832';
        this.roundRect(ctx, fromX * t + 1, fromY * t + 1, t - 2, t - 2, 3);
        ctx.stroke();
        ctx.strokeStyle = '#44cc66';
        this.roundRect(ctx, toX * t + 1, toY * t + 1, t - 2, t - 2, 3);
        ctx.stroke();
        ctx.globalAlpha = 1;

        if (Camera.zoom >= 0.8) {
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillText('TOMA', fromX * t + t/2 + 1, fromY * t + t/2 + 1);
            ctx.fillText('DEJA', toX * t + t/2 + 1, toY * t + t/2 + 1);
            ctx.fillStyle = '#fff';
            ctx.fillText('TOMA', fromX * t + t/2, fromY * t + t/2);
            ctx.fillText('DEJA', toX * t + t/2, toY * t + t/2);
        }
    },

    drawMinerRange: function(b) {
        var ctx = this.ctx;
        var t = CFG.TILE;
        var def = CFG.BUILDING_DEFS[b.type];
        var w = def.size[0], h = def.size[1];
        var pulse = 0.4 + Math.sin(this.time * 4) * 0.2;
        var total = 0;

        for (var dy = 0; dy < h; dy++) {
            for (var dx = 0; dx < w; dx++) {
                var tx = b.x + dx, ty = b.y + dy;
                var tl = World.getTile(tx, ty);
                var has = tl.resource && tl.resource.amount > 0;
                if (has) total += tl.resource.amount;
                ctx.globalAlpha = has ? pulse * 0.5 : 0.15;
                ctx.fillStyle = has ? '#00dc50' : '#dc0028';
                ctx.fillRect(tx * t, ty * t, t, t);
                if (!has) {
                    ctx.globalAlpha = 0.4;
                    ctx.strokeStyle = '#dc0028';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(tx * t + 6, ty * t + 6);
                    ctx.lineTo(tx * t + t - 6, ty * t + t - 6);
                    ctx.moveTo(tx * t + t - 6, ty * t + 6);
                    ctx.lineTo(tx * t + 6, ty * t + t - 6);
                    ctx.stroke();
                }
            }
        }
        ctx.globalAlpha = 1;

        // Label DEBAJO del footprint (el nombre del recurso de drawGhosts va dentro)
        var label = total > 0 ? 'Veta: ' + UI.formatNumber(total) : 'Sin veta';
        var lx = b.x * t + (w * t) / 2, ly = (b.y + h) * t + 12;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillText(label, lx + 1, ly + 1);
        ctx.fillStyle = total > 0 ? '#aaffaa' : '#ff7070';
        ctx.fillText(label, lx, ly);
    },

    _demoKey: '',
    _demoIds: null,

    drawDemolitionPreview: function() {
        if (!Input.demolishMode) return;
        var ctx = this.ctx;
        var t = CFG.TILE;

        if (Input.isDragging && Input.dragStart && Input.demolishEnd) {
            var minX = Math.min(Input.dragStart.x, Input.demolishEnd.x);
            var maxX = Math.max(Input.dragStart.x, Input.demolishEnd.x);
            var minY = Math.min(Input.dragStart.y, Input.demolishEnd.y);
            var maxY = Math.max(Input.dragStart.y, Input.demolishEnd.y);

            // Memoización: re-escanear cuando cambia el rect O el array de edificios
            // (la compactación remapea ids; sin esto el preview marcaría edificios erróneos)
            var key = minX + ',' + minY + ',' + maxX + ',' + maxY + ',' + World.buildings.length;
            if (key !== this._demoKey) {
                this._demoKey = key;
                this._demoIds = Buildings.getIdsInRect(minX, minY, maxX, maxY);
            }
            var ids = this._demoIds || [];

            ctx.fillStyle = 'rgba(220,0,40,0.10)';
            ctx.fillRect(minX * t, minY * t, (maxX - minX + 1) * t, (maxY - minY + 1) * t);
            ctx.strokeStyle = 'rgba(220,0,40,0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(minX * t, minY * t, (maxX - minX + 1) * t, (maxY - minY + 1) * t);
            ctx.setLineDash([]);

            for (var i = 0; i < ids.length; i++) {
                var b = World.buildings[ids[i]];
                if (!b || b.removed) continue;
                var def = CFG.BUILDING_DEFS[b.type];
                ctx.fillStyle = 'rgba(220,0,40,0.35)';
                ctx.fillRect(b.x * t, b.y * t, def.size[0] * t, def.size[1] * t);
            }

            var label = ids.length + ' edificio' + (ids.length === 1 ? '' : 's');
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillText(label, minX * t + 3, minY * t - 3);
            ctx.fillStyle = '#ff9090';
            ctx.fillText(label, minX * t + 2, minY * t - 4);
        } else {
            this._demoKey = '';
            var hb = World.getBuildingAt(Input.mouse.tile.x, Input.mouse.tile.y);
            if (hb) {
                var hdef = CFG.BUILDING_DEFS[hb.type];
                ctx.fillStyle = 'rgba(220,0,40,0.35)';
                ctx.fillRect(hb.x * t, hb.y * t, hdef.size[0] * t, hdef.size[1] * t);
                ctx.strokeStyle = 'rgba(220,0,40,0.8)';
                ctx.lineWidth = 2;
                this.roundRect(ctx, hb.x * t + 1, hb.y * t + 1, hdef.size[0] * t - 2, hdef.size[1] * t - 2, 3);
                ctx.stroke();
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
        var rad = 8;
        this.minimapRect = {x: mmX, y: mmY, size: mmSize, scale: mmScale};

        // Panel con sombra + esquinas redondeadas
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = 'rgba(14,20,16,0.88)';
        this.roundRect(ctx, mmX, mmY, mmSize, mmSize, rad);
        ctx.fill();
        ctx.restore();

        // Tinte de terreno (gradiente verde) dentro del panel
        var mg = ctx.createLinearGradient(mmX, mmY, mmX, mmY + mmSize);
        mg.addColorStop(0, 'rgba(45,78,46,0.55)');
        mg.addColorStop(1, 'rgba(20,38,26,0.55)');
        ctx.fillStyle = mg;
        this.roundRect(ctx, mmX, mmY, mmSize, mmSize, rad);
        ctx.fill();

        // Recortar contenido a las esquinas redondeadas
        ctx.save();
        this.roundRect(ctx, mmX, mmY, mmSize, mmSize, rad);
        ctx.clip();

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
        ctx.strokeStyle = 'rgba(230,168,50,0.9)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(mmX + mmSize / 2 - vpW / 2, mmY + mmSize / 2 - vpH / 2, vpW, vpH);

        // Punto central (jugador/cámara)
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(mmX + mmSize / 2, mmY + mmSize / 2, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore(); // fin del clip

        // Borde dorado del panel
        ctx.strokeStyle = 'rgba(230,168,50,0.65)';
        ctx.lineWidth = 1.5;
        this.roundRect(ctx, mmX + 0.75, mmY + 0.75, mmSize - 1.5, mmSize - 1.5, rad);
        ctx.stroke();
    }
};
