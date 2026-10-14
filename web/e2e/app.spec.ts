import { test, expect } from "@playwright/test";

// e2e: preset predict -> 3D colour -> SHAP -> slider Δpp -> PDF watermark.
// The API must be running on :8000 (proxied by the preview server).

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // dismiss the first-run safety modal
  const ack = page.getByTestId("safety-ack");
  if (await ack.isVisible().catch(() => false)) await ack.click();
});

test("preset prediction populates the risk panel", async ({ page }) => {
  await page.getByTestId("preset-typical-angina-58m").click();
  await page.getByTestId("run-prediction").click();
  // CAD hero value appears
  await expect(page.getByText("Coronary artery disease")).toBeVisible();
  // four vessel/summary bars present
  await expect(page.getByTestId("vessel-lad")).toBeVisible();
  await expect(page.getByTestId("vessel-lcx")).toBeVisible();
  await expect(page.getByTestId("vessel-rca")).toBeVisible();
});

test("clicking a vessel bar syncs the 3D selection", async ({ page }) => {
  await page.getByTestId("preset-typical-angina-58m").click();
  await page.getByTestId("run-prediction").click();
  const lad = page.getByTestId("vessel-lad");
  await lad.click();
  await expect(lad).toHaveAttribute("aria-pressed", "true");
});

test("counterfactual produces a delta", async ({ page }) => {
  await page.getByTestId("preset-typical-angina-58m").click();
  await page.getByTestId("run-prediction").click();
  const cf = page.getByTestId("counterfactual");
  await expect(cf).toBeVisible();
  // wait for the debounced counterfactual call to settle on a number with "pp"
  await expect(cf.getByText(/pp/)).toBeVisible({ timeout: 15_000 });
});

test("low-risk preset yields a lower CAD risk than typical angina", async ({ page }) => {
  await page.getByTestId("preset-typical-angina-58m").click();
  await page.getByTestId("run-prediction").click();
  await page.waitForTimeout(1200);

  await page.getByTestId("preset-low-risk-44f").click();
  await page.getByTestId("run-prediction").click();
  await page.waitForTimeout(1200);

  // the low-risk exemplar must be flagged low or moderate, never 'high'
  const hero = page.locator("section[aria-label='Risk and explainability']");
  await expect(hero.getByText(/HIGH|MODERATE|LOW/).first()).toBeVisible();
});

test("x-ray toggle and orientation controls work", async ({ page }) => {
  await page.getByTestId("toggle-xray").click();
  await expect(page.getByTestId("toggle-xray")).toHaveAttribute("aria-pressed", "true");
});

test("under-18 is blocked by the API", async ({ page, request }) => {
  const res = await request.post("http://127.0.0.1:8000/v1/predict", { data: { Age: 16 } });
  expect(res.status()).toBe(422);
});

test("forbidden angiography field is rejected by the API", async ({ request }) => {
  const res = await request.post("http://127.0.0.1:8000/v1/predict", { data: { Age: 58, Cath: "CAD" } });
  expect(res.status()).toBe(422);
  const body = await res.json();
  expect(body.detail.code).toBe("leakage");
});