import { describe, expect, it } from "vitest";

import { readDocumentBytes } from "../storage/types";

describe("readDocumentBytes", () => {
  it("returns the buffer for in-memory backings", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    const out = await readDocumentBytes({ kind: "memory", bytes });
    expect(new Uint8Array(out)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });
});
