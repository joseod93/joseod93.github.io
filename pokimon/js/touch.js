window.Game = window.Game || {};

Game.Touch = (function() {
    var dpadButtons = [];
    var actionButtons = [];
    var activePointers = {};
    var container = null;
    var visible = false;

    function create() {
        if (container) return;

        var hasTouchScreen = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        if (!hasTouchScreen && window.innerWidth > 900) return;

        Game.Input.setMobile(true);
        visible = true;

        container = document.createElement('div');
        container.id = 'touch-controls';
        document.body.appendChild(container);

        var dpad = document.createElement('div');
        dpad.className = 'touch-dpad';
        container.appendChild(dpad);

        var dirs = [
            { id: 'up',    label: '▲', cls: 'dpad-up' },
            { id: 'left',  label: '◄', cls: 'dpad-left' },
            { id: 'right', label: '►', cls: 'dpad-right' },
            { id: 'down',  label: '▼', cls: 'dpad-down' }
        ];

        var codeMap = {
            up: 'ArrowUp',
            down: 'ArrowDown',
            left: 'ArrowLeft',
            right: 'ArrowRight'
        };

        dirs.forEach(function(d) {
            var btn = document.createElement('div');
            btn.className = 'touch-btn ' + d.cls;
            btn.textContent = d.label;
            btn.dataset.code = codeMap[d.id];
            dpad.appendChild(btn);
            dpadButtons.push(btn);
        });

        var dpadCenter = document.createElement('div');
        dpadCenter.className = 'dpad-center';
        dpad.appendChild(dpadCenter);

        var actions = document.createElement('div');
        actions.className = 'touch-actions';
        container.appendChild(actions);

        var acts = [
            { id: 'cancel', label: 'B', cls: 'btn-b', code: 'cancel' },
            { id: 'confirm', label: 'A', cls: 'btn-a', code: 'confirm' }
        ];

        acts.forEach(function(a) {
            var btn = document.createElement('div');
            btn.className = 'touch-btn action-btn ' + a.cls;
            btn.textContent = a.label;
            btn.dataset.code = a.code;
            actions.appendChild(btn);
            actionButtons.push(btn);
        });

        var allBtns = dpadButtons.concat(actionButtons);

        allBtns.forEach(function(btn) {
            btn.addEventListener('touchstart', function(e) {
                e.preventDefault();
                var code = btn.dataset.code;
                Game.Input.simulatePress(code);
                btn.classList.add('active');
                for (var i = 0; i < e.changedTouches.length; i++) {
                    activePointers[e.changedTouches[i].identifier] = btn;
                }
            }, { passive: false });

            btn.addEventListener('touchend', function(e) {
                e.preventDefault();
                var code = btn.dataset.code;
                Game.Input.simulateRelease(code);
                btn.classList.remove('active');
                for (var i = 0; i < e.changedTouches.length; i++) {
                    delete activePointers[e.changedTouches[i].identifier];
                }
            }, { passive: false });

            btn.addEventListener('touchcancel', function(e) {
                e.preventDefault();
                var code = btn.dataset.code;
                Game.Input.simulateRelease(code);
                btn.classList.remove('active');
            }, { passive: false });
        });

        document.addEventListener('touchmove', function(e) {
            e.preventDefault();
        }, { passive: false });
    }

    return {
        init: create,
        isVisible: function() { return visible; }
    };
})();
