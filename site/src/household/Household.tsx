/**
 * Your household, on the website: the week, the vote and the shopping list for a signed-in member,
 * phone first. The organizer runs the household from Claude; this is where the rest of the
 * household shows up to take part (docs/website.md, "Your household"; ADR 0007).
 */

import { Drawing } from "../../../packages/ui/mod.ts";
import css from "../../../packages/ui/views/signal.module.css";
import { type AuthFlow, SignInCard } from "../App.tsx";
import { Mark } from "../Mark.tsx";
import { supabase } from "../supabase.ts";
import hh from "./household.module.css";
import { ShoppingScreen, VoteScreen, WeekScreen } from "./screens.tsx";

export type Screen = "week" | "vote" | "shopping";
export const SCREENS: { key: Screen; name: string }[] = [
  { key: "week", name: "Week" },
  { key: "vote", name: "Vote" },
  { key: "shopping", name: "Shopping" },
];
export const HOUSEHOLD_PATH = "household";

/** The screen a path under the site base names, or null when the path is not the household's. */
export function screenFromPath(path: string): Screen | null {
  const [head, tail] = path.replace(/\/+$/, "").split("/");
  if (head !== HOUSEHOLD_PATH) return null;
  return SCREENS.find((s) => s.key === tail)?.key ?? "week";
}
export const pathForScreen = (s: Screen) => `${HOUSEHOLD_PATH}/${s}`;

export function Household({ flow, screen, go }: { flow: AuthFlow; screen: Screen; go: (s: Screen) => void }) {
  const { state } = flow;
  const signedIn = state.kind === "no-request" && state.signedIn;
  return (
    <main className={hh.page}>
      <header className={hh.top}>
        <a className={`${css.label} ${hh.brand}`} href={__SITE_BASE__}>
          <Mark />
          chef-gpt
        </a>
        {signedIn && (
          <button
            type="button"
            className={css.btnSmall}
            onClick={async () => {
              await supabase.auth.signOut();
              location.reload();
            }}
          >
            Sign out
          </button>
        )}
      </header>
      <nav className={hh.tabs} aria-label="Your household">
        {SCREENS.map((s) => (
          <a
            key={s.key}
            className={hh.tab}
            aria-current={s.key === screen ? "page" : undefined}
            href={`${__SITE_BASE__}${pathForScreen(s.key)}`}
            onClick={(e) => {
              e.preventDefault();
              go(s.key);
            }}
          >
            {s.name}
          </a>
        ))}
      </nav>
      {state.kind === "loading" && <Drawing />}
      {state.kind !== "loading" && !signedIn && (
        <div className={css.desk}>
          <div className={`${css.sheet} ${hh.signIn}`}>
            <p className={css.label}>Sign in to your household</p>
            <p className={css.body}>
              Your household's week, vote and shopping list. Invited? Enter the code below.
            </p>
            <SignInCard flow={flow} id={null} error={state.kind === "sign-in" ? state.error : undefined} />
          </div>
        </div>
      )}
      {signedIn && screen === "week" && <WeekScreen key="week" />}
      {signedIn && screen === "vote" && <VoteScreen key="vote" />}
      {signedIn && screen === "shopping" && <ShoppingScreen key="shopping" />}
      {signedIn && (
        <p className={hh.foot}>
          Rounds, recipes and invites are for Claude: the organizer says it, this page shows it.
        </p>
      )}
    </main>
  );
}
