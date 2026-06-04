import { PDFDocument } from "pdf-lib";

export type PageRange = {
  /** 1-based inclusive. */
  start: number;
  /** 1-based inclusive. */
  end: number;
};

export type SplitChunk = {
  /** Human label, e.g. "1-3" or "5". */
  label: string;
  bytes: Uint8Array;
};

/** Parses a range expression like "1-3, 5, 7-10" against `pageCount` (1-based). Throws on invalid input. */
export function parseRanges(input: string, pageCount: number): PageRange[] {
  const cleaned = input.trim();
  if (!cleaned) {
    throw new Error("Especifica al menos un rango (ej.: 1-3, 5, 7-10).");
  }

  const ranges: PageRange[] = [];
  const seenPages = new Set<number>();

  for (const raw of cleaned.split(/[,\s]+/)) {
    if (!raw) continue;
    const match = raw.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) {
      throw new Error(`Formato no reconocido cerca de "${raw}".`);
    }
    const start = Number.parseInt(match[1], 10);
    const end = match[2] ? Number.parseInt(match[2], 10) : start;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 1 ||
      end < 1 ||
      start > pageCount ||
      end > pageCount
    ) {
      throw new Error(
        `Rango "${raw}" fuera del documento (${pageCount} páginas).`,
      );
    }
    if (start > end) {
      throw new Error(`Rango inverso no permitido: "${raw}".`);
    }
    for (let p = start; p <= end; p++) {
      if (seenPages.has(p)) {
        throw new Error(`La página ${p} aparece más de una vez.`);
      }
      seenPages.add(p);
    }
    ranges.push({ start, end });
  }

  if (ranges.length === 0) {
    throw new Error("Especifica al menos un rango.");
  }
  return ranges;
}

/** Builds one output PDF per range, copying the requested pages. */
export async function splitPdfByRanges(
  sourceBytes: ArrayBuffer,
  ranges: PageRange[],
): Promise<SplitChunk[]> {
  const source = await PDFDocument.load(sourceBytes, { updateMetadata: false });
  const out: SplitChunk[] = [];

  for (let i = 0; i < ranges.length; i++) {
    const { start, end } = ranges[i];
    const newDoc = await PDFDocument.create();
    const zeroBased = Array.from(
      { length: end - start + 1 },
      (_, k) => start - 1 + k,
    );
    const copied = await newDoc.copyPages(source, zeroBased);
    for (const page of copied) {
      newDoc.addPage(page);
    }
    const bytes = await newDoc.save({
      useObjectStreams: true,
      objectsPerTick: 50,
    });
    out.push({
      label: start === end ? `${start}` : `${start}-${end}`,
      bytes,
    });

    if (i > 0 && i % 4 === 0) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  return out;
}

/** Splits each page into its own PDF. Used for "una página por archivo" mode. */
export async function splitPdfByPage(
  sourceBytes: ArrayBuffer,
): Promise<SplitChunk[]> {
  const source = await PDFDocument.load(sourceBytes, { updateMetadata: false });
  const count = source.getPageCount();
  const out: SplitChunk[] = [];
  for (let i = 0; i < count; i++) {
    const newDoc = await PDFDocument.create();
    const [page] = await newDoc.copyPages(source, [i]);
    newDoc.addPage(page);
    const bytes = await newDoc.save({ useObjectStreams: true });
    out.push({ label: `${i + 1}`, bytes });
    if (i > 0 && i % 10 === 0) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }
  return out;
}
