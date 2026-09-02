import { ThemeProvider, useCallTool, useSendFollowUp, useToolContext } from "mcp-use/react";
import { type Member, type RecipeSummary, RoundBuilderView } from "../../../packages/ui/mod.ts";
import { Frame } from "../frame.tsx";

type Output = { members: Member[]; candidateDefault: number };

function Wired({ members, candidateDefault }: Output) {
  const search = useCallTool("search_recipes");
  const create = useCallTool("create_round");
  const sendFollowUp = useSendFollowUp();
  return (
    <RoundBuilderView
      members={members}
      candidateDefault={candidateDefault}
      onSearch={async (query) =>
        ((await search.callTool({ query, limit: 8 })).structuredContent as { recipes: RecipeSummary[] })
          .recipes
      }
      onStart={async ({ label, candidateIds, participantIds }) => {
        const res = await create.callTool({
          label,
          candidateRecipeIds: candidateIds,
          participantMemberIds: participantIds,
        });
        const round = (
          res.structuredContent as { round: { participants: { name: string; hasVoted: boolean }[] } }
        ).round;
        const waiting = round.participants
          .filter((p) => !p.hasVoted)
          .map((p) => p.name)
          .join(", ");
        await sendFollowUp({
          prompt: `Round started with ${candidateIds.length} candidates; waiting on ${waiting}.`,
        });
        return `Round started with ${candidateIds.length} candidates.`;
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
