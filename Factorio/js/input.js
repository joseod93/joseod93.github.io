var Input = {
    pointers: {},
    pointerCount: 0,
    keys: {},
    mouse: {x:0, y:0, tile:{x:0,y:0}},
    lastPinchDist: 0,
    isDragging: false,
    dragStart: null,
    isPanning: false,
    longPressTimer: null,
    tapStartTime: 0,
    tapStartPos: null,
    buildMode: null,
    buildDirection: 0,
    selectedBuilding: null,
    beltPath: [],
    ghostTiles: [],
    isTouchDevice: false,

    isBeltMode: function() {
        return this.buildMode === 'belt' || this.buildMode === 'fast_belt';
    },

    init: function(canvas) {
        var self = this;
        this.isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

        canvas.addEventListener('mousedown', function(e) { self.onMouseDown(e); });
        canvas.addEventListener('mousemove', function(e) { self.onMouseMove(e); });
        canvas.addEventListener('mouseup', function(e) { self.onMouseUp(e); });
        canvas.addEventListener('wheel', function(e) { e.preventDefault(); self.onWheel(e); }, {passive:false});
        canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });

        canvas.addEventListener('touchstart', function(e) { e.preventDefault(); self.onTouchStart(e); }, {passive:false});
        canvas.addEventListener('touchmove', function(e) { e.preventDefault(); self.onTouchMove(e); }, {passive:false});
        canvas.addEventListener('touchend', function(e) { e.preventDefault(); self.onTouchEnd(e); }, {passive:false});
        canvas.addEventListener('touchcancel', function(e) { self.onTouchEnd(e); }, {passive:false});

        window.addEventListener('keydown', function(e) { self.onKeyDown(e); });
        window.addEventListener('keyup', function(e) { self.onKeyUp(e); });
    },

    onMouseDown: function(e) {
        var sx = e.offsetX, sy = e.offsetY;
        if (e.button === 1 || e.button === 2) {
            this.isPanning = true;
            this.panStart = {x: sx, y: sy};
            return;
        }
        this.tapStartTime = Date.now();
        this.tapStartPos = {x: sx, y: sy};
        this.isDragging = false;
        var tile = Camera.screenToTile(sx, sy);
        this.dragStart = tile;

        if (this.isBeltMode()) {
            this.beltPath = [tile];
            this.ghostTiles = [tile];
        }
    },

    onMouseMove: function(e) {
        var sx = e.offsetX, sy = e.offsetY;
        this.mouse.x = sx; this.mouse.y = sy;
        this.mouse.tile = Camera.screenToTile(sx, sy);

        if (this.isPanning) {
            Camera.pan(sx - this.panStart.x, sy - this.panStart.y);
            this.panStart = {x: sx, y: sy};
            return;
        }

        if (this.tapStartPos) {
            var dx = sx - this.tapStartPos.x;
            var dy = sy - this.tapStartPos.y;
            if (Math.sqrt(dx*dx + dy*dy) > 5) {
                this.isDragging = true;
            }
        }

        if (this.isDragging && this.isBeltMode() && this.dragStart) {
            this.updateBeltPath(Camera.screenToTile(sx, sy));
        }
    },

    onMouseUp: function(e) {
        if (this.isPanning) {
            this.isPanning = false;
            return;
        }
        var sx = e.offsetX, sy = e.offsetY;
        var tile = Camera.screenToTile(sx, sy);

        if (e.button === 2) {
            this.handleRightClick(tile);
            return;
        }

        if (this.isBeltMode() && this.isDragging && this.ghostTiles.length > 0) {
            this.placeBeltPath();
        } else if (!this.isDragging) {
            this.handleTap(tile);
        }

        this.isDragging = false;
        this.dragStart = null;
        this.tapStartPos = null;
        this.beltPath = [];
        this.ghostTiles = [];
    },

    onWheel: function(e) {
        Camera.zoomAt(e.offsetX, e.offsetY, e.deltaY > 0 ? 1 : -1);
    },

    onTouchStart: function(e) {
        var touches = e.changedTouches;
        var rect = e.target.getBoundingClientRect();
        for (var i = 0; i < touches.length; i++) {
            var t = touches[i];
            this.pointers[t.identifier] = {
                x: t.clientX - rect.left,
                y: t.clientY - rect.top,
                startX: t.clientX - rect.left,
                startY: t.clientY - rect.top,
                startTime: Date.now()
            };
        }
        this.pointerCount = Object.keys(this.pointers).length;

        if (this.pointerCount === 1) {
            var p = this.getFirstPointer();
            this.tapStartTime = Date.now();
            this.tapStartPos = {x: p.x, y: p.y};
            this.isDragging = false;
            this.mouse.x = p.x;
            this.mouse.y = p.y;
            this.mouse.tile = Camera.screenToTile(p.x, p.y);
            var tile = Camera.screenToTile(p.x, p.y);
            this.dragStart = tile;

            if (this.isBeltMode()) {
                this.beltPath = [tile];
                this.ghostTiles = [tile];
            }

            var self = this;
            this.longPressTimer = setTimeout(function() {
                if (!self.isDragging && self.pointerCount === 1) {
                    self.handleLongPress(tile);
                }
            }, 500);
        }

        if (this.pointerCount === 2) {
            clearTimeout(this.longPressTimer);
            var pts = this.getPointerArray();
            this.lastPinchDist = this.dist(pts[0], pts[1]);
            this.isPanning = true;
        }
    },

    onTouchMove: function(e) {
        var touches = e.changedTouches;
        var rect = e.target.getBoundingClientRect();

        var oldPositions = {};
        for (var i = 0; i < touches.length; i++) {
            var t = touches[i];
            if (this.pointers[t.identifier]) {
                oldPositions[t.identifier] = {x: this.pointers[t.identifier].x, y: this.pointers[t.identifier].y};
                this.pointers[t.identifier].x = t.clientX - rect.left;
                this.pointers[t.identifier].y = t.clientY - rect.top;
            }
        }

        if (this.pointerCount === 2) {
            var pts = this.getPointerArray();
            var d = this.dist(pts[0], pts[1]);
            if (this.lastPinchDist > 0) {
                var cx = (pts[0].x + pts[1].x) / 2;
                var cy = (pts[0].y + pts[1].y) / 2;
                var delta = (this.lastPinchDist - d) * 0.01;
                Camera.zoomAt(cx, cy, delta);
            }
            this.lastPinchDist = d;

            var dx = 0, dy = 0, panCount = 0;
            for (var j = 0; j < touches.length; j++) {
                var old = oldPositions[touches[j].identifier];
                if (old) {
                    dx += this.pointers[touches[j].identifier].x - old.x;
                    dy += this.pointers[touches[j].identifier].y - old.y;
                    panCount++;
                }
            }
            if (panCount > 0) Camera.pan(dx / panCount, dy / panCount);
            return;
        }

        if (this.pointerCount === 1) {
            var p2 = this.getFirstPointer();
            if (!p2) return;

            this.mouse.x = p2.x;
            this.mouse.y = p2.y;
            this.mouse.tile = Camera.screenToTile(p2.x, p2.y);

            var sdx = p2.x - p2.startX;
            var sdy = p2.y - p2.startY;
            if (Math.sqrt(sdx*sdx + sdy*sdy) > 12) {
                this.isDragging = true;
                clearTimeout(this.longPressTimer);
            }

            if (this.isDragging) {
                if (this.isBeltMode()) {
                    this.updateBeltPath(Camera.screenToTile(p2.x, p2.y));
                } else {
                    var firstId = Object.keys(this.pointers)[0];
                    var oldP = oldPositions[firstId];
                    if (oldP) {
                        Camera.pan(p2.x - oldP.x, p2.y - oldP.y);
                    }
                }
            }
        }
    },

    onTouchEnd: function(e) {
        var touches = e.changedTouches;
        for (var i = 0; i < touches.length; i++) {
            delete this.pointers[touches[i].identifier];
        }
        this.pointerCount = Object.keys(this.pointers).length;
        clearTimeout(this.longPressTimer);

        if (this.pointerCount === 0) {
            if (this.isBeltMode() && this.isDragging && this.ghostTiles.length > 0) {
                this.placeBeltPath();
            } else if (!this.isDragging && Date.now() - this.tapStartTime < 300) {
                if (this.tapStartPos) {
                    var tile = Camera.screenToTile(this.tapStartPos.x, this.tapStartPos.y);
                    this.handleTap(tile);
                }
            }
            this.isDragging = false;
            this.isPanning = false;
            this.dragStart = null;
            this.tapStartPos = null;
            this.beltPath = [];
            this.ghostTiles = [];
        }
    },

    onKeyDown: function(e) {
        this.keys[e.key.toLowerCase()] = true;
        if (e.key === 'r' || e.key === 'R') {
            this.buildDirection = (this.buildDirection + 1) % 4;
        }
        if (e.key === 'Escape') {
            this.buildMode = null;
            this.selectedBuilding = null;
            UI.closePanels();
        }
        if (e.key === '?') {
            UI.toggleSettings();
        }
        if (e.key === ' ') {
            e.preventDefault();
            Game.paused = !Game.paused;
            UI.updatePauseState();
        }
        var num = parseInt(e.key);
        if (num >= 1 && num <= 9) {
            UI.selectBuildingByIndex(num - 1);
        }
    },

    onKeyUp: function(e) {
        this.keys[e.key.toLowerCase()] = false;
    },

    updateKeys: function(dt) {
        var speed = CFG.PAN_SPEED * dt;
        if (this.keys['w'] || this.keys['arrowup']) Camera.targetY -= speed;
        if (this.keys['s'] || this.keys['arrowdown']) Camera.targetY += speed;
        if (this.keys['a'] || this.keys['arrowleft']) Camera.targetX -= speed;
        if (this.keys['d'] || this.keys['arrowright']) Camera.targetX += speed;
    },

    vibrate: function(ms) {
        if (navigator.vibrate) navigator.vibrate(ms);
    },

    handleTap: function(tile) {
        document.getElementById('context-menu').style.display = 'none';

        if (this.buildMode && !this.isBeltMode()) {
            Buildings.tryPlace(tile.x, tile.y, this.buildMode, this.buildDirection);
            this.vibrate(15);
        } else if (this.isBeltMode()) {
            Belts.tryPlaceSingle(tile.x, tile.y, this.buildDirection, this.buildMode);
            this.vibrate(10);
        } else {
            var b = World.getBuildingAt(tile.x, tile.y);
            if (b) {
                this.selectedBuilding = b;
                UI.showBuildingInfo(b);
            } else {
                var t = World.getTile(tile.x, tile.y);
                if (t.resource && t.resource.amount > 0) {
                    var resType = t.resource.type;
                    t.resource.amount--;
                    var c = CFG.CHUNK;
                    var cx = Math.floor(tile.x / c), cy = Math.floor(tile.y / c);
                    World.getChunk(cx, cy).dirty = true;
                    Inventory.add(Game.player.inventory, resType, 1);
                    Game.stats.itemsProduced[resType] = (Game.stats.itemsProduced[resType] || 0) + 1;
                    Particles.spawn(tile.x * CFG.TILE + CFG.TILE / 2, tile.y * CFG.TILE + CFG.TILE / 2, 'produce', resType);
                    Audio.play('place');
                    UI.updateResources();
                    Tutorial.onEvent('mine');
                    this.vibrate(10);
                } else {
                    this.selectedBuilding = null;
                    UI.closePanels();
                }
            }
        }
    },

    handleRightClick: function(tile) {
        var b = World.getBuildingAt(tile.x, tile.y);
        if (b) {
            Buildings.remove(b.id);
            Audio.play('remove');
        }
    },

    handleLongPress: function(tile) {
        this.vibrate(30);
        var b = World.getBuildingAt(tile.x, tile.y);
        if (b) {
            UI.showContextMenu(tile, b);
        }
    },

    updateBeltPath: function(endTile) {
        if (!this.dragStart) return;
        var sx = this.dragStart.x, sy = this.dragStart.y;
        var ex = endTile.x, ey = endTile.y;
        var path = [];

        var dx = ex - sx, dy = ey - sy;
        var absDx = Math.abs(dx), absDy = Math.abs(dy);

        if (absDx >= absDy) {
            var stepX = dx > 0 ? 1 : -1;
            for (var x = sx; x !== ex + stepX; x += stepX) {
                path.push({x:x, y:sy, dir: dx > 0 ? 1 : 3});
            }
            if (dy !== 0) {
                var stepY = dy > 0 ? 1 : -1;
                if (path.length > 0) path[path.length-1].dir = dy > 0 ? 2 : 0;
                for (var y = sy + stepY; y !== ey + stepY; y += stepY) {
                    path.push({x:ex, y:y, dir: dy > 0 ? 2 : 0});
                }
            }
        } else {
            var stepY2 = dy > 0 ? 1 : -1;
            for (var y2 = sy; y2 !== ey + stepY2; y2 += stepY2) {
                path.push({x:sx, y:y2, dir: dy > 0 ? 2 : 0});
            }
            if (dx !== 0) {
                var stepX2 = dx > 0 ? 1 : -1;
                if (path.length > 0) path[path.length-1].dir = dx > 0 ? 1 : 3;
                for (var x2 = sx + stepX2; x2 !== ex + stepX2; x2 += stepX2) {
                    path.push({x:x2, y:ey, dir: dx > 0 ? 1 : 3});
                }
            }
        }
        this.ghostTiles = path;
    },

    placeBeltPath: function() {
        var placed = 0;
        for (var i = 0; i < this.ghostTiles.length; i++) {
            var g = this.ghostTiles[i];
            if (Belts.tryPlaceSingle(g.x, g.y, g.dir, this.buildMode)) placed++;
        }
        if (placed > 0) Audio.play('place');
        this.ghostTiles = [];
    },

    getFirstPointer: function() {
        for (var k in this.pointers) return this.pointers[k];
        return null;
    },

    getPointerArray: function() {
        var arr = [];
        for (var k in this.pointers) arr.push(this.pointers[k]);
        return arr;
    },

    dist: function(a, b) {
        var dx = a.x - b.x, dy = a.y - b.y;
        return Math.sqrt(dx*dx + dy*dy);
    }
};
