import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEAVY_API_URL = process.env.HEAVY_API_URL;
const VALID_QUALITIES = new Set(["screen", "ebook", "printer", "prepress"]);

/**
 * Thin proxy to the heavy sidecar. Keeps the heavy service unreachable from the public
 * internet — only the web container can dial it via the internal Docker network.
 */
export async function POST(req: NextRequest) {
  if (!HEAVY_API_URL) {
    return NextResponse.json(
      { error: "compress_disabled" },
      { status: 503 },
    );
  }

  const quality = req.nextUrl.searchParams.get("quality") ?? "ebook";
  if (!VALID_QUALITIES.has(quality)) {
    return NextResponse.json({ error: "invalid_quality" }, { status: 400 });
  }

  if (!req.body) {
    return NextResponse.json({ error: "missing_body" }, { status: 400 });
  }

  const upstream = await fetch(
    `${HEAVY_API_URL}/compress?quality=${encodeURIComponent(quality)}`,
    {
      method: "POST",
      // @ts-expect-error — Node's undici accepts a ReadableStream body via duplex: 'half'.
      duplex: "half",
      body: req.body,
      headers: {
        "Content-Type": "application/pdf",
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
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        upstream.headers.get("content-disposition") ??
        `attachment; filename="compressed-${quality}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
