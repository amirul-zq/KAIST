🐅 Bagh-Bondi — Tiger vs Goats

An interactive, responsive browser implementation of Bagh-Bondi (বাঘ বন্দি), a traditional Bengali hunting strategy game from South Asia.

Play locally with a friend or test your tactical skills against an AI opponent powered by Minimax search and Alpha-Beta pruning offloaded to a Web Worker thread.

📖 Game Overview & Cultural Background

Bagh-Bondi (বাঘ বন্দি, meaning "Trapped Tiger") is an asymmetric two-player abstract strategy board game historically played across Bengal and South Asia.

The game models a hunt between two contrasting forces:

The Tigers ($4$): Powerful predators seeking to pounce on and reduce the goat population.

The Goats ($20$): A coordinated herd working together to trap and completely immobilize all four tigers.

📐 Board Geometry & Game Rules

Board Structure

Grid: Played on a grid of $5 \times 5$ intersections ($25$ total points/nodes).

Connections: Points are connected by orthogonal (horizontal/vertical) lines as well as diagonal path lines on alternating grid squares, forming a continuous network for piece movement.

Initial Setup: $4$ Tigers start positioned at the four extreme corner points of the board. All $20$ Goats begin in hand (off-board).

Gameplay Phases

Placement Phase:

Goat Turn: Place $1$ goat on any unoccupied point on the grid.

Tiger Turn: Move $1$ tiger to an adjacent connected empty point, OR make a jump capture over a goat.

Once all $20$ goats have been placed, the game transitions into the Movement Phase.

Movement Phase:

Goat Turn: Slide $1$ goat along a connected path line to an adjacent empty point.

Tiger Turn: Slide $1$ tiger along a connected path line to an adjacent empty point, OR perform a jump capture.

Mechanics & Winning Conditions

Tiger Jump Capture:
A tiger can capture an adjacent goat by jumping over it along a connecting line into an empty point directly behind the goat. The jumped goat is permanently removed from the board. Multi-jumps are not permitted in a single turn.

Tigers Victory Condition:
The Tigers win immediately upon capturing $5$ Goats.

Goats Victory Condition:
The Goats win if they surround and trap all $4$ Tigers such that no tiger has any legal move or jump available on their turn.

🌙 Special Twist: Legend Mode

Toggle Legend Mode from the interface to activate a mythical Bengali folk element:

During placement, one goat chosen at random possesses a hidden protective charm.

The first time this goat is targeted by a tiger capture, its charm activates—allowing it to escape the pounce and safely vanish into a neighboring open point.

✨ Key Features

3 Play Modes:

👥 Two Players: Local pass-and-play on a single device.

🐯 Play as Tiger: Command the four predators against an AI goat herd.

🐐 Play as Goats: Form strategic barricades against AI tigers.

Minimax AI Engine:

Uses Minimax search with Alpha-Beta Pruning evaluated up to depth $d = 3$.

Executes inside a dedicated Web Worker spawned via Blob URL to keep canvas rendering smooth ($60\text{ fps}$) without freezing the UI thread.

Falls back to tactical position heuristics when worker thread creation is restricted.

Procedural Web Audio Engine:

Zero external audio files or network dependencies.

Purely synthesized audio via the browser's Web Audio API:

Low-pass filtered noise and frequency modulation for realistic tiger growls.

Resonant sine sweeps for wood piece placement and steps.

Dual harmonic ambient background drones ($110\text{ Hz}$).

Separate UI sliders for Master Mute, Ambient Music, and Sound Effects volume.

Visual Experience:

Crisp vector canvas graphics rendered dynamically based on device pixel ratio ($\text{DPI}$).

Procedurally generated wood grain textures and decorative flourishes.

Context-aware move highlights, capture vectors, and smooth piece animations.

Quality of Life:

Full move history with Undo support.

High contrast touch targets for mobile and desktop screens.

Respects prefers-reduced-motion browser configuration.

🛠️ Technical Architecture

The application is written in clean, dependency-free vanilla JavaScript (ES2022+) bundled into a single file.

┌─────────────────────────────────────────────────────────────┐
│                    User Interface / DOM                     │
│    (Header, Mode Select, Audio Controls, HUD, Overlay)      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Input Events
┌──────────────────────────────▼──────────────────────────────┐
│                      InputController                        │
└──────────────┬──────────────────────────────┬───────────────┘
               │ Actions                      │ Query Legal Moves
┌──────────────▼──────────────┐┌──────────────▼───────────────┐
│          GameState          ││         RulesEngine          │
│ (Board, Turn, Phase, Stats) ││ (Move & Capture Validation)  │
└──────────────┬──────────────┘└──────────────┬───────────────┘
               │                              │
┌──────────────▼──────────────────────────────▼───────────────┐
│                    MinimaxWorkerAI Thread                   │
│   (Alpha-Beta Search, Position Heuristics, Non-Blocking)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Render Loop
┌──────────────────────────────▼──────────────────────────────┐
│              BoardRenderer & PieceRenderer                  │
│             (<canvas> 2D Context Engine)                    │
└─────────────────────────────────────────────────────────────┘


🚀 Quick Start / How to Run

Open index.html in any modern web browser (Chrome, Firefox, Safari, Edge).

No build steps, package managers (npm), local HTTP servers, or external assets required.

🧠 Tactics & Strategy Guide

Strategic Tips for Tigers 🐯

Avoid Corner Traps: Do not remain trapped in corners early. Move out to central hubs ($5$-connection points) to maximize jump paths.

Create Split Threats: Position tigers so that jumping one goat forces another goat into a secondary capture line.

Limit Goat Clusters: Target goats that bridge gaps between lines to break up defensive formations.

Strategic Tips for Goats 🐐

Protect Diagonal Lines: Diagonal connections give tigers maximum mobility. Secure these points early during placement.

Advance in Wall Formations: Keep goats adjacent on orthogonal paths to block tiger jumps (a jump requires an empty landing point directly behind the target).

Corner Immobilization: Drive individual tigers toward edge points and box them in with $3$ to $4$ coordinated goats.

📜 License

Distributed under the MIT License. Feel free to inspect, modify, and redistribute.
