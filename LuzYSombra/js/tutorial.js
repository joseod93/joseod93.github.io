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

        // Estado para tracking de scroll
        this.currentHighlight = null;
        this.currentPos = null;
        this.onScroll = this.handleScroll.bind(this);

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

        // Activar listener global de scroll
        window.addEventListener('scroll', this.onScroll, { passive: true });
        window.addEventListener('resize', this.onScroll, { passive: true });

        this.showStep(this.currentStep);
    }

    handleScroll() {
        if (this.active && this.tooltip && this.currentHighlight) {
            // Recalcular posición sin efecto secundario de scroll
            this.positionTooltip(this.tooltip, this.currentHighlight, this.currentPos);
        }
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

                // Actualizar estado para el listener de scroll
                this.currentHighlight = target;
                this.currentPos = step.position;

                // Scroll automático
                const prevTarget = this.currentHighlight;
                if (target !== prevTarget) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    // Force scroll anyway on first show
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }

                this.positionTooltip(this.tooltip, target, step.position);
                targetFound = true;
            }
        }

        if (!targetFound) {
            this.currentHighlight = null;
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
        const isMobile = window.innerWidth <= 900;
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Ajustar posición para móviles
        let finalPosition = position;
        if (isMobile) {
            if (position === 'left' || position === 'right') {
                finalPosition = 'bottom';
            }
        }

        // Función auxiliar para posicionar
        const setPos = (pos) => {
            // Resetear estilos conflictivos
            tooltip.style.top = 'auto';
            tooltip.style.bottom = 'auto';
            tooltip.style.left = 'auto';
            tooltip.style.right = 'auto';
            tooltip.style.transform = 'none';

            switch (pos) {
                case 'bottom':
                    tooltip.style.top = (rect.bottom + 10) + 'px';
                    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
                    tooltip.style.transform = 'translateX(-50%)';
                    break;
                case 'top':
                    tooltip.style.bottom = (viewportHeight - rect.top + 10) + 'px';
                    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
                    tooltip.style.transform = 'translateX(-50%)';
                    break;
                case 'left':
                    tooltip.style.top = (rect.top + rect.height / 2) + 'px';
                    tooltip.style.right = (viewportWidth - rect.left + 10) + 'px';
                    tooltip.style.transform = 'translateY(-50%)';
                    break;
                case 'right':
                    tooltip.style.top = (rect.top + rect.height / 2) + 'px';
                    tooltip.style.left = (rect.right + 10) + 'px';
                    tooltip.style.transform = 'translateY(-50%)';
                    break;
            }
        };

        // 1. Intentar posición inicial
        setPos(finalPosition);

        // 2. Verificar si se sale verticalmente y corregir
        const tooltipRect = tooltip.getBoundingClientRect();

        // Si se sale por abajo
        if (tooltipRect.bottom > viewportHeight - 10) {
            // Si estaba abajo, intentar ponerlo arriba
            if (finalPosition === 'bottom') {
                // Verificar si cabe arriba
                if (rect.top > tooltipRect.height + 20) {
                    setPos('top');
                } else {
                    // No cabe arriba tampoco, forzar dentro
                    tooltip.style.top = 'auto';
                    tooltip.style.bottom = '10px';
                }
            }
            // Si es left/right y se sale por abajo (raro pero posible)
            else {
                tooltip.style.top = 'auto';
                tooltip.style.bottom = '10px';
                if (finalPosition === 'left' || finalPosition === 'right') {
                    // Mantener transform solo en X si habíamos quitado Y, 
                    // pero setPos usa translateY(-50%)... mejor simplificar:
                    // Si forzamos bottom a un left/right side, quitamos el translateY centrado
                    // y confiamos en que quede "alineado" o simplemente dentro.
                    tooltip.style.transform = 'none'; // Simplificación
                }
            }
        }

        // Si se sale por arriba (ej: top negativo)
        else if (tooltipRect.top < 10) {
            if (finalPosition === 'top') {
                setPos('bottom');
            } else {
                tooltip.style.bottom = 'auto';
                tooltip.style.top = '10px';
                if (finalPosition === 'left' || finalPosition === 'right') {
                    tooltip.style.transform = 'none';
                }
            }
        }

        // 3. Verificar horizontalmente (Clamp final)
        const finalRect = tooltip.getBoundingClientRect();
        if (finalRect.left < 10) {
            tooltip.style.left = '10px';
            tooltip.style.right = 'auto';
            tooltip.style.transform = (finalRect.top < viewportHeight / 2) ? 'none' : 'none';
            // Nota: Si teníamos translateX(-50%) hay que quitarlo si fijamos left=10px
            // Al fijar left=10px, ya no queremos el transform X.
            // Si el elemento es top/bottom, tenía translateX. Si es left/right, tenía translateY.
            // Para simplificar, si tocamos bordes, quitamos transform X si existía.

            // Re-check transform logic:
            // Top/Bottom usaban translateX(-50%). Si fijamos Left, debemos quitar ese X.
            if (finalPosition === 'top' || finalPosition === 'bottom') {
                tooltip.style.transform = 'none';
            }
        }
        else if (finalRect.right > viewportWidth - 10) {
            tooltip.style.left = 'auto';
            tooltip.style.right = '10px';
            if (finalPosition === 'top' || finalPosition === 'bottom') {
                tooltip.style.transform = 'none';
            }
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

        // Limpiar listeners
        window.removeEventListener('scroll', this.onScroll);
        window.removeEventListener('resize', this.onScroll);

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
