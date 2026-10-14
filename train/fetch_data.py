"""Download the UCI dataset if the committed copy is missing.

    python train/fetch_data.py

Prefer the committed `data/raw/` copy for offline reproduction; this script is
only a convenience for fresh clones.
"""
from __future__ import annotations

import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
XLSX = RAW / "extention of Z-Alizadeh sani dataset.xlsx"
URL = "https://archive.ics.uci.edu/static/public/411/extention+of+z+alizadeh+sani+dataset.zip"


def main() -> int:
    if XLSX.exists():
        print(f"[fetch] dataset already present: {XLSX}")
        return 0
    RAW.mkdir(parents=True, exist_ok=True)
    zip_path = RAW / "z-alizadeh-sani.zip"
    print(f"[fetch] downloading {URL}")
    urllib.request.urlretrieve(URL, zip_path)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(RAW)
    print(f"[fetch] extracted to {RAW}")
    ok = any(RAW.glob("*.xlsx"))
    print("[fetch] ok" if ok else "[fetch] WARNING: no .xlsx found")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())