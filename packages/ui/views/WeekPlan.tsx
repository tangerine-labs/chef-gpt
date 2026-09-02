import { useState } from "react";
import css from "./shared.module.css";
import { dayName, errorText, type Ranked, type Slot, type Week } from "./types.ts";

export type SlotChange = { recipeId: string } | { title: string } | { clear: true };

export interface WeekPlanProps {
  week: Week;
  ranked: Ranked[];
  /** Persist a slot change; `line` is the one-line summary for the chat. Resolves to the new week. */
  onSet: (date: string, change: SlotChange, line: string) => Promise<Week>;
}

export function WeekPlanView({ week: initial, ranked, onSet }: WeekPlanProps) {
  const [week, setWeek] = useState<Week | null>(null);
  const [picked, setPicked] = useState<Ranked | null>(null);
  const [typing, setTyping] = useState<{ date: string; text: string } | null>(null);
  const [error, setError] = useState("");
  const w = week ?? initial;

  const dinner = (d: { slots: Slot[] }) => d.slots.find((s) => s.mealType === "dinner");

  const apply = async (date: string, change: SlotChange, line: string) => {
    setError("");
    try {
      setWeek(await onSet(date, change, line));
      setPicked(null);
      setTyping(null);
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <main className={css.app}>
      <h1 className={css.h}>Week of {w.weekStart}</h1>
      {ranked.length > 0 && (
        <>
          <p className={css.sub}>
            {picked ? `Placing “${picked.title}” — tap a day` : "Latest round — tap a dinner, then a day"}
          </p>
          <div className={css.row}>
            {ranked.map((r) => (
              <button
                type="button"
                key={r.recipeId}
                className={`${css.tag} ${picked?.recipeId === r.recipeId ? css.tagOn : ""}`}
                onClick={() => setPicked(picked?.recipeId === r.recipeId ? null : r)}
              >
                {r.rank}. {r.title} · {r.points}p
              </button>
            ))}
          </div>
        </>
      )}
      <div className={css.list} style={{ maxHeight: 460 }}>
        {w.days.map((d) => {
          const s = dinner(d);
          return (
            <div key={d.date} className={css.card}>
              <div style={{ width: 42, fontWeight: 600, fontSize: 13 }}>
                {dayName(d.date)}
                <div className={css.meta}>{d.date.slice(8)}</div>
              </div>
              <div className={css.grow}>
                {typing?.date === d.date ? (
                  <input
                    className={css.input}
                    style={{ width: "100%" }}
                    placeholder="e.g. leftovers, eating out"
                    value={typing.text}
                    onChange={(e) => setTyping({ date: d.date, text: e.currentTarget.value })}
                    onKeyDown={(e) => {
                      const text = typing.text.trim();
                      if (e.key === "Enter" && text)
                        apply(d.date, { title: text }, `${dayName(d.date)}: ${text}.`);
                      if (e.key === "Escape") setTyping(null);
                    }}
                  />
                ) : (
                  <div className={css.title}>{s ? (s.recipe?.title ?? s.title) : "—"}</div>
                )}
              </div>
              {picked ? (
                <button
                  type="button"
                  className={`${css.btn} ${css.primary}`}
                  onClick={() =>
                    apply(d.date, { recipeId: picked.recipeId }, `${dayName(d.date)}: ${picked.title}.`)
                  }
                >
                  Place
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={css.btn}
                    onClick={() => setTyping({ date: d.date, text: "" })}
                  >
                    Type
                  </button>
                  {s && (
                    <button
                      type="button"
                      className={css.btn}
                      onClick={() => apply(d.date, { clear: true }, `${dayName(d.date)}: cleared.`)}
                    >
                      Clear
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <p className={css.err}>{error}</p>
    </main>
  );
}
