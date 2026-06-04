/**
 * Copies ffmpeg.wasm assets into `public/ffmpeg/` so they are served same-origin
 * (privacy contract: the media converter runs 100% client-side, no CDN fetch).
 *
 *   public/ffmpeg/st/  → single-thread core (the only one we ship; see load-ffmpeg.ts)
 *   public/ffmpeg/esm/ → @ffmpeg/ffmpeg class worker + its sibling modules
 *
 * The class worker is shipped as real same-origin files (not a blob) because it
 * uses relative ESM imports (`./const.js`, `./errors.js`) that a blob URL can't
 * resolve. Mirrors copy-pdf-worker.cjs.
 */
const fs = require("fs");
const path = require("path");

const webRoot = path.join(__dirname, "..");
// Deps may be hoisted to the workspace root or kept under apps/web.
const nodeModulesRoots = [
  path.join(webRoot, "node_modules"),
  path.join(webRoot, "..", "..", "node_modules"),
];

function resolvePkgDir(pkg) {
  const found = nodeModulesRoots
    .map((root) => path.join(root, ...pkg.split("/")))
    .find((p) => fs.existsSync(p));
  if (!found) {
    console.error(
      `copy-ffmpeg-core: ${pkg} not found under node_modules. Run npm install.`,
    );
    process.exit(1);
  }
  return found;
}

function copyFiles(srcDir, destDir, files) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const file of files) {
    const src = path.join(srcDir, file);
    if (!fs.existsSync(src)) {
      console.error(`copy-ffmpeg-core: missing ${src}`);
      process.exit(1);
    }
    fs.copyFileSync(src, path.join(destDir, file));
  }
}

const publicFfmpeg = path.join(webRoot, "public", "ffmpeg");

// Single-thread core (works everywhere, no cross-origin isolation needed).
copyFiles(
  path.join(resolvePkgDir("@ffmpeg/core"), "dist", "esm"),
  path.join(publicFfmpeg, "st"),
  ["ffmpeg-core.js", "ffmpeg-core.wasm"],
);

// Class worker + its sibling ESM modules (copied wholesale; small files).
const ffmpegEsmDir = path.join(resolvePkgDir("@ffmpeg/ffmpeg"), "dist", "esm");
const esmDest = path.join(publicFfmpeg, "esm");
fs.mkdirSync(esmDest, { recursive: true });
for (const file of fs.readdirSync(ffmpegEsmDir)) {
  if (file.endsWith(".js")) {
    fs.copyFileSync(path.join(ffmpegEsmDir, file), path.join(esmDest, file));
  }
}

console.log("copy-ffmpeg-core:", publicFfmpeg);
