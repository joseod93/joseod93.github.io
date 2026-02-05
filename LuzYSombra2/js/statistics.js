// Statistics Module - Dashboard de estadísticas y métricas
// Luz y Sombra: El Alba de Hispania

import { formatNumber } from './utils.js';

class StatisticsTracker {
    constructor() {
        this.stats = {
            // Recursos recolectados (totales históricos)
            totalResourcesGathered: {},

            // Acciones realizadas
            actionsPerformed: {
                explore: 0,
                craft: 0,
                build: 0,
                combat: 0,
                recruit: 0
            },

            // Tiempo de juego
            totalPlayTime: 0,
            sessionsCount: 0,
            currentSessionStart: Date.now(),

            // Combate
            bossesDefeated: 0,
            totalDamageDealt: 0,
            totalDamageTaken: 0,
            combatsWon: 0,
            combatsLost: 0,

            // Expediciones
            expeditionsCompleted: 0,
            regionsVisited: {},

            // Economía
            totalRenownEarned: 0,
            totalRenownSpent: 0,
            tradesCompleted: 0,

            // Aldea
            maxVillagers: 0,
            villagersRecruited: 0,
            villagersLost: 0,

            // Logros
            achievementsUnlocked: 0,

            // Eventos
            randomEventsTriggered: 0,

            // Récords
            records: {
                longestFireStreak: 0,
                mostResourcesInDay: 0,
                fastestBossDefeat: Infinity,
                highestRenown: 0
            },

            // Historia por sesión (últimas 10 sesiones)
            sessionHistory: []
        };

        this.loadStats();
    }

    loadStats() {
        try {
            const saved = localStorage.getItem('lys_statistics');
            if (saved) {
                const data = JSON.parse(saved);
                this.stats = { ...this.stats, ...data };
                this.stats.currentSessionStart = Date.now();
                this.stats.sessionsCount++;
            }
        } catch (e) {
            console.error('Error loading statistics:', e);
        }
    }

    saveStats() {
        try {
            // Actualizar tiempo de juego
            const sessionTime = Date.now() - this.stats.currentSessionStart;
            this.stats.totalPlayTime += sessionTime;
            this.stats.currentSessionStart = Date.now();

            localStorage.setItem('lys_statistics', JSON.stringify(this.stats));
        } catch (e) {
            console.error('Error saving statistics:', e);
        }
    }

    // Tracking de recursos
    trackResourceGathered(resource, amount) {
        if (!this.stats.totalResourcesGathered[resource]) {
            this.stats.totalResourcesGathered[resource] = 0;
        }
        this.stats.totalResourcesGathered[resource] += amount;
        this.saveStats();
    }

    // Tracking de acciones
    trackAction(action) {
        if (this.stats.actionsPerformed[action] !== undefined) {
            this.stats.actionsPerformed[action]++;
        }
        this.saveStats();
    }

    // Tracking de combate
    trackCombat(won, damageDealt, damageTaken, duration) {
        if (won) {
            this.stats.combatsWon++;
            this.stats.bossesDefeated++;

            if (duration < this.stats.records.fastestBossDefeat) {
                this.stats.records.fastestBossDefeat = duration;
            }
        } else {
            this.stats.combatsLost++;
        }

        this.stats.totalDamageDealt += damageDealt;
        this.stats.totalDamageTaken += damageTaken;
        this.saveStats();
    }

    // Tracking de expediciones
    trackExpedition(region) {
        this.stats.expeditionsCompleted++;

        if (!this.stats.regionsVisited[region]) {
            this.stats.regionsVisited[region] = 0;
        }
        this.stats.regionsVisited[region]++;
        this.saveStats();
    }

    // Tracking de renombre
    trackRenown(amount, spent = false) {
        if (spent) {
            this.stats.totalRenownSpent += amount;
        } else {
            this.stats.totalRenownEarned += amount;

            const current = this.stats.totalRenownEarned - this.stats.totalRenownSpent;
            if (current > this.stats.records.highestRenown) {
                this.stats.records.highestRenown = current;
            }
        }
        this.saveStats();
    }

    // Tracking de aldeanos
    trackVillager(recruited = true) {
        if (recruited) {
            this.stats.villagersRecruited++;
        } else {
            this.stats.villagersLost++;
        }
        this.saveStats();
    }

    updateMaxVillagers(current) {
        if (current > this.stats.maxVillagers) {
            this.stats.maxVillagers = current;
            this.saveStats();
        }
    }

    // Tracking de logros
    trackAchievement() {
        this.stats.achievementsUnlocked++;
        this.saveStats();
    }

    // Tracking de eventos
    trackRandomEvent() {
        this.stats.randomEventsTriggered++;
        this.saveStats();
    }

    // Obtener estadísticas formateadas
    getFormattedStats() {
        const playTimeHours = Math.floor(this.stats.totalPlayTime / (1000 * 60 * 60));
        const playTimeMinutes = Math.floor((this.stats.totalPlayTime % (1000 * 60 * 60)) / (1000 * 60));

        return {
            // Tiempo
            playTime: `${playTimeHours}h ${playTimeMinutes}m`,
            sessions: this.stats.sessionsCount,

            // Recursos
            totalResources: Object.entries(this.stats.totalResourcesGathered)
                .map(([k, v]) => ({ resource: k, amount: formatNumber(v) }))
                .sort((a, b) => b.amount - a.amount),

            // Acciones
            totalActions: Object.values(this.stats.actionsPerformed).reduce((a, b) => a + b, 0),
            actions: this.stats.actionsPerformed,

            // Combate
            combatWinRate: this.stats.combatsWon + this.stats.combatsLost > 0
                ? ((this.stats.combatsWon / (this.stats.combatsWon + this.stats.combatsLost)) * 100).toFixed(1) + '%'
                : '0%',
            bossesDefeated: this.stats.bossesDefeated,
            avgDamagePerCombat: this.stats.combatsWon > 0
                ? Math.floor(this.stats.totalDamageDealt / this.stats.combatsWon)
                : 0,

            // Expediciones
            expeditions: this.stats.expeditionsCompleted,
            regionsExplored: Object.keys(this.stats.regionsVisited).length,
            favoriteRegion: this.getFavoriteRegion(),

            // Economía
            renownEarned: formatNumber(this.stats.totalRenownEarned),
            renownSpent: formatNumber(this.stats.totalRenownSpent),
            netRenown: formatNumber(this.stats.totalRenownEarned - this.stats.totalRenownSpent),

            // Aldea
            maxVillagers: this.stats.maxVillagers,
            villagersRecruited: this.stats.villagersRecruited,

            // Logros
            achievements: this.stats.achievementsUnlocked,

            // Récords
            records: {
                longestFireStreak: this.stats.records.longestFireStreak + 'h',
                fastestBoss: this.stats.records.fastestBossDefeat !== Infinity
                    ? Math.floor(this.stats.records.fastestBossDefeat / 1000) + 's'
                    : 'N/A',
                highestRenown: formatNumber(this.stats.records.highestRenown)
            }
        };
    }

    getFavoriteRegion() {
        const regions = Object.entries(this.stats.regionsVisited);
        if (regions.length === 0) return 'Ninguna';

        regions.sort((a, b) => b[1] - a[1]);
        return regions[0][0];
    }

    // Finalizar sesión
    endSession(S) {
        const sessionData = {
            date: new Date().toISOString(),
            duration: Date.now() - this.stats.currentSessionStart,
            renownGained: S.stats.renown,
            bossesDefeated: this.stats.bossesDefeated,
            expeditions: this.stats.expeditionsCompleted
        };

        this.stats.sessionHistory.unshift(sessionData);

        // Mantener solo las últimas 10 sesiones
        if (this.stats.sessionHistory.length > 10) {
            this.stats.sessionHistory = this.stats.sessionHistory.slice(0, 10);
        }

        this.saveStats();
    }

    // Reset completo (para testing o prestige)
    reset() {
        this.stats = {
            totalResourcesGathered: {},
            actionsPerformed: { explore: 0, craft: 0, build: 0, combat: 0, recruit: 0 },
            totalPlayTime: 0,
            sessionsCount: 0,
            currentSessionStart: Date.now(),
            bossesDefeated: 0,
            totalDamageDealt: 0,
            totalDamageTaken: 0,
            combatsWon: 0,
            combatsLost: 0,
            expeditionsCompleted: 0,
            regionsVisited: {},
            totalRenownEarned: 0,
            totalRenownSpent: 0,
            tradesCompleted: 0,
            maxVillagers: 0,
            villagersRecruited: 0,
            villagersLost: 0,
            achievementsUnlocked: 0,
            randomEventsTriggered: 0,
            records: {
                longestFireStreak: 0,
                mostResourcesInDay: 0,
                fastestBossDefeat: Infinity,
                highestRenown: 0
            },
            sessionHistory: []
        };
        this.saveStats();
    }
}

// Instancia única
export const statistics = new StatisticsTracker();

export default statistics;
