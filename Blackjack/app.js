const CARDS = [
    { name: 'A',  value: 11, hiLo: -1, label: 'A' },
    { name: '2',  value: 2,  hiLo: 1,  label: '2' },
    { name: '3',  value: 3,  hiLo: 1,  label: '3' },
    { name: '4',  value: 4,  hiLo: 1,  label: '4' },
    { name: '5',  value: 5,  hiLo: 1,  label: '5' },
    { name: '6',  value: 6,  hiLo: 1,  label: '6' },
    { name: '7',  value: 7,  hiLo: 0,  label: '7' },
    { name: '8',  value: 8,  hiLo: 0,  label: '8' },
    { name: '9',  value: 9,  hiLo: 0,  label: '9' },
    { name: '10', value: 10, hiLo: -1, label: '10' },
    { name: 'J',  value: 10, hiLo: -1, label: 'J' },
    { name: 'Q',  value: 10, hiLo: -1, label: 'Q' },
    { name: 'K',  value: 10, hiLo: -1, label: 'K' },
];

const SUITS = ['♠', '♥', '♦', '♣'];

class BlackjackCounter {
    constructor() {
        this.deckCount = 6;
        this.remaining = {};
        this.history = [];
        this.runningCount = 0;

        this.els = {
            deckCount: document.getElementById('deckCount'),
            btnReset: document.getElementById('btnReset'),
            btnUndo: document.getElementById('btnUndo'),
            cardsGrid: document.getElementById('cardsGrid'),
            statsGrid: document.getElementById('statsGrid'),
            runningCount: document.getElementById('runningCount'),
            trueCount: document.getElementById('trueCount'),
            playerAdvantage: document.getElementById('playerAdvantage'),
            cardsRemaining: document.getElementById('cardsRemaining'),
            adviceText: document.getElementById('adviceText'),
            adviceBox: document.getElementById('adviceBox'),
            history: document.getElementById('history'),
        };

        this.els.deckCount.addEventListener('change', () => {
            this.deckCount = parseInt(this.els.deckCount.value);
            this.reset();
        });
        this.els.btnReset.addEventListener('click', () => this.reset());
        this.els.btnUndo.addEventListener('click', () => this.undo());

        this.reset();
    }

    reset() {
        this.remaining = {};
        CARDS.forEach(c => {
            this.remaining[c.name] = this.deckCount * 4;
        });
        this.history = [];
        this.runningCount = 0;
        this.render();
    }

    totalRemaining() {
        return Object.values(this.remaining).reduce((a, b) => a + b, 0);
    }

    decksRemaining() {
        return this.totalRemaining() / 52;
    }

    trueCount() {
        const decks = this.decksRemaining();
        if (decks <= 0) return 0;
        return this.runningCount / decks;
    }

    playerAdvantage() {
        return -0.5 + (this.trueCount() * 0.5);
    }

    playCard(cardName) {
        if (this.remaining[cardName] <= 0) return;
        this.remaining[cardName]--;
        const card = CARDS.find(c => c.name === cardName);
        this.runningCount += card.hiLo;
        this.history.push(cardName);
        this.render();
    }

    undo() {
        if (this.history.length === 0) return;
        const cardName = this.history.pop();
        this.remaining[cardName]++;
        const card = CARDS.find(c => c.name === cardName);
        this.runningCount -= card.hiLo;
        this.render();
    }

    getProbability(cardName) {
        const total = this.totalRemaining();
        if (total === 0) return 0;
        return this.remaining[cardName] / total;
    }

    getBustProbability(handValue) {
        const total = this.totalRemaining();
        if (total === 0) return 0;
        let bustCards = 0;
        CARDS.forEach(c => {
            const v = c.value === 11 ? 1 : c.value;
            if (handValue + v > 21) {
                bustCards += this.remaining[c.name];
            }
        });
        return bustCards / total;
    }

    getBlackjackProbability() {
        const total = this.totalRemaining();
        if (total < 2) return 0;
        const aces = this.remaining['A'];
        const tens = this.remaining['10'] + this.remaining['J'] + this.remaining['Q'] + this.remaining['K'];
        return (2 * aces * tens) / (total * (total - 1));
    }

    getTenProbability() {
        const total = this.totalRemaining();
        if (total === 0) return 0;
        const tens = this.remaining['10'] + this.remaining['J'] + this.remaining['Q'] + this.remaining['K'];
        return tens / total;
    }

    render() {
        this.renderCards();
        this.renderCounts();
        this.renderStats();
        this.renderAdvice();
        this.renderHistory();
        this.els.btnUndo.disabled = this.history.length === 0;
    }

    renderCards() {
        this.els.cardsGrid.innerHTML = '';
        CARDS.forEach(card => {
            const btn = document.createElement('button');
            btn.className = 'card-btn';
            const rem = this.remaining[card.name];
            const total = this.deckCount * 4;

            if (card.hiLo > 0) btn.classList.add('hi-lo-plus');
            else if (card.hiLo < 0) btn.classList.add('hi-lo-minus');
            else btn.classList.add('hi-lo-zero');

            if (rem === 0) btn.classList.add('depleted');

            const hiLoText = card.hiLo > 0 ? '+1' : card.hiLo < 0 ? '-1' : '0';

            btn.innerHTML = `
                <span class="card-face">${card.label}</span>
                <span class="card-remaining">${rem}/${total}</span>
                <span class="card-hi-lo">Hi-Lo: ${hiLoText}</span>
            `;

            btn.addEventListener('click', () => this.playCard(card.name));
            this.els.cardsGrid.appendChild(btn);
        });
    }

    renderCounts() {
        const rc = this.runningCount;
        const tc = this.trueCount();
        const adv = this.playerAdvantage();
        const rem = this.totalRemaining();

        this.els.runningCount.textContent = rc > 0 ? `+${rc}` : rc;
        this.els.trueCount.textContent = (tc > 0 ? '+' : '') + tc.toFixed(1);
        this.els.playerAdvantage.textContent = (adv > 0 ? '+' : '') + adv.toFixed(1) + '%';
        this.els.cardsRemaining.textContent = rem;

        const runBox = this.els.runningCount.closest('.count-box');
        const trueBox = this.els.trueCount.closest('.count-box');
        const advBox = this.els.playerAdvantage.closest('.count-box');

        [runBox, trueBox, advBox].forEach(box => {
            box.classList.remove('positive', 'negative');
        });

        if (rc > 0) runBox.classList.add('positive');
        else if (rc < 0) runBox.classList.add('negative');

        if (tc > 0) trueBox.classList.add('positive');
        else if (tc < 0) trueBox.classList.add('negative');

        if (adv > 0) advBox.classList.add('positive');
        else if (adv < 0) advBox.classList.add('negative');
    }

    renderStats() {
        const total = this.totalRemaining();
        const stats = [];

        stats.push({
            label: 'Prob. Blackjack natural',
            value: (this.getBlackjackProbability() * 100).toFixed(2) + '%',
            bar: this.getBlackjackProbability(),
        });

        stats.push({
            label: 'Prob. carta 10/J/Q/K',
            value: (this.getTenProbability() * 100).toFixed(1) + '%',
            bar: this.getTenProbability(),
        });

        stats.push({
            label: 'Prob. As',
            value: (this.getProbability('A') * 100).toFixed(1) + '%',
            bar: this.getProbability('A'),
        });

        stats.push({
            label: 'Bust con 16',
            value: (this.getBustProbability(16) * 100).toFixed(1) + '%',
            bar: this.getBustProbability(16),
        });

        stats.push({
            label: 'Bust con 15',
            value: (this.getBustProbability(15) * 100).toFixed(1) + '%',
            bar: this.getBustProbability(15),
        });

        stats.push({
            label: 'Bust con 13',
            value: (this.getBustProbability(13) * 100).toFixed(1) + '%',
            bar: this.getBustProbability(13),
        });

        this.els.statsGrid.innerHTML = '';
        stats.forEach(s => {
            const row = document.createElement('div');
            row.className = 'stat-row';
            row.innerHTML = `
                <span class="stat-label">${s.label}</span>
                <div class="stat-bar">
                    <div class="stat-bar-fill" style="width: ${Math.min(s.bar * 100, 100)}%"></div>
                </div>
                <span class="stat-value">${s.value}</span>
            `;
            this.els.statsGrid.appendChild(row);
        });
    }

    renderAdvice() {
        const tc = this.trueCount();
        const box = this.els.adviceBox;
        const text = this.els.adviceText;

        box.classList.remove('neutral', 'favorable', 'unfavorable');

        if (this.history.length === 0) {
            box.classList.add('neutral');
            text.textContent = 'Empieza a contar cartas...';
        } else if (tc >= 2) {
            box.classList.add('favorable');
            if (tc >= 5) {
                text.textContent = '🔥 Baraja MUY favorable — Aumentar apuesta significativamente';
            } else if (tc >= 3) {
                text.textContent = '✅ Baraja favorable — Buen momento para aumentar apuesta';
            } else {
                text.textContent = '📈 Baraja ligeramente favorable — Considerar subir apuesta';
            }
        } else if (tc <= -2) {
            box.classList.add('unfavorable');
            if (tc <= -4) {
                text.textContent = '⛔ Baraja MUY desfavorable — Apuesta mínima o salir';
            } else {
                text.textContent = '⚠️ Baraja desfavorable — Mantener apuesta mínima';
            }
        } else {
            box.classList.add('neutral');
            text.textContent = '➡️ Baraja neutral — Apuesta base';
        }
    }

    renderHistory() {
        this.els.history.innerHTML = '';
        const redSuits = ['♥', '♦'];

        this.history.forEach((cardName, i) => {
            const chip = document.createElement('span');
            chip.className = 'history-chip';
            const suitIndex = i % 4;
            const suit = SUITS[suitIndex];
            chip.classList.add(redSuits.includes(suit) ? 'red' : 'black');
            chip.textContent = `${suit}${cardName}`;
            this.els.history.appendChild(chip);
        });

        this.els.history.scrollTop = this.els.history.scrollHeight;
    }
}

new BlackjackCounter();
