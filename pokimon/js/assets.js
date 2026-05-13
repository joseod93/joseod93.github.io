window.Game = window.Game || {};

Game.Assets = {
    images: {},
    loaded: false,
    total: 0,
    count: 0,

    manifest: {
        flamander: 'images/flamander.png',
        aquarion: 'images/aquarion.png',
        thornleaf: 'images/thornleaf.png',
        zappix: 'images/zappix.png',
        brawlox: 'images/brawlox.png',
        shadewisp: 'images/shadewisp.png',
        tile_base: 'images/tile_base.png',
        tile_wall: 'images/tile_wall.png',
        tile_grass: 'images/tile_grass.png',
        tile_heal: 'images/tile_heal.png',
        tile_path: 'images/tile_path.png',
        player_down: 'images/player_down.png',
        player_up: 'images/player_up.png',
        player_left: 'images/player_left.png',
        player_right: 'images/player_right.png'
    },

    chromaKeyTargets: [
        'flamander', 'aquarion', 'thornleaf', 'zappix', 'brawlox', 'shadewisp',
        'player_down', 'player_up', 'player_left', 'player_right'
    ],

    load: function(callback) {
        var keys = Object.keys(this.manifest);
        this.total = keys.length;
        this.count = 0;
        var self = this;

        if (keys.length === 0) {
            this.loaded = true;
            callback();
            return;
        }

        keys.forEach(function(key) {
            var img = new Image();
            img.onload = function() {
                if (self.chromaKeyTargets.indexOf(key) !== -1) {
                    self.images[key] = self.removeBackground(img);
                } else {
                    self.images[key] = img;
                }
                self.count++;
                if (self.count >= self.total) {
                    self.loaded = true;
                    callback();
                }
            };
            img.onerror = function() {
                self.count++;
                if (self.count >= self.total) {
                    self.loaded = true;
                    callback();
                }
            };
            img.src = self.manifest[key];
        });
    },

    removeBackground: function(img) {
        var canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var data = imageData.data;

        var bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
        var corners = [
            [0, 0], [canvas.width - 1, 0],
            [0, canvas.height - 1], [canvas.width - 1, canvas.height - 1]
        ];
        for (var c = 0; c < corners.length; c++) {
            var ci = (corners[c][1] * canvas.width + corners[c][0]) * 4;
            bgR += data[ci];
            bgG += data[ci + 1];
            bgB += data[ci + 2];
            bgCount++;
        }
        bgR = Math.round(bgR / bgCount);
        bgG = Math.round(bgG / bgCount);
        bgB = Math.round(bgB / bgCount);

        var tolerance = 60;

        for (var i = 0; i < data.length; i += 4) {
            var r = data[i], g = data[i + 1], b = data[i + 2];
            var dr = Math.abs(r - bgR);
            var dg = Math.abs(g - bgG);
            var db = Math.abs(b - bgB);
            var dist = Math.sqrt(dr * dr + dg * dg + db * db);

            if (dist < tolerance) {
                data[i + 3] = 0;
            } else if (dist < tolerance + 30) {
                var fade = (dist - tolerance) / 30;
                data[i + 3] = Math.round(data[i + 3] * fade);
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    },

    get: function(key) {
        return this.images[key] || null;
    },

    progress: function() {
        return this.total > 0 ? this.count / this.total : 1;
    }
};
