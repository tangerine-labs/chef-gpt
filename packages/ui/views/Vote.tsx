/**
 * Vote: a round as tier rows on the sheet with a tray of candidate notes beneath.
 * Drag a note into a row (primary), or tap/Enter a note then a row (fallback).
 * A rated note lies flat in its row; an empty tray means the ranking is complete. Signal materials, see
 * docs/design-system.md.
 */
import { useEffect, useRef, useState } from "react";
import "../signal.css";
import { Note } from "./Note.tsx";
import css from "./signal.module.css";
import { TIER_COLORS, TIERS, type Tier } from "./tiers.ts";
import { type Candidate, errorText, type Participant } from "./types.ts";

export interface VoteProps {
  round: { id: string; label: string; participants: Participant[] };
  candidates: Candidate[];
  /** Submit one member's complete ranking; resolves to the message shown afterwards. */
  onSubmit: (memberId: string, entries: { recipeId: string; tier: Tier }[]) => Promise<string>;
  /** Gallery only: start on a member's sheet with some notes already rated. */
  initial?: { memberId: string; tiers?: Record<string, Tier> };
}

const tierName = (t: Tier) => (t === "GARBAGE" ? "the bin" : `tier ${t}`);
const shortTitle = (title: string) => (title.length > 28 ? `${title.slice(0, 27).trimEnd()}…` : title);

export function VoteView({ round, candidates, onSubmit, initial }: VoteProps) {
  const [member, setMember] = useState<Participant | null>(
    () => round.participants.find((p) => p.memberId === initial?.memberId) ?? null,
  );
  const [tiers, setTiers] = useState<Record<string, Tier>>(() => initial?.tiers ?? {});
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);
  const rated = Object.keys(tiers).length;
  const total = candidates.length;
  const voted = round.participants.filter((p) => p.hasVoted).length;

  const say = (text: string) => {
    setLive("");
    requestAnimationFrame(() => setLive(text));
  };

  const place = (recipeId: string, tier: Tier | "tray") => {
    const c = candidates.find((x) => x.recipeId === recipeId);
    setTiers((prev) => {
      const next = { ...prev };
      if (tier === "tray") delete next[recipeId];
      else next[recipeId] = tier;
      return next;
    });
    setPicked(null);
    if (c)
      say(
        tier === "tray"
          ? `${shortTitle(c.title)} back in the tray`
          : `${shortTitle(c.title)} in ${tierName(tier)}`,
      );
  };

  useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPicked(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [picked]);

  if (done) {
    return (
      <div className={css.desk}>
        <div className={css.sheet}>
          <div className={css.head}>
            <p className={css.label}>Round{round.label ? ` · ${round.label}` : ""}</p>
            <p className={css.labelMuted}>{member?.name} · rated</p>
          </div>
          <h1 className={css.title}>Thanks, {member?.name}.</h1>
          <p className={css.body}>{done}</p>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className={css.desk}>
        <div className={css.sheet}>
          <div className={css.head}>
            <p className={css.label}>Round{round.label ? ` · ${round.label}` : ""}</p>
            <p className={css.labelMuted}>
              {voted} of {round.participants.length} members rated
            </p>
          </div>
          <h1 className={css.title}>Who's rating?</h1>
          <div className={css.roster}>
            {round.participants.map((p) => (
              <button type="button" key={p.memberId} className={css.member} onClick={() => setMember(p)}>
                {p.name}
                <small>{p.hasVoted ? "rated ✓" : "to do"}</small>
              </button>
            ))}
          </div>
          <p className={`${css.body} ${css.muted}`}>Rating again replaces the earlier ranking.</p>
        </div>
      </div>
    );
  }

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

  const inTray = candidates.filter((c) => !tiers[c.recipeId]);

  return (
    <div className={css.desk}>
      <div ref={sheetRef} className={`${css.sheet} ${picked ? css.picking : ""}`}>
        <div className={css.head}>
          <p className={css.label}>Round{round.label ? ` · ${round.label}` : ""}</p>
          <p className={css.labelMuted}>
            {member.name} is rating · {rated} of {total} placed
          </p>
        </div>

        <section className={css.tiers} aria-label="Tiers">
          {TIERS.map((t) => (
            <div key={t} className={`${css.tier} ${over === t ? css.over : ""}`} data-drop={t}>
              <div className={css.marker} style={{ background: TIER_COLORS[t] }} aria-hidden="true">
                {t === "GARBAGE" ? "🗑" : t}
              </div>
              <div className={css.slot}>
                {candidates
                  .filter((c) => tiers[c.recipeId] === t)
                  .map((c) => (
                    <Note
                      key={c.recipeId}
                      title={c.title}
                      compact
                      placed
                      picked={picked === c.recipeId}
                      onPick={() => setPicked(picked === c.recipeId ? null : c.recipeId)}
                      onDrop={(target) => place(c.recipeId, target as Tier | "tray")}
                      onOver={setOver}
                    />
                  ))}
                <button
                  type="button"
                  className={css.drop}
                  aria-label={`Put it in ${tierName(t)}`}
                  disabled={!picked}
                  onClick={() => picked && place(picked, t)}
                >
                  Put it here
                </button>
              </div>
            </div>
          ))}
        </section>

        <div className={css.tray} data-drop="tray">
          <p className={css.labelMuted}>
            Tray · {inTray.length} left{picked ? " · pick a row" : ""}
          </p>
          {inTray.length === 0 ? (
            <div className={css.trayEmpty} aria-hidden="true" />
          ) : (
            <div className={css.trayNotes}>
              {inTray.map((c, i) => (
                <Note
                  key={c.recipeId}
                  title={c.title}
                  meta={[c.cuisine, c.cookTimeMinutes && `${c.cookTimeMinutes} min`]
                    .filter(Boolean)
                    .join(" · ")}
                  imageUrl={c.imageUrl}
                  rotate={i % 2 ? 0.8 : -0.7}
                  picked={picked === c.recipeId}
                  onPick={() => setPicked(picked === c.recipeId ? null : c.recipeId)}
                  onDrop={(target) => place(c.recipeId, target as Tier | "tray")}
                  onOver={setOver}
                />
              ))}
            </div>
          )}
        </div>

        <div
          className={css.head}
          style={{ borderBottom: 0, borderTop: "1px solid var(--sg-rule)", paddingTop: 10 }}
        >
          <p className={css.labelMuted}>
            {voted} of {round.participants.length} members rated · results hidden until the round closes
          </p>
          <div className={css.row}>
            <button type="button" className={css.btn} onClick={() => setMember(null)}>
              Back
            </button>
            <button
              type="button"
              className={css.btnPrimary}
              disabled={busy || rated !== total}
              onClick={send}
              title={rated !== total ? "Rate every dinner first" : undefined}
            >
              Submit ranking
            </button>
          </div>
        </div>
        <p className={css.err}>{error}</p>
        <p className={css.sr} aria-live="polite">
          {live}
        </p>
      </div>
    </div>
  );
}
