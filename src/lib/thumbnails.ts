/**
 * Grabs `count` evenly spaced frames from a video as small JPEG data URLs,
 * calling `onFrame` as each one is ready. It uses its own hidden video
 * element, so the preview keeps playing. Rejects if the browser won't load or
 * seek the video in time (some phones won't for a video that isn't on
 * screen). Callers should treat thumbnails as optional.
 */
export async function captureFrames(
  url: string,
  duration: number,
  count: number,
  height: number,
  onFrame: (index: number, src: string) => void,
  signal: AbortSignal,
) {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url
  try {
    await waitFor(video, 'loadeddata', signal, 10_000)
    const canvas = document.createElement('canvas')
    canvas.height = height
    canvas.width = Math.round((height * video.videoWidth) / video.videoHeight)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No 2D canvas')

    for (let i = 0; i < count; i++) {
      // The middle of each slice, kept clear of the very end, where some
      // videos have no frame to show.
      const time = ((i + 0.5) / count) * duration
      video.currentTime = Math.max(0, Math.min(time, duration - 0.1))
      await waitFor(video, 'seeked', signal, 5_000)
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      onFrame(i, canvas.toDataURL('image/jpeg', 0.7))
    }
  } finally {
    // Lets the browser free the decoder straight away.
    video.removeAttribute('src')
    video.load()
  }
}

function waitFor(
  video: HTMLVideoElement,
  event: string,
  signal: AbortSignal,
  timeout: number,
) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => finish(new Error(`Timed out waiting for ${event}`)),
      timeout,
    )
    const onEvent = () => finish()
    const onError = () => finish(new Error("The video couldn't be read"))
    const onAbort = () => finish(signal.reason)
    function finish(error?: unknown) {
      clearTimeout(timer)
      video.removeEventListener(event, onEvent)
      video.removeEventListener('error', onError)
      signal.removeEventListener('abort', onAbort)
      if (error === undefined) resolve()
      else reject(error)
    }
    if (signal.aborted) return finish(signal.reason)
    video.addEventListener(event, onEvent, { once: true })
    video.addEventListener('error', onError, { once: true })
    signal.addEventListener('abort', onAbort, { once: true })
  })
}
