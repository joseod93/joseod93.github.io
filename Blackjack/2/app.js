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

class BlackjackAdvisor {
    constructor() {
        this.deckCount = 6;
        this.remaining = {};
        this.runningCount = 0;
        this.history = [];

        // Hands
        this.playerHand = [];
        this.dealerHand = [];
        this.othersCards = [];
        this.currentTarget = 'player';

        // Modules
        this.strategy = new StrategyEngine();
        this.detector = new CardDetector();
        this.cameraActive = false;
        this.stream = null;

        this.initElements();
        this.initEvents();
        this.reset();
    }

    initElements() {
        this.els = {
            deckCount: document.getElementById('deckCount'),
            btnReset: document.getElementById('btnReset'),
            btnUndo: document.getElementById('btnUndo'),
            btnNewHand: document.getElementById('btnNewHand'),
            btnCamera: document.getElementById('btnCamera'),
            btnStopCamera: document.getElementById('btnStopCamera'),
            autoDetect: document.getElementById('autoDetect'),
            video: document.getElementById('video'),
            overlay: document.getElementById('overlay'),
            cameraContainer: document.getElementById('cameraContainer'),
            cameraSettings: document.getElementById('cameraSettings'),
            sensitivity: document.getElementById('sensitivity'),
            sensValue: document.getElementById('sensValue'),
            detectionFps: document.getElementById('detectionFps'),
            fpsValue: document.getElementById('fpsValue'),
            cardsGrid: document.getElementById('cardsGrid'),
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
        };
    }

    initEvents() {
        this.els.deckCount.addEventListener('change', () => {
            this.deckCount = parseInt(this.els.deckCount.value);
            this.reset();
        });

        this.els.btnReset.addEventListener('click', () => this.reset());
        this.els.btnUndo.addEventListener('click', () => this.undo());
        this.els.btnNewHand.addEventListener('click', () => this.newHand());
        this.els.btnCamera.addEventListener('click', () => this.startCamera());
        this.els.btnStopCamera.addEventListener('click', () => this.stopCamera());

        this.els.sensitivity.addEventListener('input', (e) => {
            this.detector.sensitivity = parseInt(e.target.value);
            this.els.sensValue.textContent = e.target.value;
        });

        this.els.detectionFps.addEventListener('input', (e) => {
            this.els.fpsValue.textContent = e.target.value;
            if (this.cameraActive) {
                this.detector.startDetection(this.els.video, parseInt(e.target.value));
            }
        });

        // Zone selector buttons
        document.querySelectorAll('.zone-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.zone-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTarget = btn.dataset.target;
            });
        });

        // Card detection callback
        this.detector.onCardsDetected = (cards) => this.handleDetectedCards(cards);
    }

    reset() {
        this.remaining = {};
        CARDS.forEach(c => { this.remaining[c.name] = this.deckCount * 4; });
        this.runningCount = 0;
        this.history = [];
        this.playerHand = [];
        this.dealerHand = [];
        this.othersCards = [];
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

    // Camera
    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            this.els.video.srcObject = this.stream;
            this.els.cameraContainer.style.display = 'block';
            this.els.cameraSettings.style.display = 'flex';
            this.els.btnCamera.style.display = 'none';
            this.els.btnStopCamera.style.display = '';
            this.cameraActive = true;

            this.detector.setDebugCanvas(this.els.overlay);
            this.detector.startDetection(this.els.video, parseInt(this.els.detectionFps.value));
        } catch (err) {
            alert('Error al acceder a la cámara: ' + err.message);
        }
    }

    stopCamera() {
        this.detector.stopDetection();
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        this.els.video.srcObject = null;
        this.els.cameraContainer.style.display = 'none';
        this.els.cameraSettings.style.display = 'none';
        this.els.btnCamera.style.display = '';
        this.els.btnStopCamera.style.display = 'none';
        this.cameraActive = false;
    }

    handleDetectedCards(cards) {
        if (!this.els.autoDetect.checked) return;

        const videoW = this.els.video.videoWidth;
        const videoH = this.els.video.videoHeight;

        for (const card of cards) {
            const relY = card.centerY / videoH;
            const relX = card.centerX / videoW;

            let target;
            if (relY < 0.5) {
                target = 'dealer';
            } else if (relX > 0.33 && relX < 0.67) {
                target = 'player';
            } else {
                target = 'others';
            }

            const rankMap = {
                '1': 'A', '0': '10',
                'A':'A','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
                '10':'10','J':'J','Q':'Q','K':'K'
            };

            const rank = rankMap[card.rank];
            if (rank && this.remaining[rank] > 0) {
                const alreadyInHand = this.isCardAlreadyTracked(rank, target, card);
                if (!alreadyInHand) {
                    this.addCard(rank, target);
                }
            }
        }
    }

    isCardAlreadyTracked(rank, target, detection) {
        // Prevent adding same physical card twice
        const hand = target === 'player' ? this.playerHand :
                     target === 'dealer' ? this.dealerHand : this.othersCards;
        const recentHistory = this.history.slice(-10);
        const sameRecent = recentHistory.filter(h => h.card === rank && h.target === target);
        return sameRecent.length >= (this.remaining[rank] < this.deckCount * 4 - this.remaining[rank] ? 1 : 0);
    }

    // Calculations
    totalRemaining() {
        return Object.values(this.remaining).reduce((a, b) => a + b, 0);
    }

    decksRemaining() {
        return this.totalRemaining() / 52;
    }

    trueCount() {
        const decks = this.decksRemaining();
        return decks > 0 ? this.runningCount / decks : 0;
    }

    playerAdvantage() {
        return -0.5 + (this.trueCount() * 0.5);
    }

    // Rendering
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

            btn.innerHTML = `
                <span class="card-face">${card.name}</span>
                <span class="card-remaining">${rem}</span>
            `;
            btn.addEventListener('click', () => this.addCard(card.name, this.currentTarget));
            this.els.cardsGrid.appendChild(btn);
        });
    }

    renderHands() {
        this.renderHandCards(this.els.playerCards, this.playerHand, 'player');
        this.renderHandCards(this.els.dealerCards, this.dealerHand, 'dealer');
        this.renderHandCards(this.els.othersCards, this.othersCards, 'others');

        const playerVal = this.strategy.getHandValue(this.playerHand);
        const dealerVal = this.strategy.getHandValue(this.dealerHand);

        this.els.playerTotal.textContent = this.playerHand.length > 0 ?
            (playerVal.soft ? `${playerVal.total}(soft)` : playerVal.total) : '';
        this.els.dealerTotal.textContent = this.dealerHand.length > 0 ? dealerVal.total : '';
        this.els.othersCount.textContent = this.othersCards.length > 0 ? `(${this.othersCards.length})` : '';
    }

    renderHandCards(container, cards, target) {
        container.innerHTML = '';
        cards.forEach((cardName, idx) => {
            const el = document.createElement('div');
            el.className = 'hand-card';
            const isRed = false; // simplified
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

        const playerVal = this.strategy.getHandValue(this.playerHand);

        // Check bust
        if (playerVal.total > 21) {
            box.classList.add('bust');
            actionEl.textContent = '💀 BUST';
            reasonEl.textContent = `Te pasaste: ${playerVal.total}`;
            return;
        }

        // Check blackjack
        if (playerVal.total === 21 && this.playerHand.length === 2) {
            box.classList.add('blackjack');
            actionEl.textContent = '🎰 BLACKJACK!';
            reasonEl.textContent = '¡21 natural!';
            return;
        }

        if (this.playerHand.length < 2 || this.dealerHand.length < 1) {
            box.classList.add('waiting');
            actionEl.textContent = '—';
            reasonEl.textContent = this.playerHand.length < 2 ?
                'Mete tus 2 cartas y la carta visible de la banca' :
                'Mete la carta visible de la banca';
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
            'HIT': { class: 'hit', text: '👆 PEDIR' },
            'STAND': { class: 'stand', text: '✋ PLANTARSE' },
            'DOUBLE': { class: 'double', text: '💰 DOBLAR' },
            'SPLIT': { class: 'split', text: '✂️ DIVIDIR' },
            'SURRENDER': { class: 'surrender', text: '🏳️ RENDIRSE' },
        };

        const display = actionMap[advice.action] || { class: 'waiting', text: advice.action };
        box.classList.add(display.class);
        actionEl.textContent = display.text;

        let reason = advice.reason;
        if (advice.deviation) reason = '⚡ ' + reason;
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

        // Color coding
        const boxes = document.querySelectorAll('.count-box');
        boxes.forEach(b => b.classList.remove('positive', 'negative'));
        if (tc > 1) boxes[1]?.classList.add('positive');
        else if (tc < -1) boxes[1]?.classList.add('negative');
        if (adv > 0) boxes[2]?.classList.add('positive');
        else if (adv < 0) boxes[2]?.classList.add('negative');

        // Bust probability
        const playerVal = this.strategy.getHandValue(this.playerHand);
        if (this.playerHand.length >= 2 && playerVal.total <= 21) {
            const bustP = this.strategy.getBustProbability(playerVal.total, this.remaining);
            this.els.bustProb.textContent = (bustP * 100).toFixed(0) + '%';
            this.els.bustProb.style.color = bustP > 0.5 ? 'var(--negative)' : 'var(--positive)';
        } else {
            this.els.bustProb.textContent = '—';
            this.els.bustProb.style.color = '';
        }

        // Dealer bust probability
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
