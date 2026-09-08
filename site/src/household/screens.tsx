/**
 * The three screens a household member uses without Claude: the week, the vote, the shopping list.
 * Each is the presentational view from packages/ui wired to the tools over HTTP, the way
 * server/views/<name>/view.tsx wires it to the harness. The tool's output is the initial data;
 * every callback calls the tool the harness would and hands the view what comes back.
 */
import { useCallback, useEffect, useState } from "react";
import {
  type Candidate,
  Drawing,
  Notice,
  type Participant,
  type Ranked,
  type ShoppingList,
  ShoppingListView,
  VoteView,
  type Week,
  WeekPlanView,
} from "../../../packages/ui/mod.ts";
import css from "../../../packages/ui/views/signal.module.css";
import { callTool, NotSignedIn, ToolError } from "../mcp.ts";

type Load<T> =
  | { kind: "loading" }
  | { kind: "ready"; data: T }
  | { kind: "empty"; text: string } // the tool said no in words: nothing open, nothing there
  | { kind: "error"; text: string };

/** Call a read tool on mount; `again` calls it again (after an error, or when the data went stale). */
function useTool<T>(name: string, args: Record<string, unknown> = {}): [Load<T>, () => void] {
  const [state, setState] = useState<Load<T>>({ kind: "loading" });
  const [run, setRun] = useState(0);
  const key = JSON.stringify(args);
  useEffect(() => {
    let live = true;
    setState({ kind: "loading" });
    callTool<T>(name, JSON.parse(key))
      .then((data) => live && setState({ kind: "ready", data }))
      .catch((e: unknown) => {
        if (!live) return;
        if (e instanceof ToolError) setState({ kind: "empty", text: e.message });
        else if (e instanceof NotSignedIn) setState({ kind: "error", text: e.message });
        else setState({ kind: "error", text: String((e as Error)?.message ?? e) });
      });
    return () => {
      live = false;
    };
  }, [name, key, run]);
  const again = useCallback(() => setRun((n) => n + 1), []);
  return [state, again];
}

function Waiting<T>({
  state,
  again,
  children,
}: {
  state: Load<T>;
  again: () => void;
  children: (d: T) => React.ReactNode;
}) {
  if (state.kind === "loading") return <Drawing />;
  const retry = (
    <button type="button" className={css.btnSmall} onClick={again}>
      Try again
    </button>
  );
  if (state.kind === "empty") return <Notice action={retry}>{state.text}</Notice>;
  if (state.kind === "error")
    return (
      <Notice tone="error" action={retry}>
        {state.text}
      </Notice>
    );
  return <>{children(state.data)}</>;
}

type WeekOut = { week: Week; ranked: Ranked[] };

export function WeekScreen() {
  const [state, again] = useTool<WeekOut>("show_week");
  return (
    <Waiting state={state} again={again}>
      {({ week, ranked }) => (
        <WeekPlanView
          week={week}
          ranked={ranked}
          onSet={async (date, change) => {
            const r = await callTool<{ week: Week }>("set_slot", { date, mealType: "dinner", ...change });
            return r.week;
          }}
        />
      )}
    </Waiting>
  );
}

type VoteOut = { round: { id: string; label: string; participants: Participant[] }; candidates: Candidate[] };

export function VoteScreen() {
  const [state, again] = useTool<VoteOut>("open_voting");
  return (
    <Waiting state={state} again={again}>
      {({ round, candidates }) => (
        <VoteView
          round={round}
          candidates={candidates}
          onSubmit={async (memberId, entries) => {
            const s = await callTool<{ votedCount: number; total: number; closed: boolean }>(
              "submit_ranking",
              {
                roundId: round.id,
                memberId,
                entries,
              },
            );
            return s.closed
              ? "That was the last vote — the round is closed."
              : `Your ranking is in. ${s.votedCount} of ${s.total} have voted.`;
          }}
        />
      )}
    </Waiting>
  );
}

export function ShoppingScreen() {
  const [state, again] = useTool<ShoppingList>("show_shopping_list");
  return (
    <Waiting state={state} again={again}>
      {(list) => (
        <ShoppingListView
          list={list}
          onToggle={(item, checked) =>
            callTool<ShoppingList>("update_shopping_item", { itemId: item.id, checked })
          }
          onAdd={(name) => callTool<ShoppingList>("add_shopping_item", { name })}
          onClear={() => callTool<ShoppingList>("clear_checked")}
        />
      )}
    </Waiting>
  );
}
