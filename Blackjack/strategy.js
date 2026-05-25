// =============================================================================
// Strategy Engine — Based on:
//   Beat the Dealer (Thorp), Blackbelt in Blackjack (Snyder),
//   Professional Blackjack (Wong)
// =============================================================================

// ===== COUNTING SYSTEMS =====

const COUNTING_SYSTEMS = {
    'Hi-Lo': {
        values: { A:-1, 2:1, 3:1, 4:1, 5:1, 6:1, 7:0, 8:0, 9:0, 10:-1, J:-1, Q:-1, K:-1 },
        balanced: true, level: 1, bc: 0.97, pe: 0.51, ic: 0.76,
    },
    'Hi-Opt II': {
        values: { A:0, 2:1, 3:1, 4:2, 5:2, 6:1, 7:1, 8:0, 9:0, 10:-2, J:-2, Q:-2, K:-2 },
        balanced: true, level: 2, bc: 0.91, pe: 0.67, ic: 0.91, acesSideCount: true,
    },
    'Zen': {
        values: { A:-1, 2:1, 3:1, 4:2, 5:2, 6:2, 7:1, 8:0, 9:0, 10:-2, J:-2, Q:-2, K:-2 },
        balanced: true, level: 2, bc: 0.96, pe: 0.63, ic: 0.85,
    },
    'Halves': {
        values: { A:-1, 2:0.5, 3:1, 4:1, 5:1.5, 6:1, 7:0.5, 8:0, 9:-0.5, 10:-1, J:-1, Q:-1, K:-1 },
        balanced: true, level: 3, bc: 0.99, pe: 0.56, ic: 0.72,
    },
    'KO': {
        values: { A:-1, 2:1, 3:1, 4:1, 5:1, 6:1, 7:1, 8:0, 9:0, 10:-1, J:-1, Q:-1, K:-1 },
        balanced: false, level: 1, bc: 0.98, pe: 0.55, ic: 0.78,
    },
};

// ===== TABLE RULES =====

const DEFAULT_RULES = {
    decks: 6,
    s17: true,
    das: true,
    surrender: true,
    bjPayout: 1.5,
    peek: true,
};

// ===== BASIC STRATEGY (S17, multi-deck, DAS) =====
// Dealer columns: 2, 3, 4, 5, 6, 7, 8, 9, 10, A

function parseTable(obj) {
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
        result[key] = val.trim().split(/\s+/);
    }
    return result;
}

const STRATEGY_S17 = {
    hard: parseTable({
        21: 'S  S  S  S  S  S  S  S  S  S',
        20: 'S  S  S  S  S  S  S  S  S  S',
        19: 'S  S  S  S  S  S  S  S  S  S',
        18: 'S  S  S  S  S  S  S  S  S  S',
        17: 'S  S  S  S  S  S  S  S  S  S',
        16: 'S  S  S  S  S  H  H  RH RH RH',
        15: 'S  S  S  S  S  H  H  H  RH H',
        14: 'S  S  S  S  S  H  H  H  H  H',
        13: 'S  S  S  S  S  H  H  H  H  H',
        12: 'H  H  S  S  S  H  H  H  H  H',
        11: 'D  D  D  D  D  D  D  D  D  D',
        10: 'D  D  D  D  D  D  D  D  H  H',
        9:  'H  D  D  D  D  H  H  H  H  H',
        8:  'H  H  H  H  H  H  H  H  H  H',
        7:  'H  H  H  H  H  H  H  H  H  H',
        6:  'H  H  H  H  H  H  H  H  H  H',
        5:  'H  H  H  H  H  H  H  H  H  H',
    }),
    soft: parseTable({
        21: 'S  S  S  S  S  S  S  S  S  S',
        20: 'S  S  S  S  S  S  S  S  S  S',
        19: 'S  S  S  S  S  S  S  S  S  S',
        18: 'Ds Ds Ds Ds Ds S  S  H  H  H',
        17: 'H  D  D  D  D  H  H  H  H  H',
        16: 'H  H  D  D  D  H  H  H  H  H',
        15: 'H  H  D  D  D  H  H  H  H  H',
        14: 'H  H  H  D  D  H  H  H  H  H',
        13: 'H  H  H  D  D  H  H  H  H  H',
    }),
    pairs: parseTable({
        A:  'SP SP SP SP SP SP SP SP SP SP',
        10: 'S  S  S  S  S  S  S  S  S  S',
        9:  'SP SP SP SP SP S  SP SP S  S',
        8:  'SP SP SP SP SP SP SP SP SP SP',
        7:  'SP SP SP SP SP SP H  H  H  H',
        6:  'SP SP SP SP SP H  H  H  H  H',
        5:  'D  D  D  D  D  D  D  D  H  H',
        4:  'H  H  H  SP SP H  H  H  H  H',
        3:  'SP SP SP SP SP SP H  H  H  H',
        2:  'SP SP SP SP SP SP H  H  H  H',
    }),
};

const H17_OVERRIDES = {
    hard: parseTable({
        17: 'S  S  S  S  S  S  S  S  S  RS',
        15: 'S  S  S  S  S  H  H  H  RH RH',
    }),
    soft: parseTable({
        19: 'S  S  S  S  Ds S  S  S  S  S',
        18: 'Ds Ds Ds Ds Ds S  S  H  H  H',
    }),
};

// ===== DEVIATIONS =====
// Illustrious 18 (Schlesinger) + Fab 4 Surrenders (Snyder) + Wong extras
// tc = index. When TC >= tc: use actionHi. When TC < tc: use actionLo.

const DEVIATIONS = [
    // --- Illustrious 18 ---
    { p: 16, d: '10', t: 'hard', tc: 0,  hi: 'S',  lo: 'H',  fab: false, desc: '16 vs 10: Plantarse' },
    { p: 15, d: '10', t: 'hard', tc: 4,  hi: 'S',  lo: 'H',  fab: false, desc: '15 vs 10: Plantarse' },
    { p: 20, d: '5',  t: 'pair', tc: 5,  hi: 'SP', lo: 'S',  fab: false, desc: '10,10 vs 5: Dividir' },
    { p: 20, d: '6',  t: 'pair', tc: 4,  hi: 'SP', lo: 'S',  fab: false, desc: '10,10 vs 6: Dividir' },
    { p: 10, d: '10', t: 'hard', tc: 4,  hi: 'D',  lo: 'H',  fab: false, desc: '10 vs 10: Doblar' },
    { p: 12, d: '3',  t: 'hard', tc: 2,  hi: 'S',  lo: 'H',  fab: false, desc: '12 vs 3: Plantarse' },
    { p: 12, d: '2',  t: 'hard', tc: 3,  hi: 'S',  lo: 'H',  fab: false, desc: '12 vs 2: Plantarse' },
    { p: 11, d: 'A',  t: 'hard', tc: 1,  hi: 'D',  lo: 'H',  fab: false, desc: '11 vs A: Doblar' },
    { p: 9,  d: '2',  t: 'hard', tc: 1,  hi: 'D',  lo: 'H',  fab: false, desc: '9 vs 2: Doblar' },
    { p: 10, d: 'A',  t: 'hard', tc: 4,  hi: 'D',  lo: 'H',  fab: false, desc: '10 vs A: Doblar' },
    { p: 9,  d: '7',  t: 'hard', tc: 3,  hi: 'D',  lo: 'H',  fab: false, desc: '9 vs 7: Doblar' },
    { p: 16, d: '9',  t: 'hard', tc: 5,  hi: 'S',  lo: 'H',  fab: false, desc: '16 vs 9: Plantarse' },
    { p: 13, d: '2',  t: 'hard', tc: -1, hi: 'S',  lo: 'H',  fab: false, desc: '13 vs 2: Pedir si TC<-1' },
    { p: 13, d: '3',  t: 'hard', tc: -2, hi: 'S',  lo: 'H',  fab: false, desc: '13 vs 3: Pedir si TC<-2' },
    { p: 12, d: '4',  t: 'hard', tc: 0,  hi: 'S',  lo: 'H',  fab: false, desc: '12 vs 4: Pedir si TC<0' },
    { p: 12, d: '5',  t: 'hard', tc: -2, hi: 'S',  lo: 'H',  fab: false, desc: '12 vs 5: Pedir si TC<-2' },
    { p: 12, d: '6',  t: 'hard', tc: -1, hi: 'S',  lo: 'H',  fab: false, desc: '12 vs 6: Pedir si TC<-1' },
    { p: 8,  d: '6',  t: 'hard', tc: 2,  hi: 'D',  lo: 'H',  fab: false, desc: '8 vs 6: Doblar' },

    // --- Fab 4 Surrenders (Snyder) ---
    { p: 14, d: '10', t: 'hard', tc: 3,  hi: 'RH', lo: 'H',  fab: true,  desc: '14 vs 10: Rendirse' },
    { p: 15, d: '10', t: 'hard', tc: 0,  hi: 'RH', lo: 'H',  fab: true,  desc: '15 vs 10: Rendirse' },
    { p: 15, d: '9',  t: 'hard', tc: 2,  hi: 'RH', lo: 'H',  fab: true,  desc: '15 vs 9: Rendirse' },
    { p: 15, d: 'A',  t: 'hard', tc: 1,  hi: 'RH', lo: 'H',  fab: true,  desc: '15 vs A: Rendirse' },
];

// ===== BET RAMP (Snyder 1-12 spread, 6 deck) =====
// TC → units multiplier

const BET_RAMP = [
    { tc: -Infinity, units: 1 },
    { tc: 1, units: 1 },
    { tc: 2, units: 2 },
    { tc: 3, units: 4 },
    { tc: 4, units: 8 },
    { tc: 5, units: 12 },
];

// ===== HOUSE EDGE FACTORS =====

const EDGE_BASE = {
    1: 0.00, 2: 0.31, 4: 0.48, 6: 0.54, 8: 0.57,
};

const EDGE_RULES = {
    h17: 0.22,
    noDas: 0.14,
    noSurrender: 0.08,
    bj6to5: 1.39,
    noPeek: 0.11,
};

// TC-to-edge conversion: ~0.5% per TC for Hi-Lo 6-deck
// For level-2 systems, divide TC by 2 before applying
const EDGE_PER_TC = 0.50;

// ===== KO SPECIFICS =====

function koIRC(decks) { return 4 - (4 * decks); }
function koPivot() { return 4; }

// ===== ENGINE =====

class StrategyEngine {
    constructor(rules) {
        this.rules = { ...DEFAULT_RULES, ...rules };
        this._buildTables();
    }

    setRules(rules) {
        this.rules = { ...DEFAULT_RULES, ...rules };
        this._buildTables();
    }

    _buildTables() {
        this.tables = {
            hard: { ...STRATEGY_S17.hard },
            soft: { ...STRATEGY_S17.soft },
            pairs: { ...STRATEGY_S17.pairs },
        };

        if (!this.rules.s17) {
            for (const [k, v] of Object.entries(H17_OVERRIDES.hard || {})) {
                this.tables.hard[k] = v;
            }
            for (const [k, v] of Object.entries(H17_OVERRIDES.soft || {})) {
                this.tables.soft[k] = v;
            }
        }
    }

    // === Hand evaluation ===

    getHandValue(cards) {
        let total = 0, aces = 0;
        for (const c of cards) {
            if (c === 'A') { aces++; total += 11; }
            else if ('JQK'.includes(c)) total += 10;
            else total += parseInt(c);
        }
        while (total > 21 && aces > 0) { total -= 10; aces--; }
        return { total, soft: aces > 0 && total <= 21 };
    }

    isPair(cards) {
        if (cards.length !== 2) return false;
        const v = c => 'JQK'.includes(c) ? '10' : c;
        return v(cards[0]) === v(cards[1]);
    }

    getPairCard(cards) {
        return 'JQK'.includes(cards[0]) ? '10' : cards[0];
    }

    getDealerIndex(upcard) {
        const m = { 2:0, 3:1, 4:2, 5:3, 6:4, 7:5, 8:6, 9:7, 10:8, J:8, Q:8, K:8, A:9 };
        return m[upcard];
    }

    getDealerValue(upcard) {
        if (upcard === 'A') return 'A';
        if ('JQK'.includes(upcard)) return '10';
        return upcard;
    }

    // === Play advice ===

    getAdvice(playerCards, dealerUpcard, trueCount = 0, countSystem = 'Hi-Lo') {
        if (!playerCards || playerCards.length < 2 || !dealerUpcard) {
            return { action: null, reason: 'Necesito 2+ cartas tuyas y carta visible banca' };
        }

        const dIdx = this.getDealerIndex(dealerUpcard);
        if (dIdx === undefined) return { action: null, reason: 'Carta banca no valida' };

        const hand = this.getHandValue(playerCards);
        const dVal = this.getDealerValue(dealerUpcard);

        // Normalize TC for level-2 systems
        const sys = COUNTING_SYSTEMS[countSystem];
        const effectiveTC = (sys && sys.level === 2) ? trueCount / 2 : trueCount;

        // Check deviations (Illustrious 18 + Fab4)
        const deviation = this._checkDeviation(hand, playerCards, dVal, effectiveTC);
        if (deviation) {
            return this._formatDeviation(deviation, hand, dealerUpcard, playerCards.length, effectiveTC);
        }

        // Check pairs
        if (this.isPair(playerCards)) {
            const pc = this.getPairCard(playerCards);
            const pairAction = this.tables.pairs[pc]?.[dIdx];
            if (pairAction === 'SP') {
                return { action: 'SPLIT', reason: `Par ${pc} vs ${dealerUpcard}: Dividir`, deviation: false };
            }
        }

        // Soft hands
        if (hand.soft && hand.total >= 13 && hand.total <= 21) {
            const act = this.tables.soft[hand.total]?.[dIdx];
            if (act) return this._formatAction(act, hand.total, dealerUpcard, true, playerCards.length);
        }

        // Hard hands
        const ht = Math.min(hand.total, 21);
        if (ht >= 5 && ht <= 21) {
            const act = this.tables.hard[ht]?.[dIdx] || 'H';
            return this._formatAction(act, ht, dealerUpcard, false, playerCards.length);
        }

        return { action: 'HIT', reason: 'Pedir', deviation: false };
    }

    _checkDeviation(hand, cards, dealerVal, tc) {
        const isPair = this.isPair(cards);

        for (const dev of DEVIATIONS) {
            if (dev.fab && !this.rules.surrender) continue;

            const matchDealer = dev.d === dealerVal;
            if (!matchDealer) continue;

            let matchPlayer = false;
            if (dev.t === 'pair' && isPair) {
                matchPlayer = hand.total === dev.p;
            } else if (dev.t === 'hard' && !hand.soft) {
                matchPlayer = hand.total === dev.p;
            } else if (dev.t === 'soft' && hand.soft) {
                matchPlayer = hand.total === dev.p;
            }

            if (!matchPlayer) continue;

            // Composition-dependent: 16 vs 10 with 3+ cards (Wong)
            let adjustedTC = dev.tc;
            if (dev.p === 16 && dev.d === '10' && dev.t === 'hard' && cards.length >= 3) {
                adjustedTC = -1;
            }

            const action = tc >= adjustedTC ? dev.hi : dev.lo;
            const isDeviating = tc >= adjustedTC ? (dev.hi !== dev.lo) : false;

            if (isDeviating || tc < adjustedTC) {
                return { ...dev, resolvedAction: action, isDeviating, effectiveTC: tc, adjustedTC };
            }
        }
        return null;
    }

    _formatDeviation(dev, hand, dealer, numCards, tc) {
        const canDouble = numCards === 2;
        let action = dev.resolvedAction;
        let reason = dev.desc;

        if (action === 'D' && !canDouble) action = 'H';
        if (action === 'Ds' && !canDouble) action = 'S';
        if ((action === 'RH' || action === 'RS') && !this.rules.surrender) {
            action = action === 'RH' ? 'H' : 'S';
        }

        const actionMap = { H:'HIT', S:'STAND', D:'DOUBLE', Ds:'DOUBLE', SP:'SPLIT', RH:'SURRENDER', RS:'SURRENDER' };
        const tcStr = tc >= 0 ? `+${tc.toFixed(1)}` : tc.toFixed(1);

        return {
            action: actionMap[action] || action,
            reason: `${reason} (TC=${tcStr})`,
            deviation: dev.isDeviating,
            fab: dev.fab,
        };
    }

    _formatAction(code, total, dealer, soft, numCards) {
        const prefix = soft ? `Soft ${total}` : `${total}`;
        const canDouble = numCards === 2;

        let action = code;
        if (action === 'D' && !canDouble) action = 'H';
        if (action === 'Ds' && !canDouble) action = 'S';
        if ((action === 'RH' || action === 'RS') && !this.rules.surrender) {
            action = action === 'RH' ? 'H' : 'S';
        }

        const map = {
            H:  { a: 'HIT',       r: 'Pedir' },
            S:  { a: 'STAND',     r: 'Plantarse' },
            D:  { a: 'DOUBLE',    r: 'Doblar' },
            Ds: { a: 'DOUBLE',    r: 'Doblar' },
            SP: { a: 'SPLIT',     r: 'Dividir' },
            RH: { a: 'SURRENDER', r: 'Rendirse (o pedir)' },
            RS: { a: 'SURRENDER', r: 'Rendirse (o plantarse)' },
        };

        const m = map[action] || { a: 'HIT', r: 'Pedir' };
        return { action: m.a, reason: `${prefix} vs ${dealer}: ${m.r}`, deviation: false };
    }

    // === Insurance (Thorp: TC >= +3) ===

    getInsurance(trueCount, countSystem = 'Hi-Lo') {
        const sys = COUNTING_SYSTEMS[countSystem];
        const tc = (sys && sys.level === 2) ? trueCount / 2 : trueCount;
        return { take: tc >= 3, tc, threshold: 3 };
    }

    // === Bet sizing (Snyder ramp) ===

    getBetUnits(trueCount, countSystem = 'Hi-Lo') {
        const sys = COUNTING_SYSTEMS[countSystem];
        const tc = (sys && sys.level === 2) ? trueCount / 2 : trueCount;

        let units = 1;
        for (const step of BET_RAMP) {
            if (tc >= step.tc) units = step.units;
        }
        return { units, tc, maxBet: tc >= 5 };
    }

    // === Wong signal (Wong: in at TC>=+1, out at TC<-1) ===

    getWong(trueCount, countSystem = 'Hi-Lo') {
        const sys = COUNTING_SYSTEMS[countSystem];
        const tc = (sys && sys.level === 2) ? trueCount / 2 : trueCount;

        if (tc >= 2) return { signal: 'FAVORABLE', color: 'positive', desc: 'Mesa caliente — apuesta fuerte' };
        if (tc >= 1) return { signal: 'JUGAR', color: 'neutral', desc: 'Ventaja marginal' };
        if (tc >= -1) return { signal: 'MINIMO', color: 'warning', desc: 'Sin ventaja — apuesta minima' };
        return { signal: 'SALIR', color: 'negative', desc: 'Mesa fria — Wong out' };
    }

    // === Edge calculation ===

    getBaseEdge() {
        const d = this.rules.decks;
        let edge = EDGE_BASE[d] || EDGE_BASE[6];
        if (!this.rules.s17) edge += EDGE_RULES.h17;
        if (!this.rules.das) edge += EDGE_RULES.noDas;
        if (!this.rules.surrender) edge += EDGE_RULES.noSurrender;
        if (this.rules.bjPayout < 1.5) edge += EDGE_RULES.bj6to5;
        if (!this.rules.peek) edge += EDGE_RULES.noPeek;
        return edge;
    }

    getEdge(trueCount, countSystem = 'Hi-Lo') {
        const sys = COUNTING_SYSTEMS[countSystem];
        const tc = (sys && sys.level === 2) ? trueCount / 2 : trueCount;
        return -this.getBaseEdge() + (tc * EDGE_PER_TC);
    }

    // === Penetration ===

    getPenetration(totalCards, remainingCards) {
        if (totalCards <= 0) return 0;
        return (totalCards - remainingCards) / totalCards;
    }

    // === Probabilities ===

    getBustProbability(handTotal, remaining) {
        const total = Object.values(remaining).reduce((a, b) => a + b, 0);
        if (total === 0) return 0;
        const vals = { A:1, 2:2, 3:3, 4:4, 5:5, 6:6, 7:7, 8:8, 9:9, 10:10, J:10, Q:10, K:10 };
        let bust = 0;
        for (const [card, count] of Object.entries(remaining)) {
            if (handTotal + vals[card] > 21) bust += count;
        }
        return bust / total;
    }

    getDealerBustProbability(dealerUpcard, remaining) {
        const s17bust = { 2:0.356, 3:0.374, 4:0.403, 5:0.428, 6:0.423, 7:0.262, 8:0.244, 9:0.230, 10:0.233, J:0.233, Q:0.233, K:0.233, A:0.170 };
        const h17bust = { 2:0.356, 3:0.374, 4:0.403, 5:0.428, 6:0.423, 7:0.262, 8:0.244, 9:0.230, 10:0.233, J:0.233, Q:0.233, K:0.233, A:0.200 };
        const table = this.rules.s17 ? s17bust : h17bust;
        return table[dealerUpcard] || 0.28;
    }

    // === KO helpers ===

    getKOInfo(decks) {
        return { irc: koIRC(decks), pivot: koPivot() };
    }
}

window.StrategyEngine = StrategyEngine;
window.COUNTING_SYSTEMS = COUNTING_SYSTEMS;
window.DEFAULT_RULES = DEFAULT_RULES;
