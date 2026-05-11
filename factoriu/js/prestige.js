var Prestige = {
    points: 0,
    totalPoints: 0,
    upgrades: {},
    runs: [],
    lifetimeStats: {
        itemsProduced: 0,
        buildingsPlaced: 0,
        rocketsLaunched: 0,
        totalTicks: 0
    },

    init: function(data) {
        if (data) {
            this.points = data.points || 0;
            this.totalPoints = data.totalPoints || 0;
            this.upgrades = data.upgrades || {};
            this.runs = data.runs || [];
            this.lifetimeStats = data.lifetimeStats || this.lifetimeStats;
        }
    },

    canPrestige: function() {
        return Game.stats.rocketsLaunched > 0;
    },

    calculatePoints: function() {
        var pts = 0;
        var produced = Game.stats.itemsProduced;
        for (var item in produced) {
            pts += Math.floor(produced[item] / 100);
        }
        pts += Math.floor(Game.stats.buildingsPlaced / 10);
        pts += Game.stats.rocketsLaunched * 50;

        var tickBonus = Math.max(0, 100000 - Game.tick) / 10000;
        pts += Math.floor(tickBonus);

        return Math.max(1, pts);
    },

    doPrestige: function() {
        if (!this.canPrestige()) return;

        var earned = this.calculatePoints();
        this.points += earned;
        this.totalPoints += earned;

        this.runs.push({
            ticks: Game.tick,
            points: earned,
            rockets: Game.stats.rocketsLaunched,
            date: Date.now()
        });

        var produced = Game.stats.itemsProduced;
        for (var item in produced) {
            this.lifetimeStats.itemsProduced += produced[item];
        }
        this.lifetimeStats.buildingsPlaced += Game.stats.buildingsPlaced;
        this.lifetimeStats.rocketsLaunched += Game.stats.rocketsLaunched;
        this.lifetimeStats.totalTicks += Game.tick;

        Game.resetForPrestige();

        UI.showToast('¡Prestigio! +' + earned + ' Puntos de Fábrica', 'achievement');
        Audio.play('milestone');
    },

    buyUpgrade: function(upgradeId) {
        var upDef = null;
        for (var i = 0; i < CFG.PRESTIGE_UPGRADES.length; i++) {
            if (CFG.PRESTIGE_UPGRADES[i].id === upgradeId) {
                upDef = CFG.PRESTIGE_UPGRADES[i];
                break;
            }
        }
        if (!upDef) return false;

        var currentLevel = this.upgrades[upgradeId] || 0;
        if (currentLevel >= upDef.max) return false;

        var cost = upDef.cost * (currentLevel + 1);
        if (this.points < cost) return false;

        this.points -= cost;
        this.upgrades[upgradeId] = currentLevel + 1;
        return true;
    },

    getUpgradeLevel: function(upgradeId) {
        return this.upgrades[upgradeId] || 0;
    },

    getUpgradeCost: function(upgradeId) {
        var upDef = null;
        for (var i = 0; i < CFG.PRESTIGE_UPGRADES.length; i++) {
            if (CFG.PRESTIGE_UPGRADES[i].id === upgradeId) { upDef = CFG.PRESTIGE_UPGRADES[i]; break; }
        }
        if (!upDef) return Infinity;
        var currentLevel = this.upgrades[upgradeId] || 0;
        return upDef.cost * (currentLevel + 1);
    },

    getSaveData: function() {
        return {
            points: this.points,
            totalPoints: this.totalPoints,
            upgrades: this.upgrades,
            runs: this.runs,
            lifetimeStats: this.lifetimeStats
        };
    }
};
