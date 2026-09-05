/**
 * A comet: a ring drawn as a conic gradient that fades out along its own
 * tail, with a bright head leading it. The gradient is masked into a ring
 * rather than stroked, which is what lets the tail thin out towards
 * transparent instead of ending on a hard edge.
 *
 * Colour comes from `currentColor`, so it inherits like text does.
 */
export function CometSpinner({
  size = 28,
  thickness = 3,
  className = "",
}: {
  size?: number;
  thickness?: number;
  className?: string;
}) {
  const ring = `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), #000 calc(100% - ${thickness}px))`;
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`comet relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, currentColor 300deg, currentColor 360deg)",
          WebkitMask: ring,
          mask: ring,
          opacity: 0.9,
        }}
      />
      {/* The head sits at the end of the sweep, half outside the ring's own
          width so it reads as rounded rather than clipped. */}
      <span
        className="absolute rounded-full bg-current"
        style={{
          width: thickness,
          height: thickness,
          top: 0,
          left: `calc(50% - ${thickness / 2}px)`,
        }}
      />
    </span>
  );
}
