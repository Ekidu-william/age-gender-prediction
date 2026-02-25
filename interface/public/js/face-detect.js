/**
 * face-detect.js
 * ==============
 * Handles all face detection logic using face-api.js (runs entirely in the browser).
 * 
 * WHAT THIS DOES:
 * 1. Downloads the face detection model from jsDelivr CDN on first load
 * 2. Detects faces in an image
 * 3. Crops the face region with some padding
 * 4. Resizes to exactly 200x200 pixels
 * 5. Returns the cropped canvas ready for the server
 * 
 * The models are ~6MB and are cached by the browser after first load.
 */

const FaceDetect = (() => {

    // Model files served locally — run: node download_models.js once first
    const MODEL_URL = '/models';
    
    let modelsLoaded = false;

    /**
     * Load face detection models.
     * Call this once on page load.
     * @param {Function} onProgress - called with 0-100 progress value
     */
    async function loadModels(onProgress) {
        if (modelsLoaded) return;

        try {
            onProgress(10);
            // TinyFaceDetector is fast and lightweight (~1MB)
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            onProgress(70);
            // SSD MobileNetV1 as fallback
            await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
            onProgress(100);
            modelsLoaded = true;
        } catch (err) {
            console.error('Failed to load face-api models:', err);
            throw new Error(
                'Could not load face detection models. ' +
                'Run:  node download_models.js  in the interface/ folder, then restart the server.'
            );
        }
    }

    /**
     * Detect the largest face in an image element.
     * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} source
     * @returns {Object|null} Detection result or null if no face found
     */
    async function detectFace(source) {
        if (!modelsLoaded) throw new Error('Models not loaded yet');

        // Try TinyFaceDetector first (faster)
        let detection = await faceapi.detectSingleFace(
            source,
            new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 })
        );

        // Fallback to SSD if TinyFace misses it
        if (!detection) {
            detection = await faceapi.detectSingleFace(
                source,
                new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 })
            );
        }

        return detection || null;
    }

    /**
     * Detect face, draw bounding box on an overlay canvas, and return cropped 200x200 canvas.
     * 
     * @param {HTMLImageElement} img - The original image
     * @param {HTMLCanvasElement} bboxCanvas - Canvas to draw the bounding box on
     * @param {HTMLCanvasElement} cropCanvas - 200x200 canvas to draw the cropped face on
     * @returns {Object} { success: bool, message: string }
     */
    async function detectAndCrop(img, bboxCanvas, cropCanvas) {
        // Sync bbox canvas to image display size
        const displayW = img.offsetWidth || img.naturalWidth;
        const displayH = img.offsetHeight || img.naturalHeight;
        bboxCanvas.width = displayW;
        bboxCanvas.height = displayH;

        const ctx = bboxCanvas.getContext('2d');
        ctx.clearRect(0, 0, displayW, displayH);

        // Detect on the actual image (full natural resolution for accuracy)
        const detection = await detectFace(img);

        if (!detection) {
            return {
                success: false,
                message: 'No face detected. Please use a photo where the face is clearly visible, well-lit, and facing forward.'
            };
        }

        // Scale box from natural image coords to display coords
        const scaleX = displayW / img.naturalWidth;
        const scaleY = displayH / img.naturalHeight;

        const box = detection.box;
        const sx = box.x * scaleX;
        const sy = box.y * scaleY;
        const sw = box.width * scaleX;
        const sh = box.height * scaleY;

        // Draw bounding box
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 8;
        ctx.strokeRect(sx, sy, sw, sh);

        // Corner accents
        const cLen = Math.min(sw, sh) * 0.18;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 0;
        const corners = [
            [sx, sy, sx + cLen, sy, sx, sy + cLen],
            [sx + sw, sy, sx + sw - cLen, sy, sx + sw, sy + cLen],
            [sx, sy + sh, sx + cLen, sy + sh, sx, sy + sh - cLen],
            [sx + sw, sy + sh, sx + sw - cLen, sy + sh, sx + sw, sy + sh - cLen],
        ];
        corners.forEach(([x1, y1, x2, y2, x3, y3]) => {
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x1, y1);
            ctx.lineTo(x3, y3);
            ctx.stroke();
        });

        // Confidence label
        const conf = Math.round((detection.score) * 100);
        ctx.fillStyle = '#00e5ff';
        ctx.font = `bold 13px DM Sans, sans-serif`;
        ctx.fillText(`Face  ${conf}%`, sx + 4, sy - 6);

        // Now crop from natural image with padding
        cropFaceToCanvas(img, detection.box, cropCanvas);

        return { success: true, message: `Face detected (${conf}% confidence)` };
    }

    /**
     * Crop face region from original image to a 200x200 canvas with padding.
     * @param {HTMLImageElement} img
     * @param {faceapi.Box} box - detection box in natural image coordinates
     * @param {HTMLCanvasElement} outCanvas - 200x200 output canvas
     */
    function cropFaceToCanvas(img, box, outCanvas) {
        const PAD = 0.35; // 35% padding around face box for a natural crop
        
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;

        const padX = box.width * PAD;
        const padY = box.height * PAD;

        const cx = Math.max(0, box.x - padX);
        const cy = Math.max(0, box.y - padY);
        const cw = Math.min(iw - cx, box.width + padX * 2);
        const ch = Math.min(ih - cy, box.height + padY * 2);

        const cropCtx = outCanvas.getContext('2d');
        outCanvas.width = 200;
        outCanvas.height = 200;
        cropCtx.drawImage(img, cx, cy, cw, ch, 0, 0, 200, 200);
    }

    /**
     * Detect face in video frame, draw overlay, return whether face is present.
     * Used for live camera preview.
     * @param {HTMLVideoElement} video
     * @param {HTMLCanvasElement} overlayCanvas
     * @returns {Object} { faceFound: bool }
     */
    async function detectInVideo(video, overlayCanvas) {
        if (!modelsLoaded || video.readyState < 2) return { faceFound: false };

        overlayCanvas.width = video.videoWidth;
        overlayCanvas.height = video.videoHeight;

        const detection = await faceapi.detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.45 })
        );

        const ctx = overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        if (detection) {
            const b = detection.box;
            // Glowing box
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#00e5ff';
            ctx.shadowBlur = 10;
            ctx.strokeRect(b.x, b.y, b.width, b.height);
        }

        return { faceFound: !!detection };
    }

    /**
     * Capture a frame from video, detect face, crop to 200x200 canvas.
     * @param {HTMLVideoElement} video
     * @param {HTMLCanvasElement} outCanvas 200x200
     * @returns {Object} { success, blob, message }
     */
    async function captureFromVideo(video, bboxCanvas, cropCanvas) {
        // Draw current frame to a temp canvas
        const tmp = document.createElement('canvas');
        tmp.width = video.videoWidth;
        tmp.height = video.videoHeight;
        tmp.getContext('2d').drawImage(video, 0, 0);

        // Convert to Image for face-api processing
        const img = new Image();
        await new Promise(res => { img.onload = res; img.src = tmp.toDataURL(); });

        return await detectAndCrop(img, bboxCanvas, cropCanvas);
    }

    /**
     * Convert a canvas to a Blob (for sending to the server).
     * @param {HTMLCanvasElement} canvas
     * @returns {Promise<Blob>}
     */
    function canvasToBlob(canvas) {
        return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    }

    return { loadModels, detectAndCrop, detectInVideo, captureFromVideo, canvasToBlob };

})();