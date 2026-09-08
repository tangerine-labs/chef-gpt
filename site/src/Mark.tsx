/** The mark: one yellow note with its tape and a fineliner tick (the favicon, inline). */
export function Mark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ flex: "none" }}
    >
      <g transform="rotate(-4 32 34)">
        <rect x="9" y="11" width="46" height="46" fill="#ffe14d" />
        <rect
          x="21"
          y="6.5"
          width="22"
          height="8"
          fill="#fff"
          fillOpacity=".65"
          stroke="#000"
          strokeWidth="1.5"
        />
      </g>
      <path
        d="M20 35l8 8 16-19"
        fill="none"
        stroke="#000"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
