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
            text: '🔥 La fundidora necesita CARBÓN como combustible. Aliméntala a mano (tócala) o con un insertador.',
            action: 'next'
        },
        {
            text: '🤏 Coloca un INSERTADOR: mueve items entre edificios y cintas. La flecha indica hacia dónde lleva los items.',
            action: 'place_inserter',
            highlight: 'toolbar-inserter'
        },
        {
            text: '📦 El ALMACÉN guarda items. Útil como buffer entre máquinas para evitar atascos.',
            action: 'next'
        },
        {
            text: '⚡ Los ensambladores y laboratorios necesitan ELECTRICIDAD. Construye un MOTOR DE VAPOR (necesita ladrillos: funde piedra en la fundidora).',
            action: 'place_steam', soft: true,
            highlight: 'toolbar-steam_engine'
        },
        {
            text: '🔥 Alimenta el motor con carbón (tócalo y añádelo) hasta que la barra de energía de arriba marque producción.',
            action: 'power_on', soft: true
        },
        {
            text: '⚡ Si la producción baja del consumo, los edificios eléctricos se ralentizan. El ACUMULADOR (se desbloquea con Energía Solar) almacena el excedente para los picos.',
            action: 'next'
        },
        {
            text: '🔬 Construye un LABORATORIO: investiga tecnologías consumiendo packs de ciencia (se fabrican en ensambladores).',
            action: 'place_lab', soft: true,
            highlight: 'toolbar-lab'
        },
        {
            text: '🔬 Abre el ÁRBOL TECNOLÓGICO con el botón de arriba.',
            action: 'open_tech', soft: true,
            highlight: 'btn-tech'
        },
        {
            text: '🧪 Elige AUTOMATIZACIÓN y pulsa Investigar. Tus laboratorios trabajarán cuando tengan ciencia roja.',
            action: 'research_started', soft: true
        },
        {
            text: '🔀 Investiga Logística para desbloquear el DIVISOR (con prioridad de salida configurable), la CINTA RÁPIDA y la CINTA SUBTERRÁNEA (coloca entrada y salida en la misma dirección).',
            action: 'next'
        },
        {
            text: '⭐ Cuando lances tu primer cohete, podrás PRESTIGIAR: reiniciar la fábrica con bonificaciones permanentes.',
            action: 'next'
        },
        {
            text: '📖 Consulta el GLOSARIO (📖) para ver todas las recetas. Tecla Q copia el edificio bajo el cursor. ¡Buena suerte!',
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
        // Pasos 'soft': escuchan el evento PERO también muestran el botón Siguiente
        UI.showTutorial(s.text, s.highlight, s.action === 'next' || s.action === 'complete' || !!s.soft);
    },

    nextStep: function() {
        if (!this.active) return;
        var s = this.steps[this.step];
        if (s && (s.action === 'next' || s.action === 'complete' || s.soft)) {
            if (s.action === 'complete') {
                this.complete();
                return;
            }
            this.step++;
            this.showStep();
        }
    },

    // Acciones que avanzan al recibir un evento 'place' del tipo indicado
    PLACE_ACTIONS: {
        place_miner: 'miner',
        place_furnace: 'furnace',
        place_inserter: 'inserter',
        place_steam: 'steam_engine',
        place_lab: 'lab'
    },

    onEvent: function(event, data) {
        if (!this.active) return;
        var s = this.steps[this.step];
        if (!s) return;

        var advance = false;

        if (event === 'place' && this.PLACE_ACTIONS[s.action] === data) {
            advance = true;
        } else if (s.action === 'mine' && event === 'mine') {
            advance = true;
        } else if (s.action === 'place_belt_3' && event === 'place' && data === 'belt') {
            this.beltCount++;
            if (this.beltCount >= 3) advance = true;
        } else if (s.action === 'power_on' && event === 'power') {
            advance = true;
        } else if (s.action === 'open_tech' && event === 'open_tech') {
            advance = true;
        } else if (s.action === 'research_started' && event === 'research_started') {
            advance = true;
        } else if (s.action === 'research_done' && event === 'research') {
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
