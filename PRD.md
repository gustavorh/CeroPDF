# 🧭 Product Requirements Document (PRD): LocalPDF v1.0

**Contexto para el Agente de IA (Cursor/Kimi):** Este documento es la fuente absoluta de la verdad. Si una funcionalidad no está descrita aquí, **NO** debe ser implementada. Las reglas de arquitectura (100% Client-Side) son inquebrantables.

## 1. Visión del Producto (North Star)

**LocalPDF** es una herramienta web de manipulación de PDFs hiper-rápida, privada y de fricción cero. Resuelve el problema de los usuarios que necesitan unir, dividir o comprimir documentos pesados y sensibles sin tener que subirlos a servidores de terceros, evitando límites de tamaño abusivos y paywalls. Todo el procesamiento ocurre en el navegador del usuario (Local-First).

## 2. Arquitectura y Restricciones Técnicas (Reglas Inquebrantables)

- **100% Client-Side:** No existe backend de procesamiento. El servidor (CDN/Host) solo sirve los archivos estáticos (`.html`, `.js`, `.css`, `.wasm`).
- **Procesamiento de PDF:** Se utilizará `pdf-lib` (o similar compatible con cliente) para la manipulación binaria y `pdf.js` para el renderizado de miniaturas en el `<canvas>`.
- **Privacidad por diseño:** Ningún dato (ni el archivo, ni telemetría) sale de la máquina del usuario hacia un servidor externo.
- **Límite Duro (Hard Limit):** El sistema debe rechazar (con un mensaje claro) archivos que superen los **250MB** o **500 páginas** combinadas para evitar el colapso (Out of Memory - OOM) de la pestaña del navegador.

## 3. Alcance (Scope) - Fuera de la V1 (Non-Goals)

_Para mantener el enfoque y salir a producción rápido, lo siguiente está estrictamente PROHIBIDO en el código de esta iteración:_

- [ ] NO crear base de datos, sistema de autenticación (login/registro), ni historial de usuario en la nube.
- [ ] NO usar un backend de Node.js/Python para procesar los PDFs.
- [ ] NO incluir funcionalidades de OCR, edición de texto o firmas digitales.
- [ ] NO soportar integración con Google Drive, Dropbox o similares. (Solo input local del File System).

---

## 4. Requerimientos de UI/UX

- **Tema:** Dark Mode por defecto. Interfaz minimalista, limpia, enfocada en la herramienta (estilo "Developer Tool" pulida).
- **Fricción Cero:** La ruta raíz `/` es directamente la zona de _Dropzone_ (arrastrar y soltar).
- **Feedback de Estado:** Operar con archivos pesados toma tiempo de CPU. Cada acción (Cargando, Parseando, Renderizando, Uniendo) debe tener indicadores de progreso visuales explícitos para que el usuario sepa que la app no se ha congelado.
- **Renderizado Perezoso (Lazy Load):** Las miniaturas de las páginas del PDF en el lienzo deben renderizarse utilizando un `IntersectionObserver`. Si hay 100 páginas, solo se renderizan en el DOM/Canvas las que son visibles en el viewport.

---

## 5. Funcionalidades Core (Historias de Usuario y Criterios de Aceptación)

### Feature 1: El Lienzo (Workspace & Dropzone)

Como usuario, quiero arrastrar mis archivos a la pantalla para verlos e interactuar con ellos visualmente.

- **CA 1.1:** El usuario puede arrastrar múltiples archivos PDF a la pantalla.
- **CA 1.2:** Si un archivo supera los 250MB, se rechaza inmediatamente con un error UI: _"Archivo muy pesado. Límite de 250MB para procesamiento seguro en navegador"_.
- **CA 1.3:** Los archivos aceptados se parsean y se muestran como "Bloques" o carpetas colapsadas en la UI (mostrando nombre del archivo y peso).
- **CA 1.4:** El usuario puede hacer doble clic/expandir un bloque para ver la cuadrícula de miniaturas de cada página del PDF.

### Feature 2: Unir (Merge) y Reordenar

Como usuario, quiero combinar varios PDFs o alterar su orden visualmente antes de generar el documento final.

- **CA 2.1:** Los bloques de PDFs enteros pueden ser arrastrados y soltados (Drag & Drop) para cambiar su orden de concatenación.
- **CA 2.2:** Dentro de un PDF expandido, el usuario puede arrastrar miniaturas individuales para cambiar el orden de las páginas.
- **CA 2.3:** Al hacer clic en "Exportar PDF", el sistema compila un nuevo ArrayBuffer en memoria con el orden visual establecido e inicia la descarga local automática (usando `URL.createObjectURL`).

### Feature 3: Dividir y Extraer (Split / Extract)

Como usuario, quiero seleccionar páginas específicas de un PDF grande y exportarlas como un documento nuevo, o eliminar páginas que no necesito.

- **CA 3.1:** En la vista expandida de miniaturas, cada página tiene un botón o control para ser "eliminada" (ocultada del renderizado final) o "seleccionada" (para extraer solo esa).
- **CA 3.2:** Se deben soportar atajos de teclado o UI intuitiva (ej. _Shift + Click_) para seleccionar múltiples páginas en lote.

### Feature 4: Compresión Ligera

Como usuario, quiero que la herramienta me ofrezca una versión de menor tamaño del documento final (útil para envíos por correo).

- **CA 4.1:** Antes de exportar, existe un _toggle_ (interruptor) de "Optimizar tamaño".
- **CA 4.2:** Si está activo, el script utiliza las capacidades de `pdf-lib` (o equivalente) para re-guardar el documento desechando metadatos innecesarios, objetos huérfanos y comprimiendo el flujo interno (`{ useObjectStreams: false }` o similar según la librería).

---

## 6. Manejo del Estado (State Management Recomendado)

_Instrucciones técnicas para la implementación:_
Se requiere un gestor de estado robusto (ej. Zustand, Redux o Context reactivo) para mantener la sincronía entre el binario en memoria y la UI.
**Estructura sugerida del Store:**

- `documents`: Arreglo de objetos (ID, Nombre, Archivo Original (File), Buffer en Memoria).
- `pages`: Arreglo plano que representa la secuencia final a exportar. Cada objeto debe tener una referencia al `documentID` de origen y el índice de la página original.
- `uiState`: Manejo de modales, estado de carga (loading, parsing, rendering, error), y páginas seleccionadas.

## 7. Manejo de Errores Críticos

- **Archivos Corruptos:** Si `pdf-lib` falla al parsear el documento, capturar el error y mostrar un _Toast_: _"No se pudo leer el archivo. Puede estar corrupto o protegido por contraseña."_
- **Bloqueo del UI Thread:** Las operaciones pesadas (parsear, guardar) de `pdf-lib` deben delegarse a un **Web Worker** siempre que sea posible para evitar que la UI se congele, o en su defecto, ceder control usando `setTimeout(..., 0)` entre lotes de páginas.
