export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <circle cx="64" cy="64" r="64" fill="#f4f4f5" />
      <g fill="#0a0a0a">
        <rect x="18" y="34" width="15" height="60" rx="3" />
        <rect x="49" y="34" width="15" height="60" rx="3" />
        <polygon points="33,34 48,34 64,94 49,94" />
        <rect x="72" y="34" width="38" height="15" rx="4" />
        <rect x="72" y="56.5" width="38" height="15" rx="4" />
        <rect x="72" y="79" width="38" height="15" rx="4" />
        <rect x="72" y="34" width="15" height="37.5" rx="4" />
        <rect x="95" y="56.5" width="15" height="37.5" rx="4" />
      </g>
    </svg>
  );
}
