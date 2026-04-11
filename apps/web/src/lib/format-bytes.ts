/** Human-readable byte size for UI (binary units). */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"] as const;
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );
  const value = bytes / k ** i;
  const decimals = i === 0 ? 0 : value < 10 ? 1 : 0;
  return `${value.toFixed(decimals)} ${sizes[i]}`;
}
