if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (typeof r === 'number') r = [r, r, r, r];
        var rad = r[0] || 0;
        this.moveTo(x + rad, y);
        this.lineTo(x + w - rad, y);
        this.arcTo(x + w, y, x + w, y + rad, rad);
        this.lineTo(x + w, y + h - rad);
        this.arcTo(x + w, y + h, x + w - rad, y + h, rad);
        this.lineTo(x + rad, y + h);
        this.arcTo(x, y + h, x, y + h - rad, rad);
        this.lineTo(x, y + rad);
        this.arcTo(x, y, x + rad, y, rad);
        this.closePath();
        return this;
    };
}

window.Game = window.Game || {};

Game.Utils = {
    random: function(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    chance: function(probability) {
        return Math.random() < probability;
    },

    clamp: function(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    lerp: function(a, b, t) {
        return a + (b - a) * t;
    },

    pick: function(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    calcStatAtLevel: function(baseStat, level) {
        return Math.floor(baseStat * (1 + (level - 1) * 0.12));
    },

    calcMaxHP: function(baseHP, level) {
        return Math.floor(baseHP * (1 + (level - 1) * 0.15)) + 10;
    },

    calcDamage: function(attacker, defender, move) {
        var C = Game.Constants;
        var level = attacker.level;
        var power = move.power;
        var atk = move.category === 'physical' ? attacker.stats.attack : attacker.stats.spAttack;
        var def = move.category === 'physical' ? defender.stats.defense : defender.stats.spDefense;

        if (move.category === 'physical' && attacker.status === 'burn') {
            atk = Math.floor(atk * 0.5);
        }

        var base = ((2 * level / 5 + 2) * power * (atk / def)) / 50 + 2;

        var stab = (move.type === attacker.species.type) ? C.STAB_MULTIPLIER : 1;
        var typeEff = C.TYPE_CHART[move.type] && C.TYPE_CHART[move.type][defender.species.type];
        if (typeEff === undefined) typeEff = 1;
        var crit = Game.Utils.chance(C.CRIT_RATE) ? C.CRIT_MULTIPLIER : 1;
        var rand = (Game.Utils.random(85, 100)) / 100;

        var damage = Math.floor(base * stab * typeEff * crit * rand);
        if (damage < 1) damage = 1;

        return {
            damage: damage,
            critical: crit > 1,
            effectiveness: typeEff,
            missed: !Game.Utils.chance(move.accuracy / 100)
        };
    },

    calcXP: function(baseYield, defeatedLevel) {
        return Math.floor(baseYield * defeatedLevel / 5 + 10);
    },

    calcXPToNext: function(level) {
        return Math.floor(Game.Constants.XP_BASE * Math.pow(level, Game.Constants.LEVEL_SCALE));
    },

    getMovesForLevel: function(species, level) {
        var moves = [];
        for (var i = 0; i < species.learnset.length; i++) {
            if (species.learnset[i].level <= level) {
                moves.push(Game.Moves[species.learnset[i].moveId]);
            }
        }
        while (moves.length > 4) {
            moves.shift();
        }
        return moves;
    }
};
