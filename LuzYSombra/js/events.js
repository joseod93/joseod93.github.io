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
