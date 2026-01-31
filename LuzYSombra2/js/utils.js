
export const $ = sel => document.querySelector(sel);
export const now = () => Date.now();

export function fmtMs(ms) {
    const s = Math.ceil(ms / 1000);
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60); const r = s % 60;
    return m + 'm' + (r ? (' ' + r + 's') : '');
}

export function getRandomPos(existing, minDist = 40) {
    let x, y, ok = false;
    while (!ok) {
        x = 20 + Math.random() * 260;
        y = 20 + Math.random() * 180;
        ok = existing.every(p => Math.hypot(p.x - x, p.y - y) >= minDist);
    }
    return { x, y };
}

// Simple toast/log system - will be initialized or imported by UI but exposed here for convenience if needed,
// OR we can keep them in UI and import UI helpers in other modules.
// For now, let's keep pure utils here. Log and Toast depend on DOM elements, so they fit better in UI or a dedicated Logger module.
// However, to avoid circular deps (Game -> UI -> Game), we'll put them in UI and import UI in Game/Actions.
