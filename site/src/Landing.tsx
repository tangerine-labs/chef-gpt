/**
 * The landing page: the copy of docs/website.md, block by block, on Signal. The hero's planner, the
 * vote inside the conversation frame and the four apps are the real view components on fixture data,
 * so what the page shows is what the product is. Sign-in lives in the "Set up" section; App.tsx
 * decides when the auth sheet stands alone.
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

/** The mark: one yellow note with its tape and a fineliner tick (the favicon, inline). */
function Mark({ size = 18 }: { size?: number }) {
  return (
    <svg className={ld.mark} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g transform="rotate(-4 32 34)">
        <rect x="9" y="11" width="46" height="46" fill="#ffe14d" />
        <rect
          x="21"
          y="6.5"
          width="22"
          height="8"
          fill="#fff"
          fillOpacity=".65"
          stroke="#000"
          strokeWidth="1.5"
        />
      </g>
      <path
        d="M20 35l8 8 16-19"
        fill="none"
        stroke="#000"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

/** Emma's vote, three of four placed: the state a household is in mid-round. */
function VoteDemo() {
  return (
    <VoteView
      round={{ id: "round1", label: "Week 37", participants: fx.members }}
      candidates={fx.candidates}
      onSubmit={() => fx.later("Your ranking is in.")}
      initial={{ memberId: "m2", tiers: { r2: "S", r3: "A", r1: "B" } }}
    />
  );
}

/** The four apps, one at a time; every panel stays mounted so what you did in it stays done. */
function Apps() {
  const apps = [
    {
      key: "round",
      name: "Round builder",
      blurb: "Search the cookbooks, collect candidates, choose who votes, start voting.",
      node: (
        <RoundBuilderView
          members={fx.members}
          candidateDefault={8}
          onSearch={(q) =>
            fx.later(fx.recipes.filter((r) => r.title.toLowerCase().includes(q.toLowerCase())))
          }
          onStart={(r) => fx.later(`Round started with ${r.candidateIds.length} candidates.`)}
          initial={{ query: "spaghetti", results: fx.recipes, candidates: fx.recipes.slice(1, 3) }}
        />
      ),
    },
    {
      key: "vote",
      name: "Vote",
      blurb: "Pick your name, place each candidate in a tier. Voting again replaces your earlier ranking.",
      node: <VoteDemo />,
    },
    {
      key: "week",
      name: "Week plan",
      blurb: "The week's dinner slots beside the latest ranked list. Place, type free text, clear.",
      node: <WeekPlanView week={fx.week} ranked={fx.ranked} onSet={fx.weekSetter(fx.week)} />,
    },
    {
      key: "shop",
      name: "Shopping list",
      blurb: "One running list with check-off, quantities, and the recipe each item came from.",
      node: <ShoppingDemo />,
    },
  ];
  const [tab, setTab] = useState(apps[0].key);
  return (
    <div className={ld.appsWrap}>
      <div className={ld.tabs} role="tablist" aria-label="The four apps">
        {apps.map((a) => (
          <button
            key={a.key}
            type="button"
            role="tab"
            id={`tab-${a.key}`}
            aria-selected={tab === a.key}
            aria-controls={`panel-${a.key}`}
            className={ld.tab}
            onClick={() => setTab(a.key)}
          >
            {a.name}
          </button>
        ))}
      </div>
      {apps.map((a) => (
        <div
          key={a.key}
          role="tabpanel"
          id={`panel-${a.key}`}
          aria-labelledby={`tab-${a.key}`}
          hidden={tab !== a.key}
          className={ld.panel}
        >
          <p className={ld.blurb}>{a.blurb}</p>
          {a.node}
        </div>
      ))}
    </div>
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
        <p className={`${css.label} ${ld.brand}`}>
          <Mark />
          chef-gpt
        </p>
        <nav className={ld.nav} aria-label="Sections">
          <a className={ld.navLink} href="#chat">
            In the chat
          </a>
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
        <div className={`${css.sheet} ${ld.copy} ${ld.heroSheet}`}>
          <p className={css.labelMuted}>Household meal planning · inside Claude Desktop</p>
          <h1 className={ld.headline}>Dinner, decided together.</h1>
          <p className={ld.lede}>
            Vote on dinners, plan the week, keep the shopping list. Your household ranks the candidates, the
            ranked list fills the week, and the ingredients land on one shopping list. In the Claude you
            already have, by clicking or by asking.
          </p>
          <div className={ld.actions}>
            <a className={css.btnPrimary} href="#setup">
              Sign in and add the connector
            </a>
            <a className={css.btn} href="#chat">
              See it in the chat
            </a>
          </div>
          <p className={ld.trust}>
            Nothing to install · Kids vote without signing in · One household, shared by everyone in it
          </p>
          <figure className={`${css.taped} ${ld.print}`}>
            <img
              src="https://images.unsplash.com/photo-1590301157890-4810ed352733?w=1000&h=520&fit=crop&q=80"
              width={1000}
              height={520}
              alt="Several bowls of dinner on a table, seen from above."
              loading="eager"
            />
          </figure>
        </div>
        <HeroPlanner />
      </section>

      <section id="chat" className={ld.sheetWide} aria-labelledby="chat-h">
        <div className={`${css.sheet} ${ld.copy}`}>
          <p className={css.labelMuted}>In the conversation</p>
          <h2 id="chat-h" className={ld.h2}>
            It opens where you already are
          </h2>
          <p className={ld.prose}>
            Say what you want, and the app for it opens right in the chat. Nothing to install on anyone's
            device; the kids rank on your screen. This one is live: place the last candidate and submit.
          </p>
        </div>
        <figure className={ld.chat} aria-label="A Claude Desktop conversation with the Vote app open">
          <div className={ld.chatBar}>
            <span className={ld.chatDots} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>Claude</span>
            <span className={ld.chatConnector}>chef-gpt connected</span>
          </div>
          <div className={ld.chatBody}>
            <p className={ld.userTurn}>Emma wants to vote on this week's round</p>
            <p className={ld.assistantTurn}>
              Here is the round for Emma, with one candidate still in the tray. Place it in a tier and submit,
              and the round closes once Charlie has ranked too.
            </p>
            <div className={ld.embed}>
              <VoteDemo />
            </div>
            <p className={ld.assistantTurn}>
              Ask me to close the round when everyone is in, and I will bring the ranked list to the week
              plan.
            </p>
          </div>
        </figure>
      </section>

      <section id="how" className={`${css.sheet} ${ld.copy} ${ld.sheetWide}`} aria-labelledby="how-h">
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

      <section id="apps" className={`${css.sheet} ${ld.copy} ${ld.sheetWide}`} aria-labelledby="apps-h">
        <p className={css.labelMuted}>The four apps</p>
        <h2 id="apps-h" className={ld.h2}>
          Round builder, Vote, Week plan, Shopping list
        </h2>
        <p className={ld.prose}>
          Each app is an MCP App: it opens inside the Claude conversation when the matching tool runs, and it
          is the same data the tools talk to. All four are live here, on an example household.
        </p>
        <Apps />
      </section>

      <section className={`${css.sheet} ${ld.copy} ${ld.sheetWide}`} aria-labelledby="ask-h">
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

      <section id="setup" className={`${css.sheet} ${ld.copy} ${ld.sheetWide}`} aria-labelledby="setup-h">
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

      <p className={ld.footer}>
        <Mark size={14} /> chef-gpt · Household meal planning as MCP Apps ·{" "}
        <a href={REPO}>Source on GitHub</a> · <a href="#setup">Sign in</a> · Built by Tangerine Labs
      </p>
    </main>
  );
}
