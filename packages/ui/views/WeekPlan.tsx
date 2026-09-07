/**
 * Week plan: the meal plan as a sheet of seven day rows with the latest ranked list as a tray of
 * notes beneath. Drag a note onto a day (primary), or tap/Enter a note then a day. A placed note
 * lies flat; dragging it back to the tray clears the day. Free text such as "eating out" is written
 * in pen. Signal materials, see docs/design-system.md.
 */
import { useEffect, useRef, useState } from "react";
import "../signal.css";
import { Note } from "./Note.tsx";
import css from "./signal.module.css";
import { dayName, errorText, type Ranked, type Slot, type Week } from "./types.ts";

export type SlotChange = { recipeId: string } | { title: string } | { clear: true };

export interface WeekPlanProps {
  week: Week;
  ranked: Ranked[];
  /** Persist a slot change; `line` is the one-line summary for the chat. Resolves to the new week. */
  onSet: (date: string, change: SlotChange, line: string) => Promise<Week>;
}

const ordinal = (n: number) =>
  `${n}${["th", "st", "nd", "rd"][n % 10 < 4 && (n < 11 || n > 13) ? n % 10 : 0]}`;

export function WeekPlanView({ week: initial, ranked, onSet }: WeekPlanProps) {
  const [week, setWeek] = useState<Week | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [typing, setTyping] = useState<{ date: string; text: string } | null>(null);
  const [error, setError] = useState("");
  const [live, setLive] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const w = week ?? initial;

  const dinner = (d: { slots: Slot[] }) => d.slots.find((s) => s.mealType === "dinner");
  const plannedIds = new Set(w.days.map((d) => dinner(d)?.recipe?.id).filter(Boolean));
  const tray = ranked.filter((r) => !plannedIds.has(r.recipeId));

  const say = (text: string) => {
    setLive("");
    requestAnimationFrame(() => setLive(text));
  };

  useEffect(() => {
    if (typing) inputRef.current?.focus();
  }, [typing]);
  useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPicked(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [picked]);

  type Change = { date: string; change: SlotChange; line: string };

  /** Show the changes at once, persist them in order, and put things back if the server refuses. */
  const apply = async (changes: Change[], optimistic: Week) => {
    setError("");
    setPicked(null);
    setTyping(null);
    const before = w;
    setWeek(optimistic);
    say(changes.map((c) => c.line).join(" "));
    try {
      let next = optimistic;
      for (const c of changes) next = await onSet(c.date, c.change, c.line);
      setWeek(next);
    } catch (e) {
      setWeek(before);
      setError(errorText(e));
    }
  };

  const dinnerSlot = (date: string, recipe: Slot["recipe"], title: string | null): Slot => ({
    date,
    mealType: "dinner",
    recipe,
    title,
  });
  /** The week with one day's dinner replaced (or removed when `slot` is null). */
  const withDinners = (edits: Record<string, Slot | null>): Week => ({
    ...w,
    days: w.days.map((d) =>
      d.date in edits
        ? {
            ...d,
            slots: [
              ...d.slots.filter((s) => s.mealType !== "dinner"),
              ...(edits[d.date] ? [edits[d.date] as Slot] : []),
            ],
          }
        : d,
    ),
  });

  const place = (recipeId: string, date: string) => {
    const fromDay = w.days.find((d) => dinner(d)?.recipe?.id === recipeId);
    if (fromDay?.date === date) return;
    const r = ranked.find((x) => x.recipeId === recipeId);
    const title = r?.title ?? (fromDay ? (dinner(fromDay)?.recipe?.title ?? "") : "");
    const slot = dinnerSlot(date, { id: recipeId, title, imageUrl: r?.imageUrl ?? null }, null);
    const edits: Record<string, Slot | null> = { [date]: slot };
    const changes: Change[] = [];
    if (fromDay) {
      edits[fromDay.date] = null;
      changes.push({
        date: fromDay.date,
        change: { clear: true },
        line: `${dayName(fromDay.date)}: cleared.`,
      });
    }
    changes.push({ date, change: { recipeId }, line: `${dayName(date)}: ${title}.` });
    apply(changes, withDinners(edits));
  };
  const clear = (date: string) => {
    apply(
      [{ date, change: { clear: true }, line: `${dayName(date)}: cleared.` }],
      withDinners({ [date]: null }),
    );
  };
  const write = (date: string, text: string) => {
    apply(
      [{ date, change: { title: text }, line: `${dayName(date)}: ${text}.` }],
      withDinners({ [date]: dinnerSlot(date, null, text) }),
    );
  };

  const drop = (recipeId: string) => (target: string) => {
    if (target === "tray") {
      const day = w.days.find((d) => dinner(d)?.recipe?.id === recipeId);
      if (day) clear(day.date);
      return;
    }
    place(recipeId, target);
  };

  return (
    <div className={css.desk}>
      <div className={`${css.sheet} ${picked ? css.picking : ""}`}>
        <div className={css.head}>
          <p className={css.label}>Meal plan · week of {w.weekStart.slice(5)}</p>
          <p className={css.labelMuted}>Monday start · dinners</p>
        </div>

        <section className={css.days} aria-label="Days">
          {w.days.map((d) => {
            const s = dinner(d);
            const isTyping = typing?.date === d.date;
            return (
              <div
                key={d.date}
                className={`${css.day} ${over === d.date ? css.over : ""}`}
                data-drop={d.date}
              >
                <div className={css.date}>
                  <b>{dayName(d.date)}</b>
                  {d.date.slice(8)}
                </div>
                <div className={css.slot}>
                  {isTyping ? (
                    <input
                      ref={inputRef}
                      className={css.penInput}
                      placeholder="eating out, leftovers…"
                      aria-label={`What's for dinner on ${dayName(d.date)}`}
                      value={typing.text}
                      onChange={(e) => setTyping({ date: d.date, text: e.currentTarget.value })}
                      onKeyDown={(e) => {
                        const text = typing.text.trim();
                        if (e.key === "Enter" && text) write(d.date, text);
                        if (e.key === "Escape") setTyping(null);
                      }}
                      onBlur={() => setTyping(null)}
                    />
                  ) : s?.recipe ? (
                    <Note
                      title={s.recipe.title}
                      compact
                      placed
                      picked={picked === s.recipe.id}
                      onPick={() => setPicked(picked === s.recipe?.id ? null : (s.recipe?.id ?? null))}
                      onDrop={drop(s.recipe.id)}
                      onOver={setOver}
                    />
                  ) : s?.title ? (
                    <span className={css.pen}>{s.title}</span>
                  ) : (
                    <span className={css.dash}>—</span>
                  )}
                  <button
                    type="button"
                    className={css.drop}
                    aria-label={`Put it on ${dayName(d.date)}`}
                    disabled={!picked}
                    onClick={() => picked && place(picked, d.date)}
                  >
                    Put it here
                  </button>
                </div>
                {!isTyping && !picked && (
                  <div className={css.dayActions}>
                    <button
                      type="button"
                      className={css.btnSmall}
                      onClick={() => setTyping({ date: d.date, text: "" })}
                      aria-label={`Write on ${dayName(d.date)}`}
                    >
                      Write
                    </button>
                    {s && (
                      <button
                        type="button"
                        className={css.btnSmall}
                        onClick={() => clear(d.date)}
                        aria-label={`Clear ${dayName(d.date)}`}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <div className={css.tray} data-drop="tray">
          <p className={css.labelMuted}>
            {ranked.length === 0
              ? "No closed round yet · write dinners in, or start a round"
              : `Ranked list · ${tray.length} of ${ranked.length} left${picked ? " · pick a day" : ""}`}
          </p>
          {ranked.length === 0 ? null : tray.length === 0 ? (
            <div className={css.trayEmpty} aria-hidden="true" />
          ) : (
            <div className={css.trayNotes}>
              {tray.map((r, i) => (
                <Note
                  key={r.recipeId}
                  title={r.title}
                  meta={`${ordinal(r.rank)} · ${r.points} p`}
                  imageUrl={r.imageUrl}
                  rotate={i % 2 ? 0.8 : -0.7}
                  picked={picked === r.recipeId}
                  onPick={() => setPicked(picked === r.recipeId ? null : r.recipeId)}
                  onDrop={drop(r.recipeId)}
                  onOver={setOver}
                />
              ))}
            </div>
          )}
        </div>

        <p className={css.err}>{error}</p>
        <p className={css.sr} aria-live="polite">
          {live}
        </p>
      </div>
    </div>
  );
}
