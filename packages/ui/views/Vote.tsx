import { useState } from "react";
import css from "./shared.module.css";
import { TIER_COLORS, TIERS, type Tier } from "./tiers.ts";
import { type Candidate, errorText, type Participant } from "./types.ts";

export interface VoteProps {
  round: { id: string; label: string; participants: Participant[] };
  candidates: Candidate[];
  /** Submit one member's complete ranking; resolves to the message shown afterwards. */
  onSubmit: (memberId: string, entries: { recipeId: string; tier: Tier }[]) => Promise<string>;
}

export function VoteView({ round, candidates, onSubmit }: VoteProps) {
  const [member, setMember] = useState<Participant | null>(null);
  const [tiers, setTiers] = useState<Record<string, Tier>>({});
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
        <h1 className={css.h}>Who's voting?{round.label ? ` · ${round.label}` : ""}</h1>
        <div className={css.row}>
          {round.participants.map((p) => (
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
  const total = candidates.length;

  const send = async () => {
    setError("");
    setBusy(true);
    try {
      setDone(
        await onSubmit(
          member.memberId,
          Object.entries(tiers).map(([recipeId, tier]) => ({ recipeId, tier })),
        ),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={css.app}>
      <h1 className={css.h}>
        {member.name}, rank the dinners ({placed}/{total})
      </h1>
      <div className={css.list} style={{ maxHeight: 420 }}>
        {candidates.map((c) => (
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
          disabled={busy || placed !== total}
          onClick={send}
        >
          Submit ranking
        </button>
      </div>
      <p className={css.err}>{error}</p>
    </main>
  );
}
