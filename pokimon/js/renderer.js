window.Game = window.Game || {};

Game.Renderer = {
    canvas: null,
    ctx: null,

    init: function(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
    },

    clear: function(color) {
        this.ctx.fillStyle = color || '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    },

    drawRect: function(x, y, w, h, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
    },

    drawRectOutline: function(x, y, w, h, color, lineWidth) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth || 2;
        this.ctx.strokeRect(Math.floor(x), Math.floor(y), w, h);
    },

    drawText: function(text, x, y, options) {
        options = options || {};
        var size = options.size || 12;
        var color = options.color || '#fff';
        var align = options.align || 'left';
        var shadow = options.shadow !== false;

        this.ctx.font = size + 'px "Press Start 2P", monospace';
        this.ctx.textAlign = align;
        this.ctx.textBaseline = options.baseline || 'top';

        if (shadow) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillText(text, Math.floor(x) + 1, Math.floor(y) + 1);
        }
        this.ctx.fillStyle = color;
        this.ctx.fillText(text, Math.floor(x), Math.floor(y));
    },

    drawHPBar: function(x, y, width, current, max) {
        var ctx = this.ctx;
        var ratio = max > 0 ? current / max : 0;
        var barH = 12;
        var fx = Math.floor(x), fy = Math.floor(y);

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(fx, fy, width, barH, 4);
        ctx.fillStyle = '#222';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (ratio > 0) {
            var barW = Math.floor((width - 2) * ratio);
            var grd;
            if (ratio > 0.5) {
                grd = ctx.createLinearGradient(fx, fy, fx, fy + barH);
                grd.addColorStop(0, '#66ee66');
                grd.addColorStop(1, '#33aa33');
            } else if (ratio > 0.2) {
                grd = ctx.createLinearGradient(fx, fy, fx, fy + barH);
                grd.addColorStop(0, '#eecc33');
                grd.addColorStop(1, '#bb9900');
            } else {
                grd = ctx.createLinearGradient(fx, fy, fx, fy + barH);
                grd.addColorStop(0, '#ee4444');
                grd.addColorStop(1, '#aa2222');
            }
            ctx.beginPath();
            ctx.roundRect(fx + 1, fy + 1, barW, barH - 2, 3);
            ctx.fillStyle = grd;
            ctx.fill();
        }
        ctx.restore();
    },

    drawXPBar: function(x, y, width, current, max) {
        var ctx = this.ctx;
        var ratio = max > 0 ? Math.min(current / max, 1) : 0;
        var barH = 7;
        var fx = Math.floor(x), fy = Math.floor(y);

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(fx, fy, width, barH, 3);
        ctx.fillStyle = '#181830';
        ctx.fill();

        if (ratio > 0) {
            var grd = ctx.createLinearGradient(fx, fy, fx, fy + barH);
            grd.addColorStop(0, '#66aaff');
            grd.addColorStop(1, '#3366cc');
            ctx.beginPath();
            ctx.roundRect(fx + 1, fy + 1, Math.floor((width - 2) * ratio), barH - 2, 2);
            ctx.fillStyle = grd;
            ctx.fill();
        }
        ctx.restore();
    },

    drawPanel: function(x, y, w, h, bgColor) {
        var ctx = this.ctx;
        var fx = Math.floor(x), fy = Math.floor(y);

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(fx, fy, w, h, 8);
        var grd = ctx.createLinearGradient(fx, fy, fx, fy + h);
        grd.addColorStop(0, bgColor || 'rgba(25,25,55,0.94)');
        grd.addColorStop(1, bgColor ? bgColor : 'rgba(15,15,35,0.96)');
        ctx.fillStyle = grd;
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(fx + 2, fy + 2, w - 4, h - 4, 6);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.roundRect(fx + 1, fy + 1, w - 2, h * 0.4, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fill();

        ctx.restore();
    },

    drawMonsterSprite: function(x, y, species, options) {
        options = options || {};
        var w = options.width || 96;
        var h = options.height || 96;
        var alpha = options.alpha !== undefined ? options.alpha : 1;
        var flash = options.flash || false;

        this.ctx.save();
        this.ctx.globalAlpha = alpha;

        var sprite = Game.Sprites.getSprite(species.id, w, h);

        if (flash) {
            var tmp = document.createElement('canvas');
            tmp.width = w;
            tmp.height = h;
            var tc = tmp.getContext('2d');
            tc.drawImage(sprite, 0, 0);
            tc.globalCompositeOperation = 'source-atop';
            tc.fillStyle = 'rgba(255,255,255,0.75)';
            tc.fillRect(0, 0, w, h);
            this.ctx.drawImage(tmp, Math.floor(x), Math.floor(y));
        } else {
            this.ctx.drawImage(sprite, Math.floor(x), Math.floor(y));
        }

        this.ctx.restore();
    },

    fadeOverlay: function(alpha, color) {
        this.ctx.fillStyle = color || '#000';
        this.ctx.globalAlpha = alpha;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalAlpha = 1;
    }
};
