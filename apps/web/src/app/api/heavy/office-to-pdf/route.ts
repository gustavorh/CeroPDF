import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEAVY_API_URL = process.env.HEAVY_API_URL;
const VALID_EXTS = new Set([
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

/**
 * Thin proxy to the heavy sidecar's LibreOffice converter. Keeps the heavy
 * service unreachable from the public internet — only the web container can dial
 * it via the internal Docker network.
 */
export async function POST(req: NextRequest) {
  if (!HEAVY_API_URL) {
    return NextResponse.json({ error: "office_disabled" }, { status: 503 });
  }

  const ext = (req.nextUrl.searchParams.get("ext") ?? "").toLowerCase();
  if (!VALID_EXTS.has(ext)) {
    return NextResponse.json({ error: "invalid_ext" }, { status: 400 });
  }

  if (!req.body) {
    return NextResponse.json({ error: "missing_body" }, { status: 400 });
  }

  const upstream = await fetch(
    `${HEAVY_API_URL}/office-to-pdf?ext=${encodeURIComponent(ext)}`,
    {
      method: "POST",
      // @ts-expect-error — Node's undici accepts a ReadableStream body via duplex: 'half'.
      duplex: "half",
      body: req.body,
      headers: {
        "Content-Type": "application/octet-stream",
        ...(req.headers.get("content-length")
          ? { "Content-Length": req.headers.get("content-length") as string }
          : {}),
      },
    },
  );

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return new NextResponse(text || JSON.stringify({ error: "upstream" }), {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        upstream.headers.get("content-disposition") ??
        `attachment; filename="converted.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
