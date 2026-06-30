import { describe, expect, it } from "vitest";

import { cropToDisplay, displayToCrop } from "./crop-coords";

describe("crop-coords", () => {
  it("displayToCrop flips Y (top-left → bottom-left)", () => {
    expect(displayToCrop({ x: 0.1, y: 0.2, w: 0.5, h: 0.3 })).toEqual({
      x: 0.1,
      y: 0.5, // 1 - 0.2 - 0.3
      width: 0.5,
      height: 0.3,
    });
  });

  it("round-trips through cropToDisplay", () => {
    const d = { x: 0.1, y: 0.2, w: 0.5, h: 0.3 };
    expect(cropToDisplay(displayToCrop(d))).toEqual(d);
  });

  it("enforces a minimum size", () => {
    const c = displayToCrop({ x: 0.5, y: 0.5, w: 0.001, h: 0.001 });
    expect(c.width).toBe(0.02);
    expect(c.height).toBe(0.02);
  });
});
