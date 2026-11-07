/* ============================================================================
   CHILLFORGE TOOLBOX: INSTRUMENTS                          (lib/instruments.js)

   Sound generators driven by PRESET DATA. A style says "bass: subSine" and this
   file knows how to make that sound. Ported from Synth Radio's instruments.js,
   redesigned to be cheap on a phone (see LOAD below).

   Records reach it as  a.lib.instruments.

   USAGE (inside a record's buildGraph, which runs on every Start)
     const I = a.lib.instruments, e = I.env(a);
     const bass = I.make(e, bassChannelGain, "bass", "subSine");   // category, preset id
     ...
     // later, inside onStep:
     bass.play(t, midiNote, durationSeconds, velocity);             // tonal instruments
     kick.play(t, velocity);                                        // kick, snare
     hat.play(t, velocity, open);                                   // hat
     // and dispose them when the graph is torn down (see DISPOSE).

   env(a)      Snapshot of what the instruments need from the engine (context,
               noise buffer, random source, waveform helper). Valid only for the
               graph being built: take it again in every buildGraph.
   make(e, out, category, id)
               category: "kick" | "snare" | "hat" | "bass" | "pad" | "lead" | "arp".
               `out` is the channel gain node the sound feeds. Throws a readable
               Error for an unknown category or preset id.
   PRESETS     { category: { id: { label, p } } }  p = the preset's parameters.
   CATEGORIES  the category names.
   mtof(midi)  MIDI note -> Hz (the same as theory.mtof; a test keeps them in sync).
   validate(category, p)
               Array of problems with a preset (empty = fine). The test harness
               runs it on every preset.
   Factories (make picks one for you): synth(e, out, p), kick(e, out, p),
               snare(e, out, p), hat(e, out, p).

   SYNTH PRESET  p = { osc:[{type, gain, detune, mult}], filter:{type, freq, q,
                       env, decay}, amp:{a, d, s, r}, vibrato:{rate, depth}, gain }
     osc      1-4 oscillators. type: sine | triangle | sawtooth | square | softtri.
              detune in cents; mult = frequency multiplier (0.5 = an octave down).
     filter   lowpass by default. WITH `env` (a filter envelope that opens the
              filter and closes it over `decay` seconds) every note gets its own
              filter. WITHOUT `env` ONE shared filter serves all notes (cheaper).
     amp      attack a, decay d, sustain level s (0-1), release r, in seconds.
     vibrato  rate in Hz, depth in cents. One shared oscillator serves all notes.
     gain     overall level (the peak of a full-velocity note).

   LOAD (why this is not a straight port)
     Phones glitch under heavy node counts, and Synth Radio built, per note: one
     vibrato oscillator, one gain per oscillator, one filter, one amp. Here:
       - ONE shared vibrato oscillator per instrument, not one per note.
       - Oscillators connect straight to the note's amp when their levels match;
         an extra gain node exists only for oscillators quieter than the loudest.
       - A filter per note only when the preset asks for a filter envelope.
       - Drum filters are built once, not per hit.
     A note therefore costs (oscillators + 1 amp [+ 1 filter] [+ a few ratio gains]).

   DISPOSE
     Instruments with vibrato own a running oscillator. It must be stopped when
     the graph is torn down or it leaks. The engine calls  dispose()  on the object
     your buildGraph returns, so return one that disposes your instruments:
         return { ...channelGains, dispose() { bass.dispose(); lead.dispose(); } };
     (Every instrument has a dispose(); it is harmless where there is nothing to stop.)

   RULES
   - Randomness only through e.rng (a.rng). No Math.random.
   - Never connect anything to ctx.destination. Instruments feed `out` only.
   - This file declares NO top-level names; it shares the global scope with the
     engine and the records.
   ============================================================================ */
(function () {
  const OSC_TYPES = ["sine", "triangle", "sawtooth", "square", "softtri"];
  const CATEGORIES = ["kick", "snare", "hat", "bass", "pad", "lead", "arp"];
  const FACTORY = { kick: "kick", snare: "snare", hat: "hat", bass: "synth", pad: "synth", lead: "synth", arp: "synth" };

  const def = (v, d) => (v === undefined ? d : v);
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function env(a) {
    return { ctx: a.ctx, noise: a.noise, rng: a.rng, applyShape: a.applyShape };
  }

  // Exponential decay from `peak` to (almost) silence over `decay` seconds.
  const decayEnv = (g, t, peak, decay) => {
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  };

  function biquad(ctx, type, freq, q) {
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    return f;
  }

  // A burst of the shared noise buffer, started at a random offset so hits differ a little.
  function noiseSrc(e, t, dur) {
    const s = e.ctx.createBufferSource();
    s.buffer = e.noise;
    s.start(t, e.rng());
    s.stop(t + dur);
    return s;
  }

  // ---- drums -----------------------------------------------------------------
  function kick(e, out, p) {
    const ctx = e.ctx;
    const lp = p.lp ? biquad(ctx, "lowpass", p.lp, 0.7) : null;
    if (lp) lp.connect(out);
    const hp = p.click ? biquad(ctx, "highpass", 2000, 0.7) : null;
    if (hp) hp.connect(out);
    return {
      play(t, vel) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = p.type || "sine";
        o.frequency.setValueAtTime(p.f0, t);
        o.frequency.exponentialRampToValueAtTime(p.f1, t + p.sweep);
        decayEnv(g, t, vel * p.gain, p.decay);
        o.connect(g);
        g.connect(lp || out);
        o.start(t); o.stop(t + p.decay + 0.05);
        if (p.click) {
          const n = noiseSrc(e, t, 0.02), cg = ctx.createGain();
          decayEnv(cg, t, vel * p.click, 0.015);
          n.connect(cg).connect(hp);
        }
      },
      dispose() {}
    };
  }

  function snare(e, out, p) {
    const ctx = e.ctx;
    const bp = biquad(ctx, "bandpass", p.noiseFreq, p.q || 0.8);
    bp.connect(out);
    const bursts = p.clap ? [0, 0.011, 0.022] : [0];
    return {
      play(t, vel) {
        bursts.forEach((off, i) => {
          const d = i === bursts.length - 1 ? p.decay : 0.012;
          const n = noiseSrc(e, t + off, d + 0.05), g = ctx.createGain();
          decayEnv(g, t + off, vel * p.gain, d);
          n.connect(g).connect(bp);
        });
        if (p.tone) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = "triangle";
          o.frequency.setValueAtTime(p.tone, t);
          o.frequency.exponentialRampToValueAtTime(p.tone * 0.6, t + p.toneDecay);
          decayEnv(g, t, vel * p.toneGain, p.toneDecay);
          o.connect(g).connect(out);
          o.start(t); o.stop(t + p.toneDecay + 0.05);
        }
      },
      dispose() {}
    };
  }

  function hat(e, out, p) {
    const ctx = e.ctx;
    const hp = biquad(ctx, "highpass", p.freq, 0.7);
    hp.connect(out);
    return {
      play(t, vel, open) {
        const d = open ? p.openDecay : p.decay;
        const n = noiseSrc(e, t, d + 0.05), g = ctx.createGain();
        decayEnv(g, t, vel * p.gain, d);
        n.connect(g).connect(hp);
      },
      dispose() {}
    };
  }

  // ---- tonal synth (bass, pad, lead, arp: anything with a pitch) -------------
  function synth(e, out, p) {
    const ctx = e.ctx;
    const am = p.amp || {};
    const A = { a: def(am.a, 0.01), d: def(am.d, 0.2), s: def(am.s, 0.6), r: def(am.r, 0.2) };
    const fp = p.filter || {};
    const fType = fp.type || "lowpass", fFreq = fp.freq || 4000, fQ = fp.q || 0.7;
    const perNote = !!fp.env;                       // a filter envelope needs a filter per note
    const gmax = Math.max.apply(null, p.osc.map((o) => def(o.gain, 1)));

    // one filter shared by every note, unless the preset has a filter envelope
    let shared = null;
    if (!perNote) { shared = biquad(ctx, fType, fFreq, fQ); shared.connect(out); }

    // one vibrato oscillator for every note
    let lfo = null, depth = null;
    if (p.vibrato) {
      depth = ctx.createGain();
      depth.gain.value = p.vibrato.depth;           // cents
      lfo = ctx.createOscillator();
      lfo.frequency.value = p.vibrato.rate;
      lfo.connect(depth);
      lfo.start(ctx.currentTime);
    }

    return {
      play(t, midi, dur, vel) {
        const end = t + Math.max(dur, A.a + 0.02);
        const peak = vel * def(p.gain, 0.2) * gmax;
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.linearRampToValueAtTime(peak, t + A.a);
        amp.gain.setTargetAtTime(peak * A.s, t + A.a, A.d / 3);
        amp.gain.setTargetAtTime(0, end, A.r / 3);

        let dest;
        if (perNote) {
          const f = biquad(ctx, fType, fFreq + fp.env, fQ);
          f.frequency.setTargetAtTime(fFreq, t, def(fp.decay, 0.3) / 3);
          f.connect(amp).connect(out);
          dest = f;
        } else {
          amp.connect(shared);
          dest = amp;
        }

        const f0 = mtof(midi), stopAt = end + A.r * 1.5;
        for (let i = 0; i < p.osc.length; i++) {
          const spec = p.osc[i];
          const o = ctx.createOscillator();
          e.applyShape(o, spec.type);
          o.frequency.value = f0 * def(spec.mult, 1);
          if (spec.detune) o.detune.value = spec.detune;
          if (depth) depth.connect(o.detune);
          const g = def(spec.gain, 1);
          if (g === gmax) o.connect(dest);
          else { const og = ctx.createGain(); og.gain.value = g / gmax; o.connect(og).connect(dest); }
          o.start(t); o.stop(stopAt);
        }
      },
      dispose() {
        if (lfo) { lfo.stop(ctx.currentTime); lfo = null; }
      }
    };
  }

  const FACTORIES = { kick, snare, hat, synth };

  // ---- presets (data) -----------------------------------------------------------
  const osc = (type, gain, detune, mult) => ({ type, gain: gain === undefined ? 1 : gain, detune: detune || 0, mult: mult || 1 });

  const PRESETS = {
    kick: {
      softThump: { label: "Soft Thump", p: { f0: 130, f1: 48, sweep: 0.12, decay: 0.5, gain: 0.9, lp: 600, click: 0.15 } },
      deepTape:  { label: "Deep Tape",  p: { f0: 90,  f1: 42, sweep: 0.2,  decay: 0.7, gain: 0.9, lp: 300 } },
      punchy:    { label: "Punchy",     p: { f0: 170, f1: 50, sweep: 0.07, decay: 0.4, gain: 0.9, click: 0.3 } }
    },
    snare: {
      clap:      { label: "Clap",       p: { clap: true, noiseFreq: 1500, q: 1, decay: 0.25, gain: 0.5 } },
      softSnare: { label: "Soft Snare", p: { noiseFreq: 2200, decay: 0.22, gain: 0.45, tone: 190, toneDecay: 0.12, toneGain: 0.4 } },
      rim:       { label: "Rim",        p: { noiseFreq: 3500, decay: 0.08, gain: 0.4, tone: 420, toneDecay: 0.05, toneGain: 0.5 } }
    },
    hat: {
      crisp: { label: "Crisp", p: { freq: 7500, decay: 0.04, openDecay: 0.25, gain: 0.35 } },
      dusty: { label: "Dusty", p: { freq: 5000, decay: 0.06, openDecay: 0.3,  gain: 0.4 } }
    },
    bass: {
      subSine: { label: "Sub Sine", p: { osc: [osc("sine"), osc("triangle", 0.15, 0, 2)], filter: { freq: 800 }, amp: { a: 0.01, d: 0.2, s: 0.8, r: 0.15 }, gain: 0.5 } },
      warmSaw: { label: "Warm Saw", p: { osc: [osc("sawtooth", 0.6), osc("sine", 0.6, 0, 0.5)], filter: { freq: 500, env: 800, decay: 0.2 }, amp: { a: 0.01, d: 0.3, s: 0.7, r: 0.15 }, gain: 0.3 } },
      pluck:   { label: "Pluck",    p: { osc: [osc("sawtooth", 0.6), osc("sine", 0.7)], filter: { freq: 350, env: 1500, decay: 0.12 }, amp: { a: 0.005, d: 0.25, s: 0.3, r: 0.1 }, gain: 0.4 } }
    },
    pad: {
      lushSaws:    { label: "Lush Saws",    p: { osc: [osc("sawtooth", 0.5, -10), osc("sawtooth", 0.5, 10)], filter: { freq: 1400, q: 0.5 }, amp: { a: 0.9, d: 0.5, s: 0.8, r: 1.4 }, gain: 0.1 } },
      glass:       { label: "Glass",        p: { osc: [osc("triangle", 0.6, -6), osc("triangle", 0.6, 6), osc("sine", 0.4, 0, 2)], filter: { freq: 3500 }, amp: { a: 0.6, d: 0.5, s: 0.8, r: 1.2 }, gain: 0.13 } },
      warmStrings: { label: "Warm Strings", p: { osc: [osc("sawtooth", 0.4, -8), osc("sawtooth", 0.4, 8)], filter: { freq: 900, env: 600, decay: 1.5 }, amp: { a: 1.0, d: 0.6, s: 0.8, r: 1.5 }, gain: 0.11 } },
      dreamChoir:  { label: "Dream Choir",  p: { osc: [osc("sine"), osc("triangle", 0.4, 7, 2), osc("sine", 0.15, 0, 3)], filter: { freq: 3000 }, vibrato: { rate: 5, depth: 8 }, amp: { a: 0.8, d: 0.5, s: 0.85, r: 1.3 }, gain: 0.15 } }
    },
    lead: {
      dreamySquare: { label: "Dreamy Square", p: { osc: [osc("square", 0.5), osc("square", 0.5, 8)], filter: { freq: 2200 }, vibrato: { rate: 5.5, depth: 10 }, amp: { a: 0.03, d: 0.3, s: 0.6, r: 0.5 }, gain: 0.12 } },
      softSaw:      { label: "Soft Saw",      p: { osc: [osc("sawtooth")], filter: { freq: 1800, env: 1500, decay: 0.3 }, amp: { a: 0.02, d: 0.3, s: 0.6, r: 0.4 }, gain: 0.13 } },
      bellPluck:    { label: "Bell Pluck",    p: { osc: [osc("sine"), osc("sine", 0.3, 0, 3.5)], filter: { freq: 5000 }, amp: { a: 0.005, d: 0.8, s: 0, r: 0.6 }, gain: 0.25 } },
      tapeSine:     { label: "Tape Sine",     p: { osc: [osc("sine"), osc("triangle", 0.2, 0, 2)], filter: { freq: 3000 }, vibrato: { rate: 4.5, depth: 15 }, amp: { a: 0.05, d: 0.3, s: 0.7, r: 0.5 }, gain: 0.2 } }
    },
    arp: {
      pluck:      { label: "Pluck",       p: { osc: [osc("sawtooth")], filter: { freq: 1500, env: 3000, decay: 0.12 }, amp: { a: 0.005, d: 0.15, s: 0, r: 0.1 }, gain: 0.14 } },
      glassy:     { label: "Glassy",      p: { osc: [osc("triangle"), osc("sine", 0.5, 0, 2)], filter: { freq: 6000 }, amp: { a: 0.005, d: 0.3, s: 0, r: 0.2 }, gain: 0.18 } },
      softSquare: { label: "Soft Square", p: { osc: [osc("square")], filter: { freq: 1800, env: 1200, decay: 0.1 }, amp: { a: 0.005, d: 0.2, s: 0, r: 0.15 }, gain: 0.1 } }
    }
  };

  // ---- validation ----------------------------------------------------------------
  const KEYS = {
    kick:  ["type", "f0", "f1", "sweep", "decay", "gain", "lp", "click"],
    snare: ["clap", "noiseFreq", "q", "decay", "gain", "tone", "toneDecay", "toneGain"],
    hat:   ["freq", "decay", "openDecay", "gain"],
    synth: ["osc", "filter", "amp", "vibrato", "gain"]
  };
  function validate(category, p) {
    const bad = [];
    const num = (v, name, lo, hi) => { if (typeof v !== "number" || !isFinite(v) || v < lo || v > hi) bad.push(name + " = " + v + " (need " + lo + " to " + hi + ")"); };
    const opt = (v, name, lo, hi) => { if (v !== undefined) num(v, name, lo, hi); };
    if (CATEGORIES.indexOf(category) === -1) return ["unknown category '" + category + "'"];
    if (!p || typeof p !== "object") return ["preset is not an object"];
    const kind = FACTORY[category];
    Object.keys(p).forEach((k) => { if (KEYS[kind].indexOf(k) === -1) bad.push("unknown field '" + k + "' (typo?)"); });
    if (kind === "kick") {
      num(p.f0, "f0", 20, 1000); num(p.f1, "f1", 20, 1000); num(p.sweep, "sweep", 0.005, 2); num(p.decay, "decay", 0.02, 3); num(p.gain, "gain", 0.01, 2);
      opt(p.lp, "lp", 20, 20000); opt(p.click, "click", 0, 2);
    } else if (kind === "snare") {
      num(p.noiseFreq, "noiseFreq", 20, 20000); num(p.decay, "decay", 0.01, 2); num(p.gain, "gain", 0.01, 2); opt(p.q, "q", 0.1, 20);
      const tone = [p.tone, p.toneDecay, p.toneGain].filter((v) => v !== undefined).length;
      if (tone !== 0 && tone !== 3) bad.push("tone, toneDecay and toneGain go together");
      if (tone === 3) { num(p.tone, "tone", 20, 2000); num(p.toneDecay, "toneDecay", 0.01, 1); num(p.toneGain, "toneGain", 0.01, 2); }
    } else if (kind === "hat") {
      num(p.freq, "freq", 20, 20000); num(p.decay, "decay", 0.005, 1); num(p.openDecay, "openDecay", 0.01, 2); num(p.gain, "gain", 0.01, 2);
    } else {
      num(p.gain, "gain", 0.01, 1);
      if (!Array.isArray(p.osc) || p.osc.length < 1 || p.osc.length > 4) bad.push("osc must list 1 to 4 oscillators");
      else p.osc.forEach((o, i) => {
        if (OSC_TYPES.indexOf(o.type) === -1) bad.push("osc[" + i + "].type '" + o.type + "'");
        num(o.gain, "osc[" + i + "].gain", 0.01, 1); num(o.detune, "osc[" + i + "].detune", -100, 100); num(o.mult, "osc[" + i + "].mult", 0.25, 8);
      });
      if (p.filter) { opt(p.filter.freq, "filter.freq", 20, 20000); opt(p.filter.q, "filter.q", 0.1, 20); opt(p.filter.env, "filter.env", 0, 20000); opt(p.filter.decay, "filter.decay", 0.01, 5); }
      if (p.amp) { opt(p.amp.a, "amp.a", 0, 5); opt(p.amp.d, "amp.d", 0, 5); opt(p.amp.s, "amp.s", 0, 1); opt(p.amp.r, "amp.r", 0, 5); }
      if (p.vibrato) { num(p.vibrato.rate, "vibrato.rate", 0.1, 20); num(p.vibrato.depth, "vibrato.depth", 0, 100); }
    }
    return bad;
  }

  function make(e, out, category, id) {
    if (!Object.prototype.hasOwnProperty.call(PRESETS, category)) throw new Error("unknown instrument category '" + category + "'");
    if (!Object.prototype.hasOwnProperty.call(PRESETS[category], id)) throw new Error("unknown " + category + " preset '" + id + "'");
    return FACTORIES[FACTORY[category]](e, out, PRESETS[category][id].p);
  }

  const freezeDeep = (o) => { if (o && typeof o === "object") { Object.keys(o).forEach((k) => freezeDeep(o[k])); Object.freeze(o); } return o; };

  const lib = (window.CHILLFORGE_LIB = window.CHILLFORGE_LIB || {});
  lib.instruments = Object.freeze({
    env, make, validate, mtof, CATEGORIES: Object.freeze(CATEGORIES.slice()),
    PRESETS: freezeDeep(PRESETS),
    kick, snare, hat, synth
  });
})();
