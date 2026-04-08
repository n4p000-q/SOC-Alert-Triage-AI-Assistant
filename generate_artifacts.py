#!/usr/bin/env python3
"""
Generate Required Model Artifacts
==================================
This script creates the following files needed by the Flask backend:
1. feature_names.json - List of all 194 feature names
2. scaler.pkl - StandardScaler fitted on training data
3. shap_background.csv - 100 random samples for SHAP explanations

Run this ONCE after setting up your environment.
"""

import pandas as pd
import numpy as np
import json
import joblib
from pathlib import Path
from sklearn.preprocessing import StandardScaler

# Paths
DATA_DIR = Path("data/processed")
MODELS_DIR = Path("models")

print("=" * 60)
print("Generating Model Artifacts")
print("=" * 60)

# ============================================================
# 1. Load Training Data
# ============================================================
print("\n[1/3] Loading training data...")
X_train = pd.read_csv(DATA_DIR / "X_train.csv")
print(f"  ✓ Loaded X_train: {X_train.shape}")

# ============================================================
# 2. Generate feature_names.json
# ============================================================
print("\n[2/3] Generating feature_names.json...")
feature_names = X_train.columns.tolist()

output_path = MODELS_DIR / "feature_names.json"
with open(output_path, 'w') as f:
    json.dump(feature_names, f, indent=2)

print(f"  ✓ Saved {len(feature_names)} feature names to: {output_path}")
print(f"  ✓ First 5 features: {feature_names[:5]}")

# ============================================================
# 3. Generate scaler.pkl
# ============================================================
print("\n[3/3] Generating scaler.pkl...")

# Fit scaler on training data
scaler = StandardScaler()
scaler.fit(X_train)

output_path = MODELS_DIR / "scaler.pkl"
joblib.dump(scaler, output_path)

print(f"  ✓ Saved fitted StandardScaler to: {output_path}")
print(f"  ✓ Scaler mean shape: {scaler.mean_.shape}")
print(f"  ✓ Scaler scale shape: {scaler.scale_.shape}")

# ============================================================
# 4. Generate shap_background.csv
# ============================================================
print("\n[4/4] Generating shap_background.csv...")

# Take 100 random samples for SHAP background
np.random.seed(42)
sample_indices = np.random.choice(len(X_train), size=100, replace=False)
shap_background = X_train.iloc[sample_indices]

output_path = MODELS_DIR / "shap_background.csv"
shap_background.to_csv(output_path, index=False)

print(f"  ✓ Saved 100 background samples to: {output_path}")
print(f"  ✓ Background data shape: {shap_background.shape}")

# ============================================================
# Summary
# ============================================================
print("\n" + "=" * 60)
print("SUCCESS! All artifacts generated:")
print("=" * 60)
print(f"  1. {MODELS_DIR / 'feature_names.json'}")
print(f"  2. {MODELS_DIR / 'scaler.pkl'}")
print(f"  3. {MODELS_DIR / 'shap_background.csv'}")
print("\nYou can now run the Flask backend!")
print("=" * 60)
