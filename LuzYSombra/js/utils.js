
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

// Formatear números grandes
export function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.floor(num).toString();
}

// Limitar valor entre min y max
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Número aleatorio en rango
export function randomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Probabilidad (0-1)
export function chance(probability) {
    return Math.random() < probability;
}

// Seleccionar elemento aleatorio de array
export function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Sleep/delay
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Debounce function
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
export function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Interpolación lineal
export function lerp(start, end, t) {
    return start + (end - start) * t;
}

// Generar ID único
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Deep clone object
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Verificar si es móvil
export function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Verificar si soporta touch
export function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// Copiar al portapapeles
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        console.error('Failed to copy:', e);
        return false;
    }
}

// Vibrar (si está disponible)
export function vibrate(pattern = 50) {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}

// Calcular porcentaje
export function percentage(value, max) {
    return clamp((value / max) * 100, 0, 100);
}
