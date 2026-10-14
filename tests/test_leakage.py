"""Leakage firewall tests — run on every push.

Asserts, from the committed artefacts and the guard module:
  * the per-target DROP list is enforced at the training layer,
  * forbidden fields (Cath / LAD / LCX / RCA) are rejected by the API schema,
  * range chips and the `<18` block fire,
  * the registry hashes are present (model + mesh drift guard).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.features import FEATURE_NAMES, FORBIDDEN_ANY  # noqa: E402
from app.guard import GuardError, assert_no_forbidden, validate_payload  # noqa: E402


def test_no_angiography_columns_in_features():
    for banned in FORBIDDEN_ANY:
        assert banned not in FEATURE_NAMES, f"{banned} must never be a model input"


@pytest.mark.parametrize("target", ["cad", "lad", "lcx", "rca"])
def test_train_drop_list_enforced(target):
    # every allowed column passes the training guard
    assert_no_forbidden(target, list(FEATURE_NAMES))


def test_training_guard_rejects_leakage():
    with pytest.raises(GuardError):
        assert_no_forbidden("cad", list(FEATURE_NAMES) + ["LAD"])


@pytest.mark.parametrize("field", ["Cath", "LAD", "LCX", "RCA", "stenosis", "angio"])
def test_api_rejects_forbidden_fields(field):
    with pytest.raises(GuardError) as exc:
        validate_payload({"Age": 55, field: "Stenotic"})
    assert exc.value.code == "leakage"


def test_api_rejects_unknown_extra_field():
    with pytest.raises(GuardError) as exc:
        validate_payload({"Age": 55, "totally_made_up": 1})
    assert exc.value.code == "unknown"


def test_under_18_hard_block():
    with pytest.raises(GuardError) as exc:
        validate_payload({"Age": 17})
    assert exc.value.code == "underage"


def test_range_chips():
    with pytest.raises(GuardError) as exc:
        validate_payload({"Age": 45, "BP": 400})
    assert exc.value.code == "range"
    assert exc.value.field == "BP"


def test_valid_payload_passes():
    clean = validate_payload({"Age": 58, "Sex": "Male", "BP": 150, "St Depression": 1})
    assert clean["Age"] == 58
    assert clean["St Depression"] == 1


def test_registry_hashes_present():
    reg = json.loads((ROOT / "app" / "registry.json").read_text(encoding="utf-8"))
    assert reg.get("model_hash")
    assert reg.get("mesh_sha")