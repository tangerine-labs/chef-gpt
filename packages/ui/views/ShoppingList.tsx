import { useState } from "react";
import css from "./shared.module.css";
import { errorText, type ShoppingList as ListT, type ShoppingItem } from "./types.ts";

export interface ShoppingListProps {
  list: ListT;
  /** Persist a toggle; the box flips before this resolves and reverts if it rejects. */
  onToggle: (item: ShoppingItem, checked: boolean) => Promise<ListT>;
  onAdd: (name: string) => Promise<ListT>;
  onClear: () => Promise<ListT>;
}

export function ShoppingListView({ list, onToggle, onAdd, onClear }: ShoppingListProps) {
  const [state, setState] = useState<ListT | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const out = state ?? list;
  const checkedCount = out.items.length - out.uncheckedCount;

  const run = (fn: () => Promise<ListT>) => {
    setError("");
    fn()
      .then(setState)
      .catch((e) => setError(errorText(e)));
  };

  const toggle = (item: ShoppingItem) => {
    const next = !item.checked;
    const before = out;
    const items = out.items.map((i) => (i.id === item.id ? { ...i, checked: next } : i));
    setState({ items, uncheckedCount: items.filter((i) => !i.checked).length });
    setError("");
    onToggle(item, next)
      .then(setState)
      .catch((e) => {
        setState(before);
        setError(errorText(e));
      });
  };

  const add = () => {
    const name = text.trim();
    if (!name) return;
    setText("");
    run(() => onAdd(name));
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
            if (e.key === "Enter") add();
          }}
        />
        <button type="button" className={css.btn} disabled={!text.trim()} onClick={add}>
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
        <button type="button" className={css.btn} onClick={() => run(onClear)}>
          Clear {checkedCount} checked
        </button>
      )}
      <p className={css.err}>{error}</p>
    </main>
  );
}
