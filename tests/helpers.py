"""Shared constants and helpers for the test suite."""

import numpy as np
from unittest.mock import MagicMock

FEATURE_NAMES = [f"feature_{i}" for i in range(194)]
N_FEAT = len(FEATURE_NAMES)
N_SAMPLES = 5000  # matches _METRIC_N in flask_backend.py

# ── Mock ML objects (built once, reused by conftest + tests) ──────────
mock_scaler = MagicMock(name="scaler")
mock_scaler.transform.side_effect = lambda X: np.zeros((len(X), N_FEAT))

mock_xgb_model = MagicMock(name="xgb_model")
mock_xgb_model.predict.return_value = np.full(N_SAMPLES, 0.8)

mock_cnn_model = MagicMock(name="cnn_model")
mock_cnn_model.predict.side_effect = (
    lambda x, verbose=0: np.full((len(x), 1), 0.75)
)

mock_shap_explainer = MagicMock(name="shap_explainer")
mock_shap_explainer.shap_values.return_value = np.random.randn(1, N_FEAT)


def register_and_login(client, email="test@soc.com", password="secret123",
                       name="Test Analyst", role="L1"):
    """Register a user (if needed) and return (token, user_id)."""
    client.post("/api/auth/register", json={
        "email": email, "password": password, "name": name, "role": role,
    })
    resp = client.post("/api/auth/login",
                       json={"email": email, "password": password})
    data = resp.get_json()
    return data["token"], data["user"]["id"]
