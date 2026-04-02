// Notifications Module - Sistema de notificaciones
// Luz y Sombra: El Alba de Hispania

import { $ } from './utils.js';

class NotificationSystem {
    constructor() {
        this.permission = 'default';
        this.enabled = false;
        this.queue = [];
        this.init();
    }

    async init() {
        // Verificar soporte
        if (!('Notification' in window)) {
            console.log('Notifications not supported');
            return;
        }

        // Cargar preferencias
        const saved = localStorage.getItem('lys_notifications');
        if (saved === 'enabled') {
            await this.requestPermission();
        }
    }

    async requestPermission() {
        if (!('Notification' in window)) return false;

        try {
            this.permission = await Notification.requestPermission();
            this.enabled = this.permission === 'granted';
            localStorage.setItem('lys_notifications', this.enabled ? 'enabled' : 'disabled');
            return this.enabled;
        } catch (e) {
            console.error('Notification permission error:', e);
            return false;
        }
    }

    async show(title, options = {}) {
        if (!this.enabled) {
            this.showInApp(title, options.body, options.type || options.tag || 'default');
            return;
        }

        try {
            const notification = new Notification(title, {
                icon: 'icon-192.svg',
                badge: 'icon-192.svg',
                ...options
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
                if (options.onClick) options.onClick();
            };

            return notification;
        } catch (e) {
            console.error('Notification error:', e);
            this.showInApp(title, options.body, options.type || options.tag || 'default');
        }
    }

    showInApp(title, message, type = 'default') {
        const container = $('#notification-container') || this.createContainer();
        const icons = {
            achievement: '🏅', boss: '⚔️', resource: '📦',
            expedition: '🧭', trader: '🪵', starving: '⚠️', default: '📣'
        };
        const icon = icons[type] || icons.default;

        const notif = document.createElement('div');
        notif.className = `in-app-notification type-${type}`;
        notif.innerHTML = `
            <div class="notif-header">
                <strong><span class="notif-icon">${icon}</span>${title}</strong>
                <button class="notif-close">×</button>
            </div>
            ${message ? `<div class="notif-body">${message}</div>` : ''}
        `;

        container.appendChild(notif);

        // Auto-remove después de 5 segundos
        setTimeout(() => {
            notif.classList.add('fade-out');
            setTimeout(() => notif.remove(), 300);
        }, 5000);

        // Close button
        notif.querySelector('.notif-close').addEventListener('click', () => {
            notif.classList.add('fade-out');
            setTimeout(() => notif.remove(), 300);
        });
    }

    createContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
        return container;
    }

    // Notificaciones específicas del juego
    expeditionComplete(region) {
        this.show('¡Expedición Completada!', {
            body: `Tu expedición a ${region} ha regresado. ¡Reclama tus recompensas!`,
            tag: 'expedition', type: 'expedition',
            onClick: () => {
                // Scroll to actions
                $('#actions')?.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    bossSpawned(bossName, region) {
        this.show('¡Amenaza Detectada!', {
            body: `${bossName} ha aparecido cerca de ${region}. ¡Prepárate para el combate!`,
            tag: 'boss', type: 'boss',
            requireInteraction: true
        });
    }

    resourceLow(resource) {
        this.show('Recursos Bajos', {
            body: `Te estás quedando sin ${resource}. Considera recolectar más.`,
            tag: 'resource-low', type: 'resource'
        });
    }

    achievementUnlocked(name) {
        this.show('🏅 ¡Logro Desbloqueado!', {
            body: name,
            tag: 'achievement', type: 'achievement'
        });
    }

    traderArrived() {
        this.show('Mercader Ambulante', {
            body: 'Un mercader ha llegado a tu aldea. ¡Visítalo antes de que se vaya!',
            tag: 'trader', type: 'trader'
        });
    }

    villagerStarving() {
        this.show('⚠️ Hambruna', {
            body: 'Tus aldeanos se están muriendo de hambre. ¡Consigue comida urgentemente!',
            tag: 'starving', type: 'starving',
            requireInteraction: true
        });
    }

    toggle() {
        if (this.enabled) {
            this.enabled = false;
            localStorage.setItem('lys_notifications', 'disabled');
        } else {
            this.requestPermission();
        }
        return this.enabled;
    }
}

// Instancia única
export const notifications = new NotificationSystem();

export default notifications;
