import type { ExcalidrawElement, ExcalidrawFile } from "./excalidraw.js";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function elementToSvg(el: ExcalidrawElement): string {
  if (el.isDeleted) return "";
  const stroke = el.strokeColor ?? "#1e1e1e";
  const fill = !el.backgroundColor || el.backgroundColor === "transparent"
    ? "none"
    : el.backgroundColor;
  const sw = el.strokeWidth ?? 2;

  switch (el.type) {
    case "rectangle":
      return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" rx="4"/>`;

    case "ellipse": {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${el.width / 2}" ry="${el.height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    }

    case "diamond": {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const pts = [
        `${cx},${el.y}`,
        `${el.x + el.width},${cy}`,
        `${cx},${el.y + el.height}`,
        `${el.x},${cy}`,
      ].join(" ");
      return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    }

    case "text": {
      const text = el.text ?? "";
      const fontSize = el.fontSize ?? 16;
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const lines = text.split("\n");
      const lineHeight = fontSize * 1.3;
      const totalHeight = lines.length * lineHeight;
      return lines
        .map((line, i) => {
          const y = cy - totalHeight / 2 + i * lineHeight + lineHeight / 2;
          return `<text x="${cx}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-family="sans-serif" fill="${stroke}">${escapeXml(line)}</text>`;
        })
        .join("\n  ");
    }

    case "arrow": {
      if (!el.points || el.points.length < 2) return "";
      const pts = el.points.map(([px, py]) => `${el.x + px},${el.y + py}`).join(" ");
      const hasArrowhead = el.endArrowhead != null;
      return `<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${sw}"${hasArrowhead ? ' marker-end="url(#arrowhead)"' : ""}/>`;
    }

    default:
      return "";
  }
}

export function toSvg(file: ExcalidrawFile): string {
  const visible = file.elements.filter((el) => !el.isDeleted);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of visible) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  if (!visible.length) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

  const pad = 40;
  const vx = minX - pad;
  const vy = minY - pad;
  const vw = maxX - minX + pad * 2;
  const vh = maxY - minY + pad * 2;
  const bg = file.appState.viewBackgroundColor ?? "#ffffff";

  const defs = `<defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#1e1e1e"/>
    </marker>
  </defs>`;

  const shapes = visible.map(elementToSvg).filter(Boolean).join("\n  ");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">`,
    `  ${defs}`,
    `  <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${bg}"/>`,
    `  ${shapes}`,
    `</svg>`,
  ].join("\n");
}
