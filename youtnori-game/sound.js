// sound.js
//
// The game's sound effects (PRD.md §26): throw, move, catch, stack, the
// Yut/Mo bonus chime, and the win fanfare. No backend, no bundler, no
// external audio assets required — every effect is synthesized on the fly
// with the Web Audio API, so the game is actually audible without anyone
// having to source/license real sound files first.
//
// If real files ever get dropped into assets/sounds/ (see that folder's
// README for the exact expected names), they take over automatically:
// playSound() tries the file first and only falls back to the synthesized
// tone if that file is missing or fails to load — no code change needed to
// upgrade later.
//
// Nothing here ever plays on its own — playSound() is only ever called from
// main.js's user-triggered game-event handlers (a throw click, a move
// resolving, a win), never from the render loop or on page load, so there's
// no autoplay-before-interaction for the browser to block in the first
// place. Every failure mode (missing file, unsupported format, WebAudio
// unavailable, browser blocking playback) silently no-ops instead of
// throwing or logging noise, per "missing sound files must not crash the
// game".

const SOUND_FILES = {
  throw: "assets/sounds/throw.mp3",
  move: "assets/sounds/move.mp3",
  catch: "assets/sounds/catch.mp3",
  stack: "assets/sounds/stack.mp3",
  bonus: "assets/sounds/bonus.mp3",
  win: "assets/sounds/win.mp3",
};

// One HTMLAudioElement per effect, created lazily and reused — avoids
// re-requesting a missing file's 404 on every single play() call.
const audioCache = new Map();

function getAudio(name) {
  if (audioCache.has(name)) return audioCache.get(name);
  const src = SOUND_FILES[name];
  if (!src) return null;
  const audio = new Audio(src);
  audio.preload = "none"; // fetch nothing until an actual play() call — never a page-load network request for an asset that may not exist
  audio.volume = 0.7;
  audioCache.set(name, audio);
  return audio;
}

// ---------- Synthesized fallback ----------
// Each effect is a short sequence of notes, picked to feel distinct from
// each other rather than to imitate any specific real instrument. A note is
// either a tone (freq/type = an OscillatorType) or, for "throw", a filtered
// noise burst (type: "noise", filterFreq/filterQ) — much closer to a wooden
// stick's clack than any pure waveform can sound.
const SYNTH_PATTERNS = {
  throw: [
    { type: "noise", dur: 0.045, gain: 0.5, filterFreq: 2200, filterQ: 1.4 },
    { type: "noise", dur: 0.04, gain: 0.42, filterFreq: 1600, filterQ: 1.6 },
    { type: "noise", dur: 0.05, gain: 0.46, filterFreq: 2600, filterQ: 1.3 },
    { type: "noise", dur: 0.04, gain: 0.38, filterFreq: 1900, filterQ: 1.5 },
  ],
  move: [{ freq: 440, dur: 0.08, type: "sine", gain: 0.16 }],
  catch: [
    { freq: 700, dur: 0.05, type: "triangle", gain: 0.22 },
    { freq: 350, dur: 0.09, type: "triangle", gain: 0.18 },
  ],
  stack: [
    { freq: 262, dur: 0.09, type: "sine", gain: 0.18 },
    { freq: 392, dur: 0.1, type: "sine", gain: 0.18 },
  ],
  bonus: [
    { freq: 523, dur: 0.08, type: "triangle", gain: 0.2 },
    { freq: 784, dur: 0.14, type: "triangle", gain: 0.2 },
  ],
  win: [
    { freq: 523.25, dur: 0.12, type: "triangle", gain: 0.2 }, // C5
    { freq: 659.25, dur: 0.12, type: "triangle", gain: 0.2 }, // E5
    { freq: 783.99, dur: 0.12, type: "triangle", gain: 0.2 }, // G5
    { freq: 1046.5, dur: 0.24, type: "triangle", gain: 0.22 }, // C6
  ],
};

let audioContext = null;

function getAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null; // Web Audio unsupported — caller treats this the same as any other missing-sound case
  if (!audioContext) audioContext = new Ctx();
  // Chrome/Safari start every AudioContext 'suspended' until a user gesture
  // has occurred on the page; playSound() is only ever called from a
  // gesture-triggered game event (see module comment), so resuming here is
  // always in response to real user interaction, never on page load.
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

// A short burst of white noise through a bandpass filter — reads as a
// wooden "clack" rather than a musical tone. Used for the throw effect
// (PRD.md's stick "throw/clatter"); each call gets its own fresh noise
// buffer so repeated throws never sound like the exact same recording.
function playNoiseBurst(ctx, t, { dur, gain, filterFreq, filterQ }) {
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = filterQ;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(gain, t);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  source.connect(filter).connect(gainNode).connect(ctx.destination);
  source.start(t);
  source.stop(t + dur + 0.01);
}

function playTone(ctx, t, { freq, dur, type, gain }) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  // Quick linear attack (avoids an audible click from starting at full
  // volume instantly), then an exponential decay down to the note's end.
  gainNode.gain.setValueAtTime(0.0001, t);
  gainNode.gain.linearRampToValueAtTime(gain, t + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gainNode).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function playSynth(name) {
  const pattern = SYNTH_PATTERNS[name];
  if (!pattern) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    let t = ctx.currentTime;
    for (const note of pattern) {
      if (note.type === "noise") {
        playNoiseBurst(ctx, t, note);
      } else {
        playTone(ctx, t, note);
      }
      // Slight overlap between notes for legato rather than a gap, plus a
      // touch of random jitter so a run of clicks (the throw effect) never
      // sounds like the exact same loop twice.
      t += note.dur * (0.75 + Math.random() * 0.2);
    }
  } catch {
    // WebAudio present but blocked/erroring for some other reason — same
    // silent-no-op policy as every other failure mode in this module.
  }
}

/**
 * Plays sound effect `name` if the sound-toggle setting allows it: the real
 * file if one exists at assets/sounds/ and loads successfully, otherwise a
 * synthesized fallback tone so the game is never actually silent. Always
 * safe to call unconditionally from a game-event handler.
 * @param {keyof typeof SOUND_FILES} name
 * @param {boolean} enabled  gameState.settings.soundEnabled
 */
export function playSound(name, enabled) {
  if (!enabled) return;
  const audio = getAudio(name);
  if (!audio) {
    playSynth(name);
    return;
  }
  try {
    audio.currentTime = 0; // restart if the same effect fires again before finishing
  } catch {
    // With preload="none" the element often has no metadata yet (readyState
    // HAVE_NOTHING), and some browsers (Firefox, Safari) throw
    // InvalidStateError on this specific assignment in that state — kept in
    // its own try/catch, separate from play() below, so a throw here can't
    // skip play() entirely. Harmless no-op either way: a fresh element
    // already starts at 0.
  }
  try {
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise.then(
        () => {}, // the real file played — no fallback needed
        () => playSynth(name) // missing file, unsupported format, or blocked — synthesize instead
      );
    }
  } catch {
    // Some browsers throw synchronously instead of rejecting the play()
    // promise (e.g. no supported source at all) — same fallback.
    playSynth(name);
  }
}
