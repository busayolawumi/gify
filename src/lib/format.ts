/** Formats a file size the way phones and Macs do, where 1 MB is 1,000,000 bytes. */
export function formatSize(bytes: number) {
  if (bytes >= 1e9) return `${Number((bytes / 1e9).toFixed(1))} GB`
  if (bytes >= 1e6) return `${Number((bytes / 1e6).toFixed(1))} MB`
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`
}

/** Formats seconds as m:ss.s, or h:mm:ss.s for long videos. */
export function formatTime(seconds: number) {
  const tenths = Math.round(seconds * 10)
  const minutes = Math.floor(tenths / 600)
  const secs = ((tenths % 600) / 10).toFixed(1).padStart(4, '0')
  if (minutes < 60) return `${minutes}:${secs}`
  const mins = String(minutes % 60).padStart(2, '0')
  return `${Math.floor(minutes / 60)}:${mins}:${secs}`
}
