import Script from "next/script";

/**
 * Privacy-first analytics. Only mounts when both env vars are set:
 *   NEXT_PUBLIC_PLAUSIBLE_DOMAIN  → the domain registered in Plausible (e.g. "ceropdf.example.com")
 *   NEXT_PUBLIC_PLAUSIBLE_SRC     → the Plausible script URL (e.g. "https://plausible.example.com/js/script.js")
 *
 * Self-hosted Plausible is recommended (Docker compose template referenced in CLAUDE.md).
 * No cookies, no PII; events are anonymous by design.
 */
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const src = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC;
  if (!domain || !src) return null;

  return (
    <Script
      defer
      strategy="afterInteractive"
      data-domain={domain}
      src={src}
    />
  );
}
