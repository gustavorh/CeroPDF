type BrandMarkProps = {
  className?: string;
  "aria-hidden"?: boolean;
};

/** Marca compacta: documento + acento primary (header / superficies de marca). */
export function BrandMark({ className, ...props }: BrandMarkProps) {
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 shadow-sm shadow-primary/10 ${className ?? ""}`}
      {...props}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5 text-primary"
        aria-hidden
      >
        <path
          d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M14 2v6h6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M9 13h6M9 17h4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
