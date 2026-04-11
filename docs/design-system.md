# LocalPDF — Design system

**Audiencia:** diseño, desarrollo y agentes de IA que toquen UI en `apps/web`.  
**Producto:** herramienta **gratuita**, **local-first** y **profesional** para manipular PDFs en el navegador (sin subir archivos a servidores de procesamiento).

Este documento define **principios**, **paleta**, **tokens** y **patrones** para mantener coherencia entre “fácil de usar para el cliente final” y “marca seria / branded”.

---

## 1. Posicionamiento y nicho

| Pilar | Implicación visual |
|--------|---------------------|
| **Gratis (free-to-use)** | Comunicación clara con badges/etiquetas discretas; evitar aspecto “juguete” o saturación de color. |
| **Profesional / branded** | Jerarquía tipográfica consistente, CTAs reconocibles, poca decoración innecesaria. |
| **Privacidad / local** | Color de **confianza** (verde esmeralda) para mensajes “100% local”, estados OK; refuerza calma y seguridad. |
| **Herramienta (no red social)** | Dark mode por defecto, densidad legible, datos técnicos en **monoespacio**; cuerpo en **sans** amigable. |

El tono es **claro y tranquilizador**: el usuario trae documentos sensibles; la UI debe sentirse **controlada** y **predecible**.

---

## 2. Principios de interfaz

1. **Legibilidad primero:** contraste suficiente en texto principal y secundario; límites y errores siempre entendibles.
2. **Una acción principal por vista:** exportar / continuar debe destacar con el color **primary** (azul cielo).
3. **Feedback explícito:** estados de carga, error y éxito usan colores **semánticos** (advertencia, error, éxito).
4. **Consistencia:** preferir tokens CSS (`--primary`, `--border`, etc.) y utilidades Tailwind mapeadas en `globals.css` antes de valores hex sueltos.
5. **Accesibilidad:** foco visible (`ring`), roles/labels en controles críticos, tamaño mínimo táctil razonable en CTAs (p. ej. ≥ 44px altura en móvil cuando aplique).

---

## 3. Paleta de color

### 3.1 Neutros (fondo y contenido)

| Rol | Descripción | Uso |
|-----|-------------|-----|
| **background** | Negro zinc muy suave | Fondo de aplicación |
| **foreground** | Casi blanco | Texto principal |
| **card** | Zinc elevado | Paneles, tarjetas, cabeceras |
| **border** | Zinc medio | Bordes por defecto |
| **border-subtle** | Zinc más apagado | Separadores suaves |
| **muted-foreground** | Gris medio | Subtítulos, ayudas |
| **tertiary** | Gris apagado | Meta, hints secundarios (`text-tertiary`) |

### 3.2 Marca — Primary (azul cielo / sky)

Transmite **claridad**, **acción** y **herramienta profesional** sin parecer bancario frío extremo.

| Token | Uso |
|--------|-----|
| **primary** | Botones principales, anillos de foco asociados a acción |
| **primary-hover** | Hover de CTAs |
| **primary-muted** | Fondos suaves (p. ej. dropzone activa) |

### 3.3 Confianza — Trust (esmeralda)

Refuerza **local**, **gratis sin truco** y **privacidad**.

| Token | Uso |
|--------|-----|
| **trust** | Badges “Gratis”, acentos de confianza |
| **trust-muted** / **trust-border** | Fondos y bordes de badges |

### 3.4 Semánticos

| Token | Significado |
|--------|-------------|
| **success** | Todo bien, estado listo |
| **warning** | Trabajo en curso / atención |
| **destructive** | Errores, eliminar, riesgo |

---

## 4. Tipografía

| Familia | Uso |
|---------|-----|
| **Sans (system stack)** | Títulos de producto, descripciones, etiquetas legibles para cualquier usuario. |
| **Mono** | Tamaños de archivo, límites (MB), estados técnicos, badges pequeños “de herramienta”. |

Regla práctica: si el dato parece **medición o límite**, va en **mono**; si es **frase para humanos**, va en **sans**.

---

## 5. Forma y espacio

- **Radios:** `rounded-lg` (8px) en controles y bloques; `rounded-xl` (12px) en zonas grandes (dropzone, tarjetas).
- **Espaciado:** ritmo 4/8 (Tailwind); secciones principales con `max-w-6xl` y padding horizontal generoso en desktop.
- **Elevación:** sombras muy suaves o bordes; evitar sombras pesadas (producto “ligero”, no modal pesado).

---

## 6. Implementación técnica

- **Fuente de tokens:** `apps/web/src/app/globals.css` (`:root` + bloque `@theme inline` para Tailwind v4).
- **Layout raíz:** `apps/web/src/app/layout.tsx` aplica en `<body>` `bg-background`, `font-sans`, `text-foreground` para que toda la app herede canvas y texto del sistema.
- **Selección de texto:** `::selection` en `globals.css` usa `primary-muted` + `foreground` para coherencia con la marca.
- **Contenedor principal:** el shell del workspace usa `bg-background` para cubrir el viewport completo.
- **Uso en componentes:** utilidades semánticas cuando existan, por ejemplo:
  - `bg-background`, `text-foreground`, `border-border`
  - `bg-primary`, `text-primary-foreground`, `hover:bg-primary-hover`
  - `text-muted-foreground`, `text-tertiary`, `border-trust/30`, `bg-trust/10`, `text-trust`
  - `bg-destructive/10`, `text-destructive`, `border-destructive/30`
  - `ring-ring` / `focus-visible:ring-ring` para foco

No dupliques hex en componentes si ya hay token equivalente.

---

## 7. Qué evitar

- Temas claros por defecto (el PRD pide dark mode por defecto).
- Gradientes llamativos o neón que contradigan “profesional”.
- Enviar metáforas de “nube” como elemento visual principal (el valor es **local**).
- Emojis en UI de producto salvo decisión explícita de marca.

---

## 8. Evolución

Cualquier nuevo color o variante debe:

1. Añadirse como **token** en `globals.css` con nombre semántico.
2. Documentarse aquí en una línea (rol + uso).
3. Preferir **un solo** color de acento para CTAs (**primary**) para no diluir la marca.
