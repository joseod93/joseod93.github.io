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
        stats: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 },
        moves: [],
        status: null,

        recalcStats: function() {
            this.maxHP = U.calcMaxHP(this.species.baseStats.hp, this.level);
            this.stats.attack = U.calcStatAtLevel(this.species.baseStats.attack, this.level);
            this.stats.defense = U.calcStatAtLevel(this.species.baseStats.defense, this.level);
            this.stats.spAttack = U.calcStatAtLevel(this.species.baseStats.spAttack, this.level);
            this.stats.spDefense = U.calcStatAtLevel(this.species.baseStats.spDefense, this.level);
            this.stats.speed = U.calcStatAtLevel(this.species.baseStats.speed, this.level);
            this.xpToNext = U.calcXPToNext(this.level);
        },

        learnMoves: function() {
            var baseMoves = U.getMovesForLevel(this.species, this.level);
            this.moves = [];
            for (var i = 0; i < baseMoves.length; i++) {
                var m = baseMoves[i];
                this.moves.push({
                    id: m.id, name: m.name, type: m.type,
                    power: m.power, accuracy: m.accuracy,
                    category: m.category, pp: m.pp, currentPP: m.pp,
                    priority: m.priority || false,
                    statusEffect: m.statusEffect || null,
                    statusChance: m.statusChance || 0
                });
            }
        },

        takeDamage: function(amount) {
            this.currentHP = Math.max(0, this.currentHP - amount);
        },

        heal: function(amount) {
            if (amount === undefined) {
                this.currentHP = this.maxHP;
                this.status = null;
                this.restorePP();
            } else {
                this.currentHP = Math.min(this.maxHP, this.currentHP + amount);
            }
        },

        restorePP: function() {
            for (var i = 0; i < this.moves.length; i++) {
                this.moves[i].currentPP = this.moves[i].pp;
            }
        },

        isFainted: function() {
            return this.currentHP <= 0;
        },

        setStatus: function(status) {
            if (this.status !== null) return false;
            this.status = status;
            return true;
        },

        clearStatus: function() {
            this.status = null;
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
