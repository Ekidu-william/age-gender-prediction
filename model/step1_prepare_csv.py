"""
STEP 1: Prepare CSV from image filenames
=========================================
Run this first! It reads your image folder and creates train/test CSV files.

HOW TO RUN:
    python step1_prepare_csv.py --images_dir /path/to/your/images

REQUIREMENTS:
    pip install pandas scikit-learn
"""

import os
import re
import argparse
import pandas as pd
from sklearn.model_selection import train_test_split

# Race label mapping for reference
RACE_LABELS = {0: "White", 1: "Black", 2: "Asian", 3: "Indian", 4: "Others"}
GENDER_LABELS = {0: "Male", 1: "Female"}

def parse_filename(filename):
    """
    Parses a filename like: 25_0_2_19901230120000000.jpg
    Returns a dict with age, gender, race, datetime or None if invalid.
    """
    name = os.path.splitext(filename)[0]  # Remove .jpg
    parts = name.split("_")
    
    if len(parts) < 4:
        return None  # Skip files that don't match format
    
    try:
        age = int(parts[0])
        gender = int(parts[1])
        race = int(parts[2])
        datetime_str = parts[3]
        
        # Validate ranges
        if not (0 <= age <= 116):
            return None
        if gender not in [0, 1]:
            return None
        if race not in [0, 1, 2, 3, 4]:
            return None
            
        return {
            "filename": filename,
            "age": age,
            "gender": gender,
            "race": race,
            "datetime": datetime_str
        }
    except (ValueError, IndexError):
        return None


def prepare_csv(images_dir, output_dir="."):
    """
    Reads all images from images_dir, parses filenames,
    and saves train.csv and test.csv (80/20 split).
    """
    print(f"\n📁 Scanning folder: {images_dir}")
    
    if not os.path.exists(images_dir):
        print(f"❌ ERROR: Folder not found: {images_dir}")
        return
    
    all_files = os.listdir(images_dir)
    image_files = [f for f in all_files if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    print(f"✅ Found {len(image_files)} image files")
    
    # Parse each filename
    records = []
    skipped = 0
    for filename in image_files:
        parsed = parse_filename(filename)
        if parsed:
            parsed["filepath"] = os.path.join(images_dir, filename)
            records.append(parsed)
        else:
            skipped += 1
    
    print(f"✅ Successfully parsed: {len(records)} images")
    print(f"⚠️  Skipped (invalid format): {skipped} images")
    
    if len(records) == 0:
        print("❌ No valid images found. Check your filename format: [age]_[gender]_[race]_[datetime].jpg")
        return
    
    # Create DataFrame
    df = pd.DataFrame(records)
    
    # Show statistics
    print(f"\n📊 Dataset Statistics:")
    print(f"   Age range: {df['age'].min()} - {df['age'].max()}")
    print(f"   Gender distribution: {df['gender'].value_counts().to_dict()}")
    print(f"   Race distribution: {df['race'].value_counts().to_dict()}")
    
    # Split 80% train, 20% test (stratify by gender to keep balance)
    train_df, test_df = train_test_split(
        df, 
        test_size=0.2, 
        random_state=42, 
        stratify=df['gender']  # Ensures even gender split in both sets
    )
    
    # Save CSV files
    train_path = os.path.join(output_dir, "train.csv")
    test_path = os.path.join(output_dir, "test.csv")
    
    train_df.to_csv(train_path, index=False)
    test_df.to_csv(test_path, index=False)
    
    print(f"\n✅ CSV files saved!")
    print(f"   Training set: {len(train_df)} images → {train_path}")
    print(f"   Testing set:  {len(test_df)} images → {test_path}")
    print(f"\n👉 Next step: Run step2_train_model.py")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare CSV from image folder")
    parser.add_argument("--images_dir", required=True, help="Path to your images folder")
    parser.add_argument("--output_dir", default=".", help="Where to save the CSV files (default: current folder)")
    args = parser.parse_args()
    
    prepare_csv(args.images_dir, args.output_dir)
