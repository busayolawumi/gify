import { useEffect, useState } from 'react'
import { DropZone } from './components/DropZone'
import { convert, type ConvertProgress } from './lib/convert'
import { formatSize } from './lib/format'

function App() {
  const [file, setFile] = useState<File>()

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
        {file ? (
          <TemporaryConvert file={file} onReset={() => setFile(undefined)} />
        ) : (
          <DropZone onFile={setFile} />
        )}
      </section>
    </main>
  )
}

const PRESETS = {
  Small: { size: 320, fps: 10 },
  Balanced: { size: 480, fps: 15 },
  High: { size: 720, fps: 20 },
}
type Preset = keyof typeof PRESETS

type Result = {
  preset: Preset
  url: string
  size: number
  seconds: number
  dimensions?: string
}

// Temporary: stands in for the editor, settings and result screens (steps
// 3 to 5) so a chosen video can still be converted. Uses the first 5 seconds.
function TemporaryConvert({
  file,
  onReset,
}: {
  file: File
  onReset: () => void
}) {
  const [preset, setPreset] = useState<Preset>('Balanced')
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
    const startedAt = performance.now()
    try {
      const gif = await convert(
        file,
        { start: 0, end: 5, ...PRESETS[preset] },
        setProgress,
      )
      setResult({
        preset,
        url: URL.createObjectURL(gif),
        size: gif.size,
        seconds: (performance.now() - startedAt) / 1000,
      })
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setProgress(undefined)
    }
  }

  return (
    <div className="mt-10 w-full max-w-md rounded-lg border border-zinc-200 p-4 text-left text-sm dark:border-zinc-800">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate font-medium">{file.name}</p>
        <button
          className="shrink-0 text-xs text-zinc-500 underline-offset-4 hover:underline disabled:opacity-50"
          disabled={busy}
          onClick={onReset}
        >
          Choose another
        </button>
      </div>
      <p className="font-mono text-xs text-zinc-500">{formatSize(file.size)}</p>
      <div className="mt-4 flex gap-2">
        {(Object.keys(PRESETS) as Preset[]).map((name) => (
          <button
            key={name}
            className={`rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-50 ${
              name === preset
                ? 'border-accent text-accent'
                : 'border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800'
            }`}
            disabled={busy}
            onClick={() => setPreset(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <button
        className="mt-3 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        disabled={busy}
        onClick={handleConvert}
      >
        Convert first 5 seconds
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
            {result.preset} · {result.dimensions} · {formatSize(result.size)} ·
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
