/**
 * The sheet before and instead of a view. While a tool runs, the sheet draws itself (the dot grid
 * fades in, four rules draw left to right, once; docs/design-system.md, States). When there is
 * nothing to show, a Notice prints one line on the sheet: an error in red pen, anything else in
 * print. The harness frame and the website's household screens share both.
 */
import type { ReactNode } from "react";
import css from "./signal.module.css";

export function Drawing() {
  return (
    <output className={css.desk} style={{ display: "block" }} aria-busy="true" aria-label="Loading">
      <style>{`
        @keyframes sg-rule { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes sg-fade { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .sg-draw * { animation: none !important; } }
      `}</style>
      <div
        className={`${css.sheet} sg-draw`}
        style={{ minHeight: 200, animation: "sg-fade 300ms ease both" }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 1,
              background: "var(--sg-rule)",
              transformOrigin: "left",
              animation: `sg-rule 260ms ease ${120 + i * 110}ms both`,
              marginTop: i === 0 ? 8 : 44,
              opacity: i === 0 ? 1 : 0.5,
            }}
          />
        ))}
      </div>
    </output>
  );
}

export function Notice({
  tone = "print",
  children,
  action,
}: {
  tone?: "print" | "error";
  children: ReactNode;
  /** A button or link under the line, when there is something to do about it. */
  action?: ReactNode;
}) {
  return (
    <div className={css.desk}>
      <div className={css.sheet} style={{ minHeight: 120, alignContent: "start" }}>
        <p className={tone === "error" ? css.err : css.body}>{children}</p>
        {action ? <div className={css.row}>{action}</div> : null}
      </div>
    </div>
  );
}
