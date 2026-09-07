/**
 * Round builder: a tray being filled. Search prints results on the sheet; adding one turns it
 * into a loose note in the tray; participants are printed names with a pen tick. Start voting when
 * the tray holds at least two notes. Signal materials, see docs/design-system.md.
 */
import { useState } from "react";
import "../signal.css";
import { Note } from "./Note.tsx";
import css from "./signal.module.css";
import { errorText, type Member, type RecipeSummary } from "./types.ts";

export interface RoundBuilderProps {
  members: Member[];
  candidateDefault: number;
  onSearch: (query: string) => Promise<RecipeSummary[]>;
  /** Create the round; resolves to the confirmation shown afterwards. */
  onStart: (round: { label: string; candidateIds: string[]; participantIds: string[] }) => Promise<string>;
  /** Gallery only: start with notes in the tray and results printed. */
  initial?: { candidates?: RecipeSummary[]; results?: RecipeSummary[]; query?: string };
}

const Tick = () => (
  <svg viewBox="0 0 24 22" aria-hidden="true">
    <path d="M4 12 L9.5 18 L21 3" />
  </svg>
);

const meta = (r: RecipeSummary) =>
  [r.cuisine, r.cookTimeMinutes && `${r.cookTimeMinutes} min`, r.cookbook].filter(Boolean).join(" · ");

export function RoundBuilderView({
  members,
  candidateDefault,
  onSearch,
  onStart,
  initial,
}: RoundBuilderProps) {
  const [query, setQuery] = useState(initial?.query ?? "");
  const [results, setResults] = useState<RecipeSummary[]>(initial?.results ?? []);
  const [searched, setSearched] = useState(Boolean(initial?.results));
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<RecipeSummary[]>(initial?.candidates ?? []);
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
      setSearched(true);
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
      <div className={css.desk}>
        <div className={css.sheet}>
          <div className={css.head}>
            <p className={css.label}>Round{label ? ` · ${label}` : ""}</p>
            <p className={css.labelMuted}>open</p>
          </div>
          <h1 className={css.title}>{done}</h1>
          <p className={`${css.body} ${css.muted}`}>Open voting whenever someone is ready to rank.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={css.desk}>
      <div className={css.sheet}>
        <div className={css.head}>
          <p className={css.label}>New round</p>
          <p className={css.labelMuted}>
            {candidates.length} of {candidateDefault} candidates
          </p>
        </div>

        <div className={css.searchRow}>
          <input
            className={css.printedInput}
            placeholder="Search the cookbooks… tofu, quick, pasta"
            aria-label="Search recipes"
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
        {searched && (
          <section className={css.results} aria-label="Results">
            {visible.map((r) => (
              <div key={r.id} className={css.result}>
                <div>
                  <div className={css.resultTitle}>{r.title}</div>
                  <div className={css.resultMeta}>{meta(r)}</div>
                </div>
                <button
                  type="button"
                  className={css.btnSmall}
                  onClick={() => setCandidates([...candidates, r])}
                  aria-label={`Add ${r.title}`}
                >
                  Add
                </button>
              </div>
            ))}
            {visible.length === 0 && (
              <p className={`${css.body} ${css.muted}`} style={{ padding: "8px 0" }}>
                {results.length === 0 ? "Nothing found. Try another word." : "All of these are in the tray."}
              </p>
            )}
          </section>
        )}

        <div className={css.tray}>
          <p className={css.labelMuted}>
            Tray · {candidates.length === 0 ? "empty" : `${candidates.length} candidates`}
          </p>
          {candidates.length === 0 ? (
            <div className={css.trayEmpty} aria-hidden="true" />
          ) : (
            <div className={css.trayNotes}>
              {candidates.map((r, i) => (
                <div key={r.id} className={css.trayItem}>
                  <Note
                    title={r.title}
                    meta={meta(r)}
                    rotate={i % 2 ? 0.8 : -0.7}
                    picked={false}
                    onPick={() => {}}
                    onDrop={() => {}}
                    onOver={() => {}}
                  />
                  <button
                    type="button"
                    className={css.linkBtn}
                    onClick={() => setCandidates(candidates.filter((c) => c.id !== r.id))}
                    aria-label={`Remove ${r.title}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className={css.labelMuted} style={{ marginBottom: 6 }}>
            Who rates
          </p>
          <div className={css.people}>
            {members.map((m) => {
              const on = chosen.has(m.memberId);
              return (
                <button
                  type="button"
                  key={m.memberId}
                  className={css.item}
                  aria-pressed={on}
                  onClick={() => toggleMember(m.memberId)}
                >
                  <span className={css.box} aria-hidden="true">
                    {on ? <Tick /> : null}
                  </span>
                  <span className={css.itemText}>
                    <span className={css.itemName}>{m.name}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={css.searchRow}>
          <input
            className={css.penInput}
            placeholder="a label, like Week 37"
            aria-label="Round label"
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
          />
          <button
            type="button"
            className={css.btnPrimary}
            disabled={busy || candidates.length < 2 || chosen.size === 0}
            onClick={start}
            title={candidates.length < 2 ? "Put at least two dinners in the tray" : undefined}
          >
            Start voting
          </button>
        </div>
        <p className={css.err}>{error}</p>
      </div>
    </div>
  );
}
