var Tutorial = {
    active: false,
    step: 0,
    waitingAction: false,
    steps: [
        {
            text: '🏭 ¡Bienvenido a Imperio Industrial!\nConstruye fábricas, automatiza producción y lanza un cohete.',
            action: 'next'
        },
        {
            text: '🖱️ Mueve la cámara: clic derecho y arrastra (PC) o dos dedos (móvil). Usa rueda o botones +/- para zoom.',
            action: 'next'
        },
        {
            text: '👆 Puedes minar a mano tocando las vetas de mineral del mapa. ¡Pruébalo!',
            action: 'mine'
        },
        {
            text: '⛏️ Selecciona el MINERO en la barra inferior y colócalo sobre una veta de hierro (azul).',
            action: 'place_miner',
            highlight: 'toolbar-miner'
        },
        {
            text: '🔥 ¡El minero extrae mineral automáticamente! Ahora coloca una FUNDIDORA cerca. Necesita piedra.',
            action: 'place_furnace',
            highlight: 'toolbar-furnace'
        },
        {
            text: '➡️ Conecta minero → fundidora con CINTAS. Selecciona cinta y arrastra entre ellos.',
            action: 'place_belt_3',
            highlight: 'toolbar-belt'
        },
        {
            text: '🔥 La fundidora necesita CARBÓN como combustible. Usa un insertador o aliméntala a mano (toca la fundidora).',
            action: 'next'
        },
        {
            text: '🤏 El INSERTADOR mueve items entre edificios y cintas. Colócalo mirando hacia donde quieras que lleve items.',
            action: 'next'
        },
        {
            text: '📦 El ALMACÉN guarda items. Útil como buffer entre máquinas.',
            action: 'next'
        },
        {
            text: '⚡ Los ensambladores y laboratorios necesitan ELECTRICIDAD. Construye un Motor de Vapor y aliméntalo con carbón.',
            action: 'next'
        },
        {
            text: '⚡ Fíjate en la barra de energía arriba. Si la producción baja del consumo, los edificios eléctricos irán más lentos o se detendrán.',
            action: 'next'
        },
        {
            text: '📦 El ALMACÉN sirve como buffer. Colócalo entre máquinas para evitar atascos cuando las cintas están llenas.',
            action: 'next'
        },
        {
            text: '🔬 Construye un LABORATORIO y dale packs de ciencia para investigar tecnologías nuevas. Abre el Árbol Tecnológico (🔬).',
            action: 'next'
        },
        {
            text: '🔀 Investiga Logística para desbloquear el DIVISOR (reparte items entre cintas) y la CINTA RÁPIDA.',
            action: 'next'
        },
        {
            text: '⭐ Cuando lances tu primer cohete, podrás PRESTIGIAR: reiniciar la fábrica con bonificaciones permanentes.',
            action: 'next'
        },
        {
            text: '📖 Consulta el GLOSARIO (📖) para ver todas las recetas y cómo obtener cada material. ¡Buena suerte!',
            action: 'complete'
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
        this.waitingAction = false;
        this.showStep();
    },

    showStep: function() {
        if (!this.active || this.step >= this.steps.length) {
            this.complete();
            return;
        }
        var s = this.steps[this.step];
        this.waitingAction = (s.action !== 'next' && s.action !== 'complete');
        UI.showTutorial(s.text, s.highlight, s.action === 'next' || s.action === 'complete');
    },

    nextStep: function() {
        if (!this.active) return;
        var s = this.steps[this.step];
        if (s && (s.action === 'next' || s.action === 'complete')) {
            if (s.action === 'complete') {
                this.complete();
                return;
            }
            this.step++;
            this.showStep();
        }
    },

    onEvent: function(event, data) {
        if (!this.active) return;
        var s = this.steps[this.step];
        if (!s) return;

        var advance = false;

        if (s.action === 'mine' && event === 'mine') {
            advance = true;
        }
        if (s.action === 'place_miner' && event === 'place' && data === 'miner') {
            advance = true;
        }
        if (s.action === 'place_furnace' && event === 'place' && data === 'furnace') {
            advance = true;
        }
        if (s.action === 'place_belt_3' && event === 'place' && data === 'belt') {
            this.beltCount++;
            if (this.beltCount >= 3) advance = true;
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
