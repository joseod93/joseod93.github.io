var CFG = {
    TILE: 32,
    CHUNK: 16,
    TPS: 20,
    TICK_MS: 50,
    MAX_TICKS_PER_FRAME: 5,
    ZOOM_MIN: 0.3,
    ZOOM_MAX: 4,
    ZOOM_SPEED: 0.1,
    PAN_SPEED: 400,
    BELT_SPEED: 0.05,
    FAST_BELT_SPEED: 0.1,
    ITEM_SPACING: 0.35,
    AUTOSAVE_INTERVAL: 60000,
    MAX_PARTICLES: 200,
    OUTPUT_BUFFER_MAX: 15,
    INPUT_BUFFER_MAX: 10,
    UNDERGROUND_MAX_DIST: 4,

    COLORS: {
        bg: '#1a1a2e',
        accent: '#e6a832',
        text: '#eeeedd',
        positive: '#44cc66',
        negative: '#dd4444',
        grid: 'rgba(255,255,255,0.08)',
        gridBuild: 'rgba(255,255,255,0.2)',
        validPlace: 'rgba(0,200,80,0.25)',
        invalidPlace: 'rgba(200,0,40,0.25)',
        terrain: {
            grass: ['#2d5a2e','#3a6639','#2f5530','#357a36'],
            earth: ['#4d3a27','#5a4530','#4f402c','#5f4b35'],
            water: '#2244aa',
            sand: '#aa9977'
        },
        resources: {
            iron_ore:   {bg:'#446688', fg:'#88bbdd', label:'Fe'},
            copper_ore: {bg:'#884411', fg:'#dd8833', label:'Cu'},
            coal:       {bg:'#222222', fg:'#555555', label:'C'},
            stone:      {bg:'#665544', fg:'#aa9988', label:'St'}
        },
        items: {
            iron_ore:'#7799bb', copper_ore:'#cc7733', coal:'#333333', stone:'#998877',
            iron_plate:'#99aabb', copper_plate:'#ddaa55', steel:'#ccccdd', stone_brick:'#aa9988',
            iron_gear:'#8899aa', copper_wire:'#ee8844', green_circuit:'#44aa66',
            advanced_circuit:'#cc4444', red_science:'#dd3333', green_science:'#33bb33',
            blue_science:'#3366dd', rocket_part:'#ddddff',
            speed_module:'#4488ee', efficiency_module:'#55cc44'
        },
        buildings: {
            // Color por función: minería=azul, fundición=naranja, fabricación=verde/púrpura,
            // logística=ámbar, energía=cian/ámbar-sol/teal distintos, almacén=tostado, cohete=acero claro
            miner:      {bg:'#2f6690', fg:'#4f95c8', label:'MI'},
            electric_miner:{bg:'#1f8fb0', fg:'#52d2ea', label:'EM'},
            belt:       {bg:'#b8923a', fg:'#e6c456', label:''},
            fast_belt:  {bg:'#c89a2e', fg:'#f2d65a', label:''},
            furnace:    {bg:'#aa3a16', fg:'#ec5e2c', label:'FU'},
            assembler:  {bg:'#2f9159', fg:'#52cf88', label:'AS'},
            storage:    {bg:'#6e6450', fg:'#9c9176', label:'ST'},
            steam_engine:{bg:'#5d5868', fg:'#928ca6', label:'SE'},
            solar_panel:{bg:'#2c7fd4', fg:'#6fc2ff', label:'SO'},
            lab:        {bg:'#7a3f9e', fg:'#b884e2', label:'LA'},
            splitter:   {bg:'#a8842f', fg:'#d8bb4c', label:'SP'},
            inserter:   {bg:'#9a9a36', fg:'#cccd5e', label:'IN'},
            rocket_silo:{bg:'#8a93a8', fg:'#ccd8ef', label:'RS'},
            accumulator:{bg:'#2a8f7a', fg:'#5fd9bb', label:'AC'},
            underground_belt:{bg:'#8a7320', fg:'#cab24a', label:'SU'}
        }
    },

    DIRECTIONS: [
        {dx:0, dy:-1, name:'up'},
        {dx:1, dy:0,  name:'right'},
        {dx:0, dy:1,  name:'down'},
        {dx:-1,dy:0,  name:'left'}
    ],

    BUILDING_DEFS: {
        miner: {
            name:'Minero', icon:'⛏', size:[2,2], category:'production',
            cost:[{item:'iron_plate',qty:2},{item:'iron_gear',qty:1}],
            miningSpeed:0.015, powerDraw:0, fuelBurner:false,
            outputSlots:1, inputSlots:0, unlocked:true
        },
        electric_miner: {
            name:'Minero Eléctrico', icon:'⚡', size:[2,2], category:'production',
            cost:[{item:'iron_plate',qty:5},{item:'iron_gear',qty:3},{item:'green_circuit',qty:2}],
            miningSpeed:0.03, powerDraw:60, fuelBurner:false, moduleSlots:2,
            outputSlots:1, inputSlots:0, unlocked:false, tech:'electric_mining'
        },
        belt: {
            name:'Cinta', icon:'➡', size:[1,1], category:'logistics',
            cost:[], outputSlots:0, inputSlots:0,
            unlocked:true, speed:0.05
        },
        fast_belt: {
            name:'Cinta Rápida', icon:'⏩', size:[1,1], category:'logistics',
            cost:[{item:'iron_plate',qty:2},{item:'iron_gear',qty:1}],
            outputSlots:0, inputSlots:0,
            unlocked:false, tech:'logistics', speed:0.1
        },
        furnace: {
            name:'Fundidora', icon:'🔥', size:[2,2], category:'production',
            cost:[{item:'stone',qty:5}],
            craftSpeed:1, powerDraw:0, fuelBurner:true,
            outputSlots:1, inputSlots:1, unlocked:true
        },
        assembler: {
            name:'Ensamblador', icon:'🔧', size:[3,3], category:'production',
            cost:[{item:'iron_plate',qty:5},{item:'iron_gear',qty:3}],
            craftSpeed:1, powerDraw:50, fuelBurner:false, moduleSlots:2,
            outputSlots:1, inputSlots:4, unlocked:true
        },
        storage: {
            name:'Almacén', icon:'📦', size:[1,1], category:'logistics',
            cost:[{item:'iron_plate',qty:2}],
            capacity:200, unlocked:true
        },
        steam_engine: {
            name:'Motor Vapor', icon:'💨', size:[2,3], category:'power',
            cost:[{item:'iron_plate',qty:8},{item:'stone_brick',qty:4}],
            powerOutput:500, fuelBurner:true, unlocked:true
        },
        solar_panel: {
            name:'Panel Solar', icon:'☀', size:[2,2], category:'power',
            cost:[{item:'iron_plate',qty:5},{item:'copper_plate',qty:5},{item:'green_circuit',qty:3}],
            powerOutput:60, unlocked:false, tech:'solar_energy'
        },
        lab: {
            name:'Laboratorio', icon:'🔬', size:[2,2], category:'production',
            cost:[{item:'iron_plate',qty:4},{item:'copper_plate',qty:4},{item:'green_circuit',qty:2}],
            researchSpeed:1, powerDraw:30, unlocked:true, moduleSlots:2,
            inputSlots:3
        },
        inserter: {
            name:'Insertador', icon:'🤏', size:[1,1], category:'logistics',
            cost:[{item:'iron_plate',qty:1},{item:'iron_gear',qty:1}],
            grabSpeed:0.02, unlocked:true
        },
        splitter: {
            name:'Divisor', icon:'🔀', size:[1,1], category:'logistics',
            cost:[{item:'iron_plate',qty:3},{item:'green_circuit',qty:1}],
            unlocked:false, tech:'logistics'
        },
        rocket_silo: {
            name:'Silo Cohete', icon:'🚀', size:[5,5], category:'production',
            cost:[{item:'steel',qty:50},{item:'advanced_circuit',qty:20},{item:'green_circuit',qty:50}],
            craftSpeed:1, powerDraw:500, unlocked:false, tech:'rocketry',
            outputSlots:1, inputSlots:4
        },
        accumulator: {
            name:'Acumulador', icon:'🔋', size:[2,2], category:'power',
            cost:[{item:'iron_plate',qty:5},{item:'copper_plate',qty:5},{item:'green_circuit',qty:2}],
            capacity:50000, chargeRate:100, dischargeRate:100,
            unlocked:false, tech:'solar_energy'
        },
        underground_belt: {
            name:'Cinta Subterránea', icon:'⤵', size:[1,1], category:'logistics',
            cost:[{item:'iron_plate',qty:5},{item:'iron_gear',qty:2}],
            unlocked:false, tech:'logistics', transitSpeed:0.05
        }
    },

    // Módulos insertables en edificios eléctricos con moduleSlots.
    // speed/energy son deltas por unidad; la energía total tiene suelo.
    MODULES: {
        speed_module:      {speed:0.30, energy:0.50},
        efficiency_module: {speed:0,    energy:-0.30}
    },
    MODULE_MIN_ENERGY: 0.2,

    SMELTING_RECIPES: {
        iron_ore:   {output:'iron_plate',   qty:1, time:60},
        copper_ore: {output:'copper_plate',  qty:1, time:60},
        iron_plate: {output:'steel',         qty:1, time:120, inputQty:2},
        stone:      {output:'stone_brick',   qty:1, time:40}
    },

    ASSEMBLY_RECIPES: [
        {id:'iron_gear',       inputs:[{item:'iron_plate',qty:2}],                                    output:'iron_gear',       qty:1, time:30},
        {id:'copper_wire',     inputs:[{item:'copper_plate',qty:1}],                                  output:'copper_wire',     qty:2, time:15},
        {id:'green_circuit',   inputs:[{item:'iron_plate',qty:1},{item:'copper_wire',qty:3}],          output:'green_circuit',   qty:1, time:30},
        {id:'advanced_circuit',inputs:[{item:'green_circuit',qty:2},{item:'copper_wire',qty:4}],       output:'advanced_circuit',qty:1, time:60, tech:'advanced_electronics'},
        {id:'red_science',     inputs:[{item:'iron_gear',qty:1},{item:'copper_plate',qty:1}],          output:'red_science',     qty:1, time:100},
        {id:'green_science',   inputs:[{item:'iron_plate',qty:1},{item:'green_circuit',qty:1}],        output:'green_science',   qty:1, time:120},
        {id:'blue_science',    inputs:[{item:'advanced_circuit',qty:1},{item:'steel',qty:1}],          output:'blue_science',    qty:1, time:180, tech:'advanced_electronics'},
        {id:'rocket_part',     inputs:[{item:'steel',qty:5},{item:'advanced_circuit',qty:2},{item:'green_circuit',qty:5}], output:'rocket_part', qty:1, time:200, tech:'rocketry'},
        {id:'speed_module',    inputs:[{item:'advanced_circuit',qty:2},{item:'green_circuit',qty:2}],   output:'speed_module',    qty:1, time:200, tech:'modules'},
        {id:'efficiency_module',inputs:[{item:'advanced_circuit',qty:1},{item:'green_circuit',qty:2},{item:'copper_wire',qty:2}], output:'efficiency_module', qty:1, time:150, tech:'modules'},
        {id:'belt',            inputs:[{item:'iron_plate',qty:1}],                                    output:'belt_item',       qty:1, time:15},
        {id:'inserter_craft',  inputs:[{item:'iron_plate',qty:1},{item:'iron_gear',qty:1}],           output:'inserter_item',   qty:1, time:20}
    ],

    TECH_TREE: {
        automation:           {name:'Automatización',       cost:{red_science:10},                              prereqs:[], unlocks:['Abre el árbol: logística, electrónica y minería']},
        logistics:            {name:'Logística',            cost:{red_science:20},                              prereqs:['automation'], unlocks:['Divisor','Cinta Rápida','Cinta Subterránea']},
        electric_mining:      {name:'Minería Eléctrica',    cost:{red_science:30, green_science:15},            prereqs:['automation'], unlocks:['Minero Eléctrico']},
        advanced_electronics: {name:'Electrónica Avanzada', cost:{red_science:40, green_science:40},            prereqs:['automation'], unlocks:['circuito avanzado']},
        modules:              {name:'Módulos',              cost:{red_science:60, green_science:60, blue_science:20}, prereqs:['advanced_electronics'], unlocks:['Módulo Velocidad','Módulo Eficiencia']},
        solar_energy:         {name:'Energía Solar',        cost:{red_science:50, green_science:30},            prereqs:['electric_mining'], unlocks:['panel solar','Acumulador']},
        rocketry:             {name:'Cohetería',            cost:{red_science:200,green_science:200,blue_science:200}, prereqs:['advanced_electronics'], unlocks:['Silo Cohete','Pieza Cohete']},
        fast_inserters:       {name:'Insertadores Rápidos', cost:{red_science:40, green_science:40},             prereqs:['logistics'], unlocks:['Insertadores x2 velocidad']},
        efficiency:           {name:'Eficiencia Energética',cost:{red_science:60, green_science:60},             prereqs:['solar_energy'], unlocks:['-25% consumo energía']},
        mass_production:      {name:'Producción en Masa',  cost:{red_science:80, green_science:80, blue_science:40}, prereqs:['advanced_electronics'], unlocks:['+50% vel. fabricación']},
        logistics_2:          {name:'Logística Avanzada',  cost:{red_science:100,green_science:100,blue_science:50}, prereqs:['logistics','advanced_electronics'], unlocks:['+50% vel. cintas']}
    },

    PRESTIGE_UPGRADES: [
        {id:'mining_speed',   name:'Vel. Minería +10%',    cost:10, max:10, effect:'miningSpeed', mult:0.1},
        {id:'craft_speed',    name:'Vel. Fabricación +10%', cost:15, max:10, effect:'craftSpeed',  mult:0.1},
        {id:'belt_speed',     name:'Vel. Cintas +10%',     cost:12, max:10, effect:'beltSpeed',   mult:0.1},
        {id:'start_resources',name:'Recursos Iniciales',   cost:20, max:5,  effect:'startRes',    mult:1},
        {id:'auto_research',  name:'Auto-Investigación',   cost:50, max:3,  effect:'autoResearch', mult:1},
        {id:'larger_patches', name:'Vetas Grandes +20%',   cost:25, max:5,  effect:'patchSize',   mult:0.2}
    ],

    // Objetivos: guía persistente de "qué hacer ahora" que continúa MÁS ALLÁ del tutorial.
    // check() devuelve true cuando está cumplido; reward (opcional) son items de empujón.
    OBJECTIVES: [
        {id:'mine',     text:'Toca una veta de mineral para extraer recursos',
            check:function(){ var p=Game.stats.itemsProduced; return (p.iron_ore||0)+(p.copper_ore||0)+(p.coal||0)+(p.stone||0) >= 8; },
            prog:function(){ var p=Game.stats.itemsProduced; return {cur:Math.min(8,(p.iron_ore||0)+(p.copper_ore||0)+(p.coal||0)+(p.stone||0)), max:8}; }},
        {id:'smelt',    text:'Funde mineral en una Fundidora (10 placas de hierro)',
            check:function(){ return (Game.stats.itemsProduced.iron_plate||0) >= 10; },
            prog:function(){ return {cur:Math.min(10,Game.stats.itemsProduced.iron_plate||0), max:10}; }},
        {id:'miner',    text:'Coloca un Minero sobre una veta para automatizar',
            check:function(){ return Game.countBuildings('miner')+Game.countBuildings('electric_miner') >= 1; }},
        {id:'power',    text:'Genera energía colocando un Motor de Vapor (con carbón)',
            check:function(){ return Game.power.production > 0; }},
        {id:'assembler',text:'Coloca un Ensamblador para fabricar componentes',
            check:function(){ return Game.countBuildings('assembler') >= 1; }, reward:[{item:'iron_plate',qty:20}]},
        {id:'circuit',  text:'Fabrica 5 Circuitos Verdes en un Ensamblador',
            check:function(){ return (Game.stats.itemsProduced.green_circuit||0) >= 5; }, reward:[{item:'copper_plate',qty:15}],
            prog:function(){ return {cur:Math.min(5,Game.stats.itemsProduced.green_circuit||0), max:5}; }},
        {id:'lab',      text:'Coloca un Laboratorio e investiga',
            check:function(){ return Game.countBuildings('lab') >= 1; }},
        {id:'research', text:'Completa la investigación de Automatización',
            check:function(){ return Tech.isCompleted('automation'); }, reward:[{item:'green_circuit',qty:5}]},
        {id:'iron100',  text:'Produce 100 placas de hierro en cadena',
            check:function(){ return (Game.stats.itemsProduced.iron_plate||0) >= 100; },
            prog:function(){ return {cur:Math.min(100,Game.stats.itemsProduced.iron_plate||0), max:100}; }},
        {id:'logistics',text:'Investiga Logística (cintas rápidas, divisores, túneles)',
            check:function(){ return Tech.isCompleted('logistics'); }},
        {id:'blue',     text:'Investiga Cohetería para desbloquear el Silo',
            check:function(){ return Tech.isCompleted('rocketry'); }},
        {id:'rocket',   text:'¡Construye un Silo y lanza tu primer cohete!',
            check:function(){ return Game.stats.rocketsLaunched >= 1; }},
        {id:'expand',   text:'¡Imperio en marcha! Lanza más cohetes y usa Prestigio para mejoras permanentes',
            check:function(){ return false; }} // objetivo final abierto
    ],

    MILESTONES: [
        {id:'first_smelt',    name:'Primera Fundición',    check: function(s){ return (s.itemsProduced.iron_plate||0) >= 1; }},
        {id:'iron_100',       name:'Edad de Hierro',       check: function(s){ return (s.itemsProduced.iron_plate||0) >= 100; }},
        {id:'first_circuit',  name:'Electrificado',        check: function(s){ return (s.itemsProduced.green_circuit||0) >= 1; }},
        {id:'buildings_50',   name:'Industrialista',       check: function(s){ return (s.buildingsPlaced||0) >= 50; }},
        {id:'iron_1k',        name:'Imperio de Hierro',    check: function(s){ return (s.itemsProduced.iron_plate||0) >= 1000; }},
        {id:'first_research', name:'Científico',           check: function(s){ return (s.techsCompleted||0) >= 1; }},
        {id:'rocket_launch',  name:'¡A las Estrellas!',    check: function(s){ return (s.rocketsLaunched||0) >= 1; }}
    ]
};

var ITEM_NAMES = {
    iron_ore:'Mineral Hierro', copper_ore:'Mineral Cobre', coal:'Carbón', stone:'Piedra',
    iron_plate:'Placa Hierro', copper_plate:'Placa Cobre', steel:'Acero', stone_brick:'Ladrillo',
    iron_gear:'Engranaje', copper_wire:'Cable Cobre', green_circuit:'Circuito Verde',
    advanced_circuit:'Circuito Avanzado', red_science:'Ciencia Roja', green_science:'Ciencia Verde',
    blue_science:'Ciencia Azul', rocket_part:'Pieza Cohete',
    speed_module:'Módulo Velocidad', efficiency_module:'Módulo Eficiencia'
};
