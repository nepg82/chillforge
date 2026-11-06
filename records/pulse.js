// ---------------------------------------------------------------------------
// RECORD: Pulse (test)
// A deliberately small second style: a four-on-the-floor kick and a bass note.
// It exists to prove a style can be added as a separate file with no engine edits,
// and (since build 261105-1000) to prove KEYS: it declares `keyed: true`, so the
// engine adds a Key pulldown, saves it, picks a new random key for each Radio
// track, and hands this record the current key as a.S.key.
//
// Chords are { r, t }: r = root in semitones above the key, t = a chord type from
// a.lib.theory.CHORD_TYPES. So "Pump" below works in all 12 keys. The bass root is
// folded into one fixed register (MIDI 40-51, about 82-164 Hz) in every key, so it
// never drifts out of what a phone speaker can reproduce.
//
// Note the channel ids (kick, bass): the engine must not care what they are called.
// To remove this style from the app: delete its <script> tag in index.html.
// ---------------------------------------------------------------------------
(window.CHILLFORGE_RECORDS = window.CHILLFORGE_RECORDS || []).push(["pulse", (() => {

  const SHAPES = [
    ["sine",     "Sine (Pure/Deep)"],
    ["triangle", "Triangle (Warm/Soft)"],
    ["sawtooth", "Sawtooth (Bright/Buzzy)"],
    ["square",   "Square (Hollow/Retro)"]
  ];
  const BASS_LO = 40;                                // bass root is folded into MIDI 40..51

  const c = (r, t) => ({ r, t });
  let root = null;                                   // this bar's bass note (MIDI)

  // Lock-screen name of a progression: the text in parentheses in its label.
  const progName = (k) => (rec.progs[k].label.match(/\(([^)]+)\)/) || [0, k])[1];

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

  function bass(a, t, midi, steps) {
    const shape = a.S.sel.bassShape;
    const dur = steps * a.stepDur();
    const peak = 0.35 * a.shapeLevel[shape];
    const o = a.ctx.createOscillator();
    const gn = a.ctx.createGain();
    a.applyShape(o, shape);
    o.frequency.value = a.lib.theory.mtof(midi);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(peak, t + 0.01);
    gn.gain.setTargetAtTime(0, t + dur - 0.05, 0.08);
    o.connect(gn).connect(a.nodes.bass);
    o.start(t);
    o.stop(t + dur + 0.6);
  }

  const rec = {
    label: "Pulse (test)",
    keyed: true,
    bpm: { min: 90, def: 110, max: 130 },

    channels: [
      { id: "kick", label: "Kick", max: 6, def: 0 },
      { id: "bass", label: "Bass", max: 6, def: 0 }
    ],
    selects: [
      { id: "bassShape", label: "Bass", def: "sine", options: SHAPES, radio: ["sine", "triangle"] }
    ],
    progs: {
      pump: { label: "i - \u266dVI - \u266dIII - \u266dVII (Pump)", chords: [c(0, "min"), c(8, "maj"), c(3, "maj"), c(10, "maj")] },
      rise: { label: "i - \u266dVII - \u266dVI - V (Rise)",        chords: [c(0, "min"), c(10, "maj"), c(8, "maj"), c(7, "maj")] }
    },

    buildGraph(a, bus) {
      const n = {};
      n.kick = a.ctx.createGain(); n.kick.connect(bus);
      n.bass = a.ctx.createGain(); n.bass.connect(bus);
      return n;
    },

    trackTitle(S, a) {
      return rec.label + " \u00b7 " + a.lib.theory.KEY_NAMES[S.key] + " \u00b7 " + progName(S.prog);
    },

    onBar(a, t, bar) {
      const chords = rec.progs[a.S.prog].chords;
      root = a.lib.theory.chordMidi(a.S.key, chords[bar % chords.length], BASS_LO)[0];
    },

    onStep(a, s, t) {
      if (s % 4 === 0 && !a.muted("kick")) kick(a, t, s === 0 ? 1 : 0.85);
      if (root !== null && (s === 0 || s === 8) && !a.muted("bass")) bass(a, t, root, 8);
    },

    // Radio: step to the other progression and drift the tempo a little each track.
    // (The engine has already picked a new random key for the track.)
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
