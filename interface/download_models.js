/**
 * download_models.js
 * ===================
 * Downloads the face-api.js model weight files from GitHub
 * and saves them to public/models/ so they're served locally.
 *
 * HOW TO RUN (one time only):
 *   node download_models.js
 *
 * This creates: interface/public/models/  with all needed weight files.
 * After this runs, the face detection will work offline too.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, 'public', 'models');

// GitHub raw URL for face-api.js weights
const BASE = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

// Only need TinyFaceDetector (fast, ~1MB) + SsdMobilenetv1 (accurate fallback, ~5MB)
const FILES = [
    // TinyFaceDetector
    'tiny_face_detector_model-weights_manifest.json',
    'tiny_face_detector_model-shard1',
    // SSD MobileNet V1
    'ssd_mobilenetv1_model-weights_manifest.json',
    'ssd_mobilenetv1_model-shard1',
    'ssd_mobilenetv1_model-shard2',
];

function download(filename) {
    return new Promise((resolve, reject) => {
        const url = `${BASE}/${filename}`;
        const dest = path.join(MODELS_DIR, filename);

        // Skip if already exists
        if (fs.existsSync(dest)) {
            console.log(`  ✓ Already exists: ${filename}`);
            return resolve();
        }

        const file = fs.createWriteStream(dest);
        console.log(`  ⬇  Downloading: ${filename}`);

        https.get(url, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                // Follow redirect
                https.get(res.headers.location, (res2) => {
                    res2.pipe(file);
                    file.on('finish', () => { file.close(); resolve(); });
                }).on('error', reject);
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`Failed (${res.statusCode}): ${url}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function main() {
    console.log('\n🔽 Downloading face-api.js model weights...\n');

    if (!fs.existsSync(MODELS_DIR)) {
        fs.mkdirSync(MODELS_DIR, { recursive: true });
        console.log(`📁 Created: ${MODELS_DIR}\n`);
    }

    for (const file of FILES) {
        try {
            await download(file);
        } catch (err) {
            console.error(`  ❌ Error downloading ${file}:`, err.message);
            process.exit(1);
        }
    }

    console.log('\n✅ All model files downloaded to public/models/');
    console.log('   You can now start the server: node server.js\n');
}

main();