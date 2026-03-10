# Age & Gender Prediction — Setup Guide

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