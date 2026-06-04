import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacidad",
  description:
    "Cómo CeroPDF procesa tus PDFs: 100 % en tu dispositivo por defecto. Sin cuentas, sin servidores, sin huella.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacidad"
      subtitle="Qué hace CeroPDF con tus archivos y qué no. Concretos, sin marketing."
    >
      <section>
        <h2>Resumen en una línea</h2>
        <p>
          Por defecto, tus PDFs no salen de tu navegador. CeroPDF abre, procesa
          y exporta los archivos directamente en tu dispositivo.
        </p>
      </section>

      <section>
        <h2>Qué datos manejamos</h2>
        <ul>
          <li>
            <strong>Contenido de tus PDFs:</strong> nunca se sube a un servidor
            para las operaciones marcadas como <code>client-side</code> (unir,
            ordenar, rotar, optimizar metadatos). Las páginas se renderizan
            usando <code>pdfjs-dist</code> en tu navegador y el PDF final se
            genera con <code>pdf-lib</code> en memoria.
          </li>
          <li>
            <strong>Almacenamiento temporal:</strong> archivos grandes
            (&gt; 20 MB) usan el sandbox local <code>OPFS</code> (Origin
            Private File System) para no saturar la RAM. Es una zona privada
            que el navegador gestiona; nada visible para otros sitios ni para
            el sistema operativo.
          </li>
          <li>
            <strong>Cookies:</strong> ninguna. No usamos cookies para
            identificarte ni para rastreo.
          </li>
          <li>
            <strong>Cuentas:</strong> no hay registro ni login. No tenemos
            forma de saber quién eres.
          </li>
        </ul>
      </section>

      <section>
        <h2>Herramientas que sí necesitan servidor</h2>
        <p>
          Algunas operaciones requieren binarios que solo funcionan en
          servidor (por ejemplo, compresión avanzada con Ghostscript o
          conversión a Word). En esos casos:
        </p>
        <ul>
          <li>
            Verás un <strong>banner explícito</strong> antes de subir nada,
            con un botón para aceptar.
          </li>
          <li>
            El archivo se sube a un servidor temporal alojado en la misma
            infraestructura de CeroPDF (sin terceros tipo S3 o Google Cloud).
          </li>
          <li>
            El archivo se procesa y se <strong>elimina inmediatamente</strong>
            {" "}tras la descarga del resultado. Si por cualquier motivo no se
            descarga, una tarea programada lo borra antes de los 60 minutos.
          </li>
          <li>
            Los logs del servidor no guardan contenido, nombre de archivo ni
            IP completa (truncada a /24).
          </li>
        </ul>
        <p>
          Si no usas estas herramientas server-side, nada de tu PDF llega a
          nuestros servidores. Es opt-in puro.
        </p>
      </section>

      <section>
        <h2>Analítica</h2>
        <p>
          Si el operador del sitio activa analítica (variable de entorno
          <code> NEXT_PUBLIC_PLAUSIBLE_DOMAIN</code>), se registran eventos
          anónimos sin cookies tipo &ldquo;herramienta abierta&rdquo;,
          &ldquo;exportación exitosa&rdquo; o &ldquo;error&rdquo;. En ningún
          caso se registra contenido, nombres de archivo ni tamaños exactos.
          Si la variable no está configurada, no hay analítica en absoluto.
        </p>
      </section>

      <section>
        <h2>Contacto</h2>
        <p>
          ¿Dudas o quieres reportar algo?{" "}
          <a
            href="https://github.com/gustavorh"
            className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          >
            @gustavorh
          </a>{" "}
          en GitHub.
        </p>
      </section>
    </LegalPageShell>
  );
}
