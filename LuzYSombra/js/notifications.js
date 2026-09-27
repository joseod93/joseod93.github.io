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

    // App Android: el WebView no tiene la API Notification; el puente nativo (LysAndroid)
    // programa recordatorios locales al salir de la app (ver scheduleReminders en game.js)
    get native() {
        return !!(window.LysAndroid && window.LysAndroid.requestNotifications);
    }

    async init() {
        if (this.native) {
            this.enabled = localStorage.getItem('lys_notifications') === 'enabled' && window.LysAndroid.notificationsEnabled();
            return;
        }
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
        if (this.native) {
            // El resultado del diálogo de permiso llega como evento desde MainActivity
            const granted = window.LysAndroid.notificationsEnabled() || await new Promise(resolve => {
                window.addEventListener('lys-android-notif', e => resolve(!!e.detail), { once: true });
                window.LysAndroid.requestNotifications();
            });
            this.enabled = granted;
            localStorage.setItem('lys_notifications', granted ? 'enabled' : 'disabled');
            return granted;
        }
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
        if (!this.enabled || this.native) {   // con la app abierta, el aviso va dentro del juego
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
        const dismiss = (n) => {
            if (n._gone) return;
            n._gone = true;
            clearTimeout(n._timer);
            n.classList.add('fade-out');
            setTimeout(() => n.remove(), 300);
        };
        const arm = (n) => { clearTimeout(n._timer); n._timer = setTimeout(() => dismiss(n), 5000); };

        // Mismo aviso ya visible: agrupar con contador en vez de apilar otro
        const key = `${type}|${title}|${message || ''}`;
        const live = [...container.children].filter(n => !n._gone);
        const same = live.find(n => n._key === key);
        if (same) {
            same._count = (same._count || 1) + 1;
            same.querySelector('.notif-count').textContent = `×${same._count}`;
            arm(same);
            return;
        }
        // Máximo 3 a la vez: retirar las más antiguas
        live.slice(0, Math.max(0, live.length - 2)).forEach(dismiss);

        const notif = document.createElement('div');
        notif.className = `in-app-notification type-${type}`;
        notif._key = key;
        notif.innerHTML = `
            <div class="notif-header">
                <strong><span class="notif-icon">${icon}</span>${title}<span class="notif-count"></span></strong>
                <button class="notif-close" aria-label="Cerrar aviso">×</button>
            </div>
            ${message ? `<div class="notif-body">${message}</div>` : ''}
        `;

        container.appendChild(notif);
        arm(notif);
        notif.querySelector('.notif-close').addEventListener('click', () => dismiss(notif));
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
                $('#settlementBody')?.scrollIntoView({ behavior: 'smooth' });
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
        this.show('¡Logro desbloqueado!', {
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
        this.show('Hambruna', {
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
