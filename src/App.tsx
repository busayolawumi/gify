import { useCallback, useEffect, useState } from 'react'
import { DropZone } from './components/DropZone'
import { Editor } from './components/Editor'
import { Settings } from './components/Settings'
import { convert, preloadEngine, type ConvertProgress } from './lib/convert'
import { formatSize } from './lib/format'
import {
  loadSettings,
  qualityOf,
  saveSettings,
  type Dimensions,
  type Quality,
  type Settings as SettingsValue,
} from './lib/settings'
import type { Clip } from './lib/video'

function App() {
  // The chosen video, and an object URL the editor can preview it from.
  const [video, setVideo] = useState<{ file: File; url: string }>()
  const [clip, setClip] = useState<Clip>()
  const [dimensions, setDimensions] = useState<Dimensions>()
  const [settings, setSettings] = useState(loadSettings)
  const [busy, setBusy] = useState(false)
  const file = video?.file

  function handleSettings(next: SettingsValue) {
    setSettings(next)
    saveSettings(next)
  }

  const handleFile = useCallback((chosen: File) => {
    setVideo({ file: chosen, url: URL.createObjectURL(chosen) })
    // Download the engine while the user picks the part they want.
    preloadEngine()
  }, [])

  function handleReset() {
    if (video) URL.revokeObjectURL(video.url)
    setVideo(undefined)
    setClip(undefined)
    setDimensions(undefined)
  }

  // Once a video is open, ignore files dropped on the page instead of letting
  // the browser leave Gify to open them.
  useEffect(() => {
    if (!file) return
    function ignore(e: DragEvent) {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
    }
    window.addEventListener('dragover', ignore)
    window.addEventListener('drop', ignore)
    return () => {
      window.removeEventListener('dragover', ignore)
      window.removeEventListener('drop', ignore)
    }
  }, [file])

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <a className="text-xl font-semibold tracking-tight" href="/">
          Gify<span className="text-accent">.</span>
        </a>
      </header>
      <section className="flex flex-1 flex-col items-center justify-center py-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          Videos, looped.
        </h1>
        <p className="mt-4 max-w-md text-zinc-600 dark:text-zinc-400">
          Turn a short video into a GIF, right here.
        </p>
        {video ? (
          <>
            <Editor
              file={video.file}
              url={video.url}
              clip={clip}
              onClipChange={setClip}
              onDimensions={setDimensions}
              onReset={handleReset}
              locked={busy}
            />
            <Settings
              settings={settings}
              onChange={handleSettings}
              video={dimensions}
              disabled={busy}
            />
            {clip && (
              <TemporaryConvert
                file={video.file}
                clip={clip}
                quality={qualityOf(settings, dimensions)}
                label={settings.preset}
                onBusyChange={setBusy}
              />
            )}
          </>
        ) : (
          <DropZone onFile={handleFile} />
        )}
      </section>
    </main>
  )
}

type Result = {
  label: string
  url: string
  size: number
  seconds: number
  dimensions?: string
}

// Temporary: stands in for the convert and result screen (step 5) so the
// selected part of the video can still be converted.
function TemporaryConvert({
  file,
  clip,
  quality,
  label,
  onBusyChange,
}: {
  file: File
  clip: Clip
  quality: Quality
  /** The preset's name, shown next to the result. */
  label: string
  onBusyChange: (busy: boolean) => void
}) {
  const [progress, setProgress] = useState<ConvertProgress>()
  const [result, setResult] = useState<Result>()
  const [error, setError] = useState<string>()
  const busy = progress !== undefined

  // Free each GIF's memory once it's replaced or this panel goes away.
  const resultUrl = result?.url
  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl)
    }
  }, [resultUrl])

  async function handleConvert() {
    setResult(undefined)
    setError(undefined)
    onBusyChange(true)
    const startedAt = performance.now()
    try {
      const gif = await convert(file, { ...clip, ...quality }, setProgress)
      setResult({
        label,
        url: URL.createObjectURL(gif),
        size: gif.size,
        seconds: (performance.now() - startedAt) / 1000,
      })
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setProgress(undefined)
      onBusyChange(false)
    }
  }

  return (
    <div className="mt-6 w-full max-w-xl rounded-lg border border-zinc-200 p-4 text-left text-sm dark:border-zinc-800">
      <button
        className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        disabled={busy}
        onClick={handleConvert}
      >
        Convert to GIF
      </button>
      {progress && (
        <p className="mt-3 font-mono text-xs">
          {progress.stage === 'encoding'
            ? `encoding ${Math.round(progress.ratio * 100)}%`
            : `${progress.stage}…`}
        </p>
      )}
      {error && (
        <pre className="mt-3 overflow-x-auto font-mono text-xs whitespace-pre-wrap text-red-600">
          {error}
        </pre>
      )}
      {result && (
        <div className="mt-3">
          <img
            className="mx-auto block max-w-full rounded-lg"
            src={result.url}
            alt="Converted GIF"
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget
              const dimensions = `${naturalWidth}×${naturalHeight}`
              setResult((r) => r && { ...r, dimensions })
            }}
          />
          <p className="mt-2 font-mono text-xs text-zinc-500">
            {result.label} · {result.dimensions} · {formatSize(result.size)} ·
            took {result.seconds.toFixed(1)}s ·{' '}
            <a className="underline" href={result.url} download="gify.gif">
              download
            </a>
          </p>
        </div>
      )}
    </div>
  )
}

export default App
