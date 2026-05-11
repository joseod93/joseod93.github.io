window.Game = window.Game || {};

Game.Input = (function() {
    var keys = {};
    var justPressedKeys = {};
    var touchDirs = {};
    var touchJust = {};
    var touchHeld = {};
    var isMobile = false;

    window.addEventListener('keydown', function(e) {
        if (!keys[e.code]) {
            justPressedKeys[e.code] = true;
        }
        keys[e.code] = true;
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter'].indexOf(e.code) !== -1) {
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', function(e) {
        keys[e.code] = false;
    });

    function simulatePress(code) {
        touchJust[code] = true;
        touchHeld[code] = true;
    }

    function simulateRelease(code) {
        touchHeld[code] = false;
    }

    function simulateReleaseAll() {
        touchHeld = {};
    }

    return {
        isMobile: function() { return isMobile; },
        setMobile: function(v) { isMobile = v; },

        simulatePress: simulatePress,
        simulateRelease: simulateRelease,
        simulateReleaseAll: simulateReleaseAll,

        isDown: function(code) {
            return !!keys[code] || !!touchHeld[code];
        },

        justPressed: function(code) {
            return !!justPressedKeys[code] || !!touchJust[code];
        },

        confirm: function() {
            return justPressedKeys['KeyZ'] || justPressedKeys['Enter'] || justPressedKeys['Space']
                || touchJust['confirm'];
        },

        cancel: function() {
            return justPressedKeys['KeyX'] || justPressedKeys['Backspace'] || justPressedKeys['Escape']
                || touchJust['cancel'];
        },

        up: function() {
            return justPressedKeys['ArrowUp'] || justPressedKeys['KeyW'] || touchJust['ArrowUp'];
        },

        down: function() {
            return justPressedKeys['ArrowDown'] || justPressedKeys['KeyS'] || touchJust['ArrowDown'];
        },

        left: function() {
            return justPressedKeys['ArrowLeft'] || justPressedKeys['KeyA'] || touchJust['ArrowLeft'];
        },

        right: function() {
            return justPressedKeys['ArrowRight'] || justPressedKeys['KeyD'] || touchJust['ArrowRight'];
        },

        update: function() {
            justPressedKeys = {};
            touchJust = {};
        }
    };
})();
