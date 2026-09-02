import { ThemeProvider, useCallTool, useSendFollowUp, useToolContext } from "mcp-use/react";
import { type Candidate, type Participant, VoteView } from "../../../packages/ui/mod.ts";
import { Frame } from "../frame.tsx";

type Output = { round: { id: string; label: string; participants: Participant[] }; candidates: Candidate[] };

function Wired({ round, candidates }: Output) {
  const submit = useCallTool("submit_ranking");
  const sendFollowUp = useSendFollowUp();
  return (
    <VoteView
      round={round}
      candidates={candidates}
      onSubmit={async (memberId, entries) => {
        const res = await submit.callTool({ roundId: round.id, memberId, entries });
        const s = res.structuredContent as { votedCount: number; total: number; closed: boolean };
        const name = round.participants.find((p) => p.memberId === memberId)?.name ?? "Someone";
        await sendFollowUp({
          prompt: s.closed
            ? `${name} has voted — that was everyone, the round is closed.`
            : `${name} has voted (${s.votedCount} of ${s.total}).`,
        });
        return s.closed ? "That was the last vote — the round is closed." : "Your ranking is in.";
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
