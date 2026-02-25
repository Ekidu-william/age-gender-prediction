# Age & Gender Prediction — Complete Setup Guide

## 📁 Project Structure

```
age-gender-prediction/
│
├── model/
│   ├── step1_prepare_csv.py       ← Reads your images, creates train/test CSVs
│   ├── step2_train_model.py       ← Trains the AI model (MobileNetV2)
│   ├── step3_test_model.py        ← Tests the trained model
│   └── step4_prediction_api.py   ← Python web server that serves predictions
│
└── interface/
    ├── server.js                  ← Node.js web server
    ├── package.json               ← Node dependencies
    ├── setup_database.sql         ← MySQL setup script
    └── public/
        ├── index.html             ← Main prediction page
        ├── history.html           ← Prediction history page
        ├── stats.html             ← Statistics page
        ├── css/style.css
        └── js/ (app.js, history.js, stats.js)
```

---

## ✅ REQUIREMENTS — Install These First

### Python (for AI model)
Python 3.8 or newer required.

```bash
pip install tensorflow pandas numpy scikit-learn matplotlib pillow flask flask-cors
```

> 💡 If you have an NVIDIA GPU, install `tensorflow-gpu` instead of `tensorflow` for 5–10x faster training.

### Node.js (for web interface)
Node.js 16 or newer required. Download from https://nodejs.org

### MySQL
MySQL 8+ required. Download from https://dev.mysql.com/downloads/

---

## 🚀 STEP-BY-STEP INSTRUCTIONS

---

### STEP 1 — Prepare Your CSV Files

This reads all your image filenames and creates `train.csv` (80%) and `test.csv` (20%).

```bash
cd model
python step1_prepare_csv.py --images_dir /path/to/your/images
```

**Example:**
```bash
# Windows
python step1_prepare_csv.py --images_dir C:\Users\YourName\Downloads\images

# Mac/Linux
python step1_prepare_csv.py --images_dir ~/Downloads/images
```

**Expected output:**
```
📁 Scanning folder: /path/to/images
✅ Found 24000 image files
✅ Successfully parsed: 23987 images
⚠️  Skipped (invalid format): 13 images

📊 Dataset Statistics:
   Age range: 0 - 116
   Gender distribution: {0: 11950, 1: 12037}

✅ CSV files saved!
   Training set: 19190 images → train.csv
   Testing set:  4797  images → test.csv
```

---

### STEP 2 — Train the Model

This is the main AI training step. It will take 20 minutes to 4 hours depending on your hardware.

```bash
python step2_train_model.py
```

**What happens:**
- The model starts with MobileNetV2 (pre-trained on ImageNet — already knows faces, shapes, etc.)
- It fine-tunes on YOUR data for 10 epochs
- Each epoch processes all 19,000+ training images
- After training, `age_gender_model.h5` is saved
- A training graph `training_history.png` is also saved

**Expected output after training:**
```
📈 Final Results:
   Gender Accuracy: 88-93%
   Age Error (MAE): ±5-8 years

💾 Model saved to: age_gender_model.h5
```

---

### STEP 3 — Test the Model (Optional but Recommended)

Test on a single image:
```bash
python step3_test_model.py --image /path/to/any/face.jpg
```

Run full evaluation on the test set:
```bash
python step3_test_model.py --evaluate
```

---

### STEP 4 — Start the Python Prediction API

This starts a small web server that the Node.js interface will talk to.
**Keep this terminal open while using the web interface.**

```bash
python step4_prediction_api.py
```

You should see:
```
✅ Model loaded successfully!
🚀 Prediction API starting on http://localhost:5001
```

---

### STEP 5 — Set Up the MySQL Database

Open MySQL and run the setup script:

**Option A (command line):**
```bash
mysql -u root -p < interface/setup_database.sql
```

**Option B (MySQL Workbench):**
1. Open MySQL Workbench
2. Open the file `interface/setup_database.sql`
3. Click Execute (⚡)

**Then update your MySQL credentials in `interface/server.js`:**
```javascript
const dbConfig = {
    host: 'localhost',
    user: 'root',       // ← your MySQL username
    password: '',       // ← your MySQL password
    database: 'age_gender_db'
};
```

---

### STEP 6 — Install Node.js Dependencies

```bash
cd interface
npm install
```

---

### STEP 7 — Start the Web Interface

```bash
node server.js
```

Open your browser at: **http://localhost:3000**

---

## 🖥️ RUNNING THE COMPLETE APPLICATION

You need **2 terminals** running simultaneously:

**Terminal 1 — Python API:**
```bash
cd model
python step4_prediction_api.py
```

**Terminal 2 — Node.js Web Server:**
```bash
cd interface
node server.js
```

Then visit **http://localhost:3000** in your browser.

---

## ❓ TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| `No module named tensorflow` | Run: `pip install tensorflow` |
| `Model not found` | Run step2 first |
| `Connection refused` on predict | Make sure step4_prediction_api.py is running |
| MySQL connection failed | Check username/password in server.js |
| Out of memory during training | Reduce `BATCH_SIZE = 32` to `BATCH_SIZE = 16` in step2 |
| Training very slow | You're using CPU; consider a GPU or reduce EPOCHS |
| Images not parsed | Check filename format: `25_0_2_20010301120000000.jpg` |

---

## 🧠 About the Model

The model uses **MobileNetV2** architecture:
- Pre-trained on 1.2 million ImageNet images
- Fine-tuned on your facial age/gender dataset
- **Dual-output:** predicts age AND gender simultaneously
- Age prediction: regression (outputs a number 0–116)
- Gender prediction: binary classification (Male / Female)
- Typical accuracy: ~88–93% gender, ±5–8 years age error

---

## 📊 What the CSV Columns Mean

| Column | Description |
|--------|-------------|
| `filename` | Image filename |
| `filepath` | Full path to the image |
| `age` | True age (from filename) |
| `gender` | 0 = Male, 1 = Female |
| `race` | 0=White, 1=Black, 2=Asian, 3=Indian, 4=Others |
| `datetime` | Timestamp from filename |
