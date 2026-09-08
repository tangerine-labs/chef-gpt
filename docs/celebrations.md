# Celebrations: eight concepts

Signal is quiet on purpose: white paper, one pen, one yellow, one red, nothing loops, nothing autoplays. A milestone is the one moment the planner is allowed to be loud. This document collects eight distinctly different ways to do that, each argued from the materials in `docs/design-system.md`, so that trying one is a choice and not a mood.

## Milestones

The firsts worth marking, and the surface each one lands on:

| Milestone | When | Where it shows |
|---|---|---|
| Household opened | the first member of a new household signs in | the site (`site/src/App.tsx`), later a household view |
| First round closed | the last participant ranks, or the owner closes by hand | the Vote view, the moment the ranked list appears |
| First week planned | every dinner slot of a week holds a note or pen text | the Week plan view |
| First list cleared | the first "Clear N bought" | the Shopping list |
| First member joined by invite | `join_household` succeeds | the site, then the Round builder's participant list |

The server knows a first (count after the write equals one) and says so in the tool result, for example `milestones: ["first_round_closed"]`. A view never guesses; the host latches the tool result once, so the moment fires exactly once, which is what a celebration needs anyway.

## Ground rules for being loud

- **A celebration is a fourth state** next to loading, empty and error. It plays once, on the result that earned it, never on a re-open, never on a poll.
- **It ends still.** Every concept below finishes in a settled sheet, and most leave a **residue**: a mark that stays on the household's paper (a star, a stamp, a pinned sheet). The residue is the celebration for anyone who arrives late, for screenshots, and for `prefers-reduced-motion`, which skips the motion and shows only the residue.
- **Colours stay Signal's.** Black, paper, note-yellow, ink-red, plus the reserved and tier colours only where the concept names them and why. Nothing introduces a new hue.
- **It is silent.** Views live inside a chat host; sound would be the host's to grant and ours to regret.
- **Under two seconds of motion**, and the person can always cut it short by touching the sheet.

## The concepts

### 1. Hole-punch confetti

**The justification.** The only thing on a desk that makes confetti is a hole punch, and the sheet is already covered in 10px dots. On the milestone, the dot grid at the top of the sheet is *punched out*: the dots lift off the paper as discs and fall down the sheet, tumbling, landing on the bottom rule and on the tops of the notes, then slide off the page. Behind them the grid regrows dot by dot. Discs are paper-white with a hairline black edge (light) or dot-grey (dark), with one disc in ten cut from a sticky note, yellow, and one in forty from the red top rule of an index card. Three colours, all already on the page.

**Loudness.** 4 of 5. Screen-filling, but everything is made of the page.

**Residue.** None by default. Optional: three or four discs stay lying on the bottom rule of the sheet for the session.

**Tech.** Canvas 2D over the sheet, 300 to 600 discs with gravity, drag and one axis of spin; discs collide with note tops via their bounding boxes and nothing else. Pure CSS is possible for 60 to 80 pieces with `@keyframes` and per-piece custom properties. WebGPU adds nothing here.

**Fits.** First round closed, first week planned.

### 2. Fineliner fireworks

**The justification.** Fireworks the way a child draws them in the margin of homework: a dot, then radial strokes, then little dashes at the tips, in one continuous pen. The system never writes in pen, so this is the household doodling, not the printer: the doodle appears in the margin *outside* the sheet's rules, on the desk, where notes in the margin belong. Bursts draw themselves with the ink-reveal motion (stroke-dashoffset, 300ms per burst, three or four bursts staggered), black first, then one burst in red, then the sparks of the last one in note-yellow because someone reached for the highlighter.

**Loudness.** 3 of 5. Small, fast, charming; it fills the margins, not the sheet.

**Residue.** The doodles stay in the margin, faded to `print-muted`, until the view is next opened. A household could collect one margin doodle per milestone.

**Tech.** Inline SVG paths with `stroke-dasharray` reveal; a light hand-drawn wobble by displacing path points at generation time, not with filters. Zero dependencies, works at 320px, cheap in dark mode (white pen).

**Fits.** First round closed, first member joined (a small burst next to the new name).

### 3. Gold foil star

**The justification.** The teacher's foil star, pressed on a good piece of work. Tier S is already gold and gold is already permitted "for stamps and markers only": the star is a sticker, a member of that class, and the *only* foil object in the system. It peels off a sticker sheet that slides in from the edge, hovers, and presses down with a squash and a flat shadow, exactly the way a note is placed. The sheen moves when the pointer moves or the phone tilts, so the star is the one thing on the page that reacts to light.

**Loudness.** 2 of 5 in motion, 4 of 5 in meaning. It is the most *permanent* concept here.

**Residue.** Permanent. The star sits at the top right of the household's sheet header; each milestone adds one, so a household with four stars has been at this for a while. A star row is also the natural place to hang a tooltip-free date in print beneath.

**Tech.** CSS `mask` for the star shape, `conic-gradient` driven by `--pointer-x/y` for the foil; a WebGL shader (anisotropic highlight, device orientation) if the CSS foil looks flat. This is the one concept where a GPU earns its place, because the material is light.

**Fits.** Household opened (the first star), and every other first.

### 4. Date stamp

**The justification.** The tier stamp already exists: a square pressed on a note. A milestone gets the office's other stamp, the rubber date stamp, in red ink at a careless angle: `FIRST ROUND · 8 SEP 2026`. It slams: scale from 1.6 to 1 in 150ms, the sheet shakes 2px once, the ink bleeds at the edges and is slightly under-inked on one side. Red is the pen of corrections and questions, and the stamp is a third, older use of red ink: the official one. Uppercase Space Grotesk, widely tracked, because a stamp is printed.

**Loudness.** 3 of 5. One violent frame, then done.

**Residue.** Permanent, and it dates the sheet: the ranked list of a round keeps its stamp; the household's header keeps `OPENED · 1 SEP 2026`. A pile of stamped sheets is a passport.

**Tech.** CSS transform and a single `feTurbulence` + `feDisplacementMap` SVG filter for the ink edge, applied once and rasterised (set `will-change` off after). No canvas.

**Fits.** Household opened, first round closed, first list cleared.

### 5. Bunting

**The justification.** Paper garlands are what a household hangs for a birthday, and they are the one decoration that is *also* paper on a string. A black thread is taped at both top corners of the sheet with the existing tape strips (tape means "this stays") and sags in a catenary; triangular flags in note-yellow and ink-red hang from it, one printed letter per flag: `F I R S T  R O U N D`. The thread drops in from above, swings once with real pendulum easing and settles. Flags are the note material cut into triangles, so they stay flat and matte.

**Loudness.** 3 of 5. Bright and wide, but still and orderly after a second.

**Residue.** The bunting stays across the header until the next visit; on `prefers-reduced-motion` it is simply there.

**Tech.** Pure CSS: flags are `clip-path` triangles absolutely positioned along a quadratic curve computed once; the swing is one `@keyframes` on the thread's container with a 1.2s damped ease. Works at 320px by dropping to a shorter word (`FIRST`) on narrow sheets.

**Fits.** Household opened (the name on the flags: `A N D E R S S O N S`), first round closed.

### 6. The notes tumble

**The justification.** A round closes and the rated notes are what they always were: paper stuck to a sheet. So they come *unstuck*. Every note in the seven tier rows peels at one corner, drops, tumbles, and lands in a pile at the bottom of the sheet, bouncing off one another and the rules. Then the pile sorts itself: notes slide out one at a time, highest score first, and stack into the ranked list with their points and member stamps pressed on as they land. The celebration *is* the transition to results, so it carries meaning: the household watches the ranked list being made from the notes they placed.

**Loudness.** 5 of 5. The entire sheet moves. Nothing else here is as physical.

**Residue.** The ranked list itself, which the view shows anyway.

**Tech.** Hand-rolled 2D rigid bodies on the DOM notes (position, angle, one restitution constant, axis-aligned collision with the rules and a coarse note-to-note push). A canvas mirror is faster for 20+ notes; 1.5 seconds total. WebGPU is overkill for a dozen notes, though a compute-shader version would be fun for a household with a big cookbook. Reduced motion cuts straight to the stacked list.

**Fits.** First round closed only; the first time earns the full tumble, later rounds could get a shorter version or nothing.

### 7. Pin it on the wall

**The justification.** The design document starts with "the household's planner on the wall". On a milestone the camera pulls back and shows the wall: the sheet shrinks to a card, the desk becomes a corkboard (light) or a black wall (dark), a red push-pin drops through its top edge with a small bounce, and the sheet hangs there beside the household's earlier pinned sheets. The celebration is *scale*, not colour: seeing that this sheet has become a thing worth keeping, next to the others. Then the camera pushes back in and the sheet is a sheet again.

**Loudness.** 3 of 5. Cinematic, a zoom-out and a pin; no particles.

**Residue.** The wall itself: a gallery of milestone sheets a person can open from the header, each pinned with its date. The push-pin (ink-red head, black shaft) becomes a seventh material, used only here.

**Tech.** CSS 3D transforms on the sheet container with `perspective`, a two-step animation (out, pin, in) of 1.6 seconds; the wall is the desk token plus a cork or wall texture drawn in CSS gradients. Fullscreen views make this dramatic; inline at 400px it still reads.

**Fits.** Household opened (the first sheet on the wall), first week planned.

### 8. The printout

**The justification.** The system never writes in pen; it prints. So its own way of celebrating is to *print something*: a certificate on a strip of dot-matrix paper that feeds out of the top of the sheet line by line, tractor-feed holes down both sides, uppercase print, widely tracked: `THIS CERTIFIES THAT THE ANDERSSON HOUSEHOLD CLOSED ITS FIRST ROUND ON 8 SEPTEMBER 2026 · 3 PARTICIPANTS · 6 CANDIDATES`. Below the text a red seal (the date stamp of concept 4, smaller). When the last line prints, the strip tears along its perforation with a small jerk and is taped to the sheet at both top corners like a card.

**Loudness.** 2 of 5. Deadpan; the humour is that a fussy printer is trying its best.

**Residue.** The certificate stays taped to the sheet, and every certificate the household earns is a card in a cookbook-style stack: the same index-card material, top rule in red.

**Tech.** CSS only: the ink-reveal motion applied line by line (300ms each), the tractor holes as a repeating radial gradient, the tear as a `clip-path` polygon that jitters for two frames. Reduced motion shows the taped certificate at once.

**Fits.** Household opened, first round closed, first list cleared (`CLEARED 14 ITEMS`).

## How they differ

| | Metaphor | Motion | Colour | Residue | Cost |
|---|---|---|---|---|---|
| 1 Hole-punch confetti | office | falling particles | paper, note, red | none | canvas 2D |
| 2 Fineliner fireworks | homework margin | ink drawing | pen, red, yellow | faded doodle | SVG |
| 3 Gold foil star | school | peel and press | gold (tier S) | permanent star row | CSS, GPU optional |
| 4 Date stamp | bureaucracy | one slam | red ink | permanent stamp | CSS + SVG filter |
| 5 Bunting | birthday | drop and swing | note, red | until next visit | CSS |
| 6 The notes tumble | the sheet itself | physics | none new | the ranked list | JS physics |
| 7 Pin it on the wall | the planner's wall | camera | red pin | the wall gallery | CSS 3D |
| 8 The printout | the printer | line by line | print, red seal | taped certificate | CSS |

Pairs that work together without shouting over each other: 4 + 1 (stamp, then confetti), 3 + 8 (a star on the certificate), 6 + 4 (the list stacks, then gets stamped). Pairs that fight: 1 + 6, 5 + 7.

## Trying one out

Each concept is a story in the fixture gallery first (`site/src/fixtures.ts`, `deno task preview --story "…"`), rendered in light and dark with `deno task preview:snap`, before it touches a view. The milestone flag is a prop on the component so the fixture can flip it; the server adds `milestones` to the tool result once a concept is chosen.

## Outcome (2026-09-08)

All eight concepts were written up; concepts 1 to 5 were built as two takes each (a simple and an ambitious one), then the stamp and the fireworks were tried together in four combinations. The owner reviewed them on a single page (https://claude.ai/code/artifact/6d24b5a7-ecf2-4fb8-b02d-f7d41e1356e2, kept as the record) and kept one:

**The date stamp, then two fineliner fireworks.** The ruled red stamp slams down and shakes the sheet; once it is still the household doodles two bursts in the blank corner, black then red. Nothing fades. The yellow marker burst from the fireworks exploration was dropped in favour of the red one, so a celebration uses only the two inks the sheet already has. Four bursts next to a stamp was crowded: the stamp is the loud thing and the doodle is the reaction to it.

It lives as `Celebration` in `packages/ui/views/Celebration.tsx` and is described under Materials (date stamp, doodle) and States (Celebration) in `docs/design-system.md`. The gallery story is "Celebration — first round closed". The other takes were removed from the library and the gallery; the concepts above stay as written for the next time the planner needs to be loud.

Not built yet: the milestone flag in the tool result, and the view that mounts the celebration on it (the ranked list is shown by the Week plan, so that or a new closed-round sheet is the place).
