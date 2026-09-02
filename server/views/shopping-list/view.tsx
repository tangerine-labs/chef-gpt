import { ThemeProvider, useCallTool, useSendFollowUp, useToolContext } from "mcp-use/react";
import { type ShoppingList, ShoppingListView } from "../../../packages/ui/mod.ts";
import { Frame } from "../frame.tsx";

function Wired({ list }: { list: ShoppingList }) {
  const update = useCallTool("update_shopping_item");
  const add = useCallTool("add_shopping_item");
  const clear = useCallTool("clear_checked");
  const sendFollowUp = useSendFollowUp();
  const out = (r: { structuredContent?: unknown }) => r.structuredContent as ShoppingList;
  return (
    <ShoppingListView
      list={list}
      onToggle={(item, checked) => update.callTool({ itemId: item.id, checked }).then(out)}
      onAdd={(name) => add.callTool({ name }).then(out)}
      onClear={async () => {
        const res = out(await clear.callTool({}));
        const removed = (res as { removed?: number }).removed ?? 0;
        await sendFollowUp({ prompt: `Cleared ${removed} item(s) from the shopping list.` });
        return res;
      }}
    />
  );
}

export default function View() {
  const ctx = useToolContext();
  return (
    <ThemeProvider>
      <Frame ctx={ctx}>{(o) => <Wired list={o as ShoppingList} />}</Frame>
    </ThemeProvider>
  );
}
