"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ServerConsentBannerProps = {
  toolKey: string;
  /** Short label for the tool, e.g. "Comprimir PDF". */
  toolLabel: string;
  /** Children render only after consent is granted. */
  children: React.ReactNode;
};

const STORAGE_KEY_PREFIX = "ceropdf:server-consent:";

/**
 * Blocks server-side tools behind an explicit opt-in. Decision is persisted per-tool in
 * localStorage so the banner shows once and never blocks experienced users.
 */
export function ServerConsentBanner({
  toolKey,
  toolLabel,
  children,
}: ServerConsentBannerProps) {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + toolKey);
      setGranted(raw === "1");
    } catch {
      setGranted(false);
    }
  }, [toolKey]);

  if (granted === null) return null;
  if (granted) return <>{children}</>;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-10 sm:px-6 sm:pt-14">
      <div className="rounded-xl border border-warning/40 bg-surface-container/90 p-5 sm:p-6">
        <h2 className="text-headline-md text-balance text-foreground">
          “{toolLabel}” necesita un servidor temporal
        </h2>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Esta herramienta usa binarios (Ghostscript, LibreOffice) que no corren en el
          navegador. Tu PDF se sube a un contenedor interno de CeroPDF que{" "}
          <strong className="text-foreground">no es público</strong> y se elimina
          en cuanto descargas el resultado. No queda traza en logs.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>El servidor procesa, devuelve el archivo, lo borra.</li>
          <li>Sin cuentas, sin cookies, sin nombre de archivo en logs.</li>
          <li>Si no descargas en 60 minutos, una tarea lo borra igual.</li>
        </ul>
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          Más detalle en{" "}
          <Link
            href="/security"
            className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          >
            /security
          </Link>
          .
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              try {
                window.localStorage.setItem(STORAGE_KEY_PREFIX + toolKey, "1");
              } catch {
                // ignore — fall back to in-memory consent
              }
              setGranted(true);
            }}
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-gradient-to-b from-primary to-primary-gradient px-5 text-sm font-semibold text-primary-foreground transition hover:from-primary-hover hover:to-primary-gradient-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Entiendo, continuar
          </button>
          <Link
            href="/"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-outline-variant/45 bg-surface-container-low px-4 text-sm text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Volver a la portada
          </Link>
        </div>
      </div>
    </div>
  );
}
