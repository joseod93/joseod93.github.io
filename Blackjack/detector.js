// Card Detection via YOLOv8 + ONNX Runtime Web
// Runs trained YOLOv8n model for real-time playing card detection

class CardDetector {
    constructor(config = {}) {
        this.modelPath = config.modelPath || 'model/cards.onnx';
        this.classesPath = config.classesPath || 'model/classes.json';
        this.inputSize = config.inputSize || 640;
        this.confThreshold = config.confThreshold || 0.55;
        this.iouThreshold = config.iouThreshold || 0.45;
        this.maxDetections = config.maxDetections || 20;
        this.classNames = config.classNames || null;

        this.session = null;
        this.modelLoaded = false;
        this.modelLoading = false;
        this.backend = 'none';

        this.onModelProgress = null;
        this.onCardsDetected = null;

        this.detectionInterval = null;
        this.debugCanvas = null;
        this.debugCtx = null;
        this.drawDebug = false;
        this.sensitivity = 128;
        this._modelData = null;

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    async loadModel(modelSource) {
        if (this.modelLoading) return;
        this.modelLoading = true;

        try {
            this._progress('init', 'Configurando ONNX Runtime...');

            if (typeof ort === 'undefined') {
                throw new Error('ONNX Runtime Web no cargado. Revisa el script en index.html');
            }

            ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/';

            const modelData = await this._loadModelData(modelSource);
            this._modelData = modelData.slice();

            this._progress('session', 'Creando sesión de inferencia...');

            this.session = await this._createSession(modelData);
            this.modelLoaded = true;

            await this._loadClassNames();

            this._progress('ready', `Modelo listo (${this.backend.toUpperCase()})`);
        } catch (err) {
            this.modelLoaded = false;
            this._progress('error', err.message);
            throw err;
        } finally {
            this.modelLoading = false;
        }
    }

    async _loadModelData(source) {
        if (source instanceof ArrayBuffer) {
            return new Uint8Array(source);
        }

        if (source instanceof File) {
            this._progress('loading', 'Leyendo archivo...');
            return new Uint8Array(await source.arrayBuffer());
        }

        const path = source || this.modelPath;
        this._progress('loading', 'Descargando modelo...');

        const response = await fetch(path);
        if (!response.ok) throw new Error(`No se pudo cargar modelo: HTTP ${response.status}`);

        const total = parseInt(response.headers.get('content-length') || '0');
        if (total > 0 && response.body) {
            return await this._streamDownload(response, total);
        }
        return new Uint8Array(await response.arrayBuffer());
    }

    async _streamDownload(response, total) {
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            const pct = Math.round((received / total) * 100);
            const mb = (received / 1048576).toFixed(1);
            this._progress('loading', `Descargando: ${pct}% (${mb} MB)`);
        }

        const result = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result;
    }

    async _createSession(modelData) {
        const opts = { graphOptimizationLevel: 'all' };

        try {
            opts.executionProviders = ['webgpu'];
            const session = await ort.InferenceSession.create(modelData.buffer, opts);
            this.backend = 'webgpu';
            return session;
        } catch (e) {
            console.warn('WebGPU no disponible, usando WASM:', e.message);
        }

        opts.executionProviders = ['wasm'];
        const session = await ort.InferenceSession.create(modelData.buffer, opts);
        this.backend = 'wasm';
        return session;
    }

    async _loadClassNames() {
        if (this.classNames) return;

        try {
            const resp = await fetch(this.classesPath);
            if (resp.ok) {
                const data = await resp.json();
                this.classNames = Array.isArray(data) ? data : data.names || null;
            }
        } catch (_) {
            // classes.json is optional
        }
    }

    _progress(stage, message) {
        if (this.onModelProgress) this.onModelProgress(stage, message);
    }

    // === Debug canvas ===

    setDebugCanvas(canvas) {
        this.debugCanvas = canvas;
        this.debugCtx = canvas ? canvas.getContext('2d') : null;
    }

    // === Frame processing ===

    async processFrame(videoElement) {
        if (!this.modelLoaded || !this.session) return [];

        const vw = videoElement.videoWidth;
        const vh = videoElement.videoHeight;
        if (!vw || !vh || videoElement.readyState < 2) return [];

        const { tensor, scale, padX, padY } = this._preprocess(videoElement, vw, vh);

        const inputName = this.session.inputNames[0];
        let results;
        try {
            results = await this.session.run({ [inputName]: tensor });
        } catch (e) {
            if (this.backend !== 'wasm' && this._modelData) {
                console.warn(`${this.backend} inference failed, falling back to WASM:`, e.message);
                const opts = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
                this.session = await ort.InferenceSession.create(this._modelData.buffer, opts);
                this.backend = 'wasm';
                this._progress('ready', 'Modelo listo (WASM fallback)');
                results = await this.session.run({ [inputName]: tensor });
            } else {
                throw e;
            }
        }

        const outputName = this.session.outputNames[0];
        const output = results[outputName];

        const cards = this._postprocess(output, vw, vh, scale, padX, padY);

        if (this.debugCanvas && this.debugCtx) {
            this.debugCanvas.width = vw;
            this.debugCanvas.height = vh;
            this.debugCtx.clearRect(0, 0, vw, vh);
            if (this.drawDebug) this._drawDetections(cards);
        }

        return cards;
    }

    _preprocess(videoElement, origW, origH) {
        const size = this.inputSize;

        const scale = Math.min(size / origW, size / origH);
        const newW = Math.round(origW * scale);
        const newH = Math.round(origH * scale);
        const padX = Math.round((size - newW) / 2);
        const padY = Math.round((size - newH) / 2);

        this.canvas.width = size;
        this.canvas.height = size;
        this.ctx.fillStyle = '#727272';
        this.ctx.fillRect(0, 0, size, size);
        this.ctx.drawImage(videoElement, padX, padY, newW, newH);

        const imageData = this.ctx.getImageData(0, 0, size, size);
        const pixels = imageData.data;

        const floatData = new Float32Array(3 * size * size);
        const planeSize = size * size;

        for (let i = 0; i < planeSize; i++) {
            const px = i * 4;
            floatData[i] = pixels[px] / 255;
            floatData[i + planeSize] = pixels[px + 1] / 255;
            floatData[i + 2 * planeSize] = pixels[px + 2] / 255;
        }

        const tensor = new ort.Tensor('float32', floatData, [1, 3, size, size]);
        return { tensor, scale, padX, padY };
    }

    _postprocess(output, origW, origH, scale, padX, padY) {
        const data = output.data;
        const dims = output.dims;

        // YOLOv8 output: [1, 4+nc, N]
        const numAttrs = dims[1];
        const numDetections = dims[2];
        const numClasses = numAttrs - 4;

        if (!this.classNames) {
            this.classNames = this._generateClassNames(numClasses);
        }

        const detections = [];

        for (let i = 0; i < numDetections; i++) {
            let maxConf = 0;
            let maxClass = 0;
            for (let c = 0; c < numClasses; c++) {
                const conf = data[(4 + c) * numDetections + i];
                if (conf > maxConf) {
                    maxConf = conf;
                    maxClass = c;
                }
            }

            if (maxConf < this.confThreshold) continue;

            const cx = data[0 * numDetections + i];
            const cy = data[1 * numDetections + i];
            const w  = data[2 * numDetections + i];
            const h  = data[3 * numDetections + i];

            const x1 = (cx - w / 2 - padX) / scale;
            const y1 = (cy - h / 2 - padY) / scale;
            const bw = w / scale;
            const bh = h / scale;

            const x = Math.max(0, Math.min(x1, origW));
            const y = Math.max(0, Math.min(y1, origH));

            const className = this.classNames[maxClass] || `class_${maxClass}`;
            const rank = this._classToRank(className);

            const minDim = Math.min(origW, origH) * 0.03;
            if (rank && bw > minDim && bh > minDim) {
                detections.push({
                    rank, className, confidence: maxConf,
                    x, y, width: bw, height: bh,
                    centerX: x + bw / 2,
                    centerY: y + bh / 2,
                });
            }
        }

        const nmsResult = this._nms(detections);
        return nmsResult.slice(0, this.maxDetections);
    }

    _classToRank(className) {
        const stripped = className.replace(/[cdhs]$/i, '').toUpperCase();
        if (['A', 'ACE'].includes(stripped)) return 'A';
        if (['K', 'KING'].includes(stripped)) return 'K';
        if (['Q', 'QUEEN'].includes(stripped)) return 'Q';
        if (['J', 'JACK'].includes(stripped)) return 'J';
        if (stripped === '10') return '10';
        const n = parseInt(stripped);
        if (n >= 2 && n <= 9) return String(n);
        return null;
    }

    _generateClassNames(numClasses) {
        if (numClasses === 52) {
            // Matches Roboflow "Augmented Startups" playing cards dataset
            const ranks = ['10','2','3','4','5','6','7','8','9','A','J','K','Q'];
            const suits = ['C','D','H','S'];
            const names = [];
            for (const r of ranks) for (const s of suits) names.push(r + s);
            return names.sort();
        }
        if (numClasses === 13) {
            return ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
        }
        return Array.from({ length: numClasses }, (_, i) => `class_${i}`);
    }

    // === NMS ===

    _nms(detections) {
        if (detections.length === 0) return [];
        detections.sort((a, b) => b.confidence - a.confidence);

        const kept = [];
        const suppressed = new Set();

        for (let i = 0; i < detections.length; i++) {
            if (suppressed.has(i)) continue;
            kept.push(detections[i]);
            for (let j = i + 1; j < detections.length; j++) {
                if (suppressed.has(j)) continue;
                if (this._iou(detections[i], detections[j]) > this.iouThreshold) {
                    suppressed.add(j);
                }
            }
        }
        return kept;
    }

    _iou(a, b) {
        const x1 = Math.max(a.x, b.x);
        const y1 = Math.max(a.y, b.y);
        const x2 = Math.min(a.x + a.width, b.x + b.width);
        const y2 = Math.min(a.y + a.height, b.y + b.height);
        const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
        const union = a.width * a.height + b.width * b.height - inter;
        return union > 0 ? inter / union : 0;
    }

    // === Debug drawing ===

    _drawDetections(cards) {
        if (!this.debugCtx) return;
        const ctx = this.debugCtx;

        for (const card of cards) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.strokeRect(card.x, card.y, card.width, card.height);

            const label = `${card.rank} ${(card.confidence * 100).toFixed(0)}%`;
            ctx.font = 'bold 16px Arial';
            const tw = ctx.measureText(label).width;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(card.x, card.y - 24, tw + 10, 24);

            ctx.fillStyle = '#00ff00';
            ctx.fillText(label, card.x + 5, card.y - 6);
        }
    }

    // === Detection loop ===

    startDetection(videoElement, fps = 5) {
        this.stopDetection();
        let busy = false;

        this.detectionInterval = setInterval(async () => {
            if (busy) return;
            busy = true;
            try {
                const cards = await this.processFrame(videoElement);
                if (this.onCardsDetected) this.onCardsDetected(cards);
            } catch (e) {
                console.error('Error en detección:', e);
            }
            busy = false;
        }, 1000 / fps);
    }

    stopDetection() {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
    }
}

window.CardDetector = CardDetector;
