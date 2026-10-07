import { useCallback, useEffect, useRef, useState } from 'react'
import { formatSize } from '../lib/format'
import { ACCEPT, MAX_FILE_SIZE, checkVideo } from '../lib/video'

type Props = {
  onFile: (file: File) => void
}

export function DropZone({ onFile }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string>()

  const choose = useCallback(
    (files: FileList | null | undefined) => {
      const file = files?.[0]
      if (!file) return
      const problem = checkVideo(file)
      setError(problem)
      if (!problem) onFile(file)
    },
    [onFile],
  )

  // The whole page takes drops, so a near miss doesn't make the browser
  // leave Gify to open the video itself.
  useEffect(() => {
    // dragenter and dragleave fire for every element the file passes over,
    // so count them to know when it has left the page.
    let depth = 0
    const hasFiles = (e: DragEvent) =>
      e.dataTransfer?.types.includes('Files') ?? false

    function handleEnter(e: DragEvent) {
      if (!hasFiles(e)) return
      depth++
      setDragging(true)
    }
    function handleLeave(e: DragEvent) {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    function handleOver(e: DragEvent) {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    function handleDrop(e: DragEvent) {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      choose(e.dataTransfer?.files)
    }

    window.addEventListener('dragenter', handleEnter)
    window.addEventListener('dragleave', handleLeave)
    window.addEventListener('dragover', handleOver)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragenter', handleEnter)
      window.removeEventListener('dragleave', handleLeave)
      window.removeEventListener('dragover', handleOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [choose])

  return (
    <div className="mt-10 flex w-full max-w-xl flex-col items-center">
      <button
        type="button"
        className={`flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-14 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          dragging
            ? 'border-accent bg-accent/5'
            : 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-900'
        }`}
        onClick={() => input.current?.click()}
      >
        <span className="font-medium">
          {/* Phones and tablets can't drag files, so just offer the picker. */}
          <span className="pointer-coarse:hidden">
            Drop a video, or <span className="text-accent">browse</span>
          </span>
          <span className="hidden pointer-coarse:inline">Choose a video</span>
        </span>
        <span className="font-mono text-xs text-zinc-500">
          MP4 · MOV · WebM · up to {formatSize(MAX_FILE_SIZE)}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          choose(e.target.files)
          // Lets the same file be chosen again after an error.
          e.target.value = ''
        }}
      />
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <p className="mt-6 text-xs text-zinc-500">
        Your video never leaves your device.
      </p>
    </div>
  )
}
