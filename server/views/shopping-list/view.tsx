import { ThemeProvider, useCallTool, useSendFollowUp, useToolContext } from "mcp-use/react";
import { useState } from "react";
import css from "../shared.module.css";

type Item = {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  checked: boolean;
  recipeTitle: string | null;
};
type Output = { items: Item[]; uncheckedCount: number };

function List() {
  const ctx = useToolContext();
  const update = useCallTool("update_shopping_item");
  const add = useCallTool("add_shopping_item");
  const clear = useCallTool("clear_checked");
  const sendFollowUp = useSendFollowUp();
  const [state, setState] = useState<Output | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  if (ctx.status === "pending") return <main className={css.app}>Loading…</main>;
  if (ctx.status === "error")
    return <main className={css.app}>{String(ctx.error?.message ?? "Something went wrong")}</main>;
  const out = state ?? (ctx.toolOutput as Output);

  const run = async (fn: () => Promise<{ structuredContent?: unknown }>, followUp?: string) => {
    setError("");
    try {
      const res = await fn();
      setState(res.structuredContent as Output);
      if (followUp) await sendFollowUp({ prompt: followUp });
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  };

  const checkedCount = out.items.length - out.uncheckedCount;

  // Flip locally first; the server's reply (or an error revert) follows.
  const toggle = (item: Item) => {
    const next = !item.checked;
    const before = out;
    const items = out.items.map((i) => (i.id === item.id ? { ...i, checked: next } : i));
    setState({ items, uncheckedCount: items.filter((i) => !i.checked).length });
    setError("");
    update
      .callTool({ itemId: item.id, checked: next })
      .then((res) => setState(res.structuredContent as Output))
      .catch((e) => {
        setState(before);
        setError(String((e as Error).message ?? e));
      });
  };

  return (
    <main className={css.app}>
      <h1 className={css.h}>Shopping list ({out.uncheckedCount})</h1>
      <div className={css.row}>
        <input
          className={css.input}
          placeholder="Add an item…"
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) {
              run(() => add.callTool({ name: text.trim() }));
              setText("");
            }
          }}
        />
        <button
          type="button"
          className={css.btn}
          disabled={!text.trim() || add.isPending}
          onClick={() => {
            run(() => add.callTool({ name: text.trim() }));
            setText("");
          }}
        >
          Add
        </button>
      </div>
      <div className={css.list} style={{ maxHeight: 420 }}>
        {out.items.map((i) => (
          <label key={i.id} className={css.card} style={{ cursor: "pointer", opacity: i.checked ? 0.6 : 1 }}>
            <input
              type="checkbox"
              checked={i.checked}
              onChange={() => toggle(i)}
              style={{ width: 20, height: 20, margin: 0, flex: "none" }}
            />
            <span className={css.grow}>
              <span className={css.title} style={{ textDecoration: i.checked ? "line-through" : "none" }}>
                {[i.quantity, i.unit, i.name].filter(Boolean).join(" ")}
              </span>
              {i.recipeTitle && <span className={css.meta}> · {i.recipeTitle}</span>}
            </span>
          </label>
        ))}
        {out.items.length === 0 && <p className={css.sub}>Nothing on the list.</p>}
      </div>
      {checkedCount > 0 && (
        <button
          type="button"
          className={css.btn}
          disabled={clear.isPending}
          onClick={() =>
            run(() => clear.callTool({}), `Cleared ${checkedCount} item(s) from the shopping list.`)
          }
        >
          Clear {checkedCount} checked
        </button>
      )}
      <p className={css.err}>{error}</p>
    </main>
  );
}

export default function ShoppingListView() {
  return (
    <ThemeProvider>
      <List />
    </ThemeProvider>
  );
}
