/**
 * app.js — Main application logic
 * =================================
 * Orchestrates:
 *  - Tab switching (Upload / Camera)
 *  - File upload + drag-and-drop
 *  - Camera open/capture/close
 *  - Face detection via face-detect.js
 *  - Sending cropped 200x200 face to Node.js /predict
 *  - Displaying results
 */

// ── DOM REFS ────────────────────────────────────────────────────────────────
const modelOverlay  = document.getElementById('model-overlay');
const loaderBar     = document.getElementById('loader-bar');
const loaderPct     = document.getElementById('loader-pct');

const tabBtns       = document.querySelectorAll('.tab-btn');
const tabPanels     = document.querySelectorAll('.tab-panel');

// Upload tab
const dropZone      = document.getElementById('drop-zone');
const fileInput     = document.getElementById('file-input');
const btnBrowse     = document.getElementById('btn-browse');

// Camera tab
const camIdle       = document.getElementById('cam-idle');
const camLive       = document.getElementById('cam-live');
const btnOpenCam    = document.getElementById('btn-open-cam');
const camVideo      = document.getElementById('cam-video');
const camOverlay    = document.getElementById('cam-overlay');
const btnCapture    = document.getElementById('btn-capture');
const btnCancelCam  = document.getElementById('btn-cancel-cam');
const liveHint      = document.getElementById('live-hint');

// Preview panel
const previewPanel  = document.getElementById('preview-panel');
const origImg       = document.getElementById('orig-img');
const bboxCanvas    = document.getElementById('bbox-canvas');
const cropCanvas    = document.getElementById('crop-canvas');
const scanAnim      = document.getElementById('scan-anim');
const stLoading     = document.getElementById('st-loading');
const stOk          = document.getElementById('st-ok');
const stErr         = document.getElementById('st-err');
const stErrMsg      = document.getElementById('st-err-msg');
const btnAnalyze    = document.getElementById('btn-analyze');
const analyzeLabel  = document.getElementById('analyze-label');
const btnTryAgain   = document.getElementById('btn-try-again');

// Results
const resultsSection = document.getElementById('results-section');
const resThumb       = document.getElementById('res-thumb');
const resAge         = document.getElementById('res-age');
const resGender      = document.getElementById('res-gender');
const resGenderSub   = document.getElementById('res-gender-sub');
const confMale       = document.getElementById('conf-male');
const confFemale     = document.getElementById('conf-female');
const pctMale        = document.getElementById('pct-male');
const pctFemale      = document.getElementById('pct-female');
const btnAgain       = document.getElementById('btn-again');

const toast          = document.getElementById('toast');

// ── STATE ────────────────────────────────────────────────────────────────────
let cameraStream     = null;
let faceDetectLoop   = null;
let croppedBlob      = null;  // The 200x200 face blob ready for server

// ── INIT: LOAD FACE DETECTION MODELS ────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    try {
        await FaceDetect.loadModels((pct) => {
            loaderBar.style.width = pct + '%';
            loaderPct.textContent = pct + '%';
        });
        // Small delay so 100% is visible
        await sleep(400);
        modelOverlay.classList.add('hidden');
    } catch (err) {
        loaderPct.textContent = 'Failed to load. Refresh page.';
        loaderPct.style.color = '#ff5555';
        showToast('Face detection models failed to load. Did you run: node download_models.js ?', 'error');
    }
});

// ── TAB SWITCHING ────────────────────────────────────────────────────────────
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + target).classList.add('active');
        // Close camera if switching away
        if (target !== 'camera') stopCamera();
    });
});

// ── UPLOAD / DRAG-AND-DROP ───────────────────────────────────────────────────
btnBrowse.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', (e) => {
    if (e.target === btnBrowse || e.target.closest('.btn-browse')) return;
    fileInput.click();
});

fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', e => {
    if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        handleFile(file);
    } else {
        showToast('Please drop an image file (JPG, PNG, WEBP)', 'error');
    }
});

async function handleFile(file) {
    if (file.size > 10 * 1024 * 1024) {
        showToast('File too large. Max size is 10 MB.', 'error');
        return;
    }

    const url = URL.createObjectURL(file);
    origImg.src = url;
    origImg.onload = async () => {
        showPreviewPanel();
        await runFaceDetection();
    };
}

// ── CAMERA ───────────────────────────────────────────────────────────────────
btnOpenCam.addEventListener('click', startCamera);
btnCancelCam.addEventListener('click', stopCamera);

async function startCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false
        });
        camVideo.srcObject = cameraStream;
        camIdle.style.display = 'none';
        camLive.style.display = 'block';

        // Start face detection loop on live feed
        camVideo.addEventListener('loadeddata', startLiveFaceLoop, { once: true });

    } catch (err) {
        if (err.name === 'NotAllowedError') {
            showToast('Camera access denied. Please allow camera permission and try again.', 'error');
        } else {
            showToast('Could not access camera: ' + err.message, 'error');
        }
    }
}

function startLiveFaceLoop() {
    let facePresent = false;
    faceDetectLoop = setInterval(async () => {
        try {
            const { faceFound } = await FaceDetect.detectInVideo(camVideo, camOverlay);
            if (faceFound !== facePresent) {
                facePresent = faceFound;
                liveHint.textContent = faceFound
                    ? '✓ Face detected — tap capture'
                    : 'Center your face · Keep still';
                liveHint.style.color = faceFound ? '#00e5ff' : 'rgba(255,255,255,0.85)';
            }
        } catch (_) {}
    }, 300);
}

btnCapture.addEventListener('click', async () => {
    // Flash effect
    btnCapture.classList.add('capturing');
    setTimeout(() => btnCapture.classList.remove('capturing'), 300);

    stopLiveFaceLoop();

    // Capture frame as image
    const tmp = document.createElement('canvas');
    tmp.width = camVideo.videoWidth;
    tmp.height = camVideo.videoHeight;
    tmp.getContext('2d').drawImage(camVideo, 0, 0);

    const url = tmp.toDataURL('image/jpeg');
    origImg.src = url;
    origImg.onload = async () => {
        stopCamera();
        showPreviewPanel();
        await runFaceDetection();
    };
});

function stopCamera() {
    stopLiveFaceLoop();
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    camVideo.srcObject = null;
    camLive.style.display = 'none';
    camIdle.style.display = 'flex';
}

function stopLiveFaceLoop() {
    if (faceDetectLoop) {
        clearInterval(faceDetectLoop);
        faceDetectLoop = null;
    }
}

// ── FACE DETECTION FLOW ──────────────────────────────────────────────────────
function showPreviewPanel() {
    previewPanel.style.display = 'block';
    resultsSection.style.display = 'none';
    // Reset status
    stLoading.style.display = 'flex';
    stOk.style.display = 'none';
    stErr.style.display = 'none';
    btnAnalyze.disabled = true;
    analyzeLabel.textContent = 'Analyze Face';
    croppedBlob = null;
    scanAnim.style.display = 'block';
    // Clear canvases
    cropCanvas.getContext('2d').clearRect(0, 0, 200, 200);
    bboxCanvas.getContext('2d').clearRect(0, 0, bboxCanvas.width, bboxCanvas.height);
    previewPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function runFaceDetection() {
    try {
        const result = await FaceDetect.detectAndCrop(origImg, bboxCanvas, cropCanvas);
        scanAnim.style.display = 'none';
        stLoading.style.display = 'none';

        if (result.success) {
            stOk.style.display = 'flex';
            btnAnalyze.disabled = false;
            // Pre-generate blob for upload
            croppedBlob = await FaceDetect.canvasToBlob(cropCanvas);
        } else {
            stErr.style.display = 'flex';
            stErrMsg.textContent = result.message;
            cropCanvas.getContext('2d').clearRect(0, 0, 200, 200);
        }
    } catch (err) {
        scanAnim.style.display = 'none';
        stLoading.style.display = 'none';
        stErr.style.display = 'flex';
        stErrMsg.textContent = 'Face detection failed: ' + err.message;
    }
}

// ── TRY AGAIN ────────────────────────────────────────────────────────────────
btnTryAgain.addEventListener('click', resetAll);
btnAgain.addEventListener('click', resetAll);

function resetAll() {
    previewPanel.style.display = 'none';
    resultsSection.style.display = 'none';
    fileInput.value = '';
    origImg.src = '';
    croppedBlob = null;
    // Go back to upload tab
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    tabBtns[0].classList.add('active');
    document.getElementById('tab-upload').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── ANALYZE (SEND TO SERVER) ─────────────────────────────────────────────────
btnAnalyze.addEventListener('click', async () => {
    if (!croppedBlob) {
        showToast('No face detected yet.', 'error');
        return;
    }

    btnAnalyze.disabled = true;
    analyzeLabel.textContent = '⏳ Analyzing…';

    try {
        const formData = new FormData();
        formData.append('image', croppedBlob, 'face_200x200.jpg');

        const response = await fetch('/predict', { method: 'POST', body: formData });
        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(data.error || 'Prediction failed');
        }

        showResults(data);

    } catch (err) {
        const msg = err.message.includes('ECONNREFUSED') || err.message.includes('fetch')
            ? 'Cannot reach prediction server. Make sure step4_prediction_api.py is running.'
            : err.message;
        showToast(msg, 'error');
        btnAnalyze.disabled = false;
        analyzeLabel.textContent = 'Analyze Face';
    }
});

// ── SHOW RESULTS ─────────────────────────────────────────────────────────────
function showResults(data) {
    // Copy cropped face to result thumbnail
    const thumbCtx = resThumb.getContext('2d');
    thumbCtx.drawImage(cropCanvas, 0, 0, 80, 80);

    resAge.textContent = data.age;
    resGender.textContent = data.gender;
    resGenderSub.textContent = `${data.gender_confidence}% confidence`;

    const isFemale = data.gender === 'Female';
    const femalePct = isFemale ? data.gender_confidence : 100 - data.gender_confidence;
    const malePct = 100 - femalePct;

    confMale.style.width = malePct + '%';
    confFemale.style.width = femalePct + '%';
    pctMale.textContent = malePct.toFixed(1) + '%';
    pctFemale.textContent = femalePct.toFixed(1) + '%';

    previewPanel.style.display = 'none';
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── TOAST ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'error') {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.className = 'toast toast-' + type + ' toast-show';
    toastTimer = setTimeout(() => toast.classList.remove('toast-show'), 5000);
}

// ── UTIL ─────────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));