
export const AudioSystem = {
    audio: null,
    muted: false,
    ctx: null,
    init() {
        this.muted = localStorage.getItem('lys_muted') === 'true';
        this.volume = parseFloat(localStorage.getItem('lys_volume'));
        if (isNaN(this.volume)) this.volume = 0.28;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) {
                this.ctx = new Ctx();
                this.master = this.ctx.createGain();
                this.master.gain.value = this.volume / 0.28;   // 0.28 = referencia (=1)
                this.master.connect(this.ctx.destination);
            }
        } catch (e) { console.error('AudioContext not supported'); }
    },
    setVolume(v) {
        this.volume = Math.max(0, Math.min(0.6, v));
        localStorage.setItem('lys_volume', String(this.volume));
        if (this.master) this.master.gain.value = this.volume / 0.28;
        if (this.audio) this.audio.volume = this.volume;
        this._baseVol = this.volume;
    },
    toggle() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        this.muted = !this.muted;
        localStorage.setItem('lys_muted', this.muted);
        if (this.audio) {
            if (this.muted) {
                this.audio.pause();
            } else {
                this.audio.play().catch(() => { });
            }
        }
        return this.muted;
    },
    playMusic(src) {
        if (!this.audio) {
            this.audio = new Audio(src);
            this.audio.loop = true;
            this.audio.volume = this.volume;
            this._track = src;
            this._baseVol = this.volume;
        }
        if (!this.muted) {
            this.audio.play().catch(() => { });
        }
    },
    // Cambia de pista con un fundido corto (música de combate <-> ambiente)
    crossfadeTo(src) {
        if (!this.audio || this.muted || this.volume <= 0 || this._track === src) return;
        this._track = src;
        const a = this.audio;
        const base = (this._baseVol != null ? this._baseVol : 0.28);
        if (this._fadeTimer) clearInterval(this._fadeTimer);
        let step = 0;
        this._fadeTimer = setInterval(() => {
            step++;
            if (step <= 6) a.volume = Math.max(0, base * (1 - step / 6));
            else if (step === 7) { try { a.src = src; a.play().catch(() => { }); } catch (e) { } }
            else if (step <= 13) a.volume = Math.min(base, base * ((step - 7) / 6));
            else { clearInterval(this._fadeTimer); this._fadeTimer = null; a.volume = base; }
        }, 45);
    },
    playTone(type) {
        if (this.muted || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.master || this.ctx.destination);

        const now = this.ctx.currentTime;

        if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'wood') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'metal') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(2000, now);
            osc.frequency.exponentialRampToValueAtTime(500, now + 0.2);
            gain.gain.setValueAtTime(0.03, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'fight') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.1);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'bad') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.3);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'water') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'herb') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(500, now);
            osc.frequency.exponentialRampToValueAtTime(700, now + 0.1);
            gain.gain.setValueAtTime(0.03, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'explore') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'build') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'heal') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.1);
            osc.frequency.linearRampToValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'levelup') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.1);
            osc.frequency.linearRampToValueAtTime(800, now + 0.2);
            osc.frequency.linearRampToValueAtTime(1200, now + 0.3);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
        } else if (type === 'block') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'event') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(900, now + 0.15);
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        }
    }
};

AudioSystem.init();
