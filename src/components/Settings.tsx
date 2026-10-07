import {
  CUSTOM_DESCRIPTION,
  FPS_RANGE,
  PRESETS,
  PRESET_NAMES,
  SIZE_RANGE,
  maxCustomSize,
  outputDimensions,
  qualityOf,
  type Dimensions,
  type Settings as SettingsValue,
} from '../lib/settings'

type Props = {
  settings: SettingsValue
  onChange: (settings: SettingsValue) => void
  /** The video's size, when the browser could open it. */
  video?: Dimensions
  disabled?: boolean
}

export function Settings({ settings, onChange, video, disabled }: Props) {
  const quality = qualityOf(settings, video)
  const description =
    settings.preset === 'Custom'
      ? CUSTOM_DESCRIPTION
      : PRESETS[settings.preset].description

  let size = `up to ${quality.size}px`
  if (video) {
    const out = outputDimensions(video, quality.size)
    const original = out.width === video.width && out.height === video.height
    size = `${out.width}×${out.height}${original ? ' (original size)' : ''}`
  }

  return (
    // A disabled fieldset disables every control inside it.
    <fieldset className="mt-6 w-full max-w-xl text-left" disabled={disabled}>
      <legend className="sr-only">GIF quality</legend>
      {/* Real radio buttons, so arrow keys move between the options. */}
      <div className="grid grid-cols-4 gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
        {PRESET_NAMES.map((name) => (
          <label
            key={name}
            className="cursor-pointer has-disabled:cursor-default"
          >
            <input
              type="radio"
              name="preset"
              value={name}
              className="peer sr-only"
              checked={settings.preset === name}
              onChange={() => onChange({ ...settings, preset: name })}
            />
            <span className="block rounded-md px-2 py-1.5 text-center text-sm transition peer-checked:bg-zinc-900 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-accent peer-disabled:opacity-50 hover:bg-zinc-100 peer-checked:hover:bg-zinc-900 dark:peer-checked:bg-zinc-100 dark:peer-checked:text-zinc-900 dark:hover:bg-zinc-800 dark:peer-checked:hover:bg-zinc-100">
              {name}
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {description}{' '}
        <span className="font-mono text-xs text-zinc-500">
          · {size} · {quality.fps} fps
        </span>
      </p>

      {settings.preset === 'Custom' && (
        <div className="mt-4 grid grid-cols-[auto_1fr_4rem] items-center gap-x-3 gap-y-3 text-sm">
          <label htmlFor="custom-size">Size</label>
          <input
            id="custom-size"
            type="range"
            className="accent-accent"
            min={SIZE_RANGE.min}
            max={maxCustomSize(video)}
            step={SIZE_RANGE.step}
            value={quality.size}
            onChange={(e) =>
              onChange({
                ...settings,
                custom: { ...settings.custom, size: Number(e.target.value) },
              })
            }
          />
          <span className="text-right font-mono text-xs text-zinc-500">
            {quality.size}px
          </span>

          <label htmlFor="custom-fps">Smoothness</label>
          <input
            id="custom-fps"
            type="range"
            className="accent-accent"
            min={FPS_RANGE.min}
            max={FPS_RANGE.max}
            step={FPS_RANGE.step}
            value={quality.fps}
            onChange={(e) =>
              onChange({
                ...settings,
                custom: { ...settings.custom, fps: Number(e.target.value) },
              })
            }
          />
          <span className="text-right font-mono text-xs text-zinc-500">
            {quality.fps} fps
          </span>
        </div>
      )}
    </fieldset>
  )
}
