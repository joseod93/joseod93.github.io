var Audio = {
    ctx: null,
    enabled: true,
    initialized: false,

    init: function() {
        this.enabled = true;
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
    }
};
