// TEST FIXTURE (not shipped). Records the loader must refuse without taking the app down.
(function () {
  const R = (window.CHILLFORGE_RECORDS = window.CHILLFORGE_RECORDS || []);
  R.push(["noBuild",   { label: "No buildGraph", bpm: { min: 60, def: 80, max: 100 }, channels: [] }]);
  R.push(["chillwave", { label: "Impostor",      bpm: { min: 60, def: 80, max: 100 }, channels: [], buildGraph() { return {}; } }]);
  R.push(["notObject", 42]);
  R.push(["badBpm",    { label: "Bad bpm", bpm: { min: 100, def: 50, max: 60 }, channels: [], buildGraph() { return {}; } }]);
})();
