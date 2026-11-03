# Handoff — Julius site prototype (updated 2026-11-03)

Read **CONCEPT.md** first (product/design decisions; its hero section is outdated — see below).
This file = current state + what's next.

**Repo:** https://github.com/avistpv/Julius-Avi-V — branch `main`. Push after each approved step (`git push`;
auth here is the `vfreed0mz01-cyber` GitHub account via `gh`). avistpv (repo owner) also commits — always
`git fetch` + `git rebase origin/main` before pushing. **Vercel builds only owner-authored commits**: after our
pushes avistpv must push an empty commit or hit Redeploy; our pushes alone do not deploy.
The older repo `vfreed0mz01-cyber/Julius-Avi-V` and any `feat/landing-prototype` branches are stale copies.

## Current goal: Lighthouse Performance 95+ (mobile and desktop)
Vercel before this round: 71 mobile / 80 desktop. Local prod-build Lighthouse now: desktop ~90, mobile ~70 with the
WebGL hero, 88–94 with the 2D hero (phones get the 2D hero automatically, see below). Local numbers are noisy
when the user's own Chrome tab with the site is open (it eats CPU) — prefer PageSpeed Insights on the Vercel URL.

## OPEN BUG — fix first
**2D hero: the pre-rendered bust is jerky** ("бюст дёрганный"). User saw it on `http://localhost:3000/?hero=2d`.
`components/hero/Dust2D.tsx` draws the bust from 9 pre-rendered yaw frames (`public/bust/f0..f8.webp`) and picks
`frames[round(yaw -> 0..8)]` every rAF while `yaw` eases after the pointer / idles on a sine — so it snaps between
frames (9 steps across ±0.6 rad) and, while frames are still loading, falls back to `frames.find(Boolean)` (any
loaded frame -> visible jumps between different angles). Likely fixes, in order of preference:
1. Stop turning the picture: use one frame (f4, yaw 0) only; keep the gentle float (`by` already bobs) — simplest, matches the
   "картинками" brief.
2. Or cross-fade between the two neighbouring frames by the fractional yaw instead of snapping, and never draw
   until all 9 frames are loaded (draw dust only until then).
3. Also check the scan-line reveal: the clip `rect` is computed per frame from `sweepY`; the dust above the line
   is culled with `continue` — fine, but make sure `store.anchor` is stable (it is measured by SmoothScroll on
   layout changes only).
The 3D hero (desktop) is unaffected.

## Run / check
- `npm run dev` → http://localhost:3000. `?hero=2d` forces the 2D hero on desktop, `?hero=3d` forces WebGL on phones.
- **Do not run `next build` while the dev server is running on the same `.next`** — it corrupts the dev server
  (500 "Cannot find module ./897.js"). Stop dev first, or build into another dir. After a build: `rm -rf .next`,
  restart dev.
- Prod + measure: `npx next build && npx next start -p 3001`, then Lighthouse
  (`npx lighthouse@12 http://localhost:3001/ --only-categories=performance --form-factor=mobile
  --screenEmulation.mobile --throttling-method=simulate` or `--preset=desktop`), and the smoke test
  `node tools/e2e.mjs http://localhost:3001` (18 checks; must stay 18/18).
- Type-check: `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` (ignore TS6053 about `.next/types` if `.next`
  was just deleted).
- Screenshots: `node tools/shot.mjs "http://localhost:3000/" .shots/name "[data-jump]" "0.1,0.3" [w] [h]` (headless
  Chrome; `.shots/` is git-ignored). Headless Chrome here can use the real GPU (Intel Iris Xe) — glass renders properly.
- In dev the OS "reduce motion" setting is ignored; in production `?motion=1` forces motion on (`lib/motion.ts`).
- Talk to the user in Russian; short steps, screenshots + live page, discuss before big changes.

## Page order (app/page.tsx)
1. **Hero** (`components/hero/*`) — paper backdrop, JULIUS only in the header, centred slogan, under it a cloud of
   blue dust that breathes and parts around the mouse. Desktop (≥900px): WebGL (`Scene.tsx` + `Morph.tsx`, 14k
   particles, glass bust via `MeshTransmissionMaterial`, lit by a tiny procedural equirect `StudioEnv.tsx`).
   Phones (<900px) or `?hero=2d`: `Dust2D.tsx` — 2.6k crisp points on a 2D canvas, then the pre-rendered glass bust
   (see bug above). The 3D layer mounts on `requestIdleCallback`; the text is in the first paint (no preloader).
   Dark ring cursor. Clock → Roman numerals on click.
2. **Intro** (`components/intro/*`) — on scroll the dust flies into the figure slot `[data-bust-anchor]` and gathers
   into Caesar; a scan line reveals the bust. `store.morph` from `SmoothScroll.tsx`. Word fill on plain rAF (no GSAP).
3. **II · Opera Selecta** (`components/work/*`) — 12-col grid, Unsplash placeholders, hover = WebGL block distortion
   (`HoverDistort.tsx`, lazy), cursor VIEW, magnetic anchor on "All XVII projects" (`Tether.tsx`), torn-paper edge
   (`components/TornEdge.tsx`). GSAP + ScrollTrigger load only when the grid is near.
4. **III · Virtvtes** (`components/jump/*`) — pinned 600vh under the work grid: torn paper → painted arch (canvas) →
   push through into the landscape (`Painting.tsx` shader) → VENI / VIDI (mosaic → glowing etching) / VICI (stars) →
   values as a constellation (`Constellation.tsx`). Props per word in `Props.tsx`. Scroll map + `SNAPS` in
   `phases.ts`; SmoothScroll glides to the nearest resting point ~120ms after the scroll stops.
5. **III · Legio — team** (`components/legio/*`) — pinned horizontal track, 11 cards (`lib/team.ts`, Unsplash
   placeholders, `public/team/CREDITS.md`), engraving → colour near centre / on hover, 3D tilt, white ring cursor.
6. **IV · Numeri → V · Colloquium** (`components/finale/*`) — numbers + Nevo Adisol quote, light disc grows from the
   lime dot into the call form; auto-scrolls through the reveal. Form submits nowhere yet.
Sections 4–6 are **lazy** (`components/LazySections.tsx`): placeholders of the same height until ~1.5 screens
away; a nav click dispatches `mount-sections` to mount them all before scrolling (`goTo` in Hero.tsx).

## Performance work done (perf round 1 + 2D hero)
- First-load JS 370 → 126 kB; three.js, GSAP, Lenis-free SmoothScroll; sections lazy; no preloader veil.
- One geometry measurement per scroll in `SmoothScroll.tsx` (`store.legio/finale/dot/tether/anchor`); no
  `getBoundingClientRect` inside rAF loops; sections dispatch `window 'layout'` when they resize.
- Caesar prepared offline: `tools/bust.mjs` (source `tools/assets/caesar-src.glb` → `public/models/caesar.glb`,
  19k tris, quantized; `public/models/caesar-points.bin` 14k int16 surface points). `useCaesar.ts` bakes the
  quantized node transform (×0.5) — without it the bust is 2× too big.
- Bust frames: `node tools/bust-frames.mjs` renders `public/bust/f0..f8.webp` from `/lab/bust` (dev server must be
  running) on the GPU; re-run if glass/light changes.
- Fonts self-hosted (`app/fonts`, `next/font/local`; the Google loader broke the build). Images WebP (AVIF timed
  out the local optimiser). `experimental.inlineCss`.
- avistpv's `lib/gpu.ts`: on software WebGL (PageSpeed, VMs) the 3D hero runs at 0.5 dpr, no MSAA, ~20 fps.

## Next steps
1. Fix the jerky 2D bust (above), re-check on a phone viewport (390px) and `?hero=2d`.
2. Measure on Vercel (PageSpeed Insights) after avistpv redeploys; then round 2 if needed: image sizes/srcset for
   work + team, `caesar.glb`/points fetched later (after first paint), `unused-javascript` (~120 kB of three in the
   hero chunk — only matters for desktop), LCP render delay (slogan is LCP; currently ~1.7 s render delay on
   mobile sim — check what blocks it).
3. Form destination (email / Telegram / CRM?), real contacts, footer, real photos. Mobile layout pass.

## Gotchas
- Raw `ShaderMaterial`s output untransformed colour; don't set `colorSpace` on textures they sample.
- The arch is drawn on a canvas because a hugely scaled DOM layer breaks into raster tiles.
- Jump section is `margin-top: -100vh` under the work grid (z-index 3) so the tear reveals an already pinned scene.
- Higgsfield credits are low (~164) — generate only with the user's OK.
- `.shots/`, `.next/`, `tsconfig.tsbuildinfo` are git-ignored; `tools/assets/caesar-src.glb` is the model source.
