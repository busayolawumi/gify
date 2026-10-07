import type { ConvertErrorKind, ConvertProgress } from '../lib/convert'

type Props = {
  /** Set while a GIF is being made. */
  progress?: ConvertProgress
  /** Set when the last attempt failed. */
  error?: ConvertErrorKind
  disabled?: boolean
  onConvert: () => void
  onCancel: () => void
}

const ERRORS: Record<ConvertErrorKind, string> = {
  network:
    "Gify couldn't download its converter. Check your connection and try again.",
  memory:
    'Your device ran out of memory making this GIF. Try a smaller size, or a shorter clip.',
  unreadable:
    "Gify couldn't read this video. It may be damaged, or in a format Gify can't handle yet.",
  unknown:
    'Something went wrong making your GIF. Try again, or try a smaller size or a shorter clip.',
}

// The engine only downloads on a first visit. After that it's cached.
const downloading = (
  p: ConvertProgress,
): p is { stage: 'loading'; ratio: number } =>
  p.stage === 'loading' && p.ratio !== undefined && p.ratio < 1

function label(p: ConvertProgress) {
  if (p.stage === 'encoding') return 'Making your GIF…'
  if (p.stage === 'analysing') return 'Reading colours…'
  return downloading(p) ? 'Downloading the converter…' : 'Getting ready…'
}

export function ConvertPanel({
  progress,
  error,
  disabled,
  onConvert,
  onCancel,
}: Props) {
  if (progress) {
    // Downloading and encoding have real percentages. The rest pulse instead.
    let ratio: number | undefined
    if (progress.stage === 'encoding') ratio = progress.ratio
    else if (downloading(progress)) ratio = progress.ratio
    const percent = ratio === undefined ? undefined : Math.round(ratio * 100)
    return (
      <div className="mt-6 w-full max-w-xl text-left">
        <div className="flex items-baseline justify-between text-sm">
          <p>{label(progress)}</p>
          {percent !== undefined && (
            <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              {percent}%
            </p>
          )}
        </div>
        <div
          role="progressbar"
          aria-label="Making your GIF"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900"
        >
          {percent === undefined ? (
            <div className="h-full w-full animate-pulse bg-accent/40" />
          ) : (
            <div
              className="h-full bg-accent transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          )}
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {downloading(progress) && 'Only needed the first time.'}
          </p>
          <button
            type="button"
            className="-mx-2 -my-3.5 px-2 py-3.5 text-xs text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6 w-full max-w-xl text-left">
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
          {ERRORS[error]}
        </p>
      )}
      <button
        type="button"
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        disabled={disabled}
        onClick={onConvert}
      >
        {error ? 'Try again' : 'Convert to GIF'}
      </button>
    </div>
  )
}
