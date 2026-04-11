/** Pie visual compacto (Hook): cabe en viewport pequeño sin scroll con el dropzone masivo. */
export function LandingFooterCopy() {
  return (
    <footer className="relative z-10 shrink-0 px-4 pb-4 pt-2 text-center sm:px-6 sm:pb-5">
      <p className="text-pretty text-sm leading-snug text-muted-foreground sm:text-base">
        <span className="text-foreground">
          Tus PDFs, tu equipo. Sin subidas a la nube.
        </span>{" "}
        Une y optimiza en segundos, gratis y sin cuenta.
      </p>
    </footer>
  );
}
