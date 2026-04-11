const benefits = [
  {
    title: "Gratis de verdad",
    body: "Herramienta gratuita para unir, dividir y comprimir PDFs. Sin tarjeta ni trucos: empieza cuando quieras.",
    Icon: IconGift,
  },
  {
    title: "100% en tu navegador",
    body: "El procesamiento ocurre en tu dispositivo. Tus archivos no se envían a servidores para manipularse.",
    Icon: IconShield,
  },
  {
    title: "Rápido y directo",
    body: "Sin colas en la nube ni esperas de subida. Ideal para documentos grandes dentro de los límites del navegador.",
    Icon: IconZap,
  },
  {
    title: "Sin compromiso",
    body: "No hace falta instalar nada ni crear cuenta. Prueba en segundos y cierra la pestaña cuando termines.",
    Icon: IconSparkle,
  },
] as const;

export function WhyLocalPdfSection() {
  return (
    <section
      className="mt-14 w-full pb-8 sm:mt-16 sm:pb-12"
      aria-labelledby="why-localpdf-heading"
    >
      <div className="border-t border-border-subtle pt-10 sm:pt-12">
        <h3
          id="why-localpdf-heading"
          className="text-center text-lg font-semibold tracking-tight text-foreground sm:text-xl"
        >
          Por qué elegir LocalPDF
        </h3>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
          Pensado para quien valora la privacidad y quiere resultados sin
          fricción: control total sobre tus documentos, con un flujo claro desde
          el primer uso.
        </p>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map(({ title, body, Icon }) => (
            <li
              key={title}
              className="flex flex-col rounded-xl border border-border bg-card/50 p-5 transition-colors hover:border-border-subtle hover:bg-card/80"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-trust-border bg-trust-muted text-trust">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h4 className="mt-4 text-sm font-semibold text-foreground">
                {title}
              </h4>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function IconGift({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 12v10H4V12" />
      <path d="M22 7H2v5h20V7z" />
      <path d="M12 22V7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconZap({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function IconSparkle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12 3-1.9 5.8-6.1.1 4.9 3.6-1.9 5.9 4.9-3.7 4.9 3.7-1.9-5.9 4.9-3.6-6.1.1L12 3z" />
    </svg>
  );
}
