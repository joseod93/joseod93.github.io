// Quests Module - Sistema de misiones y objetivos
// Luz y Sombra: El Alba de Hispania

import { randomChoice, randomRange } from './utils.js';
import { notifications } from './notifications.js';

// Tipos de misiones
const QUEST_TYPES = {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    STORY: 'story'
};

// Definición de misiones
const QUEST_TEMPLATES = {
    // Misiones diarias
    daily_gather_wood: {
        id: 'daily_gather_wood',
        type: QUEST_TYPES.DAILY,
        name: 'Leñador del Día',
        description: 'Recolecta {amount} leña',
        icon: '🪵',
        target: { resource: 'lenia', amount: 20 },
        reward: { renown: 2, medicina: 1 },
        generateAmount: () => randomRange(15, 25)
    },
    daily_explore: {
        id: 'daily_explore',
        type: QUEST_TYPES.DAILY,
        name: 'Explorador Diario',
        description: 'Explora {amount} veces',
        icon: '🧭',
        target: { action: 'explore', amount: 5 },
        reward: { renown: 3, piedra: 5 },
        generateAmount: () => randomRange(3, 7)
    },
    daily_craft: {
        id: 'daily_craft',
        type: QUEST_TYPES.DAILY,
        name: 'Artesano Dedicado',
        description: 'Fabrica {amount} objetos',
        icon: '🔨',
        target: { action: 'craft', amount: 3 },
        reward: { renown: 2, antorchas: 2 },
        generateAmount: () => randomRange(2, 5)
    },
    daily_fire: {
        id: 'daily_fire',
        type: QUEST_TYPES.DAILY,
        name: 'Guardián del Fuego',
        description: 'Mantén la fogata encendida durante {amount} horas',
        icon: '🔥',
        target: { condition: 'fire_hours', amount: 2 },
        reward: { renown: 3, lenia: 10 },
        generateAmount: () => randomRange(1, 3)
    },

    // Misiones semanales
    weekly_boss: {
        id: 'weekly_boss',
        type: QUEST_TYPES.WEEKLY,
        name: 'Cazador de Leyendas',
        description: 'Derrota {amount} bosses',
        icon: '⚔️',
        target: { action: 'defeat_boss', amount: 3 },
        reward: { renown: 15, medicina: 5, antorchas: 5 },
        generateAmount: () => randomRange(2, 4)
    },
    weekly_expedition: {
        id: 'weekly_expedition',
        type: QUEST_TYPES.WEEKLY,
        name: 'Viajero Incansable',
        description: 'Completa {amount} expediciones',
        icon: '🗺️',
        target: { action: 'complete_expedition', amount: 5 },
        reward: { renown: 12, sal: 10 },
        generateAmount: () => randomRange(4, 6)
    },
    weekly_villagers: {
        id: 'weekly_villagers',
        type: QUEST_TYPES.WEEKLY,
        name: 'Constructor de Comunidad',
        description: 'Recluta {amount} aldeanos',
        icon: '👥',
        target: { action: 'recruit_villager', amount: 5 },
        reward: { renown: 10, trigo: 20 },
        generateAmount: () => randomRange(3, 7)
    },

    // Misiones de historia
    story_first_boss: {
        id: 'story_first_boss',
        type: QUEST_TYPES.STORY,
        name: 'Primera Batalla',
        description: 'Derrota tu primer boss',
        icon: '🛡️',
        target: { action: 'defeat_boss', amount: 1 },
        reward: { renown: 10, medicina: 3 },
        oneTime: true
    },
    story_build_all: {
        id: 'story_build_all',
        type: QUEST_TYPES.STORY,
        name: 'Maestro Constructor',
        description: 'Construye todas las estructuras',
        icon: '🏗️',
        target: { condition: 'all_buildings', amount: 1 },
        reward: { renown: 25, hierro: 10 },
        oneTime: true
    },
    story_50_renown: {
        id: 'story_50_renown',
        type: QUEST_TYPES.STORY,
        name: 'Héroe Local',
        description: 'Alcanza 50 de renombre',
        icon: '⭐',
        target: { condition: 'renown', amount: 50 },
        reward: { medicina: 10, antorchas: 10 },
        oneTime: true
    }
};

class QuestSystem {
    constructor() {
        this.activeQuests = [];
        this.completedQuests = [];
        this.lastDailyReset = 0;
        this.lastWeeklyReset = 0;
        this.progress = {};

        this.loadProgress();
    }

    loadProgress() {
        try {
            const saved = localStorage.getItem('lys_quests');
            if (saved) {
                const data = JSON.parse(saved);
                this.activeQuests = data.activeQuests || [];
                this.completedQuests = data.completedQuests || [];
                this.lastDailyReset = data.lastDailyReset || 0;
                this.lastWeeklyReset = data.lastWeeklyReset || 0;
                this.progress = data.progress || {};
            }
        } catch (e) {
            console.error('Error loading quests:', e);
        }
    }

    saveProgress() {
        try {
            localStorage.setItem('lys_quests', JSON.stringify({
                activeQuests: this.activeQuests,
                completedQuests: this.completedQuests,
                lastDailyReset: this.lastDailyReset,
                lastWeeklyReset: this.lastWeeklyReset,
                progress: this.progress
            }));
        } catch (e) {
            console.error('Error saving quests:', e);
        }
    }

    checkResets() {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const weekMs = 7 * dayMs;

        // Reset diario
        if (now - this.lastDailyReset >= dayMs) {
            this.resetDailyQuests();
            this.lastDailyReset = now;
        }

        // Reset semanal
        if (now - this.lastWeeklyReset >= weekMs) {
            this.resetWeeklyQuests();
            this.lastWeeklyReset = now;
        }

        this.saveProgress();
    }

    resetDailyQuests() {
        // Remover misiones diarias activas
        this.activeQuests = this.activeQuests.filter(q => q.type !== QUEST_TYPES.DAILY);

        // Generar nuevas misiones diarias (2-3 aleatorias)
        const dailyTemplates = Object.values(QUEST_TEMPLATES).filter(t => t.type === QUEST_TYPES.DAILY);
        const count = randomRange(2, 3);

        for (let i = 0; i < count; i++) {
            const template = randomChoice(dailyTemplates);
            if (!this.activeQuests.find(q => q.id === template.id)) {
                this.addQuest(template);
            }
        }
    }

    resetWeeklyQuests() {
        // Remover misiones semanales activas
        this.activeQuests = this.activeQuests.filter(q => q.type !== QUEST_TYPES.WEEKLY);

        // Generar nuevas misiones semanales (1-2 aleatorias)
        const weeklyTemplates = Object.values(QUEST_TEMPLATES).filter(t => t.type === QUEST_TYPES.WEEKLY);
        const count = randomRange(1, 2);

        for (let i = 0; i < count; i++) {
            const template = randomChoice(weeklyTemplates);
            if (!this.activeQuests.find(q => q.id === template.id)) {
                this.addQuest(template);
            }
        }
    }

    addQuest(template) {
        const amount = template.generateAmount ? template.generateAmount() : template.target.amount;

        const quest = {
            id: template.id + '_' + Date.now(),
            templateId: template.id,
            type: template.type,
            name: template.name,
            description: template.description.replace('{amount}', amount),
            icon: template.icon,
            target: { ...template.target, amount },
            reward: template.reward,
            progress: 0,
            completed: false,
            createdAt: Date.now()
        };

        this.activeQuests.push(quest);
        this.progress[quest.id] = 0;
        this.saveProgress();

        return quest;
    }

    updateProgress(action, amount = 1) {
        let anyCompleted = false;

        for (const quest of this.activeQuests) {
            if (quest.completed) continue;

            // Verificar si la acción coincide con el objetivo
            if (quest.target.action === action || quest.target.resource === action) {
                this.progress[quest.id] = (this.progress[quest.id] || 0) + amount;
                quest.progress = this.progress[quest.id];

                // Verificar si se completó
                if (quest.progress >= quest.target.amount) {
                    this.completeQuest(quest);
                    anyCompleted = true;
                }
            }
        }

        if (anyCompleted) {
            this.saveProgress();
        }

        return anyCompleted;
    }

    checkCondition(condition, S) {
        for (const quest of this.activeQuests) {
            if (quest.completed) continue;

            if (quest.target.condition === condition) {
                let met = false;

                switch (condition) {
                    case 'fire_hours':
                        met = S.fire.lit && S.fire.heat >= quest.target.amount;
                        break;
                    case 'all_buildings':
                        met = S.unlocked.molino && S.unlocked.acequia && S.unlocked.forge;
                        break;
                    case 'renown':
                        met = S.stats.renown >= quest.target.amount;
                        break;
                }

                if (met && !quest.completed) {
                    quest.progress = quest.target.amount;
                    this.completeQuest(quest);
                    this.saveProgress();
                    return true;
                }
            }
        }

        return false;
    }

    completeQuest(quest) {
        quest.completed = true;
        quest.completedAt = Date.now();

        // Mover a completadas
        this.completedQuests.push(quest);

        // Notificación
        notifications.show('🎯 Misión Completada', {
            body: `${quest.name} - Recompensa lista para reclamar`,
            tag: 'quest-complete'
        });

        return quest.reward;
    }

    getActiveQuests() {
        // Retornar todas las misiones activas (incluyendo las completadas pero no reclamadas)
        return this.activeQuests;
    }

    claimQuest(questId) {
        const index = this.activeQuests.findIndex(q => q.id === questId);
        if (index !== -1) {
            const quest = this.activeQuests[index];
            if (quest.completed) {
                // Remover de activas ya que ha sido reclamada
                this.activeQuests.splice(index, 1);
                this.saveProgress();
                return true;
            }
        }
        return false;
    }

    getQuestProgress(questId) {
        const quest = this.activeQuests.find(q => q.id === questId);
        if (!quest) return null;

        return {
            current: quest.progress,
            target: quest.target.amount,
            percentage: Math.min((quest.progress / quest.target.amount) * 100, 100)
        };
    }

    initialize() {
        this.checkResets();

        // Si no hay misiones activas, generar algunas
        if (this.activeQuests.length === 0) {
            this.resetDailyQuests();
            this.resetWeeklyQuests();
        }
    }
}

// Instancia única
export const quests = new QuestSystem();

export default quests;
