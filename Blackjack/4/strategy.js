// Basic Strategy Engine for Blackjack
// Includes Hi-Lo count deviations (Illustrious 18)

const STRATEGY = {
    // Basic strategy tables
    // H=Hit, S=Stand, D=Double(hit if can't), Ds=Double(stand if can't), SP=Split, RH=Surrender(hit), RS=Surrender(stand)

    // Hard totals: [playerTotal][dealerUpcard (2-A)]
    hard: {
        21: ['S','S','S','S','S','S','S','S','S','S'],
        20: ['S','S','S','S','S','S','S','S','S','S'],
        19: ['S','S','S','S','S','S','S','S','S','S'],
        18: ['S','S','S','S','S','S','S','S','S','S'],
        17: ['S','S','S','S','S','S','S','S','S','S'],
        16: ['S','S','S','S','S','H','H','RH','RH','RH'],
        15: ['S','S','S','S','S','H','H','H','RH','H'],
        14: ['S','S','S','S','S','H','H','H','H','H'],
        13: ['S','S','S','S','S','H','H','H','H','H'],
        12: ['H','H','S','S','S','H','H','H','H','H'],
        11: ['D','D','D','D','D','D','D','D','D','D'],
        10: ['D','D','D','D','D','D','D','D','H','H'],
        9:  ['H','D','D','D','D','H','H','H','H','H'],
        8:  ['H','H','H','H','H','H','H','H','H','H'],
        7:  ['H','H','H','H','H','H','H','H','H','H'],
        6:  ['H','H','H','H','H','H','H','H','H','H'],
        5:  ['H','H','H','H','H','H','H','H','H','H'],
    },

    // Soft totals (hand with Ace counted as 11): [softTotal][dealerUpcard (2-A)]
    soft: {
        21: ['S','S','S','S','S','S','S','S','S','S'],
        20: ['S','S','S','S','S','S','S','S','S','S'],
        19: ['S','S','S','S','S','S','S','S','S','S'],
        18: ['Ds','Ds','Ds','Ds','Ds','S','S','H','H','H'],
        17: ['H','D','D','D','D','H','H','H','H','H'],
        16: ['H','H','D','D','D','H','H','H','H','H'],
        15: ['H','H','D','D','D','H','H','H','H','H'],
        14: ['H','H','H','D','D','H','H','H','H','H'],
        13: ['H','H','H','D','D','H','H','H','H','H'],
    },

    // Pairs: [pairCard][dealerUpcard (2-A)]
    pairs: {
        'A': ['SP','SP','SP','SP','SP','SP','SP','SP','SP','SP'],
        '10':['S','S','S','S','S','S','S','S','S','S'],
        '9': ['SP','SP','SP','SP','SP','S','SP','SP','S','S'],
        '8': ['SP','SP','SP','SP','SP','SP','SP','SP','SP','SP'],
        '7': ['SP','SP','SP','SP','SP','SP','H','H','H','H'],
        '6': ['SP','SP','SP','SP','SP','H','H','H','H','H'],
        '5': ['D','D','D','D','D','D','D','D','H','H'],
        '4': ['H','H','H','SP','SP','H','H','H','H','H'],
        '3': ['SP','SP','SP','SP','SP','SP','H','H','H','H'],
        '2': ['SP','SP','SP','SP','SP','SP','H','H','H','H'],
    },

    // Hi-Lo count deviations (Illustrious 18 + extras)
    // Format: {player, dealer, trueCount, action}
    // If trueCount >= threshold, use deviation action instead of basic strategy
    deviations: [
        { player: 16, dealer: 10, type: 'hard', tc: 0,  action: 'S', desc: '16 vs 10: Stand at TC≥0' },
        { player: 15, dealer: 10, type: 'hard', tc: 4,  action: 'S', desc: '15 vs 10: Stand at TC≥4' },
        { player: 12, dealer: 2,  type: 'hard', tc: 3,  action: 'S', desc: '12 vs 2: Stand at TC≥3' },
        { player: 12, dealer: 3,  type: 'hard', tc: 2,  action: 'S', desc: '12 vs 3: Stand at TC≥2' },
        { player: 12, dealer: 4,  type: 'hard', tc: 0,  action: 'S', desc: '12 vs 4: Stand at TC≥0' },
        { player: 13, dealer: 2,  type: 'hard', tc: -1, action: 'S', desc: '13 vs 2: Stand at TC≥-1' },
        { player: 13, dealer: 3,  type: 'hard', tc: -2, action: 'S', desc: '13 vs 3: Stand at TC≥-2' },
        { player: 11, dealer: 'A',type: 'hard', tc: 1,  action: 'D', desc: '11 vs A: Double at TC≥1' },
        { player: 10, dealer: 10, type: 'hard', tc: 4,  action: 'D', desc: '10 vs 10: Double at TC≥4' },
        { player: 10, dealer: 'A',type: 'hard', tc: 4,  action: 'D', desc: '10 vs A: Double at TC≥4' },
        { player: 9,  dealer: 2,  type: 'hard', tc: 1,  action: 'D', desc: '9 vs 2: Double at TC≥1' },
        { player: 9,  dealer: 7,  type: 'hard', tc: 3,  action: 'D', desc: '9 vs 7: Double at TC≥3' },
        { player: 16, dealer: 9,  type: 'hard', tc: 5,  action: 'S', desc: '16 vs 9: Stand at TC≥5' },
        { player: 20, dealer: 5,  type: 'pair', tc: 5,  action: 'SP', desc: '10,10 vs 5: Split at TC≥5' },
        { player: 20, dealer: 6,  type: 'pair', tc: 4,  action: 'SP', desc: '10,10 vs 6: Split at TC≥4' },
    ],
};

class StrategyEngine {
    constructor() {
        this.dealerUpcard = null;
        this.playerCards = [];
        this.otherVisibleCards = [];
    }

    getDealerIndex(upcard) {
        const map = {'2':0,'3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'10':8,'J':8,'Q':8,'K':8,'A':9};
        return map[upcard];
    }

    getDealerValue(upcard) {
        if (upcard === 'A') return 'A';
        if (['10','J','Q','K'].includes(upcard)) return '10';
        return upcard;
    }

    getHandValue(cards) {
        let total = 0;
        let aces = 0;
        for (const card of cards) {
            if (card === 'A') {
                aces++;
                total += 11;
            } else if (['K','Q','J'].includes(card)) {
                total += 10;
            } else {
                total += parseInt(card);
            }
        }
        while (total > 21 && aces > 0) {
            total -= 10;
            aces--;
        }
        return { total, soft: aces > 0 && total <= 21 };
    }

    isPair(cards) {
        if (cards.length !== 2) return false;
        const v1 = ['10','J','Q','K'].includes(cards[0]) ? '10' : cards[0];
        const v2 = ['10','J','Q','K'].includes(cards[1]) ? '10' : cards[1];
        return v1 === v2;
    }

    getPairCard(cards) {
        return ['10','J','Q','K'].includes(cards[0]) ? '10' : cards[0];
    }

    getAdvice(playerCards, dealerUpcard, trueCount = 0) {
        if (!playerCards || playerCards.length < 2 || !dealerUpcard) {
            return { action: null, reason: 'Necesito al menos 2 cartas tuyas y la carta visible de la banca' };
        }

        const dealerIdx = this.getDealerIndex(dealerUpcard);
        if (dealerIdx === undefined) {
            return { action: null, reason: 'Carta de banca no válida' };
        }

        const hand = this.getHandValue(playerCards);
        const dealerVal = this.getDealerValue(dealerUpcard);

        // Check for deviations first
        for (const dev of STRATEGY.deviations) {
            const devDealer = dev.dealer === 'A' ? 'A' : dev.dealer.toString();
            if (dev.type === 'pair' && this.isPair(playerCards)) {
                const pairTotal = hand.total;
                if (pairTotal === dev.player && dealerVal === devDealer && trueCount >= dev.tc) {
                    return { action: dev.action, reason: dev.desc + ` (TC=${trueCount.toFixed(1)})`, deviation: true };
                }
            } else if (dev.type === 'hard' && !hand.soft) {
                if (hand.total === dev.player && dealerVal === devDealer && trueCount >= dev.tc) {
                    return { action: dev.action, reason: dev.desc + ` (TC=${trueCount.toFixed(1)})`, deviation: true };
                }
            }
        }

        // Check pairs
        if (this.isPair(playerCards)) {
            const pairCard = this.getPairCard(playerCards);
            const pairAction = STRATEGY.pairs[pairCard]?.[dealerIdx];
            if (pairAction === 'SP') {
                return { action: 'SP', reason: `Par de ${pairCard} vs ${dealerUpcard}: Dividir` };
            }
        }

        // Soft hands
        if (hand.soft && hand.total >= 13 && hand.total <= 21) {
            const softAction = STRATEGY.soft[hand.total]?.[dealerIdx];
            if (softAction) {
                return this.formatAction(softAction, hand.total, dealerUpcard, true, playerCards.length);
            }
        }

        // Hard hands
        const hardTotal = Math.min(hand.total, 21);
        if (hardTotal >= 5 && hardTotal <= 21) {
            const clampedTotal = Math.min(hardTotal, 21);
            const action = STRATEGY.hard[clampedTotal]?.[dealerIdx] || 'H';
            return this.formatAction(action, clampedTotal, dealerUpcard, false, playerCards.length);
        }

        return { action: 'H', reason: 'Pedir carta' };
    }

    formatAction(code, total, dealer, soft, numCards) {
        const prefix = soft ? `Soft ${total}` : `${total}`;
        const canDouble = numCards === 2;

        switch (code) {
            case 'H':
                return { action: 'HIT', reason: `${prefix} vs ${dealer}: Pedir` };
            case 'S':
                return { action: 'STAND', reason: `${prefix} vs ${dealer}: Plantarse` };
            case 'D':
                if (canDouble) return { action: 'DOUBLE', reason: `${prefix} vs ${dealer}: Doblar` };
                return { action: 'HIT', reason: `${prefix} vs ${dealer}: Pedir (no se puede doblar)` };
            case 'Ds':
                if (canDouble) return { action: 'DOUBLE', reason: `${prefix} vs ${dealer}: Doblar` };
                return { action: 'STAND', reason: `${prefix} vs ${dealer}: Plantarse (no se puede doblar)` };
            case 'SP':
                return { action: 'SPLIT', reason: `${prefix} vs ${dealer}: Dividir` };
            case 'RH':
                return { action: 'SURRENDER', reason: `${prefix} vs ${dealer}: Rendirse (o pedir)` };
            case 'RS':
                return { action: 'SURRENDER', reason: `${prefix} vs ${dealer}: Rendirse (o plantarse)` };
            default:
                return { action: 'HIT', reason: `${prefix} vs ${dealer}: Pedir` };
        }
    }

    getBustProbability(handTotal, remaining) {
        const total = Object.values(remaining).reduce((a, b) => a + b, 0);
        if (total === 0) return 0;
        let bustCards = 0;
        const cardValues = {'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':10,'Q':10,'K':10};
        for (const [card, count] of Object.entries(remaining)) {
            if (handTotal + cardValues[card] > 21) {
                bustCards += count;
            }
        }
        return bustCards / total;
    }

    getDealerBustProbability(dealerUpcard, remaining) {
        // Simplified dealer bust probability based on upcard
        const baseBust = {'2':0.35,'3':0.37,'4':0.40,'5':0.42,'6':0.42,'7':0.26,'8':0.24,'9':0.23,'10':0.23,'J':0.23,'Q':0.23,'K':0.23,'A':0.17};
        return baseBust[dealerUpcard] || 0.28;
    }
}

window.StrategyEngine = StrategyEngine;
