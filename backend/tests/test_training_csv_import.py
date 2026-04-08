import pytest

from app.routers.admin import (
    _build_csv_validation_result,
    _normalize_credibility_label as admin_normalize_credibility_label,
    _resolve_field_mapping,
)
from app.services.model_fine_tuning_service import ModelFineTuningService
from app.services.training_data_service import TrainingDataService


class TestCredibilityLabelNormalization:
    @pytest.mark.parametrize(
        "raw_value, expected",
        [
            ("REAL", "REAL"),
            ("real", "REAL"),
            ("FAKE", "FAKE"),
            ("fake", "FAKE"),
            ("1", "REAL"),
            (1, "REAL"),
            ("0", "FAKE"),
            (0, "FAKE"),
            ("true", "REAL"),
            ("false", "FAKE"),
            (" legit ", "REAL"),
            ("misleading", "FAKE"),
        ],
    )
    def test_admin_normalizer_accepts_text_and_binary(self, raw_value, expected):
        assert admin_normalize_credibility_label(raw_value) == expected

    @pytest.mark.parametrize(
        "raw_value, expected",
        [
            ("REAL", "REAL"),
            ("FAKE", "FAKE"),
            ("1", "REAL"),
            ("0", "FAKE"),
            (" true ", "REAL"),
            (" false ", "FAKE"),
        ],
    )
    def test_training_data_service_normalizer_matches_admin(self, raw_value, expected):
        assert TrainingDataService._normalize_credibility_label(raw_value) == expected

    def test_model_fine_tuning_label_ids_match_binary_convention(self):
        assert ModelFineTuningService.CREDIBILITY_LABEL_MAP == {"FAKE": 0, "REAL": 1}


class TestCsvValidation:
    def test_credibility_validation_accepts_binary_labels(self):
        rows = [
            {"headline": "Sample headline one", "label": "1", "article_id": "a-1"},
            {"headline": "Sample headline two", "label": "0", "article_id": "a-2"},
        ]
        mapping = {"title_or_text": "headline", "label": "label", "article_id": "article_id"}

        result = _build_csv_validation_result("credibility", rows, mapping, "credibility.csv", list(rows[0].keys()))

        assert result["valid_rows"] == 2
        assert result["invalid_rows"] == 0
        assert result["label_distribution"] == {"REAL": 1, "FAKE": 1}
        assert result["class_balance_status"] == "balanced"
        assert result["warnings"] == []

    def test_credibility_validation_rejects_unknown_label(self):
        rows = [{"headline": "Sample headline", "label": "maybe", "article_id": "a-1"}]
        mapping = {"title_or_text": "headline", "label": "label", "article_id": "article_id"}

        result = _build_csv_validation_result("credibility", rows, mapping, "credibility.csv", list(rows[0].keys()))

        assert result["valid_rows"] == 0
        assert result["invalid_rows"] == 1
        assert result["issues"][0]["error"] == "Missing credibility title/text or REAL/FAKE label (or 1/0)"

    def test_resolve_field_mapping_supports_required_columns(self):
        sentiment_headers = ["text", "label", "article_id"]
        credibility_headers = ["headline", "label", "article_id"]

        sentiment_mapping = _resolve_field_mapping("sentiment", sentiment_headers)
        credibility_mapping = _resolve_field_mapping("credibility", credibility_headers)

        assert sentiment_mapping["ready"] is True
        assert credibility_mapping["ready"] is True
        assert sentiment_mapping["mapping"]["text"] == "text"
        assert credibility_mapping["mapping"]["title_or_text"] == "headline"
