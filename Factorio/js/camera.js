var Camera = {
    x: 0, y: 0,
    targetX: 0, targetY: 0,
    zoom: 1.5, targetZoom: 1.5,
    vw: 800, vh: 600,

    init: function(vw, vh) {
        this.vw = vw; this.vh = vh;
        this.x = -vw / 2; this.y = -vh / 2;
        this.targetX = this.x; this.targetY = this.y;
    },

    resize: function(vw, vh) {
        this.vw = vw; this.vh = vh;
    },

    update: function(dt) {
        var lerp = 1 - Math.pow(0.001, dt);
        this.x += (this.targetX - this.x) * lerp;
        this.y += (this.targetY - this.y) * lerp;
        this.zoom += (this.targetZoom - this.zoom) * lerp;
    },

    pan: function(dx, dy) {
        this.targetX -= dx / this.zoom;
        this.targetY -= dy / this.zoom;
    },

    zoomAt: function(sx, sy, delta) {
        var oldZoom = this.targetZoom;
        this.targetZoom *= (1 - delta * CFG.ZOOM_SPEED);
        this.targetZoom = Math.max(CFG.ZOOM_MIN, Math.min(CFG.ZOOM_MAX, this.targetZoom));
        var factor = 1 - oldZoom / this.targetZoom;
        this.targetX += (sx / oldZoom) * factor;
        this.targetY += (sy / oldZoom) * factor;
    },

    worldToScreen: function(wx, wy) {
        return {
            x: (wx - this.x) * this.zoom,
            y: (wy - this.y) * this.zoom
        };
    },

    screenToWorld: function(sx, sy) {
        return {
            x: sx / this.zoom + this.x,
            y: sy / this.zoom + this.y
        };
    },

    screenToTile: function(sx, sy) {
        var w = this.screenToWorld(sx, sy);
        return {
            x: Math.floor(w.x / CFG.TILE),
            y: Math.floor(w.y / CFG.TILE)
        };
    },

    getVisibleBounds: function() {
        var t = CFG.TILE;
        return {
            minX: Math.floor(this.x / t) - 1,
            minY: Math.floor(this.y / t) - 1,
            maxX: Math.ceil((this.x + this.vw / this.zoom) / t) + 1,
            maxY: Math.ceil((this.y + this.vh / this.zoom) / t) + 1
        };
    },

    getVisibleChunks: function() {
        var b = this.getVisibleBounds();
        var c = CFG.CHUNK;
        return {
            minCX: Math.floor(b.minX / c) - 1,
            minCY: Math.floor(b.minY / c) - 1,
            maxCX: Math.floor(b.maxX / c) + 1,
            maxCY: Math.floor(b.maxY / c) + 1
        };
    }
};
