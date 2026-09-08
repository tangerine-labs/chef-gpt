/**
 * The landing page: the copy of docs/website.md, block by block, on Signal. The hero's planner and
 * the four apps are the real view components on fixture data, so what the page shows is what the
 * product is. Sign-in lives in the "Set up" section; App.tsx decides when the auth sheet stands alone.
 */
import { useEffect, useState } from "react";
import "../../packages/ui/signal.css";
import {
  RoundBuilderView,
  type ShoppingList,
  ShoppingListView,
  VoteView,
  type Week,
  WeekPlanView,
} from "../../packages/ui/mod.ts";
import css from "../../packages/ui/views/signal.module.css";
import { type AuthFlow, ConnectorCard, SignInCard } from "./App.tsx";
import * as fx from "./fixtures.ts";
import ld from "./landing.module.css";
import { pendingInvite } from "./supabase.ts";

const REPO = "https://github.com/tangerine-labs/chef-gpt";

/** The hero week: nothing placed yet except Wednesday's "eating out", so all three notes are in the tray. */
const heroWeek: Week = {
  ...fx.week,
  days: fx.week.days.map((d) => (d.slots.some((s) => s.recipe) ? { ...d, slots: [] } : d)),
};

/** The planner from the Notes cut: put a dinner on a day; when the tray is empty the sheet celebrates. */
function HeroPlanner() {
  const [run, setRun] = useState(0);
  const [planned, setPlanned] = useState(false);
  const [setter] = useState(() => {
    const set = fx.weekSetter(heroWeek);
    return async (date: string, change: Parameters<typeof set>[1]) => {
      const week = await set(date, change);
      const placed = new Set(week.days.flatMap((d) => d.slots.map((s) => s.recipe?.id)).filter(Boolean));
      setPlanned(fx.ranked.every((r) => placed.has(r.recipeId)));
      return week;
    };
  });
  return (
    <div className={ld.planner} key={run}>
      <WeekPlanView
        week={heroWeek}
        ranked={fx.ranked}
        onSet={setter}
        celebration={
          planned
            ? {
                text: "Week 36 · planned",
                // over the empty Friday and Saturday rows; the doodle right of the tray's cross
                stampAt: { x: "60%", y: "57%" },
                bursts: (w, h) => [
                  { x: w * 0.7, y: h - 74, r: 22, rays: 10, ink: "black", at: 0 },
                  { x: w - 60, y: h - 84, r: 22, rays: 12, ink: "red", at: 400 },
                ],
              }
            : null
        }
      />
      <div className={ld.plannerCaption}>
        <p className={css.labelMuted}>There is no winner. People choose from the list by hand.</p>
        <button
          type="button"
          className={css.btnSmall}
          onClick={() => {
            setPlanned(false);
            setRun(run + 1);
          }}
        >
          Start over
        </button>
      </div>
    </div>
  );
}

/** The shopping list on fixture data, so ticks and additions work on the page. */
function ShoppingDemo() {
  return (
    <ShoppingListView
      list={fx.shopping}
      onToggle={(item, checked) => {
        const items = fx.shopping.items.map((i) => (i.id === item.id ? { ...i, checked } : i));
        return fx.later<ShoppingList>({ items, uncheckedCount: items.filter((i) => !i.checked).length });
      }}
      onAdd={(name) =>
        fx.later<ShoppingList>({
          items: [
            ...fx.shopping.items,
            { id: `n${Date.now()}`, name, quantity: null, unit: null, checked: false, recipeTitle: null },
          ],
          uncheckedCount: fx.shopping.uncheckedCount + 1,
        })
      }
      onClear={() =>
        fx.later<ShoppingList>({ items: fx.shopping.items.filter((i) => !i.checked), uncheckedCount: 3 })
      }
    />
  );
}

export function Landing({ flow }: { flow: AuthFlow }) {
  const { state } = flow;
  const invited = state.kind === "sign-in" && pendingInvite() !== null;
  // an invite link lands on the sign-in card
  useEffect(() => {
    if (invited) document.getElementById("setup")?.scrollIntoView();
  }, [invited]);

  return (
    <main className={ld.page}>
      <header className={ld.top}>
        <p className={css.label}>chef-gpt</p>
        <nav className={ld.nav} aria-label="Sections">
          <a className={ld.navLink} href="#how">
            How it works
          </a>
          <a className={ld.navLink} href="#apps">
            The apps
          </a>
          <a className={ld.navLink} href="#setup">
            Set up
          </a>
          <a className={ld.navLink} href={REPO}>
            GitHub
          </a>
        </nav>
      </header>

      <section className={ld.hero} aria-label="chef-gpt">
        <div className={`${css.sheet} ${ld.heroSheet}`}>
          <p className={css.labelMuted}>Household meal planning · inside Claude Desktop</p>
          <h1 className={ld.headline}>Vote on dinners, plan the week, keep the shopping list.</h1>
          <p className={ld.lede}>
            chef-gpt is household meal planning inside Claude Desktop. Your household ranks the candidates,
            the week fills itself from the ranked list, and the ingredients land on one shopping list. Click
            in the apps, or just ask.
          </p>
          <div className={ld.actions}>
            <a className={css.btnPrimary} href="#setup">
              Sign in and add the connector
            </a>
            <a className={css.btn} href="#how">
              See how it works
            </a>
          </div>
          <p className={ld.trust}>
            Works with Claude Desktop custom connectors · Sign in with Google or a magic link · One household,
            shared by everyone in it
          </p>
        </div>
        <HeroPlanner />
      </section>

      <section id="how" className={`${css.sheet} ${ld.sheetWide}`} aria-labelledby="how-h">
        <p className={css.labelMuted}>How it works</p>
        <h2 id="how-h" className={ld.h2}>
          Four steps, in the order the household lives them
        </h2>
        <ol className={ld.steps}>
          <li>
            <div>
              <b>Start a round.</b> Pick eight candidate dinners from your cookbooks, choose who votes.
              <span className={ld.pen}>
                "Start a voting round with eight quick weeknight dinners for everyone."
              </span>
            </div>
          </li>
          <li>
            <div>
              <b>Everyone ranks.</b> Each participant drags every candidate into a tier: S, A, B, C, D, F or
              GARBAGE. Results stay hidden until the round closes.
            </div>
          </li>
          <li>
            <div>
              <b>Fill the week.</b> The ranked list sits next to the week. Tap a dinner, then a day. Or say
              "Tuesday is the chorizo pasta, Wednesday we're eating out."
            </div>
          </li>
          <li>
            <div>
              <b>Shop once.</b> Add a recipe's ingredients to the shopping list, check things off in the shop
              by saying them, clear what you bought.
            </div>
          </li>
        </ol>
      </section>

      <section id="apps" className={ld.sheetWide} aria-labelledby="apps-h">
        <div className={`${css.sheet} ${ld.sheetWide}`}>
          <p className={css.labelMuted}>The four apps</p>
          <h2 id="apps-h" className={ld.h2}>
            Each app opens inside the conversation
          </h2>
          <p className={ld.prose}>
            Each app is an MCP App: it opens inside the Claude conversation when the matching tool runs, and
            it is the same data the tools talk to. These four are live, on an example household.
          </p>
        </div>
        <div className={ld.apps}>
          <div className={ld.app}>
            <div className={ld.appCaption}>
              <p className={css.label}>Round builder</p>
              <p>Search the cookbooks, collect candidates, choose who votes, start voting.</p>
            </div>
            <RoundBuilderView
              members={fx.members}
              candidateDefault={8}
              onSearch={(q) =>
                fx.later(fx.recipes.filter((r) => r.title.toLowerCase().includes(q.toLowerCase())))
              }
              onStart={(r) => fx.later(`Round started with ${r.candidateIds.length} candidates.`)}
              initial={{ query: "spaghetti", results: fx.recipes, candidates: fx.recipes.slice(1, 3) }}
            />
          </div>
          <div className={ld.app}>
            <div className={ld.appCaption}>
              <p className={css.label}>Vote</p>
              <p>
                Pick your name, place each candidate in a tier. Voting again replaces your earlier ranking.
              </p>
            </div>
            <VoteView
              round={{ id: "round1", label: "Week 37", participants: fx.members }}
              candidates={fx.candidates}
              onSubmit={() => fx.later("Your ranking is in.")}
              initial={{ memberId: "m2", tiers: { r2: "S", r3: "B" } }}
            />
          </div>
          <div className={ld.app}>
            <div className={ld.appCaption}>
              <p className={css.label}>Week plan</p>
              <p>The week's dinner slots beside the latest ranked list. Place, type free text, clear.</p>
            </div>
            <WeekPlanView week={fx.week} ranked={fx.ranked} onSet={fx.weekSetter(fx.week)} />
          </div>
          <div className={ld.app}>
            <div className={ld.appCaption}>
              <p className={css.label}>Shopping list</p>
              <p>One running list with check-off, quantities, and the recipe each item came from.</p>
            </div>
            <ShoppingDemo />
          </div>
        </div>
      </section>

      <section className={`${css.sheet} ${ld.sheetWide}`} aria-labelledby="ask-h">
        <p className={css.labelMuted}>Or just ask</p>
        <h2 id="ask-h" className={ld.h2}>
          Everything the apps do you can also say
        </h2>
        <div className={ld.sayLines}>
          <span className={ld.pen}>"plan the week from the last round"</span>
          <span className={ld.pen}>"what's for dinner tonight?"</span>
          <span className={ld.pen}>"I'm going shopping"</span>
        </div>
        <p className={ld.prose}>
          Tools take names, not ids. "Retire the tofu bowl", "add milk", "who still needs to vote?" A name
          that matches two recipes comes back as a question, never a guess.
        </p>
      </section>

      <section className={`${css.sheet} ${ld.sheetWide}`} aria-labelledby="kids-h">
        <p className={css.labelMuted}>Members</p>
        <h2 id="kids-h" className={ld.h2}>
          Kids vote too
        </h2>
        <p className={ld.prose}>
          A member is a person in the household who can vote. Members do not need to sign in: add the kids by
          first name and they rank on your screen. Adults who want chef-gpt in their own Claude get an invite,
          a single-use code that joins them to the household and links them to their member. All signed-in
          members are equal.
        </p>
      </section>

      <section id="setup" className={`${css.sheet} ${ld.sheetWide}`} aria-labelledby="setup-h">
        <p className={css.labelMuted}>Set up in three steps</p>
        <div className={ld.setup}>
          <div className={ld.sheetWide}>
            <h2 id="setup-h" className={ld.h2}>
              Sign in, add the connector, approve
            </h2>
            <ol className={ld.steps} style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
              <li>
                <div>
                  <b>Sign in</b> here with Google or a magic link. That creates your household.
                </div>
              </li>
              <li>
                <div>
                  <b>Add the connector</b> in Claude Desktop: Settings → Connectors → Add custom connector,
                  and paste the connector URL shown after you sign in.
                </div>
              </li>
              <li>
                <div>
                  <b>Approve.</b> Claude brings you back here to authorize it. Then open a new chat and say
                  "set up my household".
                </div>
              </li>
            </ol>
            <p className={ld.prose}>
              Joining someone's household instead? Open the invite link they sent you and sign in; the invite
              is redeemed on the way in.
            </p>
          </div>
          <div className={ld.authCard}>
            {state.kind === "loading" && <p className={ld.prose}>Loading…</p>}
            {state.kind === "no-request" && state.signedIn && (
              <>
                <h3 className={ld.authTitle}>You're signed in</h3>
                <ConnectorCard joined={state.joined} />
              </>
            )}
            {state.kind === "no-request" && !state.signedIn && (
              <>
                <h3 className={ld.authTitle}>Sign in to chef-gpt</h3>
                <SignInCard flow={flow} id={null} />
              </>
            )}
            {state.kind === "sign-in" && (
              <>
                <h3 className={ld.authTitle}>{invited ? "You've been invited" : "Sign in to chef-gpt"}</h3>
                {invited && (
                  <p className={ld.prose}>
                    Sign in to join the household. Your dinners, plans and shopping list will be shared.
                  </p>
                )}
                <SignInCard flow={flow} id={state.id} error={state.error} />
              </>
            )}
          </div>
        </div>
      </section>

      <section className={`${css.sheet} ${ld.sheetWide}`} aria-labelledby="own-h">
        <p className={css.labelMuted}>Run your own</p>
        <h2 id="own-h" className={ld.h2}>
          One Supabase project, Deno only
        </h2>
        <p className={ld.prose}>
          chef-gpt is open source. The whole stack is one Supabase project: Postgres with Row Level Security
          for tenancy, Supabase Auth as the OAuth 2.1 server, and one Deno edge function that serves the MCP
          endpoint and the app views. The consent page is a static site on GitHub Pages.{" "}
          <code>scripts/setup-supabase.sh</code> walks you through creating the projects; the decisions are
          written down in <code>docs/adr/</code>.
        </p>
        <ul className={ld.bullets}>
          <li>A bug in a tool handler cannot read another household's data. The database refuses.</li>
          <li>Deno is the only toolchain. No Node, no npm.</li>
          <li>Views are plain React components with a fixture gallery, snapshotted in CI, light and dark.</li>
        </ul>
        <p className={ld.prose}>
          <a className={ld.link} href={REPO}>
            github.com/tangerine-labs/chef-gpt
          </a>
        </p>
      </section>

      <section className={`${css.sheet} ${ld.sheetWide}`} aria-labelledby="faq-h">
        <p className={css.labelMuted}>FAQ</p>
        <h2 id="faq-h" className={ld.h2}>
          Questions
        </h2>
        <dl className={ld.faq}>
          <div>
            <dt>Which Claude do I need?</dt>
            <dd>
              Claude Desktop with custom connectors (a paid plan). The apps render in the desktop app; the
              tools also work anywhere the connector is available.
            </dd>
          </div>
          <div>
            <dt>Is there a winner?</dt>
            <dd>
              No. A closed round gives a ranked list, candidates ordered by summed tier points. People choose
              from it by hand.
            </dd>
          </div>
          <div>
            <dt>Where are my recipes from?</dt>
            <dd>
              System cookbooks (Aarstiderne, HelloFresh) are visible to every household and can be switched
              off. Your household's own cookbook holds recipes you dictate, that Claude writes, or that you
              copy from a system cookbook to edit.
            </dd>
          </div>
          <div>
            <dt>Where is my data?</dt>
            <dd>
              In a Postgres database, scoped to your household by Row Level Security. Every request carries
              your own token; there is no shared service account in the request path.
            </dd>
          </div>
          <div>
            <dt>Can I belong to two households?</dt>
            <dd>
              Yes. An invite joins you to another household, and that household becomes the one you act in.
            </dd>
          </div>
        </dl>
      </section>

      <p className={ld.footer}>
        chef-gpt · Household meal planning as MCP Apps · <a href={REPO}>Source on GitHub</a> ·{" "}
        <a href="#setup">Sign in</a> · Built by Tangerine Labs
      </p>
    </main>
  );
}
