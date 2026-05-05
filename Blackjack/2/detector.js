// Card Detection via Computer Vision (Canvas-based)
// Detects playing cards from camera feed using contour detection + template matching

class CardDetector {
    constructor() {
        this.templates = {};
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.debugCanvas = null;
        this.debugCtx = null;
        this.lastDetected = [];
        this.detectionInterval = null;
        this.onCardsDetected = null;
        this.sensitivity = 128; // threshold for white detection
        this.minCardArea = 3000;
        this.maxCardArea = 80000;
        this.generateTemplates();
    }

    generateTemplates() {
        const tCanvas = document.createElement('canvas');
        tCanvas.width = 40;
        tCanvas.height = 56;
        const tCtx = tCanvas.getContext('2d');

        const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
        ranks.forEach(rank => {
            tCtx.clearRect(0, 0, 40, 56);
            tCtx.fillStyle = '#000';
            tCtx.font = 'bold 28px Arial';
            tCtx.textAlign = 'center';
            tCtx.textBaseline = 'middle';
            tCtx.fillText(rank, 20, 28);
            this.templates[rank] = tCtx.getImageData(0, 0, 40, 56);
        });
    }

    setDebugCanvas(canvas) {
        this.debugCanvas = canvas;
        this.debugCtx = canvas ? canvas.getContext('2d') : null;
    }

    processFrame(videoElement) {
        const w = videoElement.videoWidth;
        const h = videoElement.videoHeight;
        if (w === 0 || h === 0) return [];

        this.canvas.width = w;
        this.canvas.height = h;
        this.ctx.drawImage(videoElement, 0, 0);

        const imageData = this.ctx.getImageData(0, 0, w, h);
        const cards = this.detectCards(imageData, w, h);

        if (this.debugCanvas && this.debugCtx) {
            this.debugCanvas.width = w;
            this.debugCanvas.height = h;
            this.debugCtx.drawImage(videoElement, 0, 0);
            this.drawDetections(cards);
        }

        this.lastDetected = cards;
        return cards;
    }

    detectCards(imageData, width, height) {
        // Step 1: Convert to grayscale and threshold to find white regions (cards)
        const gray = this.toGrayscale(imageData);
        const binary = this.threshold(gray, width, height, this.sensitivity);

        // Step 2: Find contours (connected components)
        const contours = this.findContours(binary, width, height);

        // Step 3: Filter contours by area and aspect ratio (card-shaped)
        const cardContours = contours.filter(c => {
            const area = c.width * c.height;
            const ratio = c.width / c.height;
            return area >= this.minCardArea &&
                   area <= this.maxCardArea &&
                   ((ratio >= 0.55 && ratio <= 0.85) || (ratio >= 1.2 && ratio <= 1.8));
        });

        // Step 4: Extract rank from each card candidate
        const detected = [];
        for (const contour of cardContours) {
            const rank = this.identifyRank(imageData, width, contour);
            if (rank) {
                detected.push({
                    rank: rank,
                    x: contour.x,
                    y: contour.y,
                    width: contour.width,
                    height: contour.height,
                    centerX: contour.x + contour.width / 2,
                    centerY: contour.y + contour.height / 2,
                });
            }
        }

        return this.deduplicateCards(detected);
    }

    toGrayscale(imageData) {
        const data = imageData.data;
        const gray = new Uint8Array(data.length / 4);
        for (let i = 0; i < gray.length; i++) {
            const idx = i * 4;
            gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2]);
        }
        return gray;
    }

    threshold(gray, width, height, thresh) {
        const binary = new Uint8Array(gray.length);
        for (let i = 0; i < gray.length; i++) {
            binary[i] = gray[i] > thresh ? 1 : 0;
        }
        return binary;
    }

    findContours(binary, width, height) {
        const visited = new Uint8Array(binary.length);
        const contours = [];

        for (let y = 0; y < height; y += 4) {
            for (let x = 0; x < width; x += 4) {
                const idx = y * width + x;
                if (binary[idx] === 1 && !visited[idx]) {
                    const contour = this.floodFill(binary, visited, x, y, width, height);
                    if (contour) contours.push(contour);
                }
            }
        }

        return contours;
    }

    floodFill(binary, visited, startX, startY, width, height) {
        const stack = [[startX, startY]];
        let minX = startX, maxX = startX, minY = startY, maxY = startY;
        let pixelCount = 0;

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const idx = y * width + x;

            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            if (visited[idx] || binary[idx] === 0) continue;

            visited[idx] = 1;
            pixelCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;

            // Sample at intervals to speed up
            stack.push([x+4, y], [x-4, y], [x, y+4], [x, y-4]);
        }

        const w = maxX - minX;
        const h = maxY - minY;
        if (w < 30 || h < 40) return null;

        return { x: minX, y: minY, width: w, height: h, pixels: pixelCount };
    }

    identifyRank(imageData, imgWidth, contour) {
        // Extract the top-left corner of the card where rank is displayed
        const data = imageData.data;
        const cornerW = Math.min(Math.floor(contour.width * 0.35), 50);
        const cornerH = Math.min(Math.floor(contour.height * 0.3), 60);

        if (cornerW < 10 || cornerH < 10) return null;

        // Get corner pixel data and analyze
        const cornerData = [];
        for (let dy = 0; dy < cornerH; dy++) {
            for (let dx = 0; dx < cornerW; dx++) {
                const sx = contour.x + dx + 3;
                const sy = contour.y + dy + 3;
                if (sx >= imgWidth || sy >= imageData.height) continue;
                const idx = (sy * imgWidth + sx) * 4;
                const gray = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
                cornerData.push(gray < 100 ? 1 : 0); // dark pixels = rank text
            }
        }

        // Simple feature extraction: count dark pixels in regions
        const totalDark = cornerData.reduce((a, b) => a + b, 0);
        const density = totalDark / cornerData.length;

        if (density < 0.02 || density > 0.6) return null;

        // Use column profile analysis for rank identification
        return this.matchRankByProfile(cornerData, cornerW, cornerH);
    }

    matchRankByProfile(cornerData, width, height) {
        // Analyze horizontal and vertical projections
        const hProj = new Array(height).fill(0);
        const vProj = new Array(width).fill(0);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const val = cornerData[y * width + x] || 0;
                hProj[y] += val;
                vProj[x] += val;
            }
        }

        // Find bounding box of actual character
        let top = 0, bottom = height - 1;
        for (let y = 0; y < height; y++) {
            if (hProj[y] > width * 0.05) { top = y; break; }
        }
        for (let y = height - 1; y >= 0; y--) {
            if (hProj[y] > width * 0.05) { bottom = y; break; }
        }

        let left = 0, right = width - 1;
        for (let x = 0; x < width; x++) {
            if (vProj[x] > height * 0.05) { left = x; break; }
        }
        for (let x = width - 1; x >= 0; x--) {
            if (vProj[x] > height * 0.05) { right = x; break; }
        }

        const charW = right - left;
        const charH = bottom - top;
        if (charW < 3 || charH < 5) return null;

        const aspectRatio = charW / charH;
        const totalDark = cornerData.reduce((a, b) => a + b, 0);
        const charArea = charW * charH;
        const fillRatio = totalDark / charArea;

        // Middle horizontal gap detection (for 8, 0/10, A)
        const midY = Math.floor((top + bottom) / 2);
        const midRow = hProj[midY] / width;

        // Vertical symmetry
        const midX = Math.floor((left + right) / 2);
        const midCol = vProj[midX] / height;

        // Width-based discrimination
        if (aspectRatio > 0.9) return '10'; // wide = 10
        if (aspectRatio < 0.3) return '1'; // very narrow

        // Feature-based ranking (simplified)
        if (fillRatio > 0.55 && aspectRatio > 0.5) return '8';
        if (fillRatio > 0.5 && midRow < 0.15) return '0'; // part of 10
        if (fillRatio < 0.2) return 'A';
        if (fillRatio > 0.45 && aspectRatio < 0.5) return '6';
        if (midRow > 0.5 && fillRatio > 0.3) return 'K';
        if (fillRatio > 0.35 && aspectRatio > 0.55) return 'Q';

        // Default heuristics
        const features = { aspectRatio, fillRatio, midRow, midCol };
        return this.heuristicMatch(features);
    }

    heuristicMatch(features) {
        // Simple decision tree for rank identification
        const { aspectRatio, fillRatio } = features;

        if (aspectRatio > 0.8) return '10';
        if (fillRatio < 0.15) return null;
        if (fillRatio < 0.25) return 'A';
        if (fillRatio < 0.3) return '7';
        if (fillRatio < 0.35) return '4';
        if (fillRatio < 0.4) return '3';
        if (fillRatio < 0.45) return '5';
        if (fillRatio < 0.5) return '9';
        if (fillRatio < 0.55) return '2';
        return 'J';
    }

    deduplicateCards(cards) {
        // Remove duplicates that are too close together
        const result = [];
        for (const card of cards) {
            const isDup = result.some(existing =>
                Math.abs(existing.centerX - card.centerX) < 40 &&
                Math.abs(existing.centerY - card.centerY) < 40
            );
            if (!isDup) result.push(card);
        }
        return result;
    }

    drawDetections(cards) {
        if (!this.debugCtx) return;
        const ctx = this.debugCtx;

        cards.forEach(card => {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(card.x, card.y, card.width, card.height);

            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 18px Arial';
            ctx.fillText(card.rank, card.x + 5, card.y - 5);
        });
    }

    startDetection(videoElement, fps = 5) {
        this.stopDetection();
        this.detectionInterval = setInterval(() => {
            const cards = this.processFrame(videoElement);
            if (this.onCardsDetected) {
                this.onCardsDetected(cards);
            }
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
