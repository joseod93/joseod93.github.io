// Tutorial Module - Sistema de tutorial interactivo
// Luz y Sombra: El Alba de Hispania

import { $ } from './utils.js';

const TUTORIAL_STEPS = [
    {
        id: 'welcome',
        title: '¡Bienvenido a Andalucía!',
        message: 'Despiertas en una habitación fría. Tu primera tarea es encender la fogata para sobrevivir.',
        highlight: '#btnStoke',
        position: 'bottom',
        action: 'Haz clic en "Encender la fogata"'
    },
    {
        id: 'gather_wood',
        title: 'Recolectar Leña',
        message: 'Necesitas leña para mantener el fuego. Explora el bosque cercano.',
        highlight: '#btnCut',
        position: 'bottom',
        action: 'Haz clic en "Cortar leña"'
    },
    {
        id: 'resources',
        title: 'Recursos',
        message: 'Aquí puedes ver tus recursos. Gestiónalos sabiamente para sobrevivir.',
        highlight: '#resources',
        position: 'right',
        action: 'Revisa tus recursos'
    },
    {
        id: 'explore',
        title: 'Exploración',
        message: 'Explora los contornos para descubrir nuevos recursos y ganar renombre.',
        highlight: '#actions',
        position: 'bottom',
        action: 'Explora cuando puedas'
    },
    {
        id: 'log',
        title: 'Diario',
        message: 'El diario registra todos los eventos importantes. Revísalo regularmente.',
        highlight: '#log',
        position: 'left',
        action: 'Lee el diario'
    },
    {
        id: 'complete',
        title: '¡Tutorial Completado!',
        message: 'Ahora estás listo para tu aventura en Andalucía. ¡Buena suerte!',
        highlight: null,
        position: 'center',
        action: null
    }
];

class Tutorial {
    constructor() {
        this.currentStep = 0;
        this.active = false;
        this.completed = false;
        this.overlay = null;
        this.tooltip = null;

        this.loadProgress();
    }

    loadProgress() {
        const saved = localStorage.getItem('lys_tutorial');
        if (saved) {
            const data = JSON.parse(saved);
            this.currentStep = data.currentStep || 0;
            this.completed = data.completed || false;
        }
    }

    saveProgress() {
        localStorage.setItem('lys_tutorial', JSON.stringify({
            currentStep: this.currentStep,
            completed: this.completed
        }));
    }

    start() {
        if (this.completed) return;
        this.active = true;
        this.showStep(this.currentStep);
    }

    showStep(index) {
        if (index >= TUTORIAL_STEPS.length) {
            this.complete();
            return;
        }

        const step = TUTORIAL_STEPS[index];

        // Remover tooltip anterior
        this.removeTooltip();

        // Crear overlay si no existe
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.className = 'tutorial-overlay';
            document.body.appendChild(this.overlay);
        }

        // Crear tooltip
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tutorial-tooltip';
        this.tooltip.innerHTML = `
            <div class="tutorial-header">
                <h3>${step.title}</h3>
                <button class="tutorial-skip">Saltar Tutorial</button>
            </div>
            <p>${step.message}</p>
            ${step.action ? `<div class="tutorial-action">👉 ${step.action}</div>` : ''}
            <div class="tutorial-footer">
                <span>Paso ${index + 1} de ${TUTORIAL_STEPS.length}</span>
                ${index < TUTORIAL_STEPS.length - 1 ? '<button class="tutorial-next">Siguiente</button>' : '<button class="tutorial-next">Finalizar</button>'}
            </div>
        `;

        // Posicionar tooltip
        let targetFound = false;
        if (step.highlight) {
            const target = $(step.highlight);
            if (target) {
                target.classList.add('tutorial-highlight');
                this.positionTooltip(this.tooltip, target, step.position);
                targetFound = true;
            }
        }

        if (!targetFound) {
            this.tooltip.style.position = 'fixed';
            this.tooltip.style.top = '50%';
            this.tooltip.style.left = '50%';
            this.tooltip.style.transform = 'translate(-50%, -50%)';
        }

        document.body.appendChild(this.tooltip);

        // Event listeners
        this.tooltip.querySelector('.tutorial-next')?.addEventListener('click', () => this.next());
        this.tooltip.querySelector('.tutorial-skip')?.addEventListener('click', () => this.skip());
    }

    positionTooltip(tooltip, target, position) {
        const rect = target.getBoundingClientRect();
        tooltip.style.position = 'fixed';

        switch (position) {
            case 'bottom':
                tooltip.style.top = (rect.bottom + 10) + 'px';
                tooltip.style.left = (rect.left + rect.width / 2) + 'px';
                tooltip.style.transform = 'translateX(-50%)';
                break;
            case 'top':
                tooltip.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
                tooltip.style.left = (rect.left + rect.width / 2) + 'px';
                tooltip.style.transform = 'translateX(-50%)';
                break;
            case 'left':
                tooltip.style.top = (rect.top + rect.height / 2) + 'px';
                tooltip.style.right = (window.innerWidth - rect.left + 10) + 'px';
                tooltip.style.transform = 'translateY(-50%)';
                break;
            case 'right':
                tooltip.style.top = (rect.top + rect.height / 2) + 'px';
                tooltip.style.left = (rect.right + 10) + 'px';
                tooltip.style.transform = 'translateY(-50%)';
                break;
        }
    }

    next() {
        this.currentStep++;
        this.saveProgress();
        this.showStep(this.currentStep);
    }

    skip() {
        this.complete();
    }

    complete() {
        this.active = false;
        this.completed = true;
        this.saveProgress();
        this.removeTooltip();

        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    removeTooltip() {
        // Remover highlights
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });

        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }
    }

    reset() {
        this.currentStep = 0;
        this.completed = false;
        this.saveProgress();
    }
}

// Instancia única
export const tutorial = new Tutorial();

export default tutorial;
