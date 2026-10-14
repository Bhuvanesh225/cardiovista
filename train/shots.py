"""Capture screenshots of the running app for visual verification.

    python train/shots.py            # dev server on :5173, API on :8000

Writes artifacts/ui-*.png (dashboard, metrics, docs, low-risk preset) and a
mobile 360px shot. Uses Playwright (sync API).
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "artifacts"
BASE = "http://localhost:5173"


def main() -> None:
    from playwright.sync_api import sync_playwright

    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        page = browser.new_page(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
        page.goto(BASE, wait_until="networkidle")
        # dismiss safety modal
        try:
            page.get_by_test_id("safety-ack").click(timeout=8000)
        except Exception:
            pass
        page.wait_for_timeout(3500)
        page.screenshot(path=str(OUT / "ui-dashboard.png"))

        # low-risk preset
        try:
            page.get_by_test_id("preset-low-risk-44f").click()
            page.get_by_test_id("run-prediction").click()
            page.wait_for_timeout(2500)
            page.screenshot(path=str(OUT / "ui-low-risk.png"))
        except Exception as exc:
            print("[shots] low-risk failed:", exc)

        # metrics
        page.get_by_role("button", name="Metrics").click()
        page.wait_for_timeout(1500)
        page.screenshot(path=str(OUT / "ui-metrics.png"), full_page=False)

        # docs
        page.get_by_role("button", name="Docs").click()
        page.wait_for_timeout(800)
        page.screenshot(path=str(OUT / "ui-docs.png"))

        # mobile 360
        mobile = browser.new_page(viewport={"width": 360, "height": 780})
        mobile.goto(BASE, wait_until="networkidle")
        try:
            mobile.get_by_test_id("safety-ack").click(timeout=8000)
        except Exception:
            pass
        mobile.wait_for_timeout(3000)
        mobile.screenshot(path=str(OUT / "mobile360.png"), full_page=True)

        browser.close()
    print("[shots] wrote artifacts/ui-*.png and mobile360.png")


if __name__ == "__main__":
    sys.exit(main())