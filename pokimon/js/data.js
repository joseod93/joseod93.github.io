window.Game = window.Game || {};

Game.Moves = {
    ember:         { id: 'ember',         name: 'Ascua',           type: 'fire',     power: 40,  accuracy: 100, category: 'special' },
    flamethrower:  { id: 'flamethrower',  name: 'Lanzallamas',     type: 'fire',     power: 90,  accuracy: 100, category: 'special' },
    fire_spin:     { id: 'fire_spin',     name: 'Giro Fuego',      type: 'fire',     power: 60,  accuracy: 85,  category: 'special' },
    water_gun:     { id: 'water_gun',     name: 'Pistola Agua',    type: 'water',    power: 40,  accuracy: 100, category: 'special' },
    hydro_pump:    { id: 'hydro_pump',    name: 'Hidrobomba',      type: 'water',    power: 110, accuracy: 80,  category: 'special' },
    bubble_beam:   { id: 'bubble_beam',   name: 'Rayo Burbuja',    type: 'water',    power: 65,  accuracy: 100, category: 'special' },
    vine_whip:     { id: 'vine_whip',     name: 'Latigo Cepa',     type: 'grass',    power: 45,  accuracy: 100, category: 'physical' },
    solar_beam:    { id: 'solar_beam',    name: 'Rayo Solar',      type: 'grass',    power: 120, accuracy: 70,  category: 'special' },
    razor_leaf:    { id: 'razor_leaf',    name: 'Hoja Afilada',    type: 'grass',    power: 55,  accuracy: 95,  category: 'physical' },
    thunder_shock: { id: 'thunder_shock', name: 'Impactrueno',     type: 'electric', power: 40,  accuracy: 100, category: 'special' },
    thunderbolt:   { id: 'thunderbolt',   name: 'Rayo',            type: 'electric', power: 90,  accuracy: 100, category: 'special' },
    spark:         { id: 'spark',         name: 'Chispa',          type: 'electric', power: 65,  accuracy: 100, category: 'physical' },
    tackle:        { id: 'tackle',        name: 'Placaje',         type: 'normal',   power: 40,  accuracy: 100, category: 'physical' },
    headbutt:      { id: 'headbutt',      name: 'Cabezazo',        type: 'normal',   power: 70,  accuracy: 100, category: 'physical' },
    quick_attack:  { id: 'quick_attack',  name: 'Ataque Rapido',   type: 'normal',   power: 40,  accuracy: 100, category: 'physical', priority: true },
    shadow_strike: { id: 'shadow_strike', name: 'Golpe Umbrio',    type: 'dark',     power: 60,  accuracy: 100, category: 'physical' },
    dark_pulse:    { id: 'dark_pulse',    name: 'Pulso Umbrio',    type: 'dark',     power: 80,  accuracy: 100, category: 'special' },
    bite:          { id: 'bite',          name: 'Mordisco',        type: 'dark',     power: 60,  accuracy: 100, category: 'physical' },
    slam:          { id: 'slam',          name: 'Portazo',         type: 'normal',   power: 80,  accuracy: 75,  category: 'physical' }
};

Game.Species = {
    flamander: {
        id: 'flamander', name: 'Flamander', type: 'fire',
        color: '#ff6633', accentColor: '#ff9944',
        baseStats: { hp: 45, attack: 60, defense: 35, speed: 55 },
        learnset: [
            { level: 1, moveId: 'tackle' },
            { level: 1, moveId: 'ember' },
            { level: 7, moveId: 'fire_spin' },
            { level: 12, moveId: 'quick_attack' },
            { level: 18, moveId: 'flamethrower' }
        ],
        xpYield: 55
    },
    aquarion: {
        id: 'aquarion', name: 'Aquarion', type: 'water',
        color: '#3399ff', accentColor: '#66bbff',
        baseStats: { hp: 50, attack: 48, defense: 50, speed: 48 },
        learnset: [
            { level: 1, moveId: 'tackle' },
            { level: 1, moveId: 'water_gun' },
            { level: 7, moveId: 'bubble_beam' },
            { level: 12, moveId: 'headbutt' },
            { level: 18, moveId: 'hydro_pump' }
        ],
        xpYield: 55
    },
    thornleaf: {
        id: 'thornleaf', name: 'Thornleaf', type: 'grass',
        color: '#44bb44', accentColor: '#66dd66',
        baseStats: { hp: 50, attack: 45, defense: 65, speed: 35 },
        learnset: [
            { level: 1, moveId: 'tackle' },
            { level: 1, moveId: 'vine_whip' },
            { level: 7, moveId: 'razor_leaf' },
            { level: 12, moveId: 'headbutt' },
            { level: 18, moveId: 'solar_beam' }
        ],
        xpYield: 55
    },
    zappix: {
        id: 'zappix', name: 'Zappix', type: 'electric',
        color: '#ffcc00', accentColor: '#ffee44',
        baseStats: { hp: 35, attack: 50, defense: 30, speed: 70 },
        learnset: [
            { level: 1, moveId: 'tackle' },
            { level: 1, moveId: 'thunder_shock' },
            { level: 7, moveId: 'spark' },
            { level: 12, moveId: 'quick_attack' },
            { level: 18, moveId: 'thunderbolt' }
        ],
        xpYield: 50
    },
    brawlox: {
        id: 'brawlox', name: 'Brawlox', type: 'normal',
        color: '#aa9988', accentColor: '#ccbbaa',
        baseStats: { hp: 70, attack: 55, defense: 50, speed: 35 },
        learnset: [
            { level: 1, moveId: 'tackle' },
            { level: 1, moveId: 'headbutt' },
            { level: 7, moveId: 'bite' },
            { level: 12, moveId: 'slam' },
            { level: 18, moveId: 'quick_attack' }
        ],
        xpYield: 60
    },
    shadewisp: {
        id: 'shadewisp', name: 'Shadewisp', type: 'dark',
        color: '#774488', accentColor: '#9966aa',
        baseStats: { hp: 38, attack: 62, defense: 30, speed: 68 },
        learnset: [
            { level: 1, moveId: 'tackle' },
            { level: 1, moveId: 'shadow_strike' },
            { level: 7, moveId: 'bite' },
            { level: 12, moveId: 'quick_attack' },
            { level: 18, moveId: 'dark_pulse' }
        ],
        xpYield: 55
    }
};

Game.EncounterZones = {
    zone1: {
        monsters: ['flamander', 'brawlox'],
        levelRange: [3, 5]
    },
    zone2: {
        monsters: ['aquarion', 'zappix'],
        levelRange: [4, 7]
    },
    zone3: {
        monsters: ['thornleaf', 'shadewisp'],
        levelRange: [5, 8]
    },
    zone4: {
        monsters: ['flamander', 'aquarion', 'thornleaf', 'zappix', 'brawlox', 'shadewisp'],
        levelRange: [7, 12]
    }
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
        [1,4,1,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,4,1],
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
