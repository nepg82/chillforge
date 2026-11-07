/* ============================================================================
   CHILLFORGE TOOLBOX: PARTS                                      (lib/parts.js)

   A PART turns "this chord, in this key, with this pattern" into the NOTE EVENTS
   of ONE BAR. It makes no sound and touches no audio: a record calls a part in
   onBar, keeps the events, and plays the ones that fall on each step in onStep
   through an instrument (lib/instruments.js). Ported from Synth Radio's
   parts.js and song.js, reworked to work a bar at a time.

   Records reach it as  a.lib.parts.  It needs lib/theory.js (loaded first).

   EVENTS (all parts return arrays of these, ordered by step)
     { s, midi, len, vel }      tonal: s = step 0-15 within the bar, midi = note,
                                len = length in STEPS (may be fractional, and a
                                tail may run past the bar line), vel = 0-1.
     { s, vel, open }           drums (no pitch). open: an open hat.
     Chords add { i }, the note's index in the chord, so a record can strum.
   Seconds = steps * a.stepDur().

   PARTS
     drum({ rng, pat, bar })
         x = hit, g = ghost (quiet), o = open hat, . = rest.
     bass({ key, chord, pat, bar, lo = 40 })
         r = root, 5 = fifth, o = octave up, . = rest. A note holds until the next
         hit (or the end of the bar). The ROOT is folded into [lo, lo + 11].
     chords({ key, chord, lo = 55 })
         The whole chord struck once, held for the bar.
     arp({ key, chord, pat, bar, lo = 60 })
         Digits index the chord's tones, wrapping up an octave; . = rest.
     melody({ rng, key, scale, chord, lo, hi, rhythm, bar, last })
         -> { events, last }.  Picks notes in the scale between lo and hi, starting
         each bar on a chord tone near the previous note and then mostly stepping.
         (If the chord has no tone inside the scale, any scale note is used.)
         `rhythm` is a list of per-bar cell lists (see RHYTHMS); `last` is the
         previous note (null to start), and the returned `last` carries to the
         next bar. The melody is generated every bar even while its channel is
         muted, so keep calling it.
     at(events, s)   the events that start on step s.

   PATTERNS    { kind: { id: { label, pat } } } kinds: kick, snare, hat, bass, arp.
               A pattern is 16 characters (one bar, repeated) or 32 (two bars,
               alternating by bar).
   RHYTHMS     { id: { label, bars } } melody rhythms: bars = [bar0, bar1], each a
               list of [step, length] cells.
   validatePattern(kind, pat)   problems with a pattern string (empty = fine).

   RULES
   - Pure: no audio, no DOM, no state, no Math.random (randomness comes in as
     `rng`, which must be a.rng).
   - This file declares NO top-level names.
   ============================================================================ */
(function () {
  const T = () => window.CHILLFORGE_LIB.theory;

  const PATTERNS = {
    kick: {
      lazy:      { label: "Lazy",       pat: "x.......x.x.....x.......x...x..." },
      fourFloor: { label: "Four floor", pat: "x...x...x...x..." },
      broken:    { label: "Broken",     pat: "x.....x...x....." }
    },
    snare: {
      backbeat: { label: "Backbeat", pat: "....x.......x..." },
      ghost:    { label: "Ghost",    pat: "....x..g....x..." },
      fill:     { label: "Fill",     pat: "....x.......x.......x.......x..x" }
    },
    hat: {
      eighths: { label: "Eighths", pat: "x.x.x.x.x.x.x.xo" },
      shuffle: { label: "Shuffle", pat: "x.gxx.gxx.gxx.gx" },
      sparse:  { label: "Sparse",  pat: "..x...x...x...x." }
    },
    bass: {
      drive:  { label: "Drive",  pat: "r..r..r...r....." },
      walk:   { label: "Walk",   pat: "r.......r.....5." },
      octave: { label: "Octave", pat: "r...o...r...o..." }
    },
    arp: {
      upDown: { label: "Up and down", pat: "0.1.2.3.2.1.0.1." },
      skip:   { label: "Skip",        pat: "0.12.3.21.0.12.3" },
      run:    { label: "Run (busy)",  pat: "0123210301232103" },
      wide:   { label: "Wide",        pat: "0.2.4.5.4.2.1.0." }
    }
  };

  // Melody rhythms, one list of [step, length] cells per bar (two bars, alternating).
  const RHYTHMS = {
    lilt:  { label: "Lilt",  bars: [[[0, 4], [6, 2], [8, 6]], [[0, 4], [6, 2], [8, 8]]] },
    drift: { label: "Drift", bars: [[[0, 6], [8, 4], [12, 4]], [[0, 8], [12, 4]]] },
    sway:  { label: "Sway",  bars: [[[2, 4], [8, 2], [10, 6]], [[2, 4], [8, 6]]] }
  };

  const ALLOWED = { kick: "xgo.", snare: "xgo.", hat: "xgo.", bass: "r5o.", arp: "0123456789." };

  function validatePattern(kind, pat) {
    const bad = [];
    if (!Object.prototype.hasOwnProperty.call(ALLOWED, kind)) return ["unknown pattern kind '" + kind + "'"];
    if (typeof pat !== "string" || (pat.length !== 16 && pat.length !== 32)) bad.push("length " + (pat && pat.length) + ", need 16 or 32");
    else for (let i = 0; i < pat.length; i++) if (ALLOWED[kind].indexOf(pat[i]) === -1) { bad.push("character '" + pat[i] + "' at " + i + " is not allowed in a " + kind + " pattern"); break; }
    return bad;
  }

  // The 16 characters of the pattern that apply to this bar.
  const slice = (pat, bar) => {
    const off = (bar % (pat.length / 16)) * 16;
    return pat.slice(off, off + 16);
  };

  function drum(c) {
    const p = slice(c.pat, c.bar), out = [];
    for (let s = 0; s < 16; s++) {
      const ch = p[s];
      if (ch === ".") continue;
      out.push({ s, vel: ch === "g" ? 0.4 : 0.85 + c.rng() * 0.15, open: ch === "o" });
    }
    return out;
  }

  function bass(c) {
    const p = slice(c.pat, c.bar), lo = c.lo === undefined ? 40 : c.lo;
    const root = T().fold(c.key + c.chord.r, lo), out = [];
    for (let s = 0; s < 16; s++) {
      const off = { r: 0, 5: 7, o: 12 }[p[s]];
      if (off === undefined) continue;
      let n = 1;
      while (s + n < 16 && p[s + n] === ".") n++;
      out.push({ s, midi: root + off, len: n * 0.92, vel: 1 });
    }
    return out;
  }

  function chords(c) {
    const lo = c.lo === undefined ? 55 : c.lo;
    return T().chordMidi(c.key, c.chord, lo).map((midi, i) => ({ s: 0, midi, len: 16, vel: 0.8, i }));
  }

  function arp(c) {
    const p = slice(c.pat, c.bar), lo = c.lo === undefined ? 60 : c.lo;
    const tones = T().chordMidi(c.key, c.chord, lo), out = [];
    for (let s = 0; s < 16; s++) {
      const ch = p[s];
      if (ch === ".") continue;
      if (ALLOWED.arp.indexOf(ch) === -1) throw new Error("bad arp step '" + ch + "'");
      const i = +ch;
      out.push({ s, midi: tones[i % tones.length] + 12 * Math.floor(i / tones.length), len: 1.5, vel: 0.8 });
    }
    return out;
  }

  function melody(c) {
    if (c.hi - c.lo < 11) throw new Error("melody range must span at least an octave");
    const pool = T().scaleMidi(c.key, c.scale, c.lo, c.hi);
    const pcs = T().chordPcs(c.key, c.chord);
    let tones = pool.filter((m) => pcs.indexOf(m % 12) !== -1);
    if (!tones.length) tones = pool;      // a chord with nothing in the scale (a chromatic chord): any scale note will do
    const cells = c.rhythm[c.bar % c.rhythm.length], events = [];
    const pick = (list) => list[Math.floor(c.rng() * list.length)];
    let prev = c.last === undefined ? null : c.last;
    cells.forEach((cell, i) => {
      let m;
      if (i === 0) {
        const near = prev === null ? [] : tones.filter((t) => Math.abs(t - prev) <= 5);
        m = pick(near.length ? near : tones);
      } else {
        const near = pool.filter((t) => Math.abs(t - prev) <= 4 && t !== prev);
        m = !near.length || c.rng() < 0.3 ? pick(tones) : pick(near);
      }
      prev = m;
      events.push({ s: cell[0], midi: m, len: cell[1] * 0.95, vel: 0.9 });
    });
    return { events, last: prev };
  }

  const at = (events, s) => events.filter((e) => e.s === s);

  const freezeDeep = (o) => { if (o && typeof o === "object") { Object.keys(o).forEach((k) => freezeDeep(o[k])); Object.freeze(o); } return o; };

  const lib = (window.CHILLFORGE_LIB = window.CHILLFORGE_LIB || {});
  lib.parts = Object.freeze({
    PATTERNS: freezeDeep(PATTERNS), RHYTHMS: freezeDeep(RHYTHMS), validatePattern,
    drum, bass, chords, arp, melody, at
  });
})();
