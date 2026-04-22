"""
System Tests — SOC Alert Triage AI Assistant
=============================================

Tests the complete system against functional and non-functional
requirements, including:
  - All core features operating end-to-end
  - Dashboard / analytics data correctness
  - Alert workflow (claim → escalate → escalation queue)
  - Password reset flow
  - Edge cases: incomplete inputs, unexpected values
  - Non-functional: response time for single-alert classification
  - Health check
"""

import time
import numpy as np
import pytest

from helpers import FEATURE_NAMES, N_FEAT, register_and_login


def _sample_features(value=0.5):
    return {name: float(value) for name in FEATURE_NAMES}


# ──────────────────────────────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────────────────────────────
class TestHealthCheck:
    def test_health_endpoint_returns_200(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200

    def test_health_reports_all_models_loaded(self, client):
        body = resp = client.get("/api/health").get_json()
        assert body["status"] == "healthy"
        ml = body["models_loaded"]
        assert ml["xgboost"] is True
        assert ml["cnn"] is True
        assert ml["ensemble"] is True

    def test_health_reports_correct_feature_count(self, client):
        body = client.get("/api/health").get_json()
        assert body["features"] == N_FEAT


# ──────────────────────────────────────────────────────────────────────
# Core functional requirements
# ──────────────────────────────────────────────────────────────────────
class TestCoreFeatures:
    def test_classify_alert_and_get_confidence(self, client, auth_headers):
        resp = client.post("/api/predict/single",
                           json={"features": _sample_features(), "model": "ensemble"},
                           headers=auth_headers)
        body = resp.get_json()
        assert resp.status_code == 200
        assert body["confidence"] is not None

    def test_explainability_output_is_produced(self, client, auth_headers):
        resp = client.post("/api/predict/single",
                           json={"features": _sample_features(), "model": "xgboost"},
                           headers=auth_headers)
        top = resp.get_json()["top_features"]
        assert len(top) > 0
        for entry in top:
            assert "feature" in entry
            assert "shap_value" in entry
            assert "impact" in entry

    def test_dashboard_analytics_returns_data(self, client, auth_headers):
        # Make at least one prediction first
        client.post("/api/predict/single",
                    json={"features": _sample_features(), "model": "ensemble"},
                    headers=auth_headers)
        resp = client.get("/api/analytics/overview", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["total_predictions"] >= 1

    def test_model_performance_endpoint_returns_metrics(self, client, auth_headers):
        resp = client.get("/api/analytics/model-performance", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.get_json()
        for model in ("xgboost", "cnn", "ensemble"):
            assert model in body["models"]
            metrics = body["models"][model]
            assert "accuracy" in metrics
            assert "f1" in metrics
            assert "auc" in metrics

    def test_severity_levels_are_consistent(self, client, auth_headers):
        valid_levels = {"benign", "low", "medium", "high", "critical"}
        for _ in range(3):
            resp = client.post("/api/predict/single",
                               json={"features": _sample_features(), "model": "ensemble"},
                               headers=auth_headers)
            assert resp.get_json()["severity"] in valid_levels

    def test_analytics_export_returns_csv(self, client, auth_headers):
        resp = client.get("/api/analytics/export", headers=auth_headers)
        assert resp.status_code == 200
        assert "text/csv" in resp.content_type


# ──────────────────────────────────────────────────────────────────────
# Alert workflow (claim / escalate / escalation queue)
# ──────────────────────────────────────────────────────────────────────
class TestAlertWorkflow:
    def _create_prediction(self, client, auth_headers):
        resp = client.post("/api/predict/single",
                           json={"features": _sample_features(), "model": "ensemble"},
                           headers=auth_headers)
        return resp.get_json()["id"]

    def test_claim_alert_returns_in_progress(self, client, auth_headers):
        alert_id = self._create_prediction(client, auth_headers)
        resp = client.post(f"/api/alerts/{alert_id}/claim", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "in_progress"

    def test_claim_unknown_alert_returns_404(self, client, auth_headers):
        resp = client.post("/api/alerts/does-not-exist/claim", headers=auth_headers)
        assert resp.status_code == 404

    def test_escalate_to_l2(self, client, auth_headers):
        alert_id = self._create_prediction(client, auth_headers)
        resp = client.post(f"/api/alerts/{alert_id}/escalate",
                           json={"target_tier": "L2", "notes": "Needs L2 review"},
                           headers=auth_headers)
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["status"] == "escalated"
        assert body["escalated_to"] == "L2"

    def test_escalate_invalid_tier_returns_400(self, client, auth_headers):
        alert_id = self._create_prediction(client, auth_headers)
        resp = client.post(f"/api/alerts/{alert_id}/escalate",
                           json={"target_tier": "L4"},
                           headers=auth_headers)
        assert resp.status_code == 400

    def test_escalation_queue_accessible_to_l2(self, client, l2_auth_headers):
        resp = client.get("/api/alerts/escalated", headers=l2_auth_headers)
        assert resp.status_code == 200
        body = resp.get_json()
        assert "alerts" in body

    def test_l1_cannot_access_escalation_queue(self, client, auth_headers):
        resp = client.get("/api/alerts/escalated", headers=auth_headers)
        assert resp.status_code == 403


# ──────────────────────────────────────────────────────────────────────
# AACT feedback loop metrics
# ──────────────────────────────────────────────────────────────────────
class TestAACTMetrics:
    def test_aact_metrics_endpoint_returns_200(self, client, auth_headers):
        resp = client.get("/api/analytics/aact-metrics", headers=auth_headers)
        assert resp.status_code == 200

    def test_aact_metrics_keys_present(self, client, auth_headers):
        resp = client.get("/api/analytics/aact-metrics", headers=auth_headers)
        body = resp.get_json()
        assert "total_reviewed" in body
        assert "false_positive_overrides" in body
        assert "false_negative_overrides" in body


# ──────────────────────────────────────────────────────────────────────
# Password reset flow
# ──────────────────────────────────────────────────────────────────────
class TestPasswordReset:
    def test_forgot_password_always_returns_200(self, client):
        resp = client.post("/api/auth/forgot-password",
                           json={"email": "nobody@nowhere.com"})
        assert resp.status_code == 200

    def test_forgot_password_returns_token_for_registered_user(self, client):
        email = "resetme@soc.com"
        client.post("/api/auth/register", json={
            "email": email, "password": "resetpass", "name": "Reset", "role": "L1"
        })
        resp = client.post("/api/auth/forgot-password", json={"email": email})
        body = resp.get_json()
        assert "reset_token" in body

    def test_reset_password_with_valid_token(self, client, fb_module):
        email, old_pw, new_pw = "changeme@soc.com", "oldpass1", "newpass1"
        client.post("/api/auth/register", json={
            "email": email, "password": old_pw, "name": "Change", "role": "L1"
        })
        token_resp = client.post("/api/auth/forgot-password", json={"email": email})
        token = token_resp.get_json()["reset_token"]

        reset_resp = client.post("/api/auth/reset-password",
                                 json={"token": token, "new_password": new_pw})
        assert reset_resp.status_code == 200

        # Clear rate limiter state accumulated across the test session before login
        fb_module._login_attempts.clear()

        login_resp = client.post("/api/auth/login",
                                 json={"email": email, "password": new_pw})
        assert login_resp.status_code == 200

    def test_reset_with_invalid_token_returns_400(self, client):
        resp = client.post("/api/auth/reset-password",
                           json={"token": "fake-token", "new_password": "newpass1"})
        assert resp.status_code == 400


# ──────────────────────────────────────────────────────────────────────
# Edge cases and robustness
# ──────────────────────────────────────────────────────────────────────
class TestEdgeCases:
    def test_missing_features_body_returns_400(self, client, auth_headers):
        resp = client.post("/api/predict/single",
                           json={},
                           headers=auth_headers)
        assert resp.status_code == 400

    def test_invalid_json_body_handled(self, client, auth_headers):
        resp = client.post("/api/predict/single",
                           data="not-json",
                           content_type="application/json",
                           headers=auth_headers)
        assert resp.status_code in (400, 500)

    def test_extreme_feature_values_handled(self, client, auth_headers):
        features = {name: 1e9 for name in FEATURE_NAMES}
        resp = client.post("/api/predict/single",
                           json={"features": features, "model": "ensemble"},
                           headers=auth_headers)
        assert resp.status_code == 200

    def test_zero_feature_values_handled(self, client, auth_headers):
        features = {name: 0.0 for name in FEATURE_NAMES}
        resp = client.post("/api/predict/single",
                           json={"features": features, "model": "xgboost"},
                           headers=auth_headers)
        assert resp.status_code == 200

    def test_expired_token_returns_401(self, client):
        resp = client.get("/api/analytics/overview",
                          headers={"Authorization": "Bearer invalid-fake-token"})
        assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────────────
# Non-functional: response time
# ──────────────────────────────────────────────────────────────────────
class TestPerformance:
    def test_single_alert_responds_within_5_seconds(self, client, auth_headers):
        """
        The report states ~2.1 s average processing time.
        We use a generous 5 s ceiling to account for test environment variance.
        """
        start = time.time()
        resp = client.post("/api/predict/single",
                           json={"features": _sample_features(), "model": "ensemble"},
                           headers=auth_headers)
        elapsed = time.time() - start
        assert resp.status_code == 200
        assert elapsed < 5.0, f"Response took {elapsed:.2f}s — exceeds 5s SLA"
