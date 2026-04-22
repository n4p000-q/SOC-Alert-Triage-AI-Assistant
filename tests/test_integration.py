"""
Integration Tests — SOC Alert Triage AI Assistant
==================================================

Tests that individual components communicate correctly end-to-end:
  - Auth flow (register → login → protected endpoints → logout)
  - Single-alert prediction pipeline (input → preprocess → predict → DB)
  - Triage decision submission and persistence
  - Batch job lifecycle (create → status → analytics)
  - Feature ordering / scaling consistency
"""

import json
import io
import numpy as np
import pandas as pd
import pytest

from helpers import FEATURE_NAMES, N_FEAT, register_and_login


# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────
def _sample_features():
    return {name: float(np.random.rand()) for name in FEATURE_NAMES}


# ──────────────────────────────────────────────────────────────────────
# Auth pipeline
# ──────────────────────────────────────────────────────────────────────
class TestAuthFlow:
    def test_register_returns_201(self, client):
        resp = client.post("/api/auth/register", json={
            "email": "integ_reg@soc.com",
            "password": "pass1234",
            "name": "Integration User",
            "role": "L1",
        })
        assert resp.status_code == 201

    def test_duplicate_registration_returns_409(self, client):
        data = {"email": "dup@soc.com", "password": "password123", "name": "A", "role": "L1"}
        client.post("/api/auth/register", json=data)
        resp = client.post("/api/auth/register", json=data)
        assert resp.status_code == 409

    def test_login_returns_token(self, client):
        email, password = "login_integ@soc.com", "mypassword"
        client.post("/api/auth/register", json={
            "email": email, "password": password, "name": "User", "role": "L1"
        })
        resp = client.post("/api/auth/login", json={"email": email, "password": password})
        assert resp.status_code == 200
        body = resp.get_json()
        assert "token" in body
        assert len(body["token"]) > 0

    def test_wrong_password_returns_401(self, client):
        resp = client.post("/api/auth/login",
                           json={"email": "test@soc.com", "password": "wrongpass"})
        assert resp.status_code == 401

    def test_protected_endpoint_without_token_returns_401(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_protected_endpoint_with_valid_token(self, client, auth_headers):
        resp = client.get("/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.get_json()
        assert "email" in body
        assert "role" in body

    def test_logout_invalidates_token(self, client):
        token, _ = register_and_login(
            client, email="logout_test@soc.com", password="pass123",
            name="Logout User", role="L1"
        )
        headers = {"Authorization": f"Bearer {token}"}
        client.post("/api/auth/logout", headers=headers)
        resp = client.get("/api/auth/me", headers=headers)
        assert resp.status_code == 401

    def test_register_missing_fields_returns_400(self, client):
        resp = client.post("/api/auth/register", json={"email": "x@x.com"})
        assert resp.status_code == 400

    def test_register_invalid_role_returns_400(self, client):
        resp = client.post("/api/auth/register", json={
            "email": "badrole@soc.com", "password": "pass123",
            "name": "Bad Role", "role": "ADMIN"
        })
        assert resp.status_code == 400

    def test_short_password_returns_400(self, client):
        resp = client.post("/api/auth/register", json={
            "email": "short@soc.com", "password": "abc",
            "name": "Short", "role": "L1"
        })
        assert resp.status_code == 400


# ──────────────────────────────────────────────────────────────────────
# Single-alert prediction pipeline
# ──────────────────────────────────────────────────────────────────────
class TestSinglePredictionPipeline:
    def test_predict_single_returns_200(self, client, auth_headers):
        resp = client.post("/api/predict/single",
                           json={"features": _sample_features(), "model": "ensemble"},
                           headers=auth_headers)
        assert resp.status_code == 200

    def test_response_has_required_keys(self, client, auth_headers):
        resp = client.post("/api/predict/single",
                           json={"features": _sample_features(), "model": "xgboost"},
                           headers=auth_headers)
        body = resp.get_json()
        assert {"id", "prediction", "confidence", "severity",
                "top_features", "model_comparison"}.issubset(body.keys())

    def test_prediction_value_is_binary(self, client, auth_headers):
        resp = client.post("/api/predict/single",
                           json={"features": _sample_features(), "model": "ensemble"},
                           headers=auth_headers)
        assert resp.get_json()["prediction"] in (0, 1)

    def test_confidence_in_unit_interval(self, client, auth_headers):
        resp = client.post("/api/predict/single",
                           json={"features": _sample_features(), "model": "ensemble"},
                           headers=auth_headers)
        conf = resp.get_json()["confidence"]
        assert 0.0 <= conf <= 1.0

    def test_severity_is_valid_level(self, client, auth_headers):
        resp = client.post("/api/predict/single",
                           json={"features": _sample_features(), "model": "ensemble"},
                           headers=auth_headers)
        assert resp.get_json()["severity"] in ("benign", "low", "medium", "high", "critical")

    def test_model_comparison_includes_all_three_models(self, client, auth_headers):
        resp = client.post("/api/predict/single",
                           json={"features": _sample_features(), "model": "ensemble"},
                           headers=auth_headers)
        comparison = resp.get_json()["model_comparison"]
        assert {"xgboost", "cnn", "ensemble"}.issubset(comparison.keys())

    def test_top_features_returned(self, client, auth_headers):
        resp = client.post("/api/predict/single",
                           json={"features": _sample_features(), "model": "xgboost"},
                           headers=auth_headers)
        top = resp.get_json()["top_features"]
        assert isinstance(top, list)
        assert len(top) > 0

    def test_prediction_saved_to_database(self, client, auth_headers):
        client.post("/api/predict/single",
                    json={"features": _sample_features(), "model": "ensemble"},
                    headers=auth_headers)
        # Verify it shows up in analytics
        resp = client.get("/api/analytics/overview", headers=auth_headers)
        assert resp.get_json()["total_predictions"] >= 1

    def test_missing_features_returns_400(self, client, auth_headers):
        resp = client.post("/api/predict/single",
                           json={"model": "ensemble"},
                           headers=auth_headers)
        assert resp.status_code == 400

    def test_unauthenticated_predict_returns_401(self, client):
        resp = client.post("/api/predict/single",
                           json={"features": _sample_features(), "model": "ensemble"})
        assert resp.status_code == 401

    def test_all_three_models_accepted(self, client, auth_headers):
        for model in ("xgboost", "cnn", "ensemble"):
            resp = client.post("/api/predict/single",
                               json={"features": _sample_features(), "model": model},
                               headers=auth_headers)
            assert resp.status_code == 200, f"Model {model} failed"

    def test_feature_scaling_applied_consistently(self, client, auth_headers):
        """
        The same feature input should always produce the same prediction
        (deterministic mock confirms scaling is applied consistently).
        """
        features = _sample_features()
        r1 = client.post("/api/predict/single",
                         json={"features": features, "model": "xgboost"},
                         headers=auth_headers)
        r2 = client.post("/api/predict/single",
                         json={"features": features, "model": "xgboost"},
                         headers=auth_headers)
        assert r1.get_json()["prediction"] == r2.get_json()["prediction"]
        assert r1.get_json()["confidence"] == r2.get_json()["confidence"]


# ──────────────────────────────────────────────────────────────────────
# Triage decision pipeline
# ──────────────────────────────────────────────────────────────────────
class TestTriagePipeline:
    def _make_prediction(self, client, auth_headers):
        resp = client.post("/api/predict/single",
                           json={"features": _sample_features(), "model": "ensemble"},
                           headers=auth_headers)
        return resp.get_json()["id"]

    def test_submit_triage_returns_200(self, client, auth_headers):
        pred_id = self._make_prediction(client, auth_headers)
        resp = client.post("/api/triage", json={
            "prediction_id": pred_id,
            "analyst_level": "L1",
            "decision": "close_benign",
            "notes": "Looks benign",
        }, headers=auth_headers)
        assert resp.status_code == 200

    def test_triage_response_has_id_and_status(self, client, auth_headers):
        pred_id = self._make_prediction(client, auth_headers)
        resp = client.post("/api/triage", json={
            "prediction_id": pred_id,
            "analyst_level": "L1",
            "decision": "close_attack",
        }, headers=auth_headers)
        body = resp.get_json()
        assert "id" in body
        assert body["status"] == "recorded"

    def test_triage_decision_reflected_in_analytics(self, client, auth_headers):
        pred_id = self._make_prediction(client, auth_headers)
        client.post("/api/triage", json={
            "prediction_id": pred_id,
            "analyst_level": "L1",
            "decision": "escalate",
        }, headers=auth_headers)
        resp = client.get("/api/analytics/overview", headers=auth_headers)
        assert resp.get_json()["total_triage_decisions"] >= 1


# ──────────────────────────────────────────────────────────────────────
# Batch processing pipeline
# ──────────────────────────────────────────────────────────────────────
class TestBatchPipeline:
    def _make_csv_bytes(self, n=5):
        df = pd.DataFrame(np.zeros((n, N_FEAT)), columns=FEATURE_NAMES)
        return df.to_csv(index=False).encode()

    def test_batch_upload_returns_job_id(self, client, auth_headers):
        data = {"model": "ensemble",
                "file": (io.BytesIO(self._make_csv_bytes()), "alerts.csv")}
        resp = client.post("/api/predict/batch",
                           content_type="multipart/form-data",
                           data=data,
                           headers=auth_headers)
        assert resp.status_code == 200
        body = resp.get_json()
        assert "job_id" in body
        assert body["total_alerts"] == 5

    def test_batch_status_endpoint_exists(self, client, auth_headers):
        data = {"model": "ensemble",
                "file": (io.BytesIO(self._make_csv_bytes()), "status_test.csv")}
        resp = client.post("/api/predict/batch",
                           content_type="multipart/form-data",
                           data=data,
                           headers=auth_headers)
        job_id = resp.get_json()["job_id"]

        status_resp = client.get(f"/api/batch/{job_id}/status", headers=auth_headers)
        assert status_resp.status_code == 200
        body = status_resp.get_json()
        assert "status" in body
        assert "total" in body

    def test_batch_unknown_job_returns_404(self, client, auth_headers):
        resp = client.get("/api/batch/nonexistent-id/status", headers=auth_headers)
        assert resp.status_code == 404

    def test_batch_no_file_returns_400(self, client, auth_headers):
        resp = client.post("/api/predict/batch",
                           content_type="multipart/form-data",
                           data={"model": "ensemble"},
                           headers=auth_headers)
        assert resp.status_code == 400
