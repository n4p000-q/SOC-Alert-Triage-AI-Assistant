#!/usr/bin/env python3
"""
Seed Database Script
====================
Populates soc_triage.db with realistic sample data for development/demo:
  - 3 analyst users (L1, L2, L3)
  - 60 predictions (mixed models, severities, attack/benign)
  - 35 triage decisions (exercises the AACT feedback loop metrics)
  - 2 completed batch jobs

Run from the project root:
    source soc_env/bin/activate
    python seed_database.py
"""

import sqlite3
import uuid
import random
from datetime import datetime, timedelta
from pathlib import Path
from werkzeug.security import generate_password_hash

# ─── Paths ───────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
DB_PATH  = BASE_DIR / "backend" / "soc_triage.db"

# ─── Helpers ─────────────────────────────────────────────────────────────────
def ts(days_ago=0, hours_ago=0, minutes_ago=0):
    """Return an ISO timestamp offset from now."""
    delta = timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)
    return (datetime.now() - delta).isoformat()

def rand_conf(pred):
    """Return a realistic confidence score given a prediction label."""
    if pred == 1:
        return round(random.uniform(0.55, 0.99), 4)
    return round(random.uniform(0.55, 0.98), 4)

def severity(pred, conf):
    if pred == 0:
        return "benign"
    if conf >= 0.90:
        return "critical"
    if conf >= 0.70:
        return "high"
    if conf >= 0.50:
        return "medium"
    return "low"

SAMPLE_FEATURES = {
    "dur": 0.121, "spkts": 6, "dpkts": 4, "sbytes": 512, "dbytes": 256,
    "rate": 49.6, "sttl": 64, "dttl": 128, "sload": 33728.0, "dload": 16864.0,
    "sloss": 0, "dloss": 0, "sinpkt": 20.2, "dinpkt": 30.1,
    "sjit": 1.2, "djit": 0.8, "swin": 255, "stcpb": 0, "dtcpb": 0,
    "dwin": 255, "tcprtt": 0.045, "synack": 0.021, "ackdat": 0.024,
    "smean": 85, "dmean": 64, "trans_depth": 1, "response_body_len": 0,
    "ct_srv_src": 2, "ct_state_ttl": 3, "ct_dst_ltm": 1,
    "ct_src_dport_ltm": 1, "ct_dst_sport_ltm": 1, "ct_dst_src_ltm": 2,
    "is_ftp_login": 0, "ct_ftp_cmd": 0, "ct_flw_http_mthd": 1,
    "ct_src_ltm": 2, "ct_srv_dst": 1, "is_sm_ips_ports": 0,
    "proto_tcp": 1, "service_http": 1, "state_FIN": 1,
}

SHAP_SAMPLE = [0.12, -0.08, 0.35, 0.04, -0.02]

TOP_FEATURES_ATTACK = [
    {"feature": "ct_state_ttl",  "shap_value":  0.342, "impact": "attack"},
    {"feature": "sbytes",        "shap_value":  0.287, "impact": "attack"},
    {"feature": "rate",          "shap_value":  0.198, "impact": "attack"},
    {"feature": "proto_tcp",     "shap_value":  0.145, "impact": "attack"},
    {"feature": "dttl",          "shap_value": -0.112, "impact": "benign"},
]

TOP_FEATURES_BENIGN = [
    {"feature": "sttl",          "shap_value": -0.289, "impact": "benign"},
    {"feature": "ct_srv_src",    "shap_value": -0.201, "impact": "benign"},
    {"feature": "dur",           "shap_value": -0.175, "impact": "benign"},
    {"feature": "dmean",         "shap_value": -0.134, "impact": "benign"},
    {"feature": "sbytes",        "shap_value":  0.098, "impact": "attack"},
]

import json

# ─── Connect ─────────────────────────────────────────────────────────────────
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur  = conn.cursor()

print("=" * 55)
print("  SOC Triage DB Seeder")
print("=" * 55)

# ─── 1. Users ─────────────────────────────────────────────────────────────────
print("\n[1/4] Seeding users...")

USERS = [
    {
        "id":    str(uuid.uuid4()),
        "email": "l1.analyst@soc.org",
        "name":  "Thabo Nkosi",
        "role":  "L1",
        "password": "password123",
    },
    {
        "id":    str(uuid.uuid4()),
        "email": "l2.analyst@soc.org",
        "name":  "Lerato Dlamini",
        "role":  "L2",
        "password": "password123",
    },
    {
        "id":    str(uuid.uuid4()),
        "email": "l3.analyst@soc.org",
        "name":  "Napo Mokoena",
        "role":  "L3",
        "password": "password123",
    },
]

for u in USERS:
    existing = cur.execute("SELECT id FROM users WHERE email = ?", (u["email"],)).fetchone()
    if existing:
        print(f"   ⚠  {u['email']} already exists — skipping")
        continue
    cur.execute(
        "INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?,?,?,?,?,?)",
        (u["id"], u["email"], generate_password_hash(u["password"]), u["name"], u["role"], ts(days_ago=7))
    )
    print(f"   ✓  {u['role']} — {u['name']} <{u['email']}>  pw: {u['password']}")

conn.commit()

# ─── 2. Predictions ───────────────────────────────────────────────────────────
print("\n[2/4] Seeding predictions (60 records)...")

MODELS = ["xgboost", "cnn", "ensemble"]
MODES  = ["live", "single", "batch"]

prediction_ids = []

# Spread predictions over the last 7 days
for i in range(60):
    pred_id  = str(uuid.uuid4())
    model    = random.choice(MODELS)
    mode     = random.choice(MODES)
    pred     = random.choices([0, 1], weights=[40, 60])[0]   # 60 % attack
    conf     = rand_conf(pred)
    sev      = severity(pred, conf)
    top_f    = TOP_FEATURES_ATTACK if pred == 1 else TOP_FEATURES_BENIGN
    hours_ago = random.randint(0, 7 * 24)

    cur.execute(
        """INSERT INTO predictions
           (id, timestamp, mode, model, prediction, confidence, severity, features, shap_values)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (
            pred_id,
            ts(hours_ago=hours_ago),
            mode, model, pred, conf, sev,
            json.dumps(SAMPLE_FEATURES),
            json.dumps(SHAP_SAMPLE),
        )
    )
    prediction_ids.append({"id": pred_id, "prediction": pred, "model": model})

conn.commit()
print(f"   ✓  60 predictions inserted")

# ─── 3. Triage decisions ──────────────────────────────────────────────────────
print("\n[3/4] Seeding triage decisions (35 records)...")

# Reload users from DB to get their IDs as stored
db_users = cur.execute("SELECT id, role FROM users").fetchall()
user_by_role = {row["role"]: row["id"] for row in db_users}

# Decision map — weights simulate realistic analyst behaviour
# Analysts mostly agree with AI but sometimes override
DECISION_SCENARIOS = [
    # (ai_prediction, decision, weight)
    # --- AI says attack ---
    (1, "escalate",     30),   # agree — escalate
    (1, "close_attack", 20),   # agree — close as attack
    (1, "investigate",  15),   # uncertain
    (1, "close_benign", 10),   # override — analyst says benign (FP)
    # --- AI says benign ---
    (0, "close_benign", 35),   # agree — close as benign
    (0, "investigate",  10),   # uncertain
    (0, "escalate",      5),   # override — analyst says attack (FN)
    (0, "close_attack",  3),   # override — analyst says attack (FN)
]

# Pick 35 predictions to triage
triaged = random.sample(prediction_ids, min(35, len(prediction_ids)))

for i, p in enumerate(triaged):
    ai_pred  = p["prediction"]
    # Filter scenarios to matching AI prediction
    matching = [(d, w) for (ap, d, w) in DECISION_SCENARIOS if ap == ai_pred]
    decisions, weights = zip(*matching)
    decision = random.choices(decisions, weights=weights)[0]

    # Rotate analyst levels across decisions
    level = ["L1", "L2", "L3"][i % 3]
    notes_options = [
        "Confirmed by packet inspection.",
        "Correlated with threat intel feed.",
        "Low-risk host — closing.",
        "Requires further investigation.",
        "",
        "Escalated to senior analyst.",
        "False positive — internal scanner traffic.",
        "Behaviour matches known C2 pattern.",
    ]

    cur.execute(
        """INSERT INTO triage_decisions
           (id, prediction_id, analyst_level, decision, timestamp, notes)
           VALUES (?,?,?,?,?,?)""",
        (
            str(uuid.uuid4()),
            p["id"],
            level,
            decision,
            ts(hours_ago=random.randint(0, 5 * 24)),
            random.choice(notes_options),
        )
    )

conn.commit()
print(f"   ✓  35 triage decisions inserted")

# ─── 4. Batch jobs ────────────────────────────────────────────────────────────
print("\n[4/4] Seeding batch jobs (2 records)...")

BATCH_JOBS = [
    {
        "id":           str(uuid.uuid4()),
        "filename":     "network_export_2026-03-28.csv",
        "status":       "completed",
        "total_alerts": 500,
        "processed":    500,
        "started_at":   ts(days_ago=3, hours_ago=2),
        "completed_at": ts(days_ago=3, hours_ago=1),
        "results_path": "/backend/results/batch_completed_1.csv",
    },
    {
        "id":           str(uuid.uuid4()),
        "filename":     "ids_alerts_2026-04-01.csv",
        "status":       "completed",
        "total_alerts": 120,
        "processed":    120,
        "started_at":   ts(days_ago=1, hours_ago=3),
        "completed_at": ts(days_ago=1, hours_ago=2, minutes_ago=45),
        "results_path": "/backend/results/batch_completed_2.csv",
    },
]

for job in BATCH_JOBS:
    cur.execute(
        """INSERT INTO batch_jobs
           (id, filename, status, total_alerts, processed, started_at, completed_at, results_path)
           VALUES (?,?,?,?,?,?,?,?)""",
        (
            job["id"], job["filename"], job["status"],
            job["total_alerts"], job["processed"],
            job["started_at"], job["completed_at"], job["results_path"],
        )
    )
    print(f"   ✓  {job['filename']} ({job['total_alerts']} alerts)")

conn.commit()
conn.close()

# ─── Summary ─────────────────────────────────────────────────────────────────
print("\n" + "=" * 55)
print("  Seed complete!")
print("=" * 55)
print(f"\n  DB path: {DB_PATH}")
print("\n  Login credentials:")
print("  ┌──────────────────────────────┬──────┬─────────────┐")
print("  │ Email                        │ Role │ Password    │")
print("  ├──────────────────────────────┼──────┼─────────────┤")
for u in USERS:
    print(f"  │ {u['email']:<28} │  {u['role']}  │ {u['password']:<11} │")
print("  └──────────────────────────────┴──────┴─────────────┘")
print("\n  Open DB Browser for SQLite and point it at:")
print(f"  {DB_PATH}\n")
