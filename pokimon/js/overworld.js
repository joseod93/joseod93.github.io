window.Game = window.Game || {};

Game.Overworld = {
    player: null,
    map: null,
    showHealMsg: false,
    healMsgTimer: 0,
    encounterTriggered: false,

    init: function(team) {
        var start = Game.MapData.playerStart;
        this.player = {
            gridX: start.x,
            gridY: start.y,
            pixelX: start.x * Game.Constants.TILE_SIZE,
            pixelY: start.y * Game.Constants.TILE_SIZE,
            targetX: start.x * Game.Constants.TILE_SIZE,
            targetY: start.y * Game.Constants.TILE_SIZE,
            moving: false,
            direction: 'down',
            team: team,
            stepCount: 0
        };
        this.map = Game.MapData;
        this.showHealMsg = false;
        this.encounterTriggered = false;
    },

    update: function(dt) {
        var p = this.player;
        var C = Game.Constants;
        var input = Game.Input;

        if (this.showHealMsg) {
            this.healMsgTimer -= dt;
            if (this.healMsgTimer <= 0) this.showHealMsg = false;
            return null;
        }

        if (p.moving) {
            var speed = C.MOVE_SPEED * C.TILE_SIZE * dt;
            var dx = p.targetX - p.pixelX;
            var dy = p.targetY - p.pixelY;

            if (Math.abs(dx) > 1) {
                p.pixelX += Math.sign(dx) * Math.min(speed, Math.abs(dx));
            } else {
                p.pixelX = p.targetX;
            }

            if (Math.abs(dy) > 1) {
                p.pixelY += Math.sign(dy) * Math.min(speed, Math.abs(dy));
            } else {
                p.pixelY = p.targetY;
            }

            if (p.pixelX === p.targetX && p.pixelY === p.targetY) {
                p.moving = false;
                p.gridX = p.targetX / C.TILE_SIZE;
                p.gridY = p.targetY / C.TILE_SIZE;
                return this.onStepComplete();
            }
            return null;
        }

        var newX = p.gridX;
        var newY = p.gridY;

        if (input.isDown('ArrowUp') || input.isDown('KeyW')) { newY--; p.direction = 'up'; }
        else if (input.isDown('ArrowDown') || input.isDown('KeyS')) { newY++; p.direction = 'down'; }
        else if (input.isDown('ArrowLeft') || input.isDown('KeyA')) { newX--; p.direction = 'left'; }
        else if (input.isDown('ArrowRight') || input.isDown('KeyD')) { newX++; p.direction = 'right'; }

        if ((newX !== p.gridX || newY !== p.gridY) && this.canWalk(newX, newY)) {
            p.targetX = newX * C.TILE_SIZE;
            p.targetY = newY * C.TILE_SIZE;
            p.moving = true;
        }

        if (input.confirm()) {
            var tile = this.getTile(p.gridX, p.gridY);
            if (tile === C.TILE_HEAL) {
                this.healTeam();
            }
        }

        return null;
    },

    onStepComplete: function() {
        var C = Game.Constants;
        var tile = this.getTile(this.player.gridX, this.player.gridY);

        if (tile === C.TILE_GRASS) {
            this.player.stepCount++;
            if (Game.Utils.chance(C.ENCOUNTER_RATE)) {
                return this.triggerEncounter();
            }
        }
        return null;
    },

    triggerEncounter: function() {
        var zoneId = this.getEncounterZone(this.player.gridX, this.player.gridY);
        if (!zoneId) return null;

        var zone = Game.EncounterZones[zoneId];
        var speciesId = Game.Utils.pick(zone.monsters);
        var level = Game.Utils.random(zone.levelRange[0], zone.levelRange[1]);
        var wildMon = Game.createMonster(speciesId, level);

        return { type: 'encounter', monster: wildMon };
    },

    getEncounterZone: function(x, y) {
        var zoneMap = this.map.encounterMap;
        if (y < 0 || y >= zoneMap.length || x < 0 || x >= zoneMap[0].length) return null;
        var z = zoneMap[y][x];
        if (z === 0) return null;
        return 'zone' + z;
    },

    canWalk: function(x, y) {
        if (x < 0 || x >= Game.Constants.MAP_COLS || y < 0 || y >= Game.Constants.MAP_ROWS) return false;
        return this.getTile(x, y) !== Game.Constants.TILE_WALL;
    },

    getTile: function(x, y) {
        return this.map.tiles[y][x];
    },

    healTeam: function() {
        for (var i = 0; i < this.player.team.length; i++) {
            this.player.team[i].heal();
        }
        this.showHealMsg = true;
        this.healMsgTimer = 2;
        if (Game.Save) Game.Save.save();
    },

    draw: function() {
        var R = Game.Renderer;
        var C = Game.Constants;
        var p = this.player;

        var camX = Math.floor(p.pixelX - 400 + C.TILE_SIZE / 2);
        var camY = Math.floor(p.pixelY - 304 + C.TILE_SIZE / 2);
        camX = Game.Utils.clamp(camX, 0, C.MAP_COLS * C.TILE_SIZE - 800);
        camY = Game.Utils.clamp(camY, 0, C.MAP_ROWS * C.TILE_SIZE - 608);

        R.clear('#222');

        var tileImages = {
            0: Game.Assets ? Game.Assets.get('tile_ground') : null,
            1: Game.Assets ? Game.Assets.get('tile_wall') : null,
            2: Game.Assets ? Game.Assets.get('tile_grass') : null,
            3: Game.Assets ? Game.Assets.get('tile_heal') : null,
            4: Game.Assets ? Game.Assets.get('tile_path') : null
        };

        for (var row = 0; row < C.MAP_ROWS; row++) {
            for (var col = 0; col < C.MAP_COLS; col++) {
                var tile = this.map.tiles[row][col];
                var tx = col * C.TILE_SIZE - camX;
                var ty = row * C.TILE_SIZE - camY;

                if (tx < -C.TILE_SIZE || tx > 800 || ty < -C.TILE_SIZE || ty > 608) continue;

                var ctx = R.ctx;
                var tileImg = tileImages[tile];
                if (tileImg) {
                    ctx.drawImage(tileImg, tx, ty, C.TILE_SIZE, C.TILE_SIZE);
                } else {
                    R.drawRect(tx, ty, C.TILE_SIZE, C.TILE_SIZE, C.TILE_COLORS[tile]);
                }
            }
        }

        var px = Math.floor(p.pixelX - camX);
        var py = Math.floor(p.pixelY - camY);
        var ctx = R.ctx;

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(px + 16, py + 30, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        var bob = p.moving ? Math.sin(performance.now() / 80) * 2 : 0;
        var playerImg = Game.Assets ? Game.Assets.get('player') : null;

        if (playerImg) {
            ctx.drawImage(playerImg, px, py - 4 + bob, C.TILE_SIZE, C.TILE_SIZE);
        } else {
            ctx.fillStyle = '#ee3333';
            ctx.beginPath();
            ctx.arc(px + 16, py + 14 + bob, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#cc1111';
            ctx.beginPath();
            ctx.arc(px + 16, py + 14 + bob, 10, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#ffddcc';
            ctx.beginPath();
            ctx.arc(px + 16, py + 8 + bob, 7, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fff';
            var eyeOffX = 0, eyeOffY = 0;
            if (p.direction === 'left') eyeOffX = -2;
            if (p.direction === 'right') eyeOffX = 2;
            if (p.direction === 'up') eyeOffY = -1;
            if (p.direction === 'down') eyeOffY = 1;

            if (p.direction !== 'up') {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(px + 13 + eyeOffX, py + 7 + bob + eyeOffY, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(px + 19 + eyeOffX, py + 7 + bob + eyeOffY, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#222';
                ctx.beginPath();
                ctx.arc(px + 13 + eyeOffX, py + 7.5 + bob + eyeOffY, 1.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(px + 19 + eyeOffX, py + 7.5 + bob + eyeOffY, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = '#884422';
            ctx.fillRect(px + 9, py + 1 + bob, 14, 4);
            ctx.fillRect(px + 7, py + 3 + bob, 18, 2);
        }

        ctx.restore();

        this.drawHUD(R);

        if (this.showHealMsg) {
            R.drawPanel(200, 250, 400, 60);
            R.drawText('Equipo curado!', 300, 270, { size: 16, color: '#44ff44', align: 'center' });
        }
    },

    drawHUD: function(R) {
        R.drawPanel(5, 5, 220, 25 + this.player.team.length * 22);
        for (var i = 0; i < this.player.team.length; i++) {
            var mon = this.player.team[i];
            var y = 12 + i * 22;
            var typeCol = Game.Constants.TYPE_COLORS[mon.species.type];
            R.drawRect(12, y, 8, 16, typeCol);
            R.drawText(mon.name, 26, y, { size: 8, color: '#fff', shadow: false });
            R.drawHPBar(120, y + 2, 80, mon.currentHP, mon.maxHP);
            R.drawText('Nv' + mon.level, 205, y, { size: 7, color: '#aaa', shadow: false });
        }
    }
};
