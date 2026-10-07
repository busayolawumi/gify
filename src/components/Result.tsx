import { useMemo, useState } from 'react'
import { formatSize } from '../lib/format'

// Past this, a GIF is slow to send and some apps won't take it.
const BIG_GIF = 10_000_000

export type GifResult = {
  blob: Blob
  /** An object URL for `blob`. */
  url: string
  /** The download name, e.g. IMG_2416.gif. */
  name: string
  /** How long the GIF lasts, in seconds. */
  length: number
}

type Props = {
  gif: GifResult
  onEditAgain: () => void
  onMakeAnother: () => void
}

export function Result({ gif, onEditAgain, onMakeAnother }: Props) {
  const [dimensions, setDimensions] = useState<string>()

  // Only some browsers (mostly on phones) can share files. Where they can't,
  // the Share button doesn't appear.
  const shareable = useMemo(() => {
    const file = new File([gif.blob], gif.name, { type: 'image/gif' })
    return navigator.canShare?.({ files: [file] }) ? file : undefined
  }, [gif])

  async function handleShare() {
    if (!shareable) return
    try {
      await navigator.share({ files: [shareable] })
    } catch (e) {
      // Closing the share sheet counts as an error, but it isn't one.
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        console.error(e)
      }
    }
  }

  return (
    <div className="mt-6 w-full max-w-xl sm:mt-8">
      <img
        className="mx-auto block max-h-[min(60vh,28rem)] max-w-full rounded-lg"
        src={gif.url}
        alt="Your GIF"
        onLoad={(e) => {
          const { naturalWidth, naturalHeight } = e.currentTarget
          setDimensions(`${naturalWidth}×${naturalHeight}`)
        }}
      />
      <p className="mt-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">
        {dimensions && `${dimensions} · `}
        {gif.length.toFixed(1)}s · {formatSize(gif.blob.size)}
      </p>
      {gif.blob.size > BIG_GIF && (
        <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          Big GIFs can be slow to send, and some apps won't take them. Try a
          smaller size, or a shorter clip.
        </p>
      )}

      <div className="mt-6 flex justify-center gap-2">
        <a
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          href={gif.url}
          download={gif.name}
        >
          Download GIF
        </a>
        {shareable && (
          <button
            type="button"
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            onClick={handleShare}
          >
            Share
          </button>
        )}
      </div>

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        <button
          type="button"
          className="-mx-2 -my-3.5 px-2 py-3.5 underline-offset-4 hover:underline"
          onClick={onEditAgain}
        >
          Edit again
        </button>
        {' · '}
        <button
          type="button"
          className="-mx-2 -my-3.5 px-2 py-3.5 underline-offset-4 hover:underline"
          onClick={onMakeAnother}
        >
          Make another
        </button>
      </p>
    </div>
  )
}
