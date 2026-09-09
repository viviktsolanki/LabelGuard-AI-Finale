/**
 * Minimal, dependency-free PDF file generator.
 *
 * ROOT CAUSE THIS FIXES: the previous "Export PDF" button opened a blank
 * popup window (`window.open('', '_blank')`), wrote an HTML document into
 * it, and called `window.print()`. This is not a PDF export at all — it's
 * a browser print dialog, and it breaks outright (silently, with no error
 * shown) whenever the popup is blocked, which is the default in most
 * browsers for a window opened without a direct user gesture in the same
 * call stack, or when third-party/blank-URL popups are blocked. That is
 * exactly the "blank/about:blank page instead of a useful PDF" behaviour
 * that was reported.
 *
 * FIX: build a real, spec-compliant single/multi-page PDF file by hand
 * (no `window.open`, no print dialog, no new dependency — there is no
 * package registry access in this environment to add one) and hand it to
 * the browser as a `Blob` with an `<a download>` link, the same reliable
 * pattern already used for the TXT export. The result is a genuine
 * `application/pdf` file that downloads directly.
 *
 * This intentionally stays a simple monospace text-report PDF (one base14
 * "Courier" font, no images, no layout engine) rather than trying to
 * reproduce the on-screen report's rich HTML/CSS layout — that would
 * require a real PDF layout library. This keeps the export honest about
 * what it is: a genuine, readable PDF of the same report content as the
 * TXT export, not a pixel copy of the web page.
 */

const PAGE_WIDTH = 612; // 8.5in * 72pt — US Letter
const PAGE_HEIGHT = 792; // 11in * 72pt
const MARGIN = 48;
const FONT_SIZE = 9.5;
const LINE_HEIGHT = 12.5;
const CHARS_PER_LINE = 92; // conservative wrap width for Courier at FONT_SIZE on a Letter page minus margins

/** Wraps a single logical line to CHARS_PER_LINE, preserving empty lines. */
function wrapLine(line: string): string[] {
  if (line.length === 0) return [''];

  const words = line.split(' ');
  const wrapped: string[] = [];
  let current = '';

  for (const word of words) {
    // A single "word" longer than the wrap width (e.g. a long extracted
    // ingredients string) is hard-split rather than left to overflow the
    // page margin.
    if (word.length > CHARS_PER_LINE) {
      if (current) {
        wrapped.push(current);
        current = '';
      }
      for (let i = 0; i < word.length; i += CHARS_PER_LINE) {
        wrapped.push(word.slice(i, i + CHARS_PER_LINE));
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > CHARS_PER_LINE) {
      wrapped.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) wrapped.push(current);
  return wrapped.length ? wrapped : [''];
}

/** Escapes the characters PDF string literals treat as special. */
function escapePdfText(text: string): string {
  return (
    text
      // Common Unicode punctuation that the base14 WinAnsi fonts can't
      // render is mapped to its closest ASCII equivalent first, so an
      // em-dash or curly quote shows up as a real character instead of
      // the generic "?" fallback below.
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/\u2026/g, '...')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      // Anything else outside printable ASCII is replaced with a safe
      // placeholder rather than emitting bytes that would corrupt the
      // PDF or render as junk.
      .replace(/[^\x20-\x7e]/g, '?')
  );
}

/** Splits report lines into pages, each holding as many wrapped lines as
 * fit within the page's printable height. */
function paginate(rawLines: string[]): string[][] {
  const linesPerPage = Math.floor((PAGE_HEIGHT - MARGIN * 2) / LINE_HEIGHT);
  const wrapped = rawLines.flatMap((line) => wrapLine(line));

  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += linesPerPage) {
    pages.push(wrapped.slice(i, i + linesPerPage));
  }
  return pages.length ? pages : [['']];
}

/** Builds the content stream for a single page's lines. */
function buildPageContentStream(lines: string[]): string {
  const startY = PAGE_HEIGHT - MARGIN;
  const escaped = lines.map(escapePdfText);

  const body = escaped
    .map((line, i) => {
      const y = startY - i * LINE_HEIGHT;
      return `BT /F1 ${FONT_SIZE} Tf ${MARGIN} ${y.toFixed(2)} Td (${line}) Tj ET`;
    })
    .join('\n');

  return body;
}

/**
 * Builds a complete PDF file (as a Blob) from plain-text report lines.
 * Pure string/byte assembly — no canvas, no external library, no network.
 */
export function buildTextReportPdf(lines: string[]): Blob {
  const pages = paginate(lines);

  // PDF object numbering: 1 = Catalog, 2 = Pages, 3 = Font,
  // then one Page object + one Contents stream object per page.
  const objects: string[] = [];

  const catalogObjNum = 1;
  const pagesObjNum = 2;
  const fontObjNum = 3;
  let nextObjNum = 4;

  const pageObjNums: number[] = [];
  const contentObjNums: number[] = [];

  for (let i = 0; i < pages.length; i++) {
    pageObjNums.push(nextObjNum++);
    contentObjNums.push(nextObjNum++);
  }

  objects[catalogObjNum - 1] = `<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`;

  objects[pagesObjNum - 1] =
    `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`;

  objects[fontObjNum - 1] = `<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`;

  pages.forEach((pageLines, i) => {
    const pageObjNum = pageObjNums[i];
    const contentObjNum = contentObjNums[i];

    objects[pageObjNum - 1] =
      `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 ${fontObjNum} 0 R >> >> /Contents ${contentObjNum} 0 R >>`;

    const stream = buildPageContentStream(pageLines);
    objects[contentObjNum - 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  // Assemble the file, tracking byte offsets for the xref table.
  let pdf = '%PDF-1.4\n';
  // Binary marker comment recommended by the spec so tools treat this as
  // a binary file rather than sniffing it as plain text.
  pdf += '%\xe2\xe3\xcf\xd3\n';

  const offsets: number[] = [];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  const totalObjs = objects.length + 1; // +1 for the free object 0

  let xref = `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }

  pdf += xref;
  pdf += `trailer\n<< /Size ${totalObjs} /Root ${catalogObjNum} 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  // Build as a byte array (Latin-1 mapping) rather than a JS string Blob
  // so the binary marker bytes above survive intact.
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) {
    bytes[i] = pdf.charCodeAt(i) & 0xff;
  }

  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * ─── Phase 5D: Structured PDF report ──────────────────────────────────────
 *
 * Additive on top of the plain monospace exporter above (which is left
 * untouched). This gives the "Export PDF" button real visual hierarchy —
 * a title, section headings, dividers, colored PASS/REVIEW/FLAG text, and
 * indented bullets — while staying within the same constraints as the
 * original exporter: no new dependency, base14 fonts only (Courier +
 * Courier-Bold), pure string/byte assembly, `Blob` + `<a download>`.
 *
 * The content itself still comes entirely from the caller (ReportContent),
 * which derives it from the existing `ProductAnalysis` / compliance
 * insights data — this file only knows how to lay blocks out on a page.
 */

/** RGB color as 0–1 floats, the format the PDF `rg`/`RG` operators expect. */
export type PdfColor = [number, number, number];

export const PDF_COLORS = {
  navy: [0.09, 0.13, 0.24] as PdfColor,
  muted: [0.42, 0.45, 0.5] as PdfColor,
  pass: [0.09, 0.64, 0.29] as PdfColor,
  review: [0.8, 0.45, 0.02] as PdfColor,
  flag: [0.86, 0.15, 0.15] as PdfColor,
  accent: [0.15, 0.39, 0.85] as PdfColor,
};

export type ReportBlock =
  | { type: 'title'; text: string }
  | { type: 'subtitle'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'divider' }
  | { type: 'spacer' }
  | { type: 'keyvalue'; label: string; value: string; color?: PdfColor }
  | { type: 'text'; text: string; bold?: boolean; color?: PdfColor; indent?: number }
  | { type: 'bullet'; text: string; color?: PdfColor; indent?: number };

const STRUCTURED_CHAR_WIDTH_FACTOR = 0.6; // Courier average char width ≈ 0.6 * font size

interface RenderLine {
  text: string;
  bold: boolean;
  size: number;
  color: PdfColor;
  x: number;
  lineHeight: number;
  gapAfter: number;
  rule?: boolean; // render as a filled divider rule instead of text
}

function charsPerLineFor(size: number, indent: number): number {
  const usableWidth = PAGE_WIDTH - MARGIN * 2 - indent;
  return Math.max(10, Math.floor(usableWidth / (size * STRUCTURED_CHAR_WIDTH_FACTOR)));
}

function wrapPlain(text: string, width: number): string[] {
  if (text.length === 0) return [''];
  const words = text.split(' ');
  const wrapped: string[] = [];
  let current = '';
  for (const word of words) {
    if (word.length > width) {
      if (current) {
        wrapped.push(current);
        current = '';
      }
      for (let i = 0; i < word.length; i += width) wrapped.push(word.slice(i, i + width));
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > width) {
      wrapped.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) wrapped.push(current);
  return wrapped.length ? wrapped : [''];
}

/** Converts structured report blocks into a flat sequence of render lines. */
function layoutBlocks(blocks: ReportBlock[]): RenderLine[] {
  const lines: RenderLine[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'title': {
        const size = 17;
        lines.push({
          text: block.text,
          bold: true,
          size,
          color: PDF_COLORS.navy,
          x: MARGIN,
          lineHeight: size * 1.3,
          gapAfter: 4,
        });
        break;
      }
      case 'subtitle': {
        const size = 9.5;
        lines.push({
          text: block.text,
          bold: false,
          size,
          color: PDF_COLORS.muted,
          x: MARGIN,
          lineHeight: size * 1.3,
          gapAfter: 10,
        });
        break;
      }
      case 'heading': {
        const size = 12;
        lines.push({
          text: block.text.toUpperCase(),
          bold: true,
          size,
          color: PDF_COLORS.navy,
          x: MARGIN,
          lineHeight: size * 1.35,
          gapAfter: 3,
        });
        lines.push({
          text: '',
          bold: false,
          size: 1,
          color: PDF_COLORS.accent,
          x: MARGIN,
          lineHeight: 2,
          gapAfter: 6,
          rule: true,
        });
        break;
      }
      case 'divider': {
        lines.push({
          text: '',
          bold: false,
          size: 1,
          color: [0.85, 0.86, 0.88],
          x: MARGIN,
          lineHeight: 1,
          gapAfter: 8,
          rule: true,
        });
        break;
      }
      case 'spacer': {
        lines.push({
          text: '',
          bold: false,
          size: 6,
          color: PDF_COLORS.navy,
          x: MARGIN,
          lineHeight: 6,
          gapAfter: 0,
        });
        break;
      }
      case 'keyvalue': {
        const size = 9.5;
        const width = charsPerLineFor(size, 0);
        const wrapped = wrapPlain(`${block.label}: ${block.value}`, width);
        wrapped.forEach((w, i) =>
          lines.push({
            text: w,
            bold: i === 0,
            size,
            color: block.color ?? PDF_COLORS.navy,
            x: MARGIN,
            lineHeight: size * 1.4,
            gapAfter: i === wrapped.length - 1 ? 2 : 0,
          })
        );
        break;
      }
      case 'text': {
        const size = 9.5;
        const indent = block.indent ?? 0;
        const width = charsPerLineFor(size, indent);
        const wrapped = wrapPlain(block.text, width);
        wrapped.forEach((w, i) =>
          lines.push({
            text: w,
            bold: !!block.bold,
            size,
            color: block.color ?? PDF_COLORS.navy,
            x: MARGIN + indent,
            lineHeight: size * 1.4,
            gapAfter: i === wrapped.length - 1 ? 3 : 0,
          })
        );
        break;
      }
      case 'bullet': {
        const size = 9.5;
        const indent = (block.indent ?? 0) + 10;
        const width = charsPerLineFor(size, indent);
        const wrapped = wrapPlain(block.text, width);
        wrapped.forEach((w, i) =>
          lines.push({
            text: i === 0 ? `-  ${w}` : `   ${w}`,
            bold: false,
            size,
            color: block.color ?? PDF_COLORS.navy,
            x: MARGIN + indent - 10,
            lineHeight: size * 1.4,
            gapAfter: i === wrapped.length - 1 ? 2 : 0,
          })
        );
        break;
      }
    }
  }

  return lines;
}

/** Splits render lines across pages by cumulative vertical space. */
function paginateLines(lines: RenderLine[]): RenderLine[][] {
  const usableHeight = PAGE_HEIGHT - MARGIN * 2;
  const pages: RenderLine[][] = [[]];
  let y = 0;

  for (const line of lines) {
    const consumed = line.lineHeight + line.gapAfter;
    if (y + consumed > usableHeight && pages[pages.length - 1].length > 0) {
      pages.push([]);
      y = 0;
    }
    pages[pages.length - 1].push(line);
    y += consumed;
  }

  return pages;
}

/** Builds the content stream for a single structured page. */
function buildStructuredPageStream(lines: RenderLine[]): string {
  let y = PAGE_HEIGHT - MARGIN;
  const ops: string[] = [];

  for (const line of lines) {
    if (line.rule) {
      const [r, g, b] = line.color;
      const ruleHeight = Math.max(0.75, line.size);
      ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
      ops.push(
        `${MARGIN} ${(y - ruleHeight).toFixed(2)} ${PAGE_WIDTH - MARGIN * 2} ${ruleHeight.toFixed(2)} re f`
      );
    } else if (line.text.length > 0) {
      const [r, g, b] = line.color;
      const font = line.bold ? 'F2' : 'F1';
      ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
      ops.push(
        `BT /${font} ${line.size} Tf ${line.x} ${(y - line.size).toFixed(2)} Td (${escapePdfText(line.text)}) Tj ET`
      );
    }
    y -= line.lineHeight + line.gapAfter;
  }

  return ops.join('\n');
}

/**
 * Builds a structured, multi-font, color-aware PDF (as a Blob) from a list
 * of `ReportBlock`s. Same no-dependency, hand-assembled approach as
 * `buildTextReportPdf`, extended with a second base14 font (Courier-Bold)
 * and per-line fill color for status-coded text and section rules.
 */
export function buildStructuredReportPdf(blocks: ReportBlock[]): Blob {
  const lines = layoutBlocks(blocks);
  const pages = paginateLines(lines);

  const objects: string[] = [];
  const catalogObjNum = 1;
  const pagesObjNum = 2;
  const fontRegularObjNum = 3;
  const fontBoldObjNum = 4;
  let nextObjNum = 5;

  const pageObjNums: number[] = [];
  const contentObjNums: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    pageObjNums.push(nextObjNum++);
    contentObjNums.push(nextObjNum++);
  }

  objects[catalogObjNum - 1] = `<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`;
  objects[pagesObjNum - 1] =
    `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[fontRegularObjNum - 1] = `<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`;
  objects[fontBoldObjNum - 1] = `<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>`;

  pages.forEach((pageLines, i) => {
    const pageObjNum = pageObjNums[i];
    const contentObjNum = contentObjNums[i];
    objects[pageObjNum - 1] =
      `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 ${fontRegularObjNum} 0 R /F2 ${fontBoldObjNum} 0 R >> >> /Contents ${contentObjNum} 0 R >>`;
    const stream = buildStructuredPageStream(pageLines);
    objects[contentObjNum - 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = '%PDF-1.4\n';
  pdf += '%\xe2\xe3\xcf\xd3\n';

  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  const totalObjs = objects.length + 1;
  let xref = `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${offset.toString().padStart(10, '0')} 00000 n \n`;

  pdf += xref;
  pdf += `trailer\n<< /Size ${totalObjs} /Root ${catalogObjNum} 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;

  return new Blob([bytes], { type: 'application/pdf' });
}

/** Triggers a browser download of the given PDF Blob. */
export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
