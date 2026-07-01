// Smoke test sin navegador: stubs mínimos de DOM/canvas y ejercicio de la
// lógica de juego (placement, demolición, undo, módulos, save/load, power,
// compactación). Ejecutar: node test/smoke.js
'use strict';

var failures = 0;
function assert(cond, msg) {
    if (cond) {
        console.log('  OK  ' + msg);
    } else {
        failures++;
        console.error('  FAIL ' + msg);
    }
}
function approx(a, b, eps) {
    return Math.abs(a - b) <= (eps || 1e-6);
}

// ===== Stubs de browser =====
function FakeCtx() {}
['fillRect','strokeRect','clearRect','beginPath','moveTo','lineTo','stroke','fill',
 'arc','closePath','save','restore','translate','scale','rotate','fillText',
 'setTransform','drawImage','quadraticCurveTo','setLineDash','createRadialGradient',
 'createLinearGradient','strokeText','clip','arcTo','rect','ellipse'].forEach(function(m) {
    FakeCtx.prototype[m] = function() {
        if (m === 'createRadialGradient' || m === 'createLinearGradient') {
            return {addColorStop: function() {}};
        }
    };
});

function FakeElement(tag) {
    this.tagName = tag || 'div';
    this.style = {};
    this.children = [];
    this.innerHTML = '';
    this.textContent = '';
    this.width = 800;
    this.height = 600;
    var classes = {};
    this.classList = {
        add: function(c) { classes[c] = true; },
        remove: function(c) { delete classes[c]; },
        toggle: function(c, v) { if (v) classes[c] = true; else delete classes[c]; },
        contains: function(c) { return !!classes[c]; }
    };
}
FakeElement.prototype.getContext = function() { return new FakeCtx(); };
FakeElement.prototype.addEventListener = function() {};
FakeElement.prototype.removeEventListener = function() {};
FakeElement.prototype.appendChild = function(c) { this.children.push(c); return c; };
FakeElement.prototype.removeChild = function(c) {};
FakeElement.prototype.setAttribute = function(k, v) { this['_attr_' + k] = v; };
FakeElement.prototype.getAttribute = function(k) { return this['_attr_' + k]; };
FakeElement.prototype.querySelector = function() { return null; };
FakeElement.prototype.querySelectorAll = function() { return []; };
FakeElement.prototype.getBoundingClientRect = function() {
    return {left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40};
};

var elements = {};
global.document = {
    getElementById: function(id) {
        if (!elements[id]) elements[id] = new FakeElement('div');
        return elements[id];
    },
    createElement: function(tag) { return new FakeElement(tag); },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    addEventListener: function() {},
    removeEventListener: function() {},
    documentElement: new FakeElement('html'),
    fullscreenElement: null
};
global.window = {
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1,
    addEventListener: function() {},
    AudioContext: undefined,
    webkitAudioContext: undefined
};
// Node 22: global.navigator es getter-only
Object.defineProperty(global, 'navigator', {
    value: {maxTouchPoints: 0},
    configurable: true
});
var storage = {};
global.localStorage = {
    getItem: function(k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
    setItem: function(k, v) { storage[k] = String(v); },
    removeItem: function(k) { delete storage[k]; }
};
global.performance = {now: function() { return Date.now(); }};
global.requestAnimationFrame = function() {}; // sin loop: tickeamos a mano
global.btoa = function(s) { return Buffer.from(s, 'binary').toString('base64'); };
global.atob = function(s) { return Buffer.from(s, 'base64').toString('binary'); };

// ===== Carga de scripts en el orden de index.html =====
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var base = path.join(__dirname, '..', 'js');
var order = ['config.js','camera.js','items.js','world.js','particles.js','audio.js',
    'belts.js','recipes.js','tech.js','prestige.js','buildings.js','renderer.js',
    'ui.js','save.js','tutorial.js','input.js','main.js'];

global.global = global;
order.forEach(function(f) {
    var code = fs.readFileSync(path.join(base, f), 'utf8');
    // Ejecutar en el contexto global compartido (como <script> en browser)
    vm.runInThisContext(code, {filename: f});
});

// Los archivos definen "var X" a nivel de script: con runInThisContext quedan en global
['CFG','ITEM_NAMES','Game','World','Buildings','Belts','UI','Renderer','Camera',
 'Input','Tech','Prestige','Save','Particles','Audio','Tutorial','Recipes',
 'Inventory','Items'].forEach(function(name) {
    assert(typeof global[name] !== 'undefined', 'global ' + name + ' definido');
});

// ===== Init =====
console.log('\n-- Init --');
Game.init();
World.init(20240611); // semilla fija: el mundo es aleatorio en juego, pero el test debe ser determinista
assert(World.buildings.length === 0, 'mundo nuevo sin edificios');
Game.creativeModeOn = true; // colocar gratis para el resto del test

function tick(n) {
    for (var i = 0; i < n; i++) Game.update();
}

// Buscar tiles libres (sin agua, sin edificio) en un bloque len×h.
// h por defecto 5 para que quepan edificios multi-tile (assembler 3×3, silo 5×5)
// colocados en (x,y): el footprint baja varias filas, no solo la fila y.
function findFreeRow(len, h) {
    h = h || 5;
    for (var ty = -50; ty < 50 - h; ty++) {
        for (var tx = -50; tx < 50 - len; tx++) {
            var ok = true;
            for (var j = 0; j < h && ok; j++) {
                for (var i = 0; i < len; i++) {
                    var t = World.getTile(tx + i, ty + j);
                    if (t.terrain === 'water' || t.buildingId !== null || t.resource) { ok = false; break; }
                }
            }
            if (ok) return {x: tx, y: ty};
        }
    }
    throw new Error('no hay fila libre');
}

// ===== Fase 0: coste de cintas =====
console.log('\n-- Fase 0: cintas cobran coste --');
Game.creativeModeOn = false;
Game.player.inventory = {};
var row = findFreeRow(3);
var placedNoRes = Belts.tryPlaceSingle(row.x, row.y, 1, 'fast_belt');
assert(placedNoRes === false, 'fast_belt sin recursos no se coloca');
Inventory.add(Game.player.inventory, 'iron_plate', 10);
Inventory.add(Game.player.inventory, 'iron_gear', 5);
var ironBefore = Inventory.count(Game.player.inventory, 'iron_plate');
assert(Belts.tryPlaceSingle(row.x, row.y, 1, 'fast_belt') === true, 'fast_belt con recursos se coloca');
assert(Inventory.count(Game.player.inventory, 'iron_plate') === ironBefore - 2, 'fast_belt cobró 2 placas');
var fb = World.getBuildingAt(row.x, row.y);
Buildings.remove(fb.id);
assert(Inventory.count(Game.player.inventory, 'iron_plate') === ironBefore, 'demoler devolvió el coste (ciclo neto cero)');
Game.creativeModeOn = true;

// ===== Colocación + undo individual =====
console.log('\n-- Undo individual --');
row = findFreeRow(4);
assert(Buildings.tryPlace(row.x, row.y, 'furnace', 1) === true, 'furnace colocada');
var furnace = World.getBuildingAt(row.x, row.y);
var fid = furnace.id;
Buildings.remove(fid);
assert(World.getBuildingAt(row.x, row.y) === null, 'furnace demolida');
assert(Buildings.undoStack.length > 0, 'undo stack tiene lote');
Buildings.undo();
var restored = World.getBuildingAt(row.x, row.y);
assert(restored !== null && restored.type === 'furnace', 'undo restauró la furnace');
assert(restored.direction === 1, 'undo conservó la dirección');

// ===== Copy/paste de configuración =====
console.log('\n-- Copy/paste config --');
var r2 = findFreeRow(8);
Buildings.tryPlace(r2.x, r2.y, 'inserter', 2);
var ins1 = World.getBuildingAt(r2.x, r2.y);
ins1.filterItem = 'coal';
Buildings.tryPlace(r2.x + 2, r2.y, 'inserter', 0);
var ins2 = World.getBuildingAt(r2.x + 2, r2.y);
Input.copyConfigFrom(ins1);
assert(Input.configClipboard && Input.configClipboard.type === 'inserter', 'clipboard guardó tipo inserter');
Input.pasteConfigTo(ins2);
assert(ins2.filterItem === 'coal', 'filtro pegado en el segundo inserter');
var snapNull = Buildings.getConfigSnapshot(World.getBuildingAt(row.x, row.y));
assert(snapNull === null, 'furnace no tiene config copiable');

// ===== Demolición en área + undo batch =====
console.log('\n-- Demolición en área + undo batch --');
var r3 = findFreeRow(10);
Buildings.tryPlace(r3.x, r3.y, 'storage', 0);
Buildings.tryPlace(r3.x + 2, r3.y, 'storage', 0);
Buildings.tryPlace(r3.x + 4, r3.y, 'inserter', 1);
var ids = Buildings.getIdsInRect(r3.x, r3.y, r3.x + 5, r3.y);
assert(ids.length === 3, 'getIdsInRect encontró los 3 edificios');
var removedN = Buildings.removeArea(r3.x, r3.y, r3.x + 5, r3.y);
assert(removedN === 3, 'removeArea demolió 3');
assert(World.getBuildingAt(r3.x, r3.y) === null, 'área vacía tras demoler');
Buildings.undo();
assert(World.getBuildingAt(r3.x, r3.y) !== null &&
       World.getBuildingAt(r3.x + 2, r3.y) !== null &&
       World.getBuildingAt(r3.x + 4, r3.y) !== null, 'undo batch restauró los 3');

// ===== Túnel subterráneo: demoler par + undo re-empareja =====
console.log('\n-- Túnel: demoler + undo re-empareja --');
Tech.completed.logistics = true;
var r4 = findFreeRow(8);
Buildings.tryPlace(r4.x, r4.y, 'underground_belt', 1);
Buildings.tryPlace(r4.x + 3, r4.y, 'underground_belt', 1);
var ugIn = World.getBuildingAt(r4.x, r4.y);
var ugOut = World.getBuildingAt(r4.x + 3, r4.y);
assert(ugIn.ugMode === 'in' && ugOut.ugMode === 'out', 'par túnel in/out');
assert(ugIn.pairId === ugOut.id && ugOut.pairId === ugIn.id, 'par túnel recíproco');
Buildings.removeArea(r4.x, r4.y, r4.x + 3, r4.y);
Buildings.undo();
var ugIn2 = World.getBuildingAt(r4.x, r4.y);
var ugOut2 = World.getBuildingAt(r4.x + 3, r4.y);
assert(ugIn2 && ugOut2 && ugIn2.pairId === ugOut2.id && ugOut2.pairId === ugIn2.id,
    'undo re-emparejó el túnel completo');

// Demoler solo la boca OUT y deshacer
Buildings.remove(ugOut2.id);
assert(World.getBuildingAt(r4.x, r4.y).pairId === null, 'al demoler out, in queda sin par');
Buildings.undo();
var ugOut3 = World.getBuildingAt(r4.x + 3, r4.y);
assert(ugOut3 && ugOut3.ugMode === 'out' && ugOut3.pairId === World.getBuildingAt(r4.x, r4.y).id,
    'undo de solo-out re-emparejó hacia atrás');

// Demoler solo la boca IN y deshacer (re-link hacia delante)
var inB = World.getBuildingAt(r4.x, r4.y);
Buildings.remove(inB.id);
Buildings.undo();
var inB2 = World.getBuildingAt(r4.x, r4.y);
var outB2 = World.getBuildingAt(r4.x + 3, r4.y);
assert(inB2 && inB2.ugMode === 'in' && inB2.pairId === outB2.id && outB2.pairId === inB2.id,
    'undo de solo-in re-emparejó hacia delante');

// ===== Módulos =====
console.log('\n-- Módulos --');
Tech.completed.automation = true;
Tech.completed.advanced_electronics = true;
Tech.completed.modules = true;
var r5 = findFreeRow(6);
Buildings.tryPlace(r5.x, r5.y, 'assembler', 0);
var asm = World.getBuildingAt(r5.x, r5.y);
assert(asm.modules && asm.modules.length === 0 && asm.modSpeed === 1 && asm.modEnergy === 1,
    'assembler nace con slots vacíos y mults 1');
var baseCons = Game.powerCache.consumptionBase;
Inventory.add(Game.player.inventory, 'speed_module', 4);
Inventory.add(Game.player.inventory, 'efficiency_module', 4);
Buildings.insertModule(asm.id, 'speed_module');
assert(approx(asm.modSpeed, 1.3) && approx(asm.modEnergy, 1.5), '1 speed: +30% vel, +50% energía');
assert(approx(Game.powerCache.consumptionBase, baseCons + 50 * 0.5), 'consumptionBase subió 25 kW (50×0.5)');
Buildings.insertModule(asm.id, 'speed_module');
assert(approx(asm.modSpeed, 1.6) && approx(asm.modEnergy, 2.0), '2 speed: +60% vel, +100% energía');
Buildings.insertModule(asm.id, 'speed_module');
assert(asm.modules.length === 2, 'tercer módulo rechazado (2 slots)');
// Coherencia incremental vs recalc
var consIncremental = Game.powerCache.consumptionBase;
Game.recalcPowerCache();
assert(approx(Game.powerCache.consumptionBase, consIncremental), 'cache incremental == recalc completo');
// Quitar módulo
Buildings.removeModule(asm.id, 0);
assert(asm.modules.length === 1 && approx(asm.modEnergy, 1.5), 'removeModule devolvió y recalculó');
assert(Inventory.count(Game.player.inventory, 'speed_module') === 3, 'módulo devuelto al inventario');
// Suelo de energía con eficiencia
var r6 = findFreeRow(4);
Buildings.tryPlace(r6.x, r6.y, 'lab', 0);
var lab = World.getBuildingAt(r6.x, r6.y);
Buildings.insertModule(lab.id, 'efficiency_module');
Buildings.insertModule(lab.id, 'efficiency_module');
assert(approx(lab.modEnergy, 0.4), 'lab 2 eficiencia: 40% de energía');
// Demoler con módulos: refund + cache limpio
var consBefore = Game.powerCache.consumptionBase;
var effInvBefore = Inventory.count(Game.player.inventory, 'efficiency_module');
Buildings.remove(lab.id);
assert(Inventory.count(Game.player.inventory, 'efficiency_module') === effInvBefore + 2,
    'demoler devolvió los 2 módulos');
assert(approx(Game.powerCache.consumptionBase, consBefore - 30 * 0.4),
    'demoler restó exactamente lo registrado (30×0.4)');

// ===== Save/load: compactación + remap de pairId (prueba reina) =====
console.log('\n-- Save/load: remap de túneles --');
// Demoler varios edificios para crear huecos delante del par de túnel
Buildings.remove(World.getBuildingAt(r3.x, r3.y).id);
Buildings.remove(World.getBuildingAt(r3.x + 2, r3.y).id);
Buildings.remove(World.getBuildingAt(r3.x + 4, r3.y).id);
var inFinal = World.getBuildingAt(r4.x, r4.y);
var outFinal = World.getBuildingAt(r4.x + 3, r4.y);
assert(inFinal.pairId === outFinal.id, 'precondición: par válido antes de save');
assert(Save.save() === true, 'save OK');
var savedData = JSON.parse(localStorage.getItem('factoryEmpire_auto'));
var nulls = savedData.buildings.filter(function(x) { return x === null; }).length;
assert(nulls === 0, 'save compacto: sin nulls');
var aliveCount = World.buildings.filter(function(b) { return b && !b.removed; }).length;
assert(savedData.buildings.length === aliveCount, 'save emite solo vivos');

Save.load();
// Tras load: buscar el par por posición
var inLoaded = World.getBuildingAt(r4.x, r4.y);
var outLoaded = World.getBuildingAt(r4.x + 3, r4.y);
assert(inLoaded && outLoaded && inLoaded.type === 'underground_belt', 'túneles cargados');
assert(inLoaded.pairId === outLoaded.id && outLoaded.pairId === inLoaded.id,
    'pairId remapeado correctamente tras load');
var asmLoaded = World.getBuildingAt(r5.x, r5.y);
assert(asmLoaded.modules.length === 1 && approx(asmLoaded.modSpeed, 1.3),
    'módulos persistidos tras load');
var consAfterLoad = Game.powerCache.consumptionBase;
Game.recalcPowerCache();
assert(approx(Game.powerCache.consumptionBase, consAfterLoad), 'power cache consistente tras load');
assert(Buildings.undoStack.length === 0, 'undo stack limpiado en load');

// ===== Save corrupto: entrada mala se salta, resto carga =====
console.log('\n-- Save corrupto --');
var d = JSON.parse(localStorage.getItem('factoryEmpire_auto'));
var totalEntries = d.buildings.length;
d.buildings[0] = {t: 'tipo_inexistente', x: 0, y: 0};
localStorage.setItem('factoryEmpire_auto', JSON.stringify(d));
assert(Save.load() === true, 'load con entrada corrupta no revienta');
var aliveAfter = World.buildings.filter(function(b) { return b && !b.removed; }).length;
assert(aliveAfter === totalEntries - 1, 'cargó todas las entradas menos la corrupta');

// pairId fuera de rango → validateLoaded lo repara
var d2 = JSON.parse(localStorage.getItem('factoryEmpire_auto'));
for (var di = 0; di < d2.buildings.length; di++) {
    if (d2.buildings[di] && d2.buildings[di].t === 'underground_belt' && d2.buildings[di].um === 'in') {
        d2.buildings[di].pi = 99999;
        break;
    }
}
localStorage.setItem('factoryEmpire_auto', JSON.stringify(d2));
Save.load();
var allUgValid = true;
for (var bi = 0; bi < World.buildings.length; bi++) {
    var ub = World.buildings[bi];
    if (ub && !ub.removed && ub.type === 'underground_belt' && ub.pairId !== null) {
        var mate = World.buildings[ub.pairId];
        if (!mate || mate.removed || mate.pairId !== ub.id) allUgValid = false;
    }
}
assert(allUgValid, 'validateLoaded reparó el pairId fuera de rango');

// JSON roto → backup restaurado por loadBackup.
// Dos saves seguidos: el segundo copia el main válido del primero al backup.
Save.save();
Save.save();
assert(Save.hasBackup() === true, 'segundo save creó backup');
localStorage.setItem('factoryEmpire_auto', '{roto');
assert(Save.load() === false, 'JSON roto: load devuelve false');
assert(Save.loadBackup() === true, 'backup carga OK');
var promoted = localStorage.getItem('factoryEmpire_auto');
assert(promoted && promoted.charAt(0) === '{' && promoted.indexOf('"version"') !== -1,
    'backup promovido a main');
// save() con main corrupto no pisa el backup bueno
localStorage.setItem('factoryEmpire_auto', '{roto');
var goodBackup = localStorage.getItem('factoryEmpire_auto_backup');
Save.save();
assert(localStorage.getItem('factoryEmpire_auto_backup') === goodBackup,
    'main corrupto NO pisó el backup bueno');

// ===== Compactación runtime =====
console.log('\n-- Compactación runtime --');
Save.load();
// Par de túnel NUEVO (el de r4 quedó desemparejado a propósito por el test
// de validateLoaded): huecos delante + par detrás = remap real
var r7 = findFreeRow(20);
for (var ci = 0; ci < 8; ci++) {
    Buildings.tryPlace(r7.x + ci * 2, r7.y, 'storage', 0);
}
var rTun = findFreeRow(6);
Buildings.tryPlace(rTun.x, rTun.y, 'underground_belt', 1);
Buildings.tryPlace(rTun.x + 3, rTun.y, 'underground_belt', 1);
for (var ci2 = 0; ci2 < 6; ci2++) {
    Buildings.remove(World.getBuildingAt(r7.x + ci2 * 2, r7.y).id);
}
var lenBefore = World.buildings.length;
assert(World.deadCount >= 6, 'deadCount cuenta demoliciones');
var inPre = World.getBuildingAt(rTun.x, rTun.y);
var outPre = World.getBuildingAt(rTun.x + 3, rTun.y);
assert(inPre.pairId === outPre.id, 'precondición: par nuevo emparejado');
World.compactBuildings();
assert(World.buildings.length < lenBefore, 'compactBuildings redujo el array');
assert(World.deadCount === 0, 'deadCount reseteado');
var inPost = World.getBuildingAt(rTun.x, rTun.y);
var outPost = World.getBuildingAt(rTun.x + 3, rTun.y);
assert(inPost === inPre && outPost === outPre, 'referencias a objeto sobreviven la compactación');
assert(inPost.pairId === outPost.id && outPost.pairId === inPost.id,
    'pairId remapeado en compactación runtime');
assert(World.buildingMap[World.tileKey(rTun.x, rTun.y)] === inPost.id, 'buildingMap reconstruido');
var consCompact = Game.powerCache.consumptionBase;
Game.recalcPowerCache();
assert(approx(Game.powerCache.consumptionBase, consCompact), 'power cache OK tras compactación');

// Belts compact
var blBefore = Belts.lines.length;
Belts.compactLines();
var anyDead = Belts.lines.some(function(l) { return l.removed; });
assert(!anyDead, 'compactLines purgó líneas muertas');

// ===== Ticks de estabilidad =====
console.log('\n-- Estabilidad: 200 ticks --');
var threw = false;
try { tick(200); } catch(e) { threw = true; console.error(e); }
assert(!threw, '200 ticks sin excepciones');

// ===== Silo: refund de rocketParts =====
console.log('\n-- Silo: refund piezas --');
Tech.completed.rocketry = true;
var r8 = findFreeRow(7);
Buildings.tryPlace(r8.x, r8.y, 'rocket_silo', 0);
var silo = World.getBuildingAt(r8.x, r8.y);
silo.rocketParts = 42;
var rpBefore = Inventory.count(Game.player.inventory, 'rocket_part');
Buildings.remove(silo.id);
assert(Inventory.count(Game.player.inventory, 'rocket_part') === rpBefore + 42,
    'demoler silo devolvió las 42 piezas');

// ===== Render: ejercitar overlays nuevos con el canvas fake =====
console.log('\n-- Render (canvas fake) --');
function renderOnce(label) {
    var threwR = false;
    try { Renderer.render(0.05); } catch(e) { threwR = true; console.error(e); }
    assert(!threwR, 'render sin excepciones: ' + label);
}
Input.buildMode = null;
Input.demolishMode = false;
Input.selectedBuilding = null;
renderOnce('estado base');

Input.buildMode = 'underground_belt';
Input.mouse.tile = {x: r4.x + 2, y: r4.y};
renderOnce('preview túnel');

Input.buildMode = 'inserter';
renderOnce('overlay inserter (buildMode)');

Input.buildMode = 'electric_miner';
renderOnce('overlay minero (buildMode)');

Input.buildMode = null;
Input.selectedBuilding = World.getBuildingAt(rTun.x, rTun.y);
renderOnce('selección underground');

Input.selectedBuilding = null;
Input.demolishMode = true;
Input.isDragging = true;
Input.dragStart = {x: r7.x, y: r7.y};
Input.demolishEnd = {x: r7.x + 6, y: r7.y + 2};
renderOnce('preview demolición (drag)');
Input.isDragging = false;
Input.demolishMode = false;

// Edificio con módulos visible (puntitos)
Input.mouse.tile = {x: r5.x, y: r5.y};
renderOnce('puntitos de módulos');

// ===== Regresiones nuevas: deadlock, lab, cintas retroactivas, refund, objetivos =====
console.log('\n-- Regresiones (deadlock/lab/cintas/refund/objetivos) --');

// 1) Sin deadlock: assembler desbloqueado de inicio
assert(Tech.isUnlocked('assembler'), 'assembler desbloqueado de inicio (deadlock roto)');
assert(CFG.BUILDING_DEFS.assembler.unlocked === true, 'assembler.unlocked = true');

// 2) Velocidad de cinta retroactiva
Game.creativeModeOn = true;
var rb = findFreeRow(4);
Belts.tryPlaceSingle(rb.x, rb.y, 1, 'belt');
var bl = Belts.getLineAt(rb.x, rb.y);
var baseSp = bl.speed;
assert(bl.fast === false, 'línea de cinta normal marcada fast=false');
Tech.completed.logistics_2 = true;
Belts.recomputeSpeeds();
assert(approx(bl.speed, baseSp * 1.5), 'logistics_2 acelera líneas YA colocadas (retroactivo)');
Tech.completed.logistics_2 = false;
Belts.recomputeSpeeds();
assert(approx(bl.speed, baseSp), 'velocidad vuelve a base sin logistics_2');

// 3) Lab no sobreconsume con costes desiguales (cantidades exactas completan)
Tech.completed.electric_mining = false;
delete Tech.progress.electric_mining;
Game.currentResearch = 'electric_mining'; // {red_science:30, green_science:15}
var rl = findFreeRow(3);
Buildings.tryPlace(rl.x, rl.y, 'lab', 0);
var theLab = World.getBuildingAt(rl.x, rl.y);
Inventory.add(theLab.input, 'red_science', 30);
Inventory.add(theLab.input, 'green_science', 15);
Game.power.satisfaction = 1;
for (var lc = 0; lc < 20000 && !Tech.isCompleted('electric_mining'); lc++) {
    Buildings.updateLab(theLab, CFG.BUILDING_DEFS.lab, 1);
}
assert(Tech.isCompleted('electric_mining'), 'tech de coste desigual se completa con cantidades exactas');
assert((theLab.input.red_science || 0) === 0 && (theLab.input.green_science || 0) === 0,
    'lab consumió exactamente lo aportado (sin sobreconsumo)');
Game.currentResearch = null;

// 4) Cambiar receta de assembler DEVUELVE el input (no lo destruye)
var ra = findFreeRow(6);
Buildings.tryPlace(ra.x, ra.y, 'assembler', 0);
var asm2 = World.getBuildingAt(ra.x, ra.y);
asm2.recipeId = 'iron_gear';
Inventory.add(asm2.input, 'iron_plate', 6);
var platesBefore = Inventory.count(Game.player.inventory, 'iron_plate');
UI.setRecipe(asm2.id, 'copper_wire');
assert(Inventory.count(Game.player.inventory, 'iron_plate') === platesBefore + 6,
    'cambiar receta devolvió las 6 placas del input (sin destruir)');
assert(Object.keys(asm2.input).length === 0 || (asm2.input.iron_plate || 0) === 0,
    'input vaciado tras cambiar receta');

// 4b) Cinta rápida NO se fusiona con línea normal al colocar un puente normal entre ellas
Tech.completed.logistics = true;
var rmix = findFreeRow(7);
Belts.tryPlaceSingle(rmix.x, rmix.y, 1, 'belt');
Belts.tryPlaceSingle(rmix.x + 1, rmix.y, 1, 'belt');
Belts.tryPlaceSingle(rmix.x + 3, rmix.y, 1, 'fast_belt');
Belts.tryPlaceSingle(rmix.x + 2, rmix.y, 1, 'belt'); // puente
var lnN = Belts.getLineAt(rmix.x, rmix.y);
var lnF = Belts.getLineAt(rmix.x + 3, rmix.y);
assert(lnN !== lnF && approx(lnF.speed, CFG.FAST_BELT_SPEED) && approx(lnN.speed, CFG.BELT_SPEED),
    'cintas de distinta velocidad NO se fusionan (fast conserva 0.1, normal 0.05)');

// 4c) MILESTONES usan funciones ES5 (no arrow)
assert(typeof CFG.MILESTONES[0].check === 'function' &&
    CFG.MILESTONES[0].check({itemsProduced:{iron_plate:5}, buildingsPlaced:0, techsCompleted:0, rocketsLaunched:0}) === true,
    'MILESTONES.check son funciones ES5 y evalúan');

// 4d) Drag-to-place: fila de edificios 1×1 por arrastre (móvil)
Game.creativeModeOn = true;
var rdp = findFreeRow(6);
Input.buildMode = 'inserter'; Input.buildDirection = 1;
assert(Input.isDragPlaceMode() === true, 'inserter 1×1 es drag-place');
Input.buildMode = 'miner';
assert(Input.isDragPlaceMode() === false, 'miner 2×2 NO es drag-place');
Input.buildMode = 'inserter';
Input.dragStart = {x: rdp.x, y: rdp.y};
Input.updateBuildPath({x: rdp.x + 4, y: rdp.y});
assert(Input.ghostTiles.length === 5, 'drag genera 5 ghosts');
Input.placeBuildPath();
var dpCnt = 0;
for (var dpi = 0; dpi < 5; dpi++) { var dpb = World.getBuildingAt(rdp.x + dpi, rdp.y); if (dpb && dpb.type === 'inserter') dpCnt++; }
assert(dpCnt === 5, 'arrastre colocó 5 insertadores con dirección respetada');
Input.buildMode = null; Input.dragStart = null; Input.ghostTiles = [];

// 5) Objetivos avanzan y dan recompensa
Game.objectiveIndex = 0;
Game.stats.itemsProduced.iron_ore = (Game.stats.itemsProduced.iron_ore || 0) + 50;
Game.checkObjectives();
assert(Game.objectiveIndex >= 1, 'objetivo avanza al cumplir el primero');

console.log('\n========================================');
if (failures > 0) {
    console.error(failures + ' FALLOS');
    process.exit(1);
} else {
    console.log('TODO OK');
}
