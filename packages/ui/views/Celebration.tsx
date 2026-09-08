/**
 * Celebration: the one loud state, for a household's firsts (docs/design-system.md, States).
 * Rendered inside a sheet: a ruled date stamp slams down at 400ms and the sheet shakes once, then the
 * household doodles two fineliner fireworks in the blank corner, black then red, with the ink reveal.
 * Everything stays as it landed. Plays once per mount; the view mounts it only on the tool result that
 * earned it. `prefers-reduced-motion` shows the finished sheet at once.
 *
 * The default stamp and burst positions suit a ranked-list sheet at 400 to 600px; a view with other
 * blank spots passes its own `stampAt` and `bursts`.
 */
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import "../signal.css";
import css from "./celebration.module.css";

export type Burst = {
  /** Centre and radius in sheet px. */
  x: number;
  y: number;
  r: number;
  rays: number;
  ink: "black" | "red";
  /** Start, ms after the stamp has settled. */
  at: number;
};

export type CelebrationProps = {
  /** Printed on the stamp, e.g. "First round · 8 Sep 2026". */
  text: string;
  /** Stamp centre as CSS lengths from the sheet's top-left; default 58% / 30%. */
  stampAt?: { x: string; y: string };
  /** Bursts as a function of the sheet's padding-box size; default: two in the lower right. */
  bursts?: (w: number, h: number) => Burst[];
  seed?: number;
};

export const defaultBursts = (w: number, h: number): Burst[] => [
  { x: w * 0.6, y: h - 76, r: 22, rays: 10, ink: "black", at: 0 },
  { x: w - 90, y: h - 84, r: 22, rays: 12, ink: "red", at: 400 },
];

/** The stamp lands at 400ms (celebration.module.css); the shake follows, then the doodle starts. */
const SHAKE_AT = 550;
const DOODLE_AT = 750;

/** Deterministic randomness so the same milestone doodles the same way twice (mulberry32). */
const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A hand-drawn segment: a polyline from a to b with a little wobble across it. */
const wobbly = (r: () => number, ax: number, ay: number, bx: number, by: number, amp = 1.1) => {
  const n = 5;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = i === 0 || i === n ? 0 : (r() - 0.5) * 2 * amp;
    pts.push(`${(ax + dx * t + nx * w).toFixed(1)},${(ay + dy * t + ny * w).toFixed(1)}`);
  }
  return { d: `M${pts.join("L")}`, len: len + amp * 2 };
};

const vars = (len: number, delay: number, dur?: string) =>
  ({ "--len": len, "--delay": `${delay}ms`, ...(dur ? { "--dur": dur } : {}) }) as CSSProperties;

/** One burst: a rising squiggle (black only), rays from the centre, a dash past each tip, sparks. */
function Firework({ b, r }: { b: Burst; r: () => number }) {
  const rayClass = b.ink === "red" ? css.rayRed : css.ray;
  const sparkClass = b.ink === "red" ? css.sparkRed : css.spark;
  const parts: ReactNode[] = [];
  let at = b.at;
  if (b.ink === "black") {
    const t = wobbly(r, b.x + 10, b.y + b.r + 24, b.x + 1, b.y + 5, 3);
    parts.push(<path key="trail" className={css.ray} d={t.d} style={vars(t.len, at, "260ms")} />);
    at += 260;
  }
  for (let i = 0; i < b.rays; i++) {
    const ang = (i / b.rays) * Math.PI * 2 + (r() - 0.5) * 0.25;
    const inner = b.r * (0.22 + r() * 0.1);
    const outer = b.r * (0.85 + r() * 0.2);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const ray = wobbly(r, b.x + c * inner, b.y + s * inner, b.x + c * outer, b.y + s * outer);
    parts.push(<path key={`ray${i}`} className={rayClass} d={ray.d} style={vars(ray.len, at + i * 12)} />);
    const tip = wobbly(
      r,
      b.x + c * (outer + 5),
      b.y + s * (outer + 5),
      b.x + c * (outer + 11),
      b.y + s * (outer + 11),
      0.6,
    );
    parts.push(
      <path
        key={`tip${i}`}
        className={rayClass}
        d={tip.d}
        style={vars(tip.len, at + 220 + i * 10, "120ms")}
      />,
    );
    if (i % 2 === 0)
      parts.push(
        <circle
          key={`spark${i}`}
          className={sparkClass}
          cx={b.x + c * (outer + 18)}
          cy={b.y + s * (outer + 18)}
          r={1.7}
          style={{ "--delay": `${at + 340 + i * 10}ms` } as CSSProperties}
        />,
      );
  }
  return <g>{parts}</g>;
}

const reduced = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Celebration({ text, stampAt, bursts = defaultBursts, seed = 4 }: CelebrationProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  // The overlay fills the sheet's padding box, so its own size is the sheet's; the sheet shakes
  // through the Web Animations API so the parent needs no class of ours.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setSize({ w: el.clientWidth, h: el.clientHeight });
    if (reduced() || !el.parentElement?.animate) return;
    const shake = el.parentElement.animate(
      [
        { transform: "translate(0, 0)" },
        { transform: "translate(2px, 2px)", offset: 0.2 },
        { transform: "translate(-2px, 1px)", offset: 0.45 },
        { transform: "translate(1px, -1px)", offset: 0.7 },
        { transform: "translate(0, 0)" },
      ],
      { duration: 240, delay: SHAKE_AT, easing: "ease-out" },
    );
    return () => shake.cancel();
  }, []);
  const r = rng(seed);
  const style = stampAt ? ({ "--stamp-x": stampAt.x, "--stamp-y": stampAt.y } as CSSProperties) : undefined;
  return (
    <div ref={ref} className={css.overlay} aria-hidden="true">
      <div className={css.stamp} style={style}>
        {text}
      </div>
      {size ? (
        <svg className={css.doodle} aria-hidden="true">
          {bursts(size.w, size.h).map((b, i) => (
            <Firework key={i} b={{ ...b, at: b.at + DOODLE_AT }} r={r} />
          ))}
        </svg>
      ) : null}
    </div>
  );
}
