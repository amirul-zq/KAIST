// i18n.js
//
// English/Korean text lookup for the HUD and setup screen (PRD.md §19).
// Kept separate from ui.js so translations can be edited without touching
// any DOM-manipulation code.

const STRINGS = {
  en: {
    setupTitle: "Yutnori 3D",
    nicknameLabel: "Nickname",
    languageLabel: "Language",
    chooseFaceLabel: "Choose your piece face",
    startGame: "Start Game",
    throwSticks: "Throw Sticks",
    restart: "Restart",
    turnIndicator: (nickname) => `${nickname}'s Turn`,
    winnerBanner: (nickname) => `${nickname} wins!`,
  },
  ko: {
    setupTitle: "3D 윷놀이",
    nicknameLabel: "닉네임",
    languageLabel: "언어",
    chooseFaceLabel: "말의 얼굴을 선택하세요",
    startGame: "게임 시작",
    throwSticks: "윷 던지기",
    restart: "다시 시작",
    turnIndicator: (nickname) => `${nickname}의 차례`,
    winnerBanner: (nickname) => `${nickname} 승리!`,
  },
};

/**
 * Looks up a string (or string-builder function) for the given language.
 * Falls back to English if the key or language is missing.
 * @param {'en'|'ko'} language
 * @param {keyof typeof STRINGS.en} key
 */
export function t(language, key) {
  const dict = STRINGS[language] ?? STRINGS.en;
  return dict[key] ?? STRINGS.en[key];
}
