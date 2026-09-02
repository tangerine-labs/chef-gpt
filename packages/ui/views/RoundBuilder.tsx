import { useState } from "react";
import css from "./shared.module.css";
import { errorText, type Member, type RecipeSummary } from "./types.ts";

export interface RoundBuilderProps {
  members: Member[];
  candidateDefault: number;
  onSearch: (query: string) => Promise<RecipeSummary[]>;
  /** Create the round; resolves to the confirmation shown afterwards. */
  onStart: (round: { label: string; candidateIds: string[]; participantIds: string[] }) => Promise<string>;
}

export function RoundBuilderView({ members, candidateDefault, onSearch, onStart }: RoundBuilderProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipeSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<RecipeSummary[]>([]);
  const [participants, setParticipants] = useState<Set<string> | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");

  const chosen = participants ?? new Set(members.map((m) => m.memberId));
  const visible = results.filter((r) => !candidates.some((c) => c.id === r.id));

  const search = async () => {
    setError("");
    setSearching(true);
    try {
      setResults(await onSearch(query));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSearching(false);
    }
  };

  const toggleMember = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setParticipants(next);
  };

  const start = async () => {
    setError("");
    setBusy(true);
    try {
      setDone(
        await onStart({ label, candidateIds: candidates.map((c) => c.id), participantIds: [...chosen] }),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
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
            if (e.key === "Enter") search();
          }}
        />
        <button type="button" className={css.btn} disabled={searching} onClick={search}>
          Search
        </button>
      </div>
      {visible.length > 0 && (
        <div className={css.list}>
          {visible.map((r) => (
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
        Candidates ({candidates.length}/{candidateDefault} suggested)
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
        {members.map((m) => (
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
          disabled={busy || candidates.length < 2 || chosen.size === 0}
          onClick={start}
        >
          Start voting
        </button>
      </div>
      <p className={css.err}>{error}</p>
    </main>
  );
}
