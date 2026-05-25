var Recipes = {
    getAvailableAssembly: function() {
        var available = [];
        for (var i = 0; i < CFG.ASSEMBLY_RECIPES.length; i++) {
            var r = CFG.ASSEMBLY_RECIPES[i];
            if (r.tech && !Tech.isCompleted(r.tech)) continue;
            available.push(r);
        }
        return available;
    },

    getSmeltingOutput: function(inputItem) {
        var r = CFG.SMELTING_RECIPES[inputItem];
        return r ? r.output : null;
    },

    getRecipeById: function(id) {
        for (var i = 0; i < CFG.ASSEMBLY_RECIPES.length; i++) {
            if (CFG.ASSEMBLY_RECIPES[i].id === id) return CFG.ASSEMBLY_RECIPES[i];
        }
        return null;
    },

    formatInputs: function(inputs) {
        var parts = [];
        for (var i = 0; i < inputs.length; i++) {
            parts.push(inputs[i].qty + 'x ' + (ITEM_NAMES[inputs[i].item] || inputs[i].item));
        }
        return parts.join(' + ');
    },

    formatOutput: function(recipe) {
        return recipe.qty + 'x ' + (ITEM_NAMES[recipe.output] || recipe.output);
    }
};
