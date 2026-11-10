# Chillforge: project handoff

**Read this first, in a new conversation.** It is the memory the assistant does not have.
Keep it current: update it at the end of every step and ship it in the project zip.

Last updated: engine build **261107-1321**, after Step 9. Next: Step 10.

---

## 1. What this is

Chillforge is a generative lo-fi / chillhop beat maker, built as an installable web app (PWA) and hosted on GitHub Pages. One HTML page plus small script files; no build step, no libraries. The user tests on a real phone: **Android, using the Brave browser** (Chromium-based, so the same Web Audio and Media Session engine as Chrome), installing the PWA through Brave. Tests often last 30+ minutes, with the screen locked, over Bluetooth and the lock-screen controls. Phone audio is fragile. The code that keeps playback alive on a phone is the most valuable thing in the project.

## 2. The idea: a jukebox, its records, and a toolbox

- **Engine** (`index.html`, the big inline script): audio context lifecycle and phone survival, the scheduler (16 steps per bar, 4/4), master chain, mixer, saved settings, the UI (built from record data), Radio mechanics, lock-screen controls, the record loader. It knows nothing about any particular style.
- **Records** (`records/*.js`): one file per style. Everything that makes a style sound like itself.
- **Toolbox** (`lib/*.js`): shared, style-agnostic building blocks. Records reach it as `a.lib`:
  - `lib/theory.js`: scales, chord types, key names, folding a root into a register, mtof.
  - `lib/instruments.js`: sound generators driven by preset data (synth, kick, snare, hat), load-conscious.
  - `lib/parts.js`: chord + key + pattern -> the note events of one bar (drum, bass, chords, arp, melody).

Test for where polish belongs: if a second style would want it unchanged, it goes in the engine or toolbox;
if it would differ per style, it is style data.

## 3. Files

Deployed (GitHub Pages):

    index.html              the engine
    service-worker.js       cache-first offline support (bump CACHE_NAME on every deploy; currently v2.3.0)
    styles.css, manifest.json, app-icons/     unchanged since the start
    lib/theory.js, lib/instruments.js, lib/parts.js    the toolbox (loaded in that order, before any record)
    records/chillwave.js    the production style (see roadmap: it will be rebuilt in Step 10)
    records/pulse.js        the toolbox TEST BENCH (kick, snare, hats, bass, arp, lead; keyed). Delete its <script> tag to remove it.

Test kit (NOT deployed, lives in `tools/`):

    tools/trace.js                            the test harness (needs Node)
    tools/trace-golden.json                   the answer key (about 3 MB)
    tools/test-records/chillwave-classic.js   FROZEN copy of Chillwave as of build 261103-1400. Do not edit.
    tools/test-records/metronome.js           bare-minimum fixture record
    tools/test-records/broken.js              records the loader must refuse
    tools/test-records/presets.js             plays EVERY instrument preset (a typo in any preset fails a check)

`test-records/` must sit next to `trace.js`. Deliver every step to the user as a ZIP with this structure
(downloads flatten folders, so loose files are confusing).

## 4. Where the manuals are

- **How to build a style:** the big header comment at the top of `records/chillwave.js` (the record contract,
  the API object `a`, timing, sound rules, Radio, saved settings, what never to do, how to add a record, how to
  verify). Treat it as the contract. If it and the code disagree, tell the user.
- **The toolbox:** the header of each file in `lib/`.
- **The engine's side of the contract:** the `THE RECORD CONTRACT` comment in `index.html` (near the loader).
- **The harness:** the header comment of `tools/trace.js`.
- `records/pulse.js` is the working example of the toolbox, keys and Radio and the better template for a new
  style; `records/chillwave.js` is the elaborate hand-built one (it does not use the toolbox yet).

## 5. Rules that must not be broken

1. **Phone-survival code is untouchable** unless the user explicitly opens it up: the Worker-based scheduler tick,
   the silent looping WAV `<audio>` element (keeps the OS treating the page as a media player), the yield / unyield
   logic, `ctx.onstatechange` resume, the visibility handlers, the RESYNC guard, `latencyHint: "playback"`,
   one AudioContext for the life of the page. Several of these exist because a from-scratch rebuild (Synth Radio) missed them.
2. **Never edit the engine to suit one style.** If a style needs something general, stop and discuss a general engine
   feature. (Two were added this way: the `needs` rule and the `dispose()` hook.)
3. **Randomness only through `a.rng()` / `a.rand()`** in records and the toolbox (and `rng()` in the engine), never
   `Math.random()`. The harness replays everything with a seeded generator and flags direct calls.
4. **Records and lib files declare no top-level names** (wrap everything in a function). They share one global scope
   with the engine; a clash kills the whole app. The harness lints this.
5. **Never rename** a record key, channel id, select id/value or progression key once shipped: saved settings would silently reset.
6. **Every deploy:** bump `CACHE_NAME` in `service-worker.js` AND the version stamp `<h2 id="ver">yymmdd-hhmm</h2>`
   in `index.html`. **The stamp is the real local date and 24-hour time of the update** (the user's rule):
   `261105-0519` = November 5, 2026 at 5:19am; `261105-1909` = November 5, 2026 at 7:09pm. Use the real clock,
   never an invented time. The assistant's workspace clock is UTC: convert to the user's local time (US Eastern unless
   told otherwise), e.g. `TZ=America/New_York date +%y%m%d-%H%M`. (Stamps up to 261105-1000 were invented times.)
   Files the app cannot run without are listed in `APP_SHELL`. The service worker precaches with
   `fetch(url, { cache: "reload" })` on purpose (GitHub Pages serves a 10-minute HTTP cache; `cache.addAll`
   can precache stale files).
7. **Records load after the toolbox**, in `<script src>` tag order: `lib/theory.js`, `lib/instruments.js`,
   `lib/parts.js`, then records. The first record is the default style; Chillwave stays first.
8. **Anything a style's graph leaves running must be stopped.** The toolbox's instruments with vibrato own a running
   oscillator; a record's `buildGraph` must return an object with a `dispose()` that disposes its instruments (the
   engine calls it on teardown). Otherwise every Stop leaks an oscillator. The harness checks this.
9. **Small steps, each verified, each ending with a phone test.** Never change behaviour and structure in the same step.

## 6. How to verify (run from the project root; needs Node)

    node tools/trace.js check index.html            full check (scenarios, properties, lints, unit tests, budgets)
    node tools/trace.js check index.html --baseline only the scenarios derived from the user's ORIGINAL app
    node tools/trace.js unit index.html             unit tests for the toolbox (about 520,000 checks)
    node tools/trace.js load <scenario> index.html  the audio load of a scenario (see below)
    node tools/trace.js record-extra index.html     (re)record the answer key for the NEW-feature scenarios
    node tools/trace.js dump <scenario> index.html  print one trace
    node tools/trace.js list

How it works: the harness runs the app's script in a Node sandbox with a strict fake Web Audio (it throws where a
real browser throws: non-finite values, negative times, ramps to zero), a seeded random generator, a fake clock and
simulated app timers. It records every audio call (and the UI, the data, saved settings, what modulates each oscillator,
the load) as text, and compares against `trace-golden.json`. Record and lib files run in a separate context with no
engine in it, so reaching into the engine fails.

What the answer key means:
- 26 "original-derived" scenarios were recorded ONCE from the user's verbatim original `index.html` (not shipped; the user
  has it). They prove engine changes do not alter a style. They run against the frozen `tools/test-records/chillwave-classic.js`.
  **Do not run `record --force`** unless the user supplies the original file again.
- The rest (about 44 now) were recorded from later builds with `record-extra`: they protect new features against regression.
- `production-*` scenarios prove the shipped Chillwave equals the frozen copy. **Retire them in Step 10.**
- Property checks: loading extra records (or broken ones, or a missing toolbox) must leave Chillwave's audio events identical.

Scenario fields worth knowing: `records` / `fixtures` / `libs` (what to load), `setup` and timed `actions` (drive the real UI),
`storage` (pre-saved settings), `checkSaved` (what was really persisted), `verify: (text) => [problems]` (musical checks parsed
from the trace: e.g. every bass note is a chord root in the key; no oscillator left unstopped), `budget` and `reportLoad`.

**Load** (what a phone has to keep up with): oscillators created per second, peak simultaneous oscillators, per-note filters
per second. Reference numbers: Chillwave today 4.4 osc/s, peak 15, no per-note filters. Pulse bench defaults 11.6 osc/s,
peak 11, 5.1 filters/s. Pulse busiest options 23.3 osc/s, peak 18. Synth Radio's Chillwave (which glitched on the phone):
13.4 osc/s, peak ~50, ~7 per-note filters/s. Budgets set so far: Pulse defaults must stay within 12 osc/s, peak 30,
6 filters/s; classic Chillwave within 5 osc/s, peak 16. **The original promise (9 osc/s) did not hold for a style with
kick, snare, hats, bass, arp and lead; the budget was set at the measured value plus headroom and should be revisited
after the user's phone tests.**

Practice that found real bugs: after each step, **break the code on purpose** (mutation testing) and confirm the checks
fail. Every survivor is either a real gap (fix the harness) or provably harmless. About 150 mutants have been run across
Steps 1-9. Known harmless survivors: the `reset()` call in `switchStyle` (redundant, `startBeat` resets again); `reset()`
clearing the remembered chord (unobservable); the "swap with last index" rule in Radio's drums-first constraint (only
differs with 4+ channels). Harness gaps found by mutation and since closed: app timers (saving was unobservable), connections
to audio PARAMETERS (vibrato was invisible), reference-table typos (tests compared a table with itself), a Radio "key never
repeats" check that could miss, the radio plan being invisible.
Gaps the harness cannot cover (needs the real phone): the Worker timer, screen lock and backgrounding, the silent `<audio>`
element, real sound quality and loudness balance. The user listens; the harness proves the notes are right, not that they sound good.

## 7. Decisions made with the user

- Style count was trimmed to Chillwave only (earlier Synthwave / Darksynth / Dubstep versions "got out of hand").
- Engine/record split built in Steps 1-7; Chillwave's sound was proven identical to the original throughout.
- **Keys work the way Synth Radio does:** chords are `{ r, t }` (root as semitones above the key + chord type), the key
  is 0-11 (0 = C), roots are folded into a fixed register per instrument. NOT transposition of hand-voiced note names.
  Radio picks a new random key per track (never the same twice running). Default key is C.
- Polish goes into the engine and toolbox, not into every style. The toolbox is separate files in `lib/`.
- The richer sound is built into Chillwave itself (Step 10). The user keeps a local "Classic Chillforge" folder as an
  app-level fallback; the frozen `chillwave-classic.js` is the harness-level safety net.
- Synth Radio (a separate 15-file project, data-driven, ES modules) is **reference only**. The user does not want it fixed.
  Chillforge borrows its theory, instrument presets, patterns and Radio ideas.
- The tap-the-version-stamp on-device log is how phone problems are diagnosed. Ask for it.
- Instruments are load-conscious (this is why the toolbox is not a straight port): ONE shared vibrato oscillator per
  instrument (not per note), a shared filter unless a preset has a filter envelope, oscillators wired straight to the amp
  unless their levels differ, drum filters built once. Drums of a style are `kick`/`snare`/`hat` instruments on a channel.

## 8. Open decisions and known leftovers

- **`variation` (dormant engine code):** an earlier version muted channels for a few bars (breakdowns), controlled by a
  Low/Medium/High pulldown, probably from the abandoned Dubstep attempt. The code remains in `index.html`
  (`updateVariation`, `pickScene`, a few `variation` references) and refers to constants that no longer exist; it
  never runs. Decide later: delete it, or rebuild it as a proper record capability (likely when a Dubstep style needs it).
- **Untuned by ear:** Pulse's channel levels, its `cutoffMul: 1.5` (opens the highs; 1 is darker), and the preset gains are
  ported from Synth Radio and not balanced for Chillforge's master chain. The user's ears decide; the channel steppers help.
- Pad presets (long attack and release) are heavy on simultaneous oscillators and are not used by any style yet; tune them
  in Step 10 against the budget.
- Chillwave's `reverb: 0` field is unused legacy. The old-settings migration in `loadSettings` is Chillwave-only legacy.
- Radio's constraint rules (`neverFirstIn`, `neverLastOut`) are single swaps: reliable for one id per list in a style
  with 3+ channels. Radio treats channels individually; with 6+ channels the intro/outro may eat the whole track.
  Likely needs "Radio groups" (Step 11).
- Dropdown labels use Roman numerals; the text in parentheses doubles as the lock-screen title.
- Bug found and fixed in Step 9 (shared with Synth Radio): the melody part produced `undefined` notes when a chord had no
  tone inside the scale (e.g. a chromatic chord). It now falls back to any scale note; a regression test covers it.

## 9. Roadmap

Done: 1 seedable RNG + trace harness. 2 Chillwave voices into the record. 3 audio graph into the record.
4 per-bar/per-step scheduling into the record. 5 progressions into the record. 6 Radio rules into the record.
7 records as separate files, loader, record contract, Pulse. 8 keys in the engine, `lib/theory.js`, frozen classic fixture.
9 `lib/instruments.js` and `lib/parts.js`; Pulse rebuilt as the test bench; `dispose()` hook and `needs` rule in the engine;
load report and budgets, unit tests and preset smoke test in the harness.

Next:
- **Step 10: rebuild Chillwave as a keyed style on the toolbox**, with bass, arps and stepwise melodies (and a pad). First step
  where Chillwave's sound changes (and where Chillwave gets keys). Its progressions become `{ r, t }` degrees; voicings start
  as root-position stacks, so consider inversions / open spreads in `lib/parts.js` so it does not lose its hand-voiced
  lushness. Choose presets and tune against the load budget on the phone. Retire the `production-*` scenarios. The user's
  ears decide. Before building: review the Pulse bench feedback from the phone (which sounds, patterns and levels worked).
- **Step 11: Radio groups** (channels that enter/leave together), so intros/outros do not eat the track.
- **Step 12: cleanup and hardening:** decide `variation`; remove leftovers (`reverb`, maybe the old-settings migration if the
  user confirms); a performance tuning pass on the phone.
- **Then new styles** (Synthwave, Darksynth, Dubstep): each a data file plus a script tag with no engine edits. Anything a
  style needs that the toolbox lacks (a wobble bass, breakdowns) is added once, generally.
- Unscheduled ideas: a cheap reverb substitute, song sections like Synth Radio's, UI polish, splitting the engine's inline
  script into files.

## 10. Reference: what was learned reading Synth Radio (do not repeat these in Chillforge)

- Its service worker used `cache.addAll()` (can precache stale files from the HTTP cache); its scheduler had no
  try/catch and nothing logged `window.onerror`; no heartbeat to tell "killed" from "stopped".
- Chillforge already has the right versions of all three (cache-bypassing precache, try/catch around each scheduled step,
  heartbeat and "previous session ended while playing" log, error logging).
- It builds a vibrato oscillator, a filter and a gain per oscillator for EVERY note, plus a non-native `sampleRate: 32000`;
  its pad dominates peak concurrency (36 of ~50 simultaneous oscillators), its arp has the highest churn (5 osc/s, 4 filters/s),
  its bass is cheap. Do not copy its `sampleRate`.
- Its Radio uses instrument groups and picks any of 12 keys per song.

## 11. How the user likes to work

- Step by step, each step verified and then tried on the phone before the next. Big steps: propose a plan first
  and wait for approval.
- Wants evidence over assertion: say what was tested, what was broken on purpose, and what could not be verified.
  If a promise (like a budget) turns out wrong, say so plainly.
- Is comfortable with duplicating code across styles when it keeps things simple, but not with rebuilding instruments or
  keys for every style (hence the toolbox).
- Downloads flatten folders: always deliver a ZIP with the structure built in, plus short placement instructions.
- Prefers to iterate the build number by date (YYMMDD) and time (24-hour): 261105-0519 means the last update was
  November 5, 2026 at 5:19am; 261105-1909 would be November 5, 2026 at 7:09pm.

## 12. Starting a new conversation

Ask the user to upload the latest project zip (it contains this file) and say:

1. which step is done and whether it was tested on the phone (what they saw: good, odd, broken; the on-device log if odd),
2. what they want next (usually the next roadmap step),
3. anything that changed (decisions, new ideas, the original `index.html` if the harness baseline must be re-recorded).

Then, before building: unzip and read this file and the headers named in section 4, run
`node tools/trace.js check index.html` to confirm the project is healthy, and confirm the plan with the user.
