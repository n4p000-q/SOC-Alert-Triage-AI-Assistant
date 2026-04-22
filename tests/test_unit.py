"""
Unit Tests — SOC Alert Triage AI Assistant
==========================================

Tests individual functions in isolation:
  - calculate_severity
  - get_top_shap_features
  - is_rate_limited
  - predict_xgboost / predict_cnn / predict_ensemble output bounds
  - ensemble weighting logic
  - _metrics helper
"""

import numpy as np
import pytest
from helpers import FEATURE_NAMES, N_FEAT, mock_xgb_model, mock_cnn_model, mock_scaler, mock_shap_explainer


# ──────────────────────────────────────────────────────────────────────
# Fixtures — import module functions after session patches are applied
# ──────────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def fb(flask_app):
    import backend.flask_backend as _fb
    return _fb


# ──────────────────────────────────────────────────────────────────────
# calculate_severity
# ──────────────────────────────────────────────────────────────────────
class TestCalculateSeverity:
    def test_benign_alert_returns_benign(self, fb):
        assert fb.calculate_severity(0, 0.95) == "benign"

    def test_benign_any_confidence_is_benign(self, fb):
        for conf in [0.0, 0.5, 1.0]:
            assert fb.calculate_severity(0, conf) == "benign"

    def test_attack_critical_at_high_confidence(self, fb):
        assert fb.calculate_severity(1, 0.92) == "critical"

    def test_attack_high_at_70_to_89_confidence(self, fb):
        assert fb.calculate_severity(1, 0.80) == "high"

    def test_attack_medium_at_50_to_69_confidence(self, fb):
        assert fb.calculate_severity(1, 0.65) == "medium"

    def test_attack_low_below_50_confidence(self, fb):
        assert fb.calculate_severity(1, 0.40) == "low"

    def test_boundary_0_9_is_critical(self, fb):
        assert fb.calculate_severity(1, 0.90) == "critical"

    def test_boundary_0_7_is_high(self, fb):
        assert fb.calculate_severity(1, 0.70) == "high"

    def test_boundary_0_5_is_medium(self, fb):
        assert fb.calculate_severity(1, 0.50) == "medium"


# ──────────────────────────────────────────────────────────────────────
# get_top_shap_features
# ──────────────────────────────────────────────────────────────────────
class TestGetTopShapFeatures:
    def test_returns_n_features_by_default(self, fb):
        shap_vals = np.random.randn(N_FEAT)
        result = fb.get_top_shap_features(shap_vals)
        assert len(result) == 5

    def test_returns_requested_count(self, fb):
        shap_vals = np.random.randn(N_FEAT)
        result = fb.get_top_shap_features(shap_vals, n=3)
        assert len(result) == 3

    def test_result_has_required_keys(self, fb):
        shap_vals = np.random.randn(N_FEAT)
        top = fb.get_top_shap_features(shap_vals, n=1)
        assert {"feature", "shap_value", "impact"}.issubset(top[0].keys())

    def test_positive_shap_impact_is_attack(self, fb):
        shap_vals = np.zeros(N_FEAT)
        shap_vals[0] = 5.0  # largest positive
        top = fb.get_top_shap_features(shap_vals, n=1)
        assert top[0]["impact"] == "attack"

    def test_negative_shap_impact_is_benign(self, fb):
        shap_vals = np.zeros(N_FEAT)
        shap_vals[0] = -5.0
        top = fb.get_top_shap_features(shap_vals, n=1)
        assert top[0]["impact"] == "benign"

    def test_features_are_ranked_by_absolute_value(self, fb):
        shap_vals = np.zeros(N_FEAT)
        shap_vals[10] = -3.0
        shap_vals[20] = 1.0
        top = fb.get_top_shap_features(shap_vals, n=2)
        # feature_10 should rank first (abs 3.0 > 1.0)
        assert top[0]["feature"] == FEATURE_NAMES[10]

    def test_feature_names_are_valid_strings(self, fb):
        shap_vals = np.random.randn(N_FEAT)
        for entry in fb.get_top_shap_features(shap_vals):
            assert isinstance(entry["feature"], str)
            assert len(entry["feature"]) > 0


# ──────────────────────────────────────────────────────────────────────
# Model output bounds — probabilities must be in [0, 1]
# ──────────────────────────────────────────────────────────────────────
class TestModelOutputBounds:
    def _sample_df(self):
        return __import__("pandas").DataFrame(
            [np.zeros(N_FEAT)], columns=FEATURE_NAMES
        )

    def test_xgboost_prediction_is_binary(self, fb):
        pred, _, _ = fb.predict_xgboost(self._sample_df())
        assert pred in (0, 1)

    def test_xgboost_confidence_in_unit_interval(self, fb):
        _, conf, _ = fb.predict_xgboost(self._sample_df())
        assert 0.0 <= conf <= 1.0

    def test_cnn_prediction_is_binary(self, fb):
        pred, _, _ = fb.predict_cnn(self._sample_df())
        assert pred in (0, 1)

    def test_cnn_confidence_in_unit_interval(self, fb):
        _, conf, _ = fb.predict_cnn(self._sample_df())
        assert 0.0 <= conf <= 1.0

    def test_ensemble_prediction_is_binary(self, fb):
        pred, _, _ = fb.predict_ensemble(self._sample_df())
        assert pred in (0, 1)

    def test_ensemble_confidence_in_unit_interval(self, fb):
        _, conf, _ = fb.predict_ensemble(self._sample_df())
        assert 0.0 <= conf <= 1.0

    def test_shap_values_are_float_array(self, fb):
        _, _, shap_vals = fb.predict_xgboost(self._sample_df())
        assert hasattr(shap_vals, "__len__")
        assert len(shap_vals) == N_FEAT


# ──────────────────────────────────────────────────────────────────────
# Ensemble weighting: 0.6 XGBoost + 0.4 CNN
# ──────────────────────────────────────────────────────────────────────
class TestEnsembleWeighting:
    def test_ensemble_weighted_combination(self, fb):
        """When XGB=0.8 and CNN=0.75, ensemble should be 0.6*0.8 + 0.4*0.75 = 0.78"""
        import pandas as pd
        df = pd.DataFrame([np.zeros(N_FEAT)], columns=FEATURE_NAMES)
        # mock_xgb_model.predict returns 0.8; mock_cnn returns 0.75
        _, conf, _ = fb.predict_ensemble(df)
        # Both models predict attack (>0.5), so confidence = ensemble_proba
        expected = round(0.6 * 0.8 + 0.4 * 0.75, 6)
        assert abs(conf - expected) < 0.01

    def test_ensemble_high_confidence_predicts_attack(self, fb):
        import pandas as pd
        df = pd.DataFrame([np.zeros(N_FEAT)], columns=FEATURE_NAMES)
        pred, _, _ = fb.predict_ensemble(df)
        assert pred == 1  # both mocks return >0.5


# ──────────────────────────────────────────────────────────────────────
# Rate limiter
# ──────────────────────────────────────────────────────────────────────
class TestRateLimiter:
    def test_not_rate_limited_on_first_attempt(self, fb):
        fb._login_attempts.clear()
        assert fb.is_rate_limited("1.2.3.4") is False

    def test_rate_limited_after_five_attempts(self, fb):
        fb._login_attempts.clear()
        ip = "5.5.5.5"
        for _ in range(5):
            fb.is_rate_limited(ip)
        assert fb.is_rate_limited(ip) is True

    def test_different_ips_are_tracked_independently(self, fb):
        fb._login_attempts.clear()
        ip_a, ip_b = "10.0.0.1", "10.0.0.2"
        for _ in range(5):
            fb.is_rate_limited(ip_a)
        assert fb.is_rate_limited(ip_b) is False
