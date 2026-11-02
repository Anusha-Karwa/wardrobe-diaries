import { cn } from "@/lib/utils";

/**
 * Cute stickers for the diary pages. Each is a small SVG with a white die-cut border and a soft shadow,
 * so it looks peeled off a sticker sheet. Purely decorative (aria-hidden).
 */
type Name = "heart" | "star" | "bow" | "flower" | "cherry" | "butterfly" | "sparkle" | "hanger" | "cloud" | "strawberry";

const STROKE = { stroke: "#fff", strokeWidth: 3, strokeLinejoin: "round" as const, paintOrder: "stroke" as const };

const ART: Record<Name, React.ReactNode> = {
  heart: <path {...STROKE} d="M16 28S3 20 3 11a6.5 6.5 0 0 1 13-1 6.5 6.5 0 0 1 13 1c0 9-13 17-13 17Z" fill="#f47b96" />,
  star: <path {...STROKE} d="m16 3 3.6 8 8.4.8-6.4 5.6 1.9 8.4L16 21.5 8.5 25.8l1.9-8.4L4 11.8l8.4-.8Z" fill="#ffd45e" />,
  bow: (
    <g {...STROKE}>
      <path d="M16 14C12 7 4 5 3 10s5 9 13 4Zm0 0c4-7 12-9 13-4s-5 9-13 4Z" fill="#f47b96" />
      <path d="m14 15-4 12 3-1 2 3 1-13m2-1 4 12-3-1-2 3-1-13" fill="#e2546f" />
      <circle cx="16" cy="14.5" r="2.8" fill="#e2546f" />
    </g>
  ),
  flower: (
    <g {...STROKE}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="16" cy="8.5" rx="4.6" ry="6" fill="#c9b7f5" transform={`rotate(${a} 16 16)`} />
      ))}
      <circle cx="16" cy="16" r="4" fill="#ffd45e" />
    </g>
  ),
  cherry: (
    <g {...STROKE}>
      <path d="M11 20c2-7 5-12 11-16M21 21c0-7 0-12 1-17" fill="none" stroke="#5f8f4e" strokeWidth="1.8" />
      <circle cx="10.5" cy="23" r="5.2" fill="#e2546f" />
      <circle cx="21.5" cy="23.5" r="5.2" fill="#f47b96" />
      <path d="M22 4c3 0 5 2 6 4-3 1-5 0-6-4Z" fill="#7fbf6a" />
    </g>
  ),
  butterfly: (
    <g {...STROKE}>
      <path d="M16 16C12 6 3 5 3 11s6 7 13 5Zm0 0c4-10 13-11 13-5s-6 7-13 5Zm0 0c-5 3-9 9-6 11s6-5 6-11Zm0 0c5 3 9 9 6 11s-6-5-6-11Z" fill="#9fd9f0" />
      <path d="M16 9v15" stroke="#3b2a2f" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </g>
  ),
  sparkle: <path {...STROKE} d="M16 2c1 7 4 11 12 14-8 3-11 7-12 14-1-7-4-11-12-14 8-3 11-7 12-14Z" fill="#ffe27a" />,
  hanger: (
    <g {...STROKE}>
      <path d="M16 4a3 3 0 0 1 3 3c0 1.5-1 2.2-2 2.8-.6.3-1 .8-1 1.4V12L4 22c-1.4.8-.8 2.4.8 2.4h22.4c1.6 0 2.2-1.6.8-2.4L16 12" fill="none" stroke="#3b2a2f" strokeWidth="2.2" strokeLinecap="round" />
    </g>
  ),
  cloud: <path {...STROKE} d="M9 25a6 6 0 0 1-.6-12A8 8 0 0 1 24 11.5 6.8 6.8 0 0 1 23.5 25Z" fill="#cfe9ff" />,
  strawberry: (
    <g {...STROKE}>
      <path d="M16 29C8 24 5 17 7 12c3-3 15-3 18 0 2 5-1 12-9 17Z" fill="#f05a74" />
      <path d="M9 11c2-4 4-5 7-3 3-2 5-1 7 3-3 1-11 1-14 0Z" fill="#6cbf62" />
      {[[12, 16], [19, 15], [15, 21], [20, 21], [11, 22]].map(([x, y]) => (
        <ellipse key={`${x}${y}`} cx={x} cy={y} rx=".9" ry="1.3" fill="#ffe3a3" stroke="none" />
      ))}
    </g>
  ),
};

export function Sticker({ name, className, size = 32, tilt = 0, wiggle }: { name: Name; className?: string; size?: number; tilt?: number; wiggle?: boolean }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("pointer-events-none select-none drop-shadow-[0_2px_2px_rgba(59,42,47,0.18)]", wiggle && "animate-wiggle", className)}
      style={{ rotate: `${tilt}deg` }}
    >
      {ART[name]}
    </svg>
  );
}

const TAPES = ["var(--tape-pink)", "var(--tape-mint)", "var(--tape-butter)", "var(--tape-lilac)"];
const PATTERNS = ["tape-dots", "tape-stripes", "", "tape-grid"];

/** A strip of washi tape. `seed` picks a colour/pattern so neighbours differ. */
export function Tape({ seed = 0, className, style }: { seed?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className={cn("tape", PATTERNS[seed % PATTERNS.length], className)}
      style={{ ["--tape" as string]: TAPES[seed % TAPES.length], ...style }}
    />
  );
}

/** Small deterministic tilt for polaroids/cards, so a grid looks hand-placed. */
export const tiltFor = (i: number) => [-2.2, 1.4, -0.8, 2, -1.6, 0.9][i % 6];
