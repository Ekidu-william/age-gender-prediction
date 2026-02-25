"""
STEP 2: Train the Age & Gender Prediction Model
=================================================
Run this after step1_prepare_csv.py

HOW TO RUN:
    python step2_train_model.py

WHAT THIS DOES:
- Loads train.csv and test.csv
- Trains a MobileNetV2-based deep learning model (lightweight, accurate, fast)
- Predicts BOTH age (regression) and gender (classification) simultaneously
- Runs for 10 epochs
- Saves the trained model as: age_gender_model.h5

REQUIREMENTS (install these first):
    pip install tensorflow pandas numpy scikit-learn matplotlib pillow

GPU (optional but recommended for speed):
    If you have an NVIDIA GPU, install tensorflow-gpu instead of tensorflow.
    Training will be ~5-10x faster.

ESTIMATED TRAINING TIME:
    CPU: ~2-4 hours for 24,000 images
    GPU: ~20-40 minutes
"""

import os
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras import layers, Model
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau
from tensorflow.keras.preprocessing.image import load_img, img_to_array
from sklearn.preprocessing import LabelEncoder
import matplotlib.pyplot as plt

# ─── CONFIGURATION ───────────────────────────────────────────────────────────
IMG_SIZE = 200          # Your images are 200x200
BATCH_SIZE = 32         # How many images to process at once (reduce to 16 if RAM errors)
EPOCHS = 10             # Number of training rounds
LEARNING_RATE = 0.0001  # How fast the model learns
TRAIN_CSV = "train.csv"
TEST_CSV = "test.csv"
MODEL_SAVE_PATH = "age_gender_model.h5"
# ─────────────────────────────────────────────────────────────────────────────


# ─── DATA LOADING ─────────────────────────────────────────────────────────────
class DataGenerator(tf.keras.utils.Sequence):
    """
    Custom data loader - loads images in batches so you don't run out of RAM.
    All 24,000 images can't fit in memory at once, so we load them in chunks.
    """
    
    def __init__(self, df, img_size, batch_size, augment=False):
        self.df = df.reset_index(drop=True)
        self.img_size = img_size
        self.batch_size = batch_size
        self.augment = augment  # Data augmentation for training only
        self.indices = np.arange(len(self.df))
    
    def __len__(self):
        return int(np.ceil(len(self.df) / self.batch_size))
    
    def __getitem__(self, idx):
        batch_indices = self.indices[idx * self.batch_size:(idx + 1) * self.batch_size]
        batch_df = self.df.iloc[batch_indices]
        
        images = []
        ages = []
        genders = []
        
        for _, row in batch_df.iterrows():
            try:
                # Load and preprocess image
                img = load_img(row['filepath'], target_size=(self.img_size, self.img_size))
                img_array = img_to_array(img) / 255.0  # Normalize to 0-1
                
                if self.augment:
                    img_array = self._augment(img_array)
                
                images.append(img_array)
                ages.append(row['age'] / 116.0)     # Normalize age to 0-1
                genders.append(row['gender'])        # 0 or 1
                
            except Exception as e:
                # Skip corrupted images
                images.append(np.zeros((self.img_size, self.img_size, 3)))
                ages.append(0.5)
                genders.append(0)
        
        return np.array(images), {
            "age_output": np.array(ages, dtype=np.float32),
            "gender_output": np.array(genders, dtype=np.float32)
        }
    
    def _augment(self, img):
        """Simple data augmentation - creates slight variations to help model generalize."""
        # Random horizontal flip
        if np.random.random() > 0.5:
            img = np.fliplr(img)
        # Random brightness
        factor = np.random.uniform(0.8, 1.2)
        img = np.clip(img * factor, 0, 1)
        return img
    
    def on_epoch_end(self):
        np.random.shuffle(self.indices)  # Shuffle data each epoch


# ─── MODEL ARCHITECTURE ───────────────────────────────────────────────────────
def build_model(img_size):
    """
    Uses MobileNetV2 as the backbone (pre-trained on ImageNet).
    
    WHY MobileNetV2?
    - Lightweight and fast (designed for mobile/embedded use)
    - Pre-trained - already knows how to detect facial features
    - Dual output: predicts both age AND gender simultaneously
    - Accurate enough for production use
    """
    
    # Base model - pre-trained feature extractor
    base_model = MobileNetV2(
        input_shape=(img_size, img_size, 3),
        include_top=False,          # Remove original classification head
        weights='imagenet'          # Use pre-trained weights
    )
    
    # Freeze early layers (they already know basic features like edges/shapes)
    # Only train the last 30 layers to adapt to facial images
    for layer in base_model.layers[:-30]:
        layer.trainable = False
    
    # Build custom head
    x = base_model.output
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(256, activation='relu')(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.2)(x)
    
    # AGE output - regression (predicts a number)
    age_branch = layers.Dense(128, activation='relu')(x)
    age_output = layers.Dense(1, activation='sigmoid', name='age_output')(age_branch)
    
    # GENDER output - binary classification (predicts 0 or 1)
    gender_branch = layers.Dense(64, activation='relu')(x)
    gender_output = layers.Dense(1, activation='sigmoid', name='gender_output')(gender_branch)
    
    model = Model(inputs=base_model.input, outputs=[age_output, gender_output])
    
    return model


# ─── TRAINING ─────────────────────────────────────────────────────────────────
def train():
    print("=" * 60)
    print("🚀 Age & Gender Prediction Model Training")
    print("=" * 60)
    
    # Load CSVs
    print("\n📂 Loading CSV files...")
    if not os.path.exists(TRAIN_CSV) or not os.path.exists(TEST_CSV):
        print("❌ ERROR: train.csv or test.csv not found!")
        print("   Please run step1_prepare_csv.py first.")
        return
    
    train_df = pd.read_csv(TRAIN_CSV)
    test_df = pd.read_csv(TEST_CSV)
    
    print(f"✅ Training samples: {len(train_df)}")
    print(f"✅ Testing samples:  {len(test_df)}")
    
    # Create data generators
    print("\n⚙️  Setting up data generators...")
    train_gen = DataGenerator(train_df, IMG_SIZE, BATCH_SIZE, augment=True)
    test_gen = DataGenerator(test_df, IMG_SIZE, BATCH_SIZE, augment=False)
    
    # Build model
    print("\n🏗️  Building model...")
    model = build_model(IMG_SIZE)
    
    model.compile(
        optimizer=Adam(learning_rate=LEARNING_RATE),
        loss={
            'age_output': 'mse',                   # Mean Squared Error for age
            'gender_output': 'binary_crossentropy'  # Binary crossentropy for gender
        },
        loss_weights={
            'age_output': 1.0,
            'gender_output': 0.5
        },
        metrics={
            'age_output': ['mae'],          # Mean Absolute Error in years
            'gender_output': ['accuracy']   # Accuracy for gender
        }
    )
    
    print(f"\n📊 Model Summary:")
    print(f"   Total parameters: {model.count_params():,}")
    print(f"   Trainable parameters: {sum([tf.size(w).numpy() for w in model.trainable_weights]):,}")
    
    # Callbacks - helpful tools during training
    callbacks = [
        # Save best model automatically
        ModelCheckpoint(
            MODEL_SAVE_PATH,
            monitor='val_gender_output_accuracy',
            save_best_only=True,
            verbose=1
        ),
        # Stop early if model stops improving (prevents wasting time)
        EarlyStopping(
            monitor='val_loss',
            patience=3,         # Stop if no improvement for 3 epochs
            restore_best_weights=True,
            verbose=1
        ),
        # Reduce learning rate when stuck
        ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=2,
            min_lr=1e-7,
            verbose=1
        )
    ]
    
    # START TRAINING
    print(f"\n🎯 Starting training for {EPOCHS} epochs...")
    print("   This will take a while. Go grab a coffee! ☕")
    print("-" * 60)
    
    history = model.fit(
        train_gen,
        validation_data=test_gen,
        epochs=EPOCHS,
        callbacks=callbacks,
        verbose=1
    )
    
    # ─── RESULTS ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("✅ TRAINING COMPLETE!")
    print("=" * 60)
    
    # Final metrics
    final_gender_acc = history.history.get('val_gender_output_accuracy', [0])[-1]
    final_age_mae = history.history.get('val_age_output_mae', [0])[-1]
    
    # Convert age MAE back to years (we normalized age to 0-1)
    age_mae_years = final_age_mae * 116
    
    print(f"\n📈 Final Results:")
    print(f"   Gender Accuracy: {final_gender_acc * 100:.1f}%")
    print(f"   Age Error (MAE): ±{age_mae_years:.1f} years")
    print(f"\n💾 Model saved to: {MODEL_SAVE_PATH}")
    
    # Plot training curves
    plot_history(history)
    print(f"\n📊 Training graphs saved to: training_history.png")
    print(f"\n👉 Next step: Run step3_test_model.py to test your model")


def plot_history(history):
    """Saves training progress charts."""
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle('Model Training History', fontsize=16)
    
    # Gender Accuracy
    axes[0, 0].plot(history.history['gender_output_accuracy'], label='Train', color='blue')
    axes[0, 0].plot(history.history['val_gender_output_accuracy'], label='Validation', color='orange')
    axes[0, 0].set_title('Gender Accuracy')
    axes[0, 0].set_xlabel('Epoch')
    axes[0, 0].set_ylabel('Accuracy')
    axes[0, 0].legend()
    axes[0, 0].grid(True)
    
    # Age MAE
    axes[0, 1].plot(history.history['age_output_mae'], label='Train', color='blue')
    axes[0, 1].plot(history.history['val_age_output_mae'], label='Validation', color='orange')
    axes[0, 1].set_title('Age MAE (normalized)')
    axes[0, 1].set_xlabel('Epoch')
    axes[0, 1].set_ylabel('MAE')
    axes[0, 1].legend()
    axes[0, 1].grid(True)
    
    # Total Loss
    axes[1, 0].plot(history.history['loss'], label='Train', color='blue')
    axes[1, 0].plot(history.history['val_loss'], label='Validation', color='orange')
    axes[1, 0].set_title('Total Loss')
    axes[1, 0].set_xlabel('Epoch')
    axes[1, 0].set_ylabel('Loss')
    axes[1, 0].legend()
    axes[1, 0].grid(True)
    
    # Gender Loss
    axes[1, 1].plot(history.history['gender_output_loss'], label='Train', color='blue')
    axes[1, 1].plot(history.history['val_gender_output_loss'], label='Validation', color='orange')
    axes[1, 1].set_title('Gender Loss')
    axes[1, 1].set_xlabel('Epoch')
    axes[1, 1].set_ylabel('Loss')
    axes[1, 1].legend()
    axes[1, 1].grid(True)
    
    plt.tight_layout()
    plt.savefig('training_history.png', dpi=100, bbox_inches='tight')
    plt.close()


if __name__ == "__main__":
    # Check TensorFlow version and GPU
    print(f"TensorFlow version: {tf.__version__}")
    gpus = tf.config.list_physical_devices('GPU')
    if gpus:
        print(f"✅ GPU detected: {gpus}")
    else:
        print("⚠️  No GPU detected - training will use CPU (slower)")
    
    train()
