import { ThemeProvider, useCallTool, useSendFollowUp, useToolContext } from "mcp-use/react";
import { useState } from "react";
import css from "../shared.module.css";

type Member = { memberId: string; name: string };
type Output = { members: Member[]; candidateDefault: number };
type RecipeSummary = {
  id: string;
  title: string;
  cuisine: string | null;
  cookTimeMinutes: number | null;
  cookbook: string;
};

function Builder() {
  const ctx = useToolContext();
  const search = useCallTool("search_recipes");
  const create = useCallTool("create_round");
  const sendFollowUp = useSendFollowUp();

  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<RecipeSummary[]>([]);
  const [participants, setParticipants] = useState<Set<string> | null>(null);
  const [label, setLabel] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (ctx.status === "pending") return <main className={css.app}>Loading…</main>;
  if (ctx.status === "error")
    return <main className={css.app}>{String(ctx.error?.message ?? "Something went wrong")}</main>;
  const out = ctx.toolOutput as Output;
  const chosen = participants ?? new Set(out.members.map((m) => m.memberId));

  const results = (
    (search.data?.structuredContent as { recipes?: RecipeSummary[] } | undefined)?.recipes ?? []
  ).filter((r) => !candidates.some((c) => c.id === r.id));

  const toggleMember = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setParticipants(next);
  };

  const start = async () => {
    setError("");
    try {
      const res = await create.callTool({
        label,
        candidateRecipeIds: candidates.map((c) => c.id),
        participantMemberIds: [...chosen],
      });
      const round = (
        res.structuredContent as { round: { participants: { name: string; hasVoted: boolean }[] } }
      ).round;
      setDone(`Round started with ${candidates.length} candidates.`);
      const waiting = round.participants
        .filter((p) => !p.hasVoted)
        .map((p) => p.name)
        .join(", ");
      await sendFollowUp({
        prompt: `Round started with ${candidates.length} candidates; waiting on ${waiting}.`,
      });
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  };

  if (done) {
    return (
      <main className={css.app}>
        <h1 className={css.h}>{done}</h1>
        <p className={css.sub}>Open voting whenever someone is ready to rank.</p>
      </main>
    );
  }

  return (
    <main className={css.app}>
      <h1 className={css.h}>New round</h1>
      <div className={css.row}>
        <input
          className={css.input}
          placeholder="Search dinners… (e.g. tofu, quick, pasta)"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") search.callTool({ query, limit: 8 }).catch(() => {});
          }}
        />
        <button
          type="button"
          className={css.btn}
          disabled={search.isPending}
          onClick={() => search.callTool({ query, limit: 8 }).catch(() => {})}
        >
          Search
        </button>
      </div>
      {results.length > 0 && (
        <div className={css.list}>
          {results.map((r) => (
            <div key={r.id} className={css.card}>
              <div className={css.grow}>
                <div className={css.title}>{r.title}</div>
                <div className={css.meta}>
                  {[r.cuisine, r.cookTimeMinutes && `${r.cookTimeMinutes} min`, r.cookbook]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <button type="button" className={css.btn} onClick={() => setCandidates([...candidates, r])}>
                Add
              </button>
            </div>
          ))}
        </div>
      )}
      <p className={css.sub}>
        Candidates ({candidates.length}/{out.candidateDefault} suggested)
      </p>
      <div className={css.list}>
        {candidates.map((r) => (
          <div key={r.id} className={css.card}>
            <div className={css.grow}>
              <div className={css.title}>{r.title}</div>
            </div>
            <button
              type="button"
              className={css.btn}
              onClick={() => setCandidates(candidates.filter((c) => c.id !== r.id))}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <p className={css.sub}>Who votes?</p>
      <div className={css.row}>
        {out.members.map((m) => (
          <button
            type="button"
            key={m.memberId}
            className={`${css.tag} ${chosen.has(m.memberId) ? css.tagOn : ""}`}
            onClick={() => toggleMember(m.memberId)}
          >
            {m.name}
          </button>
        ))}
      </div>
      <div className={css.row}>
        <input
          className={css.input}
          placeholder="Label (optional, e.g. Week 37)"
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
        />
        <button
          type="button"
          className={`${css.btn} ${css.primary}`}
          disabled={create.isPending || candidates.length < 2 || chosen.size === 0}
          onClick={start}
        >
          Start voting
        </button>
      </div>
      <p className={css.err}>{error}</p>
    </main>
  );
}

export default function RoundBuilderView() {
  return (
    <ThemeProvider>
      <Builder />
    </ThemeProvider>
  );
}
