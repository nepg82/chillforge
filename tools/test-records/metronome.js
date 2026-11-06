// TEST FIXTURE (not shipped). The barest record the engine's documented contract allows:
// label, bpm, channels, buildGraph, onStep. Everything else is deliberately omitted
// (selects, progs, cutoffMul, swing, reset, onBar, onTempo, phraseBars, trackTitle, radio)
// so the engine is forced to cope with every optional field being absent.
(window.CHILLFORGE_RECORDS = window.CHILLFORGE_RECORDS || []).push(["metronome", {
  label: "Metronome (fixture)",
  bpm: { min: 60, max: 180, def: 100 },
  channels: [{ id: "click", label: "Click", max: 6, def: 0 }],

  buildGraph(a, bus) {
    const g = a.ctx.createGain();
    g.connect(bus);
    return { click: g };
  },

  onStep(a, s, t) {
    if (s % 4 !== 0) return;                       // one click per beat
    const o = a.ctx.createOscillator(), gn = a.ctx.createGain();
    o.frequency.value = s === 0 ? 1200 : 800;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.3, t + 0.002);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(gn).connect(a.nodes.click);
    o.start(t);
    o.stop(t + 0.08);
  }
}]);
