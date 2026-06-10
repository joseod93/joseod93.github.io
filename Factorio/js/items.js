var Items = {
    defs: {
        iron_ore:         {name:'Mineral Hierro',    stack:50, category:'raw'},
        copper_ore:       {name:'Mineral Cobre',     stack:50, category:'raw'},
        coal:             {name:'Carbón',            stack:50, category:'raw'},
        stone:            {name:'Piedra',            stack:50, category:'raw'},
        iron_plate:       {name:'Placa Hierro',      stack:100, category:'smelted'},
        copper_plate:     {name:'Placa Cobre',       stack:100, category:'smelted'},
        steel:            {name:'Acero',             stack:100, category:'smelted'},
        stone_brick:      {name:'Ladrillo',          stack:100, category:'smelted'},
        iron_gear:        {name:'Engranaje',         stack:100, category:'intermediate'},
        copper_wire:      {name:'Cable Cobre',       stack:200, category:'intermediate'},
        green_circuit:    {name:'Circuito Verde',    stack:200, category:'intermediate'},
        advanced_circuit: {name:'Circuito Avanzado', stack:200, category:'intermediate'},
        red_science:      {name:'Ciencia Roja',      stack:200, category:'science'},
        green_science:    {name:'Ciencia Verde',     stack:200, category:'science'},
        blue_science:     {name:'Ciencia Azul',      stack:200, category:'science'},
        rocket_part:      {name:'Pieza Cohete',      stack:10,  category:'endgame'},
        speed_module:     {name:'Módulo Velocidad',  stack:50,  category:'module'},
        efficiency_module:{name:'Módulo Eficiencia', stack:50,  category:'module'}
    },

    color: function(id) {
        return CFG.COLORS.items[id] || '#ffffff';
    }
};

var Inventory = {
    create: function() {
        return {};
    },

    add: function(inv, item, qty) {
        if (!qty) qty = 1;
        inv[item] = (inv[item] || 0) + qty;
        return true;
    },

    remove: function(inv, item, qty) {
        if (!qty) qty = 1;
        if ((inv[item] || 0) < qty) return false;
        inv[item] -= qty;
        if (inv[item] <= 0) delete inv[item];
        return true;
    },

    has: function(inv, item, qty) {
        if (!qty) qty = 1;
        return (inv[item] || 0) >= qty;
    },

    count: function(inv, item) {
        return inv[item] || 0;
    },

    total: function(inv) {
        var t = 0;
        for (var k in inv) t += inv[k];
        return t;
    },

    isEmpty: function(inv) {
        for (var k in inv) { if (inv[k] > 0) return false; }
        return true;
    },

    firstItem: function(inv) {
        for (var k in inv) { if (inv[k] > 0) return k; }
        return null;
    },

    hasAll: function(inv, list) {
        for (var i = 0; i < list.length; i++) {
            if (!this.has(inv, list[i].item, list[i].qty)) return false;
        }
        return true;
    },

    removeAll: function(inv, list) {
        for (var i = 0; i < list.length; i++) {
            this.remove(inv, list[i].item, list[i].qty);
        }
    }
};
