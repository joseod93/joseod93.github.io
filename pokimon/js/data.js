window.Game = window.Game || {};

Game.Moves = {
    ember:         { id: 'ember',         name: 'Ascua',           type: 'fire',     power: 40,  accuracy: 100, category: 'special',  pp: 25 },
    flamethrower:  { id: 'flamethrower',  name: 'Lanzallamas',     type: 'fire',     power: 90,  accuracy: 100, category: 'special',  pp: 15 },
    fire_spin:     { id: 'fire_spin',     name: 'Giro Fuego',      type: 'fire',     power: 60,  accuracy: 85,  category: 'special',  pp: 20 },
    will_o_wisp:   { id: 'will_o_wisp',   name: 'Fuego Fatuo',     type: 'fire',     power: 0,   accuracy: 85,  category: 'status',   pp: 15, statusEffect: 'burn', statusChance: 1.0 },
    inferno:       { id: 'inferno',       name: 'Infierno',        type: 'fire',     power: 100, accuracy: 80,  category: 'special',  pp: 5 },
    water_gun:     { id: 'water_gun',     name: 'Pistola Agua',    type: 'water',    power: 40,  accuracy: 100, category: 'special',  pp: 25 },
    hydro_pump:    { id: 'hydro_pump',    name: 'Hidrobomba',      type: 'water',    power: 110, accuracy: 80,  category: 'special',  pp: 5 },
    bubble_beam:   { id: 'bubble_beam',   name: 'Rayo Burbuja',    type: 'water',    power: 65,  accuracy: 100, category: 'special',  pp: 20 },
    tsunami:       { id: 'tsunami',       name: 'Tsunami',         type: 'water',    power: 100, accuracy: 85,  category: 'special',  pp: 5 },
    vine_whip:     { id: 'vine_whip',     name: 'Latigo Cepa',     type: 'grass',    power: 45,  accuracy: 100, category: 'physical', pp: 25 },
    solar_beam:    { id: 'solar_beam',    name: 'Rayo Solar',      type: 'grass',    power: 120, accuracy: 70,  category: 'special',  pp: 5 },
    razor_leaf:    { id: 'razor_leaf',    name: 'Hoja Afilada',    type: 'grass',    power: 55,  accuracy: 95,  category: 'physical', pp: 20 },
    poison_sting:  { id: 'poison_sting',  name: 'Picotazo Ven.',   type: 'grass',    power: 30,  accuracy: 100, category: 'physical', pp: 25, statusEffect: 'poison', statusChance: 0.3 },
    jungle_fury:   { id: 'jungle_fury',   name: 'Furia Jungla',    type: 'grass',    power: 90,  accuracy: 90,  category: 'physical', pp: 10 },
    thunder_shock: { id: 'thunder_shock', name: 'Impactrueno',     type: 'electric', power: 40,  accuracy: 100, category: 'special',  pp: 25 },
    thunderbolt:   { id: 'thunderbolt',   name: 'Rayo',            type: 'electric', power: 90,  accuracy: 100, category: 'special',  pp: 15 },
    spark:         { id: 'spark',         name: 'Chispa',          type: 'electric', power: 65,  accuracy: 100, category: 'physical', pp: 20 },
    thunder_wave:  { id: 'thunder_wave',  name: 'Onda Trueno',     type: 'electric', power: 0,   accuracy: 90,  category: 'status',   pp: 20, statusEffect: 'paralysis', statusChance: 1.0 },
    thunder_storm: { id: 'thunder_storm', name: 'Tormenta',        type: 'electric', power: 100, accuracy: 80,  category: 'special',  pp: 5 },
    tackle:        { id: 'tackle',        name: 'Placaje',         type: 'normal',   power: 40,  accuracy: 100, category: 'physical', pp: 25 },
    headbutt:      { id: 'headbutt',      name: 'Cabezazo',        type: 'normal',   power: 70,  accuracy: 100, category: 'physical', pp: 20 },
    quick_attack:  { id: 'quick_attack',  name: 'Ataque Rapido',   type: 'normal',   power: 40,  accuracy: 100, category: 'physical', pp: 20, priority: true },
    mega_punch:    { id: 'mega_punch',    name: 'Megapuno',        type: 'normal',   power: 85,  accuracy: 85,  category: 'physical', pp: 15 },
    shadow_strike: { id: 'shadow_strike', name: 'Golpe Umbrio',    type: 'dark',     power: 60,  accuracy: 100, category: 'physical', pp: 25 },
    dark_pulse:    { id: 'dark_pulse',    name: 'Pulso Umbrio',    type: 'dark',     power: 80,  accuracy: 100, category: 'special',  pp: 15 },
    bite:          { id: 'bite',          name: 'Mordisco',        type: 'dark',     power: 60,  accuracy: 100, category: 'physical', pp: 25 },
    shadow_void:   { id: 'shadow_void',   name: 'Vacio Umbrio',    type: 'dark',     power: 95,  accuracy: 90,  category: 'special',  pp: 10 },
    slam:          { id: 'slam',          name: 'Portazo',         type: 'normal',   power: 80,  accuracy: 75,  category: 'physical', pp: 15 }
};

Game.Species = {
    flamander: {
        id: 'flamander', name: 'Flamander', type: 'fire',
        color: '#ff6633', accentColor: '#ff9944',
        baseStats: { hp: 45, attack: 60, defense: 35, spAttack: 65, spDefense: 40, speed: 55 },
        learnset: [
            { level: 1, moveId: 'tackle' },
            { level: 1, moveId: 'ember' },
            { level: 7, moveId: 'fire_spin' },
            { level: 10, moveId: 'will_o_wisp' },
            { level: 12, moveId: 'quick_attack' },
            { level: 18, moveId: 'flamethrower' }
        ],
        xpYield: 55,
        evolution: { to: 'infernox', level: 16 }
    },
    aquarion: {
        id: 'aquarion', name: 'Aquarion', type: 'water',
        color: '#3399ff', accentColor: '#66bbff',
        baseStats: { hp: 50, attack: 48, defense: 50, spAttack: 55, spDefense: 55, speed: 48 },
        learnset: [
            { level: 1, moveId: 'tackle' },
            { level: 1, moveId: 'water_gun' },
            { level: 7, moveId: 'bubble_beam' },
            { level: 12, moveId: 'headbutt' },
            { level: 18, moveId: 'hydro_pump' }
        ],
        xpYield: 55,
        evolution: { to: 'tidalore', level: 16 }
    },
    thornleaf: {
        id: 'thornleaf', name: 'Thornleaf', type: 'grass',
        color: '#44bb44', accentColor: '#66dd66',
        baseStats: { hp: 50, attack: 45, defense: 65, spAttack: 50, spDefense: 60, speed: 35 },
        learnset: [
            { level: 1, moveId: 'poison_sting' },
            { level: 1, moveId: 'vine_whip' },
            { level: 7, moveId: 'razor_leaf' },
            { level: 12, moveId: 'headbutt' },
            { level: 18, moveId: 'solar_beam' }
        ],
        xpYield: 55,
        evolution: { to: 'canopex', level: 16 }
    },
    zappix: {
        id: 'zappix', name: 'Zappix', type: 'electric',
        color: '#ffcc00', accentColor: '#ffee44',
        baseStats: { hp: 35, attack: 50, defense: 30, spAttack: 65, spDefense: 35, speed: 70 },
        learnset: [
            { level: 1, moveId: 'tackle' },
            { level: 1, moveId: 'thunder_shock' },
            { level: 7, moveId: 'spark' },
            { level: 10, moveId: 'thunder_wave' },
            { level: 12, moveId: 'quick_attack' },
            { level: 18, moveId: 'thunderbolt' }
        ],
        xpYield: 50,
        evolution: { to: 'voltarion', level: 16 }
    },
    brawlox: {
        id: 'brawlox', name: 'Brawlox', type: 'normal',
        color: '#aa9988', accentColor: '#ccbbaa',
        baseStats: { hp: 70, attack: 55, defense: 50, spAttack: 30, spDefense: 45, speed: 35 },
        learnset: [
            { level: 1, moveId: 'tackle' },
            { level: 1, moveId: 'headbutt' },
            { level: 7, moveId: 'bite' },
            { level: 12, moveId: 'slam' },
            { level: 18, moveId: 'quick_attack' }
        ],
        xpYield: 60,
        evolution: { to: 'titanox', level: 18 }
    },
    shadewisp: {
        id: 'shadewisp', name: 'Shadewisp', type: 'dark',
        color: '#774488', accentColor: '#9966aa',
        baseStats: { hp: 38, attack: 62, defense: 30, spAttack: 70, spDefense: 40, speed: 68 },
        learnset: [
            { level: 1, moveId: 'tackle' },
            { level: 1, moveId: 'shadow_strike' },
            { level: 7, moveId: 'bite' },
            { level: 12, moveId: 'quick_attack' },
            { level: 18, moveId: 'dark_pulse' }
        ],
        xpYield: 55,
        evolution: { to: 'phantara', level: 18 }
    },
    infernox: {
        id: 'infernox', name: 'Infernox', type: 'fire',
        color: '#cc2200', accentColor: '#ff6600',
        baseStats: { hp: 65, attack: 80, defense: 50, spAttack: 90, spDefense: 55, speed: 70 },
        learnset: [
            { level: 1, moveId: 'tackle' },
            { level: 1, moveId: 'ember' },
            { level: 7, moveId: 'fire_spin' },
            { level: 10, moveId: 'will_o_wisp' },
            { level: 12, moveId: 'quick_attack' },
            { level: 18, moveId: 'flamethrower' },
            { level: 22, moveId: 'inferno' }
        ],
        xpYield: 120
    },
    tidalore: {
        id: 'tidalore', name: 'Tidalore', type: 'water',
        color: '#1166aa', accentColor: '#44aaee',
        baseStats: { hp: 75, attack: 62, defense: 65, spAttack: 75, spDefense: 75, speed: 60 },
        learnset: [
            { level: 1, moveId: 'tackle' },
            { level: 1, moveId: 'water_gun' },
            { level: 7, moveId: 'bubble_beam' },
            { level: 12, moveId: 'headbutt' },
            { level: 18, moveId: 'hydro_pump' },
            { level: 22, moveId: 'tsunami' }
        ],
        xpYield: 120
    },
    canopex: {
        id: 'canopex', name: 'Canopex', type: 'grass',
        color: '#228822', accentColor: '#55cc55',
        baseStats: { hp: 70, attack: 65, defense: 85, spAttack: 70, spDefense: 80, speed: 45 },
        learnset: [
            { level: 1, moveId: 'poison_sting' },
            { level: 1, moveId: 'vine_whip' },
            { level: 7, moveId: 'razor_leaf' },
            { level: 12, moveId: 'headbutt' },
            { level: 18, moveId: 'solar_beam' },
            { level: 22, moveId: 'jungle_fury' }
        ],
        xpYield: 120
    },
    voltarion: {
        id: 'voltarion', name: 'Voltarion', type: 'electric',
        color: '#ddaa00', accentColor: '#ffdd22',
        baseStats: { hp: 50, attack: 65, defense: 45, spAttack: 90, spDefense: 50, speed: 95 },
        learnset: [
            { level: 1, moveId: 'tackle' },
            { level: 1, moveId: 'thunder_shock' },
            { level: 7, moveId: 'spark' },
            { level: 10, moveId: 'thunder_wave' },
            { level: 12, moveId: 'quick_attack' },
            { level: 18, moveId: 'thunderbolt' },
            { level: 22, moveId: 'thunder_storm' }
        ],
        xpYield: 110
    },
    titanox: {
        id: 'titanox', name: 'Titanox', type: 'normal',
        color: '#776655', accentColor: '#aa9977',
        baseStats: { hp: 100, attack: 80, defense: 70, spAttack: 40, spDefense: 60, speed: 45 },
        learnset: [
            { level: 1, moveId: 'tackle' },
            { level: 1, moveId: 'headbutt' },
            { level: 7, moveId: 'bite' },
            { level: 12, moveId: 'slam' },
            { level: 18, moveId: 'quick_attack' },
            { level: 22, moveId: 'mega_punch' }
        ],
        xpYield: 130
    },
    phantara: {
        id: 'phantara', name: 'Phantara', type: 'dark',
        color: '#553377', accentColor: '#8855bb',
        baseStats: { hp: 55, attack: 82, defense: 45, spAttack: 95, spDefense: 55, speed: 88 },
        learnset: [
            { level: 1, moveId: 'tackle' },
            { level: 1, moveId: 'shadow_strike' },
            { level: 7, moveId: 'bite' },
            { level: 12, moveId: 'quick_attack' },
            { level: 18, moveId: 'dark_pulse' },
            { level: 22, moveId: 'shadow_void' }
        ],
        xpYield: 120
    }
};

Game.NPCData = [
    {
        id: 'trainer1', x: 5, y: 3, direction: 'right', sight: 3,
        name: 'Chico Insecto', sprite: '#88cc44',
        team: [{ speciesId: 'thornleaf', level: 6 }],
        preText: 'Mis plantas son fuertes!',
        postText: 'Vaya, me superaste...',
        reward: 120
    },
    {
        id: 'trainer2', x: 16, y: 3, direction: 'left', sight: 3,
        name: 'Chica Fuego', sprite: '#ff6644',
        team: [{ speciesId: 'flamander', level: 7 }],
        preText: 'Te voy a quemar!',
        postText: 'Uuf, que calor...',
        reward: 140
    },
    {
        id: 'trainer3', x: 5, y: 15, direction: 'right', sight: 3,
        name: 'Nadador', sprite: '#4488ff',
        team: [{ speciesId: 'aquarion', level: 9 }, { speciesId: 'zappix', level: 8 }],
        preText: 'Preparate para la tormenta!',
        postText: 'Buen combate...',
        reward: 200
    },
    {
        id: 'trainer4', x: 16, y: 15, direction: 'left', sight: 3,
        name: 'Cazasombras', sprite: '#9966cc',
        team: [{ speciesId: 'shadewisp', level: 10 }, { speciesId: 'brawlox', level: 9 }],
        preText: 'Las sombras te envuelven!',
        postText: 'La oscuridad se retira...',
        reward: 250
    }
];

Game.EncounterZones = {
    zone1: { monsters: ['flamander', 'brawlox'], levelRange: [3, 5] },
    zone2: { monsters: ['aquarion', 'zappix'], levelRange: [4, 7] },
    zone3: { monsters: ['thornleaf', 'shadewisp'], levelRange: [5, 8] },
    zone4: { monsters: ['flamander', 'aquarion', 'thornleaf', 'zappix', 'brawlox', 'shadewisp'], levelRange: [7, 12] }
};

Game.MapData = {
    tiles: [
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,2,2,2,2,1,0,0,0,0,4,4,4,0,0,0,1,2,2,2,2,2,2,2,1],
        [1,2,2,2,2,1,0,0,0,0,4,1,4,0,0,0,1,2,2,2,2,2,2,2,1],
        [1,2,2,2,2,0,0,0,0,0,4,1,4,0,0,0,0,2,2,2,2,2,2,2,1],
        [1,2,2,2,2,0,0,0,0,0,4,1,4,0,0,0,0,2,2,2,2,2,2,2,1],
        [1,1,1,0,1,1,0,0,0,0,4,1,4,0,0,0,1,1,0,1,1,1,1,1,1],
        [1,4,4,4,4,4,4,4,4,4,4,1,4,4,4,4,4,4,4,4,4,4,4,4,1],
        [1,4,1,1,1,1,1,1,1,1,4,1,4,1,1,1,1,1,1,1,1,1,1,4,1],
        [1,4,1,0,0,0,0,0,0,0,4,4,4,0,0,0,0,0,0,0,0,0,1,4,1],
        [1,4,1,0,0,0,0,3,0,5,0,0,0,0,0,0,0,0,0,0,0,0,1,4,1],
        [1,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,4,1],
        [1,4,1,1,1,1,1,1,1,1,4,4,4,1,1,1,1,1,1,1,1,1,1,4,1],
        [1,4,4,4,4,4,4,4,4,4,4,1,4,4,4,4,4,4,4,4,4,4,4,4,1],
        [1,1,1,0,1,1,0,0,0,0,4,1,4,0,0,0,1,1,0,1,1,1,1,1,1],
        [1,2,2,2,2,0,0,0,0,0,4,1,4,0,0,0,0,2,2,2,2,2,2,2,1],
        [1,2,2,2,2,0,0,0,0,0,4,1,4,0,0,0,0,2,2,2,2,2,2,2,1],
        [1,2,2,2,2,1,0,0,0,0,4,1,4,0,0,0,1,2,2,2,2,2,2,2,1],
        [1,2,2,2,2,1,0,0,0,0,4,4,4,0,0,0,1,2,2,2,2,2,2,2,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    encounterMap: [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,2,2,0],
        [0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,2,2,0],
        [0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,2,2,0],
        [0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,2,2,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,4,4,4,0],
        [0,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,4,4,4,0],
        [0,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,4,4,4,0],
        [0,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,4,4,4,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ],
    playerStart: { x: 12, y: 9 },
    healPoint: { x: 7, y: 9 }
};
