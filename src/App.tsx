import { useCallback, useEffect, useRef, useState } from 'react'
import { ConvertPanel } from './components/ConvertPanel'
import { initialCrop, type Crop, type CropShape } from './lib/crop'
import { DropZone } from './components/DropZone'
import { Editor } from './components/Editor'
import { Result, type GifResult } from './components/Result'
import { Settings } from './components/Settings'
import {
  convert,
  ConvertError,
  preloadEngine,
  type ConvertErrorKind,
  type ConvertProgress,
} from './lib/convert'
import {
  loadSettings,
  qualityOf,
  saveSettings,
  type Dimensions,
  type Settings as SettingsValue,
} from './lib/settings'
import { gifFileName, type Clip } from './lib/video'

function App() {
  // The chosen video, and an object URL the editor can preview it from.
  const [video, setVideo] = useState<{ file: File; url: string }>()
  const [clip, setClip] = useState<Clip>()
  const [dimensions, setDimensions] = useState<Dimensions>()
  // The shape stays chosen between videos. The crop itself is per video.
  const [cropShape, setCropShape] = useState<CropShape>('Original')
  const [crop, setCrop] = useState<Crop>()
  const [settings, setSettings] = useState(loadSettings)
  // Set while a GIF is being made.
  const [progress, setProgress] = useState<ConvertProgress>()
  const [error, setError] = useState<ConvertErrorKind>()
  const [gif, setGif] = useState<GifResult>()
  const cancel = useRef<AbortController | undefined>(undefined)
  const busy = progress !== undefined
  const file = video?.file
  const screen = !video ? 'pick' : gif ? 'result' : 'edit'
  // What actually goes into the GIF: the crop if there is one, otherwise the
  // whole picture. Sizes are worked out from this.
  const source = crop ?? dimensions

  const handleFile = useCallback((chosen: File) => {
    setVideo({ file: chosen, url: URL.createObjectURL(chosen) })
    // Download the engine while the user picks the part they want.
    preloadEngine()
  }, [])

  function handleDimensions(next: Dimensions) {
    setDimensions(next)
    // Coming back with "Edit again" keeps the crop the user made.
    setCrop((current) => current ?? initialCrop(cropShape, next))
  }

  function handleCropShape(shape: CropShape) {
    setCropShape(shape)
    setCrop(dimensions && initialCrop(shape, dimensions, crop))
  }

  function handleSettings(next: SettingsValue) {
    setSettings(next)
    saveSettings(next)
  }

  async function handleConvert() {
    if (!video || !clip) return
    const controller = new AbortController()
    cancel.current = controller
    setError(undefined)
    setProgress({ stage: 'loading' })
    try {
      const blob = await convert(
        video.file,
        { ...clip, ...qualityOf(settings, source), crop },
        setProgress,
        controller.signal,
      )
      setGif({
        blob,
        url: URL.createObjectURL(blob),
        name: gifFileName(video.file.name),
        length: clip.end - clip.start,
      })
    } catch (e) {
      if (!controller.signal.aborted) {
        console.error(e)
        setError(e instanceof ConvertError ? e.kind : 'unknown')
      }
    } finally {
      cancel.current = undefined
      setProgress(undefined)
    }
  }

  // Back to the editor, keeping the video, selection and settings.
  function handleEditAgain() {
    if (gif) URL.revokeObjectURL(gif.url)
    setGif(undefined)
  }

  function handleStartOver() {
    if (gif) URL.revokeObjectURL(gif.url)
    if (video) URL.revokeObjectURL(video.url)
    setGif(undefined)
    setVideo(undefined)
    setClip(undefined)
    setDimensions(undefined)
    setCrop(undefined)
    setError(undefined)
  }

  // Each screen starts at the top. Otherwise, on a phone, the result would
  // open scrolled down to where the Convert button was.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [screen])

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
      {/* Once a video is open, the headline shrinks so the preview isn't
          pushed down the screen on phones. */}
      <section
        className={`flex flex-1 flex-col items-center text-center ${
          video ? 'py-6 sm:py-10' : 'justify-center py-12 sm:py-20'
        }`}
      >
        <h1
          className={`font-semibold tracking-tight ${
            video ? 'text-2xl sm:text-3xl' : 'text-4xl sm:text-6xl'
          }`}
        >
          Videos, GIF’d.
        </h1>
        {!video && (
          <p className="mt-4 max-w-md text-zinc-600 dark:text-zinc-400">
            Pick the best part of any video and make it loop.
          </p>
        )}
        {!video ? (
          <DropZone onFile={handleFile} />
        ) : gif ? (
          <Result
            gif={gif}
            onEditAgain={handleEditAgain}
            onMakeAnother={handleStartOver}
          />
        ) : (
          <>
            <Editor
              file={video.file}
              url={video.url}
              clip={clip}
              onClipChange={setClip}
              onDimensions={handleDimensions}
              videoSize={dimensions}
              cropShape={cropShape}
              crop={crop}
              onCropShapeChange={handleCropShape}
              onCropChange={setCrop}
              onReset={handleStartOver}
              locked={busy}
            />
            <Settings
              settings={settings}
              onChange={handleSettings}
              video={source}
              disabled={busy}
            />
            <ConvertPanel
              progress={progress}
              error={error}
              disabled={!clip}
              onConvert={handleConvert}
              onCancel={() => cancel.current?.abort()}
            />
          </>
        )}
      </section>
      <Footer />
    </main>
  )
}

// The engine is FFmpeg's GPL build, and the site sends it to every visitor,
// so the GPL needs its licence and source to be offered. /licenses.txt has
// both: a short notice with the source link, then the full GPL text.
function Footer() {
  const link =
    'underline-offset-2 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100'
  return (
    <footer className="pt-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
      <a className={link} href="https://github.com/busayolawumi/gify">
        GitHub
      </a>
      {' · '}
      <a className={link} href="/licenses.txt">
        Licences
      </a>
    </footer>
  )
}

export default App
