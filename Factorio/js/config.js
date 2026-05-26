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
            blue_science:'#3366dd', rocket_part:'#ddddff'
        },
        buildings: {
            miner:      {bg:'#336699', fg:'#4488cc', label:'MI'},
            electric_miner:{bg:'#3377aa', fg:'#55aadd', label:'EM'},
            belt:       {bg:'#aa8833', fg:'#ccaa44', label:''},
            fast_belt:  {bg:'#bb9933', fg:'#ddcc55', label:''},
            furnace:    {bg:'#993311', fg:'#cc4422', label:'FU'},
            assembler:  {bg:'#338855', fg:'#44aa66', label:'AS'},
            storage:    {bg:'#666655', fg:'#888877', label:'ST'},
            steam_engine:{bg:'#555566', fg:'#777788', label:'SE'},
            solar_panel:{bg:'#4477aa', fg:'#66aadd', label:'SO'},
            lab:        {bg:'#774488', fg:'#9966bb', label:'LA'},
            splitter:   {bg:'#887733', fg:'#bbaa44', label:'SP'},
            inserter:   {bg:'#888844', fg:'#aaaa66', label:'IN'},
            rocket_silo:{bg:'#556677', fg:'#99aabb', label:'RS'}
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
            miningSpeed:0.03, powerDraw:60, fuelBurner:false,
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
            cost:[{item:'iron_plate',qty:5},{item:'iron_gear',qty:3},{item:'green_circuit',qty:2}],
            craftSpeed:1, powerDraw:50, fuelBurner:false,
            outputSlots:1, inputSlots:4, unlocked:false, tech:'automation'
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
            researchSpeed:1, powerDraw:30, unlocked:true,
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
        }
    },

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
        {id:'belt',            inputs:[{item:'iron_plate',qty:1}],                                    output:'belt_item',       qty:1, time:15},
        {id:'inserter_craft',  inputs:[{item:'iron_plate',qty:1},{item:'iron_gear',qty:1}],           output:'inserter_item',   qty:1, time:20}
    ],

    TECH_TREE: {
        automation:           {name:'Automatización',       cost:{red_science:10},                              prereqs:[], unlocks:['ensamblador']},
        logistics:            {name:'Logística',            cost:{red_science:20},                              prereqs:['automation'], unlocks:['Divisor','Cinta Rápida']},
        electric_mining:      {name:'Minería Eléctrica',    cost:{red_science:30, green_science:15},            prereqs:['automation'], unlocks:['Minero Eléctrico']},
        advanced_electronics: {name:'Electrónica Avanzada', cost:{red_science:40, green_science:40},            prereqs:['automation'], unlocks:['circuito avanzado']},
        solar_energy:         {name:'Energía Solar',        cost:{red_science:50, green_science:30},            prereqs:['electric_mining'], unlocks:['panel solar']},
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

    MILESTONES: [
        {id:'first_smelt',    name:'Primera Fundición',    check: s => s.itemsProduced.iron_plate >= 1},
        {id:'iron_100',       name:'Edad de Hierro',       check: s => s.itemsProduced.iron_plate >= 100},
        {id:'first_circuit',  name:'Electrificado',        check: s => s.itemsProduced.green_circuit >= 1},
        {id:'buildings_50',   name:'Industrialista',       check: s => s.buildingsPlaced >= 50},
        {id:'iron_1k',        name:'Imperio de Hierro',    check: s => s.itemsProduced.iron_plate >= 1000},
        {id:'first_research', name:'Científico',           check: s => s.techsCompleted >= 1},
        {id:'rocket_launch',  name:'¡A las Estrellas!',    check: s => s.rocketsLaunched >= 1}
    ]
};

var ITEM_NAMES = {
    iron_ore:'Mineral Hierro', copper_ore:'Mineral Cobre', coal:'Carbón', stone:'Piedra',
    iron_plate:'Placa Hierro', copper_plate:'Placa Cobre', steel:'Acero', stone_brick:'Ladrillo',
    iron_gear:'Engranaje', copper_wire:'Cable Cobre', green_circuit:'Circuito Verde',
    advanced_circuit:'Circuito Avanzado', red_science:'Ciencia Roja', green_science:'Ciencia Verde',
    blue_science:'Ciencia Azul', rocket_part:'Pieza Cohete'
};
