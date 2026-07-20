# assets/sounds/

Sound effects and ambient audio: stick throw/clatter, piece move, catch, stack, win fanfare, and the optional traditional ambient loop (see `PRD.md` §26).

`sound.js` looks for these exact filenames and, for any that are missing, plays a synthesized fallback tone instead (see that file's module comment) — dropping a real file in here upgrades that one effect automatically, no code change needed:

- `throw.mp3` — sticks thrown
- `move.mp3` — a piece moves
- `catch.mp3` — an opponent's piece is caught
- `stack.mp3` — pieces stack together
- `bonus.mp3` — a Yut or Mo bonus throw is earned
- `win.mp3` — a player wins

Credit third-party audio (source + license) in the project `README.md` before submission (see `PRD.md` §30).
