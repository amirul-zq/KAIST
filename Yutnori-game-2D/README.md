# 🎲 Yutnori – Traditional Korean Board Game

A modern, responsive web implementation of **Yutnori (윷놀이)**, the traditional Korean strategy board game. This project recreates the classic gameplay with smooth animations, AI opponents, sound effects, and a clean Korean-inspired interface using only HTML, CSS, and JavaScript.

---

## 📖 About

Yutnori is one of Korea's oldest traditional board games, played by throwing four wooden sticks instead of dice. Players race four pieces around the board while using strategy to:

- Move pieces
- Capture opponents
- Stack pieces together
- Take shortcut paths
- Reach Home before the opponent

This implementation follows the official gameplay while also supporting the optional **Back-Do** rule.

---

## ✨ Features

- 🎮 Two Game Modes
  - Player vs Player
  - Player vs AI

- 🤖 Three AI Difficulty Levels
  - Easy
  - Medium
  - Hard

- 🎲 Animated stick throwing

- 🎵 Built-in sound effects
  - Throw
  - Move
  - Capture
  - Extra turn
  - Victory

- 🛣️ Official Yutnori shortcut paths

- 🔄 Optional Back-Do rule

- 📜 Built-in Rules panel

- 📱 Fully Responsive
  - Desktop
  - Tablet
  - Mobile

- 🎨 Traditional Korean-inspired UI
  - Hanji paper colors
  - Wooden board theme
  - Korean typography
  - Minimal modern design

---

## 🎯 Game Rules

### Throw Results

| Result | Move | Extra Turn |
|--------|------|------------|
| Do | 1 | ❌ |
| Gae | 2 | ❌ |
| Geol | 3 | ❌ |
| Yut | 4 | ✅ |
| Mo | 5 | ✅ |
| Back-Do *(Optional)* | -1 | ❌ |

---

### Gameplay

1. Throw the four sticks.
2. Move one of your pieces according to the result.
3. You may bring a new piece onto the board or move an existing one.
4. Landing on your own piece stacks them together.
5. Landing on an opponent captures their entire stack and sends it back to Start.
6. Capturing an opponent grants an extra throw.
7. Yut and Mo also grant an extra throw.
8. Use shortcut paths through the center for faster movement.
9. First player to bring all four pieces Home wins.

---

## 🛠 Technologies Used

- HTML5
- CSS3
- Vanilla JavaScript
- SVG Board Rendering
- Web Audio API

No external frameworks or libraries are required.

---


### Open the game

Simply open:

```
yutnori_board.html
```

in any modern web browser.

No installation or server setup is required.

---

## 📂 Project Structure

```
/
│── yutnori_board.html
└── README.md
```

Everything (HTML, CSS, and JavaScript) is contained within a single file for easy portability.

---

## 🎮 Controls

| Action | Control |
|---------|----------|
| Throw sticks | Throw Sticks button |
| Move piece | Click highlighted piece |
| Toggle Back-Do | Checkbox |
| Change Game Mode | Radio buttons |
| Select AI Difficulty | Dropdown |
| Toggle Sound | Speaker button |
| View Rules | Rules button |
| Start New Game | New Game button |

---

## 🤖 AI Difficulty

### Easy
- Random movement decisions
- Suitable for beginners

### Medium
- Uses shortcut paths
- Prioritizes quicker routes

### Hard
- Strategic movement
- Prioritizes captures
- Evaluates safer positions
- Makes smarter shortcut decisions

---

## 📱 Responsive Design

The game automatically adapts to different screen sizes:

- Desktop
- Laptop
- Tablet
- Mobile Portrait
- Mobile Landscape

---

## 🔊 Audio

Built-in sound effects include:

- Stick throw
- Piece movement
- Capture
- Extra turn
- Winning fanfare

Sound can be toggled on or off at any time.

---

## 🎨 Design Highlights

- Traditional Korean aesthetic
- Hanji paper background
- Wooden board styling
- Korean typography
- Smooth transitions
- Animated game pieces
- Responsive layout

---

## 📜 Future Improvements

- Online Multiplayer
- Local Multiplayer over Wi-Fi
- Guest Mode
- Ranked Matches
- Player Profiles
- Statistics
- Save/Load Games
- Replay System
- Background Music
- Multiple Board Themes
- Korean / English Language Switching
- Tournament Mode

---

## 📄 License

This project is intended for educational and personal use.

The traditional game of **Yutnori (윷놀이)** is part of Korea's cultural heritage.

---

## 👨‍💻 Author

Developed by **Abrar Abir**

Inspired by the traditional Korean board game **Yutnori (윷놀이)**.