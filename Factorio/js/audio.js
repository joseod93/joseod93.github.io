var Audio = {
    ctx: null,
    enabled: true,
    initialized: false,
    musicEnabled: true,
    music: null,

    init: function() {
        this.enabled = true;
        try {
            this.musicEnabled = localStorage.getItem('factoryEmpire_music') !== '0';
        } catch(e) {}
    },

    ensureContext: function() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch(e) {
            this.enabled = false;
        }
    },

    play: function(type) {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        try {
            var now = this.ctx.currentTime;
            var osc, gain;

            if (type === 'place') {
                osc = this.ctx.createOscillator();
                gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.type = 'square';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            }
            else if (type === 'remove') {
                osc = this.ctx.createOscillator();
                gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.start(now);
                osc.stop(now + 0.12);
            }
            else if (type === 'research') {
                var notes = [523, 659, 784];
                for (var i = 0; i < notes.length; i++) {
                    osc = this.ctx.createOscillator();
                    gain = this.ctx.createGain();
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(notes[i], now + i * 0.12);
                    gain.gain.setValueAtTime(0, now + i * 0.12);
                    gain.gain.linearRampToValueAtTime(0.15, now + i * 0.12 + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);
                    osc.start(now + i * 0.12);
                    osc.stop(now + i * 0.12 + 0.3);
                }
            }
            else if (type === 'milestone') {
                var chord = [440, 554, 659, 880];
                for (var j = 0; j < chord.length; j++) {
                    osc = this.ctx.createOscillator();
                    gain = this.ctx.createGain();
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(chord[j], now);
                    gain.gain.setValueAtTime(0, now);
                    gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                    osc.start(now);
                    osc.stop(now + 0.6);
                }
            }
            else if (type === 'error') {
                osc = this.ctx.createOscillator();
                gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.type = 'square';
                osc.frequency.setValueAtTime(100, now);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
            }
            else if (type === 'power_warning') {
                osc = this.ctx.createOscillator();
                gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(80, now);
                osc.frequency.linearRampToValueAtTime(60, now + 0.3);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            }
            else if (type === 'resource_depleted') {
                osc = this.ctx.createOscillator();
                gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
            }
            else if (type === 'rocket_launch') {
                // Rumble: ruido filtrado descendente
                var rbuf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 2.5), this.ctx.sampleRate);
                var rdata = rbuf.getChannelData(0);
                for (var ri = 0; ri < rdata.length; ri++) {
                    rdata[ri] = Math.random() * 2 - 1;
                }
                var rsrc = this.ctx.createBufferSource();
                rsrc.buffer = rbuf;
                var rfilter = this.ctx.createBiquadFilter();
                rfilter.type = 'lowpass';
                rfilter.frequency.setValueAtTime(400, now);
                rfilter.frequency.linearRampToValueAtTime(120, now + 2.5);
                var rgain = this.ctx.createGain();
                rsrc.connect(rfilter);
                rfilter.connect(rgain);
                rgain.connect(this.ctx.destination);
                rgain.gain.setValueAtTime(0, now);
                rgain.gain.linearRampToValueAtTime(0.18, now + 0.15);
                rgain.gain.setValueAtTime(0.18, now + 2.0);
                rgain.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
                rsrc.start(now);
                rsrc.stop(now + 2.8);

                // Sweep grave
                osc = this.ctx.createOscillator();
                gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(70, now);
                osc.frequency.linearRampToValueAtTime(25, now + 2.5);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.06, now + 0.15);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 2.6);
                osc.start(now);
                osc.stop(now + 2.6);
            }
            else if (type === 'click') {
                var buf = this.ctx.createBuffer(1, 800, this.ctx.sampleRate);
                var data = buf.getChannelData(0);
                for (var k = 0; k < data.length; k++) {
                    data[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / data.length, 10);
                }
                var src = this.ctx.createBufferSource();
                gain = this.ctx.createGain();
                src.buffer = buf;
                src.connect(gain);
                gain.connect(this.ctx.destination);
                gain.gain.setValueAtTime(0.05, now);
                src.start(now);
            }
        } catch(e) {}
    },

    toggle: function() {
        this.enabled = !this.enabled;
        return this.enabled;
    },

    // ===== Música ambiental procedural =====
    startMusic: function() {
        if (!this.musicEnabled) return;
        this.ensureContext();
        if (!this.ctx) return;
        if (this.music && this.music.timer) return; // ya sonando

        try {
            var ctx = this.ctx;
            var musicGain = ctx.createGain();
            musicGain.gain.value = 0.05;
            musicGain.connect(ctx.destination);

            // Drone: 3 osciladores graves desafinados
            var droneGain = ctx.createGain();
            droneGain.gain.value = 0.5;
            droneGain.connect(musicGain);

            var oscs = [];
            var freqs = [[55, 0], [55, 7], [110, -5]]; // [Hz, detune cents]
            for (var i = 0; i < freqs.length; i++) {
                var o = ctx.createOscillator();
                o.type = 'sine';
                o.frequency.value = freqs[i][0];
                o.detune.value = freqs[i][1];
                o.connect(droneGain);
                o.start();
                oscs.push(o);
            }

            // LFO: respiración lenta del volumen del drone
            var lfo = ctx.createOscillator();
            lfo.frequency.value = 0.08;
            var lfoGain = ctx.createGain();
            lfoGain.gain.value = 0.18;
            lfo.connect(lfoGain);
            lfoGain.connect(droneGain.gain);
            lfo.start();

            // Eco simple para las notas
            var delay = ctx.createDelay(1);
            delay.delayTime.value = 0.45;
            var feedback = ctx.createGain();
            feedback.gain.value = 0.35;
            delay.connect(feedback);
            feedback.connect(delay);
            delay.connect(musicGain);

            var timer = setInterval(function() {
                if (Math.random() < 0.35) Audio.playMelodyNote();
            }, 2000);

            this.music = {gain: musicGain, oscs: oscs, lfo: lfo, delay: delay, timer: timer};
        } catch(e) {
            this.music = null;
        }
    },

    playMelodyNote: function() {
        if (!this.music || !this.ctx) return;
        try {
            var ctx = this.ctx;
            var now = ctx.currentTime;
            var scale = [220, 261.63, 293.66, 329.63, 392, 440]; // pentatónica La menor
            var freq = scale[Math.floor(Math.random() * scale.length)];
            if (Math.random() < 0.3) freq *= 2;

            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            osc.connect(gain);
            gain.connect(this.music.gain);
            gain.connect(this.music.delay);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.045, now + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
            osc.start(now);
            osc.stop(now + 1.9);
        } catch(e) {}
    },

    stopMusic: function() {
        if (!this.music) return;
        try {
            clearInterval(this.music.timer);
            for (var i = 0; i < this.music.oscs.length; i++) {
                try { this.music.oscs[i].stop(); } catch(e) {}
            }
            try { this.music.lfo.stop(); } catch(e2) {}
            this.music.gain.disconnect();
        } catch(e3) {}
        this.music = null;
    },

    toggleMusic: function() {
        this.musicEnabled = !this.musicEnabled;
        try {
            localStorage.setItem('factoryEmpire_music', this.musicEnabled ? '1' : '0');
        } catch(e) {}
        if (this.musicEnabled) {
            this.startMusic();
        } else {
            this.stopMusic();
        }
        return this.musicEnabled;
    }
};
