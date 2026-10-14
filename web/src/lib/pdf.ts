// Minimal, dependency-free PDF writer for the watermarked screening report.
// Emits a valid single-page PDF with the safety watermark and the prediction,
// SHAP and input summary. No PHI is included by design.

import type { ExplainResponse, Probs, Values } from "./types";
import { featureLabel } from "./features";

interface ReportData {
  inputs: Values;
  probs: Probs | null;
  shap: ExplainResponse | null;
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildContent(data: ReportData): string {
  const lines: string[] = [];
  // watermark (large, rotated, pale red)
  lines.push("q 0.92 0.82 0.82 rg BT /F1 46 Tf 0.7071 0.7071 -0.7071 0.7071 90 380 Tm (SCREENING AID - NOT DIAGNOSIS) Tj ET Q");
  lines.push("q 0.02 0.07 0.17 rg");

  let y = 760;
  const put = (text: string, size = 11, dy = 16) => {
    lines.push(`BT /F1 ${size} Tf 54 ${y} Td (${esc(text)}) Tj ET`);
    y -= dy;
  };

  put("CardioVista — Screening report", 18, 24);
  put("Educational screening aid only — not diagnosis. Discuss amber or red results with a clinician.", 9, 20);
  put(`Generated: ${new Date().toISOString()}   ·   No PHI stored.`, 9, 24);

  if (data.probs) {
    put("Predicted risk (calibrated, 95% CI)", 13, 18);
    const order: ("cad" | "lad" | "lcx" | "rca")[] = ["cad", "lad", "lcx", "rca"];
    for (const h of order) {
      const hp = data.probs[h];
      const label = h === "cad" ? "CAD" : h.toUpperCase();
      put(
        `${label.padEnd(5)}  p=${hp.p.toFixed(2)}  CI ${hp.ci[0].toFixed(2)}-${hp.ci[1].toFixed(2)}  ` +
          `Youden ${hp.threshold.toFixed(2)}  ${hp.flag.toUpperCase()}  (${hp.calibration}, Brier ${hp.brier.toFixed(3)})`,
        10,
        14,
      );
    }
    y -= 8;
  }

  if (data.shap) {
    put(`Why — top drivers for ${data.shap.target.toUpperCase()}`, 13, 18);
    put(`base value ${data.shap.base_value.toFixed(3)} (expected value)`, 9, 14);
    for (const v of data.shap.values) {
      const sign = v.shap >= 0 ? "+" : "";
      put(`${featureLabel(v.feature).padEnd(26)} ${String(v.value).padEnd(8)} ${sign}${v.shap.toFixed(3)}`, 9, 13);
    }
    y -= 8;
  }

  put("Inputs", 13, 16);
  const entries = Object.entries(data.inputs).slice(0, 22);
  for (const [k, v] of entries) {
    put(`${featureLabel(k).padEnd(26)} ${String(v)}`, 8.5, 11.5);
  }

  lines.push("Q");
  lines.push(
    "q 0.6 0 0 rg BT /F1 8 Tf 54 40 Td (Not a medical device. Validated on n=303 single-centre data; no external cohort. ) Tj ET Q",
  );
  return lines.join("\n");
}

function toPdf(content: string): Blob {
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
  );
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export const jsPDF = {
  async generate(data: ReportData): Promise<void> {
    const blob = toPdf(buildContent(data));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cardiovista-screening-${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
};