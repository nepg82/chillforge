#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Chillforge trace harness
//
// Runs index.html's <script> inside a Node sandbox with a mock Web Audio API,
// a seeded random generator, and a fake clock. Every audio-graph call the app
// makes (oscillators, gain envelopes, noise hits, parameter changes, lock-screen
// metadata) is written to a text "trace". Same code + same seed = same trace.
//
//   node trace.js record [index.html] [--force]   save the golden baseline
//   node trace.js check  [index.html]             compare against the baseline
//   node trace.js dump <scenario> [index.html]    print one trace to stdout
//   node trace.js list                            list scenarios
//
// The baseline (trace-golden.json) is recorded ONCE from the verified original.
// After that, every refactor step must pass `check` unchanged.
// The trace is taken at the Web Audio call level, not the function level, so it
// stays valid while functions are moved, renamed, or split into modules.
// ---------------------------------------------------------------------------
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), crypto = require("crypto");

const GOLDEN = path.join(__dirname, "trace-golden.json");
const LIBS = ["lib/theory.js"];            // shared toolbox files the real page loads before any record
const CORE = ["records/chillwave.js"];      // the production default style (the page's first record)
const CLASSIC = "chillwave-classic.js";     // frozen copy of Chillwave in test-records/: what the original-derived scenarios run against
const TICK = 0.05;                     // same as TICK_MS in the app
const MAX_TICKS = 60000;               // safety cap (3000 simulated seconds)

const num = (x) => (typeof x === "number" ? (isFinite(x) ? String(Number(x.toPrecision(9))) : String(x)) : String(x));
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const sha10 = (b) => crypto.createHash("sha1").update(b).digest("hex").slice(0, 10);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEYS = ["C", "C\u266f", "D", "E\u266d", "E", "F", "F\u266f", "G", "A\u266d", "A", "B\u266d", "B"];
// MIDI note numbers (as floats) of single-frequency oscillators feeding the given channel gain (Pulse's bass)
function bassMidis(text, gainId) {
  const out = [];
  for (const l of text.split("\n")) {
    const m = /^osc \S+ f\[v=([0-9.eE+-]+)\] .*-> (gain#\d+)$/.exec(l);
    if (m && m[2] === gainId) out.push(69 + 12 * Math.log2(parseFloat(m[1]) / 440));
  }
  return out;
}
// In one fixed key, Pulse's "Pump" bass must only play that key's four chord roots, whole semitones, in MIDI 40-51.
const pulseKeyCheck = (key) => (text) => {
  const P = [], ms = bassMidis(text, "gain#3");
  if (!ms.length) return ["no bass notes found in the trace"];
  const want = new Set([0, 8, 3, 10].map((r) => (key + r) % 12)), seen = new Set();
  ms.forEach((m) => {
    const r = Math.round(m), pc = ((r % 12) + 12) % 12;
    if (Math.abs(m - r) > 1e-6) P.push("bass note " + m.toFixed(4) + " is not a whole semitone");
    else if (!want.has(pc)) P.push("bass note " + KEYS[pc] + " is not a chord root in key " + KEYS[key]);
    else seen.add(pc);
    if (r < 40 || r > 51) P.push("bass note MIDI " + r + " is outside the 40-51 register window");
  });
  want.forEach((pc) => { if (!seen.has(pc)) P.push("chord root " + KEYS[pc] + " (key " + KEYS[key] + ") was never played"); });
  return Array.from(new Set(P)).slice(0, 4);
};
// Radio: the key in each track title must change every time (never the same twice in a row)
const radioKeyCheck = (text) => {
  const ks = [];
  text.split("\n").forEach((l) => { const m = /^media title="Pulse \(test\) \u00b7 ([^ ]+) \u00b7 /.exec(l); if (m) ks.push(m[1]); });
  const P = [];
  if (ks.length < 3) P.push("expected at least 3 radio tracks, saw " + ks.length);
  ks.forEach((k, i) => { if (KEYS.indexOf(k) === -1) P.push("unknown key name '" + k + "'"); if (i && ks[i - 1] === k) P.push("key repeated between track " + i + " and " + (i + 1) + ": " + k); });
  if (new Set(ks).size < 2) P.push("the key never changed");
  return P.slice(0, 4);
};

// ---------------------------------------------------------------------------
// Scenarios. Each one is a fresh page load with its own seed.
//   setup(h)    runs after load, before Start (UI actions go through the real handlers)
//   actions     timed UI actions while playing
//   duration    simulated seconds (or `until` = expression evaluated in the app, with `cap`)
// ---------------------------------------------------------------------------
const SCENARIOS = [
  { name: "default-seed1", seed: 1, duration: 96 },
  { name: "default-seed2", seed: 2, duration: 40 },
  ...["rising", "descending", "turnaround", "sway"].map((p) => ({
    name: "prog-" + p, seed: 11, duration: 30, setup: (h) => h.select("progSelect", p)
  })),
  { name: "shapes-saw-square", seed: 21, duration: 25,
    setup: (h) => { h.select("Pad sound", "sawtooth"); h.select("Melody sound", "square"); } },
  { name: "shapes-softtri", seed: 22, duration: 25,
    setup: (h) => { h.select("Pad sound", "softtri"); h.select("Melody sound", "softtri"); } },
  { name: "shapes-sine-tri", seed: 23, duration: 25,
    setup: (h) => { h.select("Pad sound", "sine"); h.select("Melody sound", "triangle"); } },
  { name: "ui-steppers", seed: 31, duration: 70, actions: [
    { at: 8,  name: "tempo up x3",    run: (h) => h.press("Tempo up", 3) },
    { at: 16, name: "tempo down x10", run: (h) => h.press("Tempo down", 10) },
    { at: 24, name: "volume down x3", run: (h) => h.press("Volume down", 3) },
    { at: 30, name: "drums to Off",   run: (h) => h.press("Drums down", 41) },
    { at: 42, name: "drums back up",  run: (h) => h.press("Drums up", 3) },
    { at: 50, name: "pad/melody",     run: (h) => { h.press("Pad down", 2); h.press("Melody up", 3); } }
  ] },
  { name: "yield", seed: 41, duration: 45, actions: [
    { at: 15, name: "system pauses silent el", run: (h) => { const a = h.eval("silentEl"); a.paused = true; a.dispatch("pause"); } },
    { at: 30, name: "silent el plays again",   run: (h) => { const a = h.eval("silentEl"); a.paused = false; a.dispatch("play"); } }
  ] },
  { name: "radio-full", seed: 51, setup: (h) => h.click("radioBtn"), until: "R.n >= 2 && R.bar >= 6", cap: 2400 },
  { name: "radio-join", seed: 61, until: "R.n >= 2 && R.bar >= 6", cap: 2400, actions: [
    { at: 20, name: "radio on mid-beat", run: (h) => h.click("radioBtn") }
  ] },
  { name: "radio-long", seed: 161, setup: (h) => h.click("radioBtn"), until: "R.n >= 3 && R.bar >= 4", cap: 2900 },
  { name: "radio-many-tracks", seed: 171, duration: 175, setup: (h) => h.click("radioBtn"),
    actions: Array.from({ length: 18 }, (_, i) => ({ at: 9 + i * 9, name: "next track " + (i + 1), run: (h) => h.click("nextBtn") })) },
  { name: "radio-bpm-ceiling", seed: 183, duration: 235, setup: (h) => h.click("radioBtn"),
    storage: { "chillforge-v3": JSON.stringify({ style: "chillwave", store: { chillwave: { bpm: 94 } } }) },
    actions: Array.from({ length: 24 }, (_, i) => ({ at: 9 + i * 9, name: "next track " + (i + 1), run: (h) => h.click("nextBtn") })) },
  { name: "radio-bpm-floor", seed: 183, duration: 235, setup: (h) => h.click("radioBtn"),
    storage: { "chillforge-v3": JSON.stringify({ style: "chillwave", store: { chillwave: { bpm: 56 } } }) },
    actions: Array.from({ length: 24 }, (_, i) => ({ at: 9 + i * 9, name: "next track " + (i + 1), run: (h) => h.click("nextBtn") })) },
  // ---- extra scenarios: styles added as separate files (no original to compare against) ----
  { name: "fixture-bare-minimum", seed: 201, duration: 30, fixtures: ["metronome.js"],
    setup: (h) => h.select("styleSelect", "metronome") },
  { name: "fixture-bare-radio", seed: 202, fixtures: ["metronome.js"], until: "R.n >= 2 && R.bar >= 3", cap: 2400,
    setup: (h) => { h.select("styleSelect", "metronome"); h.click("radioBtn"); } },
  { name: "pulse-basic", seed: 211, duration: 40, records: ["records/pulse.js"],
    setup: (h) => h.select("styleSelect", "pulse") },
  { name: "pulse-controls", seed: 212, duration: 60, records: ["records/pulse.js"],
    setup: (h) => h.select("styleSelect", "pulse"), actions: [
      { at: 8,  name: "tempo up x3",      run: (h) => h.press("Tempo up", 3) },
      { at: 16, name: "kick down x4",     run: (h) => h.press("Kick down", 4) },
      { at: 24, name: "bass up x2",       run: (h) => h.press("Bass up", 2) },
      { at: 32, name: "bass sawtooth",    run: (h) => h.select("Bass sound", "sawtooth") },
      { at: 42, name: "other progression", run: (h) => h.select("progSelect", "rise") }
    ] },
  { name: "pulse-switch-live", seed: 213, duration: 60, records: ["records/pulse.js"], actions: [
    { at: 15, name: "switch to Pulse while playing",     run: (h) => h.select("styleSelect", "pulse") },
    { at: 35, name: "switch back to Chillwave playing",  run: (h) => h.select("styleSelect", "chillwave") }
  ] },
  { name: "pulse-radio", seed: 214, until: "R.n >= 3 && R.bar >= 4", cap: 2900, records: ["records/pulse.js"], verify: radioKeyCheck,
    setup: (h) => { h.select("styleSelect", "pulse"); h.click("radioBtn"); } },
  { name: "pulse-saved", seed: 215, duration: 20, records: ["records/pulse.js"], storage: {
      "chillforge-v3": JSON.stringify({ style: "pulse", store: {
        pulse: { bpm: 100, key: 7, vol: { master: -12, kick: -3, bass: 2 }, sel: { bassShape: "square" }, prog: "rise" },
        chillwave: { bpm: 60 } } }) } },
  // ---- keys, proven on Pulse ----
  ...Array.from({ length: 12 }, (_, k) => ({ name: "pulse-key-" + k, seed: 300 + k, duration: 20, records: ["records/pulse.js"],
    storage: { "chillforge-v3": JSON.stringify({ style: "pulse", store: { pulse: { key: k } } }) }, verify: pulseKeyCheck(k) })),
  { name: "pulse-key-live", seed: 320, duration: 44, records: ["records/pulse.js"], setup: (h) => h.select("styleSelect", "pulse"), actions: [
    { at: 10, name: "key to F",  run: (h) => h.select("keySelect", "5") },
    { at: 20, name: "key to A",  run: (h) => h.select("keySelect", "9") },
    { at: 30, name: "key to E\u266d", run: (h) => h.select("keySelect", "3") } ] },
  { name: "pulse-key-bad-saved", seed: 321, duration: 12, records: ["records/pulse.js"],
    storage: { "chillforge-v3": JSON.stringify({ style: "pulse", store: { pulse: { key: 99 }, chillwave: { key: 5 } } }) } },
  { name: "pulse-key-bad-saved-2", seed: 322, duration: 12, records: ["records/pulse.js"],
    storage: { "chillforge-v3": JSON.stringify({ style: "pulse", store: { pulse: { key: "5" } } }) } },
  { name: "pulse-key-bad-saved-3", seed: 323, duration: 12, records: ["records/pulse.js"],
    storage: { "chillforge-v3": JSON.stringify({ style: "pulse", store: { pulse: { key: 3.5 } } }) } },
  { name: "pulse-radio-keys", seed: 324, until: "R.n >= 6 && R.bar >= 2", cap: 2900, records: ["records/pulse.js"], verify: radioKeyCheck,
    setup: (h) => { h.select("styleSelect", "pulse"); h.click("radioBtn"); } },
  { name: "pulse-key-saves", seed: 330, duration: 20, records: ["records/pulse.js"], checkSaved: true,
    setup: (h) => h.select("styleSelect", "pulse"), actions: [ { at: 6, name: "key to E", run: (h) => h.select("keySelect", "4") } ] },
  { name: "pulse-radio-leave", seed: 331, duration: 100, records: ["records/pulse.js"], checkSaved: true,
    setup: (h) => { h.select("styleSelect", "pulse"); h.click("radioBtn"); }, actions: [
      { at: 10, name: "next track", run: (h) => h.click("nextBtn") }, { at: 22, name: "next track", run: (h) => h.click("nextBtn") },
      { at: 34, name: "next track", run: (h) => h.click("nextBtn") }, { at: 60, name: "radio off", run: (h) => h.click("radioBtn") } ] },
  { name: "pulse-radio-many", seed: 332, duration: 400, records: ["records/pulse.js"], verify: (t) => radioKeyCheck(t).concat(
      (() => { const ks = new Set(); t.split("\n").forEach((l) => { const m = /^media title="Pulse \(test\) \u00b7 ([^ ]+) \u00b7 /.exec(l); if (m) ks.add(m[1]); }); return ks.size >= 9 ? [] : ["only " + ks.size + " different keys appeared in 40 tracks"]; })()),
    setup: (h) => { h.select("styleSelect", "pulse"); h.click("radioBtn"); },
    actions: Array.from({ length: 40 }, (_, i) => ({ at: 9 + i * 9, name: "next track " + (i + 1), run: (h) => h.click("nextBtn") })) },
  { name: "pulse-without-toolbox", seed: 2, duration: 40, records: ["records/pulse.js"], noLib: true, sameEventsAs: "default-seed2" },
  { name: "chillwave-with-pulse-loaded", seed: 1, duration: 96, records: ["records/pulse.js"], sameEventsAs: "default-seed1" },
  { name: "bad-records-skipped", seed: 2, duration: 40, fixtures: ["broken.js"], sameEventsAs: "default-seed2" },
  { name: "no-styles-loaded", seed: 1, noCore: true, expectLoadError: "no styles loaded" },
  // ---- production Chillwave vs the frozen classic copy (retire these when Chillwave is rebuilt) ----
  { name: "production-default",  seed: 1,  duration: 96, production: true, sameEventsAs: "default-seed1" },
  { name: "production-steppers", seed: 31, duration: 70, production: true, sameEventsAs: "ui-steppers",
    actions: [
      { at: 8,  name: "tempo up x3",    run: (h) => h.press("Tempo up", 3) },
      { at: 16, name: "tempo down x10", run: (h) => h.press("Tempo down", 10) },
      { at: 24, name: "volume down x3", run: (h) => h.press("Volume down", 3) },
      { at: 30, name: "drums to Off",   run: (h) => h.press("Drums down", 41) },
      { at: 42, name: "drums back up",  run: (h) => h.press("Drums up", 3) },
      { at: 50, name: "pad/melody",     run: (h) => { h.press("Pad down", 2); h.press("Melody up", 3); } } ] },
  { name: "production-radio",    seed: 51, production: true, setup: (h) => h.click("radioBtn"), until: "R.n >= 2 && R.bar >= 6", cap: 2400, sameEventsAs: "radio-full" },
  { name: "production-saved",    seed: 131, duration: 20, production: true, sameEventsAs: "saved-valid", storage: {
      "chillforge-v3": JSON.stringify({ style: "chillwave", store: { chillwave: {
        bpm: 70, vol: { master: -10, drums: -3, pad: 2, melody: -40 },
        sel: { padShape: "sawtooth", melodyShape: "softtri" }, prog: "descending" } } }) } },
  { name: "radio-skip", seed: 71, duration: 220, setup: (h) => h.click("radioBtn"), actions: [
    { at: 30,  name: "next track", run: (h) => h.click("nextBtn") },
    { at: 90,  name: "next track", run: (h) => h.click("nextBtn") },
    { at: 150, name: "next track", run: (h) => h.click("nextBtn") }
  ] },
  { name: "stop-start", seed: 91, duration: 110, actions: [].concat(...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => [
    { at: 10 + i * 12, name: "stop " + (i + 1),  run: (h) => h.click("playBtn") },
    { at: 12 + i * 12, name: "start " + (i + 1), run: (h) => h.click("playBtn") }
  ])) },
  { name: "style-switch", seed: 101, duration: 50, actions: [
    { at: 20, name: "re-select Chillwave while playing", run: (h) => h.select("styleSelect", "chillwave") }
  ] },
  { name: "radio-style-switch", seed: 111, duration: 100, setup: (h) => h.click("radioBtn"), actions: [
    { at: 40, name: "re-select Chillwave while radio plays", run: (h) => h.select("styleSelect", "chillwave") }
  ] },
  { name: "prog-change-live", seed: 121, duration: 40, actions: [
    { at: 12, name: "pick Two-Chord Sway while playing", run: (h) => h.select("progSelect", "sway") }
  ] },
  { name: "saved-valid", seed: 131, duration: 20, storage: {
      "chillforge-v3": JSON.stringify({ style: "chillwave", store: { chillwave: {
        bpm: 70, vol: { master: -10, drums: -3, pad: 2, melody: -40 },
        sel: { padShape: "sawtooth", melodyShape: "softtri" }, prog: "descending" } } }) } },
  { name: "saved-invalid", seed: 141, duration: 15, storage: {
      "chillforge-v3": JSON.stringify({ style: "nonesuch", store: { chillwave: {
        bpm: 500, vol: { master: "loud", drums: 99, pad: -999, melody: null },
        sel: { padShape: "wobble", melodyShape: "square" }, prog: "nope" } } }) } },
  { name: "saved-legacy", seed: 151, duration: 15, storage: {
      "chillforge-settings": JSON.stringify({ bpmSlider: 61, progSelect: "sway", masterVol: -12, drumsVol: 0,
        padVol: 3, melodyVol: -5, padShape: "square", melodyShape: "triangle" }) } },
  { name: "radio-leave", seed: 81, duration: 110, setup: (h) => h.click("radioBtn"), actions: [
    { at: 50, name: "radio off", run: (h) => h.click("radioBtn") }
  ] }
];

SCENARIOS.forEach((sc) => { if ((sc.records || []).some((r) => /pulse/.test(r))) sc.uiExtra = sc.uiExtra || ["keyGroup", "keySelect"]; });

// ---------------------------------------------------------------------------
// One scenario run
// ---------------------------------------------------------------------------
function runScenario(sc, html, appDir) {
  const m = /<script>([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error("no inline <script> found in the html file");
  const scriptText = m[1];

  const H = { timerQ: [], timerId: 0, inTick: false, events: [], nodes: [], edges: [], counts: {}, ctx: null, created: [], ids: {}, leaks: 0 };
  const emit = (s) => H.events.push(s);
  const problems = [];

  // ---- param + node mocks ---------------------------------------------------
  class Param {
    constructor(owner, name, v) { this.owner = owner; this.name = name; this._v = v; this.log = []; }
    get value() { return this._v; }
    set value(v) { this._chk(v); this._v = v; this._rec("v=" + num(v)); }
    _chk(v) { if (typeof v !== "number" || !isFinite(v)) throw new TypeError("non-finite value for " + this.owner.kind + "." + this.name + ": " + v); }
    _rec(s) {
      this.log.push(s);
      if (this.owner._id && this.owner._flushed)
        emit("param " + this.owner._id + "." + this.name + " " + s + " now=" + num(H.ctx.currentTime));
      return this;
    }
    setValueAtTime(v, t) { this._chk(v); this._chk(t); return this._rec("set(" + num(v) + "@" + num(t) + ")"); }
    linearRampToValueAtTime(v, t) { this._chk(v); this._chk(t); return this._rec("lin(" + num(v) + "@" + num(t) + ")"); }
    exponentialRampToValueAtTime(v, t) { this._chk(v); this._chk(t); return this._rec("exp(" + num(v) + "@" + num(t) + ")"); }
    setTargetAtTime(v, t, tc) { this._chk(v); this._chk(t); this._chk(tc); return this._rec("tgt(" + num(v) + "@" + num(t) + ",tc=" + num(tc) + ")"); }
  }

  class MNode {
    constructor(kind, forceId) {
      this.kind = kind; this._out = [];
      if (forceId) this._id = forceId;
      else if (!H.inTick) { H.counts[kind] = (H.counts[kind] || 0) + 1; this._id = kind + "#" + H.counts[kind]; }
      if (this._id) H.nodes.push(this);
    }
    connect(d) { this._out.push(d); if (this._id && d && d._id) H.edges.push(this._id + " -> " + d._id); return d; }
    disconnect() {}
    _params() { return []; }
    _info() { return ""; }
    _desc() { return this.kind; }
  }
  const pl = (p) => p.log.join(",");

  class MGain extends MNode {
    constructor() { super("gain"); this.gain = new Param(this, "gain", 1); }
    _params() { return [this.gain]; }
    _desc() { return "gain[" + pl(this.gain) + "]"; }
  }
  class MBiquad extends MNode {
    constructor() { super("biquad"); this.type = "lowpass"; this.frequency = new Param(this, "frequency", 350); this.Q = new Param(this, "Q", 1); }
    _params() { return [this.frequency, this.Q]; }
    _info() { return " type=" + this.type; }
  }
  class MComp extends MNode {
    constructor() { super("comp"); this.threshold = new Param(this, "threshold", -24); this.ratio = new Param(this, "ratio", 12); }
    _params() { return [this.threshold, this.ratio]; }
  }
  class MDelay extends MNode {
    constructor(max) { super("delay"); this.max = max; this.delayTime = new Param(this, "delayTime", 0); }
    _params() { return [this.delayTime]; }
    _info() { return " max=" + this.max; }
  }

  const chain = (n) => {
    let s = "", cur = n;
    for (let i = 0; i < 10; i++) {
      const o = cur._out;
      if (!o.length) { s += " -> (open)"; break; }
      if (o.length > 1) { s += " -> {" + o.map((x) => x._id || x.kind).join(",") + "}"; break; }
      const nx = o[0];
      if (nx._id) { s += " -> " + nx._id; break; }
      s += " -> " + nx._desc(); cur = nx;
    }
    return s;
  };
  const waveHash = (w) => sha10(w.imag.map(num).join(","));
  const bufHash = (b) => { if (!b._h) b._h = sha10(Buffer.from(b._d[0].buffer, b._d[0].byteOffset, b._d[0].byteLength)); return b._h; };

  class MOsc extends MNode {
    constructor() {
      super("osc"); this.type = "sine"; this._wave = null;
      this.frequency = new Param(this, "frequency", 440); this.detune = new Param(this, "detune", 0);
    }
    setPeriodicWave(w) { this._wave = w; this.type = "custom"; }
    start(t) { this._start = t; H.events.push(this); }
    stop(t) { this._stop = t; }
    _fmt() {
      return "osc " + (this._wave ? "wave:" + waveHash(this._wave) : this.type) +
        " f[" + pl(this.frequency) + "] d[" + pl(this.detune) + "] @" + num(this._start) + ".." +
        (this._stop === undefined ? "?" : num(this._stop)) + chain(this);
    }
  }
  class MSrc extends MNode {
    constructor() { super("src"); this.buffer = null; }
    start(t, off) { this._start = t; this._off = off; H.events.push(this); }
    stop(t) { this._stop = t; }
    _fmt() {
      return "src buf:" + (this.buffer ? bufHash(this.buffer) : "none") + " off=" + num(this._off) + " @" + num(this._start) + ".." +
        (this._stop === undefined ? "?" : num(this._stop)) + chain(this);
    }
  }

  class MCtx {
    constructor(opts) {
      this.opts = opts; this.currentTime = 0; this.sampleRate = 44100; this.state = "running";
      this.baseLatency = 0.01; this.outputLatency = 0.02; this.onstatechange = null;
      this.destination = new MNode("dest", "dest");
      H.ctx = this;
    }
    resume() { return Promise.resolve(); }
    createGain() { return new MGain(); }
    createOscillator() { return new MOsc(); }
    createBiquadFilter() { return new MBiquad(); }
    createDynamicsCompressor() { return new MComp(); }
    createDelay(max) { return new MDelay(max); }
    createBufferSource() { return new MSrc(); }
    createBuffer(ch, len, rate) {
      return { numberOfChannels: ch, length: len, sampleRate: rate,
        _d: Array.from({ length: ch }, () => new Float32Array(len)), getChannelData(c) { return this._d[c]; } };
    }
    createPeriodicWave(real, imag) { return { real: Array.from(real), imag: Array.from(imag) }; }
  }

  // ---- DOM / browser mocks --------------------------------------------------
  class FakeEl {
    constructor(tag) {
      this.tag = tag; this.children = []; this.attrs = {}; this.listeners = {};
      this._text = ""; this.className = ""; this.hidden = false; this.value = ""; this.disabled = false; this.style = {};
      const self = this, toks = () => self.className.split(/\s+/).filter(Boolean);
      this.classList = {
        add(n) { const t = toks(); if (t.indexOf(n) < 0) t.push(n); self.className = t.join(" "); },
        remove(n) { self.className = toks().filter((x) => x !== n).join(" "); },
        toggle(n, force) {
          const has = toks().indexOf(n) >= 0, want = force === undefined ? !has : !!force;
          if (want && !has) this.add(n); if (!want && has) this.remove(n); return want;
        }
      };
    }
    get textContent() { return this._text; }
    set textContent(v) { this._text = String(v); this.children = []; }
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
    dispatch(t, e) {
      (this.listeners[t] || []).slice().forEach((f) =>
        f(Object.assign({ type: t, detail: 1, button: 0, preventDefault() {} }, e)));
    }
    setAttribute(k, v) { this.attrs[k] = v; }
    appendChild(c) { this.children.push(c); return c; }
    append() { for (const c of arguments) this.children.push(c); }
  }
  class FakeAudio extends FakeEl {
    constructor(src) { super("audio"); this.src = src; this.loop = false; this.paused = true; }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const winL = {};
  const docL = new FakeEl("document");
  const document = {
    hidden: false, visibilityState: "visible",
    getElementById(id) { return H.ids[id] || (H.ids[id] = new FakeEl("#" + id)); },
    createElement(tag) { const e = new FakeEl(tag); H.created.push(e); return e; },
    addEventListener: (t, f) => docL.addEventListener(t, f)
  };

  let md = null;
  const mediaSession = {
    get metadata() { return md; },
    set metadata(v) { md = v; emit("media title=" + JSON.stringify(v.title) + " artist=" + JSON.stringify(v.artist)); },
    set playbackState(v) { emit("playback " + v); },
    setActionHandler(name, f) { emit("mediaAction " + name + " " + (f ? "set" : "cleared")); }
  };

  const store = Object.assign({}, sc.storage || {});
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    // app timers run on the simulated audio clock (a real page would fire them in real time)
    setTimeout: (f, ms) => { const id = ++H.timerId; H.timerQ.push({ id, f, due: (H.ctx ? H.ctx.currentTime : 0) + (ms || 0) / 1000 }); return id; },
    clearTimeout: (id) => { H.timerQ = H.timerQ.filter((x) => x.id !== id); }, setInterval: () => 0, clearInterval() {},
    Worker: class { postMessage() {} },
    Blob: class {}, URL: { createObjectURL: () => "blob:fake" },
    Audio: FakeAudio, AudioContext: MCtx, MediaMetadata: class { constructor(i) { Object.assign(this, i); } },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    navigator: { mediaSession }, performance: {}, document,
    addEventListener: (t, f) => { (winL[t] = winL[t] || []).push(f); },
    __leak: () => { H.leaks++; }
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  // Record files run in their OWN context, which has no engine globals. A record that reaches into the engine
  // (instead of using the `a` it is handed) fails here with a ReferenceError, even though it would "work" on a real page.
  const recContext = vm.createContext({ window: sandbox, __leak: () => { H.leaks++; } });
  vm.runInContext("Math.random = function () { __leak(); return 0.5; };", recContext);

  // Seed Math.random before the page loads, so the original (pre-rng) file and the new one see the same sequence.
  sandbox.__seeded = mulberry32(sc.seed);
  vm.runInContext("Math.random = __seeded;", context);
  const tags = Array.from(html.matchAll(/<script src="([^"]+)"><\/script>/g)).map((m) => m[1]);
  if (!sc.noLib) tags.filter((f) => LIBS.indexOf(f) !== -1).forEach((f) => vm.runInContext(fs.readFileSync(path.join(appDir, f), "utf8"), recContext, { filename: f }));
  if (!sc.noCore) {
    if (sc.production) tags.filter((f) => CORE.indexOf(f) !== -1).forEach((f) => vm.runInContext(fs.readFileSync(path.join(appDir, f), "utf8"), recContext, { filename: f }));
    else vm.runInContext(fs.readFileSync(path.join(__dirname, "test-records", CLASSIC), "utf8"), recContext, { filename: CLASSIC });
  }
  (sc.records || []).forEach((f) => vm.runInContext(fs.readFileSync(path.join(appDir, f), "utf8"), recContext, { filename: f }));
  (sc.fixtures || []).forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "test-records", f), "utf8"), recContext, { filename: f }));
  let loadErr = null;
  try { vm.runInContext(scriptText, context, { filename: "index.html" }); }
  catch (e) { if (!sc.expectLoadError) throw e; loadErr = e; }
  const hasRNG = vm.runInContext("typeof RNG", context) === "function";
  if (hasRNG) vm.runInContext("Math.random = function () { __leak(); return 0.5; };", context);  // catch any direct Math.random() call

  let flushedN = 0, flushedE = 0;
  const flushGraph = () => {
    for (; flushedN < H.nodes.length; flushedN++) {
      const n = H.nodes[flushedN];
      emit("graph " + n._id + n._info() + n._params().map((p) => " " + p.name + "[" + pl(p) + "]").join(""));
      n._flushed = true;
    }
    for (; flushedE < H.edges.length; flushedE++) emit("edge " + H.edges[flushedE]);
  };

  // ---- snapshots of what's on screen and of the style data / tuning constants ----
  const UI_IDS = ["playBtn", "radioBtn", "nextBtn", "radioInfo", "styleSelect", "progGroup", "progSelect", "controls", "ver", "dbg"];
  const ser = (e, d) => {
    const cls = e.className.split(/\s+/).filter(Boolean);
    const at = Object.keys(e.attrs).sort().map((k) => " " + k + "=" + JSON.stringify(e.attrs[k])).join("");
    const line = "  ".repeat(d) + e.tag + (cls.length ? "." + cls.join(".") : "") + at +
      (e.textContent !== "" ? " text=" + JSON.stringify(e.textContent) : "") +
      (e.value !== "" ? " value=" + JSON.stringify(e.value) : "") + (e.hidden ? " hidden" : "") + (e.disabled ? " disabled" : "");
    return [line].concat(...e.children.map((c) => ser(c, d + 1)));
  };
  const uiSnapshot = () => [].concat(...UI_IDS.concat(sc.uiExtra || []).map((id) => ser(document.getElementById(id), 0)));
  const DATA_EXPR = "JSON.stringify({ styles: Object.keys(STYLES).map(function (k) { var s = STYLES[k], o = { key: k }; " +
    "['label','bpm','swing','jitter','lead','drums','cutoffMul','padCutoff','reverb','echo','channels','selects','keyed','keyDef'].forEach(function (f) { o[f] = s[f]; }); " +
    "o.progs = !s.progs ? [] : Array.isArray(s.progs) ? s.progs : Object.keys(s.progs); return o; }), " +
    "progressions: typeof PROGRESSIONS !== 'undefined' ? PROGRESSIONS : (function () { var o = {}; Object.keys(STYLES).forEach(function (k) { " +
    "var p = STYLES[k].progs; if (p && !Array.isArray(p)) Object.keys(p).forEach(function (n) { o[n] = p[n]; }); }); return o; })(), " +
    "consts: { CUTOFF: CUTOFF, MELODY_DENSITY: (typeof MELODY_DENSITY !== 'undefined' ? MELODY_DENSITY : STYLES[Object.keys(STYLES)[0]].melodyDensity), SHAPE_LEVEL: SHAPE_LEVEL, LOOKAHEAD: LOOKAHEAD, TICK_MS: TICK_MS, " +
    "VOL_MIN: VOL_MIN, MASTER: MASTER, SAVE_KEY: SAVE_KEY, RADIO_SEC: RADIO_SEC, RADIO_STEP_CHOICES: RADIO_STEP_CHOICES, " +
    "YIELD_GRACE_MS: YIELD_GRACE_MS, OVERTONE_MIX: OVERTONE_MIX } })";
  const dataLines = () => {
    const d = JSON.parse(vm.runInContext(DATA_EXPR, context)), L = [];
    d.styles.forEach((st) => L.push("style " + JSON.stringify(st)));
    Object.keys(d.progressions || {}).forEach((k) => L.push("prog " + k + " " + JSON.stringify(d.progressions[k])));
    Object.keys(d.consts).forEach((k) => L.push("const " + k + " " + JSON.stringify(d.consts[k])));
    return L;
  };

  // ---- helpers for scripted UI ---------------------------------------------
  const byLabel = (label) => {
    for (let i = H.created.length - 1; i >= 0; i--) if (H.created[i].attrs["aria-label"] === label) return H.created[i];
    throw new Error("no element with aria-label '" + label + "'");
  };
  const h = {
    eval: (code) => vm.runInContext(code, context),
    click: (id) => document.getElementById(id).dispatch("click", { detail: 1 }),
    press(label, n) {
      for (let i = 0; i < (n || 1); i++) {
        byLabel(label).dispatch("pointerdown", { button: 0 });
        (winL.pointerup || []).forEach((f) => f({}));
      }
    },
    select(target, value) {
      const el = H.ids[target] || byLabel(target);
      el.value = value; el.dispatch("change", { target: el });
    }
  };

  if (sc.expectLoadError) {
    if (!loadErr || String(loadErr.message).indexOf(sc.expectLoadError) < 0) problems.push("expected a load error containing '" + sc.expectLoadError + "'");
    return { text: "# scenario " + sc.name + "\nLOADERROR " + (loadErr ? loadErr.message : "none") + "\nUI\n" + uiSnapshot().join("\n") + "\n", problems };
  }
  const uiLoad = uiSnapshot(), dataAtLoad = dataLines();
  emit("== loaded");
  if (sc.setup) { sc.setup(h); flushGraph(); }

  // ---- start (through the real button handler) ------------------------------
  h.click("playBtn");
  flushGraph();
  emit("== started");

  // ---- run -----------------------------------------------------------------
  const tickScript = new vm.Script("tick()");
  const untilScript = sc.until ? new vm.Script(sc.until) : null;
  const planScript = new vm.Script('R.on ? JSON.stringify({ n: R.n, ib: R.ib, gap: R.gapBar, introBars: R.introBars, intro: R.intro, out: R.out }) : ""');
  let lastPlan = "";
  const acts = (sc.actions || []).slice().sort((a, b) => a.at - b.at);
  let ai = 0, k = 0;
  const fireTimers = (t) => {
    for (;;) {
      const due = H.timerQ.filter((x) => x.due <= t).sort((a, b) => a.due - b.due || a.id - b.id)[0];
      if (!due) break;
      H.timerQ = H.timerQ.filter((x) => x !== due);
      try { due.f(); } catch (e) { problems.push("a timer callback threw: " + (e && e.message)); }
    }
  };
  for (;; k++) {
    const t = k * TICK;
    H.ctx.currentTime = t;
    fireTimers(t);
    while (ai < acts.length && acts[ai].at <= t) { emit("== action: " + acts[ai].name); acts[ai++].run(h); flushGraph(); }
    H.inTick = true;
    try { tickScript.runInContext(context); } finally { H.inTick = false; }
    const plan = planScript.runInContext(context);
    if (plan !== lastPlan) { lastPlan = plan; if (plan) emit("radioplan " + plan); }
    if (untilScript) {
      if (untilScript.runInContext(context)) break;
      if (t >= (sc.cap || 2400)) { problems.push("'until' never became true within cap"); break; }
    } else if (t >= sc.duration) break;
    if (k >= MAX_TICKS) { problems.push("tick cap reached"); break; }
  }

  const state = h.eval("JSON.stringify({ step: step, chordIdx: (typeof barIdx !== 'undefined' ? barIdx : chordIdx), bpm: S.bpm, prog: S.prog, sel: S.sel, vol: S.vol, " +
    "radio: R.on ? { n: R.n, bar: R.bar, phase: R.phase } : null, nextTime: Math.round(nextTime * 1e6) / 1e6, " +
    "playing: playing, yielded: yielded, key: S.key })");
  const appErrs = Array.from(h.eval("LOG.filter(function (l) { return l.indexOf('ERR') >= 0; })"));
  appErrs.forEach((l) => problems.push("app logged: " + l.slice(15)));
  if (H.leaks) problems.push(H.leaks + " direct Math.random() call(s) bypassed rng()");

  const out = ["# scenario " + sc.name + " seed=" + sc.seed + " ticks=" + (k + 1),
    "# AudioContext opts " + JSON.stringify(H.ctx.opts), "UI-LOAD"]
    .concat(uiLoad, ["DATA"], dataAtLoad, ["EVENTS"],
      H.events.map((ev) => (typeof ev === "string" ? ev : ev._fmt())), ["UI-END"], uiSnapshot(), ["STATE " + state],
      Array.from(h.eval("LOG.filter(function (l) { return l.indexOf(\"skipped\") >= 0; })")).map((l) => "LOG " + l.slice(15)),
      sc.checkSaved ? (() => { const raw = store["chillforge-v3"]; return ["SAVED " + (raw ? JSON.stringify(JSON.parse(raw)) : "nothing")]; })() : []);
  const finalText = out.join("\n") + "\n";
  if (sc.verify) sc.verify(finalText).forEach((p) => problems.push(p));
  return { text: finalText, problems };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Unit tests for the shared toolbox (lib/theory.js), run in a clean context
// ---------------------------------------------------------------------------
function unitTests(appDir) {
  const f = path.join(appDir, "lib", "theory.js");
  if (!fs.existsSync(f)) return [];
  const ctx = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: "lib/theory.js" });
  const T = ctx.window.CHILLFORGE_LIB && ctx.window.CHILLFORGE_LIB.theory;
  const out = [];
  const test = (name, fn) => {
    let bad = [], n = 0;
    const eq = (cond, msg) => { n++; if (!cond && bad.length < 3) bad.push(msg); else if (!cond) bad.push(null); };
    try { fn(eq); } catch (e) { bad.push("threw: " + e.message); }
    out.push({ name, n, bad: bad.filter(Boolean), nbad: bad.length });
  };
  const mod12 = (n) => ((n % 12) + 12) % 12;
  const J = (a) => JSON.stringify(Array.from(a));
  test("registers itself as CHILLFORGE_LIB.theory", (eq) => { eq(!!T, "lib/theory.js did not register window.CHILLFORGE_LIB.theory"); });
  if (!T) return out;

  test("KEY_NAMES: 12 distinct names", (eq) => { eq(T.KEY_NAMES.length === 12, "length " + T.KEY_NAMES.length); eq(new Set(T.KEY_NAMES).size === 12, "duplicate names"); eq(T.KEY_NAMES[0] === "C" && T.KEY_NAMES[9] === "A", "C should be 0 and A should be 9"); });
  test("mtof: A4 = 440, octaves double, semitone ratio", (eq) => {
    eq(T.mtof(69) === 440, "mtof(69) = " + T.mtof(69));
    for (let m = 24; m < 100; m++) { eq(Math.abs(T.mtof(m + 12) / T.mtof(m) - 2) < 1e-12, "octave at " + m); eq(Math.abs(T.mtof(m + 1) / T.mtof(m) - Math.pow(2, 1 / 12)) < 1e-12, "semitone at " + m); }
  });
  test("fold: lowest note >= lo with the right pitch class", (eq) => {
    for (let lo = -5; lo <= 90; lo++) for (let pc = -30; pc <= 40; pc++) {
      const v = T.fold(pc, lo);
      eq(v >= lo && v <= lo + 11, "fold(" + pc + "," + lo + ") = " + v + " outside [lo, lo+11]");
      eq(mod12(v - pc) === 0, "fold(" + pc + "," + lo + ") = " + v + " has the wrong pitch class");
    }
  });
  test("SCALES: 7 distinct ascending offsets from 0", (eq) => {
    Object.keys(T.SCALES).forEach((k) => { const a = T.SCALES[k]; eq(a.length === 7 && a[0] === 0 && a.every((v, i) => i === 0 || v > a[i - 1]) && a[6] <= 11, k + " = " + J(a)); });
  });
  test("CHORD_TYPES: start at the root, strictly ascending", (eq) => {
    Object.keys(T.CHORD_TYPES).forEach((k) => { const a = T.CHORD_TYPES[k]; eq(a[0] === 0 && a.every((v, i) => i === 0 || v > a[i - 1]), k + " = " + J(a)); });
  });
  test("chordMidi: root pitch class, register window and intervals (every key x type x root x register)", (eq) => {
    for (let key = 0; key < 12; key++) for (const t of Object.keys(T.CHORD_TYPES)) for (let r = 0; r < 12; r++) for (const lo of [28, 40, 48, 55, 60]) {
      const ch = T.chordMidi(key, { r, t }, lo), id = "key " + key + " " + t + " r" + r + " lo" + lo;
      eq(ch[0] >= lo && ch[0] <= lo + 11, id + ": root " + ch[0] + " outside the window");
      eq(mod12(ch[0] - (key + r)) === 0, id + ": root " + ch[0] + " is the wrong pitch class");
      eq(J(ch.map((m) => m - ch[0])) === J(T.CHORD_TYPES[t]), id + ": intervals " + J(ch.map((m) => m - ch[0])));
    }
  });
  test("chordPcs agrees with chordMidi", (eq) => {
    for (let key = 0; key < 12; key++) for (const t of Object.keys(T.CHORD_TYPES)) for (let r = 0; r < 12; r++) {
      const a = T.chordPcs(key, { r, t }), b = T.chordMidi(key, { r, t }, 48).map(mod12);
      eq(J(a) === J(b), "key " + key + " " + t + " r" + r + ": " + J(a) + " vs " + J(b));
    }
  });
  test("scaleMidi: only scale notes, 7 per octave, bounds inclusive", (eq) => {
    for (const sc of Object.keys(T.SCALES)) for (let key = 0; key < 12; key++) for (let lo = 36; lo < 60; lo++) {
      const w = T.scaleMidi(key, sc, lo, lo + 11), id = sc + " key " + key + " from " + lo;
      eq(w.length === 7, id + ": " + w.length + " notes in a 12-semitone window");
      eq(w.every((m) => T.SCALES[sc].indexOf(mod12(m - key)) !== -1), id + ": has a note outside the scale");
      const inScale = (m) => T.SCALES[sc].indexOf(mod12(m - key)) !== -1;
      eq(w.includes(lo) === inScale(lo) && w.includes(lo + 11) === inScale(lo + 11), id + ": bounds not inclusive");
    }
    eq(T.scaleMidi(0, "major", 60, 59).length === 0, "lo > hi should be empty");
  });
  test("errors: unknown chord type / scale name the culprit", (eq) => {
    let m1 = "", m2 = "";
    try { T.chordMidi(0, { r: 0, t: "nope" }, 40); } catch (e) { m1 = e.message; }
    try { T.scaleMidi(0, "nope", 40, 60); } catch (e) { m2 = e.message; }
    eq(m1.indexOf("nope") !== -1 && m1.indexOf("chord") !== -1, "chord error: '" + m1 + "'");
    eq(m2.indexOf("nope") !== -1 && m2.indexOf("scale") !== -1, "scale error: '" + m2 + "'");
    for (const k of ["toString", "constructor", "__proto__"]) { let m = ""; try { T.chordMidi(0, { r: 0, t: k }, 40); } catch (e) { m = e.message; } eq(m.indexOf(k) !== -1, "inherited name '" + k + "' must be rejected, got '" + m + "'"); }
  });
  test("reference tables match music theory (catches a typo in the data itself)", (eq) => {
    const chords = { maj: [0, 4, 7], min: [0, 3, 7], sus2: [0, 2, 7], sus4: [0, 5, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], add9: [0, 4, 7, 14], maj9: [0, 4, 7, 11, 14], min9: [0, 3, 7, 10, 14] };
    const scales = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10] };
    eq(J(Object.keys(T.CHORD_TYPES).sort()) === J(Object.keys(chords).sort()), "chord type names changed: " + J(Object.keys(T.CHORD_TYPES)));
    Object.keys(chords).forEach((k) => eq(J(T.CHORD_TYPES[k] || []) === J(chords[k]), k + " is " + J(T.CHORD_TYPES[k] || []) + ", expected " + J(chords[k])));
    eq(J(Object.keys(T.SCALES).sort()) === J(Object.keys(scales).sort()), "scale names changed: " + J(Object.keys(T.SCALES)));
    Object.keys(scales).forEach((k) => eq(J(T.SCALES[k] || []) === J(scales[k]), k + " is " + J(T.SCALES[k] || []) + ", expected " + J(scales[k])));
    eq(J(T.KEY_NAMES) === J(["C", "C\u266f", "D", "E\u266d", "E", "F", "F\u266f", "G", "A\u266d", "A", "B\u266d", "B"]), "KEY_NAMES changed: " + J(T.KEY_NAMES));
  });
  test("frozen: nothing can be mutated", (eq) => {
    eq(Object.isFrozen(T) && Object.isFrozen(T.SCALES) && Object.isFrozen(T.CHORD_TYPES) && Object.isFrozen(T.KEY_NAMES), "top-level objects not frozen");
    eq(Object.keys(T.CHORD_TYPES).every((k) => Object.isFrozen(T.CHORD_TYPES[k])) && Object.keys(T.SCALES).every((k) => Object.isFrozen(T.SCALES[k])), "interval arrays not frozen");
  });
  return out;
}

const isExtra = (sc) => !!(sc.records || sc.fixtures || sc.noCore || sc.production);      // scenarios with no equivalent in the original app

function runAll(file, only) {
  const html = fs.readFileSync(file, "utf8"), appDir = path.dirname(path.resolve(file));
  const res = {};
  SCENARIOS.forEach((sc) => {
    if (only && !only(sc)) return;
    try { res[sc.name] = runScenario(sc, html, appDir); }
    catch (e) { res[sc.name] = { text: "", problems: ["crashed: " + (e && e.message)] }; }
  });
  return res;
}

function firstDiff(a, b) {
  const A = a.split("\n"), B = b.split("\n");
  let i = 0;
  while (i < A.length && i < B.length && A[i] === B[i]) i++;
  let marker = "";
  for (let j = Math.min(i, A.length - 1); j >= 0; j--) if (/^(== |UI-LOAD|DATA|EVENTS|UI-END|STATE)/.test(A[j])) { marker = A[j]; break; }
  const show = (L) => L.slice(Math.max(0, i - 2), i + 3).map((x, n) => "      " + (Math.max(0, i - 2) + n + 1) + ": " + x.slice(0, 200)).join("\n");
  return "    first difference at line " + (i + 1) + " (after \"" + marker + "\")\n    expected:\n" + show(A) + "\n    actual:\n" + show(B);
}

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const force = process.argv.includes("--force");
const cmd = args[0] || "check";

if (cmd === "unit") {
  const r = unitTests(path.dirname(path.resolve(args[1] || "index.html")));
  r.forEach((u) => console.log((u.nbad ? "FAIL" : "PASS") + " " + u.name + " (" + u.n + " checks)" + (u.nbad ? " " + u.bad.join("; ") : "")));
  process.exit(r.some((u) => u.nbad) ? 1 : 0);
} else if (cmd === "list") {
  SCENARIOS.forEach((s) => console.log(s.name));
} else if (cmd === "dump") {
  const sc = SCENARIOS.find((s) => s.name === args[1]);
  if (!sc) { console.error("unknown scenario"); process.exit(2); }
  const f = args[2] || "index.html";
  process.stdout.write(runScenario(sc, fs.readFileSync(f, "utf8"), path.dirname(path.resolve(f))).text);
} else if (cmd === "record") {
  const file = args[1] || "index.html";
  if (fs.existsSync(GOLDEN) && !force) { console.error("trace-golden.json already exists. The baseline is meant to be recorded once; use --force to overwrite."); process.exit(2); }
  const res = runAll(file, (sc) => !isExtra(sc)), g = { source: path.basename(file), scenarios: {} };
  let bad = 0;
  Object.keys(res).forEach((n) => {
    const r = res[n];
    if (r.problems.length) { bad++; console.log("PROBLEM " + n + ": " + r.problems.join("; ")); }
    g.scenarios[n] = { sha256: sha256(r.text), lines: r.text.split("\n").length - 1, text: r.text, origin: "original" };
    console.log("recorded " + n + "  (" + g.scenarios[n].lines + " lines)");
  });
  if (bad) { console.error("not saved: scenario problems"); process.exit(1); }
  fs.writeFileSync(GOLDEN, JSON.stringify(g));
  console.log("saved " + path.basename(GOLDEN));
} else if (cmd === "record-extra") {
  const file = args[1] || "index.html";
  if (!fs.existsSync(GOLDEN)) { console.error("no trace-golden.json; run `record` first"); process.exit(2); }
  const g = JSON.parse(fs.readFileSync(GOLDEN, "utf8")), res = runAll(file, isExtra);
  let bad = 0;
  Object.keys(res).forEach((n) => {
    const r = res[n];
    if (r.problems.length) { bad++; console.log("PROBLEM " + n + ": " + r.problems.join("; ")); return; }
    g.scenarios[n] = { sha256: sha256(r.text), lines: r.text.split("\n").length - 1, text: r.text, origin: path.basename(file) + " (new feature, not from the original)" };
    console.log("recorded " + n + "  (" + g.scenarios[n].lines + " lines)");
  });
  if (bad) { console.error("not saved: scenario problems"); process.exit(1); }
  fs.writeFileSync(GOLDEN, JSON.stringify(g));
  console.log("saved " + path.basename(GOLDEN));
} else if (cmd === "check") {
  const file = args[1] || "index.html";
  if (!fs.existsSync(GOLDEN)) { console.error("no trace-golden.json; run `record` first"); process.exit(2); }
  const g = JSON.parse(fs.readFileSync(GOLDEN, "utf8"));
  const baselineOnly = process.argv.includes("--baseline");
  const res = runAll(file, baselineOnly ? (sc) => !isExtra(sc) : null);
  let fail = 0;
  Object.keys(g.scenarios).forEach((n) => {
    if (baselineOnly && !res[n]) return;
    const r = res[n];
    if (!r) { fail++; console.log("FAIL " + n + "  (scenario missing from harness)"); return; }
    const same = sha256(r.text) === g.scenarios[n].sha256;
    if (same && !r.problems.length) { console.log("PASS " + n + "  (" + g.scenarios[n].lines + " lines)"); return; }
    fail++;
    console.log("FAIL " + n);
    r.problems.forEach((p) => console.log("    problem: " + p));
    if (!same) console.log(firstDiff(g.scenarios[n].text, r.text));
  });
  if (!baselineOnly) unitTests(path.dirname(path.resolve(file))).forEach((u) => {
    const bad = u.nbad > 0; if (bad) fail++;
    console.log((bad ? "FAIL" : "PASS") + " unit: theory - " + u.name + (bad ? "  (" + u.nbad + " of " + u.n + " checks failed: " + u.bad.join("; ") + ")" : "  (" + u.n + " checks)"));
  });
  // Lint: the page must load the core record first, every script file must exist, and the service worker must precache it.
  if (!baselineOnly) {
    const html = fs.readFileSync(file, "utf8"), dir = path.dirname(path.resolve(file));
    const tags = Array.from(html.matchAll(/<script src="([^"]+)"><\/script>/g)).map((m) => m[1]);
    if (tags.length) {
      const probs = [];
      const expect = LIBS.concat(CORE);
      if (tags.slice(0, expect.length).join(",") !== expect.join(",")) probs.push("the first <script src> tags are [" + tags.slice(0, expect.length).join(", ") + "], expected [" + expect.join(", ") + "] (toolbox first; then the default style, because the first record is the default)");
      tags.forEach((t) => { if (!fs.existsSync(path.join(dir, t))) probs.push("'" + t + "' does not exist"); });
      const swp = path.join(dir, "service-worker.js");
      const sw = fs.existsSync(swp) ? fs.readFileSync(swp, "utf8") : "";
      expect.forEach((c) => { if (sw.indexOf('"./' + c + '"') === -1) probs.push("service-worker.js APP_SHELL does not list ./" + c); });
      if (probs.length) fail++;
      console.log((probs.length ? "FAIL" : "PASS") + " lint: index.html wiring" + (probs.length ? ": " + probs.join("; ") : " (toolbox then default style first, all script files exist, service worker precaches them)"));
    }
  }
  // Lint: record files share one global scope with the engine, so they must not declare top-level names.
  if (!baselineOnly) {
    const appd = path.dirname(path.resolve(file));
    const dirs = [path.join(appd, "records"), path.join(appd, "lib"), path.join(__dirname, "test-records")];
    dirs.forEach((d) => fs.existsSync(d) && fs.readdirSync(d).filter((f) => f.endsWith(".js")).forEach((f) => {
      const bad = fs.readFileSync(path.join(d, f), "utf8").split("\n").map((l, i) => [i + 1, l])
        .filter(([, l]) => /^(const|let|var|function|class|async\s+function)\b/.test(l));
      if (bad.length) fail++;
      console.log((bad.length ? "FAIL" : "PASS") + " lint: " + path.basename(d) + "/" + f + (bad.length ? " has top-level declarations at line(s) " + bad.map((b) => b[0]).join(", ") : " has no top-level declarations"));
    }));
  }
  const events = (t) => (t.split("\nEVENTS\n")[1] || "").split("\nUI-END\n")[0];
  if (!baselineOnly) SCENARIOS.filter((sc) => sc.sameEventsAs).forEach((sc) => {
    const a = res[sc.name], b = res[sc.sameEventsAs];
    const ok = a && b && a.text && events(a.text) === events(b.text);
    if (!ok) fail++;
    console.log((ok ? "PASS" : "FAIL") + " property: " + sc.name + " audio events identical to " + sc.sameEventsAs);
  });
  const n = baselineOnly ? Object.keys(g.scenarios).filter((k) => res[k]).length : Object.keys(g.scenarios).length;
  console.log(fail ? "\n" + fail + " check(s) FAILED" : "\nAll " + n + " scenarios match the baseline" + (baselineOnly ? " (original-derived ones only)." : " (plus property checks)."));
  process.exit(fail ? 1 : 0);
} else {
  console.error("usage: node trace.js record|check|dump|list [index.html] [--force]");
  process.exit(2);
}
