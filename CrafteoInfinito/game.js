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

  // ========== OBJETIVOS ==========

  const GOALS = [
    { name: "Arcoíris", emoji: "🌈", hint: "Agua + Sol", desc: "¡El cielo se llena de colores!" },
    { name: "Planta", emoji: "🌱", hint: "Lluvia + Tierra", desc: "¡La vida comienza a brotar!" },
    { name: "Metal", emoji: "⚙️", hint: "Fuego + Piedra", desc: "¡Dominas la metalurgia!" },
    { name: "Vida", emoji: "🧬", hint: "Electricidad + Pantano", desc: "¡Has creado vida!" },
    { name: "Humano", emoji: "👤", hint: "Animal + Animal", desc: "¡La humanidad ha nacido!" },
    { name: "Espada", emoji: "⚔️", hint: "Fuego + Metal", desc: "¡Forjas tu primera arma!" },
    { name: "Ciudad", emoji: "🏙️", hint: "Pueblo + Pueblo", desc: "¡La civilización florece!" },
    { name: "Unicornio", emoji: "🦄", hint: "Arcoíris + Caballo", desc: "¡Magia pura!" },
    { name: "Cohete", emoji: "🚀", hint: "Espacio + Motor", desc: "¡Rumbo a las estrellas!" },
    { name: "Utopía", emoji: "🌅", hint: "Mundo + Paz", desc: "¡Has alcanzado la perfección!" },
  ];

  const GOAL_STORAGE_KEY = 'crafteo-infinito-goal';
  let currentGoalIndex = 0;

  function loadGoalProgress() {
    try {
      const saved = localStorage.getItem(GOAL_STORAGE_KEY);
      if (saved !== null) {
        currentGoalIndex = parseInt(saved, 10);
        if (isNaN(currentGoalIndex)) currentGoalIndex = 0;
      }
    } catch (_) { /* ignore */ }
    // Skip already-discovered goals
    while (currentGoalIndex < GOALS.length && discovered[GOALS[currentGoalIndex].name]) {
      currentGoalIndex++;
    }
  }

  function saveGoalProgress() {
    try {
      localStorage.setItem(GOAL_STORAGE_KEY, String(currentGoalIndex));
    } catch (_) { /* ignore */ }
  }

  function getCurrentGoal() {
    return currentGoalIndex < GOALS.length ? GOALS[currentGoalIndex] : null;
  }

  function checkGoalCompletion(elementName) {
    const goal = getCurrentGoal();
    if (!goal || elementName !== goal.name) return;
    showGoalComplete(goal);
  }

  function advanceGoal() {
    currentGoalIndex++;
    // Skip already-discovered goals
    while (currentGoalIndex < GOALS.length && discovered[GOALS[currentGoalIndex].name]) {
      currentGoalIndex++;
    }
    saveGoalProgress();
    renderGoalTracker();
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
    currentGoalIndex = 0;
    saveGoalProgress();
    saveGame();
    renderSidebar();
    renderGoalTracker();
  }

  // ========== REFERENCIAS DOM ==========

  const $sidebar = document.getElementById('elements-list');
  const $canvas = document.getElementById('canvas');
  const $search = document.getElementById('search');
  const $stats = document.getElementById('stats');
  const $toast = document.getElementById('toast');
  const $noResultToast = document.getElementById('no-result-toast');
  const $goalTarget = document.getElementById('goal-target');
  const $goalFill = document.getElementById('goal-progress-fill');
  const $goalToast = document.getElementById('goal-toast');
  const $goalOverlay = document.getElementById('goal-complete-overlay');
  const $goalCompleteEmoji = document.getElementById('goal-complete-emoji');
  const $goalCompleteTitle = document.getElementById('goal-complete-title');
  const $goalCompleteDesc = document.getElementById('goal-complete-desc');

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

  function renderGoalTracker() {
    const goal = getCurrentGoal();
    if (!goal) {
      $goalTarget.textContent = '🏆 ¡Todos completados!';
      $goalFill.style.width = '100%';
      $goalFill.classList.add('goal-complete');
      return;
    }
    $goalTarget.textContent = goal.emoji + ' ' + goal.name;
    $goalFill.classList.remove('goal-complete');
    const pct = (currentGoalIndex / GOALS.length) * 100;
    $goalFill.style.width = pct + '%';
  }

  function showGoalComplete(goal) {
    $goalCompleteEmoji.textContent = goal.emoji;
    $goalCompleteTitle.textContent = '¡Objetivo completado!';
    $goalCompleteDesc.textContent = goal.desc;
    $goalOverlay.classList.remove('hidden');
    spawnGoalFireworks();
  }

  function spawnGoalFireworks() {
    const colors = ['#7c5cfc', '#c084fc', '#38bdf8', '#4ade80', '#facc15', '#fb7185', '#f472b6'];
    for (let burst = 0; burst < 3; burst++) {
      setTimeout(() => {
        const cx = window.innerWidth * (0.25 + Math.random() * 0.5);
        const cy = window.innerHeight * (0.2 + Math.random() * 0.4);
        for (let i = 0; i < 20; i++) {
          const p = document.createElement('div');
          p.className = 'particle';
          p.style.left = cx + 'px';
          p.style.top = cy + 'px';
          p.style.background = colors[Math.floor(Math.random() * colors.length)];
          p.style.width = '8px';
          p.style.height = '8px';
          const angle = (Math.PI * 2 * i) / 20 + (Math.random() - 0.5);
          const dist = 60 + Math.random() * 100;
          p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
          p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
          document.body.appendChild(p);
          setTimeout(() => p.remove(), 1000);
        }
      }, burst * 300);
    }
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
        checkGoalCompletion(result.name);
      }
    }, 250);

    return true;
  }

  // ========== DRAG & DROP  (Pointer Events) ==========

  let dragState = null;

  let sidebarTapTimer = null;
  let sidebarDragStarted = false;

  function setupSidebarEvents() {
    $sidebar.addEventListener('pointerdown', onSidebarPointerDown);
  }

  function onSidebarPointerDown(e) {
    const chip = e.target.closest('.element-chip');
    if (!chip) return;
    e.preventDefault();

    const name = chip.dataset.name;
    const emoji = chip.dataset.emoji;
    const startX = e.clientX;
    const startY = e.clientY;
    sidebarDragStarted = false;

    const clone = document.createElement('div');
    clone.className = 'drag-clone';
    clone.textContent = emoji + ' ' + name;
    clone.style.visibility = 'hidden';
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
      pointerId: e.pointerId,
      startX: startX,
      startY: startY
    };

    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragUp);
    document.addEventListener('pointercancel', onDragCancel);
  }

  function tapAddToCanvas(name, emoji) {
    const cRect = $canvas.getBoundingClientRect();
    const padding = 30;
    const x = padding + Math.random() * (cRect.width - 2 * padding - 100);
    const y = padding + Math.random() * (cRect.height - 2 * padding - 40);
    addToCanvas(name, emoji, x, y, true);
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
      if (!sidebarDragStarted) {
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        if (Math.hypot(dx, dy) < 8) return;
        sidebarDragStarted = true;
        dragState.clone.style.visibility = '';
      }
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

      if (!sidebarDragStarted) {
        // Tap: add element to canvas directly
        tapAddToCanvas(dragState.name, dragState.emoji);
      } else if (onCanvas) {
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

  // ========== BOTÓN LIMPIAR ==========

  function setupClearButton() {
    document.getElementById('btn-clear').addEventListener('click', clearCanvas);
  }

  // ========== GOAL MODAL ==========

  function setupGoalModal() {
    document.getElementById('goal-next-btn').addEventListener('click', () => {
      $goalOverlay.classList.add('hidden');
      advanceGoal();
    });
    $goalOverlay.addEventListener('click', (e) => {
      if (e.target === $goalOverlay) {
        $goalOverlay.classList.add('hidden');
        advanceGoal();
      }
    });
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
    loadGoalProgress();
    renderSidebar();
    renderGoalTracker();
    setupSidebarEvents();
    setupCanvasDoubleTap();
    setupGoalModal();
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
