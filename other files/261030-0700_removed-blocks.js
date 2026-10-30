    // ---------------------------------------------------------------
    // Styles: everything that differs between genres lives here.
    // The tempo row, mixer rows and shape selectors are generated from it.
    // ---------------------------------------------------------------
    Object.assign(PROGRESSIONS, {
      neon: {
        label: "i - VI - III - VII (Neon Drive)",
        chords: [
          ["A2", "E3", "A3", "C4"],        // Am
          ["F2", "C3", "F3", "A3"],        // F
          ["C3", "G3", "C4", "E4"],        // C
          ["G2", "D3", "G3", "B3"]         // G
        ]
      },
      andalusian: {
        label: "i - VII - VI - V (Andalusian Night)",
        chords: [
          ["A2", "E3", "A3", "C4"],        // Am
          ["G2", "D3", "G3", "B3"],        // G
          ["F2", "C3", "F3", "A3"],        // F
          ["E2", "B2", "E3", "G#3"]        // E
        ]
      },
      sunset: {
        label: "i - VI - III - VII (Sunset Strip)",
        chords: [
          ["D3", "A3", "D4", "F4"],        // Dm
          ["Bb2", "F3", "Bb3", "D4"],      // Bb
          ["F2", "C3", "F3", "A3"],        // F
          ["C3", "G3", "C4", "E4"]         // C
        ]
      },
      midnight: {
        label: "i - VI - III - VII (Midnight Run)",
        chords: [
          ["E2", "B2", "E3", "G3"],        // Em
          ["C3", "G3", "C4", "E4"],        // C
          ["G2", "D3", "G3", "B3"],        // G
          ["D3", "A3", "D4", "F#4"]        // D
        ]
      }
    });

    Object.assign(PROGRESSIONS, {
      phrygian: {
        label: "i - bII - i - bVII (Phrygian Dread)",
        chords: [
          ["E2", "B2", "E3", "G3"],        // Em
          ["F2", "C3", "F3", "A3"],        // F
          ["E2", "B2", "E3", "G3"],        // Em
          ["D2", "A2", "D3", "F#3"]        // D
        ]
      },
      pursuit: {
        label: "i - iv - VI - V (Harmonic Minor Pursuit)",
        chords: [
          ["A2", "E3", "A3", "C4"],        // Am
          ["D3", "A3", "D4", "F4"],        // Dm
          ["F2", "C3", "F3", "A3"],        // F
          ["E2", "B2", "E3", "G#3"]        // E
        ]
      },
      abyss: {
        label: "i - bVI - bVII - i (Abyss)",
        chords: [
          ["C3", "G3", "C4", "Eb4"],       // Cm
          ["Ab2", "Eb3", "Ab3", "C4"],     // Ab
          ["Bb2", "F3", "Bb3", "D4"],      // Bb
          ["C3", "G3", "C4", "Eb4"]        // Cm
        ]
      },
      chase: {
        label: "i - bVII - bVI - V (Midnight Chase)",
        chords: [
          ["G2", "D3", "G3", "Bb3"],       // Gm
          ["F2", "C3", "F3", "A3"],        // F
          ["Eb2", "Bb2", "Eb3", "G3"],     // Eb
          ["D3", "A3", "D4", "F#4"]        // D
        ]
      }
    });


// ===================================================================

    Object.assign(PROGRESSIONS, {
      wubmin: {
        label: "i - bVI - bVII - i (Wub Minor)",
        chords: [["E2", "B2", "E3", "G3"], ["C3", "G3", "C4", "E4"], ["D3", "A3", "D4", "F#4"], ["E2", "B2", "E3", "G3"]]
      },
      darkcyc: {
        label: "i - iv - bVI - V (Dark Cycle)",
        chords: [["A2", "E3", "A3", "C4"], ["D3", "A3", "D4", "F4"], ["F2", "C3", "F3", "A3"], ["E2", "B2", "E3", "G#3"]]
      },
      pedal: {
        label: "i - i - bVI - bVII (Heavy Pedal)",
        chords: [["G2", "D3", "G3", "Bb3"], ["G2", "D3", "G3", "Bb3"], ["Eb2", "Bb2", "Eb3", "G3"], ["F2", "C3", "F3", "A3"]]
      },
      drift: {
        label: "i - bIII - bVII - iv (Dub Drift)",
        chords: [["D3", "A3", "D4", "F4"], ["F2", "C3", "F3", "A3"], ["C3", "G3", "C4", "E4"], ["G2", "D3", "G3", "Bb3"]]
      },
      grind: {
        label: "i - bII - i - bVII (Grind)",
        chords: [["F2", "C3", "F3", "Ab3"], ["Gb2", "Db3", "Gb3", "Bb3"], ["F2", "C3", "F3", "Ab3"], ["Eb2", "Bb2", "Eb3", "G3"]]
      }
    });

// ===================================================================

    STYLES.synthwave = {
      label: "Synthwave",
      bpm: { min: 85, max: 125, def: 108 },
      swing: 0,
      progs: ["neon", "andalusian", "sunset", "midnight"],
      lead: "arp", drums: "synth", jitter: 0.002,
      bassPattern: "pulse", scenes: "synth",
      cutoffMul: 1.8, padCutoff: 2600, reverb: 0.35, echo: 0.25,
      channels: [
        { id: "drums", label: "Drums", max: 6, def: 0 },
        { id: "bass",  label: "Bass",  max: 6, def: -2 },
        { id: "pad",   label: "Pad",   max: 6, def: -3 },
        { id: "arp",   label: "Arp",   max: 6, def: -2 }
      ],
      selects: [
        { id: "padShape", label: "Pad", def: "super",
          options: [["super", "Supersaw (Wide/Lush)"], ["sawtooth", SHAPE_LABELS.sawtooth], ["softtri", SHAPE_LABELS.softtri]] },
        { id: "arpPattern", label: "Pattern", def: "up",
          options: [["up", "Up"], ["updown", "Up-Down"], ["down", "Down"],
          ["wander", "Wander (Random Walk)"], ["scatter", "Scatter (Fully Random)"]],
          radio: ["updown", "wander", "scatter"] },
        { id: "arpShape", label: "Lead", def: "sawtooth",
          options: shapeOpts(["sawtooth", "square", "softtri", "triangle", "sine"]) },
        { id: "variation", label: "Variation", def: "med",
          options: [["off", "Off (Steady Loop)"], ["low", "Rare (Auto Mute)"], ["med", "Occasional (Auto Mute)"], ["high", "Frequent (Auto Mute)"]] }
      ]
    };

    STYLES.darksynth = {
      label: "Darksynth",
      bpm: { min: 90, max: 135, def: 112 },
      swing: 0,
      progs: ["phrygian", "pursuit", "abyss", "chase"],
      lead: "arp", drums: "dark", jitter: 0.002,
      bassPattern: "gallop", scenes: "dark",
      arpEvery: 2,                          // arp plays eighths against the sixteenth-note bass
      drive: 5,                             // bass distortion amount (0 = clean)
      bassSweep: [380, 1200],               // bass filter sweeps lo -> hi -> lo across each phrase (Hz)
      cutoffMul: 1.5, padCutoff: 1500, reverb: 0.4, echo: 0.2,
      channels: [
        { id: "drums", label: "Drums", max: 6, def: 0 },
        { id: "bass",  label: "Bass",  max: 6, def: -4 },
        { id: "pad",   label: "Pad",   max: 6, def: -4 },
        { id: "arp",   label: "Arp",   max: 6, def: -3 }
      ],
      selects: [
        { id: "bassPattern", label: "Bassline", def: "gallop",
          options: [["gallop", "Gallop (Eighth + Two 16ths)"], ["driving", "Driving 16ths"],
                    ["octave", "Octave Bounce (16ths)"], ["pulse", "Pulse (Eighths)"]] },
        { id: "padShape", label: "Pad", def: "super",
          options: [["super", "Supersaw (Wide/Lush)"], ["sawtooth", SHAPE_LABELS.sawtooth], ["softtri", SHAPE_LABELS.softtri]] },
        { id: "arpPattern", label: "Pattern", def: "updown",
          options: [["up", "Up"], ["updown", "Up-Down"], ["down", "Down"],
          ["wander", "Wander (Random Walk)"], ["scatter", "Scatter (Fully Random)"]],
          radio: ["updown", "wander", "scatter"] },
        { id: "arpShape", label: "Lead", def: "sawtooth",
          options: shapeOpts(["sawtooth", "square", "softtri", "triangle", "sine"]) },
        { id: "variation", label: "Variation", def: "med",
          options: [["off", "Off (Steady Loop)"], ["low", "Rare (Auto Mute)"], ["med", "Occasional (Auto Mute)"], ["high", "Frequent (Auto Mute)"]] }
      ]
    };

// ===================================================================

    STYLES.dubstep2 = {
      label: "Dubstep 2",
      bpm: { min: 130, max: 150, def: 140 },
      swing: 0,
      progs: ["wubmin", "darkcyc", "pedal", "drift", "grind"],
      lead: "arp", drums: "dark", jitter: 0.002,   // lead "arp" gives it the shared bass path; step() replaces the arp/bass/drum scheduling
      step: (s, t) => dub2Step(s, t),
      drive: 3, bassSweep: [380, 1100],            // bass filter base sweeps across each phrase; the wobble LFO rides on top
      cutoffMul: 3.4, padCutoff: 2200, reverb: 0.3, echo: 0,
      channels: [
        { id: "drums", label: "Drums", max: 6, def: -2 },
        { id: "bass",  label: "Bass",  max: 6, def: -3 },
        { id: "pad",   label: "Pad",   max: 6, def: -5 }
      ],
      selects: [
        { id: "bassVoice", label: "Bass", def: "saw",
          options: [["saw", "Saw (Classic Wub)"], ["square", "Square (Hollow)"], ["growl", "Growl (Thick Stack)"],
                    ["reese", "Reese (Wide, Phasing)"], ["fm", "FM Metal (Talking)"], ["mixed", "Mixed (Changes by Phrase)"]],
          radio: ["saw", "square", "growl", "reese"] },
        { id: "bassPattern", label: "Bassline", def: "half",
          options: [["half", "Half-Time Hold"], ["hold", "Long Drone"], ["stutter", "Stutter"]] },
        { id: "padShape", label: "Pad", def: "super",
          options: [["super", "Supersaw (Wide/Lush)"], ["sawtooth", SHAPE_LABELS.sawtooth], ["softtri", SHAPE_LABELS.softtri]] },
        { id: "variation", label: "Variation", def: "med",
          options: [["off", "Off (Endless Drop)"], ["low", "Rare (Break + Build)"], ["med", "Occasional (Break + Build)"], ["high", "Frequent (Break + Build)"]] }
      ]
    };

// ===================================================================

    // ---------------------------------------------------------------// ---------------------------------------------------------------
    // Dubstep 2 (native). Reuses Chillforge's own pieces: the shared bass path (bassIn -> drive ->
    // sweeping filter), playChord + supersaw pad, hard kick / gated snare / hats, the progression
    // picker, and Radio's layered intros/outros. New here: a half-time groove, a wobble LFO,
    // bass voices, and a build -> drop -> break cycle. Prefixed dub2/D2 to avoid collisions.
    // Paste above the "Scheduler (16 steps per bar, 4/4)" section, next to the other module.
    // ---------------------------------------------------------------

    const DUB2_PAT = { half: { 0: 10, 10: 5 }, hold: { 0: 15 }, stutter: { 0: 6, 8: 3, 12: 2, 14: 2 } };   // step -> length in steps
    const DUB2_VOICES = {                                                                               // [wave, freq multiplier, detune cents]
      saw:    [["sawtooth", 1, -12], ["sawtooth", 1, 12]],
      square: [["square", 1, -8], ["square", 1, 8]],
      growl:  [["sawtooth", 1, -18], ["sawtooth", 1, 0], ["sawtooth", 1, 18], ["sawtooth", 2, 0]],
  	  reese:  [["sawtooth", 1, -28], ["sawtooth", 1, -9], ["sawtooth", 1, 9], ["sawtooth", 1, 28]]   // fm is built separately (dub2Fm)
    };
    // Variation: [drop lengths in bars, chance the end of a drop goes through a break first]. Off = endless drop.
    const DUB2_VAR = { low: [[24, 32, 32], 0.3], med: [[16, 24, 32], 0.5], high: [[16, 16, 24], 0.7] };
    const D2 = { g: null, ph: null, left: 0, n: 0, wm: 4, trk: -1, rb: null, mv: "saw" };
    const d2p = (a) => a[Math.floor(Math.random() * a.length)];

    // Noise sweep (crash, downlifter) into the drums channel.
    function dub2Sweep(t, d, type, f0, f1, v) {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), gn = ctx.createGain();
      s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.Q.value = 0.8;
      fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + d);
      gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.001, t + d);
      s.connect(fl).connect(gn).connect(g.drums); s.start(t); s.stop(t + d + 0.02);
    }
    // Riser goes through one gain node so a track change can cut it off.
	function dub2Riser(t, d) {
	  const bus = ctx.createGain(), s = ctx.createBufferSource(),
	        fl = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), gn = ctx.createGain();
	  bus.connect(g.drums); D2.rb = bus;
	  s.buffer = noiseBuf; s.loop = true;
	  fl.type = "bandpass"; fl.Q.value = 0.8;                       // was 1.5: broader, less whistly
	  fl.frequency.setValueAtTime(200, t);
	  fl.frequency.exponentialRampToValueAtTime(3500, t + d);       // was 9000
	  lp.type = "lowpass"; lp.frequency.value = 4500; lp.Q.value = 0.5;   // hard ceiling on the hiss
	  gn.gain.setValueAtTime(0, t);
	  gn.gain.linearRampToValueAtTime(0.2, t + d - 0.05);           // was 0.5
	  gn.gain.linearRampToValueAtTime(0, t + d);
	  s.connect(fl).connect(lp).connect(gn).connect(bus); s.start(t); s.stop(t + d + 0.05);
	}
    // Wobble: one sine LFO per bar on the shared bass filter. Whole cycles per bar, so it loops seamlessly,
    // and the depth (280 Hz) can never pull the cutoff below ~100 Hz (the sweep base never goes under 380).
    function dub2Lfo(t) {
      const o = ctx.createOscillator(), gn = ctx.createGain(), bar = 16 * stepDur();
      o.frequency.value = D2.wm / bar; gn.gain.value = 280;
      o.connect(gn).connect(g.bassFilter.frequency); o.start(t); o.stop(t + bar + 0.05);
    }

    // FM voice: sine carrier with a sine modulator at 2x; the modulation index falls across the note (a "talking" edge).
    function dub2Fm(t, dur, f, subM, gn) {
      const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), sb = ctx.createOscillator();
      c.frequency.value = f; m.frequency.value = f * 2;
      mg.gain.setValueAtTime(f * 4, t); mg.gain.exponentialRampToValueAtTime(f * 1.2, t + dur);
      m.connect(mg).connect(c.frequency);
      sb.frequency.value = f * subM;
      c.connect(gn); sb.connect(gn);
      [c, m, sb].forEach((o) => { o.start(t); o.stop(t + dur + 0.3); });
    }

    function dub2Bass(t, len) {
      let v = S.sel.bassVoice;
      if (v === "mixed") v = D2.mv;
      const fm = v === "fm", f = noteFreq(currentChord[0]), dur = len * stepDur() * 0.92;
      const subM = f / 2 < 40 ? 1 : 0.5;                              // sub an octave down (not below ~40 Hz)
      const list = fm ? [] : DUB2_VOICES[v].concat([["sine", subM, 0]]);
      const gn = ctx.createGain(), peak = fm ? 0.22 : 0.5 / list.length;
      gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(peak, t + 0.008);
      gn.gain.setTargetAtTime(0, t + dur, 0.04);
      list.forEach(([ty, m, dt]) => {
        const o = ctx.createOscillator();
        o.type = ty; o.frequency.value = f * m; o.detune.value = dt;
        o.connect(gn); o.start(t); o.stop(t + dur + 0.3);
      });
      if (fm) dub2Fm(t, dur, f, subM, gn);
      gn.connect(g.bassIn);
    }

    function dub2Drums(s, t) {
      const jt = t + rand(-0.002, 0.002), L = D2.left;
      if (D2.ph === "build") {
        if (L === 0 && s >= 14) return;                              // gap before the drop
        const bi = L <= 3 ? 3 - L : -1;                              // last 4 bars: kicks thin out, snare roll speeds up
        if (bi < 0) { if (s % 4 === 0) kickHard(jt, 0.8); if (s === 8) snare(jt, 0.35); return; }
        if (bi < 2 && s % 4 === 0) kickHard(jt, 0.8);
        if (s % [4, 2, 1, 1][bi] === 0) snare(jt, (0.25 + bi * 0.15 + s / 80) * 0.6);
        return;
      }
      if (s === 0) kickHard(jt, 1); else if (s === 10 && Math.random() < 0.6) kickHard(jt, 0.8);
	  if (s === 8) snare(jt, rand(0.7, 1));		// half-time: snare on beat 3
      if (s % 4 === 2) noiseHit(jt, g.hatHP, 0.01, 0.05);  //try 0.09 in place of 0.14
      else if (s % 4 === 0) hat(jt, 0.45);
      else if (Math.random() < 0.5) hat(jt, rand(0.15, 0.3));
    }

    function dub2Reset(t) {
      D2.g = g; D2.trk = R.n; D2.ph = null; D2.left = 0; D2.n = 0;
      if (D2.rb) { D2.rb.gain.cancelScheduledValues(t); D2.rb.gain.setTargetAtTime(0, t, 0.03); D2.rb = null; }
    }

    // Picks the next section. Radio off: build -> drop -> (drop | break -> build | build) ... Variation Off = endless drop.
    function dub2Next(t) {
      const V2 = DUB2_VAR[S.sel.variation], old = D2.ph, loud = !muted("drums"), sd = stepDur();
      const go = (ph, n) => { D2.ph = ph; D2.left = n; };
      const build = (n) => { go("build", n); if (loud) dub2Riser(t, n * 16 * sd); };
      if (!old) { if (R.on) go("drop", d2p(V2 ? V2[0] : [16])); else build(4); }   // Radio's layered intro replaces the build
      else if (old === "build") { go("drop", d2p(V2 ? V2[0] : [16])); if (loud && Math.random() < 0.75) dub2Sweep(t, rand(1.0, 2.2), "bandpass", rand(2200, 3500), rand(900, 1600), rand(0.1, 0.2)); }
      else if (old === "break") build(d2p([4, 8]));
      else if (!V2) go("drop", 16);
      else {
        if (loud && Math.random() < 0.66) dub2Sweep(t, rand(1.0, 1.8), "bandpass", rand(2500, 4000), rand(200, 400), rand(0.15, 0.25));
        if (Math.random() < V2[1]) go("break", 8); else build(4);
      }
    }

    function dub2Step(s, t) {
      if (s === 0) {
        if (R.on) radioBar();
        if (D2.g !== g || (R.on && D2.trk !== R.n)) dub2Reset(t);    // new graph or new Radio track: start fresh
        if (D2.left <= 0) dub2Next(t);
        D2.left--;                                                   // bars remaining after this one
        if ((D2.n++ & 3) === 0) { D2.wm = d2p([2, 4, 4, 8, 8, 12]); D2.mv = d2p(["saw", "square", "growl", "reese", "fm"]); }    // wobble rate re-rolls each phrase (cycles per bar)
        playChord(t, !muted("pad"));
        if (D2.ph === "drop" && !muted("bass")) dub2Lfo(t);
      }
      if (D2.ph === "break") return;
      if (!muted("drums")) dub2Drums(s, t);
      if (D2.ph === "drop" && !muted("bass")) {
        const len = DUB2_PAT[S.sel.bassPattern][s];
        if (len) dub2Bass(t, len);
      }
    }

// ===================================================================

    // Bass patterns: step (0-15) -> null (rest) or { len: steps held, acc: accent, up: octave up }.
    const BASS_PATTERNS = {
      pulse:   (s) => (s % 2 === 0 ? { len: 2, acc: s % 4 === 0, up: (s / 2) % 4 === 3 } : null),
      gallop:  (s) => { const m = s % 4; return m === 1 ? null : { len: m === 0 ? 2 : 1, acc: m === 0, up: false }; },
      driving: (s) => ({ len: 1, acc: s % 4 === 0, up: false }),
      octave:  (s) => ({ len: 1, acc: s % 4 === 0, up: s % 2 === 1 })
    };

// ===================================================================

    // Variation (Synthwave and Darksynth): occasionally mute some channels for a few bars.
    // Decisions are made only at the start of a phrase (one pass through the progression).
    const VAR_LEVELS = { off: 0, low: 0.08, med: 0.15, high: 0.30 };   // chance per eligible phrase that a scene starts
    const VAR_BARS = [2, 4];      // possible scene lengths, in bars
    const VAR_SCENES = {          // channels muted in each scene, with relative weights (per style)
      synth: [
        { mute: ["drums"],         w: 3 },
        { mute: ["arp"],           w: 3 },
        { mute: ["pad"],           w: 2 },
        { mute: ["drums", "bass"], w: 1 },
        { mute: ["pad", "arp"],    w: 1 }
      ],
      dark: [
        { mute: ["drums"],         w: 3 },
        { mute: ["arp"],           w: 2 },
        { mute: ["pad"],           w: 2 },
        { mute: ["pad", "arp"],    w: 2 },   // rhythm section only
        { mute: ["drums", "bass"], w: 1 }
      ]
    };

// ===================================================================

    // Bass: sawtooth on the chord root, one octave below the pad's lowest note.
    // p comes from BASS_PATTERNS: { len, acc, up }.
    function playBass(t, p) {
      const sd = stepDur();
      let f = noteFreq(currentChord[0]) / 2;
      if (p.up) f *= 2;
      const dur = p.len * sd * 0.85;
      const peak = p.acc ? 0.34 : 0.26, atk = 0.008;
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.value = f;
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.linearRampToValueAtTime(peak, t + atk);
      gn.gain.setTargetAtTime(peak * 0.55, t + atk, 0.08);
      gn.gain.setTargetAtTime(0, t + dur, 0.04);
      o.connect(gn).connect(g.bassIn);
      o.start(t);
      o.stop(t + dur + 0.3);
    }

    // Arp: walks through the chord's notes (two octaves up from the pad voicing).
    const poolCache = new WeakMap();
    function arpPool(chord) {
      let p = poolCache.get(chord);
      if (!p) {
        const fs = new Set();
        chord.forEach((n, i) => {
          const f = noteFreq(n);
          fs.add(+(f * 2).toFixed(2));
          if (i < 3) fs.add(+(f * 4).toFixed(2));
        });
        p = [...fs].sort((a, b) => a - b);
        poolCache.set(chord, p);
      }
      return p;
    }
    function arpIndex(pat, n, k) {
	  if (pat === "down") return n - 1 - (k % n);
	  if (pat === "updown") { const p = 2 * n - 2, m = k % p; return m < n ? m : p - m; }
	  return k % n;
	}

	// Wander / Scatter: pick the next pool index based on the last note played.
	function arpNext(pat, pool) {
	  const n = pool.length;
	  let i = -1;                                   // where the previous note sits in this chord's pool
	  if (arpFreq !== null) {
	    let best = Infinity;
	    pool.forEach((f, j) => {
	      const d = Math.abs(Math.log(f / arpFreq));
	      if (d < best) { best = d; i = j; }
	    });
	  }
	  if (i < 0) return Math.floor(Math.random() * n);
	
	  if (pat === "scatter") {
	    let j;
	    do { j = Math.floor(Math.random() * n); } while (j === i && n > 1);
	    return j;
	  }
	
	  // wander: mostly neighbors, sometimes a repeat, a skip, or a leap
	  const r = Math.random();
	  const dist = r < 0.50 ? 1 : r < 0.65 ? 0 : r < 0.90 ? 2 : 3 + Math.floor(Math.random() * 2);
	  const dir = Math.random() < 0.5 ? 1 : -1;
	  let j = i + dir * dist;
	  if (j < 0 || j >= n) j = i - dir * dist;      // bounce off the ends
	  return clamp(j, 0, n - 1);
	}

	function playArp(t, s) {
	  if (!currentChord) return;
	  const pool = arpPool(currentChord);
	  const pat = S.sel.arpPattern;
	  const f = (pat === "wander" || pat === "scatter")
	    ? pool[arpNext(pat, pool)]
	    : pool[arpIndex(pat, pool.length, arpK++)];
	  arpFreq = f;
	  const shape = S.sel.arpShape;
	  const every = STYLES[styleKey].arpEvery || 1;
	  const dur = every * stepDur() * 0.8;
	  const peak = 0.13 * SHAPE_LEVEL[shape] * (s % 4 === 0 ? 1 : 0.75);
	  const o = ctx.createOscillator();
	  const gn = ctx.createGain();
	  applyShape(o, shape);
	  o.frequency.value = f;
	  gn.gain.setValueAtTime(0.0001, t);
	  gn.gain.linearRampToValueAtTime(peak, t + 0.004);
	  gn.gain.setTargetAtTime(peak * 0.35, t + 0.004, 0.07);
	  gn.gain.setTargetAtTime(0, t + dur, 0.03);
	  o.connect(gn).connect(g.arp);
	  o.start(t);
	  o.stop(t + dur + 0.25);
	}

// ===================================================================

    // Harder kick: faster pitch drop, longer body, and a tiny click on top.
    function kickHard(t, vel) {
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(190, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.09);
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(0.7 * vel, t + 0.003);
      gn.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(gn).connect(g.drums);
      o.start(t);
      o.stop(t + 0.55);
      noiseHit(t, g.hatHP, 0.1 * vel, 0.012);
    }

    // Gated snare: noise held at level, then cut off sharply (the reverb send adds the tail).
    function gatedSnare(t, vel) {
      const s = ctx.createBufferSource();
      const gn = ctx.createGain();
      s.buffer = noiseBuf;
      gn.gain.setValueAtTime(0.55 * vel, t);
      gn.gain.linearRampToValueAtTime(0.38 * vel, t + 0.16);
      gn.gain.linearRampToValueAtTime(0.0001, t + 0.19);
      s.connect(gn).connect(g.snareBP);
      s.start(t, Math.random() * 0.8);
      s.stop(t + 0.2);
      const o = ctx.createOscillator();
      const bg = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = 175;
      bg.gain.setValueAtTime(0.3 * vel, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      o.connect(bg).connect(g.drums);
      o.start(t);
      o.stop(t + 0.12);
    }

// ===================================================================

    // Soft-clip curve for the bass (cached per drive amount; output kept near the clean level).
    const driveCache = {};
    function driveCurve(k) {
      if (!driveCache[k]) {
        const n = 2048, c = new Float32Array(n);
        for (let i = 0; i < n; i++) c[i] = Math.tanh(k * ((i / (n - 1)) * 2 - 1)) * 0.35;
        driveCache[k] = c;
      }
      return driveCache[k];
    }

// ===================================================================

    // Straight 80s pattern: kick on 1 and 3, big snare on 2 and 4, open hats on the offbeats.
    function drumsSynth(s, jt) {
      if (s === 0 || s === 8) kick(jt, 1);
      else if ((s === 10 || s === 14) && Math.random() < 0.3) kick(jt, 0.7);

      if (s === 4 || s === 12) snare(jt, rand(0.9, 1));

      if (s % 4 === 2) noiseHit(jt, g.hatHP, 0.14, 0.11);        // open hat
      else if (s % 4 === 0) hat(jt, 0.5);
      else if (Math.random() < 0.6) hat(jt, rand(0.15, 0.25));
    }
    // Darksynth: heavy kick on 1 and 3 (plus occasional extras), gated snare on 2 and 4, tight hats.
    function drumsDark(s, jt) {
      if (s === 0 || s === 8) kickHard(jt, 1);
      else if (s === 3 && Math.random() < 0.2) kickHard(jt, 0.7);
      else if ((s === 6 || s === 10 || s === 14) && Math.random() < 0.3) kickHard(jt, 0.8);

      if (s === 4 || s === 12) gatedSnare(jt, rand(0.5, 0.65));

      if (s % 4 === 2) hat(jt, rand(0.8, 1));
      else if (s % 4 === 0) hat(jt, 0.45);
      else if (Math.random() < 0.7) hat(jt, rand(0.15, 0.3));
    }

// ===================================================================

      if (st.lead === "arp") {
        n.bass = ctx.createGain(); n.bass.connect(n.filter);
        n.arp = ctx.createGain();  n.arp.connect(n.filter);
        n.bassFilter = ctx.createBiquadFilter();
        n.bassFilter.type = "lowpass"; n.bassFilter.frequency.value = st.bassSweep ? st.bassSweep[0] : 650;
        n.bassFilter.Q.value = 3;
        n.bassFilter.connect(n.bass);
        n.bassIn = n.bassFilter;                     // bass notes enter here
        if (st.drive) {                              // distort first, then filter the result
          n.bassShaper = ctx.createWaveShaper();
          n.bassShaper.curve = driveCurve(st.drive);
          n.bassShaper.oversample = "2x";
          n.bassShaper.connect(n.bassFilter);
          n.bassIn = n.bassShaper;
        }
      }
      
// ===================================================================

      if (st.reverb > 0) {
        if (!irBuf) irBuf = makeIR(2.2, 3);
        n.conv = ctx.createConvolver(); n.conv.buffer = irBuf;
        n.revSend = ctx.createGain(); n.revSend.gain.value = st.reverb;
        n.revSend.connect(n.conv).connect(n.filter);
        n.pad.connect(n.revSend); n.snareBP.connect(n.revSend);
        if (n.arp) n.arp.connect(n.revSend);
      }
      
// ===================================================================

      // Bass filter: slow sweep lo -> hi -> lo across the phrase, one bar's slice at a time.
      const sweep = STYLES[styleKey].bassSweep;
      if (sweep && g.bassFilter) {
        const tri = (x) => 1 - Math.abs(2 * x - 1);
        const fr = (x) => sweep[0] * Math.pow(sweep[1] / sweep[0], tri(x));
        const bf = g.bassFilter.frequency;
        bf.cancelScheduledValues(t);
        bf.setValueAtTime(fr(pos / chords.length), t);
        bf.exponentialRampToValueAtTime(fr((pos + 1) / chords.length), t + 16 * stepDur());
      }
            
// ===================================================================

      if (st.step) { st.step(s, t); return; }

      if (st.lead === "melody") {
        if (s % 2 === 0 && !muted("melody") && Math.random() < MELODY_DENSITY) playMelody(t);
      } else {
        const bp = BASS_PATTERNS[S.sel.bassPattern || st.bassPattern](s);
        if (bp && !muted("bass")) playBass(t, bp);
        if (s % (st.arpEvery || 1) === 0 && !muted("arp")) playArp(t, s);
      }

            
// ===================================================================


arpFreq = null;

arpK = 0, arpFreq = null, 
            
// ===================================================================

      arpK = 0;

      chord.forEach((note, i) => {
        const ts = t + i * 0.012;                    // slight strum
        const dets = shape === "super" ? [-14, 0, 14] : [rand(-6, 6)];
        dets.forEach((dt) => {
          const o = ctx.createOscillator();
          const gn = ctx.createGain();
          applyShape(o, shape === "super" ? "sawtooth" : shape);
          o.frequency.value = noteFreq(note);
          o.detune.value = shape === "super" ? dt + rand(-3, 3) : dt;
          gn.gain.setValueAtTime(0.0001, ts);
          gn.gain.linearRampToValueAtTime(peak, ts + 0.18);
          gn.gain.setTargetAtTime(0, t + dur - 0.05, 0.25);
          o.connect(gn).connect(g.padFilter);
          o.start(ts);
          o.stop(t + dur + 1.6);
        });
      });