import { ThemeProvider, useCallTool, useSendFollowUp, useToolContext } from "mcp-use/react";
import { useState } from "react";
import css from "../shared.module.css";
import { TIER_COLORS, TIERS, type Tier } from "../tiers.ts";

type Participant = { memberId: string; name: string; hasVoted: boolean };
type Candidate = {
  recipeId: string;
  title: string;
  cuisine: string | null;
  cookTimeMinutes: number | null;
  imageUrl: string | null;
};
type Output = { round: { id: string; label: string; participants: Participant[] }; candidates: Candidate[] };

function Vote() {
  const ctx = useToolContext();
  const submit = useCallTool("submit_ranking");
  const sendFollowUp = useSendFollowUp();
  const [member, setMember] = useState<Participant | null>(null);
  const [tiers, setTiers] = useState<Record<string, Tier>>({});
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (ctx.status === "pending") return <main className={css.app}>Loading…</main>;
  if (ctx.status === "error")
    return <main className={css.app}>{String(ctx.error?.message ?? "Something went wrong")}</main>;
  const out = ctx.toolOutput as Output;

  if (done) {
    return (
      <main className={css.app}>
        <h1 className={css.h}>Thanks, {member?.name}! 🎉</h1>
        <p className={css.sub}>{done}</p>
      </main>
    );
  }

  if (!member) {
    return (
      <main className={css.app}>
        <h1 className={css.h}>Who's voting?{out.round.label ? ` · ${out.round.label}` : ""}</h1>
        <div className={css.row}>
          {out.round.participants.map((p) => (
            <button
              type="button"
              key={p.memberId}
              className={`${css.tag} ${p.hasVoted ? "" : css.tagOn}`}
              onClick={() => setMember(p)}
            >
              {p.name}
              {p.hasVoted ? " ✓" : ""}
            </button>
          ))}
        </div>
        <p className={css.sub}>✓ = already voted (voting again replaces the earlier ranking)</p>
      </main>
    );
  }

  const placed = Object.keys(tiers).length;
  const total = out.candidates.length;

  const send = async () => {
    setError("");
    try {
      const res = await submit.callTool({
        roundId: out.round.id,
        memberId: member.memberId,
        entries: Object.entries(tiers).map(([recipeId, tier]) => ({ recipeId, tier })),
      });
      const s = res.structuredContent as { votedCount: number; total: number; closed: boolean };
      const line = s.closed
        ? `${member.name} has voted — that was everyone, the round is closed.`
        : `${member.name} has voted (${s.votedCount} of ${s.total}).`;
      setDone(s.closed ? "That was the last vote — the round is closed." : "Your ranking is in.");
      await sendFollowUp({ prompt: line });
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  };

  return (
    <main className={css.app}>
      <h1 className={css.h}>
        {member.name}, rank the dinners ({placed}/{total})
      </h1>
      <div className={css.list} style={{ maxHeight: 420 }}>
        {out.candidates.map((c) => (
          <div key={c.recipeId} className={css.card}>
            {c.imageUrl ? (
              <img className={css.thumb} src={c.imageUrl} alt="" />
            ) : (
              <div className={css.thumb} />
            )}
            <div className={css.grow}>
              <div className={css.title}>{c.title}</div>
              <div className={css.meta}>
                {[c.cuisine, c.cookTimeMinutes && `${c.cookTimeMinutes} min`].filter(Boolean).join(" · ")}
              </div>
              <div className={css.row} style={{ marginTop: 4 }}>
                {TIERS.map((t) => {
                  const on = tiers[c.recipeId] === t;
                  return (
                    <button
                      type="button"
                      key={t}
                      className={`${css.chip} ${on ? css.chipOn : ""}`}
                      style={on ? { background: TIER_COLORS[t] } : undefined}
                      title={t}
                      onClick={() => setTiers({ ...tiers, [c.recipeId]: t })}
                    >
                      {t === "GARBAGE" ? "🗑" : t}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className={css.row}>
        <button type="button" className={css.btn} onClick={() => setMember(null)}>
          Back
        </button>
        <button
          type="button"
          className={`${css.btn} ${css.primary}`}
          disabled={submit.isPending || placed !== total}
          onClick={send}
        >
          Submit ranking
        </button>
      </div>
      <p className={css.err}>{error}</p>
    </main>
  );
}

export default function VoteView() {
  return (
    <ThemeProvider>
      <Vote />
    </ThemeProvider>
  );
}
