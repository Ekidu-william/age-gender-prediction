"""
STEP 3: Test the Trained Model
================================
Run this after step2_train_model.py to see how well your model works.

HOW TO RUN:
    # Test on a single image:
    python step3_test_model.py --image /path/to/face.jpg

    # Test on entire test set:
    python step3_test_model.py --evaluate

REQUIREMENTS:
    Same as step 2 (tensorflow, pandas, numpy, pillow)
"""

import numpy as np
import tensorflow as tf
import argparse
from tensorflow.keras.preprocessing.image import load_img, img_to_array
import os

MODEL_PATH = "age_gender_model.h5"
IMG_SIZE = 200
GENDER_LABELS = {0: "Male", 1: "Female"}


def load_model():
    if not os.path.exists(MODEL_PATH):
        print(f"❌ Model not found at {MODEL_PATH}")
        print("   Run step2_train_model.py first!")
        exit(1)
    print(f"✅ Loading model from {MODEL_PATH}...")
    return tf.keras.models.load_model(MODEL_PATH)


def predict_single(image_path):
    """Predict age and gender for a single image."""
    model = load_model()
    
    # Load and preprocess
    img = load_img(image_path, target_size=(IMG_SIZE, IMG_SIZE))
    img_array = img_to_array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)  # Add batch dimension
    
    # Predict
    age_pred, gender_pred = model.predict(img_array, verbose=0)
    
    # Convert predictions back to human-readable values
    predicted_age = int(age_pred[0][0] * 116)  # Denormalize
    predicted_gender = "Female" if gender_pred[0][0] > 0.5 else "Male"
    gender_confidence = gender_pred[0][0] if predicted_gender == "Female" else 1 - gender_pred[0][0]
    
    print(f"\n🎯 Prediction Results for: {image_path}")
    print(f"   Predicted Age:    {predicted_age} years")
    print(f"   Predicted Gender: {predicted_gender} ({gender_confidence * 100:.1f}% confidence)")
    
    return predicted_age, predicted_gender


def evaluate_on_test_set():
    """Run evaluation on the full test set."""
    import pandas as pd
    
    if not os.path.exists("test.csv"):
        print("❌ test.csv not found. Run step1_prepare_csv.py first.")
        return
    
    model = load_model()
    test_df = pd.read_csv("test.csv")
    
    print(f"\n📊 Evaluating on {len(test_df)} test images...")
    
    age_errors = []
    gender_correct = 0
    total = 0
    
    for _, row in test_df.iterrows():
        try:
            img = load_img(row['filepath'], target_size=(IMG_SIZE, IMG_SIZE))
            img_array = img_to_array(img) / 255.0
            img_array = np.expand_dims(img_array, axis=0)
            
            age_pred, gender_pred = model.predict(img_array, verbose=0)
            
            pred_age = int(age_pred[0][0] * 116)
            pred_gender = 1 if gender_pred[0][0] > 0.5 else 0
            
            age_errors.append(abs(pred_age - row['age']))
            if pred_gender == row['gender']:
                gender_correct += 1
            total += 1
            
            if total % 500 == 0:
                print(f"   Processed {total}/{len(test_df)}...")
        except:
            pass
    
    print(f"\n✅ Evaluation Complete!")
    print(f"   Gender Accuracy:  {gender_correct / total * 100:.1f}%")
    print(f"   Age MAE:          ±{np.mean(age_errors):.1f} years")
    print(f"   Age within 5yr:   {sum(e <= 5 for e in age_errors) / total * 100:.1f}%")
    print(f"   Age within 10yr:  {sum(e <= 10 for e in age_errors) / total * 100:.1f}%")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", help="Path to a single image to predict")
    parser.add_argument("--evaluate", action="store_true", help="Evaluate on test set")
    args = parser.parse_args()
    
    if args.image:
        predict_single(args.image)
    elif args.evaluate:
        evaluate_on_test_set()
    else:
        print("Usage:")
        print("  python step3_test_model.py --image /path/to/face.jpg")
        print("  python step3_test_model.py --evaluate")
