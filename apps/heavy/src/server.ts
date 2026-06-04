import { serve } from "@hono/node-server";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Hono } from "hono";

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT ?? 3001);
const MAX_REQUEST_BYTES = Number(
  process.env.MAX_REQUEST_BYTES ?? 250 * 1024 * 1024,
);
const COMMAND_TIMEOUT_MS = Number(process.env.COMMAND_TIMEOUT_MS ?? 90_000);
// LibreOffice is slower to cold-start (it builds a user profile on first run).
const OFFICE_TIMEOUT_MS = Number(process.env.OFFICE_TIMEOUT_MS ?? 120_000);
// Max age for scratch artifacts. Backs the "deleted within 60 min" promise even
// if a job's own cleanup never runs (process killed mid-job, OOM, restart).
const SCRATCH_TTL_MS = Number(process.env.SCRATCH_TTL_MS ?? 60 * 60 * 1000);
const SCRATCH_DIR = join(tmpdir(), "ceropdf-heavy");

// Input formats LibreOffice can convert to PDF.
const OFFICE_EXTS = new Set([
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
  "rtf",
  "txt",
  "csv",
]);

await mkdir(SCRATCH_DIR, { recursive: true });

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "ceropdf-heavy" }));

function logEvent(event: string, data: Record<string, unknown>): void {
  // Structured stdout log. No file content, no full IPs.
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }));
}

async function withScratch<T>(
  prefix: string,
  fn: (paths: { inPath: string; outPath: string; jobId: string }) => Promise<T>,
): Promise<T> {
  const jobId = randomUUID();
  const inPath = join(SCRATCH_DIR, `${prefix}-${jobId}-in.pdf`);
  const outPath = join(SCRATCH_DIR, `${prefix}-${jobId}-out.pdf`);
  try {
    return await fn({ inPath, outPath, jobId });
  } finally {
    await rm(inPath, { force: true }).catch(() => {});
    await rm(outPath, { force: true }).catch(() => {});
  }
}

async function readRequestBytes(req: Request): Promise<ArrayBuffer | null> {
  const lengthHeader = req.headers.get("content-length");
  if (lengthHeader) {
    const length = Number(lengthHeader);
    if (Number.isFinite(length) && length > MAX_REQUEST_BYTES) return null;
  }
  const buf = await req.arrayBuffer();
  if (buf.byteLength > MAX_REQUEST_BYTES) return null;
  return buf;
}

function pdfResponse(bytes: Uint8Array, downloadName: string): Response {
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Real PDF compression via Ghostscript. The `quality` query param maps to Ghostscript's
 * dPDFSETTINGS preset (screen | ebook | printer | prepress). Default `ebook`.
 */
app.post("/compress", async (c) => {
  const quality = (c.req.query("quality") ?? "ebook").toLowerCase();
  if (!["screen", "ebook", "printer", "prepress"].includes(quality)) {
    return c.json({ error: "invalid_quality" }, 400);
  }

  const bytes = await readRequestBytes(c.req.raw);
  if (!bytes) return c.json({ error: "payload_too_large" }, 413);

  return await withScratch("compress", async ({ inPath, outPath, jobId }) => {
    await writeFile(inPath, new Uint8Array(bytes));
    const startedAt = Date.now();
    try {
      await execFileAsync(
        "gs",
        [
          "-sDEVICE=pdfwrite",
          "-dCompatibilityLevel=1.5",
          `-dPDFSETTINGS=/${quality}`,
          "-dNOPAUSE",
          "-dBATCH",
          "-dQUIET",
          `-sOutputFile=${outPath}`,
          inPath,
        ],
        { timeout: COMMAND_TIMEOUT_MS },
      );
      const out = await readFile(outPath);
      logEvent("compress_ok", {
        jobId,
        quality,
        inBytes: bytes.byteLength,
        outBytes: out.byteLength,
        durationMs: Date.now() - startedAt,
      });
      return pdfResponse(out, `compressed-${quality}.pdf`);
    } catch (err) {
      logEvent("compress_fail", {
        jobId,
        quality,
        inBytes: bytes.byteLength,
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json({ error: "compression_failed" }, 500);
    }
  });
});

/**
 * Removes the password of an encrypted PDF using qpdf. Caller passes the password via
 * the `X-Pdf-Password` header (URL-safe, server never logs it).
 */
app.post("/unlock", async (c) => {
  const password = c.req.header("X-Pdf-Password") ?? "";
  if (!password) return c.json({ error: "missing_password" }, 400);

  const bytes = await readRequestBytes(c.req.raw);
  if (!bytes) return c.json({ error: "payload_too_large" }, 413);

  return await withScratch("unlock", async ({ inPath, outPath, jobId }) => {
    await writeFile(inPath, new Uint8Array(bytes));
    const startedAt = Date.now();
    try {
      await execFileAsync(
        "qpdf",
        [`--password=${password}`, "--decrypt", inPath, outPath],
        { timeout: COMMAND_TIMEOUT_MS },
      );
      const out = await readFile(outPath);
      logEvent("unlock_ok", {
        jobId,
        inBytes: bytes.byteLength,
        outBytes: out.byteLength,
        durationMs: Date.now() - startedAt,
      });
      return pdfResponse(out, "unlocked.pdf");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isPasswordError = /invalid password/i.test(message);
      logEvent("unlock_fail", {
        jobId,
        inBytes: bytes.byteLength,
        durationMs: Date.now() - startedAt,
        reason: isPasswordError ? "invalid_password" : "other",
      });
      return c.json(
        { error: isPasswordError ? "invalid_password" : "unlock_failed" },
        isPasswordError ? 401 : 500,
      );
    }
  });
});

/**
 * Converts an Office/OpenDocument file to PDF using headless LibreOffice. The
 * original extension is passed via the `ext` query so the temp input is named
 * correctly (soffice infers the source format from the extension). Each job gets
 * its own temp dir and an isolated `UserInstallation` profile to avoid the
 * single-profile lock when conversions run concurrently.
 */
app.post("/office-to-pdf", async (c) => {
  const ext = (c.req.query("ext") ?? "").toLowerCase();
  if (!OFFICE_EXTS.has(ext)) return c.json({ error: "invalid_ext" }, 400);

  const bytes = await readRequestBytes(c.req.raw);
  if (!bytes) return c.json({ error: "payload_too_large" }, 413);

  const jobId = randomUUID();
  const workDir = await mkdtemp(join(SCRATCH_DIR, "office-"));
  const profileDir = join(workDir, "profile");
  const inPath = join(workDir, `input.${ext}`);
  const outPath = join(workDir, "input.pdf");
  const startedAt = Date.now();

  try {
    await writeFile(inPath, new Uint8Array(bytes));
    await execFileAsync(
      "soffice",
      [
        "--headless",
        "--nologo",
        "--nofirststartwizard",
        `-env:UserInstallation=file://${profileDir}`,
        "--convert-to",
        "pdf",
        "--outdir",
        workDir,
        inPath,
      ],
      { timeout: OFFICE_TIMEOUT_MS },
    );
    const out = await readFile(outPath);
    logEvent("office_ok", {
      jobId,
      ext,
      inBytes: bytes.byteLength,
      outBytes: out.byteLength,
      durationMs: Date.now() - startedAt,
    });
    return pdfResponse(out, "converted.pdf");
  } catch (err) {
    logEvent("office_fail", {
      jobId,
      ext,
      inBytes: bytes.byteLength,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "conversion_failed" }, 500);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
});

/**
 * Time-based reaper: per-job `finally` blocks delete artifacts on the happy path,
 * but a killed/restarted process can orphan them. This sweeps anything in
 * SCRATCH_DIR older than the TTL so the "deleted within 60 min" promise holds.
 */
async function reapScratch(): Promise<void> {
  const now = Date.now();
  let entries: string[];
  try {
    entries = await readdir(SCRATCH_DIR);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(SCRATCH_DIR, name);
    try {
      const info = await stat(full);
      if (now - info.mtimeMs > SCRATCH_TTL_MS) {
        await rm(full, { recursive: true, force: true });
        logEvent("scratch_reaped", { name });
      }
    } catch {
      // entry vanished mid-sweep — ignore.
    }
  }
}

await reapScratch();
setInterval(() => {
  void reapScratch();
}, 10 * 60 * 1000).unref();

serve({ fetch: app.fetch, port: PORT, hostname: "0.0.0.0" }, (info) => {
  logEvent("listening", {
    port: info.port,
    address: info.address,
    family: info.family,
  });
});
