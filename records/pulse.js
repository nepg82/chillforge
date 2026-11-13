// ---------------------------------------------------------------------------
// RECORD: Pulse (test bench)
// Pulse exists to prove and to audition the toolbox. Every sound and every pattern
// is a pulldown, so you can hear each ingredient on its own:
//   kick, snare, hats (a.lib.instruments)   bass, arp, lead (instruments + a.lib.parts)
//   OCTAVES: each of bass, arp and lead can get a low layer (one extra oscillator an octave
//            below every note) or be dropped an octave
//   CHARACTER (a.lib.fx, built once, nearly free): width (stereo placement), space (a short
//            room), warmth (soft saturation), motion (slow pitch drift and filter sweep)
// It is keyed (the engine adds a Key pulldown, saves it, and picks a new random key per
// Radio track) and it NEEDS the toolbox, so the loader refuses it if a lib file is missing.
//
// How it works, bar by bar:
//   onBar  asks the PARTS for this bar's note events (from the chord, the key, the
//          chosen pattern) and keeps them;
//   onStep plays the events that fall on this step through the INSTRUMENTS.
//
// Chords are { r, t }: r = root in semitones above the key, t = a chord type. Each
// instrument has its own register: bass roots fold into MIDI 40-51 (about 82-164 Hz,
// what a phone speaker can reproduce), the arp starts at middle C, the lead lives in
// MIDI 64-81.
//
// To remove this style from the app: delete its <script> tag in index.html.
// ---------------------------------------------------------------------------
(window.CHILLFORGE_RECORDS = window.CHILLFORGE_RECORDS || []).push(["pulse", (() => {

  const c = (r, t) => ({ r, t });

  // Option lists. The ids are the toolbox's preset / pattern ids (the harness plays every one).
  const KICKS     = [["softThump", "Soft Thump"], ["deepTape", "Deep Tape"], ["punchy", "Punchy"]];
  const SNARES    = [["softSnare", "Soft Snare"], ["clap", "Clap"], ["rim", "Rim"]];
  const HATS      = [["crisp", "Crisp"], ["dusty", "Dusty"]];
  const BASSES    = [["subSine", "Sub Sine"], ["warmSaw", "Warm Saw"], ["pluck", "Pluck"]];
  const BASS_LINE = [["drive", "Drive"], ["walk", "Walk"], ["octave", "Octave"]];
  const ARPS      = [["pluck", "Pluck"], ["glassy", "Glassy"], ["softSquare", "Soft Square"]];
  const ARP_LINE  = [["upDown", "Up and down"], ["skip", "Skip"], ["run", "Run (busy)"], ["wide", "Wide"]];
  const LEADS     = [["softSaw", "Soft Saw"], ["dreamySquare", "Dreamy Square"], ["bellPluck", "Bell Pluck"], ["tapeSine", "Tape Sine"]];
  const LEAD_RHY  = [["lilt", "Lilt"], ["drift", "Drift"], ["sway", "Sway"]];
  const BASS_OCT  = [["normal", "Normal"], ["layerTri", "+ Low triangle"], ["layerSine", "+ Low sine"], ["down", "Down an octave"]];
  const OCT       = [["normal", "Normal"], ["layer", "+ Low layer"], ["down", "Down an octave"]];
  const WIDTH     = [["off", "Off"], ["gentle", "Gentle"], ["wide", "Wide"]];
  const SPACE     = [["off", "Off"], ["room", "Room"], ["hall", "Hall"]];
  const WARMTH    = [["off", "Off"], ["soft", "Soft"], ["tape", "Tape"]];
  const MOTION    = [["off", "Off"], ["drift", "Drift"], ["sweep", "Sweep"], ["both", "Both"]];

  const BASS_LO = 40, ARP_LO = 60, LEAD_LO = 64, LEAD_HI = 81;

  const IDS = ["kick", "perc", "bass", "arp", "lead"];
  // slot -> [instrument category, the pulldown that picks its preset, the pulldown that picks its octave (or null), the channel it feeds]
  const SLOTS = {
    kick:  ["kick",  "kickSound",  null,         "kick"],
    snare: ["snare", "snareSound", null,         "perc"],
    hat:   ["hat",   "hatSound",   null,         "perc"],
    bass:  ["bass",  "bassSound",  "bassOctave", "bass"],
    arp:   ["arp",   "arpSound",   "arpOctave",  "arp"],
    lead:  ["lead",  "leadSound",  "leadOctave", "lead"]
  };
  const LOW = { layerTri: { type: "triangle", gain: 0.7 }, layerSine: { type: "sine", gain: 0.7 }, layer: { type: "triangle", gain: 0.6 } };

  // Character amounts (0 to 1) for each pulldown choice
  const AMT = { off: 0, gentle: 0.5, room: 0.5, soft: 0.5, wide: 1, hall: 1, tape: 1 };
  const MOTION_AMT = { off: { drift: 0, sweep: 0 }, drift: { drift: 0.6, sweep: 0 }, sweep: { drift: 0, sweep: 0.6 }, both: { drift: 0.6, sweep: 0.6 } };
  const fxAmounts = (sel) => ({ width: AMT[sel.width], space: AMT[sel.space], warmth: AMT[sel.warmth], drift: MOTION_AMT[sel.motion].drift, sweep: MOTION_AMT[sel.motion].sweep });
  // taste settings that Radio leaves alone when it rerolls the sounds
  const KEEP = ["bassOctave", "arpOctave", "leadOctave", "width", "space", "warmth", "motion"];
  const down = (sel, id) => (sel[id] === "down" ? -12 : 0);

  let inst = null;                 // the instruments of the current graph
  let ids = null;                  // the preset + octave each one was built from
  let fx = null;                   // the character stage of the current graph
  let lastFx = null;               // the amounts it was last set to
  let ev = null;                   // this bar's note events
  let lastLead = null;             // the lead's previous note (the melody continues across bars)

  // Lock-screen name of a progression: the text in parentheses in its label.
  const progName = (k) => (rec.progs[k].label.match(/\(([^)]+)\)/) || [0, k])[1];

  // (Re)build any instrument whose sound or octave pulldown changed. Runs at graph build and at every bar line.
  function sync(a, nodes, mine, mineIds) {
    const I = a.lib.instruments, sel = a.S.sel;
    let e = null;
    Object.keys(SLOTS).forEach((slot) => {
      const [category, soundSel, octSel, channel] = SLOTS[slot];
      const oct = octSel ? sel[octSel] : null, want = sel[soundSel] + "|" + (oct || "");
      if (mine[slot] && mineIds[slot] === want) return;
      if (mine[slot]) mine[slot].dispose();
      if (!e) { e = I.env(a); e.drift = fx.drift; }
      mine[slot] = I.make(e, nodes[channel], category, sel[soundSel], oct && LOW[oct] ? { low: LOW[oct] } : undefined);
      mineIds[slot] = want;
    });
  }

  // Move the character stage to the amounts the pulldowns ask for (only when they changed).
  function syncFx(a) {
    const amt = fxAmounts(a.S.sel), k = JSON.stringify(amt);
    if (k === lastFx) return;
    fx.set(amt); lastFx = k;
  }

  const rec = {
    label: "Pulse (test bench)",
    keyed: true,
    needs: ["theory", "instruments", "parts", "fx"],
    bpm: { min: 90, def: 110, max: 130 },
    swing: 0.1,
    cutoffMul: 1.5,                 // opens the highs for the arp and hats; 1 is darker

    channels: [
      { id: "kick", label: "Kick", max: 6, def: 0 },
      { id: "perc", label: "Perc", max: 6, def: -4 },
      { id: "bass", label: "Bass", max: 6, def: 0 },
      { id: "arp",  label: "Arp",  max: 6, def: -6 },
      { id: "lead", label: "Lead", max: 6, def: -3 }
    ],

    selects: [
      { id: "kickSound",  label: "Kick",        def: "softThump", options: KICKS },
      { id: "snareSound", label: "Snare",       def: "softSnare", options: SNARES },
      { id: "hatSound",   label: "Hats",        def: "crisp",     options: HATS },
      { id: "bassSound",  label: "Bass",        def: "subSine",   options: BASSES },
      { id: "bassLine",   label: "Bass line",   def: "drive",     options: BASS_LINE },
      { id: "arpSound",   label: "Arp",         def: "pluck",     options: ARPS },
      { id: "arpLine",    label: "Arp line",    def: "upDown",    options: ARP_LINE, radio: ["upDown", "skip", "wide"] },
      { id: "leadSound",  label: "Lead",        def: "softSaw",   options: LEADS },
      { id: "leadRhythm", label: "Lead rhythm", def: "lilt",      options: LEAD_RHY },
      { id: "bassOctave", label: "Bass octave", def: "layerTri",  options: BASS_OCT },
      { id: "arpOctave",  label: "Arp octave",  def: "normal",    options: OCT },
      { id: "leadOctave", label: "Lead octave", def: "layer",     options: OCT },
      { id: "width",      label: "Width",       def: "gentle",    options: WIDTH },
      { id: "space",      label: "Space",       def: "room",      options: SPACE },
      { id: "warmth",     label: "Warmth",      def: "soft",      options: WARMTH },
      { id: "motion",     label: "Motion",      def: "drift",     options: MOTION }
    ],

    progs: {
      pump:   { label: "i - \u266dVI - \u266dIII - \u266dVII (Pump)",             scale: "minor", chords: [c(0, "min"), c(8, "maj"), c(3, "maj"), c(10, "maj")] },
      rise:   { label: "i - \u266dVII - \u266dVI - V (Rise)",                     scale: "minor", chords: [c(0, "min"), c(10, "maj"), c(8, "maj"), c(7, "maj")] },
      dream:  { label: "i9 - \u266dVImaj7 - \u266dIIImaj7 - \u266dVIIadd9 (Hazy Dream)", scale: "minor", chords: [c(0, "min9"), c(8, "maj7"), c(3, "maj7"), c(10, "add9")] },
      sunset: { label: "Imaj7 - IVmaj7 - vi7 - Vadd9 (Sunset Drive)",             scale: "major", chords: [c(0, "maj7"), c(5, "maj7"), c(9, "min7"), c(7, "add9")] }
    },

    buildGraph(a, bus) {
      const n = {};
      IDS.forEach((id) => { n[id] = a.ctx.createGain(); });          // the mixer's channel gains come first
      const mineFx = a.lib.fx.create(a.lib.instruments.env(a), bus, {
        channels: IDS,
        pan:  { perc: 0.3, arp: -0.6, lead: 0.6 },                    // base placement; the Width pulldown scales it
        send: { perc: 0.25, arp: 0.5, lead: 0.6 },                    // how much of each channel feeds the space
        initial: fxAmounts(a.S.sel)
      });
      IDS.forEach((id) => n[id].connect(mineFx.input(id)));
      const mine = {}, mineIds = {};
      inst = mine; ids = mineIds; fx = mineFx; lastFx = JSON.stringify(fxAmounts(a.S.sel));
      sync(a, n, mine, mineIds);
      n.dispose = () => { Object.keys(mine).forEach((k) => mine[k] && mine[k].dispose()); mineFx.dispose(); };   // the engine calls this on teardown
      return n;
    },

    trackTitle(S, a) {
      return "Pulse (test) \u00b7 " + a.lib.theory.KEY_NAMES[S.key] + " \u00b7 " + progName(S.prog);
    },

    onBar(a, t, bar) {
      const P = a.lib.parts, S = a.S, sel = S.sel, pt = P.PATTERNS;
      sync(a, a.nodes, inst, ids);
      syncFx(a);
      const prog = rec.progs[S.prog], chord = prog.chords[bar % prog.chords.length], key = S.key;
      const lead = P.melody({ rng: a.rng, key, scale: prog.scale, chord, lo: LEAD_LO + down(sel, "leadOctave"), hi: LEAD_HI + down(sel, "leadOctave"), rhythm: P.RHYTHMS[sel.leadRhythm].bars, bar, last: lastLead });
      lastLead = lead.last;                                      // keep the melody going even while the lead is muted
      ev = {
        kick:  P.drum({ rng: a.rng, pat: pt.kick.fourFloor.pat, bar }),
        snare: P.drum({ rng: a.rng, pat: pt.snare.backbeat.pat, bar }),
        hat:   P.drum({ rng: a.rng, pat: pt.hat.eighths.pat, bar }),
        bass:  P.bass({ key, chord, pat: pt.bass[sel.bassLine].pat, bar, lo: BASS_LO + down(sel, "bassOctave") }),
        arp:   P.arp({ key, chord, pat: pt.arp[sel.arpLine].pat, bar, lo: ARP_LO + down(sel, "arpOctave") }),
        lead:  lead.events
      };
    },

    onStep(a, s, t) {
      if (!ev) return;
      const P = a.lib.parts, sd = a.stepDur();
      if (!a.muted("kick")) P.at(ev.kick, s).forEach((e) => inst.kick.play(t, e.vel));
      if (!a.muted("perc")) {
        P.at(ev.snare, s).forEach((e) => inst.snare.play(t, e.vel));
        P.at(ev.hat, s).forEach((e) => inst.hat.play(t, e.vel, e.open));
      }
      if (!a.muted("bass")) P.at(ev.bass, s).forEach((e) => inst.bass.play(t, e.midi, e.len * sd, e.vel));
      if (!a.muted("arp"))  P.at(ev.arp,  s).forEach((e) => inst.arp.play(t, e.midi, e.len * sd, e.vel));
      if (!a.muted("lead")) P.at(ev.lead, s).forEach((e) => inst.lead.play(t, e.midi, e.len * sd, e.vel));
    },

    // Radio: step to the next progression, drift the tempo, and reroll the sounds.
    // (The engine has already picked a new random key for the track.)
    radio: {
      nextTrack(a) {
        const keys = Object.keys(rec.progs);
        a.S.prog = keys[(keys.indexOf(a.S.prog) + 1) % keys.length];
        a.S.bpm = a.clamp(a.S.bpm + (a.rng() < 0.5 ? -4 : 4), rec.bpm.min, rec.bpm.max);
        rec.selects.forEach((s) => {
          if (KEEP.indexOf(s.id) !== -1) return;
          const pool = (s.radio || s.options.map((o) => o[0])).filter((v) => v !== a.S.sel[s.id]);
          if (pool.length) a.S.sel[s.id] = pool[Math.floor(a.rng() * pool.length)];
        });
      }
    },

    reset() { ev = null; lastLead = null; }
  };
  return rec;
})()]);
