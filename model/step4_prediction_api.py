"""
STEP 4: Python Prediction API (Flask)
=======================================
This is a small web server that receives an image and returns predictions.
The Node.js interface will call this API.

HOW TO RUN:
    python step4_prediction_api.py

    The server runs on http://localhost:5001

REQUIREMENTS:
    pip install flask flask-cors tensorflow pillow numpy

KEEP THIS RUNNING while you use the Node.js interface!
"""

import os
import io
import base64
import numpy as np
import tensorflow as tf
from flask import Flask, request, jsonify
from flask_cors import CORS
from tensorflow.keras.preprocessing.image import load_img, img_to_array
from PIL import Image

app = Flask(__name__)
CORS(app)  # Allow requests from Node.js

MODEL_PATH = "age_gender_model.h5"
IMG_SIZE = 200

# Load model once at startup (not on every request)
print("🔄 Loading model...")
try:
    model = tf.keras.models.load_model(MODEL_PATH)
    print("✅ Model loaded successfully!")
    MODEL_LOADED = True
except Exception as e:
    print(f"❌ Could not load model: {e}")
    print("   Make sure you ran step2_train_model.py first!")
    MODEL_LOADED = False


def preprocess_image(image_bytes):
    """Convert raw image bytes to model-ready numpy array."""
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    img = img.resize((IMG_SIZE, IMG_SIZE))
    img_array = np.array(img) / 255.0
    return np.expand_dims(img_array, axis=0)


@app.route('/health', methods=['GET'])
def health():
    """Check if API is running."""
    return jsonify({
        "status": "ok",
        "model_loaded": MODEL_LOADED
    })


@app.route('/predict', methods=['POST'])
def predict():
    """
    Accepts an image (file upload or base64) and returns age/gender prediction.
    
    Request: multipart form with 'image' file
    Response: JSON with age, gender, confidence
    """
    if not MODEL_LOADED:
        return jsonify({"error": "Model not loaded. Run step2_train_model.py first."}), 503
    
    try:
        # Get image from request
        if 'image' in request.files:
            image_bytes = request.files['image'].read()
        elif 'image_base64' in request.json:
            # Handle base64 encoded image
            b64_data = request.json['image_base64']
            if ',' in b64_data:
                b64_data = b64_data.split(',')[1]  # Remove data:image/jpeg;base64, prefix
            image_bytes = base64.b64decode(b64_data)
        else:
            return jsonify({"error": "No image provided. Send 'image' file or 'image_base64'"}), 400
        
        # Preprocess
        img_array = preprocess_image(image_bytes)
        
        # Predict
        age_pred, gender_pred = model.predict(img_array, verbose=0)
        
        # Convert to human-readable
        predicted_age = int(round(age_pred[0][0] * 116))
        gender_prob = float(gender_pred[0][0])
        predicted_gender = "Female" if gender_prob > 0.5 else "Male"
        gender_confidence = gender_prob if predicted_gender == "Female" else 1 - gender_prob
        
        # Clamp age to valid range
        predicted_age = max(0, min(116, predicted_age))
        
        return jsonify({
            "age": predicted_age,
            "gender": predicted_gender,
            "gender_confidence": round(gender_confidence * 100, 1),
            "raw_age_normalized": float(age_pred[0][0]),
            "raw_gender_probability": gender_prob
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    print("\n" + "=" * 50)
    print("🚀 Prediction API starting on http://localhost:5001")
    print("   Keep this running while using the web interface!")
    print("=" * 50 + "\n")
    app.run(host='0.0.0.0', port=5001, debug=False)
