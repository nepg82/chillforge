/* ============================================================================
   CHILLFORGE TOOLBOX: THEORY                                   (lib/theory.js)

   Pure music theory for records. No audio, no DOM, no randomness, no state.
   Ported from Synth Radio's music.js (chord types, scales, key names, folding).

   Records reach it as  a.lib.theory  (the engine hands it over; a record must not
   look for it anywhere else). The engine itself uses only KEY_NAMES, for the Key
   pulldown.

   WHY CHORDS ARE (r, t) AND NOT NOTE NAMES
   A chord is { r, t }: r = root as semitones above the KEY (0 = the key's own
   root, 7 = the fifth ...), t = a chord type from CHORD_TYPES. The same
   progression therefore works in all 12 keys. The key (0-11, 0 = C) comes from
   a.S.key for any record that declares  keyed: true.

   API
     KEY_NAMES            ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B']
                          index = key number.
     SCALES               { major, minor, dorian, phrygian, lydian, mixolydian }
                          each is 7 semitone offsets from the key.
     CHORD_TYPES          { maj, min, sus2, sus4, maj7, min7, dom7, add9, maj9,
                            min9 }  intervals in semitones from the chord root.
     mtof(midi)           MIDI note number -> frequency in Hz (69 = A4 = 440).
     fold(pc, lo)         lowest MIDI note >= lo whose pitch class is pc.
                          pc may be any integer, negative or above 11.
     chordMidi(key, chord, lo)
                          MIDI notes of a chord. The ROOT is folded into
                          [lo, lo + 11], so the chord stays in the same register
                          in every key (a bass and a pad pass different `lo`).
                          Notes ascend from the root; extensions above an octave
                          (add9, maj9, min9) go past lo + 11 by design.
     chordPcs(key, chord) pitch classes (0-11) the chord contains.
     scaleMidi(key, scale, lo, hi)
                          every MIDI note from lo to hi (inclusive) in the scale.

   RULES
   - Never mutate anything here (everything is frozen).
   - Unknown chord types and scales throw a readable Error, so a typo is obvious
     in the app's log instead of a bare TypeError.
   - Do not add randomness here. Records get random numbers from a.rng().
   - This file shares the global scope with the engine and the records, so it
     declares NO top-level names: everything lives inside the function below.
   ============================================================================ */
(function () {
  const SCALES = {
    major:      [0, 2, 4, 5, 7, 9, 11],
    minor:      [0, 2, 3, 5, 7, 8, 10],
    dorian:     [0, 2, 3, 5, 7, 9, 10],
    phrygian:   [0, 1, 3, 5, 7, 8, 10],
    lydian:     [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10]
  };

  // Intervals in semitones from the chord root.
  const CHORD_TYPES = {
    maj:  [0, 4, 7],        min:  [0, 3, 7],
    sus2: [0, 2, 7],        sus4: [0, 5, 7],
    maj7: [0, 4, 7, 11],    min7: [0, 3, 7, 10],   dom7: [0, 4, 7, 10],
    add9: [0, 4, 7, 14],    maj9: [0, 4, 7, 11, 14], min9: [0, 3, 7, 10, 14]
  };

  const KEY_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const mod12 = (n) => ((n % 12) + 12) % 12;

  // Lowest MIDI note >= lo that has pitch class `pc`.
  const fold = (pc, lo) => lo + mod12(pc - lo);

  const intervals = (t) => {
    if (!Object.prototype.hasOwnProperty.call(CHORD_TYPES, t)) throw new Error("unknown chord type '" + t + "'");
    return CHORD_TYPES[t];
  };

  // MIDI notes of a chord, root placed in [lo, lo + 11].
  function chordMidi(key, chord, lo) {
    const root = fold(key + chord.r, lo);
    return intervals(chord.t).map((i) => root + i);
  }

  // Pitch classes (0-11) a chord contains.
  function chordPcs(key, chord) {
    return intervals(chord.t).map((i) => mod12(key + chord.r + i));
  }

  // All MIDI notes of a scale between lo and hi (inclusive).
  function scaleMidi(key, scale, lo, hi) {
    if (!Object.prototype.hasOwnProperty.call(SCALES, scale)) throw new Error("unknown scale '" + scale + "'");
    const out = [];
    for (let m = lo; m <= hi; m++) {
      if (SCALES[scale].indexOf(mod12(m - key)) !== -1) out.push(m);
    }
    return out;
  }

  const freezeAll = (o) => { Object.keys(o).forEach((k) => Object.freeze(o[k])); return Object.freeze(o); };

  const lib = (window.CHILLFORGE_LIB = window.CHILLFORGE_LIB || {});
  lib.theory = Object.freeze({
    SCALES: freezeAll(SCALES),
    CHORD_TYPES: freezeAll(CHORD_TYPES),
    KEY_NAMES: Object.freeze(KEY_NAMES),
    mtof, fold, chordMidi, chordPcs, scaleMidi
  });
})();
