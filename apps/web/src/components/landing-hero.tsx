import { getTranslations } from "next-intl/server";

/** Hero del estado vacío en la home: tagline + chip de privacidad. Sin call-to-action de upload (el upload vive dentro de cada herramienta). */
export async function LandingHero() {
  const t = await getTranslations("hero");

  return (
    <section
      className="mx-auto w-full max-w-6xl px-4 pb-10 pt-10 sm:px-6 sm:pb-12 sm:pt-16"
      aria-label="Welcome"
    >
      <div className="flex flex-col items-start gap-5 sm:items-center sm:text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-trust">
          <span className="h-1.5 w-1.5 rounded-full bg-trust" aria-hidden />
          {t("chip")}
        </span>
        <h1 className="text-display-lg max-w-3xl text-balance text-foreground">
          {t("title")}
        </h1>
        <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t("subtitle")}
        </p>
      </div>
    </section>
  );
}
