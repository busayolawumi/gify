/** Formats a file size the way phones and Macs do, where 1 MB is 1,000,000 bytes. */
export function formatSize(bytes: number) {
  if (bytes >= 1e9) return `${Number((bytes / 1e9).toFixed(1))} GB`
  if (bytes >= 1e6) return `${Number((bytes / 1e6).toFixed(1))} MB`
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`
}
