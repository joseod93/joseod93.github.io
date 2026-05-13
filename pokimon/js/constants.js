window.Game = window.Game || {};

Game.Constants = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 608,
    TILE_SIZE: 32,
    MAP_COLS: 25,
    MAP_ROWS: 19,
    MAX_TEAM_SIZE: 6,
    ENCOUNTER_RATE: 0.15,
    CRIT_RATE: 0.0625,
    CRIT_MULTIPLIER: 1.5,
    STAB_MULTIPLIER: 1.5,
    XP_BASE: 50,
    LEVEL_SCALE: 1.2,
    MOVE_SPEED: 6,

    TYPES: ['fire', 'water', 'grass', 'electric', 'normal', 'dark'],

    TYPE_CHART: {
        fire:     { grass: 2.0, water: 0.5, fire: 0.5 },
        water:    { fire: 2.0, grass: 0.5, water: 0.5 },
        grass:    { water: 2.0, fire: 0.5, grass: 0.5 },
        electric: { water: 2.0, grass: 0.5 },
        normal:   {},
        dark:     { normal: 1.5 }
    },

    TYPE_COLORS: {
        fire:     '#ff6633',
        water:    '#3399ff',
        grass:    '#44bb44',
        electric: '#ffcc00',
        normal:   '#aaaaaa',
        dark:     '#774488'
    },

    TILE_GROUND: 0,
    TILE_WALL: 1,
    TILE_GRASS: 2,
    TILE_HEAL: 3,
    TILE_PATH: 4,
    TILE_SHOP: 5,

    TILE_COLORS: {
        0: '#88cc44',
        1: '#336622',
        2: '#44aa22',
        3: '#ff6688',
        4: '#ccbb88',
        5: '#dd9944'
    }
};
