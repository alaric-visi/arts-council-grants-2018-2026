// Exporting a chart as a standalone image: the chart's SVG wrapped with a
// title, a line describing the current view, and a source credit.

export interface ExportLabels {
  title: string;
  subtitle?: string;
  credit?: string;
}

const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Breaks text into lines of at most `max` characters, at spaces. */
const wrap = (text: string, max: number): string[] => {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && (line + " " + word).length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
};

export const FONT_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * A self-contained SVG document: dark background, title, wrapped subtitle,
 * the chart, and a credit line. Recharts and the map draw with attributes, not
 * CSS classes, so the chart looks the same outside the page.
 */
export const standaloneSvg = (
  chart: SVGSVGElement,
  labels: ExportLabels,
  { background = "#0a0a0c", padding = 28 }: { background?: string; padding?: number } = {}
): { markup: string; width: number; height: number } => {
  const viewBox = chart.getAttribute("viewBox");
  const box = chart.getBoundingClientRect();
  const chartWidth = Number(chart.getAttribute("width")) || box.width || Number(viewBox?.split(/\s+/)[2]) || 800;
  const chartHeight = Number(chart.getAttribute("height")) || box.height || Number(viewBox?.split(/\s+/)[3]) || 400;
  const width = Math.round(Math.max(chartWidth + padding * 2, 600));
  const subtitleLines = labels.subtitle ? wrap(labels.subtitle, Math.floor((width - padding * 2) / 7.2)) : [];
  const headerHeight = padding + 26 + subtitleLines.length * 19 + 16;
  const footerHeight = labels.credit ? 34 : 12;
  const height = Math.round(headerHeight + chartHeight + footerHeight + padding / 2);

  const clone = chart.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute("class");
  clone.removeAttribute("style");
  clone.setAttribute("x", String(padding));
  clone.setAttribute("y", String(headerHeight));
  clone.setAttribute("width", String(chartWidth));
  clone.setAttribute("height", String(chartHeight));
  if (!viewBox) clone.setAttribute("viewBox", `0 0 ${chartWidth} ${chartHeight}`);
  const inner = new XMLSerializer().serializeToString(clone);

  const subtitle = subtitleLines
    .map((line, i) => `<text x="${padding}" y="${padding + 26 + 22 + i * 19}" font-size="14" fill="#d4d4d8">${esc(line)}</text>`)
    .join("");
  const credit = labels.credit
    ? `<text x="${padding}" y="${height - padding / 2 - 6}" font-size="12" fill="#a1a1aa">${esc(labels.credit)}</text>`
    : "";

  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${esc(FONT_STACK)}">` +
    `<rect width="${width}" height="${height}" fill="${background}"/>` +
    `<text x="${padding}" y="${padding + 20}" font-size="20" font-weight="600" fill="#ffffff">${esc(labels.title)}</text>` +
    subtitle +
    inner +
    credit +
    `</svg>`;
  return { markup, width, height };
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Renders SVG markup to a PNG at `scale`× for sharp images on high-density screens. */
export const svgToPng = (markup: string, width: number, height: number, scale = 2): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Canvas isn't available"));
      context.scale(scale, scale);
      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))), "image/png");
    };
    image.onerror = () => reject(new Error("The chart couldn't be drawn as an image"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });

export const exportFileName = (name: string, extension: string) =>
  `arts-council-${name}-${new Date().toISOString().slice(0, 10)}.${extension}`;
