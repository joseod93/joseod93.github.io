# 🔥 Luz y Sombra: El Alba de Hispania

Un juego idle/incremental ambientado en la Andalucía medieval. Sobrevive, explora, construye y conviértete en una leyenda.

## 🎮 Características

### ✨ Nuevas Funcionalidades (v3.0)

- **Sistema de Tutorial Interactivo**: Guía paso a paso para nuevos jugadores
- **20+ Logros**: Sistema expandido con progreso y recompensas
- **Misiones Diarias/Semanales**: Objetivos renovables con recompensas
- **Eventos Aleatorios**: 10+ eventos únicos con condiciones especiales
- **Notificaciones Push**: Alertas para expediciones, bosses y eventos importantes
- **Dashboard de Estadísticas**: Tracking completo de tu progreso
- **Animaciones Suaves**: Transiciones y efectos visuales mejorados
- **Arquitectura Modular**: Código organizado en 17 módulos

### 🎯 Gameplay

- **Gestión de Recursos**: Recolecta leña, agua, hierbas, aceitunas y más
- **Sistema de Fuego**: Mantén la fogata encendida para sobrevivir
- **Exploración**: Descubre regiones de Andalucía (Sevilla, Granada, Cádiz...)
- **Combate**: Enfrenta bosses temporales con sistema de combate táctico
- **Expediciones**: Envía expediciones a diferentes regiones
- **Aldea**: Recluta aldeanos y asígnalos a trabajos
- **Construcción**: Molinos, acequias, fraguas y más
- **Sistema de Prestigio**: Reinicia con bonificaciones permanentes

## 📁 Estructura del Proyecto

```
LuzYSombra2/
├── index.html              # Página principal
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # Service Worker mejorado
├── css/
│   ├── styles.css          # Estilos principales
│   └── animations.css      # Animaciones y transiciones
├── js/
│   ├── app.js              # Aplicación principal (refactorizada)
│   ├── storage.js          # Gestión de estado y persistencia
│   ├── utils.js            # Utilidades reutilizables
│   ├── audio.js            # Sistema de audio
│   ├── events.js           # Eventos aleatorios
│   ├── tutorial.js         # Tutorial interactivo
│   ├── notifications.js    # Sistema de notificaciones
│   ├── achievements.js     # Sistema de logros
│   ├── quests.js           # Sistema de misiones
│   ├── statistics.js       # Tracking de estadísticas
│   ├── combat.js           # Sistema de combate
│   ├── map.js              # Mapa de regiones
│   ├── actions.js          # Acciones del jugador
│   ├── state.js            # Estado del juego
│   ├── ui.js               # Interfaz de usuario
│   ├── game.js             # Lógica del juego
│   └── constants.js        # Constantes del juego
└── assets/
    ├── audio1.mp3          # Música ambiente
    ├── audioFight1.mp3     # Música de combate 1
    ├── audioFight2.mp3     # Música de combate 2
    ├── icon-192.svg        # Icono PWA 192x192
    ├── icon-512.svg        # Icono PWA 512x512
    └── LOGO.jpg            # Logo del juego
```

## 🚀 Instalación y Uso

### Opción 1: Servidor Local

```bash
# Navegar al directorio
cd LuzYSombra2

# Iniciar servidor local (Python 3)
python -m http.server 8000

# O con Node.js
npx http-server -p 8000

# Abrir en navegador
# http://localhost:8000
```

### Opción 2: Abrir Directamente

Simplemente abre `index.html` en un navegador moderno (Chrome, Firefox, Edge, Safari).

**Nota**: Algunas funcionalidades (Service Worker, Notificaciones) requieren HTTPS o localhost.

## 🎓 Cómo Jugar

### Primeros Pasos

1. **Enciende la Fogata**: Usa leña para encender y mantener el fuego
2. **Recolecta Recursos**: Corta leña, busca agua, recolecta hierbas
3. **Explora**: Descubre nuevos recursos y gana renombre
4. **Construye**: Crea estructuras para mejorar tu producción
5. **Recluta Aldeanos**: Expande tu aldea y asigna trabajos

### Sistemas Avanzados

- **Expediciones**: Envía grupos a explorar regiones (3-8 minutos)
- **Bosses**: Enfrenta amenazas temporales para grandes recompensas
- **Crafteo**: Fabrica antorchas y medicina
- **Comercio**: Intercambia recursos con mercaderes ambulantes
- **Misiones**: Completa objetivos diarios y semanales

## 📊 Módulos Nuevos

### storage.js
Gestión centralizada del estado del juego con:
- Persistencia en localStorage
- Sistema de migraciones
- Exportación/importación de partidas

### events.js
Sistema de eventos aleatorios con:
- 10+ eventos únicos
- Eventos específicos por región
- Sistema de clima dinámico

### tutorial.js
Tutorial interactivo con:
- 6 pasos guiados
- Tooltips contextuales
- Progreso guardado

### notifications.js
Sistema de notificaciones con:
- Notificaciones del navegador
- Fallback in-app
- Notificaciones específicas por evento

### achievements.js
Sistema de logros con:
- 20+ logros organizados por categorías
- Sistema de progreso
- Recompensas automáticas
- Logros ocultos

### quests.js
Sistema de misiones con:
- Misiones diarias (reset cada 24h)
- Misiones semanales (reset cada 7 días)
- Misiones de historia (una vez)
- Progreso y recompensas

### statistics.js
Tracking de estadísticas con:
- Recursos recolectados
- Tiempo de juego
- Récords personales
- Historial de sesiones

## 🎨 Mejoras Visuales

### Animaciones (animations.css)

- **Botones**: Hover elevation, ripple effect, pulse
- **Recursos**: Slide in, glow, shake
- **Tutorial**: Fade in, highlights pulsantes
- **Notificaciones**: Slide in/out
- **Logros**: Glow effect al desbloquear

## ⚙️ Configuración

### Notificaciones

Para habilitar notificaciones del navegador:

```javascript
// En la consola del navegador
await notifications.requestPermission();
```

### Tutorial

Para reiniciar el tutorial:

```javascript
tutorial.reset();
tutorial.start();
```

### Estadísticas

Para ver estadísticas formateadas:

```javascript
console.log(statistics.getFormattedStats());
```

## 🐛 Solución de Problemas

### El juego no carga

1. Verifica que todos los archivos estén en su lugar
2. Abre la consola del navegador (F12) y busca errores
3. Asegúrate de usar un navegador moderno

### Las notificaciones no funcionan

1. Verifica que estés en HTTPS o localhost
2. Comprueba los permisos del navegador
3. Algunas extensiones pueden bloquear notificaciones

### El guardado no funciona

1. Verifica que localStorage esté habilitado
2. Comprueba el espacio disponible
3. Intenta exportar/importar manualmente

## 🔧 Desarrollo

### Requisitos

- Navegador moderno con soporte ES6 modules
- Servidor local para desarrollo (opcional pero recomendado)

### Añadir Nuevos Eventos

```javascript
// En events.js
export const RANDOM_EVENTS = [
    {
        id: 'mi_evento',
        weight: 0.1,
        condition: (S) => S.stats.renown >= 10,
        execute: (S) => {
            S.resources.lenia += 5;
            return { message: 'Encontraste leña!', type: 'good' };
        }
    }
];
```

### Añadir Nuevos Logros

```javascript
// En achievements.js
export const ACHIEVEMENTS = {
    mi_logro: {
        id: 'mi_logro',
        name: 'Mi Logro',
        description: 'Descripción del logro',
        icon: '🏆',
        condition: (S) => S.resources.lenia >= 100,
        hidden: false,
        reward: { renown: 5 }
    }
};
```

## 📝 Changelog

### v3.0 (2026-01-31)

- ✨ 9 nuevos módulos implementados
- ✨ Sistema de tutorial interactivo
- ✨ 20+ logros con progreso
- ✨ Sistema de misiones diarias/semanales
- ✨ Dashboard de estadísticas
- ✨ 10+ eventos aleatorios
- ✨ Notificaciones push
- ✨ Animaciones y transiciones suaves
- 🔧 Refactorización completa de app.js
- 🔧 Service Worker mejorado
- 🐛 Corrección de errores críticos (HTML duplicado, AudioSystem duplicado)

## 📜 Licencia

Este proyecto es de código abierto para fines educativos.

## 🙏 Créditos

- **Desarrollo**: Antigravity AI Assistant
- **Concepto**: Juego idle ambientado en Andalucía medieval
- **Música**: Archivos de audio incluidos

## 🎯 Próximas Mejoras

- [ ] Modo claro/oscuro
- [ ] Más regiones de España
- [ ] Sistema de comercio expandido
- [ ] Gráficos de progreso visuales
- [ ] Modo multijugador (competitivo)
- [ ] Más tipos de bosses
- [ ] Sistema de temporadas

---

**¡Disfruta del juego y conviértete en una leyenda de Andalucía!** 🔥⚔️🏰
