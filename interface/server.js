/**
 * Age & Gender Prediction - Node.js Web Interface
 * =================================================
 * 
 * HOW TO RUN:
 *   1. Make sure step4_prediction_api.py is running first!
 *   2. npm install
 *   3. node server.js
 *   4. Open http://localhost:3000
 * 
 * REQUIRES: Node.js 16+, MySQL running
 */

require('dotenv').config();

const express = require('express');
const multer = require('multer');
const mysql = require('mysql2/promise');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT        = process.env.PORT         || 3000;
const PYTHON_API  = process.env.PYTHON_API_URL || 'http://localhost:5001';

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// File upload config - saves uploaded images temporarily
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// ─── DATABASE CONNECTION ──────────────────────────────────────────────────────
const dbConfig = {
    host    : process.env.DB_HOST     || 'localhost',
    user    : process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'age_gender_db',
    port    : parseInt(process.env.DB_PORT) || 3306,
};

let db;

async function connectDB() {
    try {
        db = await mysql.createPool(dbConfig);
        console.log('✅ Connected to MySQL database');
        await setupDatabase();
    } catch (err) {
        console.error('❌ MySQL connection failed:', err.message);
        console.log('   Make sure MySQL is running and credentials in server.js are correct');
    }
}

async function setupDatabase() {
    // Create table if it doesn't exist
    await db.execute(`
        CREATE TABLE IF NOT EXISTS predictions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            image_name VARCHAR(255),
            predicted_age INT,
            predicted_gender VARCHAR(10),
            gender_confidence FLOAT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Database table ready');
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload image and get prediction
app.post('/predict', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
    }
    
    try {
        // Forward image to Python API
        const formData = new FormData();
        formData.append('image', fs.createReadStream(req.file.path), {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });
        
        const response = await axios.post(`${PYTHON_API}/predict`, formData, {
            headers: formData.getHeaders(),
            timeout: 30000
        });
        
        const result = response.data;
        
        // Save to database
        if (db) {
            try {
                await db.execute(
                    `INSERT INTO predictions (image_name, predicted_age, predicted_gender, gender_confidence) 
                     VALUES (?, ?, ?, ?)`,
                    [req.file.originalname, result.age, result.gender, result.gender_confidence]
                );
            } catch (dbErr) {
                console.error('DB save error:', dbErr.message);
                // Still return result even if DB fails
            }
        }
        
        // Clean up uploaded file
        fs.unlink(req.file.path, () => {});
        
        res.json({
            success: true,
            age: result.age,
            gender: result.gender,
            gender_confidence: result.gender_confidence
        });
        
    } catch (error) {
        // Clean up uploaded file on error
        if (req.file) fs.unlink(req.file.path, () => {});
        
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({ 
                error: 'Python prediction server is not running. Start step4_prediction_api.py first!' 
            });
        }
        
        console.error('Prediction error:', error.message);
        res.status(500).json({ error: 'Prediction failed: ' + error.message });
    }
});

// Get prediction history
app.get('/history', async (req, res) => {
    if (!db) {
        return res.status(503).json({ error: 'Database not connected. Check MySQL credentials in server.js.' });
    }
    
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 20;
        const offset = (page - 1) * limit;
        
        // Use query() with inline values to avoid LIMIT/OFFSET type issues in some mysql2 versions
        const [rows] = await db.query(
            `SELECT * FROM predictions ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
        );
        
        const [[countRow]] = await db.query('SELECT COUNT(*) as total FROM predictions');
        const total = countRow.total;
        
        res.json({
            predictions: rows,
            total,
            page,
            pages: Math.max(1, Math.ceil(total / limit))
        });
    } catch (err) {
        console.error('History query error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Get statistics
app.get('/stats', async (req, res) => {
    if (!db) {
        return res.status(503).json({ error: 'Database not connected.' });
    }
    
    try {
        const [[stats]] = await db.query(`
            SELECT 
                COUNT(*) as total_predictions,
                ROUND(AVG(predicted_age), 1) as avg_age,
                MIN(predicted_age) as min_age,
                MAX(predicted_age) as max_age,
                SUM(CASE WHEN predicted_gender = 'Male' THEN 1 ELSE 0 END) as male_count,
                SUM(CASE WHEN predicted_gender = 'Female' THEN 1 ELSE 0 END) as female_count
            FROM predictions
        `);
        
        res.json(stats);
    } catch (err) {
        console.error('Stats query error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Delete a prediction
app.delete('/prediction/:id', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database not connected' });
    
    try {
        const id = parseInt(req.params.id);
        await db.query('DELETE FROM predictions WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── START ────────────────────────────────────────────────────────────────────
// Create uploads folder if it doesn't exist
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

connectDB();

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log(`🚀 Web interface running at http://localhost:${PORT}`);
    console.log('   Make sure step4_prediction_api.py is also running!');
    console.log('='.repeat(50) + '\n');
});