import type { ConvertProgress } from '../lib/convert'

type Props = {
  /** Set while a GIF is being made. */
  progress?: ConvertProgress
  error?: string
  disabled?: boolean
  onConvert: () => void
  onCancel: () => void
}

const LABELS: Record<ConvertProgress['stage'], string> = {
  loading: 'Getting ready…',
  analysing: 'Reading colours…',
  encoding: 'Making your GIF…',
}

export function ConvertPanel({
  progress,
  error,
  disabled,
  onConvert,
  onCancel,
}: Props) {
  if (progress) {
    // Only encoding has a real percentage. The other stages pulse instead.
    const percent =
      progress.stage === 'encoding'
        ? Math.round(progress.ratio * 100)
        : undefined
    return (
      <div className="mt-6 w-full max-w-xl text-left">
        <div className="flex items-baseline justify-between text-sm">
          <p>{LABELS[progress.stage]}</p>
          {percent !== undefined && (
            <p className="font-mono text-xs text-zinc-500">{percent}%</p>
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
        <div className="mt-2 text-right">
          <button
            type="button"
            className="text-xs text-zinc-500 underline-offset-4 hover:underline"
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
          {error}
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
