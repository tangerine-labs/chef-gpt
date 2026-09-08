# chef-gpt website: who it is for, what it says, how it looks

The public site at https://tangerine-labs.com/chef-gpt/ is this document built: the reader, the problems, the copy block by block, and the design (section 6, which also records the directions explored before it). The vocabulary is `CONTEXT.md`'s, exactly; the *Avoid* words are listed at the end so the site never drifts.

## 1. Who reads this

### Primary: the household organizer

One adult in a household with kids, who already pays for Claude and has Claude Desktop open most days. They plan dinners for the week because someone has to, they cook from a meal-box cookbook (Aarstiderne, HelloFresh) plus a handful of their own recipes, and the shopping list currently lives in three places. They are comfortable with a settings screen, a connector URL and an OAuth consent page. They do not want to run a server, and they will not install another app on the kids' devices.

### Also: the rest of the household

Everyone in the household who is not the organizer: the partner who wants to vote from their own phone, the teenager who registers, whoever is in the shop with the list. They do not have Claude and should not need it. They sign in on the site (an invite lands them here already) and get **Your household**: the week, the vote and the shopping list, phone first. Nothing else; the organizer runs the rest from Claude.

What they need to believe before they sign in:

- It works inside the Claude I already have. Nothing to install, nothing to host.
- My kids get a say without an account.
- The list, the plan and the vote are one thing, not three.
- What my household plans is ours; nobody else's household can see it.

### Secondary: the developer who wants the reference

Someone building MCP Apps who wants to see OAuth 2.1 with dynamic client registration, interactive views inside Claude Desktop, and Postgres Row Level Security tenancy, all on one Supabase project with a Deno-only toolchain. They get the repo link in the nav and the footer; the reference is the README and the ADRs. They read ADRs, not taglines.

## 2. The problems it addresses

**Deciding.** The weekly "what are we eating" negotiation is loud, repetitive and lands on whoever asked. chef-gpt makes it a round: a set of candidate recipes that every participant ranks into tiers. The round closes when everyone has ranked, and the household gets a ranked list. There is no winner; people choose from the list by hand, which is the part that keeps the peace.

**Planning.** A meal plan is a Monday-start week of slots. The ranked list sits beside it, and a slot is filled by tapping a dinner and then a day, or by saying "Tuesday is the chorizo pasta". Free text such as "eating out" is a slot too.

**Shopping.** One shopping list per household, always running. Ingredients from a slot's recipe are added on request, remember which recipe they came from, and checked items stay until cleared. In the shop you say what you picked up and it gets checked off.

**Onboarding the household.** Members are people, not accounts. Kids are members without users and vote on a shared screen. Adults who want their own Claude get a single-use invite that links them to their existing member, so nobody appears twice.

## 3. Message hierarchy

**Headline** (2026-09-08, one promise, not a feature list): *Dinner, decided together.*

**Tagline** (from the README, keep it; it opens the sub): *Vote on dinners, plan the week, keep the shopping list.*

**Sub-line**: *In the Claude you already have. By clicking, or by asking.*

**One-line value proposition**: chef-gpt turns the weekly dinner argument into a ranked list, the ranked list into a week, and the week into a shopping list, without leaving Claude Desktop.

**Three proof points**

1. Four apps open right in the chat: Round builder, Vote, Week plan, Shopping list.
2. Everything the apps do you can also say: tools take names, not ids, so "put the chorizo on Tuesday" just works.
3. Kids vote too. Members do not need accounts; adults join with an invite.

## 4. Page outline with copy

### Hero

**Label**: Household meal planning · inside Claude Desktop

**Headline**: Dinner, decided together.

**Sub**: Vote on dinners, plan the week, keep the shopping list. Your household ranks the candidates, the ranked list fills the week, and the ingredients land on one shopping list. In the Claude you already have, by clicking or by asking.

**Primary button**: Sign in and add the connector
**Secondary link**: See it in the chat

**Print**: one photo of dinner on the table, taped to the sheet under the trust line. The only photograph on the page outside the notes; it is what the page is about.

**Trust line under the buttons** (what they need to believe, not how set-up works): Nothing to install · Kids vote without signing in · One household, shared by everyone in it

**Share card and tab**: `site/public/og.png` (1200×630, the headline beside three dinners on notes) and `favicon.svg` (a yellow note with a fineliner tick), linked from `site/index.html`.

### In the conversation

**Headline**: It opens where you already are.

Say what you want, and the app for it opens right in the chat. Nothing to install on anyone's device; the kids rank on your screen. This one is live: place the last candidate and submit.

The frame is a Claude Desktop window with "chef-gpt connected" in its bar. The person's turn: "Emma wants to vote on this week's round". Claude's reply, then the Vote app live inside it (Emma, three of four placed), then Claude's follow-up about closing the round.

### How it works

Four steps, in the order the household lives them.

1. **Start a round.** Pick eight candidate dinners from your cookbooks, choose who votes. "Start a voting round with eight quick weeknight dinners for everyone."
2. **Everyone ranks.** Each participant drags every candidate into a tier: S, A, B, C, D, F or GARBAGE. Results stay hidden until the round closes.
3. **Fill the week.** The ranked list sits next to the week. Tap a dinner, then a day. Or say "Tuesday is the chorizo pasta, Wednesday we're eating out."
4. **Shop once.** Add a recipe's ingredients to the shopping list, check things off in the shop by saying them, clear what you bought.

### The four apps

Each app is an MCP App: it opens inside the Claude conversation when the matching tool runs, and it is the same data the tools talk to. All four are live here, on an example household. One at a time, on tabs, so each is shown large; what you did in one stays done when you come back to it.

- **Round builder.** Search the cookbooks, collect candidates, choose who votes, start voting.
- **Vote.** Pick your name, place each candidate in a tier. Voting again replaces your earlier ranking.
- **Week plan.** The week's dinner slots beside the latest ranked list. Place, type free text, clear.
- **Shopping list.** One running list with check-off, quantities, and the recipe each item came from.

### Or just ask

Everything the apps do you can also say: "plan the week from the last round", "what's for dinner tonight?", "I'm going shopping". Tools take names, not ids. "Retire the tofu bowl", "add milk", "who still needs to vote?" A name that matches two recipes comes back as a question, never a guess.

### Your household (`household/week`, `household/vote`, `household/shopping`)

Not a section of the landing page: the signed-in member's page, phone first, reached from the nav ("Your household"), from the connector card after sign-in, and from the set-up prose. A strip of three tabs that stays put, the real view below it, and one line at the foot: "Rounds, recipes and invites are for Claude: the organizer says it, this page shows it." Signed out, the sheet holds the sign-in card. While a tool answers, the sheet draws itself; when the tool says no ("no open round"), the sheet prints its words with a "Try again". ADR 0007 has the data path.

### Set up in three steps

1. **Sign in** here with Google or a magic link. That creates your household.
2. **Add the connector** in Claude Desktop: Settings → Connectors → Add custom connector, and paste the connector URL shown after you sign in.
3. **Approve.** Claude brings you back here to authorize it. Then open a new chat and say "set up my household".

Joining someone's household instead? Open the invite link they sent you and sign in; the invite is redeemed on the way in. Not the organizer? Then skip the connector: your household is on this site, phone first: the week, the vote and the shopping list.

### Dropped on 2026-09-08

"Kids vote too", "Run your own" and the FAQ came off the page: they spoke to builders and to people already using it, and made the audience unclear. The kids line lives on in the trust line; the builders get the repo link; the FAQ answers belong in the README.

### Footer

chef-gpt · Household meal planning as MCP Apps · Source on GitHub · Sign in · Built by Tangerine Labs

## 5. Vocabulary rules

Use the left column; never the right.

| Say | Never |
|---|---|
| user | account, login |
| household | family, team, tenant |
| member | child, kid (as a noun for the role), voter |
| invite | invitation link, share code |
| cookbook | catalog, library, collection, source |
| recipe | meal, dish, dinner (as the data object; "dinner" is fine for the slot in prose) |
| retired | deleted, hidden, banned |
| round | session, vote, poll |
| candidate | option, entry |
| participant | voter |
| ranking | vote, submission |
| tier | grade, rating, score |
| ranked list | winners, results, leaderboard |
| meal plan | week plan, schedule |
| slot | day, entry |
| shopping list | grocery list, basket |
| item | ingredient (that is on the recipe), product |

"Kids vote too" is allowed as a headline because it describes people, not the role. In body copy the role is *member*.

## 6. Design

**Decided (2026-09-08): the Notes cut on Signal, built from the components.** The site is `site/src/Landing.tsx` on the design system in `docs/design-system.md`: sheets of copy on the desk, and between them the real view components from `packages/ui` on the fixture household, so what the page shows is exactly what the product is. Nothing on the page is a mockup.

- **Hero.** The headline printed large on a sheet, the sub, the two buttons, the trust line and the taped photo; beside it the Week plan view with the closed round's ranked list in its tray. Put a dinner on a day, by drag or tap-then-tap. When all three notes are placed the sheet celebrates (the date stamp, then two fineliner bursts), which is the first time a view mounts the celebration. "Start over" resets it.
- **In the conversation.** A Claude Desktop frame (title bar, the person's turn as a bubble, Claude's turns as print) with the Vote view live inside it: the product where it lives.
- **How it works.** The four steps as numbered rules; the example utterance in pen.
- **The four apps.** Round builder, Vote, Week plan and Shopping list, live, one at a time on tabs, each with a printed caption.
- **Or just ask.** The three example lines in pen (what a person says), the names-not-ids paragraph printed.
- **Set up, footer.** Copy as in section 4. Signed in, the set-up card leads with "Open your household".
- **Your household.** Its own page (`site/src/household/`): the tab strip, the view's own sheet edge to edge on a phone, widening a little on a desk. The three sheet states (drawing, notice, error) are in the gallery as "Sheet — …". The set-up sheet holds the sign-in card (Google, magic link, invite code); signed in, it shows the connector URL instead. An invite link scrolls to it.

The consent sheet (Claude's `?authorization_id=` request, the magic-link return) stands alone as before, in `site/src/App.tsx` with `auth.module.css`.

The copy sheets are plain paper: the dot grid is the views' texture and stays inside them, so the page has one texture where it counts rather than everywhere. Fixture recipes and items are in English on this English page.

Body copy is Inter from Google Fonts (`site/index.html`); print and pen are the bundled Space Grotesk and Shadows Into Light. Dark mode is the black desk.

### Directions explored before, kept for the record

Every mockup lives in `site/designs/`, is served by `deno task dev:site` at `/chef-gpt/designs/<name>.html`, snapped with `deno task preview:snap --page designs/<name>.html`, carries the copy from section 4 verbatim plus a sign-in card in its own style, and is not part of the deployed build. They predate Signal and keep their own palettes.

### Transcript (`transcript.html`)

The page is a conversation. The reader's lines are set huge in a serif (Fraunces), chef-gpt's replies in a plain sans (Inter), and the four apps appear inline as replies, the way they do in Claude Desktop. No hero headline; the first user turn does that job. Ink on white with the product's orange; dark mode inverts. Rules broken on purpose: no hero, no feature grid.

### Four analogies for the role the product plays

Each of these leads with one thing chef-gpt *is* for the household, and builds the whole page out of that object's world.

**The fridge door** (`fridge.html`). The one surface the whole household reads: the week in marker on the whiteboard, the list on a notepad under a magnet, the ranked list pinned as a printout, tier chips as round magnets, a kid's doodle. Role: shared. Marker handwriting for what is written on the fridge, a clean sans for everything else. Light only, because a fridge is white.

**The wall planner** (`planner.html`). The Monday-start week grid with a pen in it. The hero is the seven-day grid on planner paper, dinners written in blue ink, "eating out" struck in red, the ranked list on a sticky note. Role: planner. Condensed printed labels, humanist body sans, pen face only for what is written in. Dark mode is a dark desk.

**The scoreboard** (`scoreboard.html`). The fair referee that settles "what are we eating" with a ranked list and no winner. The hero is the ranked list as an arena board: point totals, each member's tier as a tile, a "NO WINNER · CHOOSE BY HAND" panel. Role: decider. Compressed display numerals, sturdy grotesk body, matte black with scoreboard yellow. Light is a daylight gym board.

**The chalkboard specials** (`chalkboard.html`). The bistro board that tells you what is on tonight and what is missing. The hero is "TONIGHT" on the board: the dinner, its cook time, the missing items, the week's specials. Role: meal helper. Chalk display face for headings only, clean sans body, board green with chalk yellow. Light is a café wall with a framed board.

### Four cuts of the wall planner, one idea each

Each keeps the sheet, the grid and the pen, drops everything the idea does not need, and keeps the tagline, the hero paragraph, the two CTAs, the three setup steps and the footer. Motion runs once, is short, and is off under reduced motion.

**Ink** (`planner-ink.html`): the week writes itself in. On load a pen nib moves slot to slot and the dinners appear as ink, "Pandekager" is struck in red before "eating out", and the sticky note's ranked list is ticked as each dinner lands. Then "The wall planner that fills itself in." Replay via "Write it again"; never loops.

**Say** (`planner-say.html`): say it, and it's written. One ruled input under the grid with four suggestion chips. A tiny parser finds a weekday and a recipe by a unique part of its name and writes it in; an ambiguous name comes back as a red-pen question in the margin ("Which one: chorizo pasta or kalkun?"). Demonstrates names-not-ids. Nothing moves without user action.

**Notes** (`planner-notes.html`): the ranked list is a stack of sticky notes; put one on a day. Drag with a pointer, or pick up with tap/Enter and place on a highlighted day; announced for screen readers; Reset restores the stack. "There is no winner. People choose from the list by hand."

**Sheet** (`planner-sheet.html`): the whole site is one planner sheet, no JavaScript. Hovering or focusing a filled day reveals marginalia in pen: what the household said to put it there. Three ruled lines below the grid and nothing else.

### Four identities for the materials

Each is a "materials board" (`site/designs/identity-<name>.html`): the same six panels, calendar, round, index card, notepad, pen and tape, tokens and type, so the identities compare like for like. The materials and their meanings are in `docs/design-system.md`.

**Stationery** (`identity-stationery.html`): the planner as it comes from the shop. Cream paper, printed rules, blue pen, yellow notes, clear tape. Barlow Condensed, Source Sans 3, Caveat.

**Nordic** (`identity-nordic.html`): squared paper, one black fineliner, pastel notes, washi tape. Calm and precise. Archivo Narrow, Karla, Nanum Pen Script. Dark is a birch desk.

**Schoolbook** (`identity-schoolbook.html`): the exercise book from the kitchen drawer. Lined paper with a red margin, felt-tip pen, neon notes, patterned tape, so the kids' votes look like theirs. Fredoka, Nunito, Patrick Hand. Dark is a chalkboard-green desk.

**Kraft** (`identity-kraft.html`): a working kitchen. Kraft paper, black marker, red grease pencil, manila card, butcher-paper notepad, masking tape. Oswald, Work Sans, Permanent Marker. Dark is a slate counter.

### Four Nordic variations

Same six-panel board as the identities above; each keeps the Nordic calm and one fineliner but changes the material world.

**Fjord** (`identity-fjord.html`): cool and coastal. Squared paper in grey-blue, navy ink, coral corrections, notes in fog, ice and sand, navy washi. IBM Plex Sans Condensed, IBM Plex Sans, Kalam. Dark is a deep fjord.

**Hygge** (`identity-hygge.html`): warm linen and oak. Ruled paper, brown-black ink, brick corrections, notes in mustard, clay and sage, kraft washi with a linen weave. Fraunces for print, Nunito Sans, Caveat. Dark is candle-lit oak.

**Signal** (`identity-signal.html`): Swiss-Nordic, strict. White paper with a dot grid, black ink, one signal red, every note the same signal yellow, clear tape with a black edge. Space Grotesk, Inter, Shadows Into Light. Dark is pure black.

**Moss** (`identity-moss.html`): spruce and birch bark. Green-tinted squared paper, deep green ink, lingonberry corrections, notes in lichen, birch and berry, linen washi with a green stripe. Josefin Sans, Mulish, Indie Flower. Dark is dark spruce.

