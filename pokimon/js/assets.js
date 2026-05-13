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
        tile_ground: 'images/tile_ground.png',
        tile_wall: 'images/tile_wall.png',
        tile_grass: 'images/tile_grass.png',
        tile_heal: 'images/tile_heal.png',
        tile_path: 'images/tile_path.png',
        player: 'images/player.png'
    },

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
                self.images[key] = img;
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

    get: function(key) {
        return this.images[key] || null;
    },

    progress: function() {
        return this.total > 0 ? this.count / this.total : 1;
    }
};
