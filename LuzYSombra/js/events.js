// Events Module - Sistema de eventos aleatorios y especiales
// Luz y Sombra: El Alba de Hispania

import { randomChoice, chance, randomRange } from './utils.js';

// Eventos aleatorios generales
export const RANDOM_EVENTS = [
    {
        id: 'trader_visit',
        weight: 0.05,
        condition: (S) => S.time.day >= 3 && !S.trader && !S.threat,
        execute: (S) => {
            const wants = Math.random() < 0.5 ? 'lenia' : 'trigo';
            S.trader = {
                endsAt: Date.now() + 60000,
                wants: wants,
                gives: 'renown',
                rate: 20
            };
            return { message: 'Un mercader ambulante ha acampado cerca.', type: 'good' };
        }
    },
    {
        id: 'wanderer_help',
        weight: 0.1,
        condition: (S) => S.stats.renown >= 3,
        execute: (S) => {
            S.stats.renown += randomRange(1, 3);
            return { message: 'Ayudas a un viajero perdido. Se corre la voz de tu bondad.', type: 'good' };
        }
    },
    {
        id: 'hidden_cache',
        weight: 0.08,
        condition: (S) => S.stats.explore >= 5,
        execute: (S) => {
            const resources = ['piedra', 'hierro', 'sal', 'hierbas'];
            const resource = randomChoice(resources);
            const amount = randomRange(2, 4);
            S.resources[resource] = (S.resources[resource] || 0) + amount;
            return { message: `Descubres un escondite con ${amount} ${resource}.`, type: 'good' };
        }
    },
    {
        id: 'storm_damage',
        weight: 0.06,
        condition: (S) => S.weather === 'rain' && S.fire.lit,
        execute: (S) => {
            S.fire.fuel = Math.max(0, S.fire.fuel - 2);
            return { message: 'Una tormenta daña tu fogata. Pierdes combustible.', type: 'warn' };
        }
    },
    {
        id: 'bountiful_harvest',
        weight: 0.07,
        condition: (S) => S.people.jobs.farmer > 0 && S.weather === 'rain',
        execute: (S) => {
            const bonus = randomRange(3, 6);
            S.resources.trigo = (S.resources.trigo || 0) + bonus;
            return { message: `La lluvia bendice tus cultivos. +${bonus} trigo.`, type: 'good' };
        }
    },
    {
        id: 'ancient_ruins',
        weight: 0.04,
        condition: (S) => S.stats.explore >= 10,
        execute: (S) => {
            S.stats.renown += 5;
            S.resources.piedra = (S.resources.piedra || 0) + 10;
            return { message: 'Descubres ruinas antiguas. Ganas renombre y piedra.', type: 'good' };
        }
    },
    {
        id: 'wild_animals',
        weight: 0.05,
        condition: (S) => S.time.day >= 2,
        execute: (S) => {
            const damage = randomRange(5, 15);
            S.player.hp = Math.max(0, S.player.hp - damage);
            return { message: `Animales salvajes te atacan. -${damage} HP.`, type: 'bad' };
        }
    },
    {
        id: 'mysterious_gift',
        weight: 0.03,
        condition: (S) => S.stats.renown >= 10,
        execute: (S) => {
            S.resources.medicina = (S.resources.medicina || 0) + 2;
            S.resources.antorchas = (S.resources.antorchas || 0) + 3;
            return { message: 'Encuentras un regalo misterioso: medicina y antorchas.', type: 'good' };
        }
    },
    {
        id: 'inspiring_sunset',
        weight: 0.06,
        condition: (S) => S.time.minutes >= 1080 && S.time.minutes <= 1140,
        execute: (S) => {
            S.stats.renown += 1;
            return { message: 'Un atardecer inspirador eleva tu espíritu. +1 Renombre.', type: 'dim' };
        }
    },
    {
        id: 'skilled_craftsman',
        weight: 0.04,
        condition: (S) => S.unlocked.crafting && S.people.villagers > 0,
        execute: (S) => {
            S.resources.antorchas = (S.resources.antorchas || 0) + 2;
            return { message: 'Un aldeano hábil fabrica antorchas extra.', type: 'good' };
        }
    },
    {
        id: 'drought',
        weight: 0.04,
        condition: (S) => S.time.day >= 5 && S.weather === 'clear',
        execute: (S) => {
            S.resources.agua = Math.max(0, (S.resources.agua || 0) - 2);
            return { message: 'El sol implacable seca tus reservas de agua. -2 agua.', type: 'bad' };
        }
    },
    {
        id: 'merchant_caravan',
        weight: 0.03,
        condition: (S) => S.stats.renown >= 15,
        execute: (S) => {
            const resources = ['trigo', 'piedra', 'hierro', 'sal', 'hierbas', 'lenia'];
            const resource = randomChoice(resources);
            const amount = randomRange(3, 5);
            S.resources[resource] = (S.resources[resource] || 0) + amount;
            S.stats.renown += 2;
            return { message: `Una caravana de tierras lejanas te ofrece ${amount} ${resource}. +2 Renombre.`, type: 'good' };
        }
    },
    {
        id: 'allied_village',
        weight: 0.03,
        condition: (S) => S.people.villagers >= 3,
        execute: (S) => {
            const trigo = randomRange(2, 4);
            const medicina = randomRange(1, 2);
            S.resources.trigo = (S.resources.trigo || 0) + trigo;
            S.resources.medicina = (S.resources.medicina || 0) + medicina;
            return { message: `Una aldea vecina propone una alianza. +${trigo} trigo, +${medicina} medicina.`, type: 'good' };
        }
    },
    {
        id: 'mine_discovery',
        weight: 0.04,
        condition: (S) => S.unlocked.forge,
        execute: (S) => {
            const hierro = randomRange(3, 5);
            const piedra = randomRange(2, 3);
            S.resources.hierro = (S.resources.hierro || 0) + hierro;
            S.resources.piedra = (S.resources.piedra || 0) + piedra;
            return { message: `Descubren una veta en las minas profundas. +${hierro} hierro, +${piedra} piedra.`, type: 'good' };
        }
    },
    {
        id: 'plague',
        weight: 0.03,
        condition: (S) => S.people.villagers >= 5,
        execute: (S) => {
            const damage = randomRange(10, 20);
            const hierbas = randomRange(1, 3);
            S.player.hp = Math.max(0, S.player.hp - damage);
            S.resources.hierbas = Math.max(0, (S.resources.hierbas || 0) - hierbas);
            return { message: `Una plaga se extiende por el asentamiento. -${damage} HP, -${hierbas} hierbas.`, type: 'bad' };
        }
    },
    {
        id: 'traveling_bard',
        weight: 0.05,
        condition: (S) => S.time.day >= 4,
        execute: (S) => {
            const renown = randomRange(2, 4);
            S.stats.renown += renown;
            return { message: `Un bardo errante canta tus hazañas por los caminos. +${renown} Renombre.`, type: 'good' };
        }
    },
    {
        id: 'olive_harvest_festival',
        weight: 0.04,
        condition: (S) => (S.resources.aceitunas || 0) >= 10,
        execute: (S) => {
            const aceitunas = randomRange(5, 8);
            S.resources.aceitunas = (S.resources.aceitunas || 0) + aceitunas;
            S.stats.renown += 2;
            return { message: `¡Festival de la cosecha de aceitunas! +${aceitunas} aceitunas, +2 Renombre.`, type: 'good' };
        }
    },
    {
        id: 'iron_vein',
        weight: 0.03,
        condition: (S) => S.unlocked.forge && S.stats.explore >= 15,
        execute: (S) => {
            const hierro = randomRange(4, 6);
            S.resources.hierro = (S.resources.hierro || 0) + hierro;
            return { message: `Descubres una rica veta de hierro en las montañas. +${hierro} hierro.`, type: 'good' };
        }
    },
    {
        id: 'flood',
        weight: 0.03,
        condition: (S) => S.weather === 'rain' && S.time.day >= 3,
        execute: (S) => {
            const lenia = randomRange(3, 5);
            S.resources.lenia = Math.max(0, (S.resources.lenia || 0) - lenia);
            return { message: `Una inundación daña tus suministros. -${lenia} leña.`, type: 'bad' };
        }
    },
    {
        id: 'hermit_wisdom',
        weight: 0.04,
        condition: (S) => S.stats.explore >= 20,
        execute: (S) => {
            S.resources.medicina = (S.resources.medicina || 0) + 3;
            S.player.xp = (S.player.xp || 0) + 15;
            return { message: 'Un ermitaño te enseña remedios ancestrales. +3 medicina, +15 XP.', type: 'good' };
        }
    }
];

// Eventos por región
export const REGION_EVENTS = {
    'Sevilla': [
        { message: 'El aroma del azahar llena el aire.', effect: (S) => S.stats.renown += 1 },
        { message: 'Cruzas el Guadalquivir en barca.', effect: (S) => S.resources.agua += 2 },
        { message: 'Encuentras cerámica de Triana.', effect: (S) => S.resources.piedra += 3 }
    ],
    'Granada': [
        { message: 'La Alhambra brilla bajo la luna.', effect: (S) => S.stats.renown += 2 },
        { message: 'Agua fresca de Sierra Nevada.', effect: (S) => S.resources.agua += 3 },
        { message: 'Hierbas medicinales de las Alpujarras.', effect: (S) => S.resources.hierbas += 2 }
    ],
    'Cádiz': [
        { message: 'El viento del mar trae sal.', effect: (S) => S.resources.sal += 4 },
        { message: 'Pescadores comparten su captura.', effect: (S) => S.resources.trigo += 2 },
        { message: 'Las olas cantan historias antiguas.', effect: (S) => S.stats.renown += 1 }
    ],
    'Jaén': [
        { message: 'Mar de olivos hasta el horizonte.', effect: (S) => S.resources.aceitunas += 5 },
        { message: 'Aceite de oliva de calidad suprema.', effect: (S) => S.resources.aceitunas += 3 },
        { message: 'Aprende técnicas de poda.', effect: (S) => S.stats.renown += 1 }
    ],
    'Valencia': [
        { message: 'Los campos de naranjos perfuman el aire.', effect: (S) => { S.resources.trigo += 3; S.stats.renown += 1; } },
        { message: 'Mercaderes de seda ofrecen sus tejidos.', effect: (S) => S.stats.renown += 2 },
        { message: 'La huerta valenciana da frutos abundantes.', effect: (S) => S.resources.trigo += 4 }
    ],
    'Barcelona': [
        { message: 'El puerto bulle de comercio mediterráneo.', effect: (S) => { S.resources.sal += 3; S.stats.renown += 2; } },
        { message: 'Artesanos catalanes comparten su oficio.', effect: (S) => S.resources.hierro += 3 },
        { message: 'Las murallas romanas inspiran respeto.', effect: (S) => { S.resources.piedra += 4; S.stats.renown += 1; } }
    ],
    'Zaragoza': [
        { message: 'El Ebro riega las tierras fértiles.', effect: (S) => S.resources.agua += 3 },
        { message: 'Forjas aragonesas producen buen acero.', effect: (S) => S.resources.hierro += 4 },
        { message: 'Los muros de alabastro brillan al sol.', effect: (S) => { S.resources.piedra += 3; S.stats.renown += 1; } }
    ],
    'Bilbao': [
        { message: 'Minerales vascos enriquecen tu forja.', effect: (S) => { S.resources.hierro += 5; S.resources.piedra += 2; } },
        { message: 'Pescadores del Cantábrico comparten provisiones.', effect: (S) => { S.resources.trigo += 2; S.resources.sal += 3; } },
        { message: 'La niebla del norte oculta caminos secretos.', effect: (S) => S.stats.renown += 2 }
    ],
    'Santiago': [
        { message: 'Peregrinos comparten sus provisiones.', effect: (S) => { S.resources.trigo += 3; S.resources.medicina += 2; } },
        { message: 'La catedral inspira devoción y renombre.', effect: (S) => S.stats.renown += 3 },
        { message: 'Hierbas gallegas de gran poder curativo.', effect: (S) => S.resources.hierbas += 4 }
    ],
    'Lisboa': [
        { message: 'Navegantes portugueses traen especias exóticas.', effect: (S) => { S.resources.sal += 4; S.stats.renown += 2; } },
        { message: 'El comercio atlántico florece.', effect: (S) => { S.resources.trigo += 3; S.resources.hierro += 2; } },
        { message: 'Los astilleros ofrecen madera sobrante.', effect: (S) => S.resources.lenia += 5 }
    ],
    'Roma': [
        { message: 'Las ruinas del Foro revelan tesoros ocultos.', effect: (S) => { S.resources.piedra += 5; S.stats.renown += 3; } },
        { message: 'Legionarios veteranos comparten tácticas.', effect: (S) => { S.resources.hierro += 3; S.stats.renown += 2; } },
        { message: 'Médicos romanos enseñan artes curativas.', effect: (S) => S.resources.medicina += 4 }
    ],
    'Constantinopla': [
        { message: 'El Gran Bazar ofrece riquezas sin fin.', effect: (S) => { S.resources.sal += 3; S.resources.hierro += 3; S.stats.renown += 2; } },
        { message: 'Sabios bizantinos comparten conocimiento ancestral.', effect: (S) => { S.resources.medicina += 3; S.stats.renown += 3; } },
        { message: 'Las murallas de Teodosio impresionan al viajero.', effect: (S) => { S.resources.piedra += 6; S.stats.renown += 1; } }
    ]
};

// Eventos de clima
export const WEATHER_EVENTS = {
    'rain': [
        { message: 'La lluvia refresca la tierra.', effect: (S) => { /* Bonus farming */ } },
        { message: 'Recoges agua de lluvia.', effect: (S) => S.resources.agua += 1 }
    ],
    'wind': [
        { message: 'El viento dispersa las nubes.', effect: (S) => { /* Change weather */ } },
        { message: 'El viento aviva la fogata.', effect: (S) => S.fire.heat += 1 }
    ],
    'clear': [
        { message: 'Un día perfecto para explorar.', effect: (S) => { /* Exploration bonus */ } },
        { message: 'El sol calienta la tierra.', effect: (S) => S.fire.heat += 0.5 }
    ]
};

// Ejecutar evento aleatorio
export function triggerRandomEvent(S, log) {
    // Filtrar eventos que cumplen condiciones
    const validEvents = RANDOM_EVENTS.filter(e => e.condition(S));

    // Calcular probabilidades
    const totalWeight = validEvents.reduce((sum, e) => sum + e.weight, 0);

    if (totalWeight === 0 || !chance(0.15)) return; // 15% chance base

    // Seleccionar evento basado en peso
    let random = Math.random() * totalWeight;
    for (const event of validEvents) {
        random -= event.weight;
        if (random <= 0) {
            const result = event.execute(S);
            if (log && result) {
                log(result.message, result.type || 'dim');
            }
            return result;
        }
    }
}

// Ejecutar evento de región
export function triggerRegionEvent(region, S, log) {
    const events = REGION_EVENTS[region];
    if (!events || !chance(0.3)) return; // 30% chance

    const event = randomChoice(events);
    event.effect(S);
    if (log) {
        log(`${region}: ${event.message}`, 'dim');
    }
    return event;
}

// Cambiar clima
export function updateWeather(S, log) {
    if (!chance(0.002)) return; // Muy raro

    const weathers = ['clear', 'clear', 'clear', 'rain', 'wind'];
    const next = randomChoice(weathers);

    if (next !== S.weather) {
        S.weather = next;
        const messages = {
            clear: 'El cielo se despeja.',
            rain: 'Empieza a llover.',
            wind: 'Se levanta un fuerte viento.'
        };
        if (log) {
            log(messages[next], 'dim');
        }
    }
}

export default {
    RANDOM_EVENTS,
    REGION_EVENTS,
    WEATHER_EVENTS,
    triggerRandomEvent,
    triggerRegionEvent,
    updateWeather
};
