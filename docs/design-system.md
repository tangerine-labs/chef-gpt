# chef-gpt design system, first pass

The household's planner on the wall: paper, pen, sticky notes and tape. Everything a person sees is one of six materials, and each material has one job. Vocabulary is `CONTEXT.md`'s.

The identity is **Signal**: white dot-grid paper, one black fineliner, one signal yellow, one signal red. Chosen because it holds its own inside any host chrome (Claude, ChatGPT, a browser) without fighting it. The reference rendering is `site/designs/identity-signal.html`; the interaction reference is `site/designs/planner-notes.html`.

## Materials

**Sheet.** White paper with a faint 10px dot grid and 1px black rules. The dots are texture, not pattern: light enough that text over them reads without effort. It holds what is *fixed*: the calendar (the meal plan, Monday start, seven columns, day and date printed), the seven tier rows in a round, section labels. Printed text is black, uppercase, widely tracked; nothing on the sheet is ever handwritten by the system.

**Sticky note.** Always the same signal yellow with black text, square. A note sticks by itself, so it never carries tape; its state is in how it lies. **Loose** (in a tray): turned up to a degree, a lifted shadow. **Placed** (in a row, on a day): pressed flat, no turn, a hairline shadow. A note is always a recipe as a *candidate or a choice*: something you can pick up and put somewhere. It shows the title, and once a round is closed, the points and one tier dot per member. Notes live in a **tray** (a loose stack) until placed; an empty tray means the task is done. A note never holds a paragraph. Two sizes: **full** shows the whole title on up to three lines; **compact** is one line with an ellipsis; how the full title is revealed is not decided (no tooltip). The calendar and tier rows use compact; the tray and the ranked list use full.

**Index card.** A card with 1px black rules and a signal-red top rule: a recipe in full. Title on the top rule; cook time, cuisine and cookbook stamped small beneath; ingredients one per rule with quantity and unit right-aligned; steps numbered below. A note is a card that shrank, so title and stamp line are identical on both. Photos appear in one place only: a candidate in a round shows its photo on the note if the recipe has one; nowhere else, and never a placeholder when it has none.

**Notepad sheet.** A narrow spiral-bound page, torn at the bottom, taped to the desk at both top corners: the shopping list. One item per rule with quantity and unit, a pen tick to check, and a small pen note naming the recipe the item came from. Checked items are struck in pen and stay until cleared; the button says "Clear N bought". Free items have no recipe note. The next free rule is where you add an item, written in pen.

**Tape.** A short clear strip with a crisp 1px black edge across the top edge. Tape means *this stays*, and it is for paper that does not stick by itself: a card or the notepad hung on the sheet gets a strip at each top corner; a photo gets one. Sticky notes never have tape. Tape never appears on printed things and never on more than the top edge.

**Pen.** Black ink is what a person said or wrote: a slot filled by hand, "eating out", a shopping item they dictated. Red is a correction, a question, or an error: a struck entry, "Which one: chorizo pasta or kalkun?", a field underlined in red marker. Red pen is a thicker nib than black (2px strikes and underlines, weight 600 text) and never below 14px, because thin red on white does not read. The system never writes in pen; it prints.

**Stamp.** A tier stamp is a square tile in the tier colour with the letter in black, pressed on a note. Where a note shows how members rated it, it carries one small stamp per member. Members themselves are a separate exploration: each member picks an emoji and possibly a background colour, and that mark appears on their stamp. Not designed yet. The **date stamp** is the office's other stamp: a 3px red-ruled box, uppercase Space Grotesk at 21px with 0.2em tracking, at a careless seven-degree angle, `FIRST ROUND · 8 SEP 2026`. Red ink here is neither a correction nor a question but the third, official use of the red pen. It marks a milestone (see Celebration under States) and stays on the sheet for good.

**Doodle.** Fireworks the way a child draws them in the margin: a rising squiggle, a burst of rays, a dash past each tip, sparks. Fineliner black (1.6px) and the red pen (2px), nothing else. The doodle is the household's celebration, so it is pen, not print, and it is the one time ink appears without a person having written it. It goes in the sheet's blank spots, never over print or notes, and it stays as drawn; it does not fade.

## Tokens

The box model is `border-box` for everything, set once in `packages/ui/signal.css` so the harness, the website and the gallery measure alike; a full-width control keeps its padding and border inside its box on all three.

From `site/designs/identity-signal.html`. Dark mode is a black desk with the same paper logic, not an inversion; the note stays yellow in both.

| Token | Light | Dark | Use |
|---|---|---|---|
| desk | `#ececec` | `#000000` | page ground behind the sheet |
| paper | `#ffffff` | `#141414` | sheet, card, notepad |
| dot | `#e8e8e8` | `#242424` | the 10px dot grid |
| rule | `#000000` | `#ffffff` | printed rules, borders, buttons |
| rule-soft | `#d9d9d9` | `#333333` | faint rules inside cells |
| print | `#000000` | `#ffffff` | printed text |
| print-muted | `#444444` | `#b8b8b8` | labels, dates, captions; dark enough to read over the dots |
| ink | `#000000` | `#ffffff` | the person's pen |
| ink-red | `#ff3b1f` | `#ff5a42` | corrections, questions, the card's top rule |
| note | `#ffe14d` | `#ffe14d` | every sticky note |
| note-ink | `#000000` | `#000000` | text on a note |
| tape | `rgba(255,255,255,.6)` | `rgba(255,255,255,.12)` | tape strip, cards and notepad only |
| tape-edge | `#000000` | `#ffffff` | the strip's 1px edge |
| focus | `#ff3b1f` | `#ffe14d` | focus ring |
| shadow | `rgba(0,0,0,.14)` | `rgba(0,0,0,.6)` | notes, card lift |

The desk token is painted by our views for now. If it fights a host's chrome in practice, remove it and let the host's surround be the desk.

**Spacing.** Two lengths are tokens because more than one place depends on them: `--sg-desk-pad` (12px), the band of desk a view paints around its sheet, and `--sg-sheet-pad` (14px), the sheet's own padding. A page that is already a desk (the website) sets `--sg-desk-pad` to 0 so views sit flush on the same grid as everything else; inside a host the default stays. Everything else is spaced by layout (`gap`), not margins, and there is no spacing scale beyond these two.

Tier colours stay as in `packages/ui/views/tiers.ts`: S `#FFD700`, A `#EF4444`, B `#F97316`, C `#EAB308`, D `#22C55E`, F `#3B82F6`, GARBAGE `#6B7280`. They appear as square row markers and stamps only, never as text colour.

**Reserved colours**, for exceptions only. Using one is a decision recorded in this document, not a local choice.

| Token | Value | Reserved for |
|---|---|---|
| note-orange | `#ff9f1c` | the confirmation note (see Rules) |
| note-pink | `#ffb3d9` | a second note kind, if one is ever needed |
| ink-green | `#1f7a4d` | a success mark if a tick in black ever proves ambiguous |
| ink-blue | `#1d3b8a` | a second pen if two people ever write on one sheet at once |

**Type.** Space Grotesk for everything printed: labels, day names, dates, headings, buttons, uppercase with wide tracking (0.14 to 0.2em), `tabular-nums` on numbers. The host's own sans for body copy at 16px (Inter on the site and in the gallery). Shadows Into Light for pen only, and never for more than a line or two.

Font stack, in CSS:

```css
--label: "Space Grotesk", "Helvetica Neue", Arial, sans-serif;
--body: var(--font-sans, Inter, system-ui, -apple-system, sans-serif);
--pen: "Shadows Into Light", "Bradley Hand", "Segoe Print", cursive;
```

Space Grotesk (weights 500 and 700, latin subset) and Shadows Into Light (one weight) are bundled into the view as `@font-face` with `data:` sources; see Hosts for why. Inter is not bundled: body copy takes the host's font so the sheet reads as native, and the identity lives in print and pen. On the site, Inter loads from Google Fonts.

**Shape.** Nothing has a radius, including the confirmation note. Rules are 1px, black in light and white in dark. Buttons are 1px-ruled boxes with uppercase Space Grotesk; the primary button is filled black (white in dark). A disabled button is always opaque: it is drawn in `print-muted` (fill for the primary, rule and text for the secondary), never faded with opacity. Notes rotate at most one degree.

**Motion.** A lifted note tilts and casts a deep shadow; on release it settles in 200ms and, if placed, presses flat. Ink appears with a short left-to-right reveal, 300ms. Nothing loops, nothing autoplays, and `prefers-reduced-motion` removes all of it. The one exception is a celebration, which plays itself exactly once (see States).

## States

**Loading.** The sheet is drawn, not spun. Pick one per view and keep it under a second: the dot grid fades in and the rules draw themselves left to right; a notepad sheet rolls down from its spiral; the tier rows are ruled one stroke at a time; a hand-drawn rectangle sketches where the card will be. No grey pulsing blocks.

**Empty.** A hand-drawn X in pen across the space, with one printed line saying what would go there ("No round open. Start one.").

**Error.** The thing that failed is underlined in red marker and the message is written beside it in red pen. Nothing else on the sheet changes colour.

**Confirmation.** A square orange note laid on top of the sheet (`note-orange`), one sentence and two ruled buttons. Used only for close-round-early and clear-checked.

**Celebration.** The one loud state, for a household's firsts: the first round closed, the household opened, the first week planned (`docs/celebrations.md` has the list, and the concepts that were tried and set aside). The server says which first it was in the tool result; the view plays the celebration once, on that result, never on a re-open or a poll, and it ends still. It is one sequence, `Celebration` in `packages/ui/views/Celebration.tsx`, rendered inside the sheet: at 400ms the **date stamp** slams down (scale 1.8 to 1 in 150ms) and the sheet shakes 2px once; from 750ms the household **doodles** two fireworks in the blank corner, black then red, each with the ink reveal, and both stay. Under two seconds in all. The stamp's text is the milestone and its date; where the stamp and the bursts go is the view's call (`stampAt`, `bursts`), because only the view knows its blank spots. Nothing else on the sheet changes: the ranked list underneath is the same ranked list. With `prefers-reduced-motion` both simply appear. Nothing else on the sheet changes: the ranked list underneath is the same ranked list.

**Live updates.** When another member changes the sheet, the change appears the way it would have if I had made it: a note settles, a tick is drawn, with the same 200 to 300ms motion and nothing more. Whether the host can deliver such updates is a platform question, answered under Hosts.

## Hosts

What the runtime allows, checked against `mcp-use` 2.3.4 and the MCP Apps spec (protocol 2026-01-26) on 2026-09-07. Details and sources in the research notes below the table.

| Question | Answer | What we do |
|---|---|---|
| Can a view load Google Fonts? | Only if `fonts.googleapis.com` and `fonts.gstatic.com` are declared in the view's `csp.resourceDomains`, which also widens `script-src`; Claude's guidance says bundle fonts instead. `data:` sources are always allowed. | Import the woff2 files in the view; `build --inline` turns them into `data:` URIs. No CSP change. |
| What width do views get? | Host-controlled. Claude: the view fills the chat column, roughly 400 to 500px on desktop, 320px minimum, and can go fullscreen. ChatGPT: about 768px inline. No px is guaranteed; `useHostContext().maxWidth` is the only signal. | Fluid from 320px. Compact notes below 480px. The Vote view offers fullscreen for the tier rows. |
| What height? | Auto-resize sends `ui/notifications/size-changed` from the document's max-content height; the host caps inline height and clips. | Keep sheets content-sized. A fixed-ratio calendar needs `viewConfig.autoResize: false` and a ResizeObserver. |
| Can the server push live updates? | No. A view receives its own tool result once; later tool calls do not refresh it, and there is no resource subscription into the iframe. | Views re-read on focus and, while a round is open, poll `get_round_results` every 20s. Changes animate with the same 200 to 300ms motion. Nothing else. |
| Theme? | Both `hostContext.theme` and `prefers-color-scheme`; mcp-use's ThemeProvider stamps `data-theme` on the root. | Tokens on `:root`, dark under `prefers-color-scheme: dark` and `[data-theme="dark"]`. Add `<meta name="color-scheme" content="light dark">`. |
| Host CSS variables? | The spec's set is `--color-{background,text,border,ring}-*`, `--font-sans`, `--font-mono`, font sizes, radii, shadows. No spacing, no accent. Hosts may provide any subset. | Signal paints its own paper, rules, notes and pen. It takes only `--font-sans` for body copy. `shared.module.css` currently reads `--text-primary` and `--border-primary`, which are not spec names; rename to `--color-text-primary` and `--color-border-primary` when the views are rebuilt. |
| Desk? | Claude recommends a transparent body so the host's surround shows. | Try the desk token first (owner's call). If it fights the chrome, set the body transparent and let the host be the desk. Set `prefersBorder: false` on every view. |
| Images? | Only declared origins load. | Keep the `/img` proxy. |
| Mobile? | Claude and ChatGPT both render MCP Apps on iOS and Android today; the connector must be added on desktop first. | Design for 320px even though desktop is the target. |

Research notes: spec `_meta.ui.csp` fields are `connectDomains`, `resourceDomains`, `frameDomains`, `baseUriDomains`; the reference host builds `font-src data: blob: <resourceDomains>`. mcp-use's `ToolViewConfig` accepts `csp`, `permissions`, `domain`, `prefersBorder`; chef-gpt declares none today. Claude's variable table with values is at claude.com/docs/connectors/building/mcp-apps/design-guidelines; the spec is github.com/modelcontextprotocol/ext-apps. Host-to-view messages are limited to `tool-input`, `tool-input-partial`, `tool-result` (latched once), `tool-cancelled`, `host-context-changed` and teardown.

## Views as materials

| View | Material | What you do |
|---|---|---|
| Round builder | tray being filled | search prints results on the sheet; adding one turns it into a loose note in the tray, "Remove" under it puts it back; participants are printed names with a pen tick; Start voting needs two notes |
| Vote | seven tier rows on the sheet, tray below | drag a note into a row, or tap the note then the row; a rated note lies flat; notes leave the tray as they are rated; the round closes when every participant has an empty tray; results stay hidden until then |
| Week plan | the calendar, notes from the ranked list | drag or tap a note onto a day; free text like "eating out" is written in pen; clearing strikes in red |
| Shopping list | notepad sheet | tick in pen, add on the next free rule, clear the struck ones |
| Recipe | index card | read; "add ingredients" copies its rules onto the notepad with a pen note naming the card |

## Rules

- Names first. Titles and first names are what people see; ids never appear.
- Drag is the primary and required interaction for placing a note. Tap-then-tap and keyboard stay as the fallback path, targets are labelled by name, and the result is announced. Keyboard order follows the sheet top to bottom; do not overthink it.
- Touch: a drag starts after 10px of travel (4px for a mouse), the page does not scroll while a note is held, and a drag the platform cancels leaves the note picked up so a tap on a target finishes it.
- There is no winner. A closed round is a ranked list; the language says "ranked list", "pick by hand".
- Printed things are stable; handwritten things are the household's. Do not make the system write in pen. The celebration doodle is the household's mark, not the system's, and the one case of ink nobody typed.
- Flatness is state, not decoration: a flat note is placed or rated, a lifted note is still to do. Tape is the same signal for cards and the notepad.
- One material per object. A recipe is a note when it can be placed, a card when it is read, a pen line on the notepad when it is bought. Never two at once.
- Three colours and no more: black, signal yellow, signal red. Tier colours are the one exception, and only as markers. A celebration adds no colour: the stamp is red ink, the doodle is pen and marker.

## Governance

This document is the source of truth; the fixture gallery (`site/preview.html`, `site/src/fixtures.ts`) is the living proof and is updated right after it. Order of work: this document, then the gallery, then `packages/ui` components.

Built so far: tokens in `packages/ui/signal.css` (fonts bundled from `packages/ui/fonts/`), materials in `packages/ui/views/signal.module.css`, the sticky note as a shared component (`packages/ui/views/Note.tsx`: drag, tap-then-tap, keyboard, loose or placed), the Vote view (tier rows and tray), the Week plan view (seven day rows, the ranked list as a tray, free text in pen, a placed note moves between days or back to the tray) the Shopping list (a spiral notepad sheet taped at the corners, one item per rule, pen ticks and strikes, a pen note naming the recipe, "add an item" on the next rule) and the Round builder (a printed search line, results as printed rows with Add, the tray filling with loose notes, participants as printed names with a pen tick, the label in pen), each with stories in the gallery, the website (`site/src/Landing.tsx`, `landing.module.css`: the copy of `docs/website.md` as sheets on the desk, the planner with the ranked list as the hero, the four views live on fixture data, sign-in inside the set-up sheet; the consent sheet on its own in `App.tsx`, `auth.module.css`), and the celebration (`packages/ui/views/Celebration.tsx`, `celebration.module.css`: the date stamp, the shake, the two-burst doodle), mounted by the Week plan through its `celebration` prop; the website plays it when the visitor fills the week.

## Rejected on the way

Stationery (cream, blue pen), Nordic pastels, Hygge, Fjord and Moss: all read well on their own but carry a paper colour and a note palette that compete with a host's chrome. Signal keeps the paper white and the note yellow, so the host's grey or dark surround becomes the desk.

## Not decided

Member marks (emoji, background colour) and whether members get cards; how a compact note reveals its full title.
