// sound.js
//
// Thin wrapper around HTMLAudioElement for the game's sound effects (PRD.md
// §26): throw, move, catch, stack, the Yut/Mo bonus chime, and the win
// fanfare. No backend, no bundler — plain relative paths under
// assets/sounds/. No file exists there yet (see assets/sounds/README.md);
// this module is written so that's a normal, permanent-if-needed state
// rather than a bug — every failure mode (missing file, blocked autoplay,
// unsupported format) silently no-ops instead of throwing or logging noise,
// per "missing sound files must not crash the game".
//
// Nothing here ever plays on its own — playSound() is only ever called from
// main.js's user-triggered game-event handlers (a throw click, a move
// resolving, a win), never from the render loop or on page load, so there's
// no autoplay-before-interaction for the browser to block in the first
// place.

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

/**
 * Plays sound effect `name` if the sound-toggle setting allows it. Always
 * safe to call unconditionally from a game-event handler: a missing file,
 * an unsupported format, or a browser blocking the call all just silently
 * do nothing.
 * @param {keyof typeof SOUND_FILES} name
 * @param {boolean} enabled  gameState.settings.soundEnabled
 */
export function playSound(name, enabled) {
  if (!enabled) return;
  const audio = getAudio(name);
  if (!audio) return;
  try {
    audio.currentTime = 0; // restart if the same effect fires again before finishing
  } catch {
    // With preload="none" the element often has no metadata yet (readyState
    // HAVE_NOTHING), and some browsers (Firefox, Safari) throw
    // InvalidStateError on this specific assignment in that state — must be
    // its own try/catch, separate from play() below, or a throw here would
    // skip play() entirely and the sound would never play even once the
    // file loads. It's a harmless no-op either way: a fresh element already
    // starts at 0.
  }
  try {
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  } catch {
    // Some browsers throw synchronously instead of rejecting the play()
    // promise — treated the same as any other missing-file/blocked-playback
    // case: do nothing.
  }
}
