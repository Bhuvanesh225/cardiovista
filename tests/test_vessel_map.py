"""The probability -> mesh-node correspondence is a single locked file.

Parses the committed heart.glb directly (no three.js) and asserts every
`meshName` in web/src/lib/vesselConfig.ts exists as a node in the mesh, and that
the four angiography targets are never model inputs.
"""
from __future__ import annotations

import json
import re
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.features import FEATURE_NAMES, FORBIDDEN_ANY  # noqa: E402

GLB = ROOT / "assets" / "heart.glb"
VESSEL_CONFIG = ROOT / "web" / "src" / "lib" / "vesselConfig.ts"


def glb_node_names(path: Path) -> list[str]:
    with path.open("rb") as fh:
        magic, _version, _length = struct.unpack("<III", fh.read(12))
        assert magic == 0x46546C67, "not a glTF binary"
        chunk_len, chunk_type = struct.unpack("<II", fh.read(8))
        data = fh.read(chunk_len)
        gltf = json.loads(data.decode("utf-8"))
    return [n.get("name", "") for n in gltf.get("nodes", [])]


def mesh_names_in_config() -> list[str]:
    text = VESSEL_CONFIG.read_text(encoding="utf-8")
    return re.findall(r'meshName:\s*"([^"]+)"', text)


def test_glb_present_and_under_budget():
    assert GLB.exists()
    size_mb = GLB.stat().st_size / (1024 * 1024)
    assert size_mb < 3.0, f"mesh is {size_mb:.2f} MB (budget < 3 MB)"


def test_glb_has_three_coronary_nodes():
    nodes = glb_node_names(GLB)
    for name in (
        "Anterior interventricular artery",
        "Diagonal coronary branch",
        "Right marginal coronary artery",
    ):
        assert name in nodes, f"{name} missing from mesh (found {nodes})"


def test_glb_has_core_anatomy_nodes():
    nodes = glb_node_names(GLB)
    for name in (
        "Heart ventricular and atrial myocardium",
        "Ascending aorta and aortic arch",
        "Pulmonary trunk",
    ):
        assert name in nodes, f"{name} missing from mesh (found {nodes})"


def test_vessel_config_matches_mesh():
    nodes = set(glb_node_names(GLB))
    configured = mesh_names_in_config()
    assert len(configured) == 3, f"expected 3 vessel entries, found {configured}"
    for name in configured:
        assert name in nodes, f"vesselConfig references {name!r} which is not in the mesh"


def test_vessel_config_is_single_source():
    # exactly one file declares the prob -> mesh correspondence
    matches = list(ROOT.glob("web/src/**/vesselConfig.ts"))
    assert len(matches) == 1


def test_targets_never_inputs():
    for banned in FORBIDDEN_ANY:
        assert banned not in FEATURE_NAMES