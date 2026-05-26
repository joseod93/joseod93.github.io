// ===== CONSTANTS =====

const CARDS = [
    { name: 'A',  display: 'A' },
    { name: '2',  display: '2' },
    { name: '3',  display: '3' },
    { name: '4',  display: '4' },
    { name: '5',  display: '5' },
    { name: '6',  display: '6' },
    { name: '7',  display: '7' },
    { name: '8',  display: '8' },
    { name: '9',  display: '9' },
    { name: '10', display: '10' },
    { name: 'J',  display: 'J' },
    { name: 'Q',  display: 'Q' },
    { name: 'K',  display: 'K' },
];

// ===== TAB 0: BASIC MODE =====

class BasicMode {
    constructor() {
        this.strategy = new StrategyEngine({ ...DEFAULT_RULES });
        this.playerHand = [];
        this.dealerHand = [];
        this.currentTarget = 'player';

        this.els = {
            adviceBox: document.getElementById('bAdviceBox'),
            adviceAction: document.getElementById('bAdviceAction'),
            adviceReason: document.getElementById('bAdviceReason'),
            playerCards: document.getElementById('bPlayerCards'),
            dealerCards: document.getElementById('bDealerCards'),
            playerTotal: document.getElementById('bPlayerTotal'),
            dealerTotal: document.getElementById('bDealerTotal'),
            cardsGrid: document.getElementById('bCardsGrid'),
            btnNewHand: document.getElementById('bBtnNewHand'),
        };

        this.initEvents();
        this.renderGrid();
    }

    initEvents() {
        this.els.btnNewHand.addEventListener('click', () => {
            this.playerHand = [];
            this.dealerHand = [];
            this.render();
        });

        document.querySelectorAll('.bzone-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.bzone-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTarget = btn.dataset.target;
            });
        });
    }

    addCard(name) {
        if (this.currentTarget === 'dealer' && this.dealerHand.length >= 1) return;
        if (this.currentTarget === 'player') this.playerHand.push(name);
        else this.dealerHand.push(name);
        this.render();
    }

    removeCard(target, idx) {
        if (target === 'player') this.playerHand.splice(idx, 1);
        else this.dealerHand.splice(idx, 1);
        this.render();
    }

    renderGrid() {
        this.els.cardsGrid.innerHTML = '';
        CARDS.forEach(card => {
            const btn = document.createElement('button');
            btn.className = 'card-btn';
            btn.innerHTML = `<span class="card-face">${card.display}</span>`;
            btn.addEventListener('click', () => this.addCard(card.name));
            this.els.cardsGrid.appendChild(btn);
        });
    }

    render() {
        this._renderHand(this.els.playerCards, this.playerHand, 'player');
        this._renderHand(this.els.dealerCards, this.dealerHand, 'dealer');

        const pv = this.strategy.getHandValue(this.playerHand);
        const dv = this.strategy.getHandValue(this.dealerHand);
        this.els.playerTotal.textContent = this.playerHand.length > 0 ?
            (pv.soft ? `${pv.total}(soft)` : pv.total) : '';
        this.els.dealerTotal.textContent = this.dealerHand.length > 0 ? dv.total : '';

        this.renderAdvice();
    }

    _renderHand(container, cards, target) {
        container.innerHTML = '';
        cards.forEach((name, idx) => {
            const el = document.createElement('div');
            el.className = 'hand-card';
            el.textContent = name;
            const rm = document.createElement('span');
            rm.className = 'card-remove';
            rm.textContent = '×';
            rm.addEventListener('click', e => { e.stopPropagation(); this.removeCard(target, idx); });
            el.appendChild(rm);
            container.appendChild(el);
        });
    }

    renderAdvice() {
        const box = this.els.adviceBox;
        const actionEl = this.els.adviceAction;
        const reasonEl = this.els.adviceReason;
        box.className = 'advice-box';

        const pv = this.strategy.getHandValue(this.playerHand);

        if (pv.total > 21) {
            box.classList.add('bust');
            actionEl.textContent = 'BUST';
            reasonEl.textContent = `Te pasaste: ${pv.total}`;
            return;
        }

        if (pv.total === 21 && this.playerHand.length === 2) {
            box.classList.add('blackjack');
            actionEl.textContent = 'BLACKJACK!';
            reasonEl.textContent = 'Paga 3:2';
            return;
        }

        if (this.playerHand.length < 2 || this.dealerHand.length < 1) {
            box.classList.add('waiting');
            actionEl.textContent = '—';
            reasonEl.textContent = this.playerHand.length < 2 ?
                'Pon tus cartas y la de la banca' : 'Falta carta de la banca';
            return;
        }

        const advice = this.strategy.getAdvice(this.playerHand, this.dealerHand[0], 0, 'Hi-Lo');

        const actionMap = {
            'HIT':       { cls: 'hit',       txt: 'PEDIR' },
            'STAND':     { cls: 'stand',     txt: 'PLANTARSE' },
            'DOUBLE':    { cls: 'double',    txt: 'DOBLAR' },
            'SPLIT':     { cls: 'split',     txt: 'DIVIDIR' },
            'SURRENDER': { cls: 'surrender', txt: 'RENDIRSE' },
        };

        const disp = actionMap[advice.action] || { cls: 'waiting', txt: advice.action };
        box.classList.add(disp.cls);
        actionEl.textContent = disp.txt;
        reasonEl.textContent = advice.reason;
    }
}

// ===== TAB 1: MANUAL ADVISOR (Thorp / Snyder / Wong) =====

class ManualMode {
    constructor() {
        this.countSystem = 'Hi-Lo';
        this.rules = { ...DEFAULT_RULES };
        this.deckCount = 6;

        this.remaining = {};
        this.runningCount = 0;
        this.history = [];
        this.playerHand = [];
        this.dealerHand = [];
        this.othersCards = [];
        this.currentTarget = 'player';

        this.strategy = new StrategyEngine(this.rules);

        this.initElements();
        this.initEvents();
        this.resetShoe();
        this.renderSystemInfo();
    }

    initElements() {
        this.els = {
            deckCount: document.getElementById('deckCount'),
            countSystem: document.getElementById('countSystem'),
            adviceBox: document.getElementById('adviceBox'),
            adviceAction: document.getElementById('adviceAction'),
            adviceReason: document.getElementById('adviceReason'),
            insuranceBanner: document.getElementById('insuranceBanner'),
            insuranceText: document.getElementById('insuranceText'),
            betUnits: document.getElementById('betUnits'),
            edgeValue: document.getElementById('edgeValue'),
            wongBox: document.getElementById('wongBox'),
            wongSignal: document.getElementById('wongSignal'),
            playerCards: document.getElementById('playerCards'),
            dealerCards: document.getElementById('dealerCards'),
            othersCards: document.getElementById('othersCards'),
            playerTotal: document.getElementById('playerTotal'),
            dealerTotal: document.getElementById('dealerTotal'),
            othersCount: document.getElementById('othersCount'),
            runningCount: document.getElementById('runningCount'),
            trueCount: document.getElementById('trueCount'),
            tcLabel: document.getElementById('tcLabel'),
            advantage: document.getElementById('advantage'),
            remaining: document.getElementById('remaining'),
            penBar: document.getElementById('penBar'),
            penValue: document.getElementById('penValue'),
            bustProb: document.getElementById('bustProb'),
            dealerBust: document.getElementById('dealerBust'),
            history: document.getElementById('history'),
            cardsGrid: document.getElementById('cardsGrid'),
            btnNewHand: document.getElementById('btnNewHand'),
            btnReset: document.getElementById('btnReset'),
            btnUndo: document.getElementById('btnUndo'),
            ruleS17: document.getElementById('ruleS17'),
            ruleDAS: document.getElementById('ruleDAS'),
            ruleSurrender: document.getElementById('ruleSurrender'),
            ruleBJPayout: document.getElementById('ruleBJPayout'),
            rulePeek: document.getElementById('rulePeek'),
            baseEdge: document.getElementById('baseEdge'),
            systemInfo: document.getElementById('systemInfo'),
        };
    }

    initEvents() {
        this.els.deckCount.addEventListener('change', () => {
            this.deckCount = parseInt(this.els.deckCount.value);
            this.rules.decks = this.deckCount;
            this.strategy.setRules(this.rules);
            this.resetShoe();
            this.updateBaseEdge();
        });

        this.els.countSystem.addEventListener('change', () => {
            this.countSystem = this.els.countSystem.value;
            this.resetShoe();
            this.renderSystemInfo();
        });

        this.els.btnNewHand.addEventListener('click', () => this.newHand());
        this.els.btnReset.addEventListener('click', () => {
            if (confirm('Nuevo zapato? Se reinicia el conteo.')) this.resetShoe();
        });
        this.els.btnUndo.addEventListener('click', () => this.undo());

        document.querySelectorAll('.zone-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.zone-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTarget = btn.dataset.target;
            });
        });

        // Rules events
        const updateRules = () => {
            this.rules.s17 = this.els.ruleS17.value === 'true';
            this.rules.das = this.els.ruleDAS.checked;
            this.rules.surrender = this.els.ruleSurrender.checked;
            this.rules.bjPayout = parseFloat(this.els.ruleBJPayout.value);
            this.rules.peek = this.els.rulePeek.checked;
            this.strategy.setRules(this.rules);
            this.updateBaseEdge();
            this.render();
        };

        [this.els.ruleS17, this.els.ruleBJPayout].forEach(el => el.addEventListener('change', updateRules));
        [this.els.ruleDAS, this.els.ruleSurrender, this.els.rulePeek].forEach(el => el.addEventListener('change', updateRules));
    }

    // === Count system ===

    getCountValue(cardName) {
        const sys = COUNTING_SYSTEMS[this.countSystem];
        if (!sys) return 0;
        return sys.values[cardName] || 0;
    }

    getIRC() {
        const sys = COUNTING_SYSTEMS[this.countSystem];
        if (!sys) return 0;
        if (!sys.balanced) return 4 - (4 * this.deckCount); // KO
        return 0;
    }

    getTrueCount() {
        const sys = COUNTING_SYSTEMS[this.countSystem];
        if (!sys || !sys.balanced) return this.runningCount; // KO uses RC directly
        const decksLeft = this.totalRemaining() / 52;
        return decksLeft > 0 ? this.runningCount / decksLeft : 0;
    }

    // === Shoe management ===

    resetShoe() {
        this.remaining = {};
        CARDS.forEach(c => { this.remaining[c.name] = this.deckCount * 4; });
        this.runningCount = this.getIRC();
        this.history = [];
        this.playerHand = [];
        this.dealerHand = [];
        this.othersCards = [];
        this.updateBaseEdge();
        this.render();
    }

    newHand() {
        this.playerHand = [];
        this.dealerHand = [];
        this.othersCards = [];
        this.render();
    }

    addCard(cardName, target) {
        if (this.remaining[cardName] <= 0) return;
        this.remaining[cardName]--;
        this.runningCount += this.getCountValue(cardName);
        this.history.push({ card: cardName, target });

        switch (target) {
            case 'player': this.playerHand.push(cardName); break;
            case 'dealer': this.dealerHand.push(cardName); break;
            case 'others': this.othersCards.push(cardName); break;
        }
        this.render();
    }

    undo() {
        if (this.history.length === 0) return;
        const last = this.history.pop();
        this.remaining[last.card]++;
        this.runningCount -= this.getCountValue(last.card);

        switch (last.target) {
            case 'player': this.playerHand.pop(); break;
            case 'dealer': this.dealerHand.pop(); break;
            case 'others': this.othersCards.pop(); break;
        }
        this.render();
    }

    removeCardFromHand(target, index) {
        let cardName;
        switch (target) {
            case 'player': cardName = this.playerHand.splice(index, 1)[0]; break;
            case 'dealer': cardName = this.dealerHand.splice(index, 1)[0]; break;
            case 'others': cardName = this.othersCards.splice(index, 1)[0]; break;
        }
        if (!cardName) return;
        this.remaining[cardName]++;
        this.runningCount -= this.getCountValue(cardName);
        const histIdx = this.history.findLastIndex(h => h.card === cardName && h.target === target);
        if (histIdx >= 0) this.history.splice(histIdx, 1);
        this.render();
    }

    totalRemaining() { return Object.values(this.remaining).reduce((a, b) => a + b, 0); }
    totalCards() { return this.deckCount * 52; }

    updateBaseEdge() {
        const be = this.strategy.getBaseEdge();
        this.els.baseEdge.textContent = be.toFixed(2) + '%';
    }

    // === Rendering ===

    render() {
        this.renderCardsGrid();
        this.renderHands();
        this.renderAdvice();
        this.renderInsurance();
        this.renderBetWong();
        this.renderStats();
        this.renderHistory();
        this.els.btnUndo.disabled = this.history.length === 0;
    }

    renderCardsGrid() {
        this.els.cardsGrid.innerHTML = '';
        const sys = COUNTING_SYSTEMS[this.countSystem];
        CARDS.forEach(card => {
            const btn = document.createElement('button');
            btn.className = 'card-btn';
            const rem = this.remaining[card.name];
            const cv = sys ? (sys.values[card.name] || 0) : 0;
            if (cv > 0) btn.classList.add('hi-lo-plus');
            else if (cv < 0) btn.classList.add('hi-lo-minus');
            if (rem === 0) btn.classList.add('depleted');

            const cvStr = cv > 0 ? `+${cv}` : cv < 0 ? `${cv}` : '';
            btn.innerHTML = `<span class="card-face">${card.display}</span><span class="card-count-val">${cvStr}</span><span class="card-remaining">${rem}</span>`;
            btn.addEventListener('click', () => this.addCard(card.name, this.currentTarget));
            this.els.cardsGrid.appendChild(btn);
        });
    }

    renderHands() {
        this._renderHandCards(this.els.playerCards, this.playerHand, 'player');
        this._renderHandCards(this.els.dealerCards, this.dealerHand, 'dealer');
        this._renderHandCards(this.els.othersCards, this.othersCards, 'others');

        const pv = this.strategy.getHandValue(this.playerHand);
        const dv = this.strategy.getHandValue(this.dealerHand);

        this.els.playerTotal.textContent = this.playerHand.length > 0 ?
            (pv.soft ? `${pv.total}(soft)` : pv.total) : '';
        this.els.dealerTotal.textContent = this.dealerHand.length > 0 ? dv.total : '';
        this.els.othersCount.textContent = this.othersCards.length > 0 ? `(${this.othersCards.length})` : '';
    }

    _renderHandCards(container, cards, target) {
        container.innerHTML = '';
        cards.forEach((cardName, idx) => {
            const el = document.createElement('div');
            el.className = 'hand-card';
            el.textContent = cardName;
            const removeBtn = document.createElement('span');
            removeBtn.className = 'card-remove';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeCardFromHand(target, idx);
            });
            el.appendChild(removeBtn);
            container.appendChild(el);
        });
    }

    renderAdvice() {
        const box = this.els.adviceBox;
        const actionEl = this.els.adviceAction;
        const reasonEl = this.els.adviceReason;
        box.className = 'advice-box';

        const pv = this.strategy.getHandValue(this.playerHand);

        if (pv.total > 21) {
            box.classList.add('bust');
            actionEl.textContent = 'BUST';
            reasonEl.textContent = `Te pasaste: ${pv.total}`;
            return;
        }

        if (pv.total === 21 && this.playerHand.length === 2) {
            box.classList.add('blackjack');
            actionEl.textContent = 'BLACKJACK!';
            reasonEl.textContent = `Paga ${this.rules.bjPayout === 1.5 ? '3:2' : this.rules.bjPayout === 1.2 ? '6:5' : '1:1'}`;
            return;
        }

        if (this.playerHand.length < 2 || this.dealerHand.length < 1) {
            box.classList.add('waiting');
            actionEl.textContent = '—';
            reasonEl.textContent = this.playerHand.length < 2 ?
                'Esperando cartas...' : 'Falta carta de la banca';
            return;
        }

        const tc = this.getTrueCount();
        const advice = this.strategy.getAdvice(this.playerHand, this.dealerHand[0], tc, this.countSystem);

        if (!advice.action) {
            box.classList.add('waiting');
            actionEl.textContent = '—';
            reasonEl.textContent = advice.reason;
            return;
        }

        const actionMap = {
            'HIT':       { cls: 'hit',       txt: 'PEDIR' },
            'STAND':     { cls: 'stand',     txt: 'PLANTARSE' },
            'DOUBLE':    { cls: 'double',    txt: 'DOBLAR' },
            'SPLIT':     { cls: 'split',     txt: 'DIVIDIR' },
            'SURRENDER': { cls: 'surrender', txt: 'RENDIRSE' },
        };

        const disp = actionMap[advice.action] || { cls: 'waiting', txt: advice.action };
        box.classList.add(disp.cls);
        if (advice.deviation) box.classList.add('deviation');
        actionEl.textContent = disp.txt;

        let reason = advice.reason;
        if (advice.deviation) reason = '★ ' + reason;
        if (advice.fab) reason = '★ Fab4: ' + reason;
        reasonEl.textContent = reason;
    }

    renderInsurance() {
        const banner = this.els.insuranceBanner;
        if (this.dealerHand.length >= 1 && this.dealerHand[0] === 'A') {
            const tc = this.getTrueCount();
            const ins = this.strategy.getInsurance(tc, this.countSystem);
            banner.style.display = 'block';
            if (ins.take) {
                banner.className = 'insurance-banner take';
                this.els.insuranceText.textContent = `SEGURO: SI (TC=${tc >= 0 ? '+' : ''}${tc.toFixed(1)} ≥ +3)`;
            } else {
                banner.className = 'insurance-banner decline';
                this.els.insuranceText.textContent = `SEGURO: NO (TC=${tc >= 0 ? '+' : ''}${tc.toFixed(1)} < +3)`;
            }
        } else {
            banner.style.display = 'none';
        }
    }

    renderBetWong() {
        const tc = this.getTrueCount();
        const sys = COUNTING_SYSTEMS[this.countSystem];
        const isKO = sys && !sys.balanced;

        // Bet
        const bet = this.strategy.getBetUnits(tc, this.countSystem);
        this.els.betUnits.textContent = `${bet.units}u`;
        this.els.betUnits.className = 'bet-value' + (bet.units >= 4 ? ' hot' : bet.units >= 2 ? ' warm' : '');

        // Edge
        const edge = this.strategy.getEdge(tc, this.countSystem);
        const edgeStr = (edge >= 0 ? '+' : '') + edge.toFixed(1) + '%';
        this.els.edgeValue.textContent = edgeStr;
        this.els.edgeValue.className = 'edge-value' + (edge > 0 ? ' positive' : edge < -1 ? ' negative' : '');

        // Wong
        const wong = this.strategy.getWong(tc, this.countSystem);
        this.els.wongSignal.textContent = wong.signal;
        this.els.wongSignal.className = 'wong-value ' + wong.color;
        this.els.wongBox.title = wong.desc;
    }

    renderStats() {
        const rc = this.runningCount;
        const tc = this.getTrueCount();
        const edge = this.strategy.getEdge(tc, this.countSystem);
        const rem = this.totalRemaining();
        const total = this.totalCards();

        const sys = COUNTING_SYSTEMS[this.countSystem];
        const isKO = sys && !sys.balanced;

        // Running count
        const rcStr = rc >= 0 ? `+${Number.isInteger(rc) ? rc : rc.toFixed(1)}` : `${Number.isInteger(rc) ? rc : rc.toFixed(1)}`;
        this.els.runningCount.textContent = rcStr;

        // True count / Key count
        if (isKO) {
            this.els.tcLabel.textContent = 'RC (pivot:+4)';
            this.els.trueCount.textContent = rcStr;
        } else {
            this.els.tcLabel.textContent = 'True Count';
            this.els.trueCount.textContent = (tc >= 0 ? '+' : '') + tc.toFixed(1);
        }

        this.els.advantage.textContent = (edge >= 0 ? '+' : '') + edge.toFixed(1) + '%';
        this.els.remaining.textContent = rem;

        // Color coding
        const boxes = document.querySelectorAll('#tabManual .count-box');
        boxes.forEach(b => b.classList.remove('positive', 'negative'));
        if (tc > 1) { boxes[1]?.classList.add('positive'); }
        else if (tc < -1) { boxes[1]?.classList.add('negative'); }
        if (edge > 0) boxes[2]?.classList.add('positive');
        else if (edge < 0) boxes[2]?.classList.add('negative');

        // Penetration
        const pen = this.strategy.getPenetration(total, rem);
        const penPct = (pen * 100).toFixed(0);
        this.els.penBar.style.width = penPct + '%';
        this.els.penValue.textContent = penPct + '%';
        this.els.penBar.className = 'pen-bar' + (pen > 0.75 ? ' deep' : pen > 0.5 ? ' mid' : '');

        // Bust probabilities
        const pv = this.strategy.getHandValue(this.playerHand);
        if (this.playerHand.length >= 2 && pv.total <= 21) {
            const bustP = this.strategy.getBustProbability(pv.total, this.remaining);
            this.els.bustProb.textContent = (bustP * 100).toFixed(0) + '%';
            this.els.bustProb.style.color = bustP > 0.5 ? 'var(--negative)' : 'var(--positive)';
        } else {
            this.els.bustProb.textContent = '—';
            this.els.bustProb.style.color = '';
        }

        if (this.dealerHand.length > 0) {
            const dbust = this.strategy.getDealerBustProbability(this.dealerHand[0], this.remaining);
            this.els.dealerBust.textContent = (dbust * 100).toFixed(0) + '%';
            this.els.dealerBust.style.color = dbust > 0.35 ? 'var(--positive)' : 'var(--text-dim)';
        } else {
            this.els.dealerBust.textContent = '—';
            this.els.dealerBust.style.color = '';
        }
    }

    renderSystemInfo() {
        const sys = COUNTING_SYSTEMS[this.countSystem];
        if (!sys || !this.els.systemInfo) return;

        const vals = CARDS.map(c => {
            const v = sys.values[c.name] || 0;
            const cls = v > 0 ? 'si-plus' : v < 0 ? 'si-minus' : 'si-zero';
            return `<span class="${cls}">${c.display}:${v > 0 ? '+' : ''}${v}</span>`;
        }).join(' ');

        this.els.systemInfo.innerHTML = `
            <div class="si-name">${this.countSystem}</div>
            <div class="si-values">${vals}</div>
            <div class="si-stats">
                <span>Nivel: ${sys.level}</span>
                <span>BC: ${sys.bc}</span>
                <span>PE: ${sys.pe}</span>
                <span>IC: ${sys.ic}</span>
                ${sys.balanced ? '<span>Equilibrado</span>' : '<span>No equilibrado</span>'}
                ${sys.acesSideCount ? '<span>Requiere conteo lateral Ases</span>' : ''}
            </div>
        `;
    }

    renderHistory() {
        this.els.history.innerHTML = '';
        this.history.forEach(entry => {
            const chip = document.createElement('span');
            chip.className = `history-chip ${entry.target}`;
            chip.textContent = entry.card;
            this.els.history.appendChild(chip);
        });
        this.els.history.scrollTop = this.els.history.scrollHeight;
    }
}

// ===== TAB 2: SCANNER MODE =====

class ScannerMode {
    constructor() {
        this.detector = new CardDetector();
        this.detector.drawDebug = true;
        this.stream = null;
        this.cameraActive = false;
        this.modelReady = false;
        this.activeCards = [];

        this.detector.onModelProgress = (stage, msg) => this.onModelProgress(stage, msg);

        this.initElements();
        this.initEvents();
        this.loadModel();
    }

    initElements() {
        this.els = {
            modelStatus: document.getElementById('modelStatus'),
            modelBadge: document.getElementById('modelBadge'),
            modelFile: document.getElementById('modelFile'),
            btnStartCam: document.getElementById('btnStartCam'),
            videoContainer: document.getElementById('videoContainer'),
            video: document.getElementById('video'),
            overlay: document.getElementById('overlay'),
            detectedPanel: document.getElementById('detectedPanel'),
            detectedCount: document.getElementById('detectedCount'),
            detectedList: document.getElementById('detectedList'),
            confThreshold: document.getElementById('confThreshold'),
            confValue: document.getElementById('confValue'),
            detectionFps: document.getElementById('detectionFps'),
            fpsValue: document.getElementById('fpsValue'),
        };
    }

    initEvents() {
        this.els.btnStartCam.addEventListener('click', () => this.startCamera());

        this.els.modelFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.loadModel(file);
        });

        this.els.confThreshold.addEventListener('input', (e) => {
            const val = parseInt(e.target.value) / 100;
            this.detector.confThreshold = val;
            this.els.confValue.textContent = e.target.value + '%';
        });

        this.els.detectionFps.addEventListener('input', (e) => {
            this.els.fpsValue.textContent = e.target.value;
            if (this.cameraActive && this.modelReady) {
                this.detector.startDetection(this.els.video, parseInt(e.target.value));
            }
        });

        this.detector.onCardsDetected = (cards) => this.handleDetections(cards);
    }

    onModelProgress(stage, message) {
        this.els.modelStatus.textContent = message;
        this.els.modelStatus.className = 'model-status ' + stage;

        if (stage === 'ready') {
            this.modelReady = true;
            this.els.modelBadge.textContent = message;
            this.els.modelBadge.classList.add('active');
            if (this.cameraActive) {
                this.detector.startDetection(this.els.video, parseInt(this.els.detectionFps.value));
            }
        } else if (stage === 'error') {
            this.modelReady = false;
            this.els.modelBadge.textContent = 'Sin modelo';
            this.els.modelBadge.classList.remove('active');
        }
    }

    async loadModel(source) {
        try { await this.detector.loadModel(source); }
        catch (err) { console.error('Error cargando modelo:', err); }
    }

    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            this.els.video.srcObject = this.stream;
            await new Promise(resolve => {
                if (this.els.video.readyState >= 2) return resolve();
                this.els.video.addEventListener('loadeddata', resolve, { once: true });
            });
            this.els.videoContainer.style.display = 'block';
            this.els.detectedPanel.style.display = 'block';
            this.els.btnStartCam.textContent = '⏹ Parar camara';
            this.cameraActive = true;

            this.detector.setDebugCanvas(this.els.overlay);

            if (!this.modelReady && !this.detector.modelLoading) this.loadModel();
            if (this.modelReady) {
                this.detector.startDetection(this.els.video, parseInt(this.els.detectionFps.value));
            }

            this.els.btnStartCam.onclick = () => this.stopCamera();
        } catch (err) { alert('Error camara: ' + err.message); }
    }

    stopCamera() {
        this.detector.stopDetection();
        if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
        this.els.video.srcObject = null;
        this.els.videoContainer.style.display = 'none';
        this.els.btnStartCam.textContent = '📷 Iniciar camara';
        this.cameraActive = false;
        this.activeCards = [];
        this.renderDetections();
        this.els.btnStartCam.onclick = () => this.startCamera();
    }

    handleDetections(cards) {
        const now = Date.now();
        for (const card of cards) {
            const existing = this.activeCards.find(a =>
                a.rank === card.rank &&
                Math.hypot(a.centerX - card.centerX, a.centerY - card.centerY) < 80
            );
            if (existing) {
                existing.centerX = card.centerX;
                existing.centerY = card.centerY;
                existing.confidence = card.confidence;
                existing.lastSeen = now;
            } else {
                this.activeCards.push({
                    rank: card.rank, className: card.className,
                    confidence: card.confidence,
                    centerX: card.centerX, centerY: card.centerY,
                    lastSeen: now,
                });
            }
        }
        this.activeCards = this.activeCards.filter(a => now - a.lastSeen < 2000);
        this.renderDetections();
    }

    renderDetections() {
        const list = this.els.detectedList;
        this.els.detectedCount.textContent = this.activeCards.length;
        list.innerHTML = '';
        if (this.activeCards.length === 0) {
            list.innerHTML = '<p class="no-cards">Apunta la camara a las cartas</p>';
            return;
        }
        const sorted = [...this.activeCards].sort((a, b) => a.rank.localeCompare(b.rank));
        for (const card of sorted) {
            const el = document.createElement('div');
            el.className = 'detected-card';
            const suitMap = { C: '♣', D: '♦', H: '♥', S: '♠' };
            const suitChar = card.className ? suitMap[card.className.slice(-1)] || '' : '';
            const isRed = suitChar === '♥' || suitChar === '♦';
            el.innerHTML = `
                <span class="dc-rank ${isRed ? 'red' : ''}">${card.rank}</span>
                <span class="dc-suit ${isRed ? 'red' : ''}">${suitChar}</span>
                <span class="dc-conf">${(card.confidence * 100).toFixed(0)}%</span>
            `;
            list.appendChild(el);
        }
    }

    onActivate() {
        if (this.cameraActive && this.modelReady)
            this.detector.startDetection(this.els.video, parseInt(this.els.detectionFps.value));
    }
    onDeactivate() { this.detector.stopDetection(); }
}

// ===== TAB MANAGEMENT =====

class App {
    constructor() {
        this.basic = new BasicMode();
        this.manual = new ManualMode();
        this.scanner = new ScannerMode();
        this.currentTab = 'basic';
        this.initTabs();
    }

    initTabs() {
        const tabMap = { basic: 'tabBasic', manual: 'tabManual', detect: 'tabDetect' };
        document.querySelectorAll('.tab-bar .tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                if (tab === this.currentTab) return;
                document.querySelectorAll('.tab-bar .tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                document.getElementById(tabMap[tab]).classList.add('active');
                if (this.currentTab === 'detect') this.scanner.onDeactivate();
                this.currentTab = tab;
                if (tab === 'detect') this.scanner.onActivate();
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => new App());
