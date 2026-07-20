// i18n.js
//
// English/Korean text lookup for the HUD and setup screen (PRD.md §19).
// Kept separate from ui.js so translations can be edited without touching
// any DOM-manipulation code.

const STRINGS = {
  en: {
    gameTitle: "Yutnori",
    setupTitle: "Yutnori 3D",
    nicknameLabel: "Nickname",
    languageLabel: "Language",
    chooseFaceLabel: "Choose your piece face",
    startGame: "Start Game",
    throwSticks: "Throw Yut",
    newGame: "New Game",
    restartConfirmMessage: "Start a new game? Current progress will be lost.",
    confirmRestart: "Yes, New Game",
    cancel: "Cancel",
    turnIndicator: (nickname) => `${nickname}'s Turn`,
    winnerBanner: (nickname) => `${nickname} wins!`,
    logThrew: (nickname, resultLabel) => `${nickname} threw ${resultLabel}`,
    logCaught: (catcherNickname, victimNickname, count) =>
      count > 1
        ? `${catcherNickname} caught ${count} of ${victimNickname}'s pieces — bonus throw!`
        : `${catcherNickname} caught ${victimNickname}'s piece — bonus throw!`,
    logStacked: (nickname, count) => `${nickname} stacked ${count} pieces together`,
    logCompleted: (nickname, count) =>
      count > 1 ? `${nickname} got ${count} pieces Home` : `${nickname} got a piece Home`,
    logWon: (nickname) => `${nickname} wins the game!`,

    // ---------- Top bar ----------
    blueTeamLabel: "Blue Team",
    redTeamLabel: "Red Team",
    teamStatusSummary: (waiting, active, home) => `Waiting ${waiting} · In play ${active} · Home ${home}`,
    soundOnAriaLabel: "Sound on — click to mute",
    soundOffAriaLabel: "Sound off — click to unmute",
    languageToggleAriaLabel: "Switch language",
    settingsAriaLabel: "Open settings",
    newGameAriaLabel: "Start a new game",

    // ---------- Settings modal ----------
    settingsTitle: "Settings",
    closeSettingsAriaLabel: "Close settings",
    nicknamesSectionLabel: "Player Nicknames",
    blueNicknameLabel: "Blue Team Nickname",
    redNicknameLabel: "Red Team Nickname",
    gameModeLabel: "Game Mode",
    twoPlayerModeLabel: "2 Players (local)",
    vsAiModeLabel: "vs AI (coming soon)",
    soundSettingLabel: "Sound",
    soundOnOption: "On",
    soundOffOption: "Off",
    languageSettingLabel: "Language",
    faceSettingLabel: "Piece Face",
    blueFaceLabel: "Blue team's face",
    redFaceLabel: "Red team's face",
    defaultFaceAriaLabel: "Use team photo",
    faceOptionAriaLabel: (n) => `Face option ${n}`,
    saveSettings: "Save",
    settingsSavedNote: "Settings saved.",

    // ---------- Bottom panel ----------
    currentPlayerLabel: (nickname) => `${nickname}'s Turn`,
    actionThrow: "Throw the yut sticks to begin.",
    actionThrowBonus: "Bonus throw! Throw again.",
    actionSelectResult: "Select a result below, then click one of your pieces.",
    actionSelectPiece: "Click one of your highlighted pieces to move it.",
    actionGameOver: (nickname) => `${nickname} has won the game!`,
    moveWithLabel: "Move with:",
    pendingResultsLabel: "Pending moves",
    noPendingResults: "No pending moves.",
    forfeitedNote: (list) => `${list} forfeited — no legal piece.`,
    selectedPieceLabel: "Selected piece",
    noPieceSelected: "No piece selected.",
    stateWaiting: "waiting",
    stateActive: "in play",
    stateHome: "home",
    atNodeLabel: (position) => `at ${position}`,
    stackedSuffix: (count) => ` (stacked ×${count})`,
    instructionsLine: "Throw, pick a result, then click a piece of yours to move it. Catch to earn a bonus throw; stack your own pieces to move them together.",
    gameLogToggleLabel: "History",
  },
  ko: {
    gameTitle: "윷놀이",
    setupTitle: "3D 윷놀이",
    nicknameLabel: "닉네임",
    languageLabel: "언어",
    chooseFaceLabel: "말의 얼굴을 선택하세요",
    startGame: "게임 시작",
    throwSticks: "윷 던지기",
    newGame: "새 게임",
    restartConfirmMessage: "새 게임을 시작할까요? 현재 진행 상황이 사라집니다.",
    confirmRestart: "예, 새 게임",
    cancel: "취소",
    turnIndicator: (nickname) => `${nickname}의 차례`,
    winnerBanner: (nickname) => `${nickname} 승리!`,
    logThrew: (nickname, resultLabel) => `${nickname}님이 ${resultLabel}을(를) 던졌습니다`,
    logCaught: (catcherNickname, victimNickname, count) =>
      count > 1
        ? `${catcherNickname}님이 ${victimNickname}님의 말 ${count}개를 잡았습니다 — 보너스 던지기!`
        : `${catcherNickname}님이 ${victimNickname}님의 말을 잡았습니다 — 보너스 던지기!`,
    logStacked: (nickname, count) => `${nickname}님이 말 ${count}개를 업었습니다`,
    logCompleted: (nickname, count) =>
      count > 1 ? `${nickname}님의 말 ${count}개가 났습니다` : `${nickname}님의 말이 났습니다`,
    logWon: (nickname) => `${nickname}님이 승리했습니다!`,

    // ---------- Top bar ----------
    blueTeamLabel: "청팀",
    redTeamLabel: "홍팀",
    teamStatusSummary: (waiting, active, home) => `대기 ${waiting} · 이동 중 ${active} · 완주 ${home}`,
    soundOnAriaLabel: "소리 켜짐 — 클릭하여 음소거",
    soundOffAriaLabel: "소리 꺼짐 — 클릭하여 소리 켜기",
    languageToggleAriaLabel: "언어 전환",
    settingsAriaLabel: "설정 열기",
    newGameAriaLabel: "새 게임 시작",

    // ---------- Settings modal ----------
    settingsTitle: "설정",
    closeSettingsAriaLabel: "설정 닫기",
    nicknamesSectionLabel: "플레이어 닉네임",
    blueNicknameLabel: "청팀 닉네임",
    redNicknameLabel: "홍팀 닉네임",
    gameModeLabel: "게임 모드",
    twoPlayerModeLabel: "2인 플레이 (로컬)",
    vsAiModeLabel: "AI 대전 (준비 중)",
    soundSettingLabel: "소리",
    soundOnOption: "켜짐",
    soundOffOption: "꺼짐",
    languageSettingLabel: "언어",
    faceSettingLabel: "말 얼굴",
    blueFaceLabel: "청팀 얼굴",
    redFaceLabel: "홍팀 얼굴",
    defaultFaceAriaLabel: "팀 사진 사용",
    faceOptionAriaLabel: (n) => `얼굴 옵션 ${n}`,
    saveSettings: "저장",
    settingsSavedNote: "설정이 저장되었습니다.",

    // ---------- Bottom panel ----------
    currentPlayerLabel: (nickname) => `${nickname}의 차례`,
    actionThrow: "윷을 던져 시작하세요.",
    actionThrowBonus: "보너스 던지기! 다시 던지세요.",
    actionSelectResult: "아래에서 결과를 선택한 뒤 말을 클릭하세요.",
    actionSelectPiece: "강조된 말 중 하나를 클릭해 이동하세요.",
    actionGameOver: (nickname) => `${nickname}님이 승리했습니다!`,
    moveWithLabel: "이동 수단:",
    pendingResultsLabel: "대기 중인 이동",
    noPendingResults: "대기 중인 이동이 없습니다.",
    forfeitedNote: (list) => `${list} — 사용할 말이 없어 소멸됨.`,
    selectedPieceLabel: "선택한 말",
    noPieceSelected: "선택한 말이 없습니다.",
    stateWaiting: "대기",
    stateActive: "이동 중",
    stateHome: "완주",
    atNodeLabel: (position) => `위치: ${position}`,
    stackedSuffix: (count) => ` (업힌 말 ×${count})`,
    instructionsLine: "던지고, 결과를 고른 뒤 이동할 말을 클릭하세요. 상대 말을 잡으면 보너스 던지기를 얻고, 내 말끼리는 업어서 함께 이동할 수 있습니다.",
    gameLogToggleLabel: "기록",
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

// Display names for each throw outcome (PRD.md §5). Separate from STRINGS
// since these are keyed by ThrowType, not by a fixed set of UI labels.
const THROW_RESULT_NAMES = {
  en: { DO: "Do", GAE: "Gae", GEOL: "Geol", YUT: "Yut", MO: "Mo", BACKDO: "Back Do" },
  ko: { DO: "도", GAE: "개", GEOL: "걸", YUT: "윷", MO: "모", BACKDO: "백도" },
};

/**
 * @param {'en'|'ko'} language
 * @param {'DO'|'GAE'|'GEOL'|'YUT'|'MO'|'BACKDO'} throwType
 */
export function throwResultLabel(language, throwType) {
  const dict = THROW_RESULT_NAMES[language] ?? THROW_RESULT_NAMES.en;
  return dict[throwType] ?? throwType;
}
