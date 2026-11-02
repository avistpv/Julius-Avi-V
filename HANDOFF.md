# Handoff — Julius site prototype (updated 2026-11-01, late)

Read **CONCEPT.md** first (product/design decisions; note the hero section there is outdated — see below).
This file = current state + what's next. Repo: https://github.com/vfreed0mz01-cyber/Julius-Avi-V (branch `main`, push after each step).

## Run / check
- `npm run dev` → http://localhost:3000 (Next 15, React 19, R3F 9, drei 10, three 0.187, GSAP + ScrollTrigger, Lenis).
- In dev the OS "reduce motion" setting is ignored (motion always on); in production `?motion=1` forces it on (`lib/motion.ts`).
- **Visual checks:** the app's built-in browser pane has WebGL blocked. Use
  `node tools/shot.mjs "http://localhost:3000/" .shots/name "[data-jump]" "0.1,0.3" [w] [h]` — headless system Chrome with
  SwiftShader WebGL; screenshots land in `.shots/` (git-ignored). Selector `-` + absolute px also works. Glass looks flat
  under SwiftShader; it is fine on a real GPU.
- Type-check: `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit`.
- E2E smoke test: `npm run build && npx next start -p 3001`, then `node tools/e2e.mjs http://localhost:3001` (18 checks:
  preloader, nav anchors, lazy paintings, scroll-through, form, routes, zero console errors). `CHROME=...` overrides the
  browser path (default: Windows or macOS Chrome).
- Talk to the user in Russian; they want quality, step by step, discuss before big changes, and they review every section
  from screenshots + the live page in Chrome. Push to GitHub after each approved step.

## Page order (app/page.tsx)
1. **Hero** (`components/hero/*`) — paper backdrop (`Sky.tsx` is now a "living paper" shader; its low-res texture also
   feeds the glass refraction), JULIUS only in the header, centred slogan "We build products / that ship.", and under it a
   round cloud of 14k blue particles that breathes and parts around the mouse (`Morph.tsx`). Dark ring cursor. Clock →
   Roman numerals on click. Preloader "Veni · Vidi · Vici". No wreath, no grid, no coords any more (the old hero was a
   near copy of haoqi.design and was rebuilt twice; the user approved this minimal version).
2. **Intro** (`components/intro/*`) — on scroll the cloud flies into the figure slot `[data-bust-anchor]` and gathers into
   the glass Caesar bust (`public/models/caesar.glb`), scan line reveals the glass. `store.morph` is computed in
   `SmoothScroll.tsx` from the slot position.
3. **II · Opera Selecta** (`components/work/*`) — 12-col staggered grid, Unsplash placeholders, hover = blocky WebGL
   distortion (`HoverDistort.tsx`), cursor "VIEW". The "All XVII projects" link has a magnetic anchor (`Tether.tsx`): thread
   + dust from the link to the pointer, link leans. Section ends with a torn-paper edge (`components/TornEdge.tsx`).
4. **III · Virtvtes** (`components/jump/*`) — pinned 600vh, starts one screen early under the work grid. Scroll map in
   `phases.ts`, progress `store.jump`. Beats: paper tears → painted triumphal arch (canvas-drawn, `public/jump/arch.webp`,
   inscription VENI · VIDI · VICI) → camera pushes through the opening into a Roman landscape (`Painting.tsx`, full-screen
   shader: dolly + parallax) → VENI (painting; props: brief, voice note, chat) → VIDI (props: Figma cursor/frame/panel/
   swatches; then the painting pixelates into a mosaic and dissolves block by block into a glowing Sobel-edge etching on a
   night sky) → VICI (flight on into the stars; props: terminal, version tag, launch toast) → values as a **constellation**
   drawn star to star (`Constellation.tsx`). Floating props live in `Props.tsx`. Both paintings were generated in
   Higgsfield (gpt_image_2_5, ~5.5 credits total).
   **Scroll snapping:** `SNAPS` in `phases.ts`; `SmoothScroll.tsx` glides to the nearest resting point ~120ms after the
   scroll stops (user asked for it so no half-states are ever shown).
5. **III · Legio — team** (`components/legio/*`) — pinned horizontal track out of the same night. 11 cards
   (`lib/team.ts`; photos are Unsplash placeholders, credits in `public/team/CREDITS.md`): engraving look that develops into
   colour near the centre and on hover; 3D tilt + inner parallax + glare on hover; white ring cursor.
6. **IV · Numeri → V · Colloquium** (`components/finale/*`) — one pinned stage: dark numbers (count up) + Nevo Adisol
   quote, then a light disc grows out of the lime dot (base1 reveal) into the light call form "Got an idea? Let's ship it."
   Once the disc starts growing the page auto-scrolls to the open form (and back to the numbers when scrolling up).
   The form only shows a "sent" state — nothing is submitted anywhere yet.

## Cursor modes (`components/Cursor.tsx`)
`data-cursor="view"` (blue dot + label), `ring-dark` (hero), `ring` / `ring-big` (team), `default` (light form).
The cursor re-reads what is under the pointer after scrolling.

## Next steps
1. **Form destination** — where do requests go (email / Telegram / CRM)? Ask the user, then wire it.
2. **Real contacts** in the Colloquium left column (email/phone — not invented yet) and a footer.
3. Real team photos (swap `public/team/p*.jpg` or paths in `lib/team.ts`); real project images in `public/work/`.
4. Mobile pass (postponed by the user), performance pass (three WebGL canvases: hero/intro scene, HoverDistort, Painting).
5. Pages "Work" and "About" (links exist, routes don't).

## Gotchas
- Raw `ShaderMaterial`s output untransformed colour; don't set `colorSpace` on textures used by them.
- Chrome breaks a hugely scaled DOM layer into raster tiles — that's why the arch is drawn on a canvas.
- The jump section is `margin-top: -100vh` under the work grid (z-index 3, paper background) so the tear reveals a scene
  that is already pinned.
- Higgsfield credits are low (~164) — only generate with the user's OK.
- The git identity used for pushes is the `vfreed0mz01-cyber` GitHub account (`gh auth switch` if needed).
