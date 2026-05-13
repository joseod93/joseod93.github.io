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

        getNewMovesAtLevel: function(lvl) {
            var result = [];
            for (var i = 0; i < this.species.learnset.length; i++) {
                if (this.species.learnset[i].level === lvl) {
                    var moveData = Game.Moves[this.species.learnset[i].moveId];
                    if (!moveData) continue;
                    var known = false;
                    for (var j = 0; j < this.moves.length; j++) {
                        if (this.moves[j].id === moveData.id) { known = true; break; }
                    }
                    if (!known) result.push(moveData);
                }
            }
            return result;
        },

        addMove: function(moveData) {
            this.moves.push({
                id: moveData.id, name: moveData.name, type: moveData.type,
                power: moveData.power, accuracy: moveData.accuracy,
                category: moveData.category, pp: moveData.pp, currentPP: moveData.pp,
                priority: moveData.priority || false,
                statusEffect: moveData.statusEffect || null,
                statusChance: moveData.statusChance || 0
            });
        },

        forgetMove: function(index) {
            if (index >= 0 && index < this.moves.length) {
                this.moves.splice(index, 1);
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

        canEvolve: function() {
            return this.species.evolution && this.level >= this.species.evolution.level;
        },

        evolve: function() {
            if (!this.canEvolve()) return false;
            var newSpecies = Game.Species[this.species.evolution.to];
            if (!newSpecies) return false;
            var hpRatio = this.currentHP / this.maxHP;
            this.species = newSpecies;
            this.name = newSpecies.name;
            this.recalcStats();
            this.currentHP = Math.max(1, Math.floor(this.maxHP * hpRatio));
            Game.Sprites.clearCache();
            return true;
        },

        addXP: function(amount) {
            this.xp += amount;
            var leveled = [];
            var pendingMoves = [];
            var evolutionReady = false;

            while (this.xp >= this.xpToNext && this.level < 50) {
                this.xp -= this.xpToNext;
                this.level++;
                var oldMaxHP = this.maxHP;
                this.recalcStats();
                this.currentHP += (this.maxHP - oldMaxHP);

                var newMoves = this.getNewMovesAtLevel(this.level);
                for (var m = 0; m < newMoves.length; m++) {
                    if (this.moves.length < 4) {
                        this.addMove(newMoves[m]);
                    } else {
                        pendingMoves.push(newMoves[m]);
                    }
                }

                if (this.canEvolve()) evolutionReady = true;
                leveled.push(this.level);
            }

            return {
                levels: leveled,
                pendingMoves: pendingMoves,
                evolutionReady: evolutionReady
            };
        }
    };

    mon.recalcStats();
    mon.currentHP = mon.maxHP;
    mon.learnMoves();
    return mon;
};
