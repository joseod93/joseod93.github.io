/* ============================================
   CRAFTEO INFINITO  —  Motor del juego
   ============================================ */

(function () {
  'use strict';

  // ========== DICCIONARIO DE COMBINACIONES ==========

  const combinationsMap = {};
  const allResultEmojis = {};
  let totalUniqueElements = 0;

  function buildDictionary() {
    const uniqueNames = new Set();

    INITIAL_ELEMENTS.forEach(el => {
      allResultEmojis[el.name] = el.emoji;
      uniqueNames.add(el.name);
    });

    for (const [a, b, result, emoji] of RECIPES) {
      const key = makeKey(a, b);
      if (!combinationsMap[key]) {
        combinationsMap[key] = { name: result, emoji };
      }
      if (!allResultEmojis[result]) {
        allResultEmojis[result] = emoji;
      }
      uniqueNames.add(result);
    }

    totalUniqueElements = uniqueNames.size;
  }

  function makeKey(a, b) {
    return [a, b].sort().join('+');
  }

  function getCombination(a, b) {
    return combinationsMap[makeKey(a, b)] || null;
  }

  // ========== ESTADO DEL JUEGO ==========

  const STORAGE_KEY = 'crafteo-infinito-save';
  let discovered = {};
  let canvasItems = [];
  let nextItemId = 0;

  function loadGame() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        discovered = JSON.parse(saved);
        return;
      }
    } catch (_) { /* ignore */ }
    resetDiscovered();
  }

  function resetDiscovered() {
    discovered = {};
    INITIAL_ELEMENTS.forEach(el => {
      discovered[el.name] = el.emoji;
    });
  }

  function saveGame() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(discovered));
    } catch (_) { /* ignore */ }
  }

  function resetGame() {
    resetDiscovered();
    clearCanvas();
    saveGame();
    renderSidebar();
  }

  // ========== REFERENCIAS DOM ==========

  const $sidebar = document.getElementById('elements-list');
  const $canvas = document.getElementById('canvas');
  const $search = document.getElementById('search');
  const $stats = document.getElementById('stats');
  const $toast = document.getElementById('toast');
  const $noResultToast = document.getElementById('no-result-toast');
  const $resetModal = document.getElementById('reset-modal');

  // ========== SIDEBAR ==========

  function renderSidebar() {
    const filter = $search.value.toLowerCase().trim();
    $sidebar.innerHTML = '';

    const sorted = Object.entries(discovered)
      .sort((a, b) => a[0].localeCompare(b[0], 'es'));

    for (const [name, emoji] of sorted) {
      if (filter && !name.toLowerCase().includes(filter)) continue;
      const chip = document.createElement('div');
      chip.className = 'element-chip';
      chip.textContent = emoji + ' ' + name;
      chip.dataset.name = name;
      chip.dataset.emoji = emoji;
      $sidebar.appendChild(chip);
    }

    updateStats();
  }

  function highlightNewChip(name) {
    const chips = $sidebar.querySelectorAll('.element-chip');
    for (const chip of chips) {
      if (chip.dataset.name === name) {
        chip.classList.add('new-discovery');
        chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        break;
      }
    }
  }

  function updateStats() {
    const count = Object.keys(discovered).length;
    $stats.textContent = count + ' / ' + totalUniqueElements + ' descubiertos';
  }

  // ========== CANVAS ==========

  function addToCanvas(name, emoji, x, y, animate) {
    const item = document.createElement('div');
    item.className = 'canvas-item';
    if (animate) item.classList.add('pop-in');
    item.textContent = emoji + ' ' + name;
    item.dataset.name = name;
    item.dataset.emoji = emoji;
    item.dataset.itemId = String(nextItemId++);

    const cRect = $canvas.getBoundingClientRect();
    const clampedX = Math.max(0, Math.min(x, cRect.width - 100));
    const clampedY = Math.max(0, Math.min(y, cRect.height - 40));
    item.style.left = clampedX + 'px';
    item.style.top = clampedY + 'px';

    setupCanvasItemEvents(item);
    $canvas.appendChild(item);
    canvasItems.push(item);

    $canvas.classList.add('has-items');
    return item;
  }

  function removeFromCanvas(item) {
    const idx = canvasItems.indexOf(item);
    if (idx !== -1) canvasItems.splice(idx, 1);
    item.remove();
    if (canvasItems.length === 0) $canvas.classList.remove('has-items');
  }

  function clearCanvas() {
    canvasItems.forEach(item => item.remove());
    canvasItems = [];
    $canvas.classList.remove('has-items');
  }

  // ========== COMBINACIÓN ==========

  function tryCombine(sourceInfo, targetItem) {
    const result = getCombination(sourceInfo.name, targetItem.dataset.name);
    if (!result) {
      targetItem.classList.add('shake');
      setTimeout(() => targetItem.classList.remove('shake'), 400);
      showNoResult();
      return false;
    }

    const targetRect = targetItem.getBoundingClientRect();
    const cRect = $canvas.getBoundingClientRect();
    const midX = targetRect.left - cRect.left + targetRect.width / 2 - 50;
    const midY = targetRect.top - cRect.top + targetRect.height / 2 - 16;

    targetItem.classList.add('merge-out');
    if (sourceInfo.canvasItem) {
      sourceInfo.canvasItem.classList.add('merge-out');
    }

    setTimeout(() => {
      if (sourceInfo.canvasItem) removeFromCanvas(sourceInfo.canvasItem);
      removeFromCanvas(targetItem);

      const isNew = !discovered[result.name];
      const newItem = addToCanvas(result.name, result.emoji, midX, midY, true);

      if (isNew) {
        newItem.classList.add('discovery');
        discovered[result.name] = result.emoji;
        saveGame();
        renderSidebar();
        highlightNewChip(result.name);
        showDiscoveryToast(result.name, result.emoji);
        spawnParticles(targetRect.left + targetRect.width / 2,
                       targetRect.top + targetRect.height / 2);
      }
    }, 250);

    return true;
  }

  // ========== DRAG & DROP  (Pointer Events) ==========

  let dragState = null;

  function setupSidebarEvents() {
    $sidebar.addEventListener('pointerdown', onSidebarPointerDown);
  }

  function onSidebarPointerDown(e) {
    const chip = e.target.closest('.element-chip');
    if (!chip) return;
    e.preventDefault();

    const name = chip.dataset.name;
    const emoji = chip.dataset.emoji;

    const clone = document.createElement('div');
    clone.className = 'drag-clone';
    clone.textContent = emoji + ' ' + name;
    document.body.appendChild(clone);

    const hw = clone.offsetWidth / 2;
    const hh = clone.offsetHeight / 2;
    clone.style.left = (e.clientX - hw) + 'px';
    clone.style.top = (e.clientY - hh) + 'px';

    dragState = {
      type: 'sidebar',
      name: name,
      emoji: emoji,
      clone: clone,
      halfW: hw,
      halfH: hh,
      pointerId: e.pointerId
    };

    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragUp);
    document.addEventListener('pointercancel', onDragCancel);
  }

  function setupCanvasItemEvents(item) {
    item.addEventListener('pointerdown', onCanvasItemPointerDown);
  }

  function onCanvasItemPointerDown(e) {
    e.preventDefault();
    e.stopPropagation();
    const item = e.currentTarget;
    const rect = item.getBoundingClientRect();
    const cRect = $canvas.getBoundingClientRect();

    item.classList.add('dragging');
    item.style.zIndex = 1000;

    dragState = {
      type: 'canvas',
      name: item.dataset.name,
      emoji: item.dataset.emoji,
      canvasItem: item,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      pointerId: e.pointerId,
      lastHighlight: null
    };

    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragUp);
    document.addEventListener('pointercancel', onDragCancel);
  }

  function onDragMove(e) {
    if (!dragState) return;
    e.preventDefault();

    if (dragState.type === 'sidebar') {
      dragState.clone.style.left = (e.clientX - dragState.halfW) + 'px';
      dragState.clone.style.top = (e.clientY - dragState.halfH) + 'px';
    } else {
      const cRect = $canvas.getBoundingClientRect();
      dragState.canvasItem.style.left = (e.clientX - cRect.left - dragState.offsetX) + 'px';
      dragState.canvasItem.style.top = (e.clientY - cRect.top - dragState.offsetY) + 'px';
    }

    updateHighlight(e.clientX, e.clientY);
  }

  function updateHighlight(cx, cy) {
    if (dragState.lastHighlight) {
      dragState.lastHighlight.classList.remove('highlight-target');
      dragState.lastHighlight = null;
    }

    const excludeId = dragState.type === 'canvas'
      ? dragState.canvasItem.dataset.itemId
      : null;
    const target = findClosestItem(cx, cy, excludeId);

    if (target) {
      target.classList.add('highlight-target');
      dragState.lastHighlight = target;
    }
  }

  function onDragUp(e) {
    if (!dragState) return;
    e.preventDefault();
    cleanupDragListeners();

    if (dragState.lastHighlight) {
      dragState.lastHighlight.classList.remove('highlight-target');
    }

    const cRect = $canvas.getBoundingClientRect();
    const onCanvas = e.clientX >= cRect.left && e.clientX <= cRect.right &&
                     e.clientY >= cRect.top && e.clientY <= cRect.bottom;

    if (dragState.type === 'sidebar') {
      dragState.clone.remove();

      if (onCanvas) {
        const excludeId = null;
        const target = findClosestItem(e.clientX, e.clientY, excludeId);

        if (target) {
          tryCombine({ name: dragState.name, emoji: dragState.emoji, canvasItem: null }, target);
        } else {
          const x = e.clientX - cRect.left - dragState.halfW;
          const y = e.clientY - cRect.top - dragState.halfH;
          addToCanvas(dragState.name, dragState.emoji, x, y, true);
        }
      }
    } else {
      dragState.canvasItem.classList.remove('dragging');
      dragState.canvasItem.style.zIndex = '';

      const excludeId = dragState.canvasItem.dataset.itemId;
      const target = findClosestItem(e.clientX, e.clientY, excludeId);

      if (target) {
        tryCombine({
          name: dragState.name,
          emoji: dragState.emoji,
          canvasItem: dragState.canvasItem
        }, target);
      }
    }

    dragState = null;
  }

  function onDragCancel() {
    if (!dragState) return;
    cleanupDragListeners();

    if (dragState.lastHighlight) {
      dragState.lastHighlight.classList.remove('highlight-target');
    }

    if (dragState.type === 'sidebar') {
      dragState.clone.remove();
    } else {
      dragState.canvasItem.classList.remove('dragging');
      dragState.canvasItem.style.zIndex = '';
    }

    dragState = null;
  }

  function cleanupDragListeners() {
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragUp);
    document.removeEventListener('pointercancel', onDragCancel);
  }

  function findClosestItem(cx, cy, excludeId) {
    let closest = null;
    let closestDist = Infinity;
    const threshold = 80;

    for (const item of canvasItems) {
      if (excludeId !== null && item.dataset.itemId === excludeId) continue;
      const rect = item.getBoundingClientRect();
      const itemCX = rect.left + rect.width / 2;
      const itemCY = rect.top + rect.height / 2;
      const dist = Math.hypot(cx - itemCX, cy - itemCY);
      if (dist < threshold && dist < closestDist) {
        closest = item;
        closestDist = dist;
      }
    }
    return closest;
  }

  // ========== DOBLE CLICK PARA ELIMINAR ==========

  function setupCanvasDoubleTap() {
    $canvas.addEventListener('dblclick', function (e) {
      const item = e.target.closest('.canvas-item');
      if (item) {
        item.classList.add('merge-out');
        setTimeout(() => removeFromCanvas(item), 250);
      }
    });
  }

  // ========== TOASTS ==========

  let toastTimer = null;
  let noResultTimer = null;

  function showDiscoveryToast(name, emoji) {
    clearTimeout(toastTimer);
    $toast.textContent = '🎉 ¡Nuevo! ' + emoji + ' ' + name;
    $toast.classList.add('show');
    toastTimer = setTimeout(() => $toast.classList.remove('show'), 2500);
  }

  function showNoResult() {
    clearTimeout(noResultTimer);
    $noResultToast.textContent = '🚫 No se pueden combinar';
    $noResultToast.classList.add('show');
    noResultTimer = setTimeout(() => $noResultToast.classList.remove('show'), 1200);
  }

  // ========== PARTÍCULAS ==========

  function spawnParticles(cx, cy) {
    const colors = ['#7c5cfc', '#c084fc', '#38bdf8', '#4ade80', '#facc15', '#fb7185'];
    const count = 12;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      p.style.background = colors[i % colors.length];

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const dist = 40 + Math.random() * 60;
      p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');

      document.body.appendChild(p);
      setTimeout(() => p.remove(), 800);
    }
  }

  // ========== MODAL DE REINICIO ==========

  function setupModal() {
    document.getElementById('btn-reset').addEventListener('click', () => {
      $resetModal.classList.remove('hidden');
    });

    document.getElementById('modal-cancel').addEventListener('click', () => {
      $resetModal.classList.add('hidden');
    });

    document.getElementById('modal-confirm').addEventListener('click', () => {
      $resetModal.classList.add('hidden');
      resetGame();
    });

    $resetModal.addEventListener('click', (e) => {
      if (e.target === $resetModal) $resetModal.classList.add('hidden');
    });
  }

  // ========== BOTÓN LIMPIAR ==========

  function setupClearButton() {
    document.getElementById('btn-clear').addEventListener('click', clearCanvas);
  }

  // ========== BÚSQUEDA ==========

  function setupSearch() {
    $search.addEventListener('input', renderSidebar);
  }

  // ========== PREVENCIÓN DE SCROLL EN TOUCH ==========

  function preventTouchScroll() {
    document.addEventListener('touchmove', function (e) {
      if (dragState) e.preventDefault();
    }, { passive: false });
  }

  // ========== INICIALIZACIÓN ==========

  function init() {
    buildDictionary();
    loadGame();
    renderSidebar();
    setupSidebarEvents();
    setupCanvasDoubleTap();
    setupModal();
    setupClearButton();
    setupSearch();
    preventTouchScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
