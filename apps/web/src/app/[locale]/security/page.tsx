import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Seguridad",
  description:
    "Cómo está construido CeroPDF para garantizar el procesamiento local: arquitectura, CSP, código abierto.",
  alternates: { canonical: "/security" },
};

export default function SecurityPage() {
  return (
    <LegalPageShell
      title="Seguridad"
      subtitle="Cómo está hecho CeroPDF y por qué puedes auditarlo tú mismo."
    >
      <section>
        <h2>Modelo de amenaza</h2>
        <p>
          CeroPDF asume que tu navegador es seguro y que tu equipo es de
          confianza. La promesa principal es que el contenido de tus PDFs
          no abandona tu dispositivo para las operaciones cliente, y que
          cuando una operación necesita servidor lo hace con consentimiento
          explícito y con borrado inmediato.
        </p>
      </section>

      <section>
        <h2>Arquitectura</h2>
        <ul>
          <li>
            <strong>Procesamiento principal en navegador:</strong> los PDFs
            se manipulan con <code>pdf-lib</code> y se renderizan con{" "}
            <code>pdfjs-dist</code>. Todo el código vive en tu pestaña.
          </li>
          <li>
            <strong>Worker del propio origen:</strong> el worker de pdf.js
            se sirve desde el mismo dominio (<code>/pdf.worker.min.mjs</code>).
            No hay fetch a CDNs ajenos.
          </li>
          <li>
            <strong>Almacenamiento local:</strong> archivos pequeños viven
            en memoria; los grandes se mueven al sandbox{" "}
            <code>OPFS</code> del navegador. Nada sale de tu equipo.
          </li>
          <li>
            <strong>Sin cookies, sin localStorage de contenido,</strong> sin
            persistencia entre sesiones de tus archivos.
          </li>
        </ul>
      </section>

      <section>
        <h2>Cabeceras y políticas</h2>
        <ul>
          <li>
            <strong>Content-Security-Policy</strong> estricta en producción:{" "}
            <code>default-src &apos;self&apos;</code>,{" "}
            <code>connect-src &apos;self&apos;</code> (no se permiten
            llamadas a terceros), <code>worker-src &apos;self&apos; blob:</code>
            {" "}para el worker de pdf.js, <code>object-src &apos;none&apos;</code>,
            {" "}<code>frame-ancestors &apos;none&apos;</code>.
          </li>
          <li>
            <strong>Strict-Transport-Security</strong> con preload.
          </li>
          <li>
            <strong>Permissions-Policy</strong> deshabilita cámara, micrófono
            y geolocalización.
          </li>
          <li>
            <strong>X-Frame-Options: DENY</strong> y{" "}
            <strong>X-Content-Type-Options: nosniff</strong>.
          </li>
        </ul>
      </section>

      <section>
        <h2>Operaciones que tocan servidor (opt-in)</h2>
        <p>
          Cuando una herramienta requiere binarios nativos (por ejemplo,
          compresión real con Ghostscript o desbloqueo con qpdf), el flujo es:
        </p>
        <ul>
          <li>
            Banner de consentimiento explícito antes de la primera subida.
          </li>
          <li>
            Subida directa al servidor temporal de CeroPDF (no hay
            intermediarios tipo S3 o Cloudflare R2).
          </li>
          <li>
            Procesamiento en un contenedor aislado con red interna
            únicamente. El servicio no es accesible públicamente.
          </li>
          <li>
            Borrado tras descarga: el cliente envía ACK y el servidor elimina
            input y output al instante. Si no llega ACK, una tarea programada
            borra el archivo antes de los 60 minutos.
          </li>
          <li>
            Los logs no almacenan contenido, nombres de archivo ni IP
            completa.
          </li>
        </ul>
      </section>

      <section>
        <h2>Código fuente</h2>
        <p>
          Todo el código de CeroPDF está disponible en{" "}
          <a
            href="https://github.com/gustavorh"
            className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          >
            github.com/gustavorh
          </a>
          . Puedes auditar las dependencias, la configuración CSP, los
          headers de seguridad y los Dockerfiles del contenedor opcional de
          procesamiento.
        </p>
      </section>

      <section>
        <h2>Lo que CeroPDF no garantiza</h2>
        <ul>
          <li>
            No protege contra malware en tu equipo. Si tu navegador o sistema
            está comprometido, no podemos evitar la fuga.
          </li>
          <li>
            No es un servicio gestionado con SLA. Es un proyecto gratuito de
            portfolio.
          </li>
          <li>
            No reemplaza herramientas profesionales para cumplir requisitos
            regulatorios específicos (HIPAA, FedRAMP, etc.).
          </li>
        </ul>
      </section>
    </LegalPageShell>
  );
}
