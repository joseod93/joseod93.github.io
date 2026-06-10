var Belts = {
    lines: [],
    tileToLine: {},
    deadCount: 0,

    init: function() {
        this.lines = [];
        this.tileToLine = {};
        this.deadCount = 0;
    },

    // Purga líneas muertas (removeBelt/mergeLines solo marcan removed).
    // Nada persiste índices de línea: basta reasignar ids y reindexar tiles.
    compactLines: function() {
        var alive = [];
        for (var i = 0; i < this.lines.length; i++) {
            if (!this.lines[i].removed) alive.push(this.lines[i]);
        }
        if (alive.length === this.lines.length) { this.deadCount = 0; return; }
        this.lines = alive;
        this.tileToLine = {};
        for (var j = 0; j < alive.length; j++) {
            alive[j].id = j;
            this.rebuildTileIndex(alive[j]);
        }
        this.deadCount = 0;
    },

    tryPlaceSingle: function(tx, ty, dir, beltType) {
        if (!beltType) beltType = 'belt';
        var tile = World.getTile(tx, ty);
        if (tile.terrain === 'water') return false;
        if (tile.buildingId !== null) return false;

        // Sin toast de faltantes: en drag-build seria spam por cada tile
        if (!Game.creativeModeOn) {
            var def = CFG.BUILDING_DEFS[beltType];
            if (def && def.cost && def.cost.length > 0) {
                if (!Inventory.hasAll(Game.player.inventory, def.cost)) return false;
                Inventory.removeAll(Game.player.inventory, def.cost);
            }
        }

        var beltId = World.placeBuilding({
            type: beltType, x: tx, y: ty, direction: dir,
            input: {}, output: {}, progress: 0, active: true
        });

        var beltSpeed = (beltType === 'fast_belt' ? CFG.FAST_BELT_SPEED : CFG.BELT_SPEED);
        beltSpeed *= (1 + (Game.prestige ? (Game.prestige.upgrades.belt_speed || 0) * 0.1 : 0));
        if (Tech.isCompleted('logistics_2')) beltSpeed *= 1.5;

        this.addToLine(tx, ty, dir, beltSpeed);
        Tutorial.onEvent('place', beltType);
        return true;
    },

    addToLine: function(tx, ty, dir, beltSpeed) {
        var key = tx + ',' + ty;
        var d = CFG.DIRECTIONS[dir];
        var behindX = tx - d.dx, behindY = ty - d.dy;
        var aheadX = tx + d.dx, aheadY = ty + d.dy;
        var behindKey = behindX + ',' + behindY;
        var aheadKey = aheadX + ',' + aheadY;

        var behindLine = this.tileToLine[behindKey];
        var aheadLine = this.tileToLine[aheadKey];

        var bLine = behindLine ? this.lines[behindLine.lineId] : null;
        var aLine = aheadLine ? this.lines[aheadLine.lineId] : null;

        if (bLine && bLine.dir === dir && !bLine.removed && Math.abs(bLine.speed - beltSpeed) < 0.001) {
            if (aLine && aLine.dir === dir && !aLine.removed && bLine !== aLine) {
                bLine.tiles.push({x:tx, y:ty});
                this.tileToLine[key] = {lineId: bLine.id, idx: bLine.tiles.length - 1};
                this.mergeLines(bLine, aLine);
                return;
            }
            bLine.tiles.push({x:tx, y:ty});
            this.tileToLine[key] = {lineId: bLine.id, idx: bLine.tiles.length - 1};
            bLine.headGap += 1;
            return;
        }

        if (aLine && aLine.dir === dir && !aLine.removed && Math.abs(aLine.speed - beltSpeed) < 0.001) {
            aLine.tiles.unshift({x:tx, y:ty});
            this.rebuildTileIndex(aLine);
            // Extender por la cola no mueve la cabeza: headGap solo crece si no hay items
            if (aLine.items.length === 0) {
                aLine.headGap += 1;
            }
            return;
        }

        var line = {
            id: this.lines.length,
            dir: dir,
            tiles: [{x:tx, y:ty}],
            items: [],
            headGap: 1,
            lastPositiveGapIndex: -1,
            speed: beltSpeed,
            removed: false
        };
        this.lines.push(line);
        this.tileToLine[key] = {lineId: line.id, idx: 0};
    },

    mergeLines: function(tail, head) {
        if (head.items.length > 0) {
            if (tail.items.length > 0) {
                // Distancia real entre el primer item de head y el último de tail
                head.items[0].gap = this.tailSpace(head) + tail.headGap;
            }
            for (var j = 0; j < head.items.length; j++) {
                tail.items.push(head.items[j]);
            }
            tail.headGap = head.headGap;
        } else {
            tail.headGap += head.headGap;
        }

        for (var i = 0; i < head.tiles.length; i++) {
            tail.tiles.push(head.tiles[i]);
        }

        head.removed = true;
        this.deadCount++;
        this.rebuildTileIndex(tail);
        this.recalcLastPositive(tail);
    },

    rebuildTileIndex: function(line) {
        for (var i = 0; i < line.tiles.length; i++) {
            var t = line.tiles[i];
            this.tileToLine[t.x + ',' + t.y] = {lineId: line.id, idx: i};
        }
    },

    // Posiciones absolutas medidas desde el extremo de cola de la línea
    // (derivadas desde la cabeza: p_head = tiles.length - headGap)
    getAbsPositions: function(line) {
        var n = line.items.length;
        var abs = new Array(n);
        var p = line.tiles.length - line.headGap;
        for (var i = n - 1; i >= 0; i--) {
            abs[i] = {type: line.items[i].type, p: p};
            p -= line.items[i].gap;
        }
        return abs;
    },

    buildSegmentFromAbs: function(template, tiles, absItems, offset) {
        if (tiles.length === 0) {
            for (var i = 0; i < absItems.length; i++) {
                Inventory.add(Game.player.inventory, absItems[i].type, 1);
            }
            return null;
        }
        var items = [];
        for (var j = 0; j < absItems.length; j++) {
            items.push({
                type: absItems[j].type,
                gap: j === 0 ? 0 : absItems[j].p - absItems[j - 1].p
            });
        }
        var seg = {
            id: this.lines.length,
            dir: template.dir,
            tiles: tiles,
            items: items,
            headGap: absItems.length > 0
                ? tiles.length - (absItems[absItems.length - 1].p - offset)
                : tiles.length,
            lastPositiveGapIndex: -1,
            speed: template.speed,
            removed: false
        };
        this.lines.push(seg);
        this.recalcLastPositive(seg);
        this.rebuildTileIndex(seg);
        return seg;
    },

    removeBelt: function(tx, ty) {
        var key = tx + ',' + ty;
        var info = this.tileToLine[key];
        if (!info) return;
        var line = this.lines[info.lineId];
        if (!line || line.removed) return;

        var idx = -1;
        for (var i = 0; i < line.tiles.length; i++) {
            if (line.tiles[i].x === tx && line.tiles[i].y === ty) { idx = i; break; }
        }
        if (idx === -1) return;

        // Posición absoluta de un item: p = suma de gaps hasta él (ocupa el tile floor(p-1)).
        // Invariante: headGap + sum(gaps) = tiles.length.
        var absItems = this.getAbsPositions(line);
        line.removed = true;
        this.deadCount++;
        delete this.tileToLine[key];

        var tailItems = [], headItems = [];
        for (var j = 0; j < absItems.length; j++) {
            var it = absItems[j];
            if (it.p <= idx) {
                tailItems.push(it);
            } else if (it.p >= idx + 2) {
                headItems.push(it);
            } else {
                // Estaba sobre el tile eliminado: devolver al jugador
                Inventory.add(Game.player.inventory, it.type, 1);
            }
        }

        this.buildSegmentFromAbs(line, line.tiles.slice(0, idx), tailItems, 0);
        this.buildSegmentFromAbs(line, line.tiles.slice(idx + 1), headItems, idx + 1);
        UI.updateResources();
    },

    recalcLastPositive: function(line) {
        line.lastPositiveGapIndex = -1;
        for (var i = line.items.length - 1; i >= 0; i--) {
            if (line.items[i].gap > 0) {
                line.lastPositiveGapIndex = i;
                break;
            }
        }
    },

    // Espacio libre detrás del item de cola (posiciones medidas desde la cabeza;
    // items[0].gap se mantiene siempre a 0 y no participa en el cálculo)
    tailSpace: function(line) {
        if (line.items.length === 0) return line.tiles.length;
        var s = 0;
        for (var i = 1; i < line.items.length; i++) s += line.items[i].gap;
        return line.tiles.length - line.headGap - s;
    },

    canInsertItem: function(line) {
        if (line.removed) return false;
        return this.tailSpace(line) >= CFG.ITEM_SPACING;
    },

    insertItem: function(line, itemType) {
        if (!this.canInsertItem(line)) return false;

        if (line.items.length === 0) {
            line.items.push({type: itemType, gap: 0});
            line.headGap = line.tiles.length;
            line.lastPositiveGapIndex = -1;
            return true;
        }

        var space = this.tailSpace(line);
        line.items.unshift({type: itemType, gap: 0});
        line.items[1].gap = space;
        this.recalcLastPositive(line);
        return true;
    },

    update: function() {
        for (var i = 0; i < this.lines.length; i++) {
            var line = this.lines[i];
            if (line.removed || line.items.length === 0) continue;

            var advance = line.speed;

            if (line.headGap > 0) {
                line.headGap -= advance;
                if (line.headGap < 0) line.headGap = 0;
            } else {
                var headItem = line.items[line.items.length - 1];
                var d = CFG.DIRECTIONS[line.dir];
                var headTile = line.tiles[line.tiles.length - 1];
                var nextX = headTile.x + d.dx, nextY = headTile.y + d.dy;

                var nextLineInfo = this.tileToLine[nextX + ',' + nextY];
                if (nextLineInfo) {
                    var nextLine = this.lines[nextLineInfo.lineId];
                    if (nextLine && !nextLine.removed) {
                        if (this.insertItem(nextLine, headItem.type)) {
                            line.items.pop();
                            if (line.items.length > 0) {
                                line.headGap = headItem.gap || 0;
                            } else {
                                line.headGap = line.tiles.length;
                            }
                            this.recalcLastPositive(line);
                        }
                    }
                } else {
                    var nextBuilding = World.getBuildingAt(nextX, nextY);
                    if (nextBuilding && !nextBuilding.removed && nextBuilding.type !== 'belt') {
                        if (Buildings.tryAcceptItem(nextBuilding, headItem.type)) {
                            line.items.pop();
                            if (line.items.length > 0) {
                                line.headGap = headItem.gap || 0;
                            } else {
                                line.headGap = line.tiles.length;
                            }
                            this.recalcLastPositive(line);
                        }
                    }
                }
            }

            // Compresión: el tramo trasero se acerca al de delante. gap_0 no se toca
            // (siempre 0; el espacio de cola se deriva en tailSpace())
            var startIdx = Math.min(line.lastPositiveGapIndex, line.items.length - 1);
            for (var j = startIdx; j >= 1; j--) {
                if (line.items[j].gap > 0) {
                    line.items[j].gap -= advance;
                    if (line.items[j].gap <= 0) {
                        line.items[j].gap = 0;
                        if (j === line.lastPositiveGapIndex) {
                            line.lastPositiveGapIndex--;
                            while (line.lastPositiveGapIndex >= 1 && line.items[line.lastPositiveGapIndex].gap <= 0) {
                                line.lastPositiveGapIndex--;
                            }
                        }
                    }
                    break;
                }
            }
        }
    },

    getItemPositions: function(line) {
        if (line.removed || line.items.length === 0) return [];
        var positions = [];
        var pos = line.tiles.length - line.headGap;

        for (var i = line.items.length - 1; i >= 0; i--) {
            if (i < line.items.length - 1) {
                pos -= line.items[i + 1].gap;
            }
            var t = pos - 1;
            if (t < 0) t = 0;
            if (t >= line.tiles.length) t = line.tiles.length - 1;

            var tileIdx = Math.floor(t);
            var frac = t - tileIdx;
            if (tileIdx >= line.tiles.length) tileIdx = line.tiles.length - 1;

            var tile = line.tiles[tileIdx];
            var nextTile = tileIdx + 1 < line.tiles.length ? line.tiles[tileIdx + 1] : null;

            var wx, wy;
            if (nextTile && frac > 0) {
                wx = (tile.x + (nextTile.x - tile.x) * frac + 0.5) * CFG.TILE;
                wy = (tile.y + (nextTile.y - tile.y) * frac + 0.5) * CFG.TILE;
            } else {
                wx = (tile.x + 0.5) * CFG.TILE;
                wy = (tile.y + 0.5) * CFG.TILE;
            }
            positions.push({x: wx, y: wy, type: line.items[i].type});
        }

        pos -= line.items[0].gap;
        return positions;
    },

    getLineAt: function(tx, ty) {
        var info = this.tileToLine[tx + ',' + ty];
        if (!info) return null;
        var line = this.lines[info.lineId];
        if (!line || line.removed) return null;
        return line;
    },

    getLineForOutput: function(bx, by, bw, bh, dir) {
        var d = CFG.DIRECTIONS[dir];
        for (var i = 0; i < bw; i++) {
            for (var j = 0; j < bh; j++) {
                var checkX = bx + (d.dx > 0 ? bw : d.dx < 0 ? -1 : i);
                var checkY = by + (d.dy > 0 ? bh : d.dy < 0 ? -1 : j);
                var line = this.getLineAt(checkX, checkY);
                if (line) return line;
            }
        }
        return null;
    }
};
