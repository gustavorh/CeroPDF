"use client";

/**
 * OPFS-backed storage for large PDFs. Keeps memory usage flat when users open files larger
 * than `OPFS_THRESHOLD_BYTES`. Bytes go to a private, browser-managed sandbox; nothing leaves
 * the device.
 */

const OPFS_DIR_NAME = "ceropdf-docs";

/** Documents bigger than this are written to OPFS instead of staying in memory. */
export const OPFS_THRESHOLD_BYTES = 20 * 1024 * 1024; // 20 MB

let opfsDir: FileSystemDirectoryHandle | null = null;
let opfsSupportedCache: boolean | null = null;

export async function isOpfsSupported(): Promise<boolean> {
  if (opfsSupportedCache !== null) return opfsSupportedCache;
  try {
    if (
      typeof navigator === "undefined" ||
      !navigator.storage ||
      typeof navigator.storage.getDirectory !== "function"
    ) {
      opfsSupportedCache = false;
      return false;
    }
    await getOpfsDir();
    opfsSupportedCache = true;
    return true;
  } catch {
    opfsSupportedCache = false;
    return false;
  }
}

async function getOpfsDir(): Promise<FileSystemDirectoryHandle> {
  if (opfsDir) return opfsDir;
  const root = await navigator.storage.getDirectory();
  opfsDir = await root.getDirectoryHandle(OPFS_DIR_NAME, { create: true });
  return opfsDir;
}

/** Writes bytes to OPFS under the given file name and returns the handle. Overwrites if exists. */
export async function writeOpfsFile(
  fileName: string,
  bytes: ArrayBuffer,
): Promise<FileSystemFileHandle> {
  const dir = await getOpfsDir();
  const handle = await dir.getFileHandle(fileName, { create: true });
  // FileSystemWritableFileStream is the standard OPFS write path; types live in lib.dom.d.ts.
  const writable = await handle.createWritable();
  await writable.write(bytes);
  await writable.close();
  return handle;
}

/** Best-effort deletion of a single OPFS file. Ignores missing files. */
export async function deleteOpfsFile(fileName: string): Promise<void> {
  try {
    const dir = await getOpfsDir();
    await dir.removeEntry(fileName);
  } catch {
    // ignore — file may not exist or OPFS may have been cleared by the browser
  }
}

/** Drops the entire CeroPDF OPFS directory. Called on workspace reset. */
export async function clearOpfsDir(): Promise<void> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.getDirectory) {
      return;
    }
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(OPFS_DIR_NAME, { recursive: true });
    opfsDir = null;
  } catch {
    // ignore
  }
}
