window.Game = window.Game || {};

Game.Items = {
    potion:      { id: 'potion',      name: 'Pocion',       description: 'Cura 50 HP',        type: 'heal',   value: 50 },
    superPotion: { id: 'superPotion', name: 'Super Pocion', description: 'Cura 100 HP',       type: 'heal',   value: 100 },
    antidote:    { id: 'antidote',    name: 'Antidoto',     description: 'Cura estado alter.', type: 'status' },
    revive:      { id: 'revive',      name: 'Revivir',      description: 'Revive con 50% HP',  type: 'revive' }
};

Game.Inventory = {
    items: {},

    add: function(itemId, count) {
        count = count || 1;
        this.items[itemId] = (this.items[itemId] || 0) + count;
    },

    remove: function(itemId) {
        if (this.items[itemId] && this.items[itemId] > 0) {
            this.items[itemId]--;
            if (this.items[itemId] <= 0) delete this.items[itemId];
            return true;
        }
        return false;
    },

    count: function(itemId) {
        return this.items[itemId] || 0;
    },

    hasAny: function() {
        var keys = Object.keys(this.items);
        for (var i = 0; i < keys.length; i++) {
            if (this.items[keys[i]] > 0) return true;
        }
        return false;
    },

    getAvailable: function() {
        var result = [];
        var keys = Object.keys(this.items);
        for (var i = 0; i < keys.length; i++) {
            if (this.items[keys[i]] > 0) {
                result.push({ id: keys[i], count: this.items[keys[i]] });
            }
        }
        return result;
    },

    reset: function() {
        this.items = {};
    }
};
