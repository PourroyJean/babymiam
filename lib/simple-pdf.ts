type CreateTextPdfDocumentInput = {
  title: string;
  lines: string[];
  maxCharsPerLine?: number;
};

type PdfContentLine = {
  text: string;
  useMonospace: boolean;
  useBold: boolean;
  underline: boolean;
};

const DEFAULT_MAX_CHARS_PER_LINE = 92;
const LINES_PER_PAGE = 50;
const PAGE_WIDTH = 595;
const MARGIN_X = 48;
const START_Y = 792;
const LINE_HEIGHT = 14;
const MONOSPACE_PREFIX = "[[MONO]] ";

function sanitizePdfText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\u202f/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/[^\x20-\xff]/g, "?");
}

function escapePdfLiteral(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function parseMonospaceLine(rawLine: string) {
  if (!rawLine.startsWith(MONOSPACE_PREFIX)) {
    return { text: rawLine, useMonospace: false };
  }

  return {
    text: rawLine.slice(MONOSPACE_PREFIX.length),
    useMonospace: true
  };
}

function isSectionTitleLine(line: string) {
  return /^[1-6]\)\s+/.test(line.trim());
}

function wrapLine(line: PdfContentLine, maxCharsPerLine: number): PdfContentLine[] {
  const source = sanitizePdfText(line.text);
  if (!source) return [{ text: "", useMonospace: line.useMonospace, useBold: line.useBold, underline: line.underline }];
  if (source.length <= maxCharsPerLine) {
    return [{ text: source, useMonospace: line.useMonospace, useBold: line.useBold, underline: line.underline }];
  }

  const lines: PdfContentLine[] = [];
  let current = "";
  const words = source.split(/\s+/).filter(Boolean);

  for (const word of words) {
    if (!current) {
      if (word.length <= maxCharsPerLine) {
        current = word;
      } else {
        let remaining = word;
        while (remaining.length > maxCharsPerLine) {
          lines.push({
            text: `${remaining.slice(0, maxCharsPerLine - 1)}-`,
            useMonospace: line.useMonospace,
            useBold: line.useBold,
            underline: line.underline
          });
          remaining = remaining.slice(maxCharsPerLine - 1);
        }
        current = remaining;
      }
      continue;
    }

    const candidate = `${current} ${word}`;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }

    lines.push({ text: current, useMonospace: line.useMonospace, useBold: line.useBold, underline: line.underline });

    if (word.length <= maxCharsPerLine) {
      current = word;
      continue;
    }

    let remaining = word;
    while (remaining.length > maxCharsPerLine) {
      lines.push({
        text: `${remaining.slice(0, maxCharsPerLine - 1)}-`,
        useMonospace: line.useMonospace,
        useBold: line.useBold,
        underline: line.underline
      });
      remaining = remaining.slice(maxCharsPerLine - 1);
    }
    current = remaining;
  }

  if (current) {
    lines.push({ text: current, useMonospace: line.useMonospace, useBold: line.useBold, underline: line.underline });
  }
  return lines;
}

function paginateLines(lines: PdfContentLine[], maxCharsPerLine: number) {
  const wrapped = lines.flatMap((line) => wrapLine(line, maxCharsPerLine));
  if (wrapped.length === 0) {
    return [[{ text: "", useMonospace: false, useBold: false, underline: false }]];
  }

  const pages: PdfContentLine[][] = [];
  for (let index = 0; index < wrapped.length; index += LINES_PER_PAGE) {
    pages.push(wrapped.slice(index, index + LINES_PER_PAGE));
  }

  return pages;
}

function createPageContentStream(lines: PdfContentLine[], pageIndex: number, pageCount: number) {
  const commands: string[] = ["BT", "/F1 11 Tf", `${LINE_HEIGHT} TL`, `${MARGIN_X} ${START_Y} Td`];
  let activeFont = "F1";
  const underlineSegments: Array<{ y: number; text: string }> = [];

  lines.forEach((line, index) => {
    const requiredFont = line.useMonospace ? "F2" : line.useBold ? "F3" : "F1";
    if (requiredFont !== activeFont) {
      commands.push(`/${requiredFont} 11 Tf`);
      activeFont = requiredFont;
    }
    commands.push(`(${escapePdfLiteral(line.text)}) Tj`);
    if (line.underline && line.text.trim()) {
      underlineSegments.push({
        y: START_Y - index * LINE_HEIGHT - 2,
        text: line.text
      });
    }
    if (index < lines.length - 1) {
      commands.push("T*");
    }
  });

  commands.push("ET");

  if (underlineSegments.length > 0) {
    commands.push("q");
    commands.push("0 G");
    commands.push("0.6 w");
    for (const segment of underlineSegments) {
      const approxWidth = Math.min(Math.max(segment.text.length * 6, 0), PAGE_WIDTH - MARGIN_X * 2);
      const x2 = MARGIN_X + approxWidth;
      commands.push(`${MARGIN_X} ${segment.y} m ${x2} ${segment.y} l S`);
    }
    commands.push("Q");
  }

  if (pageCount > 1) {
    commands.push("BT");
    commands.push("/F1 9 Tf");
    commands.push(`${PAGE_WIDTH - 86} 26 Td`);
    commands.push(`(Page ${pageIndex + 1}/${pageCount}) Tj`);
    commands.push("ET");
  }

  return Buffer.from(commands.join("\n"), "latin1");
}

export function createTextPdfDocument({
  title,
  lines,
  maxCharsPerLine = DEFAULT_MAX_CHARS_PER_LINE
}: CreateTextPdfDocumentInput) {
  const sanitizedTitle = sanitizePdfText(title).trim() || "Document";
  const contentLines: PdfContentLine[] = [
    { text: sanitizedTitle, useMonospace: false, useBold: false, underline: false },
    { text: "", useMonospace: false, useBold: false, underline: false },
    ...lines.map((line) => {
      const parsedLine = parseMonospaceLine(line);
      const isSectionTitle = isSectionTitleLine(line);
      return {
        text: sanitizePdfText(isSectionTitle ? parsedLine.text.toUpperCase() : parsedLine.text),
        useMonospace: parsedLine.useMonospace,
        useBold: isSectionTitle,
        underline: isSectionTitle
      };
    })
  ];
  const pages = paginateLines(contentLines, maxCharsPerLine);

  const pageCount = pages.length;
  const fontObjectNumber = 3 + pageCount * 2;
  const monoFontObjectNumber = fontObjectNumber + 1;
  const boldFontObjectNumber = monoFontObjectNumber + 1;
  const objectCount = boldFontObjectNumber;
  const pageObjectNumbers = pages.map((_, index) => 3 + index * 2);
  const contentObjectNumbers = pages.map((_, index) => 4 + index * 2);

  const objects: Buffer[] = new Array(objectCount + 1);
  objects[1] = Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1");
  objects[2] = Buffer.from(
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((value) => `${value} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    "latin1"
  );

  pages.forEach((pageLines, index) => {
    const pageObjectNumber = pageObjectNumbers[index];
    const contentObjectNumber = contentObjectNumbers[index];
    const stream = createPageContentStream(pageLines, index, pageCount);

    objects[pageObjectNumber] = Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectNumber} 0 R /F2 ${monoFontObjectNumber} 0 R /F3 ${boldFontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
      "latin1"
    );

    objects[contentObjectNumber] = Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "latin1"),
      stream,
      Buffer.from("\nendstream", "latin1")
    ]);
  });

  objects[fontObjectNumber] = Buffer.from(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "latin1"
  );
  objects[monoFontObjectNumber] = Buffer.from(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    "latin1"
  );
  objects[boldFontObjectNumber] = Buffer.from(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "latin1"
  );

  const header = Buffer.from("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n", "latin1");
  const chunks: Buffer[] = [header];
  const offsets: number[] = new Array(objectCount + 1).fill(0);
  let currentOffset = header.length;

  for (let objectNumber = 1; objectNumber <= objectCount; objectNumber += 1) {
    const body = objects[objectNumber] || Buffer.from("<<>>", "latin1");
    const objectHeader = Buffer.from(`${objectNumber} 0 obj\n`, "latin1");
    const objectFooter = Buffer.from("\nendobj\n", "latin1");

    offsets[objectNumber] = currentOffset;
    chunks.push(objectHeader, body, objectFooter);
    currentOffset += objectHeader.length + body.length + objectFooter.length;
  }

  const xrefOffset = currentOffset;
  let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  for (let objectNumber = 1; objectNumber <= objectCount; objectNumber += 1) {
    xref += `${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `${xref}trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(trailer, "latin1"));

  return Buffer.concat(chunks);
}
