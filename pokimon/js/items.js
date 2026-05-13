window.Game = window.Game || {};

Game.Items = {
    potion:      { id: 'potion',      name: 'Pocion',       description: 'Cura 50 HP',         type: 'heal',    value: 50,  price: 100 },
    superPotion: { id: 'superPotion', name: 'Super Pocion', description: 'Cura 100 HP',        type: 'heal',    value: 100, price: 300 },
    antidote:    { id: 'antidote',    name: 'Antidoto',     description: 'Cura estado alter.',  type: 'status',              price: 50 },
    revive:      { id: 'revive',      name: 'Revivir',      description: 'Revive con 50% HP',   type: 'revive',              price: 500 },
    pokeball:    { id: 'pokeball',    name: 'Pokeball',     description: 'Captura monstruos',   type: 'capture',             price: 150 }
};

Game.ShopItems = ['potion', 'superPotion', 'antidote', 'revive', 'pokeball'];

Game.Inventory = {
    items: {},
    money: 500,

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

    getBattleItems: function() {
        var result = [];
        var keys = Object.keys(this.items);
        for (var i = 0; i < keys.length; i++) {
            if (this.items[keys[i]] > 0) {
                result.push({ id: keys[i], count: this.items[keys[i]] });
            }
        }
        return result;
    },

    getFieldItems: function() {
        var result = [];
        var keys = Object.keys(this.items);
        for (var i = 0; i < keys.length; i++) {
            if (this.items[keys[i]] > 0) {
                var def = Game.Items[keys[i]];
                if (def && (def.type === 'heal' || def.type === 'status')) {
                    result.push({ id: keys[i], count: this.items[keys[i]] });
                }
            }
        }
        return result;
    },

    reset: function() {
        this.items = {};
        this.money = 500;
    }
};
