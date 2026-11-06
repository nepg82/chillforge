# Chillforge: project handoff

**Read this first, in a new conversation.** It is the memory the assistant does not have.
Keep it current: update it at the end of every step and ship it in the project zip.

Last updated: engine build **261105-0519**, after Step 8. Next: Step 9.

---

## 1. What this is

Chillforge is a generative lo-fi / chillhop beat maker, built as an installable web app (PWA) and
hosted on GitHub Pages. One HTML page plus small script files; no build step, no libraries.
The user tests on a real phone (Android Chrome, per the Synth Radio primer; confirm), often for 30+ minutes,
with the screen locked, over Bluetooth and the lock-screen controls.

Phone audio is fragile. The code that keeps playback alive on a phone is the most valuable thing in the project.

## 2. The idea: a jukebox and its records

- **Engine** (`index.html`, the big inline script): audio context lifecycle and phone survival, the scheduler
  (16 steps per bar, 4/4), master chain, mixer, saved settings, the UI (built from record data), Radio mechanics,
  lock-screen controls, the record loader. It knows nothing about any particular style.
- **Records** (`records/*.js`): one file per style. Everything that makes a style sound like itself.
- **Toolbox** (`lib/*.js`): shared, style-agnostic building blocks (so far: `lib/theory.js`, keys and chords).
  Records reach it as `a.lib`.

Test for where polish belongs: if a second style would want it unchanged, it goes in the engine or toolbox;
if it would differ per style, it is style data.

## 3. Files

Deployed (GitHub Pages):

    index.html              the engine
    service-worker.js       cache-first offline support (bump CACHE_NAME on every deploy)
    styles.css, manifest.json, app-icons/     unchanged since the start
    lib/theory.js           toolbox: scales, chord types, key names, folding, mtof
    records/chillwave.js    the production style (see roadmap: it will be rebuilt in Step 10)
    records/pulse.js        a small test style (kick + bass, keyed); delete its <script> tag to remove it

Test kit (NOT deployed, lives in `tools/`):

    tools/trace.js                         the test harness (needs Node)
    tools/trace-golden.json                the answer key (about 2.5 MB)
    tools/test-records/chillwave-classic.js   FROZEN copy of Chillwave as of build 261102-1205. Do not edit.
    tools/test-records/metronome.js        bare-minimum fixture record
    tools/test-records/broken.js           records the loader must refuse

`test-records/` must sit next to `trace.js`. Deliver every step to the user as a ZIP with this structure
(downloads flatten folders, so loose files are confusing).

## 4. Where the manuals are

- **How to build a style:** the big header comment at the top of `records/chillwave.js` (the record contract,
  the API object `a`, timing, sound rules, Radio, saved settings, what never to do, how to add a record, how to
  verify). Treat it as the contract. If it and the code disagree, tell the user.
- **The toolbox:** the header of `lib/theory.js`.
- **The engine's side of the contract:** the `THE RECORD CONTRACT` comment in `index.html` (near the loader).
- **The harness:** the header comment of `tools/trace.js`.
- `records/pulse.js` is the better template for a simple style; `records/chillwave.js` is the elaborate one.

## 5. Rules that must not be broken

1. **Phone-survival code is untouchable** unless the user explicitly opens it up: the Worker-based scheduler tick,
   the silent looping WAV `<audio>` element (keeps the OS treating the page as a media player), the yield / unyield
   logic, `ctx.onstatechange` resume, the visibility handlers, the RESYNC guard, `latencyHint: "playback"`,
   one AudioContext for the life of the page. Several of these exist because a from-scratch rebuild (Synth Radio) missed them.
2. **Never edit the engine to suit one style.** If a style needs something general, stop and discuss a general engine feature.
3. **Randomness only through `a.rng()` / `a.rand()`** in records and the engine (`rng()`), never `Math.random()`.
   The harness replays everything with a seeded generator and flags direct calls.
4. **Records and lib files declare no top-level names** (wrap everything in a function). They share one global scope
   with the engine; a clash kills the whole app. The harness lints this.
5. **Never rename** a record key, channel id, select id/value or progression key once shipped: saved settings would silently reset.
6. **Every deploy:** bump `CACHE_NAME` in `service-worker.js` AND the version stamp `<h2 id="ver">yymmdd-hhmm</h2>` in
   `index.html`. Files the app cannot run without are listed in `APP_SHELL`. The service worker precaches with
   `fetch(url, { cache: "reload" })` on purpose (GitHub Pages serves a 10-minute HTTP cache; `cache.addAll` can
   precache stale files).
7. **Records load before the engine**, in `<script src>` tag order: toolbox (`lib/`) first, then records. The first
   record is the default style; Chillwave stays first.
8. **Small steps, each verified, each ending with a phone test.** Never change behaviour and structure in the same step.

## 6. How to verify (run from the project root; needs Node)

    node tools/trace.js check index.html            full check (all scenarios, properties, lints, unit tests)
    node tools/trace.js check index.html --baseline only the scenarios derived from the user's ORIGINAL app
    node tools/trace.js unit index.html             unit tests for lib/theory.js
    node tools/trace.js record-extra index.html     (re)record the answer key for the NEW-feature scenarios
    node tools/trace.js dump <scenario> index.html  print one trace
    node tools/trace.js list

How it works: the harness runs the app's script in a Node sandbox with a strict fake Web Audio (it throws where a
real browser throws: non-finite values, negative times, ramps to zero), a seeded random generator, a fake clock
and simulated app timers. It records every audio call (and the UI, the data, saved settings) as text, and compares
against `trace-golden.json`. Record files run in a separate context with no engine in it, so reaching into the engine fails.

What the answer key means:
- 26 "original-derived" scenarios were recorded ONCE from the user's verbatim original `index.html` (not shipped; the user
  has it). They prove engine changes do not alter a style. They now run against the frozen
  `tools/test-records/chillwave-classic.js`. **Do not run `record --force`** unless the user supplies the original file again.
- The rest were recorded from later builds with `record-extra` (they protect new features against regression).
- `production-*` scenarios prove the shipped Chillwave equals the frozen copy. **Retire them in Step 10** when Chillwave is rebuilt.

Practice that found real bugs: after each step, **break the code on purpose** (mutation testing) and confirm the checks
fail. Every survivor is either a real gap (fix the harness) or provably harmless. Known harmless survivors so far: the
`reset()` call in `switchStyle` (redundant, `startBeat` resets again); `reset()` clearing the remembered chord (unobservable);
the "swap with last index" rule in Radio's drums-first constraint (only differs with 4+ channels).
Gaps the harness cannot cover (needs the real phone): the Worker timer, screen lock and backgrounding, the silent
`<audio>` element, real sound quality. The user listens; the harness proves the notes are right, not that they sound good.

## 7. Decisions made with the user

- Style count was trimmed to Chillwave only (earlier Synthwave / Darksynth / Dubstep versions "got out of hand").
- Engine/record split built in Steps 1-7 (see roadmap table); Chillwave's sound was proven identical to the original throughout.
- **Keys work the way Synth Radio does:** chords are `{ r, t }` (root as semitones above the key + chord type), the key
  is 0-11 (0 = C), roots are folded into a fixed register per instrument. NOT transposition of hand-voiced note names.
  Radio picks a new random key per track (never the same twice running). Default key is C.
- Polish goes into the engine and toolbox, not into every style. The toolbox is separate files in `lib/`.
- The richer sound is built into Chillwave itself (the user wants to evolve it; "the current sound is good structurally,
  all of this is about polish"). The user keeps a local "Classic Chillforge" folder as an app-level fallback; the frozen
  `chillwave-classic.js` is the harness-level safety net.
- Synth Radio (a separate 15-file project, data-driven, ES modules) is **reference only**. The user does not want it fixed.
  Chillforge borrows its theory, instrument ideas and Radio ideas.
- The tap-the-version-stamp on-device log is how phone problems are diagnosed. Ask for it.

## 8. Open decisions and known leftovers

- **`variation` (dormant engine code):** an earlier version muted channels for a few bars (breakdowns), controlled by a
  Low/Medium/High pulldown, probably from the abandoned Dubstep attempt. The code remains in `index.html`
  (`updateVariation`, `pickScene`, a few `variation` references) and refers to constants that no longer exist; it
  never runs. Decide later: delete it, or rebuild it as a proper record capability.
- Chillwave's `reverb: 0` field is unused legacy. The old-settings migration in `loadSettings` is Chillwave-only legacy.
- Radio's constraint rules (`neverFirstIn`, `neverLastOut`) are single swaps: reliable for one id per list in a style
  with 3+ channels. Radio treats channels individually; with 6+ channels the intro/outro may eat the whole track.
  Likely needs "Radio groups" (Step 11).
- Dropdown labels for Chillwave progressions use Roman numerals and double as lock-screen titles (text in parentheses).

## 9. Roadmap

Done: 1 seedable RNG + trace harness. 2 Chillwave voices into the record. 3 audio graph into the record.
4 per-bar/per-step scheduling into the record. 5 progressions into the record. 6 Radio rules into the record.
7 records as separate files, loader, record contract, Pulse. (Chillwave split into `records/chillwave.js`.)
8 keys in the engine, `lib/theory.js`, Pulse keyed, frozen classic fixture.

Next:
- **Step 9: instrument generators and parts in the toolbox** (bass, arp, chords, melody; instrument presets as data),
  proven on Pulse. Load-conscious design: ONE shared vibrato LFO instead of one per note; shared filters; per-note
  filters only for sparse voices. Add a load report to the harness (oscillators/s, filters/s, peak simultaneous).
  Reference numbers: Chillforge Chillwave today ~4.4 oscillators/s and peak 15 simultaneous (known safe);
  Synth Radio's Chillwave ~13.4 oscillators/s, peak ~50, ~7 per-note filters/s (it glitched on the phone). In Synth Radio
  the pad dominates peak concurrency (36 of 50, from long notes plus release tails); the arp has the highest churn
  (5 osc/s, 4 filters/s); bass is cheap. Do not copy its `sampleRate: 32000`.
- **Step 10: rebuild Chillwave as a keyed, data-driven style** with bass, arps and stepwise melodies. First step where
  Chillwave's sound changes (Chillwave gets keys here). Voicings start simple; consider inversions / open spreads so it
  does not lose its hand-voiced lushness. The user's ears decide. Retire the `production-*` scenarios.
- **Step 11: Radio groups** (channels that enter/leave together), so intros/outros do not eat the track.

## 10. Reference: what was learned reading Synth Radio (do not repeat these in Chillforge)

- Its service worker used `cache.addAll()` (can precache stale files from the HTTP cache); its scheduler had no
  try/catch and nothing logged `window.onerror`; no heartbeat to tell "killed" from "stopped".
- Chillforge already has the right versions of all three (cache-bypassing precache, try/catch around each scheduled step,
  heartbeat and "previous session ended while playing" log, error logging).
- Its Radio uses instrument groups and picks any of 12 keys per song.

## 11. How the user likes to work

- Step by step, each step verified and then tried on the phone before the next. Big steps: propose a plan first
  and wait for approval.
- Wants evidence over assertion: say what was tested, what was broken on purpose, and what could not be verified.
- Is comfortable with duplicating code across styles when it keeps things simple, but not with rebuilding instruments or
  keys for every style (hence the toolbox).
- Downloads flatten folders: always deliver a ZIP with the structure built in, plus short placement instructions.
- Prefers to iterate build number based on date (YYMMDD) and time (24hr) - 261105-0519 means last update was November 5, 2026 at 5:19am; 261105-1909 would be November 5, 2026 at 7:09pm.

## 12. Starting a new conversation

Ask the user to upload the latest project zip (it contains this file) and say:

1. which step is done and whether it was tested on the phone (what they saw: good, odd, broken; the on-device log if odd),
2. what they want next (usually the next roadmap step),
3. anything that changed (decisions, new ideas, the original `index.html` if the harness baseline must be re-recorded).

Then, before building: unzip and read this file and the three headers named in section 4, run
`node tools/trace.js check index.html` to confirm the project is healthy, and confirm the plan with the user.
