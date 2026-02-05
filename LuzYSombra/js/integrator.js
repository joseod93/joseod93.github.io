// Integrator Module - Conecta todos los nuevos módulos con el sistema existente
// Luz y Sombra: El Alba de Hispania

import { checkAchievements } from './achievements.js';
import { triggerRandomEvent, updateWeather } from './events.js';
import { quests } from './quests.js';
import { statistics } from './statistics.js';
import { tutorial } from './tutorial.js';
import { notifications } from './notifications.js';

/**
 * Inicializa todos los sistemas nuevos
 * Llamar al inicio del juego
 */
export function initializeSystems(S) {
    console.log('[Integrator] Initializing new systems...');

    // Inicializar misiones
    quests.initialize();
    quests.checkResets();

    // Verificar logros iniciales
    checkAchievements(S, (msg, type) => {
        console.log(`[Achievement] ${msg}`);
    });

    // Tutorial no se inicia automáticamente aquí para evitar solapamiento con overlay
    // Se iniciará desde game.js al pulsar Comenzar

    console.log('[Integrator] Systems initialized');
}

/**
 * Hook para cuando se recolecta un recurso
 * Llamar después de añadir recursos
 */
export function onResourceGathered(S, resource, amount, log) {
    // Track estadísticas
    statistics.trackResourceGathered(resource, amount);

    // Actualizar progreso de misiones
    quests.updateProgress(resource, amount);

    // Verificar logros
    const unlocked = checkAchievements(S, log);
    if (unlocked && unlocked.length > 0) {
        unlocked.forEach(ach => {
            if (ach.reward && ach.reward.renown) {
                onRenownGained(S, ach.reward.renown, log);
            }
        });
    }

    // Verificar si recursos están bajos
    if (S.resources[resource] < 5 && Math.random() < 0.1) {
        notifications.resourceLow(resource);
    }
}

/**
 * Hook para cuando se realiza una acción
 * Llamar después de acciones como explorar, craftear, etc.
 */
export function onActionPerformed(S, action, log) {
    // Track estadísticas
    statistics.trackAction(action);

    // Actualizar progreso de misiones
    quests.updateProgress(action, 1);

    // Verificar logros
    const unlocked = checkAchievements(S, log);
    if (unlocked && unlocked.length > 0) {
        unlocked.forEach(ach => {
            if (ach.reward && ach.reward.renown) {
                onRenownGained(S, ach.reward.renown, log);
            }
        });
    }
}

/**
 * Hook para cuando se completa una expedición
 * Llamar cuando regresa una expedición
 */
export function onExpeditionCompleted(S, region, log) {
    // Track estadísticas
    statistics.trackExpedition(region);

    // Actualizar progreso de misiones
    quests.updateProgress('complete_expedition', 1);

    // Verificar logros
    const unlocked = checkAchievements(S, log);
    if (unlocked && unlocked.length > 0) {
        unlocked.forEach(ach => {
            if (ach.reward && ach.reward.renown) {
                onRenownGained(S, ach.reward.renown, log);
            }
        });
    }

    // Notificación
    notifications.expeditionComplete(region);
}

/**
 * Hook para cuando se derrota un boss
 * Llamar después de ganar combate
 */
export function onBossDefeated(S, bossName, damageDealt, damageTaken, duration, log) {
    // Track estadísticas
    statistics.trackCombat(true, damageDealt, damageTaken, duration);

    // Actualizar progreso de misiones
    quests.updateProgress('defeat_boss', 1);

    // Verificar logros
    const unlocked = checkAchievements(S, log);
    if (unlocked && unlocked.length > 0) {
        unlocked.forEach(ach => {
            if (ach.reward && ach.reward.renown) {
                onRenownGained(S, ach.reward.renown, log);
            }
        });
    }

    // Track logro
    statistics.trackAchievement();
}

/**
 * Hook para cuando se recluta un aldeano
 * Llamar después de reclutar
 */
export function onVillagerRecruited(S, log) {
    // Track estadísticas
    statistics.trackVillager(true);
    statistics.updateMaxVillagers(S.people.villagers);

    // Actualizar progreso de misiones
    quests.updateProgress('recruit_villager', 1);

    // Verificar logros
    const unlocked = checkAchievements(S, log);
    if (unlocked && unlocked.length > 0) {
        unlocked.forEach(ach => {
            if (ach.reward && ach.reward.renown) {
                onRenownGained(S, ach.reward.renown, log);
            }
        });
    }
}

/**
 * Hook para cuando se gana renombre
 * Llamar después de ganar renombre
 */
export function onRenownGained(S, amount, log) {
    // Track estadísticas
    statistics.trackRenown(amount, false);

    // Verificar condiciones de misiones
    quests.checkCondition('renown', S);

    // Verificar logros
    const unlocked = checkAchievements(S, log);
    if (unlocked && unlocked.length > 0) {
        unlocked.forEach(ach => {
            if (ach.reward && ach.reward.renown) {
                statistics.trackRenown(ach.reward.renown, false); // Evitar bucle infinito si es posible
                // onRenownGained(S, ach.reward.renown, log); // PELIGRO: Bucle infinito si un logro de renombre da renombre
            }
        });
    }
}

/**
 * Hook para el game tick
 * Llamar en cada tick del juego (cada segundo o similar)
 */
export function onGameTick(S, log) {
    // Eventos aleatorios (5% de probabilidad cada tick)
    if (Math.random() < 0.05) {
        const event = triggerRandomEvent(S, log);
        if (event) {
            statistics.trackRandomEvent();
        }
    }

    // Actualizar clima (1% de probabilidad)
    if (Math.random() < 0.01) {
        updateWeather(S, log);
    }

    // Verificar condiciones de misiones
    quests.checkCondition('fire_hours', S);
    quests.checkCondition('all_buildings', S);

    // Verificar logros periódicamente
    if (Math.random() < 0.1) {
        const unlocked = checkAchievements(S, log);
        if (unlocked && unlocked.length > 0) {
            unlocked.forEach(ach => {
                if (ach.reward && ach.reward.renown) {
                    onRenownGained(S, ach.reward.renown, log);
                }
            });
        }
    }
}

/**
 * Hook para cuando se construye algo
 * Llamar después de construir
 */
export function onBuildingConstructed(S, building, log) {
    // Track acción
    statistics.trackAction('build');

    // Verificar condiciones de misiones
    quests.checkCondition('all_buildings', S);

    // Verificar logros
    const unlocked = checkAchievements(S, log);
    if (unlocked && unlocked.length > 0) {
        unlocked.forEach(ach => {
            if (ach.reward && ach.reward.renown) {
                onRenownGained(S, ach.reward.renown, log);
            }
        });
    }
}

/**
 * Hook para cuando se craftea algo
 * Llamar después de craftear
 */
export function onItemCrafted(S, item, amount, log) {
    // Track acción
    statistics.trackAction('craft');

    // Actualizar progreso de misiones
    quests.updateProgress('craft', amount);

    // Verificar logros
    const unlocked = checkAchievements(S, log);
    if (unlocked && unlocked.length > 0) {
        unlocked.forEach(ach => {
            if (ach.reward && ach.reward.renown) {
                onRenownGained(S, ach.reward.renown, log);
            }
        });
    }
}

/**
 * Hook para cuando aparece un boss
 * Llamar cuando se genera una amenaza
 */
export function onBossSpawned(S, bossName, region) {
    // Notificación
    notifications.bossSpawned(bossName, region);
}

/**
 * Hook para cuando llega un mercader
 * Llamar cuando aparece el trader
 */
export function onTraderArrived(S) {
    notifications.traderArrived();
}

/**
 * Obtener misiones activas para mostrar en UI
 */
export function getActiveQuests() {
    return quests.getActiveQuests();
}

/**
 * Obtener estadísticas formateadas para mostrar en UI
 */
export function getStatistics() {
    return statistics.getFormattedStats();
}

/**
 * Reclamar recompensas de una misión completada
 */
export function claimQuestReward(S, questId, log) {
    const quest = quests.activeQuests.find(q => q.id === questId);
    if (!quest || !quest.completed) return;

    // Aplicar recompensas
    if (quest.reward) {
        for (const [resource, amount] of Object.entries(quest.reward)) {
            if (resource === 'renown') {
                S.stats.renown += amount;
                onRenownGained(S, amount, log);
            } else {
                S.resources[resource] = (S.resources[resource] || 0) + amount;
                onResourceGathered(S, resource, amount, log);
            }
        }

        // Marcar como reclamada y remover de activas
        quests.claimQuest(questId);

        if (log) {
            log(`Recompensas reclamadas: ${JSON.stringify(quest.reward)}`, 'good');
        }
    }
}

/**
 * Finalizar sesión (llamar antes de cerrar/reload)
 */
export function endSession(S) {
    statistics.endSession(S);
    quests.saveProgress();
}

// Export default con todas las funciones
export default {
    initializeSystems,
    onResourceGathered,
    onActionPerformed,
    onExpeditionCompleted,
    onBossDefeated,
    onVillagerRecruited,
    onRenownGained,
    onGameTick,
    onBuildingConstructed,
    onItemCrafted,
    onBossSpawned,
    onTraderArrived,
    getActiveQuests,
    getStatistics,
    claimQuestReward,
    endSession
};
