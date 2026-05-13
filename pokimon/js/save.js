window.Game = window.Game || {};

Game.Save = {
    KEY: 'monsterBattle',

    save: function() {
        var ow = Game.Overworld;
        if (!ow.player) return;

        var teamData = [];
        for (var i = 0; i < ow.player.team.length; i++) {
            var mon = ow.player.team[i];
            var moves = [];
            for (var j = 0; j < mon.moves.length; j++) {
                moves.push({ moveId: mon.moves[j].id, currentPP: mon.moves[j].currentPP });
            }
            teamData.push({
                speciesId: mon.species.id,
                level: mon.level,
                xp: mon.xp,
                currentHP: mon.currentHP,
                status: mon.status,
                moves: moves
            });
        }

        var data = {
            version: 1,
            team: teamData,
            position: {
                gridX: ow.player.gridX,
                gridY: ow.player.gridY,
                direction: ow.player.direction
            },
            inventory: Game.Inventory ? JSON.parse(JSON.stringify(Game.Inventory.items)) : {}
        };

        try {
            localStorage.setItem(this.KEY, JSON.stringify(data));
        } catch (e) {}
    },

    load: function() {
        try {
            var raw = localStorage.getItem(this.KEY);
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (!data || data.version !== 1) return null;

            var team = [];
            for (var i = 0; i < data.team.length; i++) {
                var td = data.team[i];
                var mon = Game.createMonster(td.speciesId, td.level);
                mon.xp = td.xp;
                mon.currentHP = td.currentHP;
                mon.status = td.status || null;

                if (td.moves && td.moves.length > 0) {
                    for (var j = 0; j < mon.moves.length; j++) {
                        for (var k = 0; k < td.moves.length; k++) {
                            if (mon.moves[j].id === td.moves[k].moveId) {
                                mon.moves[j].currentPP = td.moves[k].currentPP;
                                break;
                            }
                        }
                    }
                }

                team.push(mon);
            }

            if (Game.Inventory && data.inventory) {
                Game.Inventory.items = data.inventory;
            }

            return {
                team: team,
                position: data.position
            };
        } catch (e) {
            return null;
        }
    },

    exists: function() {
        try {
            return localStorage.getItem(this.KEY) !== null;
        } catch (e) {
            return false;
        }
    },

    clear: function() {
        try {
            localStorage.removeItem(this.KEY);
        } catch (e) {}
    }
};
