/**
 * A sticky note: a recipe as a candidate or a choice, something you can pick up and put somewhere.
 * Loose notes sit lifted and slightly turned; a placed note is pressed flat. Pointer drag is primary;
 * a click (or Enter) picks it up for the tap-then-tap path. The drop
 * target is whatever `[data-drop]` element lies under the pointer when it is released.
 * Signal materials, see docs/design-system.md.
 */
import { type CSSProperties, type PointerEvent as ReactPointerEvent, useRef } from "react";
import css from "./signal.module.css";

export type NoteProps = {
  title: string;
  meta?: string | null;
  imageUrl?: string | null;
  /** One line with an ellipsis (in a row or a slot) instead of up to three lines (in a tray). */
  compact?: boolean;
  /** Placed notes lie flat (no rotation, hairline shadow); loose ones sit lifted on the sheet. */
  placed?: boolean;
  rotate?: number;
  picked: boolean;
  onPick: () => void;
  /** Called with the `data-drop` value under the pointer on release. */
  onDrop: (target: string) => void;
  onOver: (target: string | null) => void;
};

export const dropTargetAt = (x: number, y: number): string | null => {
  const hit = document.elementsFromPoint(x, y).find((el) => (el as HTMLElement).dataset?.drop);
  return (hit as HTMLElement | undefined)?.dataset.drop ?? null;
};

export function Note({
  title,
  meta,
  imageUrl,
  compact,
  placed,
  rotate,
  picked,
  onPick,
  onDrop,
  onOver,
}: NoteProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    ref.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    el.classList.add(css.dragging);
    el.style.transform = `translate(${dx}px, ${dy}px) rotate(-1deg) scale(1.02)`;
    onOver(dropTargetAt(e.clientX, e.clientY));
  };
  const finish = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d || !el) return;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    onOver(null);
    if (!d.moved) {
      el.style.transform = "";
      onPick();
      return;
    }
    el.classList.remove(css.dragging);
    const target = e.type === "pointercancel" ? null : dropTargetAt(e.clientX, e.clientY);
    // FLIP: the note re-renders in its new home; animate from where it was dropped.
    const from = el.getBoundingClientRect();
    el.style.transform = "";
    if (target) onDrop(target);
    requestAnimationFrame(() => {
      const node = ref.current ?? el;
      const to = node.getBoundingClientRect();
      const ddx = from.left - to.left;
      const ddy = from.top - to.top;
      if (!ddx && !ddy) return;
      node.style.transition = "none";
      node.style.transform = `translate(${ddx}px, ${ddy}px) rotate(-1deg) scale(1.02)`;
      requestAnimationFrame(() => {
        node.style.transition = "";
        node.classList.add(css.settling);
        node.style.transform = "";
        setTimeout(() => node.classList.remove(css.settling), 250);
      });
    });
  };

  const cls = `${compact ? css.noteCompact : css.noteFull} ${placed ? css.placed : ""} ${picked ? css.picked : ""}`;
  return (
    <button
      ref={ref}
      type="button"
      className={cls}
      style={rotate !== undefined ? ({ "--r": `${rotate}deg` } as CSSProperties) : undefined}
      aria-pressed={picked}
      aria-label={`${title}${picked ? ", picked up" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onClick={(e) => {
        // keyboard activation arrives as a click with no pointer sequence
        if (e.detail === 0) onPick();
      }}
    >
      {!compact && imageUrl ? <img className={css.notePhoto} src={imageUrl} alt="" /> : null}
      <span className={css.noteTitle}>{title}</span>
      {!compact && meta ? <span className={css.noteMeta}>{meta}</span> : null}
    </button>
  );
}
