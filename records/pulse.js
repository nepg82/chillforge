// ---------------------------------------------------------------------------
// RECORD: Pulse (test)
// A deliberately small second style: a four-on-the-floor kick and a bass note.
// It exists to prove a style can be added as a separate file with no engine edits.
// Note the channel ids (kick, bass): the engine must not care what they are called.
//
// To remove it from the app: delete its <script> tag in index.html.
// ---------------------------------------------------------------------------
(window.CHILLFORGE_RECORDS = window.CHILLFORGE_RECORDS || []).push(["pulse", (() => {

  const SHAPES = [
    ["sine",     "Sine (Pure/Deep)"],
    ["triangle", "Triangle (Warm/Soft)"],
    ["sawtooth", "Sawtooth (Bright/Buzzy)"],
    ["square",   "Square (Hollow/Retro)"]
  ];

  let root = null;                                   // this bar's bass note

  function kick(a, t, vel) {
    const o = a.ctx.createOscillator();
    const gn = a.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.6 * vel, t + 0.004);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(gn).connect(a.nodes.kick);
    o.start(t);
    o.stop(t + 0.4);
  }

  function bass(a, t, note, steps) {
    const shape = a.S.sel.bassShape;
    const dur = steps * a.stepDur();
    const peak = 0.35 * a.shapeLevel[shape];
    const o = a.ctx.createOscillator();
    const gn = a.ctx.createGain();
    a.applyShape(o, shape);
    o.frequency.value = a.noteFreq(note);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(peak, t + 0.01);
    gn.gain.setTargetAtTime(0, t + dur - 0.05, 0.08);
    o.connect(gn).connect(a.nodes.bass);
    o.start(t);
    o.stop(t + dur + 0.6);
  }

  const rec = {
    label: "Pulse (test)",
    bpm: { min: 90, max: 130, def: 110 },

    channels: [
      { id: "kick", label: "Kick", max: 6, def: 0 },
      { id: "bass", label: "Bass", max: 6, def: 0 }
    ],
    selects: [
      { id: "bassShape", label: "Bass", def: "sine", options: SHAPES, radio: ["sine", "triangle"] }
    ],
    progs: {
      pump: { label: "Am - F - C - G (Pump)",  chords: [["A2"], ["F2"], ["C3"], ["G2"]] },
      rise: { label: "Am - G - F - E (Rise)",  chords: [["A2"], ["G2"], ["F2"], ["E2"]] }
    },

    buildGraph(a, bus) {
      const n = {};
      n.kick = a.ctx.createGain(); n.kick.connect(bus);
      n.bass = a.ctx.createGain(); n.bass.connect(bus);
      return n;
    },

    onBar(a, t, bar) {
      const chords = rec.progs[a.S.prog].chords;
      root = chords[bar % chords.length][0];
    },

    onStep(a, s, t) {
      if (s % 4 === 0 && !a.muted("kick")) kick(a, t, s === 0 ? 1 : 0.85);
      if (root && (s === 0 || s === 8) && !a.muted("bass")) bass(a, t, root, 8);
    },

    // Radio: step to the other progression and drift the tempo a little each track.
    radio: {
      nextTrack(a) {
        const keys = Object.keys(rec.progs);
        a.S.prog = keys[(keys.indexOf(a.S.prog) + 1) % keys.length];
        a.S.bpm = a.clamp(a.S.bpm + (a.rng() < 0.5 ? -4 : 4), rec.bpm.min, rec.bpm.max);
      }
    },

    reset() { root = null; }
  };
  return rec;
})()]);
