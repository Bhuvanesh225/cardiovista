"""CardioVista FastAPI application.

Startup verifies the registry hashes (model + mesh) and fails on drift, so the
served model is exactly the committed artifact.
"""
from __future__ import annotations

import hashlib
import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from .routers import v1

APP_DIR = Path(__file__).resolve().parent
ROOT = APP_DIR.parent
REGISTRY = APP_DIR / "registry.json"


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_registry() -> dict:
    reg = json.loads(REGISTRY.read_text(encoding="utf-8"))
    model_path = APP_DIR / "models" / "models.joblib"
    if model_path.exists() and reg.get("model_hash"):
        actual = _sha256(model_path)
        if actual != reg["model_hash"]:
            raise RuntimeError(
                f"model hash drift: registry={reg['model_hash'][:12]} actual={actual[:12]}"
            )
    mesh_name = reg.get("mesh_name", "heart.glb")
    mesh_path = ROOT / "assets" / mesh_name
    if mesh_path.exists() and reg.get("mesh_sha"):
        actual_mesh = _sha256(mesh_path)
        if actual_mesh != reg["mesh_sha"]:
            raise RuntimeError(
                f"mesh hash drift: registry={reg['mesh_sha'][:12]} actual={actual_mesh[:12]}"
            )
    return reg


@asynccontextmanager
async def lifespan(app: FastAPI):
    verify_registry()
    yield


app = FastAPI(
    title="CardioVista API",
    version="1.0.0",
    description="Educational coronary-artery-disease screening aid. Not diagnosis.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1.router)


@app.get("/health", include_in_schema=False)
def legacy_health() -> RedirectResponse:
    return RedirectResponse("/v1/health", status_code=301)


@app.get("/model-info", include_in_schema=False)
def legacy_model_info() -> RedirectResponse:
    return RedirectResponse("/v1/model-info", status_code=301)


@app.get("/metrics", include_in_schema=False)
def legacy_metrics() -> RedirectResponse:
    return RedirectResponse("/v1/metrics", status_code=301)


@app.exception_handler(RuntimeError)
async def runtime_error_handler(request: Request, exc: RuntimeError) -> JSONResponse:
    return JSONResponse(status_code=500, content={"detail": str(exc)})


def create_app() -> FastAPI:
    return app