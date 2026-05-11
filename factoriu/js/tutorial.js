var Tutorial = {
    active: false,
    step: 0,
    steps: [
        {
            text: '🏭 ¡Bienvenido a Imperio Industrial! Busca las vetas de mineral en el mapa. Mueve la cámara con clic derecho (PC) o dos dedos (móvil).',
            trigger: 'start',
            highlight: null
        },
        {
            text: '⛏️ Selecciona el MINERO de la barra y colócalo sobre una veta de hierro (azules).',
            trigger: 'place_miner',
            highlight: 'toolbar-miner'
        },
        {
            text: '🔥 ¡Genial! El minero extrae mineral. Ahora coloca una FUNDIDORA cerca.',
            trigger: 'place_furnace',
            highlight: 'toolbar-furnace'
        },
        {
            text: '🔗 ¡Conéctalos con CINTAS! Selecciona cinta y arrastra del minero a la fundidora.',
            trigger: 'place_belt_3',
            highlight: 'toolbar-belt'
        },
        {
            text: '✨ ¡Se producen placas de hierro! Toca un edificio para ver su inventario. ¡Sigue expandiendo!',
            trigger: 'produce_iron_plate',
            highlight: null
        },
        {
            text: '🔬 Construye un LABORATORIO y aliméntalo con Ciencia Roja para investigar tecnologías. Abre el Árbol Tecnológico.',
            trigger: 'complete',
            highlight: 'toolbar-lab'
        }
    ],
    beltCount: 0,

    init: function() {
        if (Save.hasSave()) {
            this.active = false;
            return;
        }
        this.active = true;
        this.step = 0;
        this.beltCount = 0;
        this.showStep();
    },

    showStep: function() {
        if (!this.active || this.step >= this.steps.length) {
            this.complete();
            return;
        }
        var s = this.steps[this.step];
        UI.showTutorial(s.text, s.highlight);
    },

    onEvent: function(event, data) {
        if (!this.active) return;
        var s = this.steps[this.step];
        if (!s) return;

        var advance = false;

        if (s.trigger === 'start') {
            advance = true;
        }
        if (s.trigger === 'place_miner' && event === 'place' && data === 'miner') {
            advance = true;
        }
        if (s.trigger === 'place_furnace' && event === 'place' && data === 'furnace') {
            advance = true;
        }
        if (s.trigger === 'place_belt_3' && event === 'place' && data === 'belt') {
            this.beltCount++;
            if (this.beltCount >= 3) advance = true;
        }
        if (s.trigger === 'produce_iron_plate' && event === 'produce' && data === 'iron_plate') {
            advance = true;
        }
        if (s.trigger === 'complete') {
            advance = true;
        }

        if (advance) {
            this.step++;
            this.showStep();
        }
    },

    complete: function() {
        this.active = false;
        UI.hideTutorial();
    },

    skip: function() {
        this.active = false;
        UI.hideTutorial();
    }
};
