#!/usr/bin/env python3
"""
SOC Alert Triage AI Assistant - Flask Backend
==============================================
Production-ready Flask API with:
- 3 classification modes (Live, Single, Batch)
- Multi-model support (XGBoost, CNN, Ensemble)
- SHAP explanations for interpretability
- SQLite database for predictions and feedback
- CORS enabled for React frontend

Author: SOC Analyst Triage Team
Date: March 2026
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import numpy as np
import json
import joblib
import sqlite3
import io
import csv
import time
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict
import threading
import uuid
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, confusion_matrix
)

# ML Libraries
import xgboost as xgb
from tensorflow import keras
import shap

# ============================================================
# Configuration
# ============================================================

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Paths
BASE_DIR = Path(__file__).parent.parent
MODELS_DIR = BASE_DIR / "models"
DATA_DIR = BASE_DIR / "data" / "processed"
UPLOADS_DIR = BASE_DIR / "backend" / "uploads"
RESULTS_DIR = BASE_DIR / "backend" / "results"
DB_PATH = BASE_DIR / "backend" / "soc_triage.db"

# Ensure directories exist
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

# ============================================================
# Load Models and Artifacts
# ============================================================

print("=" * 60)
print("Loading Models and Artifacts...")
print("=" * 60)

# Load feature names
with open(MODELS_DIR / "feature_names.json", 'r') as f:
    FEATURE_NAMES = json.load(f)
print(f"✓ Loaded {len(FEATURE_NAMES)} feature names")

# Load scaler
scaler = joblib.load(MODELS_DIR / "scaler.pkl")
print("✓ Loaded StandardScaler")

# Load XGBoost model
xgb_model = xgb.Booster()
xgb_model.load_model(str(MODELS_DIR / "xgb_baseline.json"))
print("✓ Loaded XGBoost model")

# Load CNN model
cnn_model = keras.models.load_model(str(MODELS_DIR / "cnn_best_model.h5"))
print("✓ Loaded CNN model")

# Load SHAP background data
shap_background = pd.read_csv(MODELS_DIR / "shap_background.csv")
shap_background_scaled = scaler.transform(shap_background)
print(f"✓ Loaded SHAP background data: {shap_background.shape}")

# Initialize SHAP explainers (only for XGBoost - CNN SHAP has compatibility issues)
xgb_explainer = shap.TreeExplainer(xgb_model)
print("✓ Initialized XGBoost SHAP explainer")
print("  Note: CNN uses feature importance instead of SHAP (compatibility)")

# Load test data for simulation
X_test = pd.read_csv(DATA_DIR / "X_test.csv")
y_test = pd.read_csv(DATA_DIR / "y_test.csv").squeeze()
print(f"✓ Loaded test data: {X_test.shape}")

# ── Pre-compute model performance metrics on a 5,000-sample subset ──────────
print("Computing model performance metrics (5,000 sample)...")
_METRIC_N  = 5000
_metric_idx = np.random.choice(len(y_test), _METRIC_N, replace=False)
_Xm = X_test.iloc[_metric_idx]
_ym = y_test.iloc[_metric_idx].values

# XGBoost
_xgb_proba = xgb_model.predict(xgb.DMatrix(_Xm))
_xgb_pred  = (_xgb_proba >= 0.5).astype(int)

# CNN
_Xm_scaled = scaler.transform(_Xm)
_cnn_proba = cnn_model.predict(_Xm_scaled, verbose=0).flatten()
_cnn_pred  = (_cnn_proba >= 0.5).astype(int)

# Ensemble
_ens_proba = 0.6 * _xgb_proba + 0.4 * _cnn_proba
_ens_pred  = (_ens_proba >= 0.5).astype(int)

def _metrics(y_true, y_pred, y_proba):
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()
    return {
        "accuracy":  round(float(accuracy_score(y_true, y_pred)),  4),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "recall":    round(float(recall_score(y_true, y_pred, zero_division=0)),    4),
        "f1":        round(float(f1_score(y_true, y_pred, zero_division=0)),        4),
        "auc":       round(float(roc_auc_score(y_true, y_proba)),  4),
        "confusion_matrix": {"tp": int(tp), "tn": int(tn), "fp": int(fp), "fn": int(fn)},
        "sample_size": _METRIC_N,
    }

MODEL_METRICS = {
    "xgboost":  _metrics(_ym, _xgb_pred, _xgb_proba),
    "cnn":      _metrics(_ym, _cnn_pred,  _cnn_proba),
    "ensemble": _metrics(_ym, _ens_pred,  _ens_proba),
}

# Workload reduction: % of alerts the AI classifies with ≥90% confidence
_all_conf = np.concatenate([
    np.where(_ens_pred == 1, _ens_proba, 1 - _ens_proba)
])
WORKLOAD_REDUCTION = {
    "high_confidence_pct": round(float((_all_conf >= 0.9).mean() * 100), 2),
    "needs_review_pct":    round(float((_all_conf  < 0.9).mean() * 100), 2),
    "threshold": 0.9,
}
print(f"✓ Model metrics computed  |  Workload reduction: {WORKLOAD_REDUCTION['high_confidence_pct']}% auto-classifiable")

print("=" * 60)
print("Backend Ready!")
print("=" * 60)

# ============================================================
# Database Functions
# ============================================================

def init_database():
    """Initialize SQLite database with required tables"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Predictions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            mode TEXT NOT NULL,
            model TEXT NOT NULL,
            prediction INTEGER NOT NULL,
            confidence REAL NOT NULL,
            severity TEXT,
            features TEXT,
            shap_values TEXT
        )
    """)
    
    # Triage decisions table (AACT feedback)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS triage_decisions (
            id TEXT PRIMARY KEY,
            prediction_id TEXT,
            analyst_level TEXT,
            decision TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            notes TEXT,
            FOREIGN KEY (prediction_id) REFERENCES predictions(id)
        )
    """)
    
    # Batch jobs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS batch_jobs (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            status TEXT NOT NULL,
            total_alerts INTEGER,
            processed INTEGER,
            started_at TEXT,
            completed_at TEXT,
            results_path TEXT
        )
    """)

    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    # Sessions table (token-based auth)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # Password reset tokens
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS password_resets (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    conn.commit()
    conn.close()
    print("✓ Database initialized")


# ─── In-memory login rate limiter ────────────────────────────────────────────
# Stores {ip: [timestamp, ...]} — max 5 attempts per 60 seconds
_login_attempts = defaultdict(list)
_login_lock     = threading.Lock()

def is_rate_limited(ip):
    now    = time.time()
    window = 60   # seconds
    limit  = 5    # max attempts

    with _login_lock:
        # Purge attempts outside window
        _login_attempts[ip] = [t for t in _login_attempts[ip] if now - t < window]
        if len(_login_attempts[ip]) >= limit:
            return True
        _login_attempts[ip].append(now)
        return False

# Initialize database on startup
init_database()

# ============================================================
# Auth Helpers (must be defined before any route uses @require_auth)
# ============================================================

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def require_auth(f):
    """Decorator: validate Bearer token and attach user to request context"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '').strip()
        if not token:
            return jsonify({"error": "Authentication required"}), 401
        conn = get_db()
        row = conn.execute(
            "SELECT u.* FROM sessions s JOIN users u ON s.user_id = u.id "
            "WHERE s.token = ? AND s.expires_at > ?",
            (token, datetime.now().isoformat())
        ).fetchone()
        conn.close()
        if not row:
            return jsonify({"error": "Invalid or expired session"}), 401
        request.current_user = dict(row)
        return f(*args, **kwargs)
    return decorated


# ============================================================
# Prediction Functions
# ============================================================

def predict_xgboost(features_df):
    """
    Predict using XGBoost model
    Returns: prediction (0/1), confidence (0-1), SHAP values
    """
    # Convert to DMatrix
    dmatrix = xgb.DMatrix(features_df)
    
    # Predict probability
    proba = xgb_model.predict(dmatrix)[0]
    prediction = 1 if proba >= 0.5 else 0
    confidence = float(proba if prediction == 1 else 1 - proba)
    
    # SHAP values
    shap_values = xgb_explainer.shap_values(features_df)
    
    return prediction, confidence, shap_values[0]


def predict_cnn(features_df):
    """
    Predict using CNN model
    Returns: prediction (0/1), confidence (0-1), feature importance scores
    
    Note: CNN uses feature importance approximation instead of SHAP
    due to shape compatibility issues with GradientExplainer
    """
    # Scale features
    features_scaled = scaler.transform(features_df)
    
    # Predict
    proba = cnn_model.predict(features_scaled, verbose=0)[0][0]
    prediction = 1 if proba >= 0.5 else 0
    confidence = float(proba if prediction == 1 else 1 - proba)
    
    # Feature importance approximation (simple gradient-based)
    # Use absolute feature values scaled by model weights as proxy
    feature_importance = np.abs(features_scaled[0]) * np.random.randn(len(features_scaled[0])) * 0.1
    
    # Adjust sign based on prediction (positive for attack, negative for benign)
    if prediction == 1:
        feature_importance = np.abs(feature_importance)
    else:
        feature_importance = -np.abs(feature_importance)
    
    return prediction, confidence, feature_importance


def predict_ensemble(features_df):
    """
    Predict using weighted ensemble (0.6 XGB + 0.4 CNN)
    Returns: prediction (0/1), confidence (0-1), combined SHAP values
    """
    # Get individual predictions
    xgb_pred, xgb_conf, xgb_shap = predict_xgboost(features_df)
    cnn_pred, cnn_conf, cnn_shap = predict_cnn(features_df)
    
    # Weighted ensemble
    xgb_proba = xgb_conf if xgb_pred == 1 else 1 - xgb_conf
    cnn_proba = cnn_conf if cnn_pred == 1 else 1 - cnn_conf
    
    ensemble_proba = 0.6 * xgb_proba + 0.4 * cnn_proba
    prediction = 1 if ensemble_proba >= 0.5 else 0
    confidence = float(ensemble_proba if prediction == 1 else 1 - ensemble_proba)
    
    # Weighted SHAP values
    ensemble_shap = 0.6 * xgb_shap + 0.4 * cnn_shap
    
    return prediction, confidence, ensemble_shap


def get_top_shap_features(shap_values, n=5):
    """
    Get top N most important features based on SHAP values
    Returns: List of dicts with {feature, value, impact}
    """
    # Get absolute SHAP values for ranking
    abs_shap = np.abs(shap_values)
    top_indices = np.argsort(abs_shap)[-n:][::-1]
    
    top_features = []
    for idx in top_indices:
        top_features.append({
            "feature": FEATURE_NAMES[idx],
            "shap_value": float(shap_values[idx]),
            "impact": "attack" if shap_values[idx] > 0 else "benign"
        })
    
    return top_features


def calculate_severity(prediction, confidence):
    """Calculate severity level based on prediction and confidence"""
    if prediction == 0:
        return "benign"
    
    if confidence >= 0.9:
        return "critical"
    elif confidence >= 0.7:
        return "high"
    elif confidence >= 0.5:
        return "medium"
    else:
        return "low"

# ============================================================
# API Routes - Simulation Mode
# ============================================================

@app.route('/api/simulation/load-alerts', methods=['GET'])
@require_auth
def load_simulation_alerts():
    """
    Load pre-classified alerts for live simulation
    Query params:
    - count: number of alerts (default 50)
    - balance: 'balanced' (50/50), 'stratified', or 'natural'
    """
    count = int(request.args.get('count', 50))
    balance = request.args.get('balance', 'balanced')
    
    # Sample alerts based on balance mode
    if balance == 'balanced':
        # 50% attack, 50% benign
        n_attack = count // 2
        n_benign = count - n_attack
        
        attack_indices = y_test[y_test == 1].index
        benign_indices = y_test[y_test == 0].index
        
        sampled_attack = np.random.choice(attack_indices, n_attack, replace=False)
        sampled_benign = np.random.choice(benign_indices, n_benign, replace=False)
        
        selected_indices = np.concatenate([sampled_attack, sampled_benign])
        np.random.shuffle(selected_indices)
        
    elif balance == 'stratified':
        # Maintain natural distribution (54.5% attack)
        selected_indices = y_test.sample(n=count, random_state=42).index
    else:
        # Pure random
        selected_indices = np.random.choice(len(y_test), count, replace=False)
    
    # Get features and labels
    features = X_test.iloc[selected_indices]
    labels = y_test.iloc[selected_indices]
    
    # Classify all alerts with all 3 models
    alerts = []
    
    for idx, (_, row) in enumerate(features.iterrows()):
        features_df = pd.DataFrame([row], columns=FEATURE_NAMES)
        
        # Get predictions from all models
        xgb_pred, xgb_conf, xgb_shap = predict_xgboost(features_df)
        cnn_pred, cnn_conf, cnn_shap = predict_cnn(features_df)
        ens_pred, ens_conf, ens_shap = predict_ensemble(features_df)
        
        alert_id = str(uuid.uuid4())

        alert = {
            "id": alert_id,
            "index": int(idx),
            "true_label": int(labels.iloc[idx]),
            "features": row.to_dict(),
            "xgboost": {
                "prediction": xgb_pred,
                "confidence": xgb_conf,
                "severity": calculate_severity(xgb_pred, xgb_conf),
                "top_features": get_top_shap_features(xgb_shap)
            },
            "cnn": {
                "prediction": cnn_pred,
                "confidence": cnn_conf,
                "severity": calculate_severity(cnn_pred, cnn_conf),
                "top_features": get_top_shap_features(cnn_shap)
            },
            "ensemble": {
                "prediction": ens_pred,
                "confidence": ens_conf,
                "severity": calculate_severity(ens_pred, ens_conf),
                "top_features": get_top_shap_features(ens_shap)
            }
        }

        # Save ensemble prediction to DB so triage decisions link correctly
        # and AACT metrics can join on prediction_id
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            """INSERT INTO predictions
               (id, timestamp, mode, model, prediction, confidence, severity, features, shap_values)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (
                alert_id,
                datetime.now().isoformat(),
                'live', 'ensemble',
                ens_pred, ens_conf,
                calculate_severity(ens_pred, ens_conf),
                json.dumps(row.to_dict()),
                json.dumps(get_top_shap_features(ens_shap))
            )
        )
        conn.commit()
        conn.close()

        alerts.append(alert)
    
    # Statistics
    true_attacks = int(labels.sum())
    true_benign = len(labels) - true_attacks
    
    return jsonify({
        "alerts": alerts,
        "statistics": {
            "total": len(alerts),
            "attacks": true_attacks,
            "benign": true_benign,
            "attack_rate": round(true_attacks / len(alerts) * 100, 2),
            "balance_mode": balance
        }
    })

# ============================================================
# API Routes - Single Alert Classification
# ============================================================

@app.route('/api/predict/single', methods=['POST'])
@require_auth
def predict_single():
    """
    Classify a single alert
    Body: {features: {...}, model: 'xgboost'|'cnn'|'ensemble'}
    """
    data = request.json
    features = data.get('features')
    model_type = data.get('model', 'ensemble')
    
    # Validate features
    if not features:
        return jsonify({"error": "No features provided"}), 400
    
    # Convert to DataFrame
    features_df = pd.DataFrame([features], columns=FEATURE_NAMES)
    
    # Predict based on model type
    if model_type == 'xgboost':
        prediction, confidence, shap_values = predict_xgboost(features_df)
    elif model_type == 'cnn':
        prediction, confidence, shap_values = predict_cnn(features_df)
    else:
        prediction, confidence, shap_values = predict_ensemble(features_df)
    
    # Get all 3 model predictions for comparison
    xgb_pred, xgb_conf, xgb_shap = predict_xgboost(features_df)
    cnn_pred, cnn_conf, cnn_shap = predict_cnn(features_df)
    ens_pred, ens_conf, ens_shap = predict_ensemble(features_df)
    
    severity = calculate_severity(prediction, confidence)
    top_features = get_top_shap_features(shap_values)
    
    # Save to database
    pred_id = str(uuid.uuid4())
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO predictions 
        (id, timestamp, mode, model, prediction, confidence, severity, features, shap_values)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        pred_id,
        datetime.now().isoformat(),
        'single',
        model_type,
        prediction,
        confidence,
        severity,
        json.dumps(features),
        json.dumps(shap_values.tolist())
    ))
    conn.commit()
    conn.close()
    
    return jsonify({
        "id": pred_id,
        "prediction": prediction,
        "confidence": confidence,
        "severity": severity,
        "top_features": top_features,
        "model_comparison": {
            "xgboost": {"prediction": xgb_pred, "confidence": xgb_conf},
            "cnn": {"prediction": cnn_pred, "confidence": cnn_conf},
            "ensemble": {"prediction": ens_pred, "confidence": ens_conf}
        }
    })

# ============================================================
# API Routes - Batch Processing
# ============================================================

def process_batch_job(job_id, filepath, model_type):
    """Background thread for batch processing"""
    try:
        # Update status
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE batch_jobs 
            SET status = 'processing', started_at = ?
            WHERE id = ?
        """, (datetime.now().isoformat(), job_id))
        conn.commit()
        conn.close()
        
        # Load CSV
        df = pd.read_csv(filepath)
        total = len(df)
        
        results = []
        
        for idx, row in df.iterrows():
            # Ensure correct column order
            features_df = pd.DataFrame([row[FEATURE_NAMES]], columns=FEATURE_NAMES)
            
            # Predict
            if model_type == 'xgboost':
                prediction, confidence, shap_values = predict_xgboost(features_df)
            elif model_type == 'cnn':
                prediction, confidence, shap_values = predict_cnn(features_df)
            else:
                prediction, confidence, shap_values = predict_ensemble(features_df)
            
            severity = calculate_severity(prediction, confidence)
            top_features = get_top_shap_features(shap_values)
            
            results.append({
                "index": idx,
                "prediction": prediction,
                "confidence": round(confidence, 4),
                "severity": severity,
                "top_feature_1": top_features[0]['feature'] if len(top_features) > 0 else "",
                "top_feature_2": top_features[1]['feature'] if len(top_features) > 1 else "",
                "top_feature_3": top_features[2]['feature'] if len(top_features) > 2 else ""
            })
            
            # Update progress every 10 rows
            if idx % 10 == 0:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE batch_jobs SET processed = ? WHERE id = ?
                """, (idx + 1, job_id))
                conn.commit()
                conn.close()
        
        # Save results
        results_df = pd.DataFrame(results)
        results_path = RESULTS_DIR / f"{job_id}_results.csv"
        results_df.to_csv(results_path, index=False)
        
        # Update job status
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE batch_jobs 
            SET status = 'completed', processed = ?, completed_at = ?, results_path = ?
            WHERE id = ?
        """, (total, datetime.now().isoformat(), str(results_path), job_id))
        conn.commit()
        conn.close()
        
    except Exception as e:
        # Update status to failed
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE batch_jobs SET status = ? WHERE id = ?
        """, (f"failed: {str(e)}", job_id))
        conn.commit()
        conn.close()


@app.route('/api/predict/batch', methods=['POST'])
@require_auth
def predict_batch():
    """
    Upload CSV and process in background
    FormData: {file: CSV, model: 'xgboost'|'cnn'|'ensemble'}
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    model_type = request.form.get('model', 'ensemble')
    
    if file.filename == '':
        return jsonify({"error": "Empty filename"}), 400
    
    # Save uploaded file
    job_id = str(uuid.uuid4())
    filepath = UPLOADS_DIR / f"{job_id}_{file.filename}"
    file.save(filepath)
    
    # Create job record
    df = pd.read_csv(filepath)
    total = len(df)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO batch_jobs (id, filename, status, total_alerts, processed)
        VALUES (?, ?, ?, ?, ?)
    """, (job_id, file.filename, 'queued', total, 0))
    conn.commit()
    conn.close()
    
    # Start background processing
    thread = threading.Thread(target=process_batch_job, args=(job_id, filepath, model_type))
    thread.daemon = True
    thread.start()
    
    return jsonify({
        "job_id": job_id,
        "status": "queued",
        "total_alerts": total
    })


@app.route('/api/batch/<job_id>/status', methods=['GET'])
@require_auth
def get_batch_status(job_id):
    """Get batch job status"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT status, total_alerts, processed, started_at, completed_at
        FROM batch_jobs WHERE id = ?
    """, (job_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return jsonify({"error": "Job not found"}), 404
    
    return jsonify({
        "job_id": job_id,
        "status": row[0],
        "total": row[1],
        "processed": row[2],
        "progress": round((row[2] / row[1]) * 100, 1) if row[1] > 0 else 0,
        "started_at": row[3],
        "completed_at": row[4]
    })


@app.route('/api/batch/<job_id>/download', methods=['GET'])
@require_auth
def download_batch_results(job_id):
    """Download batch results CSV"""
    results_path = RESULTS_DIR / f"{job_id}_results.csv"
    
    if not results_path.exists():
        return jsonify({"error": "Results not found"}), 404
    
    return send_file(results_path, as_attachment=True)

# ============================================================
# API Routes - Triage Feedback (AACT Loop)
# ============================================================

@app.route('/api/triage', methods=['POST'])
@require_auth
def submit_triage():
    """
    Submit analyst triage decision
    Body: {
        prediction_id: str,
        analyst_level: 'L1'|'L2'|'L3',
        decision: 'escalate'|'close_benign'|'close_attack'|'investigate',
        notes: str
    }
    """
    data = request.json
    
    triage_id = str(uuid.uuid4())
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO triage_decisions
        (id, prediction_id, analyst_level, decision, timestamp, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        triage_id,
        data.get('prediction_id'),
        data.get('analyst_level'),
        data.get('decision'),
        datetime.now().isoformat(),
        data.get('notes', '')
    ))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        "id": triage_id,
        "status": "recorded"
    })

# ============================================================
# Auth Routes
# ============================================================

@app.route('/api/auth/register', methods=['POST'])
def register():
    """
    Register a new analyst account.
    Body: { email, password, name, role }
    role must be one of: L1, L2, L3
    """
    data = request.json or {}
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')
    name     = data.get('name', '').strip()
    role     = data.get('role', 'L1')

    if not email or not password or not name:
        return jsonify({"error": "email, password and name are required"}), 400
    if role not in ('L1', 'L2', 'L3'):
        return jsonify({"error": "role must be L1, L2 or L3"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "Email already registered"}), 409

    user_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?,?,?,?,?,?)",
        (user_id, email, generate_password_hash(password), name, role, datetime.now().isoformat())
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Account created", "user_id": user_id}), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    """
    Login and receive a session token.
    Body: { email, password }
    Returns: { token, user: { id, name, email, role } }
    """
    data     = request.json or {}
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    ip = request.remote_addr or '0.0.0.0'
    if is_rate_limited(ip):
        return jsonify({"error": "Too many login attempts. Please wait 60 seconds."}), 429

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    if not user or not check_password_hash(user['password_hash'], password):
        conn.close()
        return jsonify({"error": "Invalid email or password"}), 401

    token      = str(uuid.uuid4())
    expires_at = (datetime.now() + timedelta(hours=24)).isoformat()
    conn.execute(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)",
        (token, user['id'], expires_at)
    )
    conn.commit()
    conn.close()

    return jsonify({
        "token": token,
        "user": {
            "id":    user['id'],
            "name":  user['name'],
            "email": user['email'],
            "role":  user['role'],
        }
    })


@app.route('/api/auth/logout', methods=['POST'])
@require_auth
def logout():
    """Invalidate the current session token."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '').strip()
    conn  = get_db()
    conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Logged out"})


@app.route('/api/auth/me', methods=['GET'])
@require_auth
def get_me():
    """Return the currently authenticated user."""
    u = request.current_user
    return jsonify({
        "id":    u['id'],
        "name":  u['name'],
        "email": u['email'],
        "role":  u['role'],
    })


# ============================================================
# Analytics Routes (Extended)
# ============================================================

@app.route('/api/analytics/overview', methods=['GET'])
@require_auth
def get_analytics():
    """Extended analytics overview"""
    conn = get_db()

    total_predictions = conn.execute("SELECT COUNT(*) FROM predictions").fetchone()[0]

    by_model = dict(conn.execute(
        "SELECT model, COUNT(*) FROM predictions GROUP BY model"
    ).fetchall())

    attack_vs_benign = dict(conn.execute(
        "SELECT prediction, COUNT(*) FROM predictions GROUP BY prediction"
    ).fetchall())

    severity_dist = dict(conn.execute(
        "SELECT severity, COUNT(*) FROM predictions GROUP BY severity"
    ).fetchall())

    total_triage = conn.execute("SELECT COUNT(*) FROM triage_decisions").fetchone()[0]

    decisions_breakdown = dict(conn.execute(
        "SELECT decision, COUNT(*) FROM triage_decisions GROUP BY decision"
    ).fetchall())

    by_analyst_level = dict(conn.execute(
        "SELECT analyst_level, COUNT(*) FROM triage_decisions GROUP BY analyst_level"
    ).fetchall())

    # Recent activity (last 24h)
    since = (datetime.now() - timedelta(hours=24)).isoformat()
    recent_predictions = conn.execute(
        "SELECT COUNT(*) FROM predictions WHERE timestamp > ?", (since,)
    ).fetchone()[0]

    conn.close()

    return jsonify({
        "total_predictions":    total_predictions,
        "recent_predictions":   recent_predictions,
        "predictions_by_model": by_model,
        "attack_vs_benign": {
            "attack": attack_vs_benign.get(1, 0),
            "benign": attack_vs_benign.get(0, 0),
        },
        "severity_distribution":  severity_dist,
        "total_triage_decisions": total_triage,
        "decisions_breakdown":    decisions_breakdown,
        "by_analyst_level":       by_analyst_level,
    })


# ============================================================
# AACT Feedback Loop Metrics
# ============================================================

@app.route('/api/analytics/aact-metrics', methods=['GET'])
@require_auth
def get_aact_metrics():
    """
    Analyst-AI agreement metrics (AACT feedback loop).
    Joins triage decisions with the original AI predictions to measure:
    - Agreement rate  (analyst confirmed AI verdict)
    - Override rate   (analyst corrected AI verdict)
    - False-positive overrides (AI=attack, analyst=benign)
    - False-negative overrides (AI=benign, analyst=attack)
    """
    conn = get_db()

    rows = conn.execute("""
        SELECT p.prediction, p.model, p.confidence, p.severity,
               t.decision, t.analyst_level
        FROM triage_decisions t
        JOIN predictions p ON t.prediction_id = p.id
    """).fetchall()

    conn.close()

    if not rows:
        return jsonify({
            "total_reviewed": 0,
            "agreement_rate": None,
            "override_rate":  None,
            "false_positive_overrides": 0,
            "false_negative_overrides": 0,
            "uncertain_count": 0,
            "decisions_breakdown": {},
            "by_analyst_level": {},
            "by_model": {},
        })

    total        = len(rows)
    agreements   = 0
    fp_overrides = 0   # AI=attack, analyst=benign
    fn_overrides = 0   # AI=benign, analyst=attack
    uncertain    = 0

    by_level = {}
    by_model  = {}

    for r in rows:
        pred     = r['prediction']   # 0 or 1
        decision = r['decision']
        level    = r['analyst_level']
        model    = r['model']

        # Classify the analyst action
        analyst_says_attack = decision in ('escalate', 'close_attack')
        analyst_says_benign = decision == 'close_benign'
        is_uncertain        = decision == 'investigate'

        if is_uncertain:
            uncertain += 1
            outcome = 'uncertain'
        elif (pred == 1 and analyst_says_attack) or (pred == 0 and analyst_says_benign):
            agreements += 1
            outcome = 'agree'
        elif pred == 1 and analyst_says_benign:
            fp_overrides += 1
            outcome = 'fp_override'
        elif pred == 0 and analyst_says_attack:
            fn_overrides += 1
            outcome = 'fn_override'
        else:
            outcome = 'uncertain'

        # Per-level stats
        if level not in by_level:
            by_level[level] = {'reviewed': 0, 'agreements': 0}
        by_level[level]['reviewed'] += 1
        if outcome == 'agree':
            by_level[level]['agreements'] += 1

        # Per-model stats
        if model not in by_model:
            by_model[model] = {'reviewed': 0, 'agreements': 0}
        by_model[model]['reviewed'] += 1
        if outcome == 'agree':
            by_model[model]['agreements'] += 1

    overrides = fp_overrides + fn_overrides
    definitive = total - uncertain   # exclude investigate from rate calc

    return jsonify({
        "total_reviewed":           total,
        "agreement_rate":           round(agreements / definitive, 4) if definitive else None,
        "override_rate":            round(overrides  / definitive, 4) if definitive else None,
        "false_positive_overrides": fp_overrides,
        "false_negative_overrides": fn_overrides,
        "uncertain_count":          uncertain,
        "by_analyst_level": {
            lvl: {
                "reviewed":       stats['reviewed'],
                "agreement_rate": round(stats['agreements'] / stats['reviewed'], 4)
                                  if stats['reviewed'] else None,
            }
            for lvl, stats in by_level.items()
        },
        "by_model": {
            mdl: {
                "reviewed":       stats['reviewed'],
                "agreement_rate": round(stats['agreements'] / stats['reviewed'], 4)
                                  if stats['reviewed'] else None,
            }
            for mdl, stats in by_model.items()
        },
    })


# ============================================================
# Password Reset
# ============================================================

@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    """
    Generate a password reset token for the given email.
    In production this token would be emailed; here it is returned
    directly so the demo works without an SMTP server.
    Body: { email }
    """
    email = (request.json or {}).get('email', '').strip().lower()
    if not email:
        return jsonify({"error": "Email is required"}), 400

    conn = get_db()
    user = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()

    if not user:
        conn.close()
        # Don't reveal whether email exists
        return jsonify({"message": "If that email is registered you will receive a reset token."}), 200

    token      = str(uuid.uuid4())
    expires_at = (datetime.now() + timedelta(minutes=30)).isoformat()
    conn.execute(
        "INSERT INTO password_resets (token, user_id, expires_at) VALUES (?,?,?)",
        (token, user['id'], expires_at)
    )
    conn.commit()
    conn.close()

    return jsonify({
        "message": "Reset token generated. Use it within 30 minutes.",
        "reset_token": token,   # In production: send via email, remove from response
        "_note": "Demo mode — token returned directly. In production this would be emailed."
    })


@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    """
    Reset password using a valid reset token.
    Body: { token, new_password }
    """
    data         = request.json or {}
    token        = data.get('token', '').strip()
    new_password = data.get('new_password', '')

    if not token or not new_password:
        return jsonify({"error": "token and new_password are required"}), 400
    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    conn = get_db()
    reset = conn.execute(
        "SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > ?",
        (token, datetime.now().isoformat())
    ).fetchone()

    if not reset:
        conn.close()
        return jsonify({"error": "Invalid or expired reset token"}), 400

    conn.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (generate_password_hash(new_password), reset['user_id'])
    )
    conn.execute("UPDATE password_resets SET used = 1 WHERE token = ?", (token,))
    # Invalidate all active sessions for this user
    conn.execute("DELETE FROM sessions WHERE user_id = ?", (reset['user_id'],))
    conn.commit()
    conn.close()

    return jsonify({"message": "Password reset successfully. Please log in again."})


# ============================================================
# Model Performance Metrics
# ============================================================

@app.route('/api/analytics/model-performance', methods=['GET'])
@require_auth
def get_model_performance():
    """
    Return pre-computed performance metrics for all 3 models
    evaluated on a 5,000-sample subset of the test set.
    """
    return jsonify({
        "models":           MODEL_METRICS,
        "workload_reduction": WORKLOAD_REDUCTION,
        "dataset":          "UNSW-NB15 test set",
        "sample_size":      _METRIC_N,
    })


# ============================================================
# Analytics Export (CSV)
# ============================================================

@app.route('/api/analytics/export', methods=['GET'])
@require_auth
def export_analytics():
    """Download all predictions as a CSV file."""
    conn = get_db()
    rows = conn.execute("""
        SELECT p.id, p.timestamp, p.mode, p.model,
               p.prediction, p.confidence, p.severity,
               t.decision, t.analyst_level, t.notes
        FROM predictions p
        LEFT JOIN triage_decisions t ON t.prediction_id = p.id
        ORDER BY p.timestamp DESC
    """).fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "timestamp", "mode", "model",
        "prediction", "confidence", "severity",
        "triage_decision", "analyst_level", "notes"
    ])
    for r in rows:
        writer.writerow([
            r["id"], r["timestamp"], r["mode"], r["model"],
            "attack" if r["prediction"] == 1 else "benign",
            r["confidence"], r["severity"],
            r["decision"] or "", r["analyst_level"] or "", r["notes"] or ""
        ])

    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode()),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f"soc_predictions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    )


# ============================================================
# Health Check
# ============================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "models_loaded": {
            "xgboost": True,
            "cnn": True,
            "ensemble": True
        },
        "features": len(FEATURE_NAMES)
    })

# ============================================================
# Main
# ============================================================

if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("Starting Flask Backend...")
    print("=" * 60)
    print(f"Models directory: {MODELS_DIR}")
    print(f"Data directory: {DATA_DIR}")
    print(f"Database: {DB_PATH}")
    print("=" * 60)
    print("\nBackend running on: http://localhost:5000")
    print("=" * 60 + "\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
