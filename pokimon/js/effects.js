window.Game = window.Game || {};

Game.Effects = {
    particles: [],
    damageNumbers: [],
    screenShake: { x: 0, y: 0, intensity: 0, timer: 0 },
    flashes: [],

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
            if (p.drag) {
                p.vx *= (1 - p.drag * dt);
                p.vy *= (1 - p.drag * dt);
            }
            p.alpha = Math.min(1, p.life / p.maxLife * 2);
            if (p.shrink) p.size *= (1 - dt * 2);
            if (p.rotation !== undefined) p.rotation += dt * (p.rotSpeed || 3);
            if (p.pulse) p.size += Math.sin(p.life * 15) * dt * 3;
        }

        for (var j = this.damageNumbers.length - 1; j >= 0; j--) {
            var d = this.damageNumbers[j];
            d.life -= dt;
            if (d.life <= 0) {
                this.damageNumbers.splice(j, 1);
                continue;
            }
            d.y -= 50 * dt;
            d.scale = d.life > d.maxLife * 0.8 ? 1 + (1 - d.life / d.maxLife) * 3 : 1;
            d.alpha = Math.min(1, d.life / d.maxLife * 2.5);
        }

        for (var f = this.flashes.length - 1; f >= 0; f--) {
            this.flashes[f].life -= dt;
            if (this.flashes[f].life <= 0) this.flashes.splice(f, 1);
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
        for (var f = 0; f < this.flashes.length; f++) {
            var fl = this.flashes[f];
            ctx.save();
            ctx.globalAlpha = fl.life / fl.maxLife * 0.4;
            ctx.fillStyle = fl.color;
            ctx.beginPath();
            ctx.arc(fl.x, fl.y, fl.radius * (1 - fl.life / fl.maxLife) + 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        for (var i = 0; i < this.particles.length; i++) {
            var p = this.particles[i];
            ctx.save();
            ctx.globalAlpha = p.alpha;
            if (p.type === 'circle') {
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
                if (p.glow) {
                    ctx.globalAlpha = p.alpha * 0.3;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = p.color;
                    ctx.fill();
                }
            } else if (p.type === 'spark') {
                ctx.strokeStyle = p.color;
                ctx.lineWidth = p.lineWidth || 2;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
                ctx.stroke();
            } else if (p.type === 'leaf') {
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation || 0);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(-p.size * 0.8, 0);
                ctx.lineTo(p.size * 0.8, 0);
                ctx.stroke();
            } else if (p.type === 'ring') {
                ctx.strokeStyle = p.color;
                ctx.lineWidth = p.lineWidth || 2;
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(1, p.size), 0, Math.PI * 2);
                ctx.stroke();
            } else if (p.type === 'star') {
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation || 0);
                ctx.fillStyle = p.color;
                this.drawStar(ctx, 0, 0, 5, p.size, p.size * 0.4);
            } else if (p.type === 'smoke') {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
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
            var fontSize = d.crit ? 24 : 18;
            ctx.font = (d.crit ? 'bold ' : '') + fontSize + 'px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#000';
            ctx.fillText(d.text, d.x + 2, d.y + 2);
            ctx.fillStyle = d.color;
            ctx.fillText(d.text, d.x, d.y);
            if (d.crit) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.strokeText(d.text, d.x, d.y);
            }
            ctx.restore();
        }
    },

    drawStar: function(ctx, cx, cy, spikes, outerR, innerR) {
        var rot = Math.PI / 2 * 3;
        var step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerR);
        for (var i = 0; i < spikes; i++) {
            ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
            rot += step;
            ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
            rot += step;
        }
        ctx.closePath();
        ctx.fill();
    },

    shake: function(intensity) {
        this.screenShake.intensity = intensity || 8;
        this.screenShake.timer = 0.3;
    },

    impactFlash: function(x, y, color, radius) {
        this.flashes.push({ x: x, y: y, color: color || '#fff', radius: radius || 60, life: 0.2, maxLife: 0.2 });
    },

    spawnDamageNumber: function(x, y, amount, crit) {
        this.damageNumbers.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y,
            text: '-' + amount,
            color: crit ? '#ff2222' : '#fff',
            alpha: 1,
            life: 1.4,
            maxLife: 1.4,
            crit: crit,
            scale: 1
        });
    },

    spawnHealNumber: function(x, y, amount) {
        this.damageNumbers.push({
            x: x, y: y,
            text: '+' + amount,
            color: '#44ff44',
            alpha: 1, life: 1.2, maxLife: 1.2, crit: false, scale: 1
        });
    },

    burstFire: function(x, y, count) {
        count = count || 25;
        this.impactFlash(x, y, '#ff6633', 80);
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 50 + Math.random() * 150;
            this.particles.push({
                type: 'circle',
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 60,
                size: 3 + Math.random() * 7,
                color: ['#ff6633', '#ff9944', '#ffcc00', '#ff4400', '#ffee66'][Math.floor(Math.random() * 5)],
                alpha: 1, life: 0.4 + Math.random() * 0.5, maxLife: 0.9,
                gravity: -80, shrink: true, glow: Math.random() > 0.5
            });
        }
        for (var s = 0; s < 5; s++) {
            this.particles.push({
                type: 'smoke',
                x: x + (Math.random() - 0.5) * 30,
                y: y + (Math.random() - 0.5) * 30,
                vx: (Math.random() - 0.5) * 30,
                vy: -30 - Math.random() * 40,
                size: 8 + Math.random() * 12,
                color: 'rgba(80,40,20,0.4)',
                alpha: 0.5, life: 0.8 + Math.random() * 0.5, maxLife: 1.3,
                gravity: -20, drag: 1
            });
        }
    },

    burstWater: function(x, y, count) {
        count = count || 25;
        this.impactFlash(x, y, '#3399ff', 70);
        for (var i = 0; i < count; i++) {
            var angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
            var speed = 60 + Math.random() * 120;
            this.particles.push({
                type: 'circle',
                x: x + (Math.random() - 0.5) * 20,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 5,
                color: ['#3399ff', '#66bbff', '#aaddff', '#2277dd', '#44ccff'][Math.floor(Math.random() * 5)],
                alpha: 1, life: 0.5 + Math.random() * 0.6, maxLife: 1.1,
                gravity: 250, shrink: false
            });
        }
        for (var r = 0; r < 3; r++) {
            this.particles.push({
                type: 'ring',
                x: x, y: y,
                vx: 0, vy: 0,
                size: 5 + r * 8,
                color: 'rgba(100,200,255,0.5)',
                alpha: 0.6, life: 0.3 + r * 0.1, maxLife: 0.5,
                gravity: 0, shrink: false, lineWidth: 2,
                pulse: true
            });
        }
    },

    burstGrass: function(x, y, count) {
        count = count || 20;
        this.impactFlash(x, y, '#44bb44', 60);
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 30 + Math.random() * 90;
            this.particles.push({
                type: 'leaf',
                x: x + (Math.random() - 0.5) * 40,
                y: y + (Math.random() - 0.5) * 40,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 4 + Math.random() * 7,
                color: ['#44bb44', '#66dd66', '#33882a', '#88ee44', '#22aa22'][Math.floor(Math.random() * 5)],
                alpha: 1, life: 0.7 + Math.random() * 0.7, maxLife: 1.4,
                gravity: 40, rotation: Math.random() * Math.PI * 2,
                rotSpeed: 2 + Math.random() * 4
            });
        }
        for (var v = 0; v < 4; v++) {
            this.particles.push({
                type: 'circle',
                x: x + (Math.random() - 0.5) * 30,
                y: y + 10,
                vx: (Math.random() - 0.5) * 40,
                vy: -20 - Math.random() * 30,
                size: 3 + Math.random() * 4,
                color: '#88ee44',
                alpha: 0.6, life: 0.5, maxLife: 0.5,
                gravity: 0, shrink: true, glow: true
            });
        }
    },

    burstElectric: function(x, y, count) {
        count = count || 22;
        this.impactFlash(x, y, '#ffee00', 90);
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 100 + Math.random() * 250;
            this.particles.push({
                type: 'spark',
                x: x + (Math.random() - 0.5) * 30,
                y: y + (Math.random() - 0.5) * 30,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3,
                color: ['#ffcc00', '#ffee44', '#ffffff', '#ffaa00', '#ffffaa'][Math.floor(Math.random() * 5)],
                alpha: 1, life: 0.2 + Math.random() * 0.3, maxLife: 0.5,
                gravity: 0, lineWidth: 1 + Math.random() * 2
            });
        }
        for (var s = 0; s < 4; s++) {
            this.particles.push({
                type: 'star',
                x: x + (Math.random() - 0.5) * 50,
                y: y + (Math.random() - 0.5) * 50,
                vx: (Math.random() - 0.5) * 60,
                vy: (Math.random() - 0.5) * 60,
                size: 4 + Math.random() * 6,
                color: '#ffee44',
                alpha: 1, life: 0.3 + Math.random() * 0.2, maxLife: 0.5,
                gravity: 0, rotation: Math.random() * Math.PI,
                rotSpeed: 5 + Math.random() * 5
            });
        }
    },

    burstDark: function(x, y, count) {
        count = count || 20;
        this.impactFlash(x, y, '#442255', 70);
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 20 + Math.random() * 70;
            this.particles.push({
                type: 'circle',
                x: x + (Math.random() - 0.5) * 40,
                y: y + (Math.random() - 0.5) * 40,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 5 + Math.random() * 10,
                color: ['#774488', '#553366', '#9966aa', '#442255', '#331144'][Math.floor(Math.random() * 5)],
                alpha: 0.8, life: 0.7 + Math.random() * 0.7, maxLife: 1.4,
                gravity: -30, shrink: true, drag: 0.5
            });
        }
        for (var r = 0; r < 2; r++) {
            this.particles.push({
                type: 'ring',
                x: x, y: y,
                vx: 0, vy: 0,
                size: 10 + r * 15,
                color: 'rgba(150,100,200,0.4)',
                alpha: 0.5, life: 0.4, maxLife: 0.4,
                gravity: 0, lineWidth: 3,
                pulse: true
            });
        }
    },

    burstNormal: function(x, y, count) {
        count = count || 15;
        this.impactFlash(x, y, '#ffffff', 50);
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 60 + Math.random() * 120;
            this.particles.push({
                type: 'circle',
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3 + Math.random() * 5,
                color: ['#ffffff', '#dddddd', '#cccccc', '#eeeeee'][Math.floor(Math.random() * 4)],
                alpha: 1, life: 0.3 + Math.random() * 0.4, maxLife: 0.7,
                gravity: 120, shrink: false
            });
        }
        for (var s = 0; s < 3; s++) {
            this.particles.push({
                type: 'star',
                x: x + (Math.random() - 0.5) * 30,
                y: y + (Math.random() - 0.5) * 30,
                vx: (Math.random() - 0.5) * 80,
                vy: -40 - Math.random() * 60,
                size: 3 + Math.random() * 4,
                color: '#fff',
                alpha: 1, life: 0.4, maxLife: 0.4,
                gravity: 100, rotation: Math.random() * Math.PI,
                rotSpeed: 4
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
        for (var i = 0; i < 40; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 200 + Math.random() * 400;
            this.particles.push({
                type: Math.random() > 0.5 ? 'circle' : 'star',
                x: 400, y: 304,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3 + Math.random() * 8,
                color: '#fff',
                alpha: 1, life: 0.3 + Math.random() * 0.3, maxLife: 0.6,
                gravity: 0, shrink: true,
                rotation: Math.random() * Math.PI, rotSpeed: 5
            });
        }
    },

    clear: function() {
        this.particles = [];
        this.damageNumbers = [];
        this.flashes = [];
        this.screenShake.timer = 0;
        this.screenShake.x = 0;
        this.screenShake.y = 0;
    }
};
