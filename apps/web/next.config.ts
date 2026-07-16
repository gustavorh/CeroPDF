import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * CSP tuned for CeroPDF: same-origin app + pdf.js blob workers/canvas, no remote exfil.
 * Applied only when NODE_ENV=production (Next `next build` / `next start`).
 *
 * If self-hosted Plausible is configured (NEXT_PUBLIC_PLAUSIBLE_SRC), its exact origin
 * — and only that host — is allowlisted for script + beacon, per the "host-by-host, no
 * glob" rule. Without it, analytics would be silently blocked by the 'self'-only policy.
 */
function plausibleOrigin(): string {
  const src = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC;
  if (!src) return "";
  try {
    return new URL(src).origin;
  } catch {
    return "";
  }
}

function buildProductionCsp(): string {
  const analytics = plausibleOrigin();
  const scriptSrc = ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:", analytics]
    .filter(Boolean)
    .join(" ");
  const connectSrc = ["'self'", "blob:", "data:", analytics].filter(Boolean).join(" ");
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@ceropdf/pdf-core", "@ceropdf/pdf-render", "@ceropdf/ui"],
  async headers() {
    const base: { key: string; value: string }[] = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];

    if (process.env.NODE_ENV === "production") {
      base.push(
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        { key: "Content-Security-Policy", value: buildProductionCsp() },
      );
    }

    return [{ source: "/:path*", headers: base }];
  },
};

export default withNextIntl(nextConfig);
