window.Game = window.Game || {};

Game.createMonster = function(speciesId, level) {
    var species = Game.Species[speciesId];
    var U = Game.Utils;

    var mon = {
        species: species,
        name: species.name,
        level: level,
        xp: 0,
        xpToNext: U.calcXPToNext(level),
        currentHP: 0,
        maxHP: 0,
        stats: { attack: 0, defense: 0, speed: 0 },
        moves: [],

        recalcStats: function() {
            this.maxHP = U.calcMaxHP(this.species.baseStats.hp, this.level);
            this.stats.attack = U.calcStatAtLevel(this.species.baseStats.attack, this.level);
            this.stats.defense = U.calcStatAtLevel(this.species.baseStats.defense, this.level);
            this.stats.speed = U.calcStatAtLevel(this.species.baseStats.speed, this.level);
            this.xpToNext = U.calcXPToNext(this.level);
        },

        learnMoves: function() {
            this.moves = U.getMovesForLevel(this.species, this.level);
        },

        takeDamage: function(amount) {
            this.currentHP = Math.max(0, this.currentHP - amount);
        },

        heal: function(amount) {
            if (amount === undefined) {
                this.currentHP = this.maxHP;
            } else {
                this.currentHP = Math.min(this.maxHP, this.currentHP + amount);
            }
        },

        isFainted: function() {
            return this.currentHP <= 0;
        },

        addXP: function(amount) {
            this.xp += amount;
            var leveled = [];
            while (this.xp >= this.xpToNext && this.level < 50) {
                this.xp -= this.xpToNext;
                this.level++;
                var oldMaxHP = this.maxHP;
                this.recalcStats();
                this.currentHP += (this.maxHP - oldMaxHP);
                this.learnMoves();
                leveled.push(this.level);
            }
            return leveled;
        }
    };

    mon.recalcStats();
    mon.currentHP = mon.maxHP;
    mon.learnMoves();

    return mon;
};
