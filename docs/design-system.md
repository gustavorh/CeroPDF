# CeroPDF — Design system

**Audiencia:** diseño, desarrollo y agentes de IA que toquen UI en `apps/web`.  
**Producto:** herramienta **gratuita**, **local-first** y **profesional** para manipular PDFs en el navegador (sin subir archivos a servidores de procesamiento).

Este documento es la **única fuente de verdad** para principios, paleta, tokens, tipografía y patrones de interfaz. Complementa el tono del **PRD** (`PRD.md`): claro, tranquilizador y orientado a documentos sensibles.

---

## 1. Posicionamiento y nicho

| Pilar | Implicación visual |
|--------|---------------------|
| **Gratis (free-to-use)** | Comunicación clara con badges/etiquetas discretas; evitar aspecto “juguete” o saturación de color. |
| **Profesional / branded** | Jerarquía tipográfica fuerte, CTAs reconocibles, poca decoración innecesaria. |
| **Privacidad / local** | Color de **confianza** (verde esmeralda) para mensajes “100% local”, estados OK; calma y seguridad. |
| **Herramienta (no red social)** | Dark mode por defecto, densidad legible, datos técnicos en **monoespacio**; cuerpo en **sans** estable y neutral. |

El tono es **claro y tranquilizador**: la UI debe sentirse **controlada** y **predecible**.

---

## 2. North Star creativo: “The Digital Blueprint”

La identidad visual se aleja del brillo efímero tipo “AI-as-a-service” y apuesta por **permanencia, precisión y tacto**. La pantalla se interpreta como un **archivo de trabajo de estudio**: papel pesado, superficies mates y claridad de tinta.

- **Asimetría intencional:** titulares grandes anclados a la izquierda; controles funcionales en capas a la derecha. La jerarquía tipográfica contrasta titulares “quietos” masivos con **etiquetas** pequeñas y exactas (voz editorial / notación arquitectónica).
- **Materiales:** base **tinta** (carbón profundo), capas **papel** (contenedores que suben en luminosidad), acento **tierra** en CTAs de alta intención (terracota), sin neón ni gradientes chillones.
- **Superficies anidadas:** la importancia se lee por **cambio tonal** entre capas, no por cajas recortadas con bordes duros en cada sección.

Este north star coexiste con los pilares de producto de la tabla anterior: **gratis**, **local** y **herramienta** siguen gobernando copy y semántica (trust, éxito, error).

---

## 3. Principios de interfaz

1. **Legibilidad primero:** contraste suficiente en texto principal y secundario; límites y errores siempre entendibles.
2. **Una acción principal por vista:** la acción crítica (exportar, continuar) usa el token **primary** (marca / alto impacto); el verde **trust** no compite con el CTA principal.
3. **Feedback explícito:** carga, error y éxito usan colores **semánticos** (advertencia, error, éxito).
4. **Consistencia:** preferir tokens CSS (`--primary`, `--border`, etc.) y utilidades Tailwind mapeadas en `globals.css` antes de hex sueltos.
5. **Accesibilidad:** foco visible (`ring`), roles/labels en controles críticos, altura táctil razonable en CTAs (p. ej. ≥ 44px en móvil cuando aplique).
6. **Profundidad por tono, no por sombras pesadas:** priorizar saltos de superficie; sombras solo difusas y suaves cuando algo debe “flotar” (modales, menús).

---

## 4. Color: tinta, papel y tierra

### 4.1 Jerarquía de superficies (modelo mental)

Tratar la UI como capas físicas (cartulina / velo). El **fondo base** es la capa más oscura; los paneles y controles activos **suben** en luminosidad.

| Rol conceptual | Rol en implementación (objetivo) | Notas |
|------------------|----------------------------------|--------|
| **Base / tinta** | `background` | Carbón profundo; **no** usar negro puro (`#000000`). Implementado como `#111316` en `globals.css`. |
| **Superficie de trabajo** | `card`, paneles | Elevación respecto al fondo. |
| **Contenedor anidado bajo** | (token futuro: p. ej. `surface_container_low`) | Separar bloques por **cambio de fondo**, no por línea 1px. |
| **Contenedor anidado alto / foco** | (token futuro: p. ej. `surface_bright` / `surface_container_highest`) | Inputs en foco, zonas activas. |

**Regla “sin línea” para secciones:** no usar bordes de 1px opacos para delimitar regiones. Delimitar por **cambio de color de fondo** entre niveles de superficie (p. ej. de contenedor bajo a contenedor más claro). Si hace falta un borde por accesibilidad, usar **borde fantasma**: color tipo `outline_variant` a **~15% opacidad** (se percibe, no se impone).

**Velo / cristal:** overlays flotantes (navegación, modales de previsualización) pueden usar superficie semitransparente (~70% opacidad) + **backdrop-blur** (~20px) para sensación de “papel vitela”, manteniendo el tema mate.

**CTA primario:** puede llevar **gradiente lineal muy suave** de `primary` a un tono contenedor más oscuro (p. ej. terracota → terracota profundo) para sugerir luz sobre superficie mate — **sin** gradientes de alto brillo o neón.

### 4.2 Neutros (fondo y contenido) — tokens actuales

| Rol | Descripción | Uso |
|-----|-------------|-----|
| **background** | Carbón tinta (`#111316`) | Fondo de aplicación |
| **foreground** | Casi blanco | Texto principal |
| **card** | Capa papel sobre tinta | Paneles, tarjetas, cabeceras (ver también `surface-*` en `globals.css`) |
| **border** | Zinc medio | Bordes por defecto (preferir uso parco; ver regla “sin línea”) |
| **border-subtle** | Zinc más apagado | Separadores muy suaves |
| **muted-foreground** | Gris medio | Subtítulos, ayudas |
| **tertiary** | Gris apagado | Meta, hints secundarios (`text-tertiary`) |

Texto secundario de bajo brillo: preferir **`on_surface_variant`** conceptual (`muted-foreground` / `tertiary` según contexto) para mantener estética mate.

### 4.3 Marca — Primary (acción principal)

Marca **terracota / tierra** para CTAs de alta intención: tokens `--primary`, `--primary-hover`, `--primary-muted`, `--primary-container` en `globals.css` (referencia tonal: `#f0a88c` → contenedor `#8b4d3a` / gradientes suaves hacia tonos medianos).

| Token | Uso |
|--------|-----|
| **primary** | Botones principales, anillos de foco asociados a acción |
| **primary-hover** | Hover de CTAs |
| **primary-muted** | Fondos suaves (p. ej. dropzone activa) |

### 4.4 Confianza — Trust (esmeralda)

Refuerza **local**, **gratis sin truco** y **privacidad**.

| Token | Uso |
|--------|-----|
| **trust** | Badges “Gratis”, acentos de confianza |
| **trust-muted** / **trust-border** | Fondos y bordes de badges |

### 4.5 Semánticos

| Token | Significado |
|--------|-------------|
| **success** | Todo bien, estado listo |
| **warning** | Trabajo en curso / atención |
| **destructive** | Errores, eliminar, riesgo |

---

## 5. Tipografía

| Familia | Uso |
|---------|-----|
| **Sans — Public Sans** | Tipografía de producto: cargada con `next/font/google` en `apps/web/src/app/layout.tsx` y referenciada en `globals.css` como `--font-public-sans`. |
| **Mono** | Tamaños de archivo, límites (MB), estados técnicos, badges pequeños “de herramienta”. |

**Escala editorial (objetivo):**

- **Display / titulares:** `display-lg` / `headline-md` — impacto; tracking algo ajustado (p. ej. **-0.02em**) para bloque compacto y profesional.
- **Cuerpo:** `body-lg` — interlineado holgado para que el “tinta sobre papel” respire.
- **Etiqueta archivística:** `label-md` / `label-sm` — metadatos (tamaño, fechas); **mayúsculas** con tracking ligeramente positivo (p. ej. **+0.05em**), estilo notación/plano.

Regla práctica: si el dato es **medición o límite**, va en **mono**; si es **frase para humanos**, va en **sans**.

---

## 6. Forma, espacio y elevación

**Radios:** dirección blueprint — **`md` (~0.375rem)** en contenedores principales; **`sm` (~0.125rem)** en chips y elementos pequeños (precisión “arquitectónica”, no burbuja). La implementación actual puede usar `rounded-lg` / `rounded-xl` como equivalentes cercanos hasta unificar nombres.

**Espaciado:** ritmo **4/8** (Tailwind); listas sin divisores: separar ítems con **8px–12px** de espacio vertical o alternancia **tonal** entre filas (sin líneas entre filas salvo alineación del texto).

**Layout:** secciones con `max-w-6xl` y márgenes horizontales generosos en desktop; **márgenes asimétricos** permitidos para sensación editorial.

**Elevación:**

- **Capas tonales:** tarjeta `surface` más baja sobre sección un poco más clara — la profundidad se lee por valor, no por sombra gruesa.
- **Sombras ambientales** (solo si algo debe flotar: modal, menú contextual): difusas, **blur 40px–60px**, opacidad baja (~**6%**), color derivado del tono de texto/superficie (**no** negro puro).
- **Borde fantasma** en inputs cuando haga falta: en foco, transición de fondo a superficie más clara + borde **1px** con **primary ~40% opacidad** en lugar de caja gruesa permanente.

---

## 7. Componentes (patrones)

| Patrón | Comportamiento |
|--------|----------------|
| **Primary button** | Fondo `primary`, texto `primary-foreground` (o `on_primary` cuando exista token); radio `md`; sin sombra por defecto. |
| **Secondary** | Fondo `secondary_container` (o equivalente en tokens); texto sobre contenedor secundario — añadir en `globals.css` si el producto lo requiere. |
| **Tertiary** | Sin fondo; texto `primary`; foco: fondo fantasma `surface_variant`. |
| **Input** | Fondo tipo contenedor alto; sin borde pesado; en foco: fondo más claro + borde fantasma primary. |
| **Chips / metadatos PDF** | Contenedor terciario pequeño; tipografía `label-sm`. |
| **Listas y tarjetas** | **Sin divisores por defecto**; separación por espacio o tono alterno. |
| **Inspector** | Panel lateral alineado a la derecha, superficie ligeramente distinta al lienzo (jerarquía de capas). |
| **Overlay “vitela”** | Modal de previsualización: superficie semitransparente + `backdrop-blur`. |

---

## 8. Implementación técnica

- **Fuente de tokens en código:** `apps/web/src/app/globals.css` (`:root` + `@theme inline` para Tailwind v4). Cualquier token nuevo del blueprint (superficies anidadas, `on_surface_variant`, primary terracota) debe **añadirse allí** y reflejarse en esta sección.
- **Layout raíz:** `apps/web/src/app/layout.tsx` — `bg-background`, `font-sans`, `text-foreground` en `<body>`.
- **Selección de texto:** `::selection` en `globals.css` usa `primary-muted` + `foreground`.
- **Uso en componentes** (ejemplos):

  - `bg-background`, `text-foreground`, `border-border`
  - `bg-primary`, `text-primary-foreground`, `hover:bg-primary-hover`
  - `text-muted-foreground`, `text-tertiary`, `border-trust/30`, `bg-trust/10`, `text-trust`
  - `bg-destructive/10`, `text-destructive`, `border-destructive/30`
  - `ring-ring` / `focus-visible:ring-ring` para foco

No dupliques hex en componentes si ya hay token equivalente.

---

## 9. Qué evitar

- Tema claro por defecto (el PRD pide dark mode por defecto).
- **Negro puro** como fondo de app; **bordes 100% opacos** para encajar secciones (rompen el flujo tipo plano).
- Neón, gradientes de alta vibración o estética “plantilla SaaS genérica” que contradigan el blueprint.
- Enviar metáforas de “nube” como elemento visual principal (el valor es **local**).
- Multitud de acentos de marca competidores: un **primary** claro para CTAs; **trust** para mensajes de confianza.
- Emojis en UI de producto salvo decisión explícita de marca.
- **Crowding:** si la UI se siente densa, aumentar aire (espacio entre bloques) antes de añadir líneas.

---

## 10. Estados de pantalla (ruta `/`)

La home alterna **tres estados** coherentes con el blueprint (tinta/papel, primary terracota, sin ruido). Implementación de referencia: `WorkspaceShell` y componentes en `apps/web/src/components/`.

### 10.1 Estado 1 — Hook (vacío)

- **Objetivo:** ~**90%** de la altura útil es **zona de acción** (dropzone masivo).
- **Header:** mínimo: logo + nombre **CeroPDF** a la izquierda; a la derecha enlaces discretos (p. ej. donación, GitHub). **Sin** menú hamburguesa ni navegación pesada.
- **Centro:** rectángulo **punteado** a tamaño casi pantalla; al arrastrar PDFs desde el SO, **refuerzo visual** (overlay / borde / fondo `primary-muted`) que comunica “suelta aquí”.
- **Pie:** copy breve de confianza (**footer** visual); en **viewport pequeño** debe caber **sin scroll** (sin bloques largos bajo el fold).

### 10.2 Estado 2 — Lienzo (con PDFs)

Donde el usuario pasa la mayor parte del tiempo.

- **Top bar (sticky):** nombre del **proyecto** (editable); acciones **“Añadir más PDFs”** (secundario) y **“Exportar PDF”** (primary).
- **Centro:** **cuadrícula** de miniaturas por PDF; separadores claros **“Documento 1”**, **“Documento 2”**, etc., con nombre de archivo y metadatos en mono.
- **Interacción en miniatura:** la **tarjeta completa** es arrastrable para reordenar (cursor `grab` / `grabbing`); en **hover**, acciones de **rotar**, **excluir/incluir** y **quitar página**. El **Shift+clic** para rango es un atajo opcional, sin copy explicativo en pantalla.
- **Bottom bar flotante:** **píldora** centrada abajo con resumen: documentos · páginas visibles · tamaño estimado; toggle **optimizar tamaño** puede vivir aquí para no competir con el CTA de exportar.

### 10.3 Estado 3 — Exportación (feedback)

- **Overlay:** fondo oscurecido + **backdrop-blur** suave; mensaje claro del tipo *“Ensamblando documento en tu equipo…”* con **progreso** (barra indeterminada o porcentaje aproximado) mientras `pdf-lib` trabaja en cliente.
- **Éxito:** refuerzo positivo opcional (p. ej. **confetti** CSS sutil); la descarga se dispara en el navegador; CTA destacado **“Volver a empezar”** que limpia el lienzo.

---

## 11. Evolución

1. Nuevos colores o variantes: **token** en `globals.css` con nombre semántico.
2. **Documentar aquí** en una línea (rol + uso).
3. Ajustes finos de contraste WCAG en CTAs y estados hover tras cambios de marca.
4. Ampliar utilidades tipográficas o componentes reutilizables si la UI crece (p. ej. inspector lateral tipo blueprint).
5. Ajustar los **tres estados** de la §10 si el PRD añade flujos (p. ej. errores de exportación en modal).
