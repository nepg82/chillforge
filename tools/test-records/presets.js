// TEST FIXTURE (not shipped). Plays EVERY preset of EVERY instrument category, round and round,
// through the real engine and the strict fake audio, so a typo in any preset (a bad waveform,
// a non-finite number, a ramp to zero) fails a check instead of surfacing on a phone.
(function () {
  const CATS = ["kick", "snare", "hat", "bass", "pad", "lead", "arp"];
  (window.CHILLFORGE_RECORDS = window.CHILLFORGE_RECORDS || []).push(["presets", (() => {
    let insts = null, played = null, n = 0;
    return {
      label: "Preset smoke test (fixture)",
      needs: ["instruments"],
      bpm: { min: 60, def: 100, max: 180 },
      channels: CATS.map((id) => ({ id, label: id, max: 6, def: -6 })),
      buildGraph(a, bus) {
        const I = a.lib.instruments, e = I.env(a), nodes = {}, mine = {};
        CATS.forEach((c) => {
          nodes[c] = a.ctx.createGain(); nodes[c].connect(bus);
          mine[c] = Object.keys(I.PRESETS[c]).map((id) => I.make(e, nodes[c], c, id));
        });
        insts = mine; played = {};
        nodes.dispose = () => CATS.forEach((c) => mine[c].forEach((i) => i.dispose()));
        return nodes;
      },
      onStep(a, s, t) {
        n++;
        CATS.forEach((c, ci) => {
          if (n % 4 !== ci % 4) return;                          // each category every 4th step
          played[c] = (played[c] || 0) + 1;
          const inst = insts[c][played[c] % insts[c].length];
          if (c === "kick" || c === "snare") inst.play(t, 0.9);
          else if (c === "hat") inst.play(t, 0.9, played[c] % 3 === 0);
          else inst.play(t, 48 + (played[c] % 24), 0.3, 0.8);
        });
      },
      reset() { n = 0; played = {}; }
    };
  })()]);
})();
