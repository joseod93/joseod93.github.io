# BJ Advisor

Mobile-first blackjack advisor app with two modes: manual strategy advisor and camera-based card detection.

## Architecture

Single-page vanilla JS app. No build system, no frameworks. Served as static files.

```
Blackjack/
  index.html          — 2-tab SPA: Manual Advisor + Detection
  app.js              — ManualMode + ScannerMode + App (tab manager)
  strategy.js         — Core strategy engine (Thorp/Snyder/Wong)
  detector.js         — YOLOv8 + ONNX Runtime Web card detector
  style.css           — All styles, dark theme, mobile-first
  train_colab.py      — Google Colab training script
  model/
    cards.onnx        — YOLOv8n model (52 classes, 640x640, ~11.7MB)
    classes.json      — 52 class names: 10C,10D,...,QS
  data/
    Playing-Cards-4/  — Roboflow training dataset (Augmented Startups)
    runs/             — Local training results (CPU, low quality)
```

## Tab 1: Manual Advisor (ManualMode)

Card-by-card input. Strategy engine gives optimal play advice.

**Strategy sources:** Beat the Dealer (Thorp), Blackbelt in Blackjack (Snyder), Professional Blackjack (Wong).

- Basic strategy tables: S17 + H17 variants
- 5 counting systems: Hi-Lo, Hi-Opt II, Zen, Halves, KO
- Illustrious 18 deviations (Schlesinger) + Fab 4 Surrenders (Snyder)
- Composition-dependent strategy (Wong: 16 vs 10 with 3+ cards)
- Kelly criterion bet ramp (Snyder 1-12 spread)
- Wong In/Out back-counting signals
- Insurance at TC >= +3 (Thorp)
- House edge calculation with rule adjustments
- KO unbalanced count: IRC = 4 - (4 x decks), pivot = +4

**Classes:** `StrategyEngine` (strategy.js), `ManualMode` (app.js)

## Tab 2: Detection (ScannerMode)

Camera-based card detection via YOLOv8n + ONNX Runtime Web.

- Auto-loads `model/cards.onnx` on startup
- WebGPU backend with WASM fallback
- Letterbox preprocessing (640x640, gray padding #727272)
- Output: [1, 56, 8400] — 52 classes + 4 box coords
- NMS post-processing, configurable confidence threshold
- Detection-only mode: identifies cards on table, no strategy

**Classes:** `CardDetector` (detector.js), `ScannerMode` (app.js)

## Key Technical Details

- ONNX Runtime Web CDN: `onnxruntime-web@1.21.0`
- Model input: CHW float32 normalized [0,1], shape [1, 3, 640, 640]
- Class format: `{rank}{suit}` uppercase — 10C, AD, KH, QS etc.
- `_classToRank()` strips suit suffix → rank only (A, K, Q, J, 10, 2-9)
- detector.js has debug logging for first 3 frames (diagnostic, can remove)

## Model Training

Current model: pre-trained from HuggingFace (`mustafakemal0146/playing-cards-yolov8`), exported to ONNX.

To retrain with GPU (recommended):
1. Open Google Colab with GPU runtime
2. Run `train_colab.py` (installs deps, downloads dataset, trains, exports, saves to Drive)
3. Replace `model/cards.onnx` with new `best.onnx`

Dataset: Roboflow "Augmented Startups" playing-cards-ow27d v4, 10100 images, 52 classes.

**Do NOT train on CPU** — model won't converge (tested: max 6.9% confidence).

## Running

Open `index.html` in browser. No server needed for manual tab. Detection tab needs HTTPS or localhost for camera access.

## Style

- Dark theme with CSS variables (--bg, --accent, --surface, etc.)
- UI language: Spanish
- All code comments: Spanish
