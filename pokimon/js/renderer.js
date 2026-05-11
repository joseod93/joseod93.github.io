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
        var ratio = max > 0 ? current / max : 0;
        var barH = 10;
        var color = ratio > 0.5 ? '#44dd44' : (ratio > 0.2 ? '#ddcc00' : '#dd3333');

        this.drawRect(x, y, width, barH, '#333');
        if (ratio > 0) {
            this.drawRect(x + 1, y + 1, Math.floor((width - 2) * ratio), barH - 2, color);
        }
        this.drawRectOutline(x, y, width, barH, '#555', 1);
    },

    drawXPBar: function(x, y, width, current, max) {
        var ratio = max > 0 ? Math.min(current / max, 1) : 0;
        var barH = 6;

        this.drawRect(x, y, width, barH, '#222');
        if (ratio > 0) {
            this.drawRect(x + 1, y + 1, Math.floor((width - 2) * ratio), barH - 2, '#4488ff');
        }
    },

    drawPanel: function(x, y, w, h, bgColor) {
        this.ctx.fillStyle = bgColor || 'rgba(20,20,40,0.92)';
        this.ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(Math.floor(x) + 2, Math.floor(y) + 2, w - 4, h - 4);
    },

    drawMonsterSprite: function(x, y, species, options) {
        options = options || {};
        var w = options.width || 96;
        var h = options.height || 96;
        var alpha = options.alpha !== undefined ? options.alpha : 1;
        var flash = options.flash || false;

        this.ctx.save();
        this.ctx.globalAlpha = alpha;

        if (species.image) {
            this.ctx.drawImage(species.image, Math.floor(x), Math.floor(y), w, h);
        } else {
            this.drawRect(x + 4, y + 4, w - 8, h - 8, flash ? '#fff' : species.color);
            this.drawRectOutline(x + 4, y + 4, w - 8, h - 8, species.accentColor || '#fff', 3);

            var eyeY = y + h * 0.3;
            var eyeSize = 8;
            this.drawRect(x + w * 0.3, eyeY, eyeSize, eyeSize, flash ? '#fff' : '#fff');
            this.drawRect(x + w * 0.6, eyeY, eyeSize, eyeSize, flash ? '#fff' : '#fff');
            this.drawRect(x + w * 0.3 + 2, eyeY + 2, 4, 4, flash ? '#fff' : '#111');
            this.drawRect(x + w * 0.6 + 2, eyeY + 2, 4, 4, flash ? '#fff' : '#111');

            var mouthY = y + h * 0.55;
            this.drawRect(x + w * 0.35, mouthY, w * 0.3, 4, flash ? '#fff' : '#111');
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
