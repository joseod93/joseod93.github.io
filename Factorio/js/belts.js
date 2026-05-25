var Belts = {
    lines: [],
    tileToLine: {},

    init: function() {
        this.lines = [];
        this.tileToLine = {};
    },

    tryPlaceSingle: function(tx, ty, dir) {
        var tile = World.getTile(tx, ty);
        if (tile.terrain === 'water') return false;
        if (tile.buildingId !== null) return false;

        var beltId = World.placeBuilding({
            type: 'belt', x: tx, y: ty, direction: dir,
            input: {}, output: {}, progress: 0, active: true
        });

        this.addToLine(tx, ty, dir);
        Tutorial.onEvent('place', 'belt');
        return true;
    },

    addToLine: function(tx, ty, dir) {
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

        if (bLine && bLine.dir === dir && !bLine.removed) {
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

        if (aLine && aLine.dir === dir && !aLine.removed) {
            aLine.tiles.unshift({x:tx, y:ty});
            this.rebuildTileIndex(aLine);
            if (aLine.items.length > 0) {
                aLine.items[0].gap += 1;
            } else {
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
            speed: CFG.BELT_SPEED * (1 + (Game.prestige ? (Game.prestige.upgrades.belt_speed || 0) * 0.1 : 0)),
            removed: false
        };
        this.lines.push(line);
        this.tileToLine[key] = {lineId: line.id, idx: 0};
    },

    mergeLines: function(tail, head) {
        for (var i = 0; i < head.tiles.length; i++) {
            tail.tiles.push(head.tiles[i]);
        }

        if (head.items.length > 0) {
            if (tail.items.length > 0) {
                head.items[0].gap += tail.headGap;
            }
            for (var j = 0; j < head.items.length; j++) {
                tail.items.push(head.items[j]);
            }
            tail.headGap = head.headGap;
        } else {
            tail.headGap += head.headGap;
        }

        head.removed = true;
        this.rebuildTileIndex(tail);
        this.recalcLastPositive(tail);
    },

    rebuildTileIndex: function(line) {
        for (var i = 0; i < line.tiles.length; i++) {
            var t = line.tiles[i];
            this.tileToLine[t.x + ',' + t.y] = {lineId: line.id, idx: i};
        }
    },

    removeBelt: function(tx, ty) {
        var key = tx + ',' + ty;
        var info = this.tileToLine[key];
        if (!info) return;
        var line = this.lines[info.lineId];
        if (!line || line.removed) return;

        if (line.tiles.length === 1) {
            line.removed = true;
            delete this.tileToLine[key];
            return;
        }

        var idx = -1;
        for (var i = 0; i < line.tiles.length; i++) {
            if (line.tiles[i].x === tx && line.tiles[i].y === ty) { idx = i; break; }
        }
        if (idx === -1) return;

        if (idx === 0) {
            line.tiles.shift();
            delete this.tileToLine[key];
            if (line.items.length > 0 && line.items[0].gap < 1) {
                line.items.shift();
            } else if (line.items.length > 0) {
                line.items[0].gap -= 1;
            } else {
                line.headGap -= 1;
            }
            this.rebuildTileIndex(line);
            this.recalcLastPositive(line);
            return;
        }

        if (idx === line.tiles.length - 1) {
            line.tiles.pop();
            delete this.tileToLine[key];
            line.headGap = Math.max(0, line.headGap - 1);
            var itemsToRemove = [];
            var pos = line.tiles.length + 1;
            for (var j = line.items.length - 1; j >= 0; j--) {
                pos -= line.items[j].gap;
                if (pos > line.tiles.length) itemsToRemove.push(j);
            }
            for (var k = 0; k < itemsToRemove.length; k++) {
                line.items.splice(itemsToRemove[k], 1);
            }
            this.recalcLastPositive(line);
            return;
        }

        line.removed = true;
        delete this.tileToLine[key];

        var tailTiles = line.tiles.slice(0, idx);
        var headTiles = line.tiles.slice(idx + 1);

        var tailLine = {
            id: this.lines.length, dir: line.dir, tiles: tailTiles,
            items: [], headGap: tailTiles.length, lastPositiveGapIndex: -1,
            speed: line.speed, removed: false
        };
        this.lines.push(tailLine);

        var headLine = {
            id: this.lines.length, dir: line.dir, tiles: headTiles,
            items: [], headGap: headTiles.length, lastPositiveGapIndex: -1,
            speed: line.speed, removed: false
        };
        this.lines.push(headLine);

        var pos2 = 0;
        for (var m = 0; m < line.items.length; m++) {
            pos2 += line.items[m].gap;
            if (pos2 < idx) {
                tailLine.items.push({type: line.items[m].type, gap: line.items[m].gap});
            } else if (pos2 > idx) {
                headLine.items.push({type: line.items[m].type, gap: line.items[m].gap - (pos2 > idx + 1 ? 0 : idx + 1 - pos2)});
            }
        }

        this.rebuildTileIndex(tailLine);
        this.rebuildTileIndex(headLine);
        this.recalcHeadGap(tailLine);
        this.recalcHeadGap(headLine);
        this.recalcLastPositive(tailLine);
        this.recalcLastPositive(headLine);
    },

    recalcHeadGap: function(line) {
        var totalGaps = 0;
        for (var i = 0; i < line.items.length; i++) totalGaps += line.items[i].gap;
        line.headGap = line.tiles.length - totalGaps;
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

    insertItem: function(line, itemType) {
        if (line.removed) return false;
        var minGap = CFG.ITEM_SPACING;

        if (line.items.length === 0) {
            if (line.headGap < minGap) return false;
            line.items.push({type: itemType, gap: 0});
            line.headGap = line.tiles.length;
            this.recalcHeadGap(line);
            line.lastPositiveGapIndex = -1;
            return true;
        }

        var firstGap = line.items[0].gap;
        if (firstGap < minGap) return false;

        line.items.unshift({type: itemType, gap: 0});
        line.items[1].gap = firstGap;
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

            var startIdx = Math.min(line.lastPositiveGapIndex, line.items.length - 1);
            for (var j = startIdx; j >= 0; j--) {
                if (line.items[j].gap > 0) {
                    line.items[j].gap -= advance;
                    if (line.items[j].gap <= 0) {
                        line.items[j].gap = 0;
                        if (j === line.lastPositiveGapIndex) {
                            line.lastPositiveGapIndex--;
                            while (line.lastPositiveGapIndex >= 0 && line.items[line.lastPositiveGapIndex].gap <= 0) {
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
