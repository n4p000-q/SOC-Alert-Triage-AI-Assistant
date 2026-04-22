"""
Shared fixtures for all SOC Triage test suites.

The Flask backend loads ML models at import time, so all heavy
dependencies are patched before the module is ever imported.
"""

import sys
import os
import json
import tempfile

import numpy as np
import pandas as pd
import pytest
from unittest.mock import MagicMock, patch

# Pre-import tensorflow so its internal json.load calls happen BEFORE we mock
# json.load globally. Without this, the TF import triggers during patch setup
# and crashes because it gets a list back instead of a config dict.
import tensorflow.keras.models  # noqa: E402

import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))

from helpers import (
    FEATURE_NAMES, N_FEAT, N_SAMPLES,
    mock_scaler, mock_xgb_model, mock_cnn_model, mock_shap_explainer,
    register_and_login,
)


def _mock_read_csv(path, **kw):
    p = str(path)
    if "shap_background" in p:
        return pd.DataFrame(np.zeros((100, N_FEAT)), columns=FEATURE_NAMES)
    if "X_test" in p:
        return pd.DataFrame(np.random.rand(N_SAMPLES + 1, N_FEAT), columns=FEATURE_NAMES)
    if "y_test" in p:
        return pd.DataFrame({"label": np.random.randint(0, 2, N_SAMPLES + 1)})
    return pd.DataFrame(np.zeros((5, N_FEAT)), columns=FEATURE_NAMES)


# ──────────────────────────────────────────────────────────────────────
# Session fixture: patch everything, import backend once, expose app
# ──────────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def flask_app():
    """
    Apply all ML patches, then import and configure the Flask app.
    Uses a temporary SQLite database so tests never touch the real one.
    """
    tmp_db = os.path.join(tempfile.mkdtemp(), "test_soc.db")

    ml_patches = [
        patch("json.load",         return_value=FEATURE_NAMES),
        patch("joblib.load",       return_value=mock_scaler),
        patch("xgboost.Booster",   return_value=mock_xgb_model),
        patch("xgboost.DMatrix",   MagicMock(return_value=MagicMock())),
        patch("tensorflow.keras.models.load_model", return_value=mock_cnn_model),
        patch("pandas.read_csv",   side_effect=_mock_read_csv),
        patch("shap.TreeExplainer",return_value=mock_shap_explainer),
    ]

    for p in ml_patches:
        p.start()

    sys.modules.pop("backend.flask_backend", None)
    sys.modules.pop("backend",               None)

    import backend.flask_backend as fb

    fb.DB_PATH = tmp_db
    fb.init_database()
    fb.app.config["TESTING"] = True

    yield fb.app

    for p in ml_patches:
        p.stop()


@pytest.fixture(scope="session")
def client(flask_app):
    return flask_app.test_client()


@pytest.fixture(scope="session")
def auth_headers(client):
    token, _ = register_and_login(client)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def fb_module(flask_app):
    """Expose the backend module so tests can access globals (e.g. rate limiter)."""
    import backend.flask_backend as fb
    return fb


@pytest.fixture(scope="session")
def l2_auth_headers(client):
    token, _ = register_and_login(
        client, email="l2analyst@soc.com", password="secret123",
        name="L2 Analyst", role="L2"
    )
    return {"Authorization": f"Bearer {token}"}
