"""API smoke tests — skipped if the model bundle is not yet trained."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

MODEL = ROOT / "app" / "models" / "models.joblib"

pytestmark = pytest.mark.skipif(not MODEL.exists(), reason="model bundle not trained yet")


@pytest.fixture(scope="module")
def client():
    from app.main import app

    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_legacy_redirect(client):
    r = client.get("/health", follow_redirects=False)
    assert r.status_code == 301
    assert r.headers["location"] == "/v1/health"


def test_predict_returns_four_heads(client):
    r = client.post("/v1/predict", json={"Age": 58, "Sex": "Male", "BP": 150, "St Depression": 1})
    assert r.status_code == 200
    body = r.json()
    for head in ("cad", "lad", "lcx", "rca"):
        assert head in body["probs"]
        assert 0.0 <= body["probs"][head]["p"] <= 1.0


def test_predict_rejects_angiography(client):
    r = client.post("/v1/predict", json={"Age": 58, "Cath": "CAD"})
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "leakage"


def test_predict_rejects_underage(client):
    r = client.post("/v1/predict", json={"Age": 16})
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "underage"


def test_explain_returns_base_value(client):
    r = client.post("/v1/explain", json={"target": "cad", "inputs": {"Age": 58, "BP": 150}})
    assert r.status_code == 200
    body = r.json()
    assert "base_value" in body
    assert len(body["values"]) > 0


def test_counterfactual_shows_delta(client):
    r = client.post(
        "/v1/counterfactual",
        json={"target": "cad", "inputs": {"Age": 58, "BP": 150, "Current Smoker": 1}, "mods": {"BP": 120, "Current Smoker": 0}},
    )
    assert r.status_code == 200
    body = r.json()
    assert "delta_pp" in body["deltas"]["cad"]


def test_model_info_has_thresholds(client):
    r = client.get("/v1/model-info")
    assert r.status_code == 200
    assert set(r.json()["thresholds"].keys()) == {"cad", "lad", "lcx", "rca"}