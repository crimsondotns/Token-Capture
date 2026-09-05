import { cn } from "@/lib/utils";

/**
 * A native range input, restyled. The filled part of the track is painted
 * with a gradient rather than a second element, so there is nothing to keep
 * in sync with the thumb while dragging.
 */
export function Slider({
  value,
  onChange,
  onCommit,
  min = 0,
  max = 1,
  step = 0.01,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  /** Fired once the drag ends, for work too heavy to do on every pixel. */
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      // Pointer for a drag, key for the arrows: a range input reports the end
      // of an interaction differently depending on how it was moved.
      onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      style={{
        background: `linear-gradient(to right, var(--color-fg) ${pct}%, var(--color-surface-2) ${pct}%)`,
      }}
      className={cn(
        "h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none",
        "disabled:cursor-not-allowed disabled:opacity-40",
        // The thumb has no cross-browser shorthand: each engine needs its own
        // pseudo-element, and they cannot be combined into one selector.
        "[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none",
        "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fg",
        "[&::-webkit-slider-thumb]:shadow-ring [&::-webkit-slider-thumb]:transition-transform",
        "[&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:active:scale-95",
        "[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:border-0",
        "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-fg",
        className,
      )}
    />
  );
}
