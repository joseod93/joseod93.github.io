window.Game = window.Game || {};

Game.Overworld = {
    player: null,
    map: null,
    showHealMsg: false,
    healMsgTimer: 0,
    healMsgText: 'Equipo curado!',
    encounterTriggered: false,
    npcs: [],
    defeatedNPCs: [],
    pauseOpen: false,
    pauseCursor: 0,
    pauseSubState: null,
    pauseTeamCursor: 0,
    pauseItemCursor: 0,
    pauseItemTargetCursor: 0,
    pausePendingItem: null,
    npcWalkTimer: 0,
    npcBattlePending: null,

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
            stepCount: 0,
            walkFrame: 0,
            walkTimer: 0
        };
        this.map = Game.MapData;
        this.showHealMsg = false;
        this.encounterTriggered = false;
        this.pauseOpen = false;
        this.pauseSubState = null;
        this.npcBattlePending = null;
        this.initNPCs();
        if (Game.Tilemap) Game.Tilemap.invalidate();
    },

    initNPCs: function() {
        this.npcs = [];
        for (var i = 0; i < Game.NPCData.length; i++) {
            var d = Game.NPCData[i];
            var defeated = false;
            for (var j = 0; j < this.defeatedNPCs.length; j++) {
                if (this.defeatedNPCs[j] === d.id) { defeated = true; break; }
            }
            this.npcs.push({
                id: d.id, x: d.x, y: d.y, direction: d.direction,
                sight: d.sight, name: d.name, sprite: d.sprite,
                team: d.team, preText: d.preText, postText: d.postText,
                reward: d.reward, defeated: defeated
            });
        }
    },

    defeatNPC: function(npcId) {
        for (var i = 0; i < this.npcs.length; i++) {
            if (this.npcs[i].id === npcId) this.npcs[i].defeated = true;
        }
        var found = false;
        for (var j = 0; j < this.defeatedNPCs.length; j++) {
            if (this.defeatedNPCs[j] === npcId) { found = true; break; }
        }
        if (!found) this.defeatedNPCs.push(npcId);
    },

    update: function(dt) {
        var p = this.player;
        var C = Game.Constants;
        var input = Game.Input;

        if (this.npcBattlePending) {
            this.npcWalkTimer -= dt;
            if (this.npcWalkTimer <= 0) {
                var npc = this.npcBattlePending;
                this.npcBattlePending = null;
                return { type: 'trainer', npc: npc };
            }
            return null;
        }

        if (this.pauseOpen) {
            this.updatePause();
            return null;
        }

        if (this.showHealMsg) {
            this.healMsgTimer -= dt;
            if (this.healMsgTimer <= 0) this.showHealMsg = false;
            return null;
        }

        if (input.cancel() && !p.moving) {
            this.openPause();
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

            p.walkTimer += dt;
            if (p.walkTimer > 0.15) {
                p.walkFrame = (p.walkFrame + 1) % 2;
                p.walkTimer = 0;
            }

            if (p.pixelX === p.targetX && p.pixelY === p.targetY) {
                p.moving = false;
                p.gridX = p.targetX / C.TILE_SIZE;
                p.gridY = p.targetY / C.TILE_SIZE;
                p.walkFrame = 0;
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
            } else if (tile === C.TILE_SHOP) {
                Game.Audio.playShop();
                return { type: 'shop' };
            }
        }

        return null;
    },

    onStepComplete: function() {
        var C = Game.Constants;
        var tile = this.getTile(this.player.gridX, this.player.gridY);

        var npcBattle = this.checkNPCSight();
        if (npcBattle) return npcBattle;

        if (tile === C.TILE_GRASS) {
            this.player.stepCount++;
            if (Game.Utils.chance(C.ENCOUNTER_RATE)) {
                return this.triggerEncounter();
            }
        }
        return null;
    },

    checkNPCSight: function() {
        var px = this.player.gridX;
        var py = this.player.gridY;

        for (var i = 0; i < this.npcs.length; i++) {
            var npc = this.npcs[i];
            if (npc.defeated) continue;

            var inSight = false;
            switch (npc.direction) {
                case 'right':
                    if (py === npc.y && px > npc.x && px <= npc.x + npc.sight) inSight = true;
                    break;
                case 'left':
                    if (py === npc.y && px < npc.x && px >= npc.x - npc.sight) inSight = true;
                    break;
                case 'down':
                    if (px === npc.x && py > npc.y && py <= npc.y + npc.sight) inSight = true;
                    break;
                case 'up':
                    if (px === npc.x && py < npc.y && py >= npc.y - npc.sight) inSight = true;
                    break;
            }

            if (inSight) {
                this.npcBattlePending = npc;
                this.npcWalkTimer = 0.6;
                Game.Audio.playEncounter();
                return null;
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
        if (this.getTile(x, y) === Game.Constants.TILE_WALL) return false;
        for (var i = 0; i < this.npcs.length; i++) {
            if (this.npcs[i].x === x && this.npcs[i].y === y) return false;
        }
        return true;
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
        this.healMsgText = 'Equipo curado!';
        Game.Audio.playHeal();
        if (Game.Save) Game.Save.save();
    },

    openPause: function() {
        this.pauseOpen = true;
        this.pauseCursor = 0;
        this.pauseSubState = null;
        Game.Audio.playConfirm();
    },

    updatePause: function() {
        var input = Game.Input;

        if (this.pauseSubState === 'TEAM') {
            this.updatePauseTeam();
            return;
        }
        if (this.pauseSubState === 'BAG') {
            this.updatePauseBag();
            return;
        }
        if (this.pauseSubState === 'BAG_TARGET') {
            this.updatePauseBagTarget();
            return;
        }

        var old = this.pauseCursor;
        if (input.up() && this.pauseCursor > 0) this.pauseCursor--;
        if (input.down() && this.pauseCursor < 3) this.pauseCursor++;
        if (this.pauseCursor !== old) Game.Audio.playSelect();

        if (input.cancel()) {
            this.pauseOpen = false;
            Game.Audio.playCancel();
            return;
        }

        if (input.confirm()) {
            Game.Audio.playConfirm();
            switch (this.pauseCursor) {
                case 0:
                    this.pauseSubState = 'TEAM';
                    this.pauseTeamCursor = 0;
                    break;
                case 1:
                    this.pauseSubState = 'BAG';
                    this.pauseItemCursor = 0;
                    break;
                case 2:
                    Game.Save.save();
                    this.pauseOpen = false;
                    this.showHealMsg = true;
                    this.healMsgTimer = 1.5;
                    this.healMsgText = 'Partida guardada!';
                    break;
                case 3:
                    this.pauseOpen = false;
                    break;
            }
        }
    },

    updatePauseTeam: function() {
        var input = Game.Input;
        var teamLen = this.player.team.length;
        var old = this.pauseTeamCursor;
        if (input.up() && this.pauseTeamCursor > 0) this.pauseTeamCursor--;
        if (input.down() && this.pauseTeamCursor < teamLen - 1) this.pauseTeamCursor++;
        if (this.pauseTeamCursor !== old) Game.Audio.playSelect();
        if (input.cancel()) {
            this.pauseSubState = null;
            Game.Audio.playCancel();
        }
    },

    updatePauseBag: function() {
        var input = Game.Input;
        var items = Game.Inventory.getFieldItems();
        var old = this.pauseItemCursor;
        if (input.up() && this.pauseItemCursor > 0) this.pauseItemCursor--;
        if (input.down() && this.pauseItemCursor < items.length - 1) this.pauseItemCursor++;
        if (this.pauseItemCursor !== old) Game.Audio.playSelect();
        if (input.cancel()) {
            this.pauseSubState = null;
            Game.Audio.playCancel();
            return;
        }
        if (input.confirm() && items.length > 0) {
            var item = items[this.pauseItemCursor];
            this.pausePendingItem = item.id;
            this.pauseItemTargetCursor = 0;
            this.pauseSubState = 'BAG_TARGET';
            Game.Audio.playConfirm();
        }
    },

    updatePauseBagTarget: function() {
        var input = Game.Input;
        var targets = this.getFieldItemTargets(this.pausePendingItem);
        var old = this.pauseItemTargetCursor;
        if (input.up() && this.pauseItemTargetCursor > 0) this.pauseItemTargetCursor--;
        if (input.down() && this.pauseItemTargetCursor < targets.length - 1) this.pauseItemTargetCursor++;
        if (this.pauseItemTargetCursor !== old) Game.Audio.playSelect();
        if (input.cancel()) {
            this.pauseSubState = 'BAG';
            Game.Audio.playCancel();
            return;
        }
        if (input.confirm() && targets.length > 0) {
            var targetIdx = targets[this.pauseItemTargetCursor];
            var mon = this.player.team[targetIdx];
            var def = Game.Items[this.pausePendingItem];

            if (def.type === 'heal') {
                if (mon.currentHP >= mon.maxHP || mon.isFainted()) { Game.Audio.playError(); return; }
                mon.heal(def.value);
            } else if (def.type === 'status') {
                if (!mon.status || mon.isFainted()) { Game.Audio.playError(); return; }
                mon.clearStatus();
            }

            Game.Inventory.remove(this.pausePendingItem);
            Game.Audio.playHeal();
            this.pauseSubState = 'BAG';
        }
    },

    getFieldItemTargets: function(itemId) {
        var def = Game.Items[itemId];
        var targets = [];
        for (var i = 0; i < this.player.team.length; i++) {
            var mon = this.player.team[i];
            if (def.type === 'heal' && !mon.isFainted() && mon.currentHP < mon.maxHP) targets.push(i);
            else if (def.type === 'status' && !mon.isFainted() && mon.status !== null) targets.push(i);
        }
        return targets;
    },

    // ===================== RENDERING =====================

    draw: function() {
        var R = Game.Renderer;
        var C = Game.Constants;
        var p = this.player;
        var ctx = R.ctx;
        var t = performance.now();

        var camX = Math.floor(p.pixelX - 400 + C.TILE_SIZE / 2);
        var camY = Math.floor(p.pixelY - 304 + C.TILE_SIZE / 2);
        camX = Game.Utils.clamp(camX, 0, C.MAP_COLS * C.TILE_SIZE - 800);
        camY = Game.Utils.clamp(camY, 0, C.MAP_ROWS * C.TILE_SIZE - 608);

        R.clear('#111');

        Game.Tilemap.drawGround(ctx, camX, camY);

        this.drawAnimatedOverlays(ctx, camX, camY, C, t);

        this.drawYSorted(R, ctx, p, camX, camY, C, t);

        Game.Tilemap.drawCanopy(ctx, camX, camY);

        this.drawHUD(R);

        if (this.showHealMsg) {
            R.drawPanel(200, 250, 400, 60);
            R.drawText(this.healMsgText, 300, 270, { size: 16, color: '#44ff44', align: 'center' });
        }

        if (this.npcBattlePending) {
            R.drawPanel(200, 250, 400, 60);
            R.drawText(this.npcBattlePending.name + ' te desafia!', 300, 270, { size: 14, color: '#ff4444', align: 'center' });
        }

        if (this.pauseOpen) {
            this.drawPause(R, ctx);
        }
    },

    drawAnimatedOverlays: function(ctx, camX, camY, C, t) {
        for (var row = 0; row < C.MAP_ROWS; row++) {
            for (var col = 0; col < C.MAP_COLS; col++) {
                var tile = this.map.tiles[row][col];
                var tx = col * C.TILE_SIZE - camX;
                var ty = row * C.TILE_SIZE - camY;

                if (tx < -C.TILE_SIZE || tx > 800 || ty < -C.TILE_SIZE || ty > 608) continue;

                if (tile === C.TILE_GRASS) {
                    var sway = Math.sin(t / 600 + col * 0.8 + row * 0.5);
                    for (var g = 0; g < 3; g++) {
                        var gx = tx + 4 + g * 9 + ((col + g) % 3);
                        var gy = ty + 8 + (g % 2) * 5;
                        var lean = sway * 2.5;
                        ctx.fillStyle = g % 2 === 0 ? 'rgba(40,130,28,0.65)' : 'rgba(70,180,42,0.65)';
                        ctx.beginPath();
                        ctx.moveTo(gx, gy + 14);
                        ctx.quadraticCurveTo(gx + lean, gy, gx + 2 + lean, gy - 3);
                        ctx.lineTo(gx + 3 + lean, gy);
                        ctx.quadraticCurveTo(gx + 3, gy + 7, gx + 3, gy + 14);
                        ctx.fill();
                    }
                }

                if (tile === C.TILE_HEAL) {
                    var pulse = 0.4 + Math.sin(t / 400) * 0.3;
                    ctx.globalAlpha = pulse;
                    ctx.fillStyle = 'rgba(255,90,120,0.35)';
                    ctx.beginPath();
                    ctx.arc(tx + 16, ty + 16, 18, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = 'rgba(255,70,100,0.7)';
                    ctx.fillRect(tx + 12, ty + 6, 8, 20);
                    ctx.fillRect(tx + 6, ty + 12, 20, 8);
                }

                if (tile === C.TILE_SHOP) {
                    var shopPulse = 0.6 + Math.sin(t / 500) * 0.2;
                    ctx.globalAlpha = shopPulse;
                    ctx.fillStyle = '#ffdd44';
                    ctx.font = '14px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText('$', tx + 16, ty + 22);
                    ctx.globalAlpha = 1;
                }
            }
        }
    },

    drawYSorted: function(R, ctx, p, camX, camY, C, t) {
        var entities = [];

        entities.push({
            type: 'player',
            sortY: p.pixelY + C.TILE_SIZE
        });

        for (var i = 0; i < this.npcs.length; i++) {
            entities.push({
                type: 'npc',
                index: i,
                sortY: this.npcs[i].y * C.TILE_SIZE + C.TILE_SIZE
            });
        }

        var trunks = Game.Tilemap.getTrunkPositions();
        for (var i = 0; i < trunks.length; i++) {
            entities.push({
                type: 'trunk',
                data: trunks[i],
                sortY: trunks[i].y + C.TILE_SIZE
            });
        }

        entities.sort(function(a, b) { return a.sortY - b.sortY; });

        for (var i = 0; i < entities.length; i++) {
            var e = entities[i];
            if (e.type === 'player') {
                this.drawPlayer(R, ctx, p, camX, camY, C, t);
            } else if (e.type === 'npc') {
                this.drawSingleNPC(ctx, this.npcs[e.index], camX, camY, C, t);
            } else if (e.type === 'trunk') {
                Game.Tilemap.drawTrunk(ctx, e.data, camX, camY);
            }
        }
    },

    drawSingleNPC: function(ctx, npc, camX, camY, C, t) {
        var nx = npc.x * C.TILE_SIZE - camX;
        var ny = npc.y * C.TILE_SIZE - camY;

        if (nx < -C.TILE_SIZE || nx > 800 || ny < -C.TILE_SIZE || ny > 608) return;

        ctx.save();
        if (npc.defeated) ctx.globalAlpha = 0.5;

        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(nx + 16, ny + 30, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        var bob = Math.sin(t / 800 + npc.x * 2) * 1.5;

        ctx.fillStyle = npc.sprite;
        ctx.beginPath();
        ctx.arc(nx + 16, ny + 14 + bob, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffddcc';
        ctx.beginPath();
        ctx.arc(nx + 16, ny + 8 + bob, 7, 0, Math.PI * 2);
        ctx.fill();

        if (npc.direction !== 'up') {
            var eyeX = npc.direction === 'left' ? -2 : (npc.direction === 'right' ? 2 : 0);
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(nx + 13 + eyeX, ny + 7 + bob, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(nx + 19 + eyeX, ny + 7 + bob, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        if (!npc.defeated) {
            ctx.fillStyle = '#ff3333';
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('!', nx + 16, ny - 4 + bob);
        }

        ctx.restore();
    },

    drawPlayer: function(R, ctx, p, camX, camY, C, t) {
        var px = Math.floor(p.pixelX - camX);
        var py = Math.floor(p.pixelY - camY);

        ctx.save();

        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(px + 16, py + 30, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        var bob = p.moving ? Math.sin(t / 80) * 2 : 0;
        var tilt = 0;
        if (p.moving) {
            tilt = Math.sin(t / 100) * 0.08;
        }

        var dirKey = 'player_' + p.direction;
        var playerImg = Game.Assets ? Game.Assets.get(dirKey) : null;

        if (playerImg) {
            ctx.translate(px + 16, py + 16 + bob);
            ctx.rotate(tilt);
            ctx.drawImage(playerImg, -16, -20, C.TILE_SIZE, C.TILE_SIZE);
        } else {
            ctx.translate(px + 16, py + 16 + bob);
            ctx.rotate(tilt);

            ctx.fillStyle = '#ee3333';
            ctx.beginPath();
            ctx.arc(0, -2, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffddcc';
            ctx.beginPath();
            ctx.arc(0, -8, 7, 0, Math.PI * 2);
            ctx.fill();

            if (p.direction !== 'up') {
                var eyeOffX = 0;
                if (p.direction === 'left') eyeOffX = -2;
                if (p.direction === 'right') eyeOffX = 2;
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(-3 + eyeOffX, -9, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(3 + eyeOffX, -9, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#222';
                ctx.beginPath();
                ctx.arc(-3 + eyeOffX, -8.5, 1.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(3 + eyeOffX, -8.5, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = '#884422';
            ctx.fillRect(-7, -15, 14, 4);
            ctx.fillRect(-9, -13, 18, 2);
        }

        ctx.restore();
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
        R.drawText('$' + Game.Inventory.money, 5, 30 + this.player.team.length * 22, { size: 8, color: '#ffdd44', shadow: false });
    },

    drawPause: function(R, ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, 800, 608);

        if (this.pauseSubState === 'TEAM') {
            this.drawPauseTeam(R); return;
        }
        if (this.pauseSubState === 'BAG' || this.pauseSubState === 'BAG_TARGET') {
            this.drawPauseBag(R); return;
        }

        R.drawPanel(280, 150, 240, 280);
        R.drawText('PAUSA', 400, 170, { size: 16, color: '#fff', align: 'center' });

        var options = ['EQUIPO', 'MOCHILA', 'GUARDAR', 'CERRAR'];
        for (var i = 0; i < 4; i++) {
            var sel = this.pauseCursor === i;
            var y = 220 + i * 45;
            R.drawText((sel ? '> ' : '  ') + options[i], 320, y, { size: 14, color: sel ? '#ffdd44' : '#ccc' });
        }

        R.drawText('[ESC] Cerrar', 400, 410, { size: 8, color: '#666', align: 'center' });
    },

    drawPauseTeam: function(R) {
        R.drawPanel(100, 50, 600, 500);
        R.drawText('EQUIPO', 400, 70, { size: 16, color: '#fff', align: 'center' });

        for (var i = 0; i < this.player.team.length; i++) {
            var mon = this.player.team[i];
            var sel = this.pauseTeamCursor === i;
            var y = 110 + i * 70;

            if (sel) {
                R.drawRect(120, y - 5, 560, 60, 'rgba(255,255,255,0.08)');
            }

            var typeCol = Game.Constants.TYPE_COLORS[mon.species.type];
            R.drawRect(130, y, 12, 40, typeCol);

            R.drawText((sel ? '> ' : '  ') + mon.name, 155, y + 2, { size: 14, color: sel ? '#ffdd44' : '#fff' });
            R.drawText('Nv.' + mon.level, 350, y + 2, { size: 10, color: '#ccc' });

            R.drawHPBar(155, y + 28, 180, mon.currentHP, mon.maxHP);
            R.drawText(mon.currentHP + '/' + mon.maxHP, 340, y + 26, { size: 8, color: '#aaa' });

            if (mon.status) {
                var sColor = Game.BattleUI.STATUS_COLORS[mon.status] || '#888';
                var sLabel = Game.BattleUI.STATUS_LABELS[mon.status] || '???';
                R.ctx.fillStyle = sColor;
                R.ctx.beginPath();
                R.ctx.roundRect(420, y + 5, 32, 14, 3);
                R.ctx.fill();
                R.drawText(sLabel, 424, y + 7, { size: 7, color: '#fff', shadow: false });
            }

            var stats = 'ATK:' + mon.stats.attack + ' DEF:' + mon.stats.defense + ' VEL:' + mon.stats.speed;
            R.drawText(stats, 470, y + 5, { size: 7, color: '#888' });

            for (var m = 0; m < mon.moves.length; m++) {
                R.drawText(mon.moves[m].name, 470 + (m % 2) * 120, y + 22 + Math.floor(m / 2) * 14, { size: 7, color: '#aaa' });
            }
        }

        R.drawText('[ESC] Volver', 400, 530, { size: 8, color: '#666', align: 'center' });
    },

    drawPauseBag: function(R) {
        R.drawPanel(100, 50, 600, 500);
        R.drawText('MOCHILA', 300, 70, { size: 16, color: '#fff' });
        R.drawText('$' + Game.Inventory.money, 550, 70, { size: 14, color: '#ffdd44' });

        var items = Game.Inventory.getFieldItems();

        if (items.length === 0) {
            R.drawText('Sin objetos usables...', 300, 250, { size: 12, color: '#888' });
        } else {
            for (var i = 0; i < items.length; i++) {
                var sel = this.pauseItemCursor === i;
                var def = Game.Items[items[i].id];
                var y = 110 + i * 35;
                R.drawText((sel ? '> ' : '  ') + def.name + ' x' + items[i].count, 150, y, { size: 12, color: sel ? '#ffdd44' : '#fff' });
                if (sel) R.drawText(def.description, 450, y, { size: 9, color: '#aaa' });
            }
        }

        if (this.pauseSubState === 'BAG_TARGET') {
            var targets = this.getFieldItemTargets(this.pausePendingItem);
            R.drawPanel(400, 150, 250, 30 + targets.length * 30);
            R.drawText('Usar en:', 420, 160, { size: 10, color: '#ccc' });
            for (var j = 0; j < targets.length; j++) {
                var mon = this.player.team[targets[j]];
                var tSel = this.pauseItemTargetCursor === j;
                var ty = 185 + j * 28;
                R.drawText((tSel ? '> ' : '  ') + mon.name + ' HP:' + mon.currentHP + '/' + mon.maxHP, 420, ty, { size: 10, color: tSel ? '#ffdd44' : '#fff' });
            }
        }

        R.drawText('[ESC] Volver', 400, 530, { size: 8, color: '#666', align: 'center' });
    }
};
