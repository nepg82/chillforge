/* ============================================================================
   CHILLFORGE TOOLBOX: FX                                              (lib/fx.js)

   "Character": the things that turn a dry, static, mono keyboard sound into
   something with width, space, warmth and movement. All of it is built ONCE per
   graph (persistent nodes), so unlike adding notes or oscillators it costs
   almost nothing on a phone.

   Records reach it as  a.lib.fx.

   WHAT IT BUILDS (per channel strip, then one shared tail)
     channel gain -> input -> pan ------------------------------> mix
                          \-> send -> SPACE (4 damped combs, spread left/right) -> mix
     mix -> dry + soft-saturated copy -> post -> tone (lowpass) -> bus
     plus two slow DRIFT oscillators that detune every pitched note a few cents.

   USAGE (inside buildGraph; create the channel gains FIRST so their graph order is stable)
     const F = a.lib.fx, e = a.lib.instruments.env(a);
     const fx = F.create(e, bus, {
       channels: ["kick", "perc", "bass", "arp", "lead"],
       pan:  { arp: -0.6, lead: 0.6, perc: 0.3 },       // base pan per channel, -1 (left) to 1 (right); default 0
       send: { arp: 0.5, lead: 0.6, perc: 0.25 },       // how much of each channel goes to the space; default 0
       initial: { width: 0.5, space: 0.5, warmth: 0.5, drift: 0.6, sweep: 0 }
     });
     n.kick.connect(fx.input("kick"));                  // each channel gain feeds its strip, not the bus
     e.drift = fx.drift;                                // instruments detune their oscillators from this
     ...
     // any time later (at a bar line): fx.set({ width: 1 })  moves to new amounts smoothly
     //   (only the values that changed are touched)
     // and return { ...channelGains, dispose() { fx.dispose(); ... } }

   AMOUNTS (all 0 to 1; 0 = off, and sets the matching nodes silent)
     width   scales every channel's base pan (0 = everything centred).
     space   0 = off. Above 0 the sends open, the wet level and the combs' feedback rise (kept well below 1: stable).
     warmth  blend of the dry signal with a soft-saturated copy (0 = untouched).
     drift   depth of the slow pitch wobble (each of 2 oscillators up to 4 cents at 1).
     sweep   depth of a slow lowpass sweep on the tone stage (0 = the tone stage is wide open).

   Also exported: params(settings) -> the exact node values for a set of amounts;
   curve(k, n) -> the saturation curve; COMBS; validateSpec(spec) -> problems.

   DISPOSE  The drift and sweep oscillators run until stopped. The engine calls
   dispose() on the object your buildGraph returns, so call fx.dispose() from it.

   RULES
   - No Math.random; no top-level names; nothing connects to ctx.destination (it feeds `bus`).
   ============================================================================ */
(function () {
  const clamp01 = (v) => {
    if (typeof v !== "number" || !isFinite(v)) throw new Error("fx amount must be a finite number, got " + v);
    return Math.min(1, Math.max(0, v));
  };

  // Soft saturation: slope 1 at the origin (so quiet signals are untouched), bounded by 1/k.
  const SAT_K = 2.5;
  const curve = (k, n) => {
    const c = new Float32Array(n || 1024);
    for (let i = 0; i < c.length; i++) { const x = (i / (c.length - 1)) * 2 - 1; c[i] = k === 0 ? x : Math.tanh(k * x) / k; }
    return c;
  };

  // The space: four parallel damped feedback delays with different lengths, panned alternately left and right.
  const COMBS = [{ delay: 0.031 }, { delay: 0.041 }, { delay: 0.053 }, { delay: 0.067 }];
  const DAMP_HZ = 2400, TONE_OPEN = 18000, TONE_SWEEP_CENTRE = 3200;
  const DRIFT_RATES = [0.23, 0.41], SWEEP_RATE = 0.12;

  // The node values for a set of amounts.
  function params(s) {
    const width = clamp01(s.width === undefined ? 0 : s.width), space = clamp01(s.space === undefined ? 0 : s.space);
    const warmth = clamp01(s.warmth === undefined ? 0 : s.warmth), drift = clamp01(s.drift === undefined ? 0 : s.drift), sweep = clamp01(s.sweep === undefined ? 0 : s.sweep);
    return {
      panScale: width,
      sendOn: space > 0 ? 1 : 0,
      spaceWet: 0.32 * space,
      feedback: space > 0 ? 0.25 + 0.25 * space : 0,
      satDry: 1 - warmth,
      satWet: warmth,
      driftCents: 4 * drift,
      sweepDepth: 1400 * sweep,
      toneFreq: sweep > 0 ? TONE_SWEEP_CENTRE : TONE_OPEN
    };
  }

  function validateSpec(spec) {
    const bad = [];
    if (!spec || !Array.isArray(spec.channels) || !spec.channels.length) return ["spec.channels must list the channel ids"];
    if (new Set(spec.channels).size !== spec.channels.length) bad.push("duplicate channel ids");
    ["pan", "send"].forEach((k) => {
      Object.keys(spec[k] || {}).forEach((id) => {
        const v = spec[k][id], lo = k === "pan" ? -1 : 0;
        if (spec.channels.indexOf(id) === -1) bad.push(k + "." + id + " is not a channel");
        if (typeof v !== "number" || !isFinite(v) || v < lo || v > 1) bad.push(k + "." + id + " = " + v + " (need " + lo + " to 1)");
      });
    });
    return bad;
  }

  function create(e, bus, spec) {
    const bad = validateSpec(spec);
    if (bad.length) throw new Error("fx.create: " + bad.join("; "));
    const ctx = e.ctx, ids = spec.channels, basePan = spec.pan || {}, baseSend = spec.send || {};
    const gain = () => ctx.createGain();
    const lp = (freq) => { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = freq; f.Q.value = 0.7; return f; };

    // the shared tail: mix -> (dry + saturated) -> post -> tone -> bus
    const mix = gain(), dry = gain(), wet = gain(), post = gain(), tone = lp(TONE_OPEN);
    const shaper = ctx.createWaveShaper();
    shaper.curve = curve(SAT_K);
    mix.connect(dry); dry.connect(post);
    mix.connect(shaper); shaper.connect(wet); wet.connect(post);
    post.connect(tone); tone.connect(bus);

    // one strip per channel
    const inputs = {}, pans = {}, sends = {};
    ids.forEach((id) => {
      const inp = gain(), pan = ctx.createStereoPanner(), send = gain();
      inp.connect(pan); pan.connect(mix);
      inp.connect(send);
      inputs[id] = inp; pans[id] = pan; sends[id] = send;
    });

    // the space
    const spaceIn = gain(), spaceOut = gain();
    ids.forEach((id) => sends[id].connect(spaceIn));
    const fbs = COMBS.map((c, i) => {
      const dl = ctx.createDelay(0.2), damp = lp(DAMP_HZ), fb = gain(), pan = ctx.createStereoPanner();
      dl.delayTime.value = c.delay;
      spaceIn.connect(dl); dl.connect(damp); damp.connect(fb); fb.connect(dl);
      pan.pan.value = i % 2 ? 0.8 : -0.8;
      damp.connect(pan); pan.connect(spaceOut);
      return fb;
    });
    spaceOut.connect(mix);

    // slow movement: pitch drift for every pitched note, and a lowpass sweep on the tone stage
    const drift = gain(), sweepDepth = gain();
    const t0 = ctx.currentTime;
    const lfos = DRIFT_RATES.map((rate) => { const o = ctx.createOscillator(); o.frequency.value = rate; o.connect(drift); o.start(t0); return o; });
    const sweep = ctx.createOscillator();
    sweep.frequency.value = SWEEP_RATE; sweep.connect(sweepDepth); sweepDepth.connect(tone.frequency); sweep.start(t0);

    // Apply a set of amounts: instantly at creation, smoothly afterwards. Only parameters whose value
    // actually changed are touched, so changing one setting does not re-send all the others.
    let prev = null;
    function apply(s, instant) {
      const p = params(s), t = ctx.currentTime;
      const to = (param, v, was) => {
        if (prev && was === v) return;
        if (instant) param.value = v; else param.setTargetAtTime(v, t, 0.15);
      };
      ids.forEach((id) => {
        const bp = basePan[id] || 0, bs = baseSend[id] || 0;
        to(pans[id].pan, bp * p.panScale, prev && bp * prev.panScale);
        to(sends[id].gain, bs * p.sendOn, prev && bs * prev.sendOn);
      });
      to(spaceOut.gain, p.spaceWet, prev && prev.spaceWet);
      fbs.forEach((fb) => to(fb.gain, p.feedback, prev && prev.feedback));
      to(dry.gain, p.satDry, prev && prev.satDry); to(wet.gain, p.satWet, prev && prev.satWet);
      to(drift.gain, p.driftCents, prev && prev.driftCents); to(sweepDepth.gain, p.sweepDepth, prev && prev.sweepDepth);
      to(tone.frequency, p.toneFreq, prev && prev.toneFreq);
      prev = p;
    }
    apply(spec.initial || {}, true);

    let live = true;
    return {
      input: (id) => { if (!inputs[id]) throw new Error("fx has no channel '" + id + "'"); return inputs[id]; },
      drift,
      set(s) { apply(s, false); },
      dispose() { if (!live) return; live = false; lfos.forEach((o) => o.stop(ctx.currentTime)); sweep.stop(ctx.currentTime); }
    };
  }

  const lib = (window.CHILLFORGE_LIB = window.CHILLFORGE_LIB || {});
  lib.fx = Object.freeze({
    create, params, curve, validateSpec,
    COMBS: Object.freeze(COMBS.map((c) => Object.freeze(c))), SAT_K, DAMP_HZ, TONE_OPEN, TONE_SWEEP_CENTRE
  });
})();
