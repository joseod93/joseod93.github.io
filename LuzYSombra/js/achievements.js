// Achievements Module - Sistema de logros mejorado
// Luz y Sombra: El Alba de Hispania

import { notifications } from './notifications.js';

// Definición de logros
export const ACHIEVEMENTS = {
    // Logros básicos
    luzEterna: {
        id: 'luzEterna',
        name: 'Primer Rayo de Sol',
        description: 'Mantén la fogata encendida durante 24 horas de juego',
        icon: '🔥',
        condition: (S) => S.fire.lit && S.fire.heat >= 24,
        hidden: false,
        reward: { renown: 2 }
    },

    // Logros de recolección
    ach_aceitunero: {
        id: 'ach_aceitunero',
        name: 'Maestro Aceitunero',
        description: 'Recolecta 100 aceitunas',
        icon: '🫒',
        condition: (S) => S.resources.aceitunas >= 100,
        hidden: false,
        reward: { renown: 3 }
    },

    ach_leniador: {
        id: 'ach_leniador',
        name: 'Leñador Experto',
        description: 'Recolecta 200 leña',
        icon: '🪵',
        condition: (S) => S.resources.lenia >= 200,
        hidden: false,
        reward: { renown: 3 }
    },

    ach_minero: {
        id: 'ach_minero',
        name: 'Minero Maestro',
        description: 'Recolecta 100 piedra',
        icon: '🪨',
        condition: (S) => S.resources.piedra >= 100,
        hidden: false,
        reward: { renown: 3 }
    },

    // Logros de construcción
    ach_acequia: {
        id: 'ach_acequia',
        name: 'Arquitecto del Agua',
        description: 'Construye una acequia',
        icon: '🚰',
        condition: (S) => S.unlocked.acequia,
        hidden: false,
        reward: { renown: 5 }
    },

    ach_herrero: {
        id: 'ach_herrero',
        name: 'Herrero Mayor',
        description: 'Construye una fragua',
        icon: '⚒️',
        condition: (S) => S.unlocked.forge,
        hidden: false,
        reward: { renown: 5 }
    },

    ach_constructor: {
        id: 'ach_constructor',
        name: 'Gran Constructor',
        description: 'Construye todas las estructuras',
        icon: '🏗️',
        condition: (S) => S.unlocked.molino && S.unlocked.acequia && S.unlocked.forge,
        hidden: false,
        reward: { renown: 10 }
    },

    // Logros de exploración
    ach_explorador: {
        id: 'ach_explorador',
        name: 'Explorador Incansable',
        description: 'Explora 50 veces',
        icon: '🧭',
        condition: (S) => S.stats.explore >= 50,
        hidden: false,
        reward: { renown: 5 }
    },

    ach_andalucia: {
        id: 'ach_andalucia',
        name: 'Conocedor de Andalucía',
        description: 'Completa 10 expediciones',
        icon: '🗺️',
        condition: (S) => (S.stats.expeditionsCompleted || 0) >= 10,
        hidden: false,
        reward: { renown: 8 }
    },

    // Logros de combate
    ach_guerrero: {
        id: 'ach_guerrero',
        name: 'Guerrero Valiente',
        description: 'Derrota 5 bosses',
        icon: '⚔️',
        condition: (S) => S.stats.bossesDefeated >= 5,
        hidden: false,
        reward: { renown: 10 }
    },

    ach_leyenda: {
        id: 'ach_leyenda',
        name: 'Leyenda de Hispania',
        description: 'Derrota 20 bosses',
        icon: '👑',
        condition: (S) => S.stats.bossesDefeated >= 20,
        hidden: false,
        reward: { renown: 25 }
    },

    // Logros de aldea
    ach_alcalde: {
        id: 'ach_alcalde',
        name: 'Alcalde Respetado',
        description: 'Recluta 10 aldeanos',
        icon: '👥',
        condition: (S) => S.people.villagers >= 10,
        hidden: false,
        reward: { renown: 8 }
    },

    ach_metropolis: {
        id: 'ach_metropolis',
        name: 'Metrópolis Andaluza',
        description: 'Recluta 25 aldeanos',
        icon: '🏙️',
        condition: (S) => S.people.villagers >= 25,
        hidden: false,
        reward: { renown: 15 }
    },

    // Logros de renombre
    ach_famoso: {
        id: 'ach_famoso',
        name: 'Famoso en la Región',
        description: 'Alcanza 50 de renombre',
        icon: '⭐',
        condition: (S) => S.stats.renown >= 50,
        hidden: false,
        reward: { medicina: 5 }
    },

    ach_legendario: {
        id: 'ach_legendario',
        name: 'Legendario',
        description: 'Alcanza 100 de renombre',
        icon: '🌟',
        condition: (S) => S.stats.renown >= 100,
        hidden: false,
        reward: { medicina: 10, antorchas: 10 }
    },

    // Logros ocultos
    ach_superviviente: {
        id: 'ach_superviviente',
        name: 'Superviviente',
        description: 'Sobrevive 30 días',
        icon: '💪',
        condition: (S) => S.time.day >= 30,
        hidden: true,
        reward: { renown: 10 }
    },

    ach_nocturno: {
        id: 'ach_nocturno',
        name: 'Búho Nocturno',
        description: 'Juega durante la medianoche',
        icon: '🦉',
        condition: (S) => {
            const hour = new Date().getHours();
            return hour >= 0 && hour < 4;
        },
        hidden: true,
        reward: { antorchas: 5 }
    },

    ach_rico: {
        id: 'ach_rico',
        name: 'Acumulador',
        description: 'Ten 1000 de cualquier recurso',
        icon: '💰',
        condition: (S) => {
            return Object.values(S.resources).some(v => v >= 1000);
        },
        hidden: true,
        reward: { renown: 15 }
    },

    // Metas a largo plazo
    ach_cazador: {
        id: 'ach_cazador', name: 'Cazador', description: 'Derrota 25 enemigos', icon: '🗡️',
        condition: (S) => (S.enemiesDefeated || 0) >= 25, hidden: false, reward: { renown: 8 }
    },
    ach_exterminador: {
        id: 'ach_exterminador', name: 'Exterminador', description: 'Derrota 100 enemigos', icon: '☠️',
        condition: (S) => (S.enemiesDefeated || 0) >= 100, hidden: false, reward: { renown: 20 }
    },
    ach_oleadas10: {
        id: 'ach_oleadas10', name: 'Rompeolas', description: 'Supera la oleada 10', icon: '🌊',
        condition: (S) => (S.waveMode?.wave || 0) >= 10, hidden: false, reward: { renown: 12 }
    },
    ach_oleadas25: {
        id: 'ach_oleadas25', name: 'Muro Inquebrantable', description: 'Supera la oleada 25', icon: '🛡️',
        condition: (S) => (S.waveMode?.wave || 0) >= 25, hidden: true, reward: { renown: 30 }
    },
    ach_viajero25: {
        id: 'ach_viajero25', name: 'Trotamundos', description: 'Completa 25 expediciones', icon: '🗺️',
        condition: (S) => (S.stats.expeditionsCompleted || 0) >= 25, hidden: false, reward: { renown: 12 }
    },
    ach_viajero50: {
        id: 'ach_viajero50', name: 'Explorador Legendario', description: 'Completa 50 expediciones', icon: '🧭',
        condition: (S) => (S.stats.expeditionsCompleted || 0) >= 50, hidden: true, reward: { renown: 25 }
    },
    ach_veterano: {
        id: 'ach_veterano', name: 'Veterano', description: 'Sobrevive 7 días', icon: '📅',
        condition: (S) => (S.time.day || 1) >= 7, hidden: false, reward: { renown: 6 }
    },
    ach_anciano: {
        id: 'ach_anciano', name: 'Anciano Sabio', description: 'Sobrevive 60 días', icon: '🧙',
        condition: (S) => (S.time.day || 1) >= 60, hidden: true, reward: { renown: 40 }
    },
    ach_acaparador: {
        id: 'ach_acaparador', name: 'Gran Acaparador', description: 'Ten 5000 de un recurso', icon: '🏆',
        condition: (S) => Object.values(S.resources).some(v => v >= 5000), hidden: true, reward: { renown: 30 }
    },
    ach_arsenal: {
        id: 'ach_arsenal', name: 'Arsenal Completo', description: 'Forja espada, armadura y escudo', icon: '⚒️',
        condition: (S) => (S.equipment?.espada || 0) >= 1 && (S.equipment?.armadura || 0) >= 1 && (S.equipment?.escudo || 0) >= 1,
        hidden: false, reward: { renown: 15 }
    }
};

// Verificar logros
export function checkAchievements(S, log) {
    let unlocked = [];

    for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
        // Skip si ya está desbloqueado
        if (S.achievements[key]) continue;

        // Verificar condición
        if (achievement.condition(S)) {
            S.achievements[key] = true;
            unlocked.push(achievement);

            // Aplicar recompensa
            if (achievement.reward) {
                for (const [resource, amount] of Object.entries(achievement.reward)) {
                    if (resource === 'renown') {
                        S.stats.renown += amount;
                    } else {
                        S.resources[resource] = (S.resources[resource] || 0) + amount;
                    }
                }
            }

            // Log y notificación
            if (log) {
                log(`🏅 Logro desbloqueado: ${achievement.name}`, 'warn');
            }

            import('./statistics.js').then(m => m.default.trackAchievement());
            notifications.achievementUnlocked(achievement.name);
        }
    }

    return unlocked;
}

// Obtener progreso de logros
export function getAchievementProgress(achievementId, S) {
    const achievement = ACHIEVEMENTS[achievementId];
    if (!achievement) return null;

    // Esto es una aproximación simple, se puede mejorar
    // con condiciones más específicas por logro
    if (S.achievements[achievementId]) {
        return { completed: true, progress: 100 };
    }

    // Calcular progreso basado en el tipo de logro
    let progress = 0;

    if (achievementId === 'ach_aceitunero') {
        progress = Math.min((S.resources.aceitunas / 100) * 100, 100);
    } else if (achievementId === 'ach_leniador') {
        progress = Math.min((S.resources.lenia / 200) * 100, 100);
    } else if (achievementId === 'ach_minero') {
        progress = Math.min((S.resources.piedra / 100) * 100, 100);
    } else if (achievementId === 'ach_explorador') {
        progress = Math.min((S.stats.explore / 50) * 100, 100);
    } else if (achievementId === 'ach_guerrero') {
        progress = Math.min((S.stats.bossesDefeated / 5) * 100, 100);
    } else if (achievementId === 'ach_leyenda') {
        progress = Math.min((S.stats.bossesDefeated / 20) * 100, 100);
    } else if (achievementId === 'ach_alcalde') {
        progress = Math.min((S.people.villagers / 10) * 100, 100);
    } else if (achievementId === 'ach_metropolis') {
        progress = Math.min((S.people.villagers / 25) * 100, 100);
    } else if (achievementId === 'ach_famoso') {
        progress = Math.min((S.stats.renown / 50) * 100, 100);
    } else if (achievementId === 'ach_legendario') {
        progress = Math.min((S.stats.renown / 100) * 100, 100);
    } else if (achievementId === 'ach_superviviente') {
        progress = Math.min((S.time.day / 30) * 100, 100);
    }

    return { completed: false, progress: Math.floor(progress) };
}

// Obtener logros por categoría
export function getAchievementsByCategory() {
    return {
        basic: ['luzEterna'],
        collection: ['ach_aceitunero', 'ach_leniador', 'ach_minero'],
        building: ['ach_acequia', 'ach_herrero', 'ach_constructor'],
        exploration: ['ach_explorador', 'ach_andalucia'],
        combat: ['ach_guerrero', 'ach_leyenda'],
        village: ['ach_alcalde', 'ach_metropolis'],
        renown: ['ach_famoso', 'ach_legendario'],
        hidden: ['ach_superviviente', 'ach_nocturno', 'ach_rico']
    };
}

export default {
    ACHIEVEMENTS,
    checkAchievements,
    getAchievementProgress,
    getAchievementsByCategory
};
