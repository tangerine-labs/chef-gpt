import { ThemeProvider, useCallTool, useSendFollowUp, useToolContext } from "mcp-use/react";
import { type Ranked, type Week, WeekPlanView } from "../../../packages/ui/mod.ts";
import { Frame } from "../frame.tsx";

type Output = { week: Week; ranked: Ranked[] };

function Wired({ week, ranked }: Output) {
  const setSlot = useCallTool("set_slot");
  const sendFollowUp = useSendFollowUp();
  return (
    <WeekPlanView
      week={week}
      ranked={ranked}
      onSet={async (date, change, line) => {
        const res = await setSlot.callTool({ date, mealType: "dinner", ...change });
        await sendFollowUp({ prompt: line });
        return (res.structuredContent as Output).week;
      }}
    />
  );
}

export default function View() {
  const ctx = useToolContext();
  return (
    <ThemeProvider>
      <Frame ctx={ctx}>{(o) => <Wired {...(o as Output)} />}</Frame>
    </ThemeProvider>
  );
}
