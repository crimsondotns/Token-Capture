const BLADE =
  "M103.6 24.4 L82 64 L103.6 103.6 L64 82 L24.4 103.6 L46 64 L24.4 24.4 L64 46 Z";

export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="#f4f4f5"
        stroke="#f4f4f5"
        strokeWidth="1.5"
        strokeLinejoin="round"
        d={BLADE}
      />
    </svg>
  );
}
