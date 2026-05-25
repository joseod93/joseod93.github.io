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

                if (i < 9) {
                    var shortcut = document.createElement('span');
                    shortcut.className = 'btn-shortcut';
                    shortcut.textContent = (i + 1);
                    btn.appendChild(shortcut);
                }

                if (item.def.unlocked === false && !Tech.isUnlocked(item.type)) {
                    btn.classList.add('locked');
                    btn.title = 'Requiere: ' + (item.def.tech || 'Investigación');
                }

                (function(type) {
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        UI.selectBuildMode(type);
                    });
                })(item.type);

                container.appendChild(btn);
            }
        }
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
                    parts.push('<span style="color:' + color + '">' + c.qty + 'x ' + (ITEM_NAMES[c.item] || c.item) + '</span>');
                }
                costEl.innerHTML = parts.join(' ');
            } else {
                costEl.textContent = 'Gratis';
            }
            var arrows = ['↑','→','↓','←'];
            dirEl.textContent = arrows[Input.buildDirection];
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

        if (b.type === 'miner') {
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
        }

        if (b.type === 'furnace' && !Inventory.isEmpty(b.fuel)) {
            html += '<p>Combustible: ' + (b.fuel.coal || 0) + 'x Carbón</p>';
        }

        if (b.type === 'storage') {
            html += '<p>Almacenado: ' + Inventory.total(b.stored) + '/' + b.capacity + '</p>';
            for (var item3 in b.stored) {
                if (b.stored[item3] > 0) {
                    html += '<p>' + b.stored[item3] + 'x ' + (ITEM_NAMES[item3] || item3) + '</p>';
                }
            }
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

    toggleTechTree: function() {
        var modal = document.getElementById('modal');
        var content = document.getElementById('modal-content');

        if (modal.style.display === 'flex') {
            this.closeModal();
            return;
        }

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
                    html += '<button class="btn-research active" onclick="Game.currentResearch=null;UI.toggleTechTree();UI.toggleTechTree();">Cancelar</button>';
                } else {
                    html += '<button class="btn-research" onclick="Game.currentResearch=\'' + t.id + '\';UI.toggleTechTree();UI.toggleTechTree();">Investigar</button>';
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

    toggleStats: function() {
        var modal = document.getElementById('modal');
        var content = document.getElementById('modal-content');

        if (modal.style.display === 'flex') { this.closeModal(); return; }

        var s = Game.stats;
        var html = '<h2>Estadísticas</h2>';
        html += '<p>Edificios colocados: ' + s.buildingsPlaced + '</p>';
        html += '<p>Cohetes lanzados: ' + s.rocketsLaunched + '</p>';
        html += '<p>Ticks de juego: ' + Game.tick + ' (' + Math.floor(Game.tick / 20) + 's)</p>';

        html += '<h3>Items Producidos</h3>';
        for (var item in s.itemsProduced) {
            if (s.itemsProduced[item] > 0) {
                html += '<p><span class="resource-dot" style="background:' + Items.color(item) + '"></span> ';
                html += (ITEM_NAMES[item] || item) + ': ' + this.formatNumber(s.itemsProduced[item]) + '</p>';
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
    },

    toggleSettings: function() {
        var modal = document.getElementById('modal');
        var content = document.getElementById('modal-content');
        if (modal.style.display === 'flex') { this.closeModal(); return; }

        var html = '<h2>Ajustes</h2>';
        html += '<button class="btn-action" onclick="Audio.toggle();UI.toggleSettings();UI.toggleSettings();">Sonido: ' + (Audio.enabled ? 'ON' : 'OFF') + '</button>';
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
    },

    showToast: function(text, type) {
        var container = document.getElementById('toast-container');
        var toast = document.createElement('div');
        toast.className = 'toast' + (type === 'achievement' ? ' toast-achievement' : '');
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
        }
    }
};
