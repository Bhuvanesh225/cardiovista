"""Rigorous programmatic visual verification (no human eyes needed).

Checks, via the live DOM and pixel analysis of the actual 3D canvas:
  * every region/copy element is present and visible,
  * the heart silhouette is CENTRED and fully INSIDE the viewer (no off-screen),
  * vessel colours (green/amber/red) are present in the expected bands,
  * nothing overflows the viewport horizontally.

    python train/inspect_ui.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = "http://localhost:5173"
OUT = ROOT / "artifacts"
BG = (11, 15, 24)


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in range(3))


def close(a, b, tol=30):
    return all(abs(a[i] - b[i]) <= tol for i in range(3))


class Checks:
    def __init__(self):
        self.rows: list[tuple[str, bool]] = []

    def check(self, label: str, cond: bool) -> None:
        self.rows.append((label, bool(cond)))

    def report(self) -> bool:
        ok = True
        for label, cond in self.rows:
            print(f"  {'PASS' if cond else 'FAIL'}  {label}")
            ok &= cond
        return ok


def main() -> None:
    from playwright.sync_api import sync_playwright

    c = Checks()
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        page = browser.new_page(viewport={"width": 1600, "height": 1000})
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.goto(BASE, wait_until="networkidle")

        c.check("safety modal shown", page.get_by_test_id("safety-ack").is_visible())
        page.get_by_test_id("safety-ack").click()

        for name in ("Metrics", "Docs"):
            c.check(f"nav '{name}' present", page.get_by_role("button", name=name).is_visible())
        for label in ("Patient data", "Anatomical risk map", "Risk and explainability"):
            c.check(f"section '{label}'", page.locator(f"section[aria-label='{label}']").count() > 0)
        c.check("safety banner copy", page.get_by_text("Educational screening aid only", exact=False).count() > 0)

        # run a high-risk prediction
        page.get_by_test_id("preset-typical-angina-58m").click()
        page.get_by_test_id("run-prediction").click()
        page.wait_for_timeout(3200)

        hero = page.locator("section[aria-label='Risk and explainability']").inner_text()
        c.check("CAD hero rendered", "Coronary artery disease" in hero)
        c.check("CAD probability rendered", any(t in hero for t in ("0.8", "0.9", "1.0")))
        for tid in ("vessel-lad", "vessel-lcx", "vessel-rca", "counterfactual"):
            c.check(f"element {tid}", page.get_by_test_id(tid).count() > 0)
        c.check("SHAP base value", "base value" in hero)
        page.wait_for_timeout(1500)
        c.check("counterfactual delta", "pp" in page.get_by_test_id("counterfactual").inner_text())

        # ---- 3D geometry: is the heart centred and inside the viewer? -------
        viewer = page.locator("section[aria-label='Anatomical risk map']")
        box = viewer.bounding_box()
        shot = OUT / "_inspect_viewer.png"
        viewer.screenshot(path=str(shot))
        try:
            from PIL import Image

            im = Image.open(shot).convert("RGB")
            w, h = im.size
            px = im.load()
            xs, ys = [], []
            red = amber = green = 0
            RED, AMBER, GREEN = hex_to_rgb("#FB2C36"), hex_to_rgb("#FF6900"), hex_to_rgb("#00C950")
            # only inspect the canvas area (skip the header/footer chrome ~ top 46px, bottom 120px)
            for y in range(52, h - 120):
                for x in range(0, w):
                    r, g, b = px[x, y]
                    if abs(r - BG[0]) + abs(g - BG[1]) + abs(b - BG[2]) > 42:
                        xs.append(x)
                        ys.append(y)
                    if close((r, g, b), RED):
                        red += 1
                    elif close((r, g, b), AMBER):
                        amber += 1
                    elif close((r, g, b), GREEN):
                        green += 1
            if xs:
                minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
                cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
                inside = minx > 4 and maxx < w - 4 and miny > 4 and maxy < h - 4
                # centred within +-18% of the canvas centre
                centred = abs(cx - w / 2) < w * 0.18 and abs(cy - (52 + (h - 120)) / 2) < (h - 120) * 0.22
                print(f"    silhouette bbox x[{minx},{maxx}] of {w}, y[{miny},{maxy}] of {h}, centre=({cx:.0f},{cy:.0f})")
                c.check("heart fully inside viewer (no clipping)", inside)
                c.check("heart centred in viewer", centred)
                c.check("heart occupies a sensible area", (maxx - minx) > w * 0.25 and (maxy - miny) > (h - 172) * 0.25)
            else:
                c.check("heart silhouette visible", False)
            print(f"    vessel pixels red={red} amber={amber} green={green}")
            c.check("red vessel present (high risk)", red > 40)
            c.check("vessel colour palette used", (red + amber + green) > 120)
        except Exception as exc:
            c.check(f"3d analysis ({exc})", False)

        # ---- no horizontal overflow anywhere ---------------------------------
        overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 2")
        c.check("no horizontal page overflow", not overflow)

        # ---- metrics + docs ------------------------------------------------
        page.get_by_role("button", name="Metrics").click()
        page.wait_for_timeout(1400)
        c.check("metrics table", "ROC-AUC" in page.inner_text("body"))
        page.get_by_role("button", name="Docs").click()
        page.wait_for_timeout(700)
        c.check("docs screen", "leakage firewall" in page.inner_text("body").lower())

        real = [e for e in errors if "favicon" not in e.lower()]
        c.check(f"no console errors {real[:2]}", len(real) == 0)

        # ---- mobile: verify no horizontal scroll ----------------------------
        mob = browser.new_page(viewport={"width": 360, "height": 780})
        mob.goto(BASE, wait_until="networkidle")
        try:
            mob.get_by_test_id("safety-ack").click(timeout=6000)
        except Exception:
            pass
        mob.wait_for_timeout(2000)
        mob_overflow = mob.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 2")
        c.check("mobile 360: no horizontal overflow", not mob_overflow)
        mob.screenshot(path=str(OUT / "mobile360.png"), full_page=True)

        browser.close()

    print("\nVISUAL VERIFICATION (programmatic):")
    ok = c.report()
    print("\nRESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())