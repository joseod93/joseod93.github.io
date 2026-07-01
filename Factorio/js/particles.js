var Particles = {
    pool: [],
    active: [],

    init: function() {
        this.pool = [];
        this.active = [];
        for (var i = 0; i < CFG.MAX_PARTICLES; i++) {
            this.pool.push({x:0, y:0, vx:0, vy:0, life:0, maxLife:1, color:'#fff', size:2, type:'', text:'', alpha:1});
        }
    },

    spawn: function(wx, wy, type, itemType) {
        var count = 1;
        if (type === 'place') count = 5;
        if (type === 'smoke') count = 2;
        if (type === 'achievement') count = 20;

        // Una sola proyección + descarte si está fuera de pantalla
        // (achievement llega ya en coords de pantalla desde UI — siempre dentro)
        var screenPos = Camera.worldToScreen(wx, wy);
        if (type === 'achievement') screenPos = {x: wx, y: wy};
        if (screenPos.x < -60 || screenPos.x > window.innerWidth + 60 ||
            screenPos.y < -60 || screenPos.y > window.innerHeight + 60) return;

        for (var i = 0; i < count; i++) {
            if (this.pool.length === 0) return;
            var p = this.pool.pop();

            p.x = screenPos.x;
            p.y = screenPos.y;
            p.wx = wx;
            p.wy = wy;
            p.type = type;
            // 'achievement' es un estallido de UI fijo a pantalla; el resto se ancla al
            // mundo y se reproyecta cada frame para no despegarse al mover/zoom la cámara
            p.screen = (type === 'achievement');

            if (type === 'produce') {
                // Punto del color del item ascendiendo (menos ruido que "+1" a gran escala)
                p.vx = (Math.random() - 0.5) * 16;
                p.vy = -32 - Math.random() * 16;
                p.life = 0.8;
                p.maxLife = 0.8;
                p.color = Items.color(itemType) || '#fff';
                p.size = 2.6;
                p.text = '';
                p.alpha = 1;
            } else if (type === 'smoke') {
                p.vx = (Math.random() - 0.5) * 10;
                p.vy = -15 - Math.random() * 10;
                p.life = 1.5;
                p.maxLife = 1.5;
                p.color = '#888';
                p.size = 3 + Math.random() * 3;
                p.text = '';
                p.alpha = 0.5;
            } else if (type === 'place') {
                var angle = Math.random() * Math.PI * 2;
                var speed = 30 + Math.random() * 40;
                p.vx = Math.cos(angle) * speed;
                p.vy = Math.sin(angle) * speed;
                p.life = 0.3 + Math.random() * 0.2;
                p.maxLife = p.life;
                p.color = '#e6a832';
                p.size = 2 + Math.random() * 2;
                p.text = '';
                p.alpha = 1;
            } else if (type === 'ring') {
                p.vx = 0;
                p.vy = 0;
                p.life = 0.45;
                p.maxLife = 0.45;
                p.color = itemType || '#e6a832';
                p.size = 4;
                p.text = '';
                p.alpha = 0.9;
            } else if (type === 'spark') {
                p.vx = (Math.random() - 0.5) * 60;
                p.vy = -30 - Math.random() * 40;
                p.life = 0.25 + Math.random() * 0.25;
                p.maxLife = p.life;
                p.color = Math.random() < 0.5 ? '#ffcc44' : '#ff7722';
                p.size = 1 + Math.random() * 1.5;
                p.text = '';
                p.alpha = 1;
            } else if (type === 'achievement') {
                var angle2 = Math.random() * Math.PI * 2;
                var speed2 = 60 + Math.random() * 120;
                p.vx = Math.cos(angle2) * speed2;
                p.vy = Math.sin(angle2) * speed2 - 30;
                p.life = 1.2 + Math.random() * 0.5;
                p.maxLife = p.life;
                var colors = ['#ffd700','#ff6600','#ff3366','#44ddff','#44ff88'];
                p.color = colors[Math.floor(Math.random() * colors.length)];
                p.size = 2 + Math.random() * 3;
                p.text = '';
                p.alpha = 1;
            }

            this.active.push(p);
        }
    },

    update: function(dt) {
        for (var i = this.active.length - 1; i >= 0; i--) {
            var p = this.active[i];
            p.life -= dt;

            if (p.life <= 0) {
                this.active.splice(i, 1);
                this.pool.push(p);
                continue;
            }

            if (p.screen) {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
            } else {
                p.wx += p.vx * dt;
                p.wy += p.vy * dt;
            }

            if (p.type === 'smoke') {
                p.size += dt * 3;
                p.alpha = (p.life / p.maxLife) * 0.4;
            } else if (p.type === 'ring') {
                p.size += dt * 95;
                p.alpha = (p.life / p.maxLife) * 0.9;
            } else if (p.type === 'produce') {
                p.alpha = Math.min(1, p.life / p.maxLife * 2);
            } else {
                if (p.type === 'spark') p.vy += 150 * dt;
                p.alpha = p.life / p.maxLife;
            }
        }
    },

    render: function(ctx) {
        var zoom = Camera.zoom;
        for (var i = 0; i < this.active.length; i++) {
            var p = this.active[i];

            var sx, sy, scale;
            if (p.screen) {
                sx = p.x; sy = p.y; scale = 1;
            } else {
                var s = Camera.worldToScreen(p.wx, p.wy);
                sx = s.x; sy = s.y; scale = zoom;
            }

            ctx.globalAlpha = p.alpha;

            if (p.type === 'ring') {
                ctx.strokeStyle = p.color;
                ctx.lineWidth = Math.max(1, 2 * scale);
                ctx.beginPath();
                ctx.arc(sx, sy, Math.max(0.5, p.size * scale), 0, Math.PI * 2);
                ctx.stroke();
            } else if (p.text) {
                ctx.fillStyle = p.color;
                ctx.font = 'bold ' + Math.max(9, Math.round(12 * scale)) + 'px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(p.text, sx, sy);
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(sx, sy, Math.max(0.5, p.size * scale), 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }
};
