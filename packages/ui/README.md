# @ceropdf/ui

Shared UI primitives used across CeroPDF workspaces. React 19 peer dependency.

## Exports

```ts
import { BrandMark, Dropzone } from "@ceropdf/ui";
```

- **`BrandMark`** — the CeroPDF wordmark / logo.
- **`Dropzone`** — generic, tool-agnostic file dropzone.

Keep this package free of tool-specific logic — anything that knows about PDFs, stores, or routes belongs in `apps/web`.
