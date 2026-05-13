window.Game = window.Game || {};

Game.Effects = {
    particles: [],
    damageNumbers: [],
    screenShake: { x: 0, y: 0, intensity: 0, timer: 0 },

    update: function(dt) {
        for (var i = this.particles.length - 1; i >= 0; i--) {
            var p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += (p.gravity || 0) * dt;
            p.alpha = Math.min(1, p.life / p.maxLife * 2);
            if (p.shrink) p.size *= (1 - dt * 2);
            if (p.rotation !== undefined) p.rotation += dt * 3;
        }

        for (var j = this.damageNumbers.length - 1; j >= 0; j--) {
            var d = this.damageNumbers[j];
            d.life -= dt;
            if (d.life <= 0) {
                this.damageNumbers.splice(j, 1);
                continue;
            }
            d.y -= 40 * dt;
            d.alpha = Math.min(1, d.life / d.maxLife * 2);
        }

        if (this.screenShake.timer > 0) {
            this.screenShake.timer -= dt;
            var t = this.screenShake.intensity * (this.screenShake.timer / 0.3);
            this.screenShake.x = (Math.random() - 0.5) * t;
            this.screenShake.y = (Math.random() - 0.5) * t;
        } else {
            this.screenShake.x = 0;
            this.screenShake.y = 0;
        }
    },

    draw: function(ctx) {
        for (var i = 0; i < this.particles.length; i++) {
            var p = this.particles[i];
            ctx.save();
            ctx.globalAlpha = p.alpha;
            if (p.type === 'circle') {
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
            } else if (p.type === 'spark') {
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
                ctx.stroke();
            } else if (p.type === 'leaf') {
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation || 0);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }
            ctx.restore();
        }

        for (var j = 0; j < this.damageNumbers.length; j++) {
            var d = this.damageNumbers[j];
            ctx.save();
            ctx.globalAlpha = d.alpha;
            ctx.font = (d.crit ? 'bold ' : '') + (d.crit ? '22' : '16') + 'px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#000';
            ctx.fillText(d.text, d.x + 1, d.y + 1);
            ctx.fillStyle = d.color;
            ctx.fillText(d.text, d.x, d.y);
            ctx.restore();
        }
    },

    shake: function(intensity) {
        this.screenShake.intensity = intensity || 8;
        this.screenShake.timer = 0.3;
    },

    spawnDamageNumber: function(x, y, amount, crit) {
        this.damageNumbers.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y,
            text: '-' + amount,
            color: crit ? '#ff4444' : '#fff',
            alpha: 1,
            life: 1.2,
            maxLife: 1.2,
            crit: crit
        });
    },

    spawnHealNumber: function(x, y, amount) {
        this.damageNumbers.push({
            x: x, y: y,
            text: '+' + amount,
            color: '#44ff44',
            alpha: 1, life: 1.2, maxLife: 1.2, crit: false
        });
    },

    burstFire: function(x, y, count) {
        for (var i = 0; i < (count || 20); i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 40 + Math.random() * 120;
            this.particles.push({
                type: 'circle',
                x: x + (Math.random() - 0.5) * 30,
                y: y + (Math.random() - 0.5) * 30,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 40,
                size: 3 + Math.random() * 6,
                color: ['#ff6633', '#ff9944', '#ffcc00', '#ff4400'][Math.floor(Math.random() * 4)],
                alpha: 1, life: 0.4 + Math.random() * 0.4, maxLife: 0.8,
                gravity: -60, shrink: true
            });
        }
    },

    burstWater: function(x, y, count) {
        for (var i = 0; i < (count || 20); i++) {
            var angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
            var speed = 60 + Math.random() * 100;
            this.particles.push({
                type: 'circle',
                x: x + (Math.random() - 0.5) * 20,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 5,
                color: ['#3399ff', '#66bbff', '#aaddff', '#2277dd'][Math.floor(Math.random() * 4)],
                alpha: 1, life: 0.5 + Math.random() * 0.5, maxLife: 1,
                gravity: 200, shrink: false
            });
        }
    },

    burstGrass: function(x, y, count) {
        for (var i = 0; i < (count || 15); i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 30 + Math.random() * 80;
            this.particles.push({
                type: 'leaf',
                x: x + (Math.random() - 0.5) * 40,
                y: y + (Math.random() - 0.5) * 40,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 4 + Math.random() * 6,
                color: ['#44bb44', '#66dd66', '#33882a', '#88ee44'][Math.floor(Math.random() * 4)],
                alpha: 1, life: 0.6 + Math.random() * 0.6, maxLife: 1.2,
                gravity: 30, rotation: Math.random() * Math.PI * 2
            });
        }
    },

    burstElectric: function(x, y, count) {
        for (var i = 0; i < (count || 18); i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 80 + Math.random() * 200;
            this.particles.push({
                type: 'spark',
                x: x + (Math.random() - 0.5) * 30,
                y: y + (Math.random() - 0.5) * 30,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3,
                color: ['#ffcc00', '#ffee44', '#ffffff', '#ffaa00'][Math.floor(Math.random() * 4)],
                alpha: 1, life: 0.2 + Math.random() * 0.3, maxLife: 0.5,
                gravity: 0
            });
        }
    },

    burstDark: function(x, y, count) {
        for (var i = 0; i < (count || 16); i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 20 + Math.random() * 60;
            this.particles.push({
                type: 'circle',
                x: x + (Math.random() - 0.5) * 40,
                y: y + (Math.random() - 0.5) * 40,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 5 + Math.random() * 8,
                color: ['#774488', '#553366', '#9966aa', '#442255'][Math.floor(Math.random() * 4)],
                alpha: 0.8, life: 0.6 + Math.random() * 0.6, maxLife: 1.2,
                gravity: -20, shrink: true
            });
        }
    },

    burstNormal: function(x, y, count) {
        for (var i = 0; i < (count || 12); i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 50 + Math.random() * 100;
            this.particles.push({
                type: 'circle',
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3 + Math.random() * 4,
                color: ['#ffffff', '#dddddd', '#cccccc', '#eeeeee'][Math.floor(Math.random() * 4)],
                alpha: 1, life: 0.3 + Math.random() * 0.3, maxLife: 0.6,
                gravity: 100, shrink: false
            });
        }
    },

    burstForType: function(type, x, y) {
        switch (type) {
            case 'fire': this.burstFire(x, y); break;
            case 'water': this.burstWater(x, y); break;
            case 'grass': this.burstGrass(x, y); break;
            case 'electric': this.burstElectric(x, y); break;
            case 'dark': this.burstDark(x, y); break;
            default: this.burstNormal(x, y); break;
        }
    },

    encounterFlash: function() {
        for (var i = 0; i < 30; i++) {
            this.particles.push({
                type: 'circle',
                x: 400, y: 304,
                vx: (Math.random() - 0.5) * 800,
                vy: (Math.random() - 0.5) * 600,
                size: 4 + Math.random() * 8,
                color: '#fff',
                alpha: 1, life: 0.3 + Math.random() * 0.3, maxLife: 0.6,
                gravity: 0, shrink: true
            });
        }
    },

    clear: function() {
        this.particles = [];
        this.damageNumbers = [];
        this.screenShake.timer = 0;
        this.screenShake.x = 0;
        this.screenShake.y = 0;
    }
};
