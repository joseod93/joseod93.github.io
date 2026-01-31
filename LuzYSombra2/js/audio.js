
export const AudioSystem = {
    audio: null,
    muted: false,
    ctx: null,
    init() {
        this.muted = localStorage.getItem('lys_muted') === 'true';
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) this.ctx = new Ctx();
        } catch (e) { console.error('AudioContext not supported'); }
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
    playMusic(src, vol = 0.28) {
        if (!this.audio) {
            this.audio = new Audio(src);
            this.audio.loop = true;
            this.audio.volume = vol;
        }
        if (!this.muted) {
            this.audio.play().catch(() => { });
        }
    },
    playTone(type) {
        if (this.muted || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

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
        }
    }
};

AudioSystem.init();
