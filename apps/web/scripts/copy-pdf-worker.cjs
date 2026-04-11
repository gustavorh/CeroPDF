/**
 * Copies pdf.js worker into `public/` so it is served same-origin (PRD privacy).
 */
const fs = require("fs");
const path = require("path");

const webRoot = path.join(__dirname, "..");
const candidates = [
  path.join(webRoot, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"),
  path.join(webRoot, "..", "..", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"),
];

const src = candidates.find((p) => fs.existsSync(p));
if (!src) {
  console.error(
    "copy-pdf-worker: pdf.worker.min.mjs not found under node_modules. Run npm install.",
  );
  process.exit(1);
}

const destDir = path.join(webRoot, "public");
const dest = path.join(destDir, "pdf.worker.min.mjs");
fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log("copy-pdf-worker:", dest);
