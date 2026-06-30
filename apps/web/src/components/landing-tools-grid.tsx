import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

type ToolKey =
  | "merge"
  | "split"
  | "edit"
  | "rotate"
  | "organize"
  | "extract"
  | "compress"
  | "officeToPdf"
  | "mediaConvert"
  | "imageConvert";

type ToolEntry = {
  /** i18n message key under `tools.<key>`. */
  key: ToolKey;
  /** Route slug; absent for coming-soon tools. */
  slug?: string;
  status: "available" | "coming_soon";
  glyph: React.ReactNode;
};

function GlyphMerge() {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="9" height="12" rx="1.5" />
      <rect x="16" y="4" width="9" height="12" rx="1.5" />
      <path d="M7.5 19v3a1 1 0 0 0 1 1H19.5a1 1 0 0 0 1-1v-3" />
      <path d="M14 23v-9" />
      <path d="M11 17l3 3 3-3" />
    </svg>
  );
}

function GlyphSplit() {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="10" y="3" width="9" height="12" rx="1.5" />
      <path d="M14.5 15v2" />
      <path d="M11 19l3.5-2 3.5 2" />
      <rect x="3" y="18" width="9" height="7" rx="1.5" />
      <rect x="17" y="18" width="9" height="7" rx="1.5" />
    </svg>
  );
}

function GlyphExtract() {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="4" width="14" height="18" rx="1.5" />
      <path d="M7.5 9.5h7" />
      <path d="M7.5 13h7" />
      <path d="M7.5 16.5h4" />
      <path d="M19 14l5 0" />
      <path d="M22 11l3 3-3 3" />
    </svg>
  );
}

function GlyphCompress() {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 8l4-4 4 4" />
      <path d="M8 4v9" />
      <path d="M24 20l-4 4-4-4" />
      <path d="M20 24v-9" />
      <path d="M4 14h20" />
    </svg>
  );
}

function GlyphImage() {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="22" height="18" rx="2" />
      <circle cx="9.5" cy="11" r="1.6" />
      <path d="M4 22l6.5-7 5 5 3.5-3 5 5" />
    </svg>
  );
}

function GlyphOffice() {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 3h10l6 6v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M15 3v6h6" />
      <path d="M8.5 14l2.5 6 2.5-6" />
      <path d="M16 14l3.5 6M19.5 14L16 20" />
    </svg>
  );
}

function GlyphMedia() {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 18V8a2 2 0 0 1 2-2h7l3 3" />
      <path d="M9 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
      <path d="M11.5 18.5V9l9-2v9.5" />
      <path d="M18 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
    </svg>
  );
}

function GlyphEdit() {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="4" width="14" height="20" rx="1.5" />
      <path d="M7.5 9.5h7" />
      <path d="M7.5 13h7" />
      <path d="M19.5 6l4.5 4.5-8.5 8.5-5 1 1-5z" />
    </svg>
  );
}

function GlyphRotate() {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 14a9 9 0 1 1-2.64-6.36" />
      <path d="M23 4v5h-5" />
      <rect x="9" y="9" width="10" height="10" rx="1.5" />
    </svg>
  );
}

function GlyphOrganize() {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="5" width="8" height="18" rx="1.5" />
      <rect x="16" y="5" width="8" height="18" rx="1.5" />
      <path d="M14 11v6" />
      <path d="M11.5 13.5 14 11l2.5 2.5" />
    </svg>
  );
}

const TOOLS: ToolEntry[] = [
  { key: "merge", slug: "merge", status: "available", glyph: <GlyphMerge /> },
  { key: "split", slug: "split", status: "available", glyph: <GlyphSplit /> },
  { key: "edit", slug: "edit", status: "available", glyph: <GlyphEdit /> },
  { key: "rotate", slug: "rotate", status: "available", glyph: <GlyphRotate /> },
  { key: "organize", slug: "organize", status: "available", glyph: <GlyphOrganize /> },
  {
    key: "compress",
    slug: "compress",
    status: "available",
    glyph: <GlyphCompress />,
  },
  {
    key: "officeToPdf",
    slug: "office-to-pdf",
    status: "available",
    glyph: <GlyphOffice />,
  },
  {
    key: "mediaConvert",
    slug: "media",
    status: "available",
    glyph: <GlyphMedia />,
  },
  { key: "extract", status: "coming_soon", glyph: <GlyphExtract /> },
  { key: "imageConvert", status: "coming_soon", glyph: <GlyphImage /> },
];

export async function LandingToolsGrid() {
  const t = await getTranslations("tools");
  const tc = await getTranslations("common");

  return (
    <section
      className="mx-auto w-full max-w-6xl px-4 pb-16 pt-2 sm:px-6 sm:pb-20"
      aria-label={t("ariaLabel")}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {TOOLS.map((tool) => {
          const name = t(`${tool.key}.name`);
          const description = t(`${tool.key}.description`);

          if (tool.status === "available" && tool.slug) {
            return (
              <Link
                key={tool.key}
                href={`/${tool.slug}`}
                className="group flex h-full flex-col gap-4 rounded-xl border border-outline-variant/40 bg-surface-container/85 p-5 transition hover:-translate-y-0.5 hover:border-primary/55 hover:bg-surface-container hover:shadow-[0_24px_48px_-24px_var(--shadow-ambient)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary-muted text-primary transition group-hover:bg-primary-muted/80"
                    aria-hidden
                  >
                    <span className="h-6 w-6 sm:h-7 sm:w-7">{tool.glyph}</span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-trust">
                    {tc("available")}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-headline-md text-balance text-foreground">
                    {name}
                  </h3>
                  <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
                <p className="mt-auto font-mono text-xs text-primary transition group-hover:translate-x-0.5">
                  {tc("openTool")}
                </p>
              </Link>
            );
          }

          return (
            <div
              key={tool.key}
              className="flex h-full flex-col gap-4 rounded-xl border border-outline-variant/25 bg-surface-container-low/60 p-5 opacity-90 sm:p-6"
              aria-label={`${name} — ${tc("comingSoon")}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-surface-container-highest text-tertiary"
                  aria-hidden
                >
                  <span className="h-6 w-6 sm:h-7 sm:w-7">{tool.glyph}</span>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-tertiary">
                  {tc("comingSoon")}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-headline-md text-balance text-muted-foreground">
                  {name}
                </h3>
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground/85">
                  {description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
