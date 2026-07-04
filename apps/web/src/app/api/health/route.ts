import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness probe. Target of the compose healthcheck and the deploy smoke test
 * (curl through the Caddy gateway). Intentionally does no work — a 200 means the
 * Next server is up and serving.
 */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
