window.Game = window.Game || {};

Game.Sprites = {
    cache: {},

    getSprite: function(speciesId, w, h) {
        var key = speciesId + '_' + w + 'x' + h;
        if (this.cache[key]) return this.cache[key];
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        var img = Game.Assets ? Game.Assets.get(speciesId) : null;
        if (img) {
            ctx.drawImage(img, 0, 0, w, h);
        } else {
            var drawFn = this['draw_' + speciesId];
            if (drawFn) drawFn.call(this, ctx, w, h);
            else this.drawGeneric(ctx, w, h, Game.Species[speciesId]);
        }
        this.cache[key] = canvas;
        return canvas;
    },

    clearCache: function() { this.cache = {}; },

    px: function(ctx, x, y, w, h, color) {
        ctx.fillStyle = color;
        ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
    },

    drawEyes: function(ctx, x, y, size, sclera, pupil) {
        ctx.fillStyle = sclera;
        ctx.beginPath();
        ctx.ellipse(x, y, size * 0.5, size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pupil;
        ctx.beginPath();
        ctx.ellipse(x + size * 0.08, y + size * 0.05, size * 0.22, size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x - size * 0.1, y - size * 0.15, size * 0.12, 0, Math.PI * 2);
        ctx.fill();
    },

    drawFlame: function(ctx, x, y, w, h) {
        ctx.fillStyle = '#ff4400';
        ctx.beginPath();
        ctx.moveTo(x, y + h);
        ctx.quadraticCurveTo(x - w * 0.5, y + h * 0.3, x, y);
        ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.3, x, y + h);
        ctx.fill();
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.moveTo(x, y + h);
        ctx.quadraticCurveTo(x - w * 0.3, y + h * 0.5, x, y + h * 0.3);
        ctx.quadraticCurveTo(x + w * 0.3, y + h * 0.5, x, y + h);
        ctx.fill();
    },

    drawBubble: function(ctx, x, y, r) {
        ctx.strokeStyle = 'rgba(200,240,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
    },

    drawLeaf: function(ctx, x, y, size, angle) {
        ctx.save();
        ctx.translate(x, y); ctx.rotate(angle);
        ctx.fillStyle = '#44bb44';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-size * 0.4, -size * 0.6, 0, -size);
        ctx.quadraticCurveTo(size * 0.4, -size * 0.6, 0, 0);
        ctx.fill();
        ctx.strokeStyle = '#338833'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -size * 0.85); ctx.stroke();
        ctx.restore();
    },

    drawLightning: function(ctx, x, y, s) {
        ctx.fillStyle = '#ffee00';
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + s * 2, y); ctx.lineTo(x + s, y + s * 2);
        ctx.lineTo(x + s * 2.5, y + s * 2); ctx.lineTo(x - s * 0.5, y + s * 5);
        ctx.lineTo(x + s * 0.5, y + s * 2.5); ctx.lineTo(x - s * 0.5, y + s * 2.5);
        ctx.closePath(); ctx.fill();
    },

    // --- BASE SPECIES ---
    draw_flamander: function(ctx, w, h) {
        var s = w / 32;
        var grd = ctx.createRadialGradient(w / 2, h * 0.6, 2, w / 2, h * 0.6, w * 0.4);
        grd.addColorStop(0, '#ff9944'); grd.addColorStop(1, '#cc4411');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.55, w * 0.3, h * 0.32, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff6633';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.32, w * 0.22, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#cc4411';
        ctx.beginPath(); ctx.ellipse(w / 2 + w * 0.12, h * 0.3, w * 0.06, h * 0.08, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w / 2 - w * 0.12, h * 0.3, w * 0.06, h * 0.08, -0.3, 0, Math.PI * 2); ctx.fill();
        this.drawEyes(ctx, w * 0.38, h * 0.3, w * 0.08, '#fff', '#111');
        this.drawEyes(ctx, w * 0.55, h * 0.3, w * 0.08, '#fff', '#111');
        ctx.fillStyle = '#cc3300';
        ctx.beginPath(); ctx.arc(w * 0.45, h * 0.42, s * 1.2, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#ff6633';
        ctx.beginPath();
        ctx.moveTo(w * 0.65, h * 0.6); ctx.quadraticCurveTo(w * 0.9, h * 0.5, w * 0.85, h * 0.35);
        ctx.quadraticCurveTo(w * 0.82, h * 0.55, w * 0.7, h * 0.6); ctx.fill();
        this.drawFlame(ctx, w * 0.83, h * 0.28, s * 4, s * 6);
        ctx.fillStyle = '#cc4411';
        ctx.beginPath(); ctx.ellipse(w * 0.3, h * 0.75, w * 0.08, h * 0.1, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w * 0.7, h * 0.75, w * 0.08, h * 0.1, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffbb44';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.58, w * 0.18, h * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    },

    draw_aquarion: function(ctx, w, h) {
        var s = w / 32;
        ctx.fillStyle = '#2277aa';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.65, w * 0.35, h * 0.28, 0, 0, Math.PI * 2); ctx.fill();
        var grd = ctx.createRadialGradient(w / 2, h * 0.35, 2, w / 2, h * 0.35, w * 0.28);
        grd.addColorStop(0, '#66ccff'); grd.addColorStop(1, '#2288cc');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.38, w * 0.25, h * 0.24, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#aaeeff';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.62, w * 0.2, h * 0.14, 0, 0, Math.PI * 2); ctx.fill();
        this.drawEyes(ctx, w * 0.38, h * 0.34, w * 0.08, '#fff', '#224');
        this.drawEyes(ctx, w * 0.56, h * 0.34, w * 0.08, '#fff', '#224');
        ctx.fillStyle = '#1166aa';
        ctx.beginPath(); ctx.arc(w / 2, h * 0.46, s * 1.5, 0.1, Math.PI - 0.1); ctx.fill();
        ctx.fillStyle = '#2288cc';
        ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.55); ctx.quadraticCurveTo(w * 0.05, h * 0.45, w * 0.1, h * 0.35);
        ctx.quadraticCurveTo(w * 0.15, h * 0.45, w * 0.2, h * 0.55); ctx.fill();
        ctx.beginPath(); ctx.moveTo(w * 0.85, h * 0.55); ctx.quadraticCurveTo(w * 0.95, h * 0.45, w * 0.9, h * 0.35);
        ctx.quadraticCurveTo(w * 0.85, h * 0.45, w * 0.8, h * 0.55); ctx.fill();
        ctx.fillStyle = '#1166aa';
        ctx.beginPath();
        ctx.moveTo(w * 0.35, h * 0.16); ctx.lineTo(w * 0.45, h * 0.26); ctx.lineTo(w * 0.5, h * 0.18);
        ctx.lineTo(w * 0.55, h * 0.26); ctx.lineTo(w * 0.65, h * 0.16); ctx.lineTo(w * 0.6, h * 0.28);
        ctx.lineTo(w * 0.4, h * 0.28); ctx.closePath(); ctx.fill();
        this.drawBubble(ctx, w * 0.18, h * 0.25, s * 2);
        this.drawBubble(ctx, w * 0.8, h * 0.2, s * 1.5);
    },

    draw_thornleaf: function(ctx, w, h) {
        var s = w / 32;
        ctx.fillStyle = '#338833';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.62, w * 0.28, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        var grd = ctx.createRadialGradient(w / 2, h * 0.4, 2, w / 2, h * 0.4, w * 0.22);
        grd.addColorStop(0, '#66dd66'); grd.addColorStop(1, '#338833');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.4, w * 0.2, h * 0.18, 0, 0, Math.PI * 2); ctx.fill();
        this.drawLeaf(ctx, w * 0.5, h * 0.15, s * 5, -0.3);
        this.drawLeaf(ctx, w * 0.5, h * 0.15, s * 5, 0.3);
        this.drawLeaf(ctx, w * 0.5, h * 0.18, s * 4, 0);
        this.drawEyes(ctx, w * 0.4, h * 0.37, w * 0.07, '#fff', '#141');
        this.drawEyes(ctx, w * 0.56, h * 0.37, w * 0.07, '#fff', '#141');
        ctx.fillStyle = '#226622';
        ctx.beginPath(); ctx.arc(w / 2 - s, h * 0.48, s, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#998844';
        ctx.beginPath(); ctx.moveTo(w * 0.25, h * 0.8); ctx.lineTo(w * 0.2, h * 0.95); ctx.lineTo(w * 0.35, h * 0.85); ctx.fill();
        ctx.beginPath(); ctx.moveTo(w * 0.75, h * 0.8); ctx.lineTo(w * 0.8, h * 0.95); ctx.lineTo(w * 0.65, h * 0.85); ctx.fill();
        ctx.fillStyle = '#88cc44';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.6, w * 0.15, h * 0.12, 0, 0, Math.PI * 2); ctx.fill();
        for (var i = 0; i < 5; i++) {
            var tx = w * 0.22 + i * w * 0.14, ty = h * 0.68 + Math.sin(i * 1.5) * h * 0.04;
            ctx.fillStyle = '#557733';
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - s, ty + s * 2.5); ctx.lineTo(tx + s, ty + s * 2.5); ctx.closePath(); ctx.fill();
        }
    },

    draw_zappix: function(ctx, w, h) {
        var s = w / 32;
        var grd = ctx.createRadialGradient(w / 2, h * 0.5, 2, w / 2, h * 0.5, w * 0.35);
        grd.addColorStop(0, '#ffee44'); grd.addColorStop(1, '#ddaa00');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.55, w * 0.25, h * 0.28, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.35, w * 0.2, h * 0.18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ddaa00';
        ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.28); ctx.lineTo(w * 0.22, h * 0.08); ctx.lineTo(w * 0.38, h * 0.22); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(w * 0.7, h * 0.28); ctx.lineTo(w * 0.78, h * 0.08); ctx.lineTo(w * 0.62, h * 0.22); ctx.closePath(); ctx.fill();
        this.drawEyes(ctx, w * 0.38, h * 0.32, w * 0.08, '#fff', '#332');
        this.drawEyes(ctx, w * 0.55, h * 0.32, w * 0.08, '#fff', '#332');
        ctx.fillStyle = '#cc8800';
        ctx.beginPath(); ctx.arc(w / 2, h * 0.44, s * 1.2, 0.2, Math.PI - 0.2); ctx.fill();
        ctx.fillStyle = '#ff6600';
        ctx.beginPath(); ctx.arc(w * 0.35, h * 0.38, s * 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(w * 0.65, h * 0.38, s * 1.5, 0, Math.PI * 2); ctx.fill();
        this.drawLightning(ctx, w * 0.72, h * 0.52, s);
        this.drawLightning(ctx, w * 0.22, h * 0.5, s);
        ctx.fillStyle = '#ddaa00';
        ctx.beginPath(); ctx.moveTo(w * 0.55, h * 0.78); ctx.quadraticCurveTo(w * 0.7, h * 0.7, w * 0.85, h * 0.55);
        ctx.lineTo(w * 0.78, h * 0.6); ctx.lineTo(w * 0.92, h * 0.48);
        ctx.quadraticCurveTo(w * 0.72, h * 0.68, w * 0.58, h * 0.78); ctx.closePath(); ctx.fill();
    },

    draw_brawlox: function(ctx, w, h) {
        var s = w / 32;
        ctx.fillStyle = '#887766';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.6, w * 0.32, h * 0.32, 0, 0, Math.PI * 2); ctx.fill();
        var grd = ctx.createRadialGradient(w / 2, h * 0.35, 2, w / 2, h * 0.35, w * 0.24);
        grd.addColorStop(0, '#ccbbaa'); grd.addColorStop(1, '#887766');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.38, w * 0.22, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#776655';
        ctx.beginPath(); ctx.arc(w * 0.32, h * 0.22, s * 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(w * 0.68, h * 0.22, s * 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#665544';
        ctx.beginPath(); ctx.arc(w * 0.32, h * 0.22, s * 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(w * 0.68, h * 0.22, s * 1.2, 0, Math.PI * 2); ctx.fill();
        this.drawEyes(ctx, w * 0.38, h * 0.34, w * 0.07, '#fff', '#222');
        this.drawEyes(ctx, w * 0.56, h * 0.34, w * 0.07, '#fff', '#222');
        ctx.fillStyle = '#aa9988';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.44, w * 0.06, h * 0.03, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#665544';
        ctx.beginPath(); ctx.arc(w / 2, h * 0.5, s * 1.8, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#887766';
        ctx.beginPath(); ctx.ellipse(w * 0.2, h * 0.58, w * 0.1, h * 0.14, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w * 0.8, h * 0.58, w * 0.1, h * 0.14, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ccbbaa';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.62, w * 0.18, h * 0.14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#776655';
        ctx.beginPath(); ctx.ellipse(w * 0.35, h * 0.85, w * 0.1, h * 0.08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w * 0.65, h * 0.85, w * 0.1, h * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    },

    draw_shadewisp: function(ctx, w, h) {
        var s = w / 32;
        for (var i = 3; i > 0; i--) {
            ctx.fillStyle = 'rgba(100,50,130,' + (0.15 * i) + ')';
            ctx.beginPath(); ctx.ellipse(w / 2, h * 0.6, w * (0.25 + i * 0.06), h * (0.22 + i * 0.04), 0, 0, Math.PI * 2); ctx.fill();
        }
        var grd = ctx.createRadialGradient(w / 2, h * 0.45, 2, w / 2, h * 0.45, w * 0.3);
        grd.addColorStop(0, '#aa77cc'); grd.addColorStop(0.6, '#774488'); grd.addColorStop(1, '#442255');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.45, w * 0.25, h * 0.28, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#553366';
        ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.7); ctx.quadraticCurveTo(w * 0.25, h * 0.9, w * 0.2, h * 0.95);
        ctx.quadraticCurveTo(w * 0.35, h * 0.8, w * 0.4, h * 0.7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(w * 0.7, h * 0.7); ctx.quadraticCurveTo(w * 0.75, h * 0.9, w * 0.8, h * 0.95);
        ctx.quadraticCurveTo(w * 0.65, h * 0.8, w * 0.6, h * 0.7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.72); ctx.quadraticCurveTo(w * 0.5, h * 0.88, w * 0.5, h * 0.98);
        ctx.quadraticCurveTo(w * 0.55, h * 0.85, w * 0.55, h * 0.72); ctx.fill();
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath(); ctx.ellipse(w * 0.38, h * 0.4, w * 0.06, h * 0.05, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w * 0.62, h * 0.4, w * 0.06, h * 0.05, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.ellipse(w * 0.39, h * 0.4, w * 0.025, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w * 0.61, h * 0.4, w * 0.025, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#9966aa';
        ctx.beginPath(); ctx.arc(w / 2, h * 0.54, s * 1.2, 0.2, Math.PI - 0.2); ctx.fill();
        ctx.fillStyle = 'rgba(200,150,255,0.25)';
        ctx.beginPath(); ctx.arc(w * 0.42, h * 0.34, s * 1.2, 0, Math.PI * 2); ctx.fill();
    },

    // --- EVOLVED SPECIES ---
    draw_infernox: function(ctx, w, h) {
        var s = w / 32;
        ctx.fillStyle = '#991100';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.58, w * 0.35, h * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        var grd = ctx.createRadialGradient(w / 2, h * 0.35, 2, w / 2, h * 0.35, w * 0.28);
        grd.addColorStop(0, '#ff6633'); grd.addColorStop(1, '#aa2200');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.35, w * 0.25, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#cc3300';
        ctx.beginPath();
        ctx.moveTo(w * 0.3, h * 0.2); ctx.lineTo(w * 0.25, h * 0.05); ctx.lineTo(w * 0.38, h * 0.18); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(w * 0.7, h * 0.2); ctx.lineTo(w * 0.75, h * 0.05); ctx.lineTo(w * 0.62, h * 0.18); ctx.fill();
        this.drawEyes(ctx, w * 0.37, h * 0.32, w * 0.09, '#fff', '#400');
        this.drawEyes(ctx, w * 0.57, h * 0.32, w * 0.09, '#fff', '#400');
        ctx.fillStyle = '#880000';
        ctx.beginPath(); ctx.arc(w * 0.47, h * 0.44, s * 1.5, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.58, w * 0.2, h * 0.18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#cc3300';
        ctx.beginPath();
        ctx.moveTo(w * 0.65, h * 0.55); ctx.quadraticCurveTo(w * 0.95, h * 0.45, w * 0.9, h * 0.25);
        ctx.quadraticCurveTo(w * 0.88, h * 0.5, w * 0.72, h * 0.58); ctx.fill();
        this.drawFlame(ctx, w * 0.88, h * 0.15, s * 6, s * 9);
        this.drawFlame(ctx, w * 0.15, h * 0.6, s * 3, s * 5);
        ctx.fillStyle = '#991100';
        ctx.beginPath(); ctx.ellipse(w * 0.28, h * 0.8, w * 0.1, h * 0.12, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w * 0.72, h * 0.8, w * 0.1, h * 0.12, 0.2, 0, Math.PI * 2); ctx.fill();
    },

    draw_tidalore: function(ctx, w, h) {
        var s = w / 32;
        ctx.fillStyle = '#0d5588';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.6, w * 0.38, h * 0.32, 0, 0, Math.PI * 2); ctx.fill();
        var grd = ctx.createRadialGradient(w / 2, h * 0.35, 2, w / 2, h * 0.35, w * 0.3);
        grd.addColorStop(0, '#55bbee'); grd.addColorStop(1, '#1177aa');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.38, w * 0.28, h * 0.26, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#88ddff';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.6, w * 0.22, h * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0d5588';
        ctx.beginPath();
        ctx.moveTo(w * 0.3, h * 0.12); ctx.lineTo(w * 0.4, h * 0.25); ctx.lineTo(w * 0.45, h * 0.14);
        ctx.lineTo(w * 0.5, h * 0.22); ctx.lineTo(w * 0.55, h * 0.14);
        ctx.lineTo(w * 0.6, h * 0.25); ctx.lineTo(w * 0.7, h * 0.12);
        ctx.lineTo(w * 0.65, h * 0.28); ctx.lineTo(w * 0.35, h * 0.28); ctx.closePath(); ctx.fill();
        this.drawEyes(ctx, w * 0.36, h * 0.34, w * 0.09, '#fff', '#124');
        this.drawEyes(ctx, w * 0.58, h * 0.34, w * 0.09, '#fff', '#124');
        ctx.fillStyle = '#0d5588';
        ctx.beginPath(); ctx.arc(w / 2, h * 0.48, s * 2, 0.1, Math.PI - 0.1); ctx.fill();
        ctx.fillStyle = '#1177aa';
        ctx.beginPath();
        ctx.moveTo(w * 0.1, h * 0.5); ctx.quadraticCurveTo(w * 0.02, h * 0.38, w * 0.08, h * 0.25);
        ctx.quadraticCurveTo(w * 0.12, h * 0.4, w * 0.18, h * 0.52); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(w * 0.9, h * 0.5); ctx.quadraticCurveTo(w * 0.98, h * 0.38, w * 0.92, h * 0.25);
        ctx.quadraticCurveTo(w * 0.88, h * 0.4, w * 0.82, h * 0.52); ctx.fill();
        this.drawBubble(ctx, w * 0.15, h * 0.18, s * 2.5);
        this.drawBubble(ctx, w * 0.85, h * 0.15, s * 2);
        this.drawBubble(ctx, w * 0.8, h * 0.28, s * 1.5);
    },

    draw_canopex: function(ctx, w, h) {
        var s = w / 32;
        ctx.fillStyle = '#226622';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.6, w * 0.32, h * 0.33, 0, 0, Math.PI * 2); ctx.fill();
        var grd = ctx.createRadialGradient(w / 2, h * 0.38, 2, w / 2, h * 0.38, w * 0.25);
        grd.addColorStop(0, '#55cc55'); grd.addColorStop(1, '#226622');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.38, w * 0.23, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
        this.drawLeaf(ctx, w * 0.5, h * 0.1, s * 7, -0.4);
        this.drawLeaf(ctx, w * 0.5, h * 0.1, s * 7, 0.4);
        this.drawLeaf(ctx, w * 0.5, h * 0.12, s * 6, -0.15);
        this.drawLeaf(ctx, w * 0.5, h * 0.12, s * 6, 0.15);
        this.drawLeaf(ctx, w * 0.5, h * 0.14, s * 5, 0);
        this.drawEyes(ctx, w * 0.38, h * 0.35, w * 0.08, '#fff', '#131');
        this.drawEyes(ctx, w * 0.58, h * 0.35, w * 0.08, '#fff', '#131');
        ctx.fillStyle = '#1a5c1a';
        ctx.beginPath(); ctx.arc(w / 2, h * 0.48, s * 1.5, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#66aa33';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.6, w * 0.18, h * 0.14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#886633';
        ctx.beginPath(); ctx.ellipse(w * 0.22, h * 0.82, w * 0.1, h * 0.1, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w * 0.78, h * 0.82, w * 0.1, h * 0.1, 0.3, 0, Math.PI * 2); ctx.fill();
        for (var i = 0; i < 7; i++) {
            var tx = w * 0.18 + i * w * 0.1, ty = h * 0.7 + Math.sin(i * 1.3) * h * 0.03;
            ctx.fillStyle = '#447722';
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - s * 1.2, ty + s * 3); ctx.lineTo(tx + s * 1.2, ty + s * 3); ctx.closePath(); ctx.fill();
        }
    },

    draw_voltarion: function(ctx, w, h) {
        var s = w / 32;
        var grd = ctx.createRadialGradient(w / 2, h * 0.5, 2, w / 2, h * 0.5, w * 0.38);
        grd.addColorStop(0, '#ffdd22'); grd.addColorStop(1, '#cc8800');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.52, w * 0.3, h * 0.32, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ddaa00';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.32, w * 0.24, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#cc8800';
        ctx.beginPath(); ctx.moveTo(w * 0.28, h * 0.25); ctx.lineTo(w * 0.18, h * 0.02); ctx.lineTo(w * 0.36, h * 0.2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(w * 0.72, h * 0.25); ctx.lineTo(w * 0.82, h * 0.02); ctx.lineTo(w * 0.64, h * 0.2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.2); ctx.lineTo(w * 0.5, h * 0.0); ctx.lineTo(w * 0.55, h * 0.18); ctx.closePath(); ctx.fill();
        this.drawEyes(ctx, w * 0.36, h * 0.3, w * 0.09, '#fff', '#330');
        this.drawEyes(ctx, w * 0.58, h * 0.3, w * 0.09, '#fff', '#330');
        ctx.fillStyle = '#aa7700';
        ctx.beginPath(); ctx.arc(w / 2, h * 0.42, s * 1.5, 0.2, Math.PI - 0.2); ctx.fill();
        ctx.fillStyle = '#ff5500';
        ctx.beginPath(); ctx.arc(w * 0.32, h * 0.35, s * 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(w * 0.68, h * 0.35, s * 2, 0, Math.PI * 2); ctx.fill();
        this.drawLightning(ctx, w * 0.75, h * 0.48, s * 1.3);
        this.drawLightning(ctx, w * 0.15, h * 0.46, s * 1.3);
        this.drawLightning(ctx, w * 0.5, h * 0.7, s * 1);
        ctx.fillStyle = '#cc8800';
        ctx.beginPath(); ctx.moveTo(w * 0.52, h * 0.78); ctx.quadraticCurveTo(w * 0.72, h * 0.68, w * 0.88, h * 0.5);
        ctx.lineTo(w * 0.82, h * 0.55); ctx.lineTo(w * 0.95, h * 0.42);
        ctx.quadraticCurveTo(w * 0.75, h * 0.65, w * 0.56, h * 0.78); ctx.closePath(); ctx.fill();
    },

    draw_titanox: function(ctx, w, h) {
        var s = w / 32;
        ctx.fillStyle = '#665544';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.58, w * 0.38, h * 0.36, 0, 0, Math.PI * 2); ctx.fill();
        var grd = ctx.createRadialGradient(w / 2, h * 0.32, 2, w / 2, h * 0.32, w * 0.28);
        grd.addColorStop(0, '#bbaa99'); grd.addColorStop(1, '#776655');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.34, w * 0.26, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#665544';
        ctx.beginPath(); ctx.arc(w * 0.28, h * 0.18, s * 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(w * 0.72, h * 0.18, s * 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#554433';
        ctx.beginPath(); ctx.arc(w * 0.28, h * 0.18, s * 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(w * 0.72, h * 0.18, s * 1.5, 0, Math.PI * 2); ctx.fill();
        this.drawEyes(ctx, w * 0.38, h * 0.3, w * 0.08, '#fff', '#211');
        this.drawEyes(ctx, w * 0.58, h * 0.3, w * 0.08, '#fff', '#211');
        ctx.fillStyle = '#554433';
        ctx.beginPath(); ctx.arc(w / 2, h * 0.48, s * 2.5, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#998877';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.6, w * 0.22, h * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#776655';
        ctx.beginPath(); ctx.ellipse(w * 0.15, h * 0.52, w * 0.12, h * 0.16, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w * 0.85, h * 0.52, w * 0.12, h * 0.16, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#bbaa88';
        ctx.fillRect(w * 0.08, h * 0.56, w * 0.08, h * 0.04);
        ctx.fillRect(w * 0.84, h * 0.56, w * 0.08, h * 0.04);
        ctx.fillStyle = '#665544';
        ctx.beginPath(); ctx.ellipse(w * 0.32, h * 0.88, w * 0.12, h * 0.08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w * 0.68, h * 0.88, w * 0.12, h * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    },

    draw_phantara: function(ctx, w, h) {
        var s = w / 32;
        for (var i = 4; i > 0; i--) {
            ctx.fillStyle = 'rgba(80,30,110,' + (0.12 * i) + ')';
            ctx.beginPath(); ctx.ellipse(w / 2, h * 0.55, w * (0.28 + i * 0.07), h * (0.24 + i * 0.05), 0, 0, Math.PI * 2); ctx.fill();
        }
        var grd = ctx.createRadialGradient(w / 2, h * 0.42, 2, w / 2, h * 0.42, w * 0.32);
        grd.addColorStop(0, '#9955cc'); grd.addColorStop(0.5, '#663399'); grd.addColorStop(1, '#331155');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.42, w * 0.28, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#442266';
        var tails = [
            [0.25, 0.7, 0.18, 0.92, 0.12, 0.98, 0.3, 0.82, 0.35, 0.68],
            [0.75, 0.7, 0.82, 0.92, 0.88, 0.98, 0.7, 0.82, 0.65, 0.68],
            [0.5, 0.72, 0.48, 0.9, 0.5, 1.0, 0.55, 0.88, 0.53, 0.7],
            [0.38, 0.7, 0.32, 0.88, 0.28, 0.95, 0.38, 0.8, 0.42, 0.68],
            [0.62, 0.7, 0.68, 0.88, 0.72, 0.95, 0.62, 0.8, 0.58, 0.68]
        ];
        for (var t = 0; t < tails.length; t++) {
            var p = tails[t];
            ctx.beginPath();
            ctx.moveTo(w * p[0], h * p[1]);
            ctx.quadraticCurveTo(w * p[2], h * p[3], w * p[4], h * p[5]);
            ctx.quadraticCurveTo(w * p[6], h * p[7], w * p[8], h * p[9]);
            ctx.fill();
        }
        ctx.fillStyle = '#ff2200';
        ctx.beginPath(); ctx.ellipse(w * 0.35, h * 0.38, w * 0.07, h * 0.06, -0.15, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w * 0.65, h * 0.38, w * 0.07, h * 0.06, 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.ellipse(w * 0.36, h * 0.38, w * 0.03, h * 0.04, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w * 0.64, h * 0.38, w * 0.03, h * 0.04, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7744aa';
        ctx.beginPath(); ctx.arc(w / 2, h * 0.52, s * 1.8, 0.2, Math.PI - 0.2); ctx.fill();
        ctx.fillStyle = 'rgba(180,100,255,0.2)';
        ctx.beginPath(); ctx.arc(w * 0.4, h * 0.3, s * 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(w * 0.62, h * 0.28, s * 1, 0, Math.PI * 2); ctx.fill();
    },

    drawGeneric: function(ctx, w, h, species) {
        ctx.fillStyle = species.color;
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.55, w * 0.3, h * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        this.drawEyes(ctx, w * 0.38, h * 0.4, w * 0.08, '#fff', '#111');
        this.drawEyes(ctx, w * 0.58, h * 0.4, w * 0.08, '#fff', '#111');
    }
};
