import { ThemeProvider, useCallTool, useSendFollowUp, useToolContext } from "mcp-use/react";
import { useState } from "react";
import css from "../shared.module.css";

type SlotT = {
  date: string;
  mealType: string;
  recipe: { id: string; title: string; imageUrl: string | null } | null;
  title: string | null;
};
type Week = { weekStart: string; days: { date: string; slots: SlotT[] }[] };
type Ranked = { recipeId: string; title: string; points: number; rank: number; imageUrl: string | null };
type Output = { week: Week; ranked: Ranked[] };

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayName = (date: string) => DAY[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];

function Plan() {
  const ctx = useToolContext();
  const setSlot = useCallTool("set_slot");
  const sendFollowUp = useSendFollowUp();
  const [week, setWeek] = useState<Week | null>(null);
  const [picked, setPicked] = useState<Ranked | null>(null);
  const [typing, setTyping] = useState<{ date: string; text: string } | null>(null);
  const [error, setError] = useState("");

  if (ctx.status === "pending") return <main className={css.app}>Loading…</main>;
  if (ctx.status === "error")
    return <main className={css.app}>{String(ctx.error?.message ?? "Something went wrong")}</main>;
  const out = ctx.toolOutput as Output;
  const w = week ?? out.week;

  const dinner = (d: { slots: SlotT[] }) => d.slots.find((s) => s.mealType === "dinner");

  const apply = async (date: string, args: Record<string, unknown>, line: string) => {
    setError("");
    try {
      const res = await setSlot.callTool({ date, mealType: "dinner", ...args });
      setWeek((res.structuredContent as Output).week);
      setPicked(null);
      setTyping(null);
      await sendFollowUp({ prompt: line });
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  };

  return (
    <main className={css.app}>
      <h1 className={css.h}>Week of {w.weekStart}</h1>
      {out.ranked.length > 0 && (
        <>
          <p className={css.sub}>
            {picked ? `Placing “${picked.title}” — tap a day` : "Latest round — tap a dinner, then a day"}
          </p>
          <div className={css.row}>
            {out.ranked.map((r) => (
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
                      if (e.key === "Enter" && typing.text.trim()) {
                        apply(
                          d.date,
                          { title: typing.text.trim() },
                          `${dayName(d.date)}: ${typing.text.trim()}.`,
                        );
                      }
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

export default function WeekPlanView() {
  return (
    <ThemeProvider>
      <Plan />
    </ThemeProvider>
  );
}
