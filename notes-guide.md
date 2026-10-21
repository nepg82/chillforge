   ===================================================================
   CHILLFORGE: DESIGN NOTES AND LOG GUIDE (read before debugging)
   -------------------------------------------------------------------
   WHAT IT IS
   Generative music PWA (Chillwave, Synthwave, Darksynth) hosted on
   GitHub Pages, installed on Android/Chrome. Used at work, on a
   motorcycle (Bluetooth comm unit), and overnight while charging.

   ARCHITECTURE
   - Music is pure Web Audio. A 16-step/bar scheduler runs from a Worker
     timer (TICK_MS) so it isn't throttled in the background, and
     schedules LOOKAHEAD seconds ahead of ctx.currentTime.
   - Android doesn't treat Web Audio as "real" media, so a looping 10 s
     near-silent WAV plays in an <audio> element (silentEl). That makes
     Chrome show media notification controls, accept Bluetooth buttons,
     and keep the page alive. Media Session handlers: play/pause/stop,
     plus nexttrack while Radio is on.
   - `playing` is the single source of truth. Our own stops set
     playing=false BEFORE pausing silentEl, so the element's pause
     listener only acts on pauses the SYSTEM caused.

   YIELD LOGIC (audio focus)
   - silentEl pauses while playing=true  -> system took focus (alarm,
     YouTube, call). We set yielded=true, master gain to 0, and start a
     YIELD_GRACE_MS timer. We do NOT call play() to grab focus back.
   - silentEl plays again within the grace period -> unyield, music
     resumes mid-beat (alarms, notification dings).
   - Grace expires -> stopBeat("yielded to other audio"). Stays stopped
     until the user presses Play. This is intended.
   - visibilitychange must not call silentEl.play() while yielded.
     A deliberate Play (button, notification, headset) restarts all.

   LOG (localStorage "chillforge-log", ring buffer of 1500 lines)
   Format: "MM-DD HH:MM:SS <event> <snap>" in local time.
   snap = play=<playing> ctx=<AudioContext state or -> el=<silent
          element playing/paused or -> vis=<visible/hidden>
   Viewer: tap the version stamp. It shows the newest 150 lines
   (newest first) and copies the FULL log to the clipboard.
   Events:
     boot            page script loaded
     start / stop: X start; stop reason: ui | ms pause | ms stop |
                     yielded to other audio | visible, el paused
     ms play         Media Session play (notification/headset)
     ctx <state>     AudioContext state change
     el play/pause/ended/error/stalled   silent element events
     yield: / unyield:   focus lost / regained (see above)
     vis visible|hidden  page visibility
     page freeze / page resume / pagehide   Chrome lifecycle events
     hb              heartbeat every 5 min while playing:
                     ct=audio clock secs (should track wall time),
                     mem=JS heap MB (Chrome only), bat=battery %
                     ("+" = charging), w=count of silent-loop
                     'waiting' events (~1 per 11 s, harmless, not
                     logged individually)
     ERR ...         caught scheduler error or uncaught page error
     PREV SESSION ENDED WHILE PLAYING
                     last run never logged a stop. Shows when it was
                     last alive (updated every 30 s, on start/stop/
                     pagehide) and document.wasDiscarded.
     RESYNC late=Nms (if present) scheduler fell behind and skipped ahead
     audio sr=... (if present)    sample rate and latency at start

   KNOWN-BENIGN PATTERNS (not bugs)
   - yield then unyield 10-30 s later: alarm or notification.
   - stop: yielded to other audio ~45 s after yield: another app
     (YouTube, etc.) took over. Intended.
   - stop: ms pause when the rider powers off the comm unit.
   - PREV SESSION ENDED WHILE PLAYING + fresh boot within seconds:
     user swiped the app away and relaunched.
   - Rapid boot/pagehide/boot bursts: user reloading while testing.
   - vis hidden/visible flickers at :00 marks: alarm/snooze cycles.
   - bat=100+ on every line: phone was charging (Doze doesn't apply).

   DEPLOY CHECKLIST
   1. Bump the version stamp (<h2 id="ver">, format YYMMDD-HHMM).
   2. Bump the cache name in service-worker.js, or the old copy may
      keep being served from cache.
   3. If the UI loads with no controls, it is a JS syntax error. Open the
      page in desktop Chrome and read the DevTools console for the line.
      Past breakages: missing id="ver" (null.addEventListener), a stray
      "}" after an edit, a missing ")" on a listener.
   ===================================================================