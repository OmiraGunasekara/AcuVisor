import { jsPDF } from "jspdf";
import { fmt } from "./math";

export function wallLabelForReport(wall) {
  switch (wall) {
    case "north":
      return "North Wall";
    case "south":
      return "South Wall";
    case "east":
      return "East Wall";
    case "west":
      return "West Wall";
    default:
      return "Wall";
  }
}

export function wallSpanForReport(wall, L, W) {
  return wall === "north" || wall === "south" ? Number(L) : Number(W);
}

export function resolveWallRectForReport(item, L, W, H) {
  if (!item?.wall) return null;

  const wallWidth = wallSpanForReport(item.wall, L, W);
  const x1 = item.x1_m ?? (item.x1 != null ? Number(item.x1) * wallWidth : null);
  const x2 = item.x2_m ?? (item.x2 != null ? Number(item.x2) * wallWidth : null);
  const z1 = item.z1_m ?? (item.z1 != null ? Number(item.z1) * Number(H) : null);
  const z2 = item.z2_m ?? (item.z2 != null ? Number(item.z2) * Number(H) : null);

  if (![x1, x2, z1, z2].every((value) => Number.isFinite(value))) {
    return null;
  }

  const width = Math.max(Math.abs(x2 - x1), 0);
  const height = Math.max(Math.abs(z2 - z1), 0);
  if (width <= 0 || height <= 0) return null;

  return {
    wallLabel: wallLabelForReport(item.wall),
    width,
    height,
    area: width * height,
  };
}

export function formatPointForReport(point) {
  if (!point) return "Not set";
  return `x ${fmt(Number(point.x), 2)}m, y ${fmt(Number(point.y), 2)}m, z ${fmt(Number(point.z), 2)}m`;
}

export function buildPanelRowsForReport(panels, L, W, H) {
  return (panels ?? [])
    .map((panel, index) => {
      const rect = resolveWallRectForReport(panel, L, W, H);
      if (!rect) return null;

      return `Panel ${index + 1}: ${rect.wallLabel}, ${fmt(rect.width, 2)}m x ${fmt(rect.height, 2)}m (${fmt(rect.area, 2)} m^2)`;
    })
    .filter(Boolean);
}

export function buildReportFilename() {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `acuvisor-report-${timestamp}.pdf`;
}

export function buildPdfReport({
  recommendation,
  rt60,
  audio,
  L,
  W,
  H,
  source,
  listener,
  snapshotDataUrl,
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (heightNeeded = 16) => {
    if (y + heightNeeded <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
  };

  const writeSectionTitle = (title, { spaceAbove = 18 } = {}) => {
    ensureSpace(28 + (y > margin ? spaceAbove : 0));
    if (y > margin) {
      y += spaceAbove;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, y);
    y += 8;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 18;
  };

  const writeKeyValue = (label, value) => {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), margin + 125, y);
    y += 15;
  };

  const writeParagraph = (text) => {
    const lines = doc.splitTextToSize(text, contentWidth);
    ensureSpace(lines.length * 12 + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 4;
  };

  const panelRows = buildPanelRowsForReport(recommendation?.panels ?? [], L, W, H);

  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin, y, contentWidth, 74, 16, 16, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text("AcuVisor Acoustic Report", margin + 20, y + 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated ${new Date().toLocaleString()}`, margin + 20, y + 47);
  doc.text("Room optimization summary with 3D treatment snapshot.", margin + 20, y + 62);
  y += 96;

  writeSectionTitle("Project Summary", { spaceAbove: 0 });
  writeKeyValue("Room dimensions", `${fmt(Number(L), 2)}m x ${fmt(Number(W), 2)}m x ${fmt(Number(H), 2)}m`);
  writeKeyValue("Source position", formatPointForReport(source));
  writeKeyValue("Listener position", formatPointForReport(listener));
  writeKeyValue("Recommended panels", recommendation?.panels?.length ?? 0);
  writeKeyValue("Manual exclusions", recommendation?.exclusions?.length ?? 0);
  writeKeyValue("Source clearance zones", recommendation?.source_clearance_zones?.length ?? 0);

  if (snapshotDataUrl) {
    const imageProps = doc.getImageProperties(snapshotDataUrl);
    const imageWidth = contentWidth;
    const imageHeight = Math.min((imageProps.height * imageWidth) / imageProps.width, 280);

    writeSectionTitle("3D Treatment Snapshot");
    ensureSpace(imageHeight + 12);
    doc.addImage(snapshotDataUrl, "PNG", margin, y, imageWidth, imageHeight, undefined, "FAST");
    y += imageHeight + 18;
  }

  writeSectionTitle("Materials");
  writeKeyValue("Wall", recommendation?.materials?.wall ?? "-");
  writeKeyValue("Floor", recommendation?.materials?.floor ?? "-");
  writeKeyValue("Ceiling", recommendation?.materials?.ceiling ?? "-");

  writeSectionTitle("Predicted Acoustic Metrics");
  writeKeyValue("Panel coverage used", `${fmt((recommendation?.metrics?.used_coverage ?? 0) * 100, 1)}%`);
  writeKeyValue("RT60 before", `${fmt(rt60?.rt60_before, 3)}s`);
  writeKeyValue("RT60 after", `${fmt(rt60?.rt60_after, 3)}s`);
  writeKeyValue("RT60 delta", `${fmt(rt60?.rt60_delta, 3)}s`);
  writeKeyValue("Audio preview", audio ? `Generated (${audio.speech_label || "Speech Sample"})` : "Not generated");

  writeSectionTitle("Recommended Panels");
  if (panelRows.length === 0) {
    writeParagraph("No panel recommendations were available when this report was generated.");
  } else {
    for (const row of panelRows) {
      writeParagraph(row);
    }
  }

  return doc;
}
