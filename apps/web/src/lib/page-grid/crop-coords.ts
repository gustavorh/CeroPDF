import type { CropRect } from "@ceropdf/pdf-core";

export type DisplayRect = { x: number; y: number; w: number; h: number };

const MIN = 0.02;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Display rect (top-left origin, 0–1) → CropRect (bottom-left origin, 0–1). */
export function displayToCrop(r: DisplayRect): CropRect {
  const width = clamp(r.w, MIN, 1);
  const height = clamp(r.h, MIN, 1);
  const x = clamp(r.x, 0, 1 - width);
  const yTop = clamp(r.y, 0, 1 - height);
  return { x, y: 1 - yTop - height, width, height };
}

/** CropRect (bottom-left) → display rect (top-left). */
export function cropToDisplay(c: CropRect): DisplayRect {
  return { x: c.x, y: 1 - c.y - c.height, w: c.width, h: c.height };
}
