window.Game = window.Game || {};

Game.Audio = {
    ctx: null,
    masterGain: null,
    sfxGain: null,
    musicGain: null,
    initialized: false,
    enabled: true,
    musicEnabled: true,
    currentMusicType: null,
    musicTimeout: null,

    init: function() {
        if (this.initialized) return;
        try {
            var AC = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AC();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.35;
            this.masterGain.connect(this.ctx.destination);
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 0.5;
            this.sfxGain.connect(this.masterGain);
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0.12;
            this.musicGain.connect(this.masterGain);
            this.initialized = true;
        } catch (e) { this.enabled = false; }
    },

    resume: function() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    ensure: function() { this.init(); this.resume(); },

    tone: function(freq, start, dur, type, dest, vol) {
        if (!this.ctx) return;
        var o = this.ctx.createOscillator();
        var g = this.ctx.createGain();
        o.type = type || 'square';
        o.frequency.value = freq;
        g.gain.setValueAtTime(vol || 0.15, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + dur);
        o.connect(g);
        g.connect(dest || this.sfxGain);
        o.start(start);
        o.stop(start + dur + 0.01);
    },

    noise: function(start, dur, vol) {
        if (!this.ctx) return;
        var n = Math.floor(this.ctx.sampleRate * dur);
        var buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        var s = this.ctx.createBufferSource();
        s.buffer = buf;
        var g = this.ctx.createGain();
        g.gain.setValueAtTime(vol || 0.08, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + dur);
        s.connect(g); g.connect(this.sfxGain);
        s.start(start);
    },

    playHit: function() {
        if (!this.enabled) return; this.ensure();
        var t = this.ctx.currentTime;
        this.tone(180, t, 0.08, 'square');
        this.tone(110, t + 0.03, 0.1, 'sawtooth', null, 0.1);
        this.noise(t, 0.06, 0.1);
    },

    playCrit: function() {
        if (!this.enabled) return; this.ensure();
        var t = this.ctx.currentTime;
        this.tone(300, t, 0.06, 'square');
        this.tone(450, t + 0.05, 0.08, 'square');
        this.noise(t, 0.08, 0.12);
    },

    playSuperEffective: function() {
        if (!this.enabled) return; this.ensure();
        var t = this.ctx.currentTime;
        this.tone(400, t, 0.08, 'square');
        this.tone(500, t + 0.07, 0.08, 'square');
        this.tone(630, t + 0.14, 0.12, 'square');
    },

    playNotEffective: function() {
        if (!this.enabled) return; this.ensure();
        var t = this.ctx.currentTime;
        this.tone(300, t, 0.12, 'triangle', null, 0.08);
        this.tone(220, t + 0.1, 0.15, 'triangle', null, 0.06);
    },

    playHeal: function() {
        if (!this.enabled) return; this.ensure();
        var t = this.ctx.currentTime;
        var n = [523, 659, 784, 1047];
        for (var i = 0; i < n.length; i++) this.tone(n[i], t + i * 0.11, 0.18, 'sine', null, 0.12);
    },

    playLevelUp: function() {
        if (!this.enabled) return; this.ensure();
        var t = this.ctx.currentTime;
        var n = [262, 330, 392, 523, 659, 784];
        for (var i = 0; i < n.length; i++) this.tone(n[i], t + i * 0.07, 0.1, 'square', null, 0.12);
    },

    playSelect: function() {
        if (!this.enabled) return; this.ensure();
        this.tone(800, this.ctx.currentTime, 0.05, 'square', null, 0.08);
    },

    playConfirm: function() {
        if (!this.enabled) return; this.ensure();
        var t = this.ctx.currentTime;
        this.tone(600, t, 0.04, 'square', null, 0.1);
        this.tone(900, t + 0.04, 0.07, 'square', null, 0.1);
    },

    playCancel: function() {
        if (!this.enabled) return; this.ensure();
        var t = this.ctx.currentTime;
        this.tone(400, t, 0.04, 'square', null, 0.08);
        this.tone(280, t + 0.04, 0.08, 'square', null, 0.08);
    },

    playCapture: function() {
        if (!this.enabled) return; this.ensure();
        var t = this.ctx.currentTime;
        this.tone(440, t, 0.1, 'square', null, 0.12);
        this.tone(350, t + 0.1, 0.1, 'square', null, 0.12);
        this.tone(440, t + 0.2, 0.1, 'square', null, 0.12);
        this.tone(700, t + 0.35, 0.25, 'sine', null, 0.15);
    },

    playCaptureFail: function() {
        if (!this.enabled) return; this.ensure();
        var t = this.ctx.currentTime;
        this.tone(400, t, 0.1, 'square', null, 0.1);
        this.tone(300, t + 0.08, 0.12, 'square', null, 0.1);
        this.tone(200, t + 0.18, 0.2, 'sawtooth', null, 0.08);
    },

    playFaint: function() {
        if (!this.enabled) return; this.ensure();
        var t = this.ctx.currentTime;
        this.tone(400, t, 0.12, 'square', null, 0.12);
        this.tone(300, t + 0.1, 0.12, 'square', null, 0.1);
        this.tone(200, t + 0.2, 0.15, 'square', null, 0.08);
        this.tone(100, t + 0.33, 0.25, 'square', null, 0.06);
    },

    playEncounter: function() {
        if (!this.enabled) return; this.ensure();
        var t = this.ctx.currentTime;
        this.tone(330, t, 0.07, 'square', null, 0.18);
        this.tone(440, t + 0.06, 0.07, 'square', null, 0.18);
        this.tone(550, t + 0.12, 0.07, 'square', null, 0.18);
        this.tone(660, t + 0.18, 0.1, 'square', null, 0.22);
    },

    playEvolution: function() {
        if (!this.enabled) return; this.ensure();
        var t = this.ctx.currentTime;
        var n = [262, 330, 392, 330, 392, 523, 392, 523, 659, 784];
        for (var i = 0; i < n.length; i++) this.tone(n[i], t + i * 0.13, 0.16, 'sine', null, 0.12);
    },

    playShop: function() {
        if (!this.enabled) return; this.ensure();
        var t = this.ctx.currentTime;
        this.tone(440, t, 0.07, 'sine', null, 0.1);
        this.tone(554, t + 0.07, 0.07, 'sine', null, 0.1);
        this.tone(659, t + 0.14, 0.1, 'sine', null, 0.12);
    },

    playBuy: function() {
        if (!this.enabled) return; this.ensure();
        var t = this.ctx.currentTime;
        this.tone(523, t, 0.05, 'sine', null, 0.12);
        this.tone(659, t + 0.05, 0.05, 'sine', null, 0.12);
        this.tone(784, t + 0.1, 0.1, 'sine', null, 0.12);
    },

    playError: function() {
        if (!this.enabled) return; this.ensure();
        this.tone(200, this.ctx.currentTime, 0.15, 'square', null, 0.1);
    },

    playRun: function() {
        if (!this.enabled) return; this.ensure();
        var t = this.ctx.currentTime;
        this.tone(500, t, 0.06, 'square', null, 0.1);
        this.tone(400, t + 0.05, 0.06, 'square', null, 0.08);
        this.tone(300, t + 0.1, 0.08, 'square', null, 0.06);
    },

    playMiss: function() {
        if (!this.enabled) return; this.ensure();
        this.tone(180, this.ctx.currentTime, 0.18, 'triangle', null, 0.06);
    },

    overworldNotes: [
        330, 392, 440, 392, 330, 294, 262, 294,
        330, 392, 440, 494, 523, 494, 440, 392,
        440, 392, 330, 294, 262, 330, 392, 330,
        294, 330, 294, 262, 262, 0, 0, 0
    ],

    battleNotes: [
        330, 330, 349, 330, 294, 262, 294, 330,
        220, 247, 262, 294, 330, 294, 262, 247,
        330, 349, 330, 294, 330, 349, 392, 440,
        392, 349, 330, 294, 262, 294, 330, 330
    ],

    playMusic: function(type) {
        if (!this.enabled || !this.musicEnabled) return;
        this.ensure();
        if (this.currentMusicType === type) return;
        this.stopMusic();
        this.currentMusicType = type;
        this._loopMusic();
    },

    _loopMusic: function() {
        if (!this.ctx || !this.currentMusicType) return;
        var notes = this.currentMusicType === 'battle' ? this.battleNotes : this.overworldNotes;
        var bpm = this.currentMusicType === 'battle' ? 170 : 125;
        var beat = 60 / bpm;
        var t = this.ctx.currentTime + 0.05;
        var total = 0;
        for (var i = 0; i < notes.length; i++) {
            if (notes[i] > 0) {
                this.tone(notes[i], t + total, beat * 0.75, 'square', this.musicGain, 0.08);
                this.tone(notes[i] * 0.5, t + total, beat * 0.75, 'triangle', this.musicGain, 0.04);
            }
            total += beat;
        }
        var self = this;
        this.musicTimeout = setTimeout(function() {
            if (self.currentMusicType) self._loopMusic();
        }, total * 1000);
    },

    stopMusic: function() {
        this.currentMusicType = null;
        if (this.musicTimeout) { clearTimeout(this.musicTimeout); this.musicTimeout = null; }
        if (this.musicGain && this.ctx) {
            this.musicGain.disconnect();
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0.12;
            this.musicGain.connect(this.masterGain);
        }
    },

    toggleMusic: function() {
        this.musicEnabled = !this.musicEnabled;
        if (!this.musicEnabled) this.stopMusic();
        return this.musicEnabled;
    }
};
