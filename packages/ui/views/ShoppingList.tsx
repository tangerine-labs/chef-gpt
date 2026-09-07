/**
 * Shopping list: the household's one running list as a spiral-bound notepad sheet, torn at the
 * bottom and taped to the desk. One item per rule, a pen tick to check, a small pen note naming
 * the recipe the item came from. Checked items are struck in pen and stay until cleared.
 * Signal materials, see docs/design-system.md.
 */
import { useState } from "react";
import "../signal.css";
import css from "./signal.module.css";
import { errorText, type ShoppingList as ListT, type ShoppingItem } from "./types.ts";

export interface ShoppingListProps {
  list: ListT;
  /** Persist a toggle; the box flips before this resolves and reverts if it rejects. */
  onToggle: (item: ShoppingItem, checked: boolean) => Promise<ListT>;
  onAdd: (name: string) => Promise<ListT>;
  onClear: () => Promise<ListT>;
}

const Tick = () => (
  <svg viewBox="0 0 24 22" aria-hidden="true">
    <path d="M4 12 L9.5 18 L21 3" />
  </svg>
);

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
    <div className={css.desk}>
      <div className={css.padWrap}>
        <div className={`${css.pad} ${css.tapedCorners}`}>
          <div className={css.padSpiral} aria-hidden="true" />
          <div className={css.padHead}>
            <h1 className={css.padTitle}>Shopping list</h1>
            <p className={css.labelMuted}>{out.uncheckedCount} to buy</p>
          </div>

          {out.items.length === 0 ? (
            <div className={css.padEmpty}>Nothing on the list.</div>
          ) : (
            out.items.map((i) => (
              <button
                key={i.id}
                type="button"
                className={`${css.item} ${i.checked ? css.done : ""}`}
                aria-pressed={i.checked}
                onClick={() => toggle(i)}
              >
                <span className={css.box} aria-hidden="true">
                  {i.checked ? <Tick /> : null}
                </span>
                <span className={css.itemText}>
                  {(i.quantity || i.unit) && (
                    <span className={css.qty}>{[i.quantity, i.unit].filter(Boolean).join(" ")}</span>
                  )}
                  <span className={css.itemName}>{i.name}</span>
                  {i.recipeTitle && (
                    <span className={css.from} title={i.recipeTitle}>
                      {i.recipeTitle}
                    </span>
                  )}
                </span>
              </button>
            ))
          )}

          <div className={css.addRow}>
            <span className={css.box} aria-hidden="true" />
            <input
              className={css.penInput}
              placeholder="add an item…"
              aria-label="Add an item"
              value={text}
              onChange={(e) => setText(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
            />
          </div>

          <div className={css.padFoot}>
            <p className={css.err}>{error}</p>
            {checkedCount > 0 && (
              <button type="button" className={css.btn} onClick={() => run(onClear)}>
                Clear {checkedCount} bought
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
