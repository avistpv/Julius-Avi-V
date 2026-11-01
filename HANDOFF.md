# Handoff — Julius site prototype (2026-11-01)

Read **CONCEPT.md** first (all product/design decisions). This file = current state + what's next.

## Run / check
- `npm run dev` → http://localhost:3000 (Next 15, React 19, R3F 9, drei 10, three 0.187, GSAP + ScrollTrigger, Lenis).
- `?motion=1` forces animations on (the OS "reduce motion" setting otherwise disables GSAP reveals — `lib/motion.ts`).
- **Visual checks:** the app's built-in browser pane has WebGL blocked (too many reloads) and throttles rAF when hidden. Use
  `node tools/shot.mjs "http://localhost:3000/?motion=1" .shots/name "[data-jump]" "0.1,0.3"` — headless system Chrome with
  SwiftShader WebGL; screenshots land in `.shots/` (git-ignored). Second arg form: selector `-` + absolute px.
- Type-check: `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` (plain tsc ran out of memory once).
- Talk to the user in Russian; they want quality, step by step, discuss before big changes, and they review every section.

## Page order (app/page.tsx)
1. **Hero** (`components/hero/*`) — living sky shader (low-res RT, `Sky.tsx`), glass script word JULIUS written on load
   (`JuliusWord.tsx`, path in `juliusPath.ts`), sparkles, blue laurel wreath (`Wreath.tsx`, geometry in
   `components/three/laurel.ts`), grid overlay, clock (click → Roman numerals), mouse coords, preloader "Veni · Vidi · Vici".
   Wrapped in `SceneBoundary` (CSS sky fallback if WebGL fails).
2. **Word → Caesar morph** (`components/hero/Morph.tsx`) — on scroll the word becomes 14k particles that fly onto the
   Caesar bust (`public/models/caesar.glb`, Higgsfield, ~12 credits; `components/three/useCaesar.ts` smooths it); the
   wreath flies onto the head; a glowing scan line rises and reveals the glass bust. Progress `store.morph` is computed in
   `components/SmoothScroll.tsx` from the intro slot `[data-bust-anchor]`. User approved this.
3. **Intro** (`components/intro/*`) — 60px text, word-by-word scroll reveal; left column is the empty bust slot + caption.
4. **II · Opera Selecta** (`components/work/*`) — 12 projects in the haoqi 12-col staggered grid (`lib/projects.ts`),
   Unsplash placeholders in `public/work/` (credits file there), reveal + parallax, cursor "VIEW" (`components/Cursor.tsx`).
   Hover = blocky drag distortion like ChainGPT Labs footer (`HoverDistort.tsx`, approved). Alt effect kept: `HoverParticles.tsx`.
5. **III · Virtvtes — "Roman gates" jump** (`components/jump/*`) — pinned 650vh: camera flies through 3 marble triumphal
   arches (VENI/VIDI/VICI carved on the attic), each crossing flashes white and switches the world
   (light sky → golden hour → violet dusk → space), then values around a laurel in space, then "LEGIO. MEET THE TEAM."
   Scroll map in `phases.ts`, progress `store.jump` (SmoothScroll).
   **Status: user was unhappy with v1 (black glass slabs + floating debris) → rebuilt as marble arches (looks decent now in
   screenshots), BUT the user's latest message: maybe replace the whole jump with a Shopify-Editions-style transition
   (ref #2). Ask/decide this first.** Small known nit: at the hold distance the inscription is slightly cut at the top
   (raise camera y / look up a bit, or VIEW=15).

## Next steps (in order)
1. **Decide the jump**: keep "Roman gates" or switch to Shopify Editions style (https://www.shopify.com/editions/winter2026):
   torn-paper edge between sections, camera push through a frame/arch into a painting with 2.5D parallax layers,
   "curtain" (content slides up revealing a pinned scene), painting→glowing etching shader. See CONCEPT.md "Второй референс".
   The user explicitly does NOT want copies of the haoqi warp lines.
2. **III · LEGIO — team** (variant A chosen): team photos as glowing etchings on dark that "develop" into colour on hover/scroll.
   Team (from old site /en/about): Aviel COO, Nikita Chief QA, Vlad UI/UX, Alina QA, Tania/Avail/Kiril/Dima programmers,
   Shimrit Product. Photos: take from julius-agency.co.il/en/about for now.
3. Numbers + testimonial (Nevo Adisol), final section (Caesar/laurel, contacts), cursor modes per section (user request).
4. Mobile pass (postponed by user), performance pass.
5. **Push to GitHub** when the user says so: https://github.com/vfreed0mz01-cyber/Julius-Avi-V.git
   (folder is not a git repo yet: `git init`, commit, add remote, push; .gitignore exists; never commit node_modules/.next/.shots).

## Gotchas
- Raw `ShaderMaterial`s output untransformed colour; don't set `colorSpace` on textures used by them.
- `MeshTransmissionMaterial` in the hero refracts the shared low-res sky texture (`sky.texture` in `lib/store.ts`) — no extra pass.
- Every WebGL canvas is created lazily / gated (FrameGate, IntersectionObserver) and wrapped in `SceneBoundary`.
- Higgsfield credits are low (~170) — only generate with the user's OK.
