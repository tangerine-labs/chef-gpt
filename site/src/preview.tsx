import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../packages/ui/signal.css";
import "../../packages/ui/tokens.css";
import {
  Celebration,
  Drawing,
  Notice,
  RoundBuilderView,
  type ShoppingList,
  ShoppingListView,
  VoteView,
  WeekPlanView,
} from "../../packages/ui/mod.ts";
import css from "../../packages/ui/views/signal.module.css";
import * as fx from "./fixtures.ts";

type Story = { name: string; width: number; render: () => React.ReactNode };

/** A celebration plays once; the button remounts the story so it plays again. */
function Replay({ children }: { children: () => React.ReactNode }) {
  const [k, setK] = useState(0);
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setK(k + 1)}
        style={{
          position: "absolute",
          right: 8,
          bottom: 8,
          zIndex: 20,
          fontSize: 12,
          fontFamily: "system-ui",
        }}
      >
        Replay
      </button>
      <div key={k}>{children()}</div>
    </div>
  );
}
/** A closed round's ranked list on a sheet: the moment the celebration lands (no view shows this yet). */
function ClosedRoundSheet({ children }: { children?: React.ReactNode }) {
  const ordinal = (n: number) =>
    `${n}${["th", "st", "nd", "rd"][n % 10 < 4 && (n < 10 || n > 20) ? n % 10 : 0]}`;
  return (
    <div className={css.desk}>
      <div className={css.sheet}>
        <div className={css.head}>
          <p className={css.label}>Round · Week 37</p>
          <p className={css.labelMuted}>Closed · 3 of 3 rated</p>
        </div>
        <h1 className={css.title}>Ranked list</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
          {fx.ranked.map((r) => (
            <div key={r.recipeId} className={`${css.noteFull} ${css.placed}`}>
              {r.imageUrl ? <img className={css.notePhoto} src={r.imageUrl} alt="" /> : null}
              <span className={css.noteTitle}>{r.title}</span>
              <span className={css.noteMeta}>
                {ordinal(r.rank)} · {r.points} p
              </span>
            </div>
          ))}
        </div>
        <p className={`${css.body} ${css.muted}`}>No winner. Pick by hand: drag them onto the week.</p>
        {children}
      </div>
    </div>
  );
}

const stories: Story[] = [
  { name: "Sheet — drawing", width: 400, render: () => <Drawing /> },
  {
    name: "Sheet — notice",
    width: 400,
    render: () => (
      <Notice
        action={
          <button type="button" className={css.btnSmall}>
            Try again
          </button>
        }
      >
        No round is open. Ask for one in Claude: "start a round".
      </Notice>
    ),
  },
  {
    name: "Sheet — error",
    width: 400,
    render: () => <Notice tone="error">Your sign-in has expired. Sign in again.</Notice>,
  },
  {
    name: "Shopping list — mixed",
    width: 600,
    render: () => (
      <ShoppingListView
        list={fx.shopping}
        onToggle={(item, checked) => {
          const items = fx.shopping.items.map((i) => (i.id === item.id ? { ...i, checked } : i));
          return fx.later<ShoppingList>({ items, uncheckedCount: items.filter((i) => !i.checked).length });
        }}
        onAdd={(name) =>
          fx.later<ShoppingList>({
            items: [
              ...fx.shopping.items,
              { id: `n${Date.now()}`, name, quantity: null, unit: null, checked: false, recipeTitle: null },
            ],
            uncheckedCount: fx.shopping.uncheckedCount + 1,
          })
        }
        onClear={() =>
          fx.later<ShoppingList>({ items: fx.shopping.items.filter((i) => !i.checked), uncheckedCount: 3 })
        }
      />
    ),
  },
  {
    name: "Shopping list — toggle fails (reverts)",
    width: 600,
    render: () => (
      <ShoppingListView
        list={fx.shopping}
        onToggle={() => fx.later(fx.shopping, 800, "Network down")}
        onAdd={() => fx.later(fx.shopping)}
        onClear={() => fx.later(fx.shopping)}
      />
    ),
  },
  {
    name: "Shopping list — empty",
    width: 400,
    render: () => (
      <ShoppingListView
        list={fx.emptyShopping}
        onToggle={() => fx.later(fx.emptyShopping)}
        onAdd={() => fx.later(fx.emptyShopping)}
        onClear={() => fx.later(fx.emptyShopping)}
      />
    ),
  },
  {
    name: "Vote",
    width: 600,
    render: () => (
      <VoteView
        round={{ id: "round1", label: "Week 37", participants: fx.members }}
        candidates={fx.candidates}
        onSubmit={(memberId) => fx.later(`${memberId} ranked. 2 of 3 have voted.`)}
      />
    ),
  },
  {
    name: "Vote — long names",
    width: 700,
    render: () => (
      <VoteView
        round={{
          id: "round1",
          label: "Week 37",
          participants: [
            { memberId: "a", name: "irena.soderqvist", hasVoted: false },
            { memberId: "b", name: "Dennis Söderqvist", hasVoted: true },
            { memberId: "c", name: "Adrian", hasVoted: false },
            { memberId: "d", name: "Leo", hasVoted: false },
          ],
        }}
        candidates={fx.candidates}
        onSubmit={() => fx.later("Your ranking is in.")}
      />
    ),
  },
  {
    name: "Vote — rating",
    width: 600,
    render: () => (
      <VoteView
        round={{ id: "round1", label: "Week 37", participants: fx.members }}
        candidates={fx.candidates}
        onSubmit={() => fx.later("Your ranking is in.")}
        initial={{ memberId: "m2", tiers: { r2: "S", r3: "B" } }}
      />
    ),
  },
  {
    name: "Vote — rating, narrow",
    width: 360,
    render: () => (
      <VoteView
        round={{ id: "round1", label: "Week 37", participants: fx.members }}
        candidates={fx.candidates}
        onSubmit={() => fx.later("Your ranking is in.")}
        initial={{ memberId: "m2", tiers: { r2: "S" } }}
      />
    ),
  },
  {
    name: "Vote — tray empty",
    width: 600,
    render: () => (
      <VoteView
        round={{ id: "round1", label: "Week 37", participants: fx.members }}
        candidates={fx.candidates}
        onSubmit={() => fx.later("Your ranking is in.")}
        initial={{ memberId: "m2", tiers: { r1: "C", r2: "S", r3: "B", r4: "A" } }}
      />
    ),
  },
  {
    name: "Round builder",
    width: 600,
    render: () => (
      <RoundBuilderView
        members={fx.members}
        candidateDefault={10}
        onSearch={(q) => fx.later(fx.recipes.filter((r) => r.title.toLowerCase().includes(q.toLowerCase())))}
        onStart={(r) => fx.later(`Round started with ${r.candidateIds.length} candidates.`)}
      />
    ),
  },
  {
    name: "Round builder — tray filling",
    width: 600,
    render: () => (
      <RoundBuilderView
        members={fx.members}
        candidateDefault={8}
        onSearch={(q) => fx.later(fx.recipes.filter((r) => r.title.toLowerCase().includes(q.toLowerCase())))}
        onStart={(r) => fx.later(`Round started with ${r.candidateIds.length} candidates.`)}
        initial={{ query: "spaghetti", results: fx.recipes, candidates: fx.recipes.slice(1, 3) }}
      />
    ),
  },
  {
    name: "Celebration — first round closed",
    width: 600,
    render: () => (
      <Replay>
        {() => (
          <ClosedRoundSheet>
            <Celebration text="First round · 8 Sep 2026" />
          </ClosedRoundSheet>
        )}
      </Replay>
    ),
  },
  {
    name: "Week plan",
    width: 600,
    render: () => <WeekPlanView week={fx.week} ranked={fx.ranked} onSet={fx.weekSetter(fx.week)} />,
  },
  {
    name: "Week plan — no round yet",
    width: 400,
    render: () => <WeekPlanView week={fx.week} ranked={[]} onSet={fx.weekSetter(fx.week)} />,
  },
];

function Gallery() {
  const params = new URL(location.href).searchParams;
  const only = params.get("story");
  const [dark, setDark] = useState(params.get("theme") === "dark");
  // the host stamps data-theme on the root; Signal tokens follow it
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  const shown = only ? stories.filter((s) => s.name === only) : stories;
  return (
    <div
      style={{
        padding: 24,
        display: "grid",
        gap: 32,
        background: dark ? "#1c1917" : "#f5f5f4",
        color: dark ? "#fafaf9" : "#1c1917",
        minHeight: "100vh",
      }}
    >
      {!only && (
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={dark} onChange={(e) => setDark(e.currentTarget.checked)} /> dark
        </label>
      )}
      {shown.map((s) => (
        <section key={s.name} id={s.name}>
          <h2 style={{ fontSize: 13, opacity: 0.6, margin: "0 0 8px", fontFamily: "system-ui" }}>
            <a href={`?story=${encodeURIComponent(s.name)}`} style={{ color: "inherit" }}>
              {s.name}
            </a>{" "}
            · {s.width}px
          </h2>
          <div
            style={{
              width: s.width,
              maxWidth: "100%",
              border: "1px solid rgba(128,128,128,.3)",
              borderRadius: 12,
              overflow: "hidden",
              background: dark ? "#292524" : "#fff",
              colorScheme: dark ? "dark" : "light",
            }}
          >
            {s.render()}
          </div>
        </section>
      ))}
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Gallery />);
