import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../packages/ui/tokens.css";
import {
  RoundBuilderView,
  type ShoppingList,
  ShoppingListView,
  VoteView,
  WeekPlanView,
} from "../../packages/ui/mod.ts";
import * as fx from "./fixtures.ts";

type Story = { name: string; width: number; render: () => React.ReactNode };

const stories: Story[] = [
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
    name: "Week plan",
    width: 600,
    render: () => <WeekPlanView week={fx.week} ranked={fx.ranked} onSet={() => fx.later(fx.week)} />,
  },
  {
    name: "Week plan — no round yet",
    width: 400,
    render: () => <WeekPlanView week={fx.week} ranked={[]} onSet={() => fx.later(fx.week)} />,
  },
];

function Gallery() {
  const params = new URL(location.href).searchParams;
  const only = params.get("story");
  const [dark, setDark] = useState(params.get("theme") === "dark");
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
