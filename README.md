# SOC Alert Triage AI Assistant

An AI-powered Security Operations Centre (SOC) triage system built as a Final Year Project at the **National University of Lesotho**.

The system classifies network traffic alerts as **attack or benign** using three ML models trained on the UNSW-NB15 dataset, provides SHAP-based explainability, and implements an **Analyst-AI Collaborative Triage (AACT)** feedback loop that tracks analyst agreement and override rates.

---

## Features

- **3 Classification Modes** — Live Simulation, Single Alert, Batch CSV upload
- **3 ML Models** — XGBoost, CNN, Ensemble (60/40 weighted)
- **SHAP Explainability** — Top feature contributions shown for every prediction
- **AACT Feedback Loop** — Tracks analyst decisions vs AI predictions (agreement rate, override rate, FP/FN overrides)
- **Role-Based Access** — L1 / L2 / L3 analyst accounts with tiered triage permissions
- **Analytics Dashboard** — Recharts visualisations of predictions, severity, model usage, and AACT metrics
- **Session Auth** — Token-based login with 24-hour sessions

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Tailwind CSS v3, Recharts, Axios |
| Backend | Flask, Flask-CORS, Werkzeug |
| ML | XGBoost, TensorFlow/Keras, SHAP, scikit-learn |
| Database | SQLite |
| Dataset | UNSW-NB15 |

---

## Project Structure

```
SOC-Alert-Triage-AI-Assistant/
├── backend/
│   └── flask_backend.py       # Flask API (all endpoints)
├── frontend/
│   └── src/
│       ├── components/        # React components
│       ├── context/           # Auth + Toast context
│       └── utils/api.js       # Axios API client
├── models/                    # Trained ML models + artifacts
├── notebooks/                 # Jupyter notebooks (EDA, training, SHAP)
├── seed_database.py           # Populates DB with sample data
├── requirements.txt           # Python dependencies
└── docker-compose.yml         # Run everything with one command
```

---

## Quick Start

### Option A — Manual (two terminals)

**Prerequisites:** Python 3.12, Node 18+

```bash
# 1. Clone
git clone https://github.com/n4p000-q/SOC-Alert-Triage-AI-Assistant.git
cd SOC-Alert-Triage-AI-Assistant

# 2. Backend
python -m venv soc_env
source soc_env/bin/activate          # Windows: soc_env\Scripts\activate
pip install -r requirements.txt
cd backend && python flask_backend.py

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm start
```

### Option B — Docker (one command)

**Prerequisites:** Docker + Docker Compose

```bash
git clone https://github.com/n4p000-q/SOC-Alert-Triage-AI-Assistant.git
cd SOC-Alert-Triage-AI-Assistant
docker-compose up
```

Both options start:
- Backend: http://localhost:5000
- Frontend: http://localhost:3000

---

## Seed Data

Populate the database with sample users, predictions, and triage decisions:

```bash
source soc_env/bin/activate
python seed_database.py
```

| Email | Role | Password |
|---|---|---|
| l1.analyst@soc.org | L1 | password123 |
| l2.analyst@soc.org | L2 | password123 |
| l3.analyst@soc.org | L3 | password123 |

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Create analyst account | Public |
| POST | `/api/auth/login` | Login, returns session token | Public |
| POST | `/api/auth/logout` | Invalidate session | Required |
| GET | `/api/auth/me` | Current user info | Required |
| GET | `/api/simulation/load-alerts` | Load balanced alerts for live mode | Required |
| POST | `/api/predict/single` | Classify a single alert | Required |
| POST | `/api/predict/batch` | Upload CSV for batch processing | Required |
| GET | `/api/batch/<id>/status` | Poll batch job progress | Required |
| GET | `/api/batch/<id>/download` | Download batch results CSV | Required |
| POST | `/api/triage` | Submit analyst triage decision | Required |
| GET | `/api/analytics/overview` | System-wide prediction statistics | Required |
| GET | `/api/analytics/aact-metrics` | AACT feedback loop metrics | Required |
| GET | `/api/health` | Health check | Public |

---

## Analyst Role Permissions

| Role | Escalate | Investigate | Close (Attack) | Close (Benign) |
|---|---|---|---|---|
| L1 | ✅ | ✅ | ❌ | ❌ |
| L2 | ✅ | ✅ | ✅ | ✅ |
| L3 | ✅ | ✅ | ✅ | ✅ |

---

## Dataset

This project uses the **UNSW-NB15** dataset. Due to its size (~21 GB), it is not included in the repository.

Download from: https://research.unsw.edu.au/projects/unsw-nb15-dataset

Place the processed files in `data/processed/`:
- `X_train.csv`, `X_test.csv`, `y_train.csv`, `y_test.csv`

---

## Author

**Napo Mokoena** — National University of Lesotho, 2025

---

## CI Status

![CI](https://github.com/n4p000-q/SOC-Alert-Triage-AI-Assistant/actions/workflows/ci.yml/badge.svg)
