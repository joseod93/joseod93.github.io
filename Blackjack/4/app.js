const CARDS = [
    { name: 'A',  hiLo: -1 },
    { name: '2',  hiLo: 1 },
    { name: '3',  hiLo: 1 },
    { name: '4',  hiLo: 1 },
    { name: '5',  hiLo: 1 },
    { name: '6',  hiLo: 1 },
    { name: '7',  hiLo: 0 },
    { name: '8',  hiLo: 0 },
    { name: '9',  hiLo: 0 },
    { name: '10', hiLo: -1 },
    { name: 'J',  hiLo: -1 },
    { name: 'Q',  hiLo: -1 },
    { name: 'K',  hiLo: -1 },
];

const RANK_MAP = {
    '1': 'A', '0': '10',
    'A':'A','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
    '10':'10','J':'J','Q':'Q','K':'K'
};

class BlackjackAdvisor {
    constructor() {
        this.phase = 'setup';
        this.setupStep = 'init';

        this.deckCount = 6;
        this.dealerPos = null;
        this.playerPos = null;

        this.remaining = {};
        this.runningCount = 0;
        this.history = [];
        this.playerHand = [];
        this.dealerHand = [];
        this.othersCards = [];
        this.currentTarget = 'player';

        this.activeDetections = [];
        this.hadCards = false;
        this.autoNewHandTimer = null;

        this.stream = null;
        this.cameraActive = false;
        this.modelReady = false;

        this.strategy = new StrategyEngine();
        this.detector = new CardDetector();
        this.detector.drawDebug = false;

        this.detector.onModelProgress = (stage, msg) => this.onModelProgress(stage, msg);

        this.initElements();
        this.initEvents();
        this.resetShoe();
    }

    initElements() {
        this.els = {
            setupPanel: document.getElementById('setupPanel'),
            setupHint: document.getElementById('setupHint'),
            btnStartCamera: document.getElementById('btnStartCamera'),
            deckCount: document.getElementById('deckCount'),
            videoSection: document.getElementById('videoSection'),
            videoContainer: document.getElementById('videoContainer'),
            video: document.getElementById('video'),
            overlay: document.getElementById('overlay'),
            dealerMarker: document.getElementById('dealerMarker'),
            playerMarker: document.getElementById('playerMarker'),
            setupInstructions: document.getElementById('setupInstructions'),
            setupText: document.getElementById('setupText'),
            btnReady: document.getElementById('btnReady'),
            playingUI: document.getElementById('playingUI'),
            adviceBox: document.getElementById('adviceBox'),
            adviceAction: document.getElementById('adviceAction'),
            adviceReason: document.getElementById('adviceReason'),
            playerCards: document.getElementById('playerCards'),
            dealerCards: document.getElementById('dealerCards'),
            othersCards: document.getElementById('othersCards'),
            playerTotal: document.getElementById('playerTotal'),
            dealerTotal: document.getElementById('dealerTotal'),
            othersCount: document.getElementById('othersCount'),
            runningCount: document.getElementById('runningCount'),
            trueCount: document.getElementById('trueCount'),
            advantage: document.getElementById('advantage'),
            remaining: document.getElementById('remaining'),
            bustProb: document.getElementById('bustProb'),
            dealerBust: document.getElementById('dealerBust'),
            history: document.getElementById('history'),
            cardsGrid: document.getElementById('cardsGrid'),
            btnNewHand: document.getElementById('btnNewHand'),
            btnReset: document.getElementById('btnReset'),
            btnUndo: document.getElementById('btnUndo'),
            btnReconfig: document.getElementById('btnReconfig'),
            sensitivity: document.getElementById('sensitivity'),
            sensValue: document.getElementById('sensValue'),
            detectionFps: document.getElementById('detectionFps'),
            fpsValue: document.getElementById('fpsValue'),
            autoNewHand: document.getElementById('autoNewHand'),
            modelStatus: document.getElementById('modelStatus'),
            modelFile: document.getElementById('modelFile'),
            btnManualMode: document.getElementById('btnManualMode'),
            modelBadge: document.getElementById('modelBadge'),
            confThreshold: document.getElementById('confThreshold'),
            confValue: document.getElementById('confValue'),
        };
    }

    initEvents() {
        this.els.btnStartCamera.addEventListener('click', () => this.startSetupCamera());
        this.els.btnReady.addEventListener('click', () => this.startPlaying());
        this.els.videoContainer.addEventListener('click', (e) => this.handleVideoTap(e));

        this.els.deckCount.addEventListener('change', () => {
            this.deckCount = parseInt(this.els.deckCount.value);
            this.resetShoe();
        });

        this.els.btnNewHand.addEventListener('click', () => this.newHand());
        this.els.btnReset.addEventListener('click', () => {
            if (confirm('Nuevo zapato? Se reinicia el conteo.')) this.resetShoe();
        });
        this.els.btnUndo.addEventListener('click', () => this.undo());
        this.els.btnReconfig.addEventListener('click', () => this.goToSetup());

        if (this.els.confThreshold) {
            this.els.confThreshold.addEventListener('input', (e) => {
                const val = parseInt(e.target.value) / 100;
                this.detector.confThreshold = val;
                if (this.els.confValue) this.els.confValue.textContent = e.target.value + '%';
            });
        }

        this.els.detectionFps.addEventListener('input', (e) => {
            this.els.fpsValue.textContent = e.target.value;
            if (this.cameraActive && this.modelReady) {
                this.detector.startDetection(this.els.video, parseInt(e.target.value));
            }
        });

        if (this.els.modelFile) {
            this.els.modelFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.loadModel(file);
            });
        }

        if (this.els.btnManualMode) {
            this.els.btnManualMode.addEventListener('click', () => this.startManualMode());
        }

        document.querySelectorAll('.zone-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.zone-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTarget = btn.dataset.target;
            });
        });

        this.detector.onCardsDetected = (cards) => {
            this.handleDetectedCards(cards);
            this.drawOverlay(cards);
        };
    }

    // ===== MODEL LOADING =====

    onModelProgress(stage, message) {
        if (this.els.modelStatus) {
            this.els.modelStatus.textContent = message;
            this.els.modelStatus.className = 'model-status ' + stage;
        }

        if (stage === 'ready') {
            this.modelReady = true;
            if (this.els.modelBadge) {
                this.els.modelBadge.textContent = message;
                this.els.modelBadge.classList.add('active');
            }
        } else if (stage === 'error') {
            this.modelReady = false;
            if (this.els.modelBadge) {
                this.els.modelBadge.textContent = 'Sin modelo';
                this.els.modelBadge.classList.remove('active');
            }
        }
    }

    async loadModel(source) {
        try {
            await this.detector.loadModel(source);
        } catch (err) {
            console.error('Error cargando modelo:', err);
        }
    }

    startManualMode() {
        this.modelReady = false;
        if (this.els.modelStatus) {
            this.els.modelStatus.textContent = 'Modo manual (sin detección automática)';
            this.els.modelStatus.className = 'model-status manual';
        }
        if (this.els.modelBadge) {
            this.els.modelBadge.textContent = 'Manual';
            this.els.modelBadge.classList.remove('active');
        }
    }

    // ===== SETUP =====

    async startSetupCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            this.els.video.srcObject = this.stream;
            this.els.videoSection.style.display = 'block';
            this.els.btnStartCamera.style.display = 'none';
            this.els.setupInstructions.style.display = 'block';
            this.cameraActive = true;

            this.setupStep = 'markDealer';
            this.els.setupText.textContent = '👆 Toca donde se reparten las cartas de la BANCA';
            this.els.setupHint.textContent = 'Marca las posiciones en el video';

            this.detector.setDebugCanvas(this.els.overlay);

            if (!this.modelReady && !this.detector.modelLoading) {
                this.loadModel();
            }
        } catch (err) {
            alert('Error camara: ' + err.message);
        }
    }

    handleVideoTap(e) {
        if (this.phase !== 'setup') return;
        if (this.setupStep !== 'markDealer' && this.setupStep !== 'markPlayer') return;

        const rect = this.els.videoContainer.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        if (this.setupStep === 'markDealer') {
            this.dealerPos = { x, y };
            this.positionMarker(this.els.dealerMarker, x, y);
            this.setupStep = 'markPlayer';
            this.els.setupText.textContent = '👆 Ahora toca donde se reparten TUS cartas';
        } else if (this.setupStep === 'markPlayer') {
            this.playerPos = { x, y };
            this.positionMarker(this.els.playerMarker, x, y);
            this.setupStep = 'ready';
            this.els.setupText.textContent = '✅ Posiciones marcadas!';
            this.els.btnReady.style.display = 'block';
        }
    }

    positionMarker(marker, x, y) {
        marker.style.display = 'flex';
        marker.style.left = (x * 100) + '%';
        marker.style.top = (y * 100) + '%';
    }

    startPlaying() {
        this.phase = 'playing';
        this.els.setupPanel.style.display = 'none';
        this.els.setupInstructions.style.display = 'none';
        this.els.playingUI.style.display = 'block';

        if (this.modelReady) {
            this.detector.startDetection(this.els.video, parseInt(this.els.detectionFps.value));
        }
        this.render();
    }

    goToSetup() {
        this.phase = 'setup';
        this.setupStep = 'markDealer';
        this.dealerPos = null;
        this.playerPos = null;
        this.els.dealerMarker.style.display = 'none';
        this.els.playerMarker.style.display = 'none';
        this.els.setupPanel.style.display = 'block';
        this.els.setupInstructions.style.display = 'block';
        this.els.playingUI.style.display = 'none';
        this.els.btnReady.style.display = 'none';
        this.els.btnStartCamera.style.display = 'none';
        this.els.setupText.textContent = '👆 Toca donde se reparten las cartas de la BANCA';
        this.els.setupHint.textContent = 'Marca las posiciones en el video';
        this.detector.stopDetection();
    }

    // ===== ZONE ASSIGNMENT =====

    assignZone(cardCenterX, cardCenterY) {
        const vw = this.els.video.videoWidth;
        const vh = this.els.video.videoHeight;
        if (!vw || !vh || !this.dealerPos || !this.playerPos) return 'others';

        const rx = cardCenterX / vw;
        const ry = cardCenterY / vh;

        const dd = Math.hypot(rx - this.dealerPos.x, ry - this.dealerPos.y);
        const dp = Math.hypot(rx - this.playerPos.x, ry - this.playerPos.y);

        const dpDist = Math.hypot(
            this.dealerPos.x - this.playerPos.x,
            this.dealerPos.y - this.playerPos.y
        );
        const zoneR = dpDist * 0.4;

        if (dd < zoneR && dd < dp) return 'dealer';
        if (dp < zoneR && dp <= dd) return 'player';
        return 'others';
    }

    // ===== DETECTION HANDLING =====

    handleDetectedCards(cards) {
        if (this.phase !== 'playing') return;

        const now = Date.now();
        let foundCards = false;

        for (const card of cards) {
            const rank = RANK_MAP[card.rank] || card.rank;
            if (!rank || this.remaining[rank] <= 0) continue;

            const target = this.assignZone(card.centerX, card.centerY);
            foundCards = true;

            const existing = this.activeDetections.find(d =>
                d.rank === rank &&
                d.target === target &&
                Math.hypot(d.x - card.centerX, d.y - card.centerY) < 60
            );

            if (existing) {
                existing.x = card.centerX;
                existing.y = card.centerY;
                existing.timestamp = now;
            } else {
                this.addCard(rank, target);
                this.activeDetections.push({
                    rank, target,
                    x: card.centerX, y: card.centerY,
                    timestamp: now
                });
            }
        }

        if (foundCards) {
            this.hadCards = true;
            if (this.autoNewHandTimer) {
                clearTimeout(this.autoNewHandTimer);
                this.autoNewHandTimer = null;
            }
        } else if (this.hadCards && this.els.autoNewHand.checked) {
            if (!this.autoNewHandTimer) {
                this.autoNewHandTimer = setTimeout(() => {
                    if (this.playerHand.length > 0 || this.dealerHand.length > 0) {
                        this.newHand();
                    }
                    this.hadCards = false;
                    this.autoNewHandTimer = null;
                }, 4000);
            }
        }

        this.activeDetections = this.activeDetections.filter(d => now - d.timestamp < 5000);
    }

    // ===== OVERLAY DRAWING =====

    drawOverlay(cards) {
        const canvas = this.els.overlay;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width;
        const h = canvas.height;
        if (!w || !h) return;

        if (this.phase === 'playing' && this.dealerPos && this.playerPos) {
            this.drawZoneCircle(ctx, w, h, this.dealerPos, 'rgba(255, 100, 100, 0.4)', 'BANCA');
            this.drawZoneCircle(ctx, w, h, this.playerPos, 'rgba(0, 212, 170, 0.4)', 'TU');
        }

        const zoneColors = {
            dealer: '#ff6b6b',
            player: '#00d4aa',
            others: '#8892a4'
        };

        for (const card of cards) {
            const target = this.assignZone(card.centerX, card.centerY);
            const color = zoneColors[target];

            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(card.x, card.y, card.width, card.height);

            const label = card.confidence
                ? `${card.rank} ${(card.confidence * 100).toFixed(0)}%`
                : card.rank;
            ctx.fillStyle = color;
            ctx.font = 'bold 18px Arial';
            ctx.fillText(label, card.x + 4, card.y - 8);
        }
    }

    drawZoneCircle(ctx, w, h, pos, color, label) {
        const cx = pos.x * w;
        const cy = pos.y * h;

        const dpDist = Math.hypot(
            (this.dealerPos.x - this.playerPos.x) * w,
            (this.dealerPos.y - this.playerPos.y) * h
        );
        const r = dpDist * 0.4;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = color;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(label, cx, cy - r - 8);
        ctx.textAlign = 'left';
    }

    // ===== GAME LOGIC =====

    resetShoe() {
        this.remaining = {};
        CARDS.forEach(c => { this.remaining[c.name] = this.deckCount * 4; });
        this.runningCount = 0;
        this.history = [];
        this.playerHand = [];
        this.dealerHand = [];
        this.othersCards = [];
        this.activeDetections = [];
        this.hadCards = false;
        if (this.phase === 'playing') this.render();
    }

    newHand() {
        this.playerHand = [];
        this.dealerHand = [];
        this.othersCards = [];
        this.activeDetections = [];
        this.hadCards = false;
        this.render();
    }

    addCard(cardName, target) {
        if (this.remaining[cardName] <= 0) return;
        this.remaining[cardName]--;
        const card = CARDS.find(c => c.name === cardName);
        this.runningCount += card.hiLo;
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
        const card = CARDS.find(c => c.name === last.card);
        this.runningCount -= card.hiLo;

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
        const card = CARDS.find(c => c.name === cardName);
        this.runningCount -= card.hiLo;
        const histIdx = this.history.findLastIndex(h => h.card === cardName && h.target === target);
        if (histIdx >= 0) this.history.splice(histIdx, 1);
        this.render();
    }

    // ===== CALCULATIONS =====

    totalRemaining() { return Object.values(this.remaining).reduce((a, b) => a + b, 0); }
    decksRemaining() { return this.totalRemaining() / 52; }
    trueCount() { const d = this.decksRemaining(); return d > 0 ? this.runningCount / d : 0; }
    playerAdvantage() { return -0.5 + (this.trueCount() * 0.5); }

    // ===== RENDERING =====

    render() {
        this.renderCardsGrid();
        this.renderHands();
        this.renderAdvice();
        this.renderStats();
        this.renderHistory();
        this.els.btnUndo.disabled = this.history.length === 0;
    }

    renderCardsGrid() {
        this.els.cardsGrid.innerHTML = '';
        CARDS.forEach(card => {
            const btn = document.createElement('button');
            btn.className = 'card-btn';
            const rem = this.remaining[card.name];
            if (card.hiLo > 0) btn.classList.add('hi-lo-plus');
            else if (card.hiLo < 0) btn.classList.add('hi-lo-minus');
            if (rem === 0) btn.classList.add('depleted');
            btn.innerHTML = `<span class="card-face">${card.name}</span><span class="card-remaining">${rem}</span>`;
            btn.addEventListener('click', () => this.addCard(card.name, this.currentTarget));
            this.els.cardsGrid.appendChild(btn);
        });
    }

    renderHands() {
        this.renderHandCards(this.els.playerCards, this.playerHand, 'player');
        this.renderHandCards(this.els.dealerCards, this.dealerHand, 'dealer');
        this.renderHandCards(this.els.othersCards, this.othersCards, 'others');

        const pv = this.strategy.getHandValue(this.playerHand);
        const dv = this.strategy.getHandValue(this.dealerHand);

        this.els.playerTotal.textContent = this.playerHand.length > 0 ?
            (pv.soft ? `${pv.total}(soft)` : pv.total) : '';
        this.els.dealerTotal.textContent = this.dealerHand.length > 0 ? dv.total : '';
        this.els.othersCount.textContent = this.othersCards.length > 0 ? `(${this.othersCards.length})` : '';
    }

    renderHandCards(container, cards, target) {
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
            reasonEl.textContent = '21 natural!';
            return;
        }

        if (this.playerHand.length < 2 || this.dealerHand.length < 1) {
            box.classList.add('waiting');
            actionEl.textContent = '—';
            reasonEl.textContent = this.playerHand.length < 2 ?
                'Esperando cartas...' : 'Falta carta de la banca';
            return;
        }

        const dealerUp = this.dealerHand[0];
        const tc = this.trueCount();
        const advice = this.strategy.getAdvice(this.playerHand, dealerUp, tc);

        if (!advice.action) {
            box.classList.add('waiting');
            actionEl.textContent = '—';
            reasonEl.textContent = advice.reason;
            return;
        }

        const actionMap = {
            'HIT':       { class: 'hit',       text: 'PEDIR' },
            'STAND':     { class: 'stand',      text: 'PLANTARSE' },
            'DOUBLE':    { class: 'double',     text: 'DOBLAR' },
            'SPLIT':     { class: 'split',      text: 'DIVIDIR' },
            'SURRENDER': { class: 'surrender',  text: 'RENDIRSE' },
        };

        const display = actionMap[advice.action] || { class: 'waiting', text: advice.action };
        box.classList.add(display.class);
        actionEl.textContent = display.text;

        let reason = advice.reason;
        if (advice.deviation) reason = '*** ' + reason;
        reasonEl.textContent = reason;
    }

    renderStats() {
        const rc = this.runningCount;
        const tc = this.trueCount();
        const adv = this.playerAdvantage();
        const rem = this.totalRemaining();

        this.els.runningCount.textContent = rc > 0 ? `+${rc}` : rc;
        this.els.trueCount.textContent = (tc > 0 ? '+' : '') + tc.toFixed(1);
        this.els.advantage.textContent = (adv > 0 ? '+' : '') + adv.toFixed(1) + '%';
        this.els.remaining.textContent = rem;

        const boxes = document.querySelectorAll('.count-box');
        boxes.forEach(b => b.classList.remove('positive', 'negative'));
        if (tc > 1) boxes[1]?.classList.add('positive');
        else if (tc < -1) boxes[1]?.classList.add('negative');
        if (adv > 0) boxes[2]?.classList.add('positive');
        else if (adv < 0) boxes[2]?.classList.add('negative');

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

document.addEventListener('DOMContentLoaded', () => {
    new BlackjackAdvisor();
});
