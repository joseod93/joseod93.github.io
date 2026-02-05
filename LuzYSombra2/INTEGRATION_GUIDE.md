# 🔌 Guía de Integración - Nuevos Módulos

Esta guía te ayudará a integrar todos los nuevos módulos en tu juego.

## 📦 Módulos Creados

1. **storage.js** - Gestión de estado
2. **utils.js** - Utilidades
3. **events.js** - Eventos aleatorios
4. **tutorial.js** - Tutorial interactivo
5. **notifications.js** - Notificaciones
6. **achievements.js** - Sistema de logros
7. **quests.js** - Sistema de misiones
8. **statistics.js** - Estadísticas
9. **animations.css** - Animaciones
10. **integrator.js** - Módulo de integración (¡NUEVO!)

## 🚀 Opción 1: Integración Automática con Integrator.js

El módulo `integrator.js` proporciona hooks listos para usar. Solo necesitas importarlo y llamar las funciones en los lugares apropiados.

### Paso 1: Importar en app.js

```javascript
import integrator from './integrator.js';
```

### Paso 2: Inicializar al Cargar el Juego

Busca donde se carga el estado (probablemente al final de app.js o en game.js):

```javascript
// Después de loadState()
integrator.initializeSystems(S);
```

### Paso 3: Integrar en Acciones

#### Cuando se recolecta un recurso:

```javascript
// En la función que añade recursos
function addResource(resource, amount) {
    S.resources[resource] = (S.resources[resource] || 0) + amount;
    
    // AÑADIR ESTA LÍNEA:
    integrator.onResourceGathered(S, resource, amount, log);
    
    renderResources();
}
```

#### Cuando se realiza una acción (explorar, craftear, etc.):

```javascript
// Después de explorar
function explore() {
    // ... código existente ...
    
    // AÑADIR ESTA LÍNEA:
    integrator.onActionPerformed(S, 'explore', log);
}

// Después de craftear
function craft(item) {
    // ... código existente ...
    
    // AÑADIR ESTA LÍNEA:
    integrator.onItemCrafted(S, item, 1, log);
}
```

#### Cuando se completa una expedición:

```javascript
// En la función que procesa expediciones completadas
function completeExpedition() {
    const region = S.expedition.region;
    // ... código existente ...
    
    // AÑADIR ESTA LÍNEA:
    integrator.onExpeditionCompleted(S, region, log);
}
```

#### Cuando se derrota un boss:

```javascript
// En la función de combate, cuando ganas
function defeatBoss() {
    const bossName = combatState.boss.name;
    const damageDealt = combatState.totalDamageDealt || 0;
    const damageTaken = combatState.totalDamageTaken || 0;
    const duration = Date.now() - combatState.startTime;
    
    // ... código existente ...
    
    // AÑADIR ESTA LÍNEA:
    integrator.onBossDefeated(S, bossName, damageDealt, damageTaken, duration, log);
}
```

#### Cuando se recluta un aldeano:

```javascript
// En la función de reclutamiento
function recruitVillager() {
    S.people.villagers++;
    // ... código existente ...
    
    // AÑADIR ESTA LÍNEA:
    integrator.onVillagerRecruited(S, log);
}
```

#### Cuando se gana renombre:

```javascript
// En la función que añade renombre
function addRenown(amount) {
    S.stats.renown += amount;
    
    // AÑADIR ESTA LÍNEA:
    integrator.onRenownGained(S, amount, log);
}
```

#### En el Game Tick:

```javascript
// En la función que se ejecuta cada segundo/tick
function gameTick() {
    // ... código existente ...
    
    // AÑADIR ESTA LÍNEA (al final del tick):
    integrator.onGameTick(S, log);
}
```

#### Cuando aparece un boss:

```javascript
// Cuando se genera una amenaza
function spawnBoss(boss) {
    S.threat = boss;
    // ... código existente ...
    
    // AÑADIR ESTA LÍNEA:
    integrator.onBossSpawned(S, boss.name, boss.region);
}
```

#### Cuando se construye algo:

```javascript
// Después de construir
function build(building) {
    S.unlocked[building] = true;
    // ... código existente ...
    
    // AÑADIR ESTA LÍNEA:
    integrator.onBuildingConstructed(S, building, log);
}
```

### Paso 4: Mostrar Misiones en UI

Para mostrar las misiones activas:

```javascript
// En la función de renderizado de UI
function renderUI() {
    // ... código existente ...
    
    // Obtener misiones activas
    const activeQuests = integrator.getActiveQuests();
    
    // Renderizar misiones
    const questsContainer = $('#quests');
    if (questsContainer) {
        questsContainer.innerHTML = activeQuests.map(q => `
            <div class="quest ${q.completed ? 'completed' : ''}">
                <span>${q.icon} ${q.name}</span>
                <div class="quest-progress">
                    <div class="quest-bar" style="width: ${(q.progress / q.target.amount) * 100}%"></div>
                </div>
                <span>${q.progress}/${q.target.amount}</span>
            </div>
        `).join('');
    }
}
```

### Paso 5: Mostrar Estadísticas

Para mostrar las estadísticas:

```javascript
// Crear un botón o sección para estadísticas
function showStatistics() {
    const stats = integrator.getStatistics();
    
    console.log('Estadísticas:', stats);
    // O mostrar en un modal/panel
}
```

### Paso 6: Finalizar Sesión

Antes de cerrar o recargar:

```javascript
// Antes de reload o al cerrar
window.addEventListener('beforeunload', () => {
    integrator.endSession(S);
});
```

---

## 🎨 Opción 2: Integración Manual

Si prefieres más control, puedes importar y usar los módulos directamente:

```javascript
import { checkAchievements } from './achievements.js';
import { triggerRandomEvent } from './events.js';
import { quests } from './quests.js';
import { statistics } from './statistics.js';
import { tutorial } from './tutorial.js';
import { notifications } from './notifications.js';

// Inicializar
quests.initialize();
tutorial.start();

// Usar en tu código
checkAchievements(S, log);
triggerRandomEvent(S, log);
statistics.trackResourceGathered('lenia', 10);
```

---

## 🧪 Probar la Integración

1. **Abre la consola del navegador** (F12)
2. **Busca errores** - No debería haber errores de import
3. **Prueba funcionalidades**:
   - Recolecta recursos → Verifica que se trackean
   - Completa acciones → Verifica que aparecen misiones
   - Gana logros → Verifica notificaciones

---

## 📝 HTML - Añadir Contenedores para UI

Si quieres mostrar misiones y estadísticas en la UI, añade estos contenedores en `index.html`:

```html
<!-- Sección de Misiones -->
<div class="card">
    <h2>📋 Misiones</h2>
    <div id="quests"></div>
</div>

<!-- Botón de Estadísticas -->
<button onclick="showStatistics()">📊 Ver Estadísticas</button>
```

---

## ✅ Checklist de Integración

- [ ] Importar `integrator.js` en app.js
- [ ] Llamar `initializeSystems(S)` al inicio
- [ ] Integrar `onResourceGathered()` en funciones de recursos
- [ ] Integrar `onActionPerformed()` en acciones
- [ ] Integrar `onExpeditionCompleted()` en expediciones
- [ ] Integrar `onBossDefeated()` en combate
- [ ] Integrar `onVillagerRecruited()` en reclutamiento
- [ ] Integrar `onRenownGained()` en renombre
- [ ] Integrar `onGameTick()` en el game loop
- [ ] Integrar `onBuildingConstructed()` en construcción
- [ ] Integrar `onItemCrafted()` en crafteo
- [ ] Añadir UI para misiones
- [ ] Añadir UI para estadísticas
- [ ] Probar en navegador

---

## 🐛 Solución de Problemas

### Error: "Cannot find module"
- Verifica que todos los archivos .js estén en la carpeta `js/`
- Asegúrate de que el script en index.html sea `type="module"`

### Los logros no se desbloquean
- Verifica que `checkAchievements(S, log)` se llame después de cambiar el estado
- Revisa la consola para ver si hay errores

### Las misiones no aparecen
- Llama `quests.initialize()` al inicio
- Verifica que `quests.checkResets()` se ejecute

### Las notificaciones no funcionan
- Pide permisos: `await notifications.requestPermission()`
- Verifica que estés en HTTPS o localhost

---

## 🎉 ¡Listo!

Una vez integrado, tu juego tendrá:
- ✅ Sistema de logros completo
- ✅ Misiones diarias/semanales
- ✅ Estadísticas detalladas
- ✅ Eventos aleatorios
- ✅ Tutorial interactivo
- ✅ Notificaciones push

**¡Disfruta de tu juego mejorado!** 🎮
