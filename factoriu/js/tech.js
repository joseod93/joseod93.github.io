var Tech = {
    completed: {},
    progress: {},

    init: function() {
        this.completed = {};
        this.progress = {};

        if (Game.prestige) {
            var autoLevel = Game.prestige.upgrades.auto_research || 0;
            if (autoLevel >= 1) this.completeResearch('automation');
            if (autoLevel >= 2) this.completeResearch('logistics');
            if (autoLevel >= 3) this.completeResearch('electric_mining');
        }
    },

    isCompleted: function(techId) {
        return !!this.completed[techId];
    },

    isUnlocked: function(buildingType) {
        var def = CFG.BUILDING_DEFS[buildingType];
        if (!def) return false;
        if (def.unlocked !== false) return true;
        if (!def.tech) return true;
        return this.isCompleted(def.tech);
    },

    isAvailable: function(techId) {
        if (this.completed[techId]) return false;
        var tech = CFG.TECH_TREE[techId];
        if (!tech) return false;
        for (var i = 0; i < tech.prereqs.length; i++) {
            if (!this.completed[tech.prereqs[i]]) return false;
        }
        return true;
    },

    addProgress: function(techId, amount) {
        if (this.completed[techId]) return;
        var tech = CFG.TECH_TREE[techId];
        if (!tech) return;

        if (!this.progress[techId]) this.progress[techId] = {};
        var totalNeeded = 0, totalDone = 0;

        for (var sciType in tech.cost) {
            if (!this.progress[techId][sciType]) this.progress[techId][sciType] = 0;
            this.progress[techId][sciType] += amount;
            totalNeeded += tech.cost[sciType];
            totalDone += Math.min(this.progress[techId][sciType], tech.cost[sciType]);
        }

        if (totalDone >= totalNeeded) {
            this.completeResearch(techId);
        }
    },

    completeResearch: function(techId) {
        this.completed[techId] = true;
        Game.stats.techsCompleted = Object.keys(this.completed).length;

        var tech = CFG.TECH_TREE[techId];
        if (tech) {
            UI.showToast('¡Investigación completada: ' + tech.name + '!', 'achievement');
            Audio.play('research');
        }

        if (Game.currentResearch === techId) {
            Game.currentResearch = null;
        }
    },

    getProgress: function(techId) {
        var tech = CFG.TECH_TREE[techId];
        if (!tech || !this.progress[techId]) return 0;
        var total = 0, done = 0;
        for (var sciType in tech.cost) {
            total += tech.cost[sciType];
            done += Math.min(this.progress[techId][sciType] || 0, tech.cost[sciType]);
        }
        return total > 0 ? done / total : 0;
    },

    getAvailableTechs: function() {
        var avail = [];
        for (var id in CFG.TECH_TREE) {
            if (this.isAvailable(id)) avail.push(id);
        }
        return avail;
    },

    getAllTechs: function() {
        var techs = [];
        for (var id in CFG.TECH_TREE) {
            techs.push({
                id: id,
                def: CFG.TECH_TREE[id],
                completed: this.isCompleted(id),
                available: this.isAvailable(id),
                progress: this.getProgress(id)
            });
        }
        return techs;
    }
};
