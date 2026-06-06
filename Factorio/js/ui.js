var UI = {
    toastQueue: [],
    toastTimer: 0,
    activeToasts: [],

    init: function() {
        this.buildToolbar();
        this.bindButtons();
        this.updateResources();
    },

    buildToolbar: function() {
        var container = document.getElementById('toolbar-buildings');
        container.innerHTML = '';

        var categories = {logistics: [], production: [], power: []};
        for (var type in CFG.BUILDING_DEFS) {
            var def = CFG.BUILDING_DEFS[type];
            var cat = def.category || 'production';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push({type: type, def: def});
        }

        var order = ['logistics', 'production', 'power'];
        var globalIdx = 0; // mismo índice que usa selectBuildingByIndex (atajos 1-9)
        for (var ci = 0; ci < order.length; ci++) {
            var cat = order[ci];
            var items = categories[cat];
            if (!items || items.length === 0) continue;

            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var btn = document.createElement('button');
                btn.className = 'building-btn';
                btn.setAttribute('data-type', item.type);
                btn.id = 'toolbar-' + item.type;

                var bc = CFG.COLORS.buildings[item.type];
                if (bc) {
                    btn.style.backgroundColor = bc.bg;
                    btn.style.borderColor = bc.fg;
                }

                if (item.def.icon) {
                    var icon = document.createElement('span');
                    icon.className = 'btn-icon';
                    icon.textContent = item.def.icon;
                    btn.appendChild(icon);
                }

                var label = document.createElement('span');
                label.className = 'btn-label';
                label.textContent = item.def.name;
                btn.appendChild(label);

                if (globalIdx < 9) {
                    var shortcut = document.createElement('span');
                    shortcut.className = 'btn-shortcut';
                    shortcut.textContent = (globalIdx + 1);
                    btn.appendChild(shortcut);
                }

                if (item.def.unlocked === false && !Tech.isUnlocked(item.type)) {
                    btn.classList.add('locked');
                }

                (function(type, btnEl) {
                    btnEl.addEventListener('click', function(e) {
                        e.stopPropagation();
                        UI.selectBuildMode(type);
                    });
                    if (!Input.isTouchDevice) {
                        btnEl.addEventListener('mouseenter', function() {
                            UI.showBuildTooltip(type, btnEl);
                        });
                        btnEl.addEventListener('mouseleave', function() {
                            UI.hideBuildTooltip();
                        });
                    }
                })(item.type, btn);

                container.appendChild(btn);
                globalIdx++;
            }
        }
    },

    showBuildTooltip: function(type, btn) {
        var def = CFG.BUILDING_DEFS[type];
        if (!def) return;
        var tt = document.getElementById('toolbar-tooltip');
        if (!tt) {
            tt = document.createElement('div');
            tt.id = 'toolbar-tooltip';
            document.getElementById('ui-overlay').appendChild(tt);
        }

        var html = '<div class="tt-name">' + (def.icon || '') + ' ' + def.name + '</div>';
        if (def.cost && def.cost.length > 0) {
            var parts = [];
            for (var i = 0; i < def.cost.length; i++) {
                var c = def.cost[i];
                var has = Inventory.count(Game.player.inventory, c.item);
                var color = has >= c.qty ? '#44cc66' : '#dd4444';
                parts.push('<span style="color:' + color + '">' + c.qty + 'x ' + (ITEM_NAMES[c.item] || c.item) + '</span>');
            }
            html += '<div class="tt-cost">' + parts.join(' · ') + '</div>';
        } else {
            html += '<div class="tt-cost" style="color:#44cc66">Gratis</div>';
        }
        var shortcutEl = btn.querySelector('.btn-shortcut');
        if (shortcutEl) html += '<div class="tt-key">Atajo: tecla ' + shortcutEl.textContent + '</div>';
        if (def.unlocked === false && !Tech.isUnlocked(type)) {
            html += '<div class="tt-lock">🔒 Requiere: ' + (CFG.TECH_TREE[def.tech] ? CFG.TECH_TREE[def.tech].name : def.tech) + '</div>';
        }

        tt.innerHTML = html;
        tt.style.display = 'block';
        var rect = btn.getBoundingClientRect();
        var ttRect = tt.getBoundingClientRect();
        var left = rect.left + rect.width / 2 - ttRect.width / 2;
        left = Math.max(8, Math.min(window.innerWidth - ttRect.width - 8, left));
        tt.style.left = left + 'px';
        tt.style.top = (rect.top - ttRect.height - 8) + 'px';
    },

    hideBuildTooltip: function() {
        var tt = document.getElementById('toolbar-tooltip');
        if (tt) tt.style.display = 'none';
    },

    bindButtons: function() {
        var self = this;

        document.getElementById('btn-tech').addEventListener('click', function() {
            self.toggleTechTree();
        });

        document.getElementById('btn-stats').addEventListener('click', function() {
            self.toggleStats();
        });

        document.getElementById('btn-glossary').addEventListener('click', function() {
            self.toggleGlossary();
        });

        document.getElementById('btn-settings').addEventListener('click', function() {
            self.toggleSettings();
        });

        document.getElementById('btn-prestige').addEventListener('click', function() {
            self.togglePrestige();
        });

        document.getElementById('modal-close').addEventListener('click', function() {
            self.closeModal();
        });

        document.getElementById('btn-rotate').addEventListener('click', function(e) {
            e.stopPropagation();
            Input.buildDirection = (Input.buildDirection + 1) % 4;
            var dirs = ['Arriba','Derecha','Abajo','Izquierda'];
            self.showToast('Dirección: ' + dirs[Input.buildDirection]);
        });

        document.getElementById('btn-cancel').addEventListener('click', function(e) {
            e.stopPropagation();
            Input.buildMode = null;
            Input.selectedBuilding = null;
            self.closePanels();
            self.updateToolbarSelection();
        });

        document.getElementById('btn-zoom-in').addEventListener('click', function(e) {
            e.stopPropagation();
            Camera.zoomAt(window.innerWidth / 2, window.innerHeight / 2, -2);
        });

        document.getElementById('btn-zoom-out').addEventListener('click', function(e) {
            e.stopPropagation();
            Camera.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 2);
        });

        document.getElementById('btn-pause-mobile').addEventListener('click', function(e) {
            e.stopPropagation();
            Game.paused = !Game.paused;
            self.updatePauseState();
            this.textContent = Game.paused ? '▶' : '⏸';
        });

        document.getElementById('btn-fullscreen').addEventListener('click', function(e) {
            e.stopPropagation();
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(function(){});
            } else {
                document.exitFullscreen().catch(function(){});
            }
        });

        document.getElementById('modal').addEventListener('click', function(e) {
            if (e.target === this) self.closeModal();
        });
    },

    selectBuildMode: function(type) {
        var def = CFG.BUILDING_DEFS[type];
        if (def.unlocked === false && !Tech.isUnlocked(type)) {
            this.showToast('¡Requiere investigación!');
            Audio.play('error');
            return;
        }

        if (Input.buildMode === type) {
            Input.buildMode = null;
        } else {
            Input.buildMode = type;
        }
        Input.selectedBuilding = null;
        this.closePanels();
        this.updateToolbarSelection();
    },

    selectBuildingByIndex: function(idx) {
        var buttons = document.querySelectorAll('.building-btn');
        if (idx < buttons.length) {
            var type = buttons[idx].getAttribute('data-type');
            this.selectBuildMode(type);
        }
    },

    updateToolbarSelection: function() {
        var buttons = document.querySelectorAll('.building-btn');
        for (var i = 0; i < buttons.length; i++) {
            var type = buttons[i].getAttribute('data-type');
            buttons[i].classList.toggle('selected', type === Input.buildMode);

            var def = CFG.BUILDING_DEFS[type];
            if (def.unlocked === false && !Tech.isUnlocked(type)) {
                buttons[i].classList.add('locked');
            } else {
                buttons[i].classList.remove('locked');
            }
        }

        var actions = document.getElementById('build-actions');
        actions.style.display = Input.buildMode ? 'flex' : 'none';

        var costEl = document.getElementById('build-cost');
        var dirEl = document.getElementById('build-direction');
        if (Input.buildMode) {
            var def2 = CFG.BUILDING_DEFS[Input.buildMode];
            if (def2.cost && def2.cost.length > 0) {
                var parts = [];
                for (var j = 0; j < def2.cost.length; j++) {
                    var c = def2.cost[j];
                    var has = Inventory.count(Game.player.inventory, c.item);
                    var color = has >= c.qty ? '#44cc66' : '#dd4444';
                    var symbol = has >= c.qty ? ' ✓' : ' ✗';
                    parts.push('<span style="color:' + color + '">' + c.qty + 'x ' + (ITEM_NAMES[c.item] || c.item) + symbol + '</span>');
                }
                costEl.innerHTML = parts.join(' ');
            } else {
                costEl.textContent = 'Gratis';
            }
            var arrows = ['↑','→','↓','←'];
            dirEl.textContent = arrows[Input.buildDirection];
        }

        var indicator = document.getElementById('build-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'build-indicator';
            document.getElementById('ui-overlay').appendChild(indicator);
        }
        if (Input.buildMode) {
            var bDef = CFG.BUILDING_DEFS[Input.buildMode];
            indicator.textContent = 'CONSTRUYENDO: ' + (bDef ? bDef.name : Input.buildMode);
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    },

    updateResources: function() {
        var bar = document.getElementById('resource-items');
        var inv = Game.player.inventory;
        var html = '';

        var important = ['iron_plate','copper_plate','steel','iron_gear','green_circuit','advanced_circuit','red_science','green_science','blue_science'];

        if (!this._lastProduced) this._lastProduced = {};
        if (!this._rates) this._rates = {};
        var produced = Game.stats.itemsProduced;
        for (var rk in produced) {
            var prev = this._lastProduced[rk] || 0;
            var delta = produced[rk] - prev;
            this._rates[rk] = delta;
            this._lastProduced[rk] = produced[rk];
        }

        for (var i = 0; i < important.length; i++) {
            var item = important[i];
            var qty = inv[item] || 0;
            if (qty <= 0 && !produced[item]) continue;
            var color = Items.color(item);
            var rate = this._rates[item] || 0;
            html += '<div class="resource-item">';
            html += '<span class="resource-dot" style="background:' + color + '"></span>';
            html += '<span class="resource-name">' + (ITEM_NAMES[item] || item) + '</span>';
            html += '<span class="resource-count">' + this.formatNumber(qty) + '</span>';
            if (rate > 0) html += '<span class="resource-rate">+' + rate + '/s</span>';
            html += '</div>';
        }

        for (var item2 in inv) {
            if (important.indexOf(item2) !== -1) continue;
            if (inv[item2] <= 0) continue;
            var color2 = Items.color(item2);
            var rate2 = this._rates[item2] || 0;
            html += '<div class="resource-item">';
            html += '<span class="resource-dot" style="background:' + color2 + '"></span>';
            html += '<span class="resource-name">' + (ITEM_NAMES[item2] || item2) + '</span>';
            html += '<span class="resource-count">' + this.formatNumber(inv[item2]) + '</span>';
            if (rate2 > 0) html += '<span class="resource-rate">+' + rate2 + '/s</span>';
            html += '</div>';
        }

        bar.innerHTML = html;

        this.updatePowerBar();
        this.updateResearchBar();
    },

    updatePowerBar: function() {
        var bar = document.getElementById('power-bar');
        var fill = document.getElementById('power-fill');
        var text = document.getElementById('power-text');

        if (Game.power.production > 0 || Game.power.consumption > 0) {
            bar.style.display = 'block';
            var pct = Game.power.consumption > 0 ? Math.min(100, (Game.power.production / Game.power.consumption) * 100) : 100;
            fill.style.width = pct + '%';
            fill.style.backgroundColor = pct >= 100 ? '#44cc66' : pct >= 50 ? '#e6a832' : '#dd4444';
            text.textContent = Math.floor(Game.power.production) + '/' + Math.floor(Game.power.consumption) + ' kW';
        } else {
            bar.style.display = 'none';
        }
    },

    updateResearchBar: function() {
        var bar = document.getElementById('research-bar');
        var fill = document.getElementById('research-fill');
        var text = document.getElementById('research-text');

        if (Game.currentResearch) {
            var tech = CFG.TECH_TREE[Game.currentResearch];
            bar.style.display = 'block';
            var pct = Tech.getProgress(Game.currentResearch) * 100;
            fill.style.width = pct + '%';
            text.textContent = tech.name + ' ' + Math.floor(pct) + '%';
        } else {
            bar.style.display = 'none';
        }
    },

    showBuildingInfo: function(b) {
        var panel = document.getElementById('info-panel');
        var def = CFG.BUILDING_DEFS[b.type];

        var html = '<button class="info-close" onclick="UI.closePanels()">✕</button>';
        html += '<h3>' + def.name + '</h3>';

        if (b.type === 'miner' || b.type === 'electric_miner') {
            var resType = World.getResourceType(b.x, b.y, def.size[0], def.size[1]);
            html += '<p>Minando: ' + (ITEM_NAMES[resType] || 'Nada') + '</p>';
        }

        if (!Inventory.isEmpty(b.input)) {
            html += '<p>Entrada: ';
            for (var item in b.input) {
                html += b.input[item] + 'x ' + (ITEM_NAMES[item] || item) + ' ';
            }
            html += '</p>';
        }

        if (!Inventory.isEmpty(b.output)) {
            html += '<p>Salida: ';
            for (var item2 in b.output) {
                html += b.output[item2] + 'x ' + (ITEM_NAMES[item2] || item2) + ' ';
            }
            html += '</p>';
            html += '<div class="transfer-section">';
            for (var eItem in b.output) {
                if (b.output[eItem] > 0) {
                    html += '<button class="btn-transfer btn-extract" onclick="Buildings.playerExtract(' + b.id + ',\'output\',\'' + eItem + '\',1)">-1 ' + (ITEM_NAMES[eItem] || eItem) + '</button>';
                    if (b.output[eItem] >= 5) html += '<button class="btn-transfer btn-extract" onclick="Buildings.playerExtract(' + b.id + ',\'output\',\'' + eItem + '\',5)">-5</button>';
                    html += '<button class="btn-transfer btn-extract" onclick="Buildings.playerExtract(' + b.id + ',\'output\',\'' + eItem + '\',9999)">Todo</button>';
                }
            }
            html += '</div>';
        }

        if (b.type === 'furnace') {
            html += '<p>Combustible: ' + (b.fuel.coal || 0) + 'x Carbón</p>';
            if ((b.fuel.coal || 0) > 0) {
                html += '<div class="transfer-section">';
                html += '<button class="btn-transfer btn-extract" onclick="Buildings.playerExtract(' + b.id + ',\'fuel\',\'coal\',1)">-1 Carbón</button>';
                html += '<button class="btn-transfer btn-extract" onclick="Buildings.playerExtract(' + b.id + ',\'fuel\',\'coal\',9999)">Todo</button>';
                html += '</div>';
            }
            html += '<div class="transfer-section"><p style="font-size:11px;color:#aaa;margin:4px 0;">Añadir:</p>';
            var smeltables = ['iron_ore','copper_ore','iron_plate','stone','coal'];
            for (var si = 0; si < smeltables.length; si++) {
                var sItem = smeltables[si];
                var sQty = Inventory.count(Game.player.inventory, sItem);
                if (sQty > 0) {
                    html += '<button class="btn-transfer" onclick="Buildings.playerTransfer(' + b.id + ',\'' + sItem + '\',1)">+1 ' + (ITEM_NAMES[sItem] || sItem) + ' (' + sQty + ')</button>';
                    if (sQty > 5) html += '<button class="btn-transfer" onclick="Buildings.playerTransfer(' + b.id + ',\'' + sItem + '\',5)">+5</button>';
                    if (sQty > 10) html += '<button class="btn-transfer" onclick="Buildings.playerTransfer(' + b.id + ',\'' + sItem + '\',10)">+10</button>';
                    html += '<button class="btn-transfer" onclick="Buildings.playerTransfer(' + b.id + ',\'' + sItem + '\',' + sQty + ')">+Todo</button>';
                }
            }
            html += '</div>';
        }

        if (b.type === 'storage') {
            html += '<p>Almacenado: ' + Inventory.total(b.stored) + '/' + b.capacity + '</p>';
            for (var item3 in b.stored) {
                if (b.stored[item3] > 0) {
                    html += '<p>' + b.stored[item3] + 'x ' + (ITEM_NAMES[item3] || item3);
                    html += ' <button class="btn-transfer btn-extract" onclick="Buildings.playerExtract(' + b.id + ',\'stored\',\'' + item3 + '\',1)">-1</button>';
                    if (b.stored[item3] >= 5) html += '<button class="btn-transfer btn-extract" onclick="Buildings.playerExtract(' + b.id + ',\'stored\',\'' + item3 + '\',5)">-5</button>';
                    html += '<button class="btn-transfer btn-extract" onclick="Buildings.playerExtract(' + b.id + ',\'stored\',\'' + item3 + '\',9999)">Todo</button>';
                    html += '</p>';
                }
            }
            html += '<div class="transfer-section"><p style="font-size:11px;color:#aaa;margin:4px 0;">Añadir:</p>';
            var inv = Game.player.inventory;
            for (var invItem in inv) {
                if (inv[invItem] > 0) {
                    html += '<button class="btn-transfer" onclick="Buildings.playerTransfer(' + b.id + ',\'' + invItem + '\',1)">+1 ' + (ITEM_NAMES[invItem] || invItem) + ' (' + inv[invItem] + ')</button>';
                    if (inv[invItem] > 5) html += '<button class="btn-transfer" onclick="Buildings.playerTransfer(' + b.id + ',\'' + invItem + '\',5)">+5</button>';
                    if (inv[invItem] > 10) html += '<button class="btn-transfer" onclick="Buildings.playerTransfer(' + b.id + ',\'' + invItem + '\',10)">+10</button>';
                    html += '<button class="btn-transfer" onclick="Buildings.playerTransfer(' + b.id + ',\'' + invItem + '\',' + inv[invItem] + ')">+Todo</button>';
                }
            }
            html += '</div>';
        }

        if (b.type === 'rocket_silo') {
            html += '<p>Piezas Cohete: ' + (b.rocketParts || 0) + '/100</p>';
            if (b.rocketReady) {
                html += '<button onclick="Game.launchRocket(' + b.id + ')" class="btn-action">¡LANZAR COHETE!</button>';
            }
        }

        if (b.type === 'assembler') {
            html += '<p>Receta: ' + (b.recipeId ? (ITEM_NAMES[Recipes.getRecipeById(b.recipeId).output] || Recipes.getRecipeById(b.recipeId).output) : 'Ninguna') + '</p>';
            html += '<div class="recipe-select">';
            var recipes = Recipes.getAvailableAssembly();
            for (var ri = 0; ri < recipes.length; ri++) {
                var r = recipes[ri];
                var selected = b.recipeId === r.id ? ' selected' : '';
                html += '<button class="recipe-btn' + selected + '" onclick="UI.setRecipe(' + b.id + ',\'' + r.id + '\')">';
                html += '<span class="recipe-dot" style="background:' + Items.color(r.output) + '"></span>';
                html += (ITEM_NAMES[r.output] || r.output);
                html += '</button>';
            }
            html += '</div>';
        }

        if (b.type === 'inserter') {
            html += '<p style="font-size:11px;color:#aaa;margin:4px 0;">Filtro (solo mueve este item):</p>';
            html += '<div class="recipe-select">';
            html += '<button class="recipe-btn' + (!b.filterItem ? ' selected' : '') + '" onclick="UI.setInserterFilter(' + b.id + ',null)">Sin filtro</button>';
            for (var fItem in ITEM_NAMES) {
                var fSel = b.filterItem === fItem ? ' selected' : '';
                html += '<button class="recipe-btn' + fSel + '" onclick="UI.setInserterFilter(' + b.id + ',\'' + fItem + '\')">';
                html += '<span class="recipe-dot" style="background:' + Items.color(fItem) + '"></span>';
                html += ITEM_NAMES[fItem];
                html += '</button>';
            }
            html += '</div>';
        }

        if (b.type === 'splitter') {
            html += '<p style="font-size:11px;color:#aaa;margin:4px 0;">Prioridad de salida:</p>';
            html += '<div class="recipe-select">';
            var prios = [['left','⬅ Izquierda'],['balanced','⚖ Equilibrado'],['right','Derecha ➡']];
            var curPrio = b.outputPriority || 'balanced';
            for (var pi = 0; pi < prios.length; pi++) {
                var pSel = curPrio === prios[pi][0] ? ' selected' : '';
                html += '<button class="recipe-btn' + pSel + '" onclick="UI.setSplitterPriority(' + b.id + ',\'' + prios[pi][0] + '\')">' + prios[pi][1] + '</button>';
            }
            html += '</div>';
        }

        if (b.type === 'accumulator') {
            var accDef = CFG.BUILDING_DEFS.accumulator;
            var chargePct = Math.floor((b.charge / accDef.capacity) * 100);
            html += '<p>Carga: ' + Math.floor(b.charge) + '/' + accDef.capacity + ' (' + chargePct + '%)</p>';
        }

        if (b.type === 'underground_belt') {
            if (b.pairId !== null && b.pairId !== undefined) {
                var transitCount = b.ugMode === 'in' ? b.transit.length :
                    (World.buildings[b.pairId] && World.buildings[b.pairId].transit ? World.buildings[b.pairId].transit.length : 0);
                html += '<p>' + (b.ugMode === 'in' ? 'Entrada' : 'Salida') + ' de túnel — conectado';
                html += ' (' + transitCount + ' en tránsito)</p>';
            } else {
                html += '<p style="color:#dd4444">Sin conectar: coloca la otra boca en la misma dirección (máx. ' + (CFG.UNDERGROUND_MAX_DIST + 1) + ' casillas)</p>';
            }
        }

        html += '<p class="info-status">' + (b.active ? '<span class="status-on">Trabajando</span>' : '<span class="status-off">Inactivo</span>') + '</p>';
        html += '<button onclick="Buildings.remove(' + b.id + ');UI.closePanels();" class="btn-delete">Eliminar</button>';

        panel.innerHTML = html;
        panel.style.display = 'block';
    },

    setRecipe: function(buildingId, recipeId) {
        var b = World.buildings[buildingId];
        if (!b || b.removed) return;
        b.recipeId = recipeId;
        b.progress = 0;
        b.input = {};
        this.showBuildingInfo(b);
    },

    setInserterFilter: function(buildingId, item) {
        var b = World.buildings[buildingId];
        if (!b || b.removed) return;
        b.filterItem = item;
        this.showBuildingInfo(b);
    },

    setSplitterPriority: function(buildingId, mode) {
        var b = World.buildings[buildingId];
        if (!b || b.removed) return;
        b.outputPriority = mode;
        this.showBuildingInfo(b);
    },

    closePanels: function() {
        document.getElementById('info-panel').style.display = 'none';
        document.getElementById('context-menu').style.display = 'none';
    },

    showContextMenu: function(tile, b) {
        var menu = document.getElementById('context-menu');
        var screen = Camera.worldToScreen(tile.x * CFG.TILE + CFG.TILE/2, tile.y * CFG.TILE + CFG.TILE/2);

        menu.innerHTML = '';
        var actions = [
            {label: 'Info', icon: 'ℹ️', action: function() { Input.selectedBuilding = b; UI.showBuildingInfo(b); }},
            {label: 'Rotar', icon: '🔄', action: function() { b.direction = (b.direction + 1) % 4; }},
            {label: 'Eliminar', icon: '🗑️', action: function() { Buildings.remove(b.id); }}
        ];

        for (var i = 0; i < actions.length; i++) {
            var btn = document.createElement('button');
            btn.className = 'ctx-btn';
            btn.textContent = actions[i].icon + ' ' + actions[i].label;
            (function(act) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    act.action();
                    menu.style.display = 'none';
                });
            })(actions[i]);
            menu.appendChild(btn);
        }

        menu.style.display = 'block';
        menu.style.left = screen.x + 'px';
        menu.style.top = screen.y + 'px';
        menu.style.transform = 'translate(-50%, -110%)';

        var rect = menu.getBoundingClientRect();
        var vw = window.innerWidth, vh = window.innerHeight;
        if (rect.left < 8) menu.style.transform = 'translate(0, -110%)';
        if (rect.right > vw - 8) menu.style.transform = 'translate(-100%, -110%)';
        if (rect.top < 8) {
            menu.style.transform = 'translate(-50%, 10%)';
        }
    },

    startResearch: function(techId) {
        Game.currentResearch = techId;
        Tutorial.onEvent('research_started', techId);
        this.closeModal();
        this.toggleTechTree();
    },

    cancelResearch: function() {
        Game.currentResearch = null;
        this.closeModal();
        this.toggleTechTree();
    },

    toggleTechTree: function() {
        var modal = document.getElementById('modal');
        var content = document.getElementById('modal-content');

        if (modal.style.display === 'flex') {
            this.closeModal();
            return;
        }

        Tutorial.onEvent('open_tech');

        var html = '<h2>Árbol Tecnológico</h2>';
        var techs = Tech.getAllTechs();

        for (var i = 0; i < techs.length; i++) {
            var t = techs[i];
            var cls = t.completed ? 'tech-completed' : t.available ? 'tech-available' : 'tech-locked';
            var isCurrent = Game.currentResearch === t.id;

            html += '<div class="tech-node ' + cls + (isCurrent ? ' tech-current' : '') + '">';
            html += '<div class="tech-name">' + t.def.name + '</div>';

            html += '<div class="tech-cost">';
            for (var sciType in t.def.cost) {
                html += '<span class="sci-cost">';
                html += '<span class="resource-dot" style="background:' + Items.color(sciType) + '"></span>';
                html += t.def.cost[sciType] + 'x ' + (ITEM_NAMES[sciType] || sciType);
                html += '</span> ';
            }
            html += '</div>';

            if (t.def.unlocks && t.def.unlocks.length > 0) {
                html += '<div class="tech-unlocks">Desbloquea: ' + t.def.unlocks.join(', ') + '</div>';
            }

            if (t.available && !t.completed) {
                html += '<div class="tech-progress-bar"><div class="tech-progress-fill" style="width:' + (t.progress * 100) + '%"></div></div>';
                if (isCurrent) {
                    html += '<button class="btn-research active" onclick="UI.cancelResearch();">Cancelar</button>';
                } else {
                    html += '<button class="btn-research" onclick="UI.startResearch(\'' + t.id + '\');">Investigar</button>';
                }
            }

            if (t.completed) {
                html += '<div class="tech-done">✓ Completado</div>';
            }

            html += '</div>';
        }

        content.innerHTML = html;
        modal.style.display = 'flex';
    },

    toggleGlossary: function() {
        var modal = document.getElementById('modal');
        var content = document.getElementById('modal-content');
        if (modal.style.display === 'flex') { this.closeModal(); return; }

        var html = '<h2>📖 Glosario de Producción</h2>';

        html += '<h3>Recursos Naturales</h3>';
        html += '<p style="color:#888;font-size:11px;">Se obtienen con Mineros colocados sobre vetas</p>';
        var rawItems = ['iron_ore', 'copper_ore', 'coal', 'stone'];
        for (var ri = 0; ri < rawItems.length; ri++) {
            var rid = rawItems[ri];
            html += '<div class="glossary-item">';
            html += '<span class="resource-dot" style="background:' + Items.color(rid) + '"></span>';
            html += '<strong>' + (ITEM_NAMES[rid] || rid) + '</strong>';
            html += '<span class="glossary-source">⛏ Minero sobre veta</span>';
            html += '</div>';
        }

        html += '<h3>Fundición</h3>';
        html += '<p style="color:#888;font-size:11px;">Se fabrican en Fundidora (requiere carbón como combustible)</p>';
        for (var sKey in CFG.SMELTING_RECIPES) {
            var sr = CFG.SMELTING_RECIPES[sKey];
            html += '<div class="glossary-item">';
            html += '<span class="resource-dot" style="background:' + Items.color(sr.output) + '"></span>';
            html += '<strong>' + (ITEM_NAMES[sr.output] || sr.output) + '</strong>';
            html += '<span class="glossary-arrow">←</span>';
            var inQty = sr.inputQty || 1;
            html += '<span class="glossary-input">' + inQty + 'x ' + (ITEM_NAMES[sKey] || sKey) + '</span>';
            html += '<span class="glossary-time">⏱ ' + (sr.time / 20).toFixed(1) + 's</span>';
            html += '</div>';
        }

        html += '<h3>Ensamblaje</h3>';
        html += '<p style="color:#888;font-size:11px;">Se fabrican en Ensamblador (requiere electricidad)</p>';
        for (var ai = 0; ai < CFG.ASSEMBLY_RECIPES.length; ai++) {
            var ar = CFG.ASSEMBLY_RECIPES[ai];
            var locked = ar.tech && !Tech.isCompleted(ar.tech);
            html += '<div class="glossary-item' + (locked ? ' glossary-locked' : '') + '">';
            html += '<span class="resource-dot" style="background:' + Items.color(ar.output) + '"></span>';
            html += '<strong>' + (ITEM_NAMES[ar.output] || ar.output) + '</strong>';
            if (ar.qty > 1) html += ' x' + ar.qty;
            html += '<span class="glossary-arrow">←</span>';
            var inputs = [];
            for (var ii = 0; ii < ar.inputs.length; ii++) {
                inputs.push(ar.inputs[ii].qty + 'x ' + (ITEM_NAMES[ar.inputs[ii].item] || ar.inputs[ii].item));
            }
            html += '<span class="glossary-input">' + inputs.join(' + ') + '</span>';
            html += '<span class="glossary-time">⏱ ' + (ar.time / 20).toFixed(1) + 's</span>';
            if (locked) {
                html += '<span class="glossary-lock">🔒 ' + (CFG.TECH_TREE[ar.tech] ? CFG.TECH_TREE[ar.tech].name : ar.tech) + '</span>';
            }
            html += '</div>';
        }

        html += '<h3>Edificios</h3>';
        for (var bType in CFG.BUILDING_DEFS) {
            var bd = CFG.BUILDING_DEFS[bType];
            html += '<div class="glossary-item">';
            html += '<strong>' + (bd.icon || '') + ' ' + bd.name + '</strong>';
            if (bd.cost && bd.cost.length > 0) {
                var costs = [];
                for (var ci = 0; ci < bd.cost.length; ci++) {
                    costs.push(bd.cost[ci].qty + 'x ' + (ITEM_NAMES[bd.cost[ci].item] || bd.cost[ci].item));
                }
                html += '<span class="glossary-input">' + costs.join(' + ') + '</span>';
            } else {
                html += '<span class="glossary-input" style="color:#44cc66">Gratis</span>';
            }
            if (bd.tech) {
                var techLocked = !Tech.isCompleted(bd.tech);
                if (techLocked) html += '<span class="glossary-lock">🔒 ' + (CFG.TECH_TREE[bd.tech] ? CFG.TECH_TREE[bd.tech].name : bd.tech) + '</span>';
            }
            html += '</div>';
        }

        html += '<h3>Consejos</h3>';
        html += '<div style="font-size:12px;color:#ccc;line-height:1.6;">';
        html += '<p>• Minero → Cinta → Fundidora (con carbón) = placas</p>';
        html += '<p>• Insertador mueve items entre edificios y cintas</p>';
        html += '<p>• Motor de Vapor genera electricidad (necesita carbón)</p>';
        html += '<p>• Laboratorio + ciencia = desbloquear tecnologías</p>';
        html += '<p>• Ensamblador fabrica items complejos (necesita electricidad)</p>';
        html += '<p>• ¡Lanza un cohete para prestigiar!</p>';
        html += '</div>';

        content.innerHTML = html;
        modal.style.display = 'flex';
    },

    // ===== Centro de alertas =====
    alerts: [],
    _alertTimer: 0,
    _lowPowerStreak: 0,
    _alertCycle: {},
    _seenAlertKeys: {},
    _alertPanelOpen: false,
    _lastAlertSig: '',

    checkAlerts: function() {
        var found = [];

        for (var i = 0; i < World.buildings.length; i++) {
            var b = World.buildings[i];
            if (!b || b.removed) continue;

            if ((b.type === 'miner' || b.type === 'electric_miner') && b.depleted) {
                found.push({key: 'depleted:' + b.id, kind: 'depleted', icon: '⛏', text: 'Veta agotada', buildingId: b.id});
            } else if (b.type === 'furnace' && Inventory.isEmpty(b.fuel) && !Inventory.isEmpty(b.input)) {
                found.push({key: 'nofuel:' + b.id, kind: 'nofuel', icon: '🔥', text: 'Fundidora sin carbón', buildingId: b.id});
            } else if (b.type === 'steam_engine' && Inventory.isEmpty(b.fuel)) {
                found.push({key: 'nofuel:' + b.id, kind: 'nofuel', icon: '💨', text: 'Motor de vapor sin carbón', buildingId: b.id});
            } else if (b.type === 'rocket_silo' && b.rocketReady) {
                found.push({key: 'silo:' + b.id, kind: 'silo', icon: '🚀', text: '¡Cohete listo para lanzar!', buildingId: b.id});
                if (!this._seenAlertKeys['silo:' + b.id]) {
                    this._seenAlertKeys['silo:' + b.id] = true;
                    this.showToast('¡Cohete listo para lanzar!', 'achievement');
                }
            } else if (b.type === 'underground_belt' && (b.pairId === null || b.pairId === undefined)) {
                found.push({key: 'tunnel:' + b.id, kind: 'tunnel', icon: '⤵', text: 'Cinta subterránea sin emparejar', buildingId: b.id});
            }
        }

        // Energía insuficiente sostenida (≥10s) — evita parpadeo por acumuladores
        if (Game.power.consumption > 0 && Game.power.satisfaction < 1) {
            this._lowPowerStreak++;
        } else {
            this._lowPowerStreak = 0;
        }
        if (this._lowPowerStreak >= 5) {
            found.unshift({
                key: 'power', kind: 'power', icon: '⚡',
                text: 'Energía insuficiente: ' + Math.floor(Game.power.production) + '/' + Math.floor(Game.power.consumption) + ' kW',
                buildingId: null
            });
        }

        this.alerts = found;
        this.renderAlerts();
    },

    ensureAlertDOM: function() {
        var badge = document.getElementById('alert-badge');
        if (!badge) {
            var overlay = document.getElementById('ui-overlay');
            badge = document.createElement('button');
            badge.id = 'alert-badge';
            badge.addEventListener('click', function(e) {
                e.stopPropagation();
                UI._alertPanelOpen = !UI._alertPanelOpen;
                UI._lastAlertSig = '';
                UI.renderAlerts();
            });
            overlay.appendChild(badge);

            var panel = document.createElement('div');
            panel.id = 'alert-panel';
            overlay.appendChild(panel);
        }
    },

    renderAlerts: function() {
        this.ensureAlertDOM();
        var badge = document.getElementById('alert-badge');
        var panel = document.getElementById('alert-panel');

        if (this.alerts.length === 0) {
            badge.style.display = 'none';
            panel.style.display = 'none';
            this._alertPanelOpen = false;
            this._lastAlertSig = '';
            return;
        }

        // Firma para no regenerar DOM en vano
        var sig = '';
        for (var i = 0; i < this.alerts.length; i++) sig += this.alerts[i].key + ';';
        var onlyGood = this.alerts.length > 0 && this.alerts[0].kind === 'silo' && this.alerts.length === 1;

        badge.style.display = 'block';
        badge.textContent = (onlyGood ? '🚀 ' : '⚠️ ') + this.alerts.length;
        badge.classList.toggle('alert-good', onlyGood);

        if (!this._alertPanelOpen) {
            panel.style.display = 'none';
            this._lastAlertSig = '';
            return;
        }

        panel.style.display = 'block';
        if (sig === this._lastAlertSig) return;
        this._lastAlertSig = sig;

        panel.innerHTML = '';
        for (var j = 0; j < this.alerts.length; j++) {
            var al = this.alerts[j];
            var row = document.createElement('button');
            row.className = 'alert-row';
            row.textContent = al.icon + ' ' + al.text + (al.buildingId !== null ? ' 📍' : '');
            (function(alert) {
                row.addEventListener('click', function(e) {
                    e.stopPropagation();
                    UI.goToAlert(alert);
                });
            })(al);
            panel.appendChild(row);
        }
    },

    goToAlert: function(alert) {
        if (alert.buildingId === null) return;
        var b = World.buildings[alert.buildingId];
        if (!b || b.removed) return;
        var def = CFG.BUILDING_DEFS[b.type];
        this.centerCameraOnTile(b.x + def.size[0] / 2, b.y + def.size[1] / 2);
        Input.selectedBuilding = b;
        this.showBuildingInfo(b);
        this._alertPanelOpen = false;
        this.renderAlerts();
    },

    centerCameraOnTile: function(tx, ty) {
        Camera.targetX = tx * CFG.TILE - (Camera.vw / Camera.zoom) / 2;
        Camera.targetY = ty * CFG.TILE - (Camera.vh / Camera.zoom) / 2;
    },

    _statsOpen: false,

    toggleStats: function() {
        var modal = document.getElementById('modal');
        var content = document.getElementById('modal-content');

        if (modal.style.display === 'flex') { this.closeModal(); return; }

        var s = Game.stats;
        var html = '<h2>Estadísticas</h2>';
        html += '<p>Edificios colocados: ' + s.buildingsPlaced + '</p>';
        html += '<p>Cohetes lanzados: ' + s.rocketsLaunched + '</p>';
        html += '<p>Ticks de juego: ' + Game.tick + ' (' + Math.floor(Game.tick / 20) + 's)</p>';

        if (Game.power.production > 0 || Game.power.consumption > 0) {
            html += '<h3>Energía (últimos 5 min)</h3>';
            html += '<p style="font-size:11px;"><span style="color:#44cc66">■ Producción</span> &nbsp; <span style="color:#dd4444">■ Consumo</span></p>';
            html += '<canvas id="power-history-canvas" width="320" height="80"></canvas>';
        }

        html += '<h3>Items Producidos</h3>';
        for (var item in s.itemsProduced) {
            if (s.itemsProduced[item] > 0) {
                html += '<p class="stats-row"><span class="resource-dot" style="background:' + Items.color(item) + '"></span> ';
                html += (ITEM_NAMES[item] || item) + ': ' + this.formatNumber(s.itemsProduced[item]);
                html += '<canvas class="sparkline" width="120" height="26" data-item="' + item + '"></canvas>';
                html += '</p>';
            }
        }

        if (Prestige.runs.length > 0) {
            html += '<h3>Partidas con Prestigio</h3>';
            for (var i = 0; i < Prestige.runs.length; i++) {
                var r = Prestige.runs[i];
                html += '<p>Partida ' + (i+1) + ': ' + Math.floor(r.ticks/20) + 's, +' + r.points + ' pts, ' + r.rockets + ' cohetes</p>';
            }
        }

        content.innerHTML = html;
        modal.style.display = 'flex';
        this._statsOpen = true;
        this.paintStatsCharts();
    },

    // Desenrolla el ring buffer en orden cronológico
    getHistorySeries: function(arr) {
        var h = Game.history;
        if (!h || h.count === 0) return [];
        var out = [];
        for (var i = 0; i < h.count; i++) {
            out.push(arr[(h.head - h.count + i + h.max) % h.max]);
        }
        return out;
    },

    drawSparkline: function(canvas, data, color) {
        var ctx = canvas.getContext('2d');
        var w = canvas.width, hh = canvas.height;
        ctx.clearRect(0, 0, w, hh);
        if (data.length < 2) return;

        var max = 1;
        for (var i = 0; i < data.length; i++) if (data[i] > max) max = data[i];

        ctx.beginPath();
        for (var j = 0; j < data.length; j++) {
            var x = (j / (data.length - 1)) * (w - 2) + 1;
            var y = hh - 2 - (data[j] / max) * (hh - 6);
            if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.lineTo(w - 1, hh - 1);
        ctx.lineTo(1, hh - 1);
        ctx.closePath();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;
    },

    drawPowerChart: function(canvas, prodData, consData) {
        var ctx = canvas.getContext('2d');
        var w = canvas.width, hh = canvas.height;
        ctx.clearRect(0, 0, w, hh);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(0, 0, w, hh);
        if (prodData.length < 2) return;

        var max = 1;
        for (var i = 0; i < prodData.length; i++) {
            if (prodData[i] > max) max = prodData[i];
            if (consData[i] > max) max = consData[i];
        }

        var series = [[prodData, '#44cc66'], [consData, '#dd4444']];
        for (var si = 0; si < series.length; si++) {
            var data = series[si][0];
            ctx.beginPath();
            for (var j = 0; j < data.length; j++) {
                var x = (j / (data.length - 1)) * (w - 4) + 2;
                var y = hh - 3 - (data[j] / max) * (hh - 10);
                if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = series[si][1];
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(Math.floor(max) + ' kW', 4, 3);
    },

    paintStatsCharts: function() {
        var h = Game.history;
        if (!h) return;
        var content = document.getElementById('modal-content');

        var pcv = document.getElementById('power-history-canvas');
        if (pcv) {
            this.drawPowerChart(pcv, this.getHistorySeries(h.powerProd), this.getHistorySeries(h.powerCons));
        }

        var sparks = content.querySelectorAll('.sparkline');
        for (var i = 0; i < sparks.length; i++) {
            var cv = sparks[i];
            var item = cv.getAttribute('data-item');
            if (h.items[item]) {
                this.drawSparkline(cv, this.getHistorySeries(h.items[item]), Items.color(item));
            }
        }
    },

    toggleSettings: function() {
        var modal = document.getElementById('modal');
        var content = document.getElementById('modal-content');
        if (modal.style.display === 'flex') { this.closeModal(); return; }

        var html = '<h2>Ajustes</h2>';
        html += '<button class="btn-action" onclick="Audio.toggle();UI.toggleSettings();UI.toggleSettings();">Sonido: ' + (Audio.enabled ? 'ON' : 'OFF') + '</button>';
        html += '<button class="btn-action" onclick="Audio.toggleMusic();UI.toggleSettings();UI.toggleSettings();">Música: ' + (Audio.musicEnabled ? 'ON' : 'OFF') + '</button>';
        html += '<button class="btn-action" onclick="Game.creativeModeOn=!Game.creativeModeOn;UI.toggleSettings();UI.toggleSettings();">Modo Creativo: ' + (Game.creativeModeOn ? 'ON' : 'OFF') + '</button>';
        html += '<br><br>';
        html += '<button class="btn-action" onclick="Save.save();UI.showToast(\'¡Partida guardada!\');">Guardar</button>';
        html += '<button class="btn-action" onclick="if(Save.load()){UI.showToast(\'¡Partida cargada!\');UI.closeModal();}">Cargar</button>';
        html += '<br><br>';
        html += '<button class="btn-action" onclick="Save.save(1);UI.showToast(\'¡Slot 1 guardado!\');">Guardar Slot 1</button>';
        html += '<button class="btn-action" onclick="Save.save(2);UI.showToast(\'¡Slot 2 guardado!\');">Guardar Slot 2</button>';
        html += '<button class="btn-action" onclick="if(Save.load(1)){UI.showToast(\'¡Slot 1 cargado!\');UI.closeModal();}">Cargar Slot 1</button>';
        html += '<button class="btn-action" onclick="if(Save.load(2)){UI.showToast(\'¡Slot 2 cargado!\');UI.closeModal();}">Cargar Slot 2</button>';
        html += '<br><br>';
        html += '<p style="font-size:12px;color:#888;">Exportar/Importar partida como texto:</p>';
        html += '<button class="btn-action" onclick="var d=Save.exportSave();if(d){navigator.clipboard.writeText(d);UI.showToast(\'¡Copiado!\');}">Exportar</button>';
        html += '<div id="import-area" style="display:none;margin-top:8px;">';
        html += '<textarea id="import-text" rows="3" style="width:100%;background:#111;color:#eee;border:1px solid #555;border-radius:4px;padding:6px;font-size:12px;resize:vertical;" placeholder="Pega los datos de la partida aquí..."></textarea>';
        html += '<button class="btn-action" onclick="var d=document.getElementById(\'import-text\').value;if(d&&Save.importSave(d)){UI.showToast(\'¡Importado!\');UI.closeModal();}else if(d){UI.showToast(\'Datos inválidos\');}">Confirmar Importación</button>';
        html += '</div>';
        html += '<button class="btn-action" onclick="document.getElementById(\'import-area\').style.display=\'block\';this.style.display=\'none\';">Importar</button>';
        html += '<br><br>';
        html += '<button class="btn-action" onclick="if(Save.loadBackup()){UI.showToast(\'¡Backup restaurado!\');UI.closeModal();}else{UI.showToast(\'No hay backup\');}">Restaurar Backup</button>';

        html += '<h3>Controles</h3>';
        html += '<div style="font-size:12px;color:#ccc;line-height:2;">';
        html += '<p><kbd>WASD</kbd> / Flechas — Mover cámara</p>';
        html += '<p><kbd>R</kbd> — Rotar dirección</p>';
        html += '<p><kbd>Q</kbd> — Pipeta (copiar edificio bajo el cursor)</p>';
        html += '<p><kbd>Espacio</kbd> — Pausar / Reanudar</p>';
        html += '<p><kbd>Esc</kbd> — Cancelar modo construcción</p>';
        html += '<p><kbd>1-9</kbd> — Seleccionar edificio</p>';
        html += '<p><kbd>Clic derecho</kbd> — Eliminar edificio</p>';
        html += '<p><kbd>Clic medio / derecho + arrastrar</kbd> — Mover cámara</p>';
        html += '<p><kbd>Rueda ratón</kbd> — Zoom</p>';
        html += '<p><kbd>Clic en minimapa</kbd> — Navegar</p>';
        html += '<p><kbd>?</kbd> — Mostrar esta ayuda</p>';
        html += '</div>';

        content.innerHTML = html;
        modal.style.display = 'flex';
    },

    togglePrestige: function() {
        var modal = document.getElementById('modal');
        var content = document.getElementById('modal-content');
        if (modal.style.display === 'flex') { this.closeModal(); return; }

        var html = '<h2>Prestigio</h2>';
        html += '<p>Puntos de Fábrica: <strong>' + Prestige.points + '</strong></p>';

        if (Prestige.canPrestige()) {
            var earned = Prestige.calculatePoints();
            html += '<p>¿Reiniciar fábrica y ganar <strong>' + earned + '</strong> Puntos de Fábrica?</p>';
            html += '<button class="btn-prestige" onclick="Prestige.doPrestige();UI.closeModal();">¡PRESTIGIAR AHORA!</button>';
        } else {
            html += '<p style="color:#888">¡Lanza un cohete para desbloquear el Prestigio!</p>';
        }

        html += '<h3>Mejoras</h3>';
        for (var i = 0; i < CFG.PRESTIGE_UPGRADES.length; i++) {
            var up = CFG.PRESTIGE_UPGRADES[i];
            var level = Prestige.getUpgradeLevel(up.id);
            var cost = Prestige.getUpgradeCost(up.id);
            var maxed = level >= up.max;
            var canBuy = !maxed && Prestige.points >= cost;

            html += '<div class="upgrade-row">';
            html += '<span class="upgrade-name">' + up.name + '</span>';
            html += '<span class="upgrade-level">' + level + '/' + up.max + '</span>';
            if (!maxed) {
                html += '<button class="btn-upgrade' + (canBuy ? '' : ' disabled') + '" onclick="if(Prestige.buyUpgrade(\'' + up.id + '\')){UI.togglePrestige();UI.togglePrestige();}">' + cost + ' pts</button>';
            } else {
                html += '<span class="upgrade-max">MAX</span>';
            }
            html += '</div>';
        }

        content.innerHTML = html;
        modal.style.display = 'flex';
    },

    closeModal: function() {
        document.getElementById('modal').style.display = 'none';
        this._statsOpen = false;
    },

    showToast: function(text, type) {
        var container = document.getElementById('toast-container');
        var toast = document.createElement('div');
        toast.className = 'toast' + (type === 'achievement' ? ' toast-achievement' : type === 'warning' ? ' toast-warning' : '');
        toast.textContent = text;
        container.appendChild(toast);

        if (type === 'achievement') {
            Particles.spawn(window.innerWidth / 2, 60, 'achievement');
            Audio.play('milestone');
        }

        setTimeout(function() {
            toast.classList.add('toast-fade');
            setTimeout(function() {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3000);
    },

    showTutorial: function(text, highlight, hasNext) {
        var el = document.getElementById('tutorial-box');
        var backdrop = document.getElementById('tutorial-backdrop');
        var html = '<div class="tutorial-text">' + text.replace(/\n/g, '<br>') + '</div>';
        html += '<div class="tutorial-buttons">';
        if (hasNext) {
            html += '<button class="tutorial-next" onclick="Tutorial.nextStep()">Siguiente →</button>';
        } else {
            html += '<span class="tutorial-hint">Completa la acción para continuar</span>';
        }
        html += '<button class="tutorial-skip" onclick="Tutorial.skip()">Saltar</button>';
        html += '</div>';
        el.innerHTML = html;
        el.style.display = 'block';
        backdrop.style.display = 'block';

        var highlighted = document.querySelectorAll('.tutorial-highlight');
        for (var i = 0; i < highlighted.length; i++) {
            highlighted[i].classList.remove('tutorial-highlight');
        }
        if (highlight) {
            var target = document.getElementById(highlight);
            if (target) target.classList.add('tutorial-highlight');
        }
    },

    hideTutorial: function() {
        document.getElementById('tutorial-box').style.display = 'none';
        document.getElementById('tutorial-backdrop').style.display = 'none';
        var highlighted = document.querySelectorAll('.tutorial-highlight');
        for (var i = 0; i < highlighted.length; i++) {
            highlighted[i].classList.remove('tutorial-highlight');
        }
    },

    updatePauseState: function() {
        document.getElementById('pause-indicator').style.display = Game.paused ? 'block' : 'none';
    },

    formatNumber: function(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 10000) return (n / 1000).toFixed(1) + 'K';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return '' + n;
    },

    update: function(dt) {
        this.toastTimer += dt;
        if (this.toastTimer > 1) {
            this.toastTimer = 0;
            this.updateResources();
            this.updateToolbarSelection();

            if (Input.selectedBuilding && !Input.selectedBuilding.removed &&
                document.getElementById('info-panel').style.display === 'block') {
                this.showBuildingInfo(Input.selectedBuilding);
            }

            // Repintar solo los canvases (no rebuild del HTML — rompería scroll)
            if (this._statsOpen && document.getElementById('modal').style.display === 'flex') {
                this.paintStatsCharts();
            }
        }

        this._alertTimer += dt;
        if (this._alertTimer > 2) {
            this._alertTimer = 0;
            this.checkAlerts();
        }
    }
};
