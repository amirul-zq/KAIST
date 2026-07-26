// ---- Board geometry: 20 outer stations (0-19) + 9 inner (8 diagonal + center) ----
const corners = {
  c0:  {x:95, y:95}, // bottom-right: START / HOME
  c5:  {x:95, y:5},  // top-right
  c10: {x:5,  y:5},  // top-left
  c15: {x:5,  y:95}, // bottom-left
};
const center = {x:50, y:50};

function lerp(a,b,t){ return { x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t }; }

const stations = {}; // id -> {x,y,type}

stations[0]  = {...corners.c0,  type:'corner', label:'Start'};
stations[5]  = {...corners.c5,  type:'corner', label:'★'};
stations[10] = {...corners.c10, type:'corner', label:'★'};
stations[15] = {...corners.c15, type:'corner', label:''};

// outer edges: 4 intermediate points per side
const sides = [
  [0,5],   // right side, going up
  [5,10],  // top side, going left
  [10,15], // left side, going down
  [15,20], // bottom side, going right (20 == 0)
];
sides.forEach(([a,b])=>{
  const from = stations[a];
  const to = corners[ 'c'+(b%20) ];
  for(let i=1;i<5;i++){
    const id = a+i;
    stations[id] = {...lerp(from,to,i/5), type:'edge', label:''};
  }
});

// diagonal 1: corner5 -> center -> corner15
stations['d1'] = {...lerp(corners.c5, center, 1/3), type:'diag'};
stations['d2'] = {...lerp(corners.c5, center, 2/3), type:'diag'};
stations['ctr'] = {...center, type:'center', label:''};
stations['d3'] = {...lerp(center, corners.c15, 1/3), type:'diag'};
stations['d4'] = {...lerp(center, corners.c15, 2/3), type:'diag'};

// diagonal 2: corner10 -> center -> corner0
stations['d5'] = {...lerp(corners.c10, center, 1/3), type:'diag'};
stations['d6'] = {...lerp(corners.c10, center, 2/3), type:'diag'};
stations['d7'] = {...lerp(center, corners.c0, 1/3), type:'diag'};
stations['d8'] = {...lerp(center, corners.c0, 2/3), type:'diag'};

// ---- connections (for drawing lines) ----
const outerChain = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,0];
const diagChain1 = [5,'d1','d2','ctr','d3','d4',15];
const diagChain2 = [10,'d5','d6','ctr','d7','d8',0];

function chainToPairs(chain){
  const pairs = [];
  for(let i=0;i<chain.length-1;i++) pairs.push([chain[i], chain[i+1]]);
  return pairs;
}
const allLines = [
  ...chainToPairs(outerChain),
  ...chainToPairs(diagChain1),
  ...chainToPairs(diagChain2),
];

// ---- render ----
const svg = document.getElementById('lines');
svg.setAttribute('viewBox','0 0 100 100');
svg.setAttribute('preserveAspectRatio','none');

allLines.forEach(([a,b])=>{
  const p1 = stations[a], p2 = stations[b];
  const line = document.createElementNS('http://www.w3.org/2000/svg','line');
  line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y);
  line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y);
  line.setAttribute('stroke', '#241F1B');
  line.setAttribute('stroke-width', '0.6');
  line.setAttribute('vector-effect','non-scaling-stroke');
  svg.appendChild(line);
});

const boardWrap = document.getElementById('boardWrap');
Object.entries(stations).forEach(([id, s])=>{
  const el = document.createElement('div');
  el.className = 'station ' + s.type + (id==='0' ? ' start' : '');
  el.style.left = s.x + '%';
  el.style.top = s.y + '%';
  el.dataset.id = id;
  if(s.type === 'corner'){
    el.innerHTML = '<span class="label">' + (s.label || '') + '</span>';
  }
  boardWrap.appendChild(el);
});

// ==================== Stick Throw Mechanic ====================
const RESULT_TABLE = {
  0: { name:'Mo',  move:5,  extra:true  }, // 0 flat-up = all round = Mo
  1: { name:'Do',  move:1,  extra:false },
  2: { name:'Gae', move:2,  extra:false },
  3: { name:'Geol',move:3,  extra:false },
  4: { name:'Yut', move:4,  extra:true  },
};

const tray = document.getElementById('tray');
const throwBtn = document.getElementById('throwBtn');
const resultEl = document.getElementById('result');
const historyEl = document.getElementById('history');
const backDoToggle = document.getElementById('backDoToggle');

let throwing = false;
const stickEls = [];

// Build 4 sticks. When Back-Do rule is on, the 4th stick is the "special" marked stick.
function buildSticks(){
  tray.innerHTML = '';
  stickEls.length = 0;
  const useBackDo = backDoToggle.checked;
  for(let i=0;i<4;i++){
    const el = document.createElement('div');
    el.className = 'stick' + (useBackDo && i===3 ? ' special' : '');
    el.innerHTML = '<div class="face round"></div><div class="face flat"></div>';
    tray.appendChild(el);
    stickEls.push(el);
  }
}
buildSticks();
backDoToggle.addEventListener('change', buildSticks);

function throwSticks(){
  if(throwing || gameOver) return;
  throwing = true;
  throwBtn.disabled = true;
  sfxThrow();

  const useBackDo = backDoToggle.checked;
  // decide each stick's landing face: true = flat-up
  const faces = stickEls.map(()=> Math.random() < 0.5);
  const flatCount = faces.filter(Boolean).length;

  stickEls.forEach((el, i)=>{
    el.style.setProperty('--final', faces[i] ? '180deg' : '0deg');
    el.classList.remove('throwing');
    void el.offsetWidth; // restart animation
    el.classList.add('throwing');
  });

  setTimeout(()=>{
    stickEls.forEach((el,i)=>{
      el.style.transform = faces[i] ? 'rotateY(180deg)' : 'rotateY(0deg)';
    });

    // ---- Determine result ----
    let outcome = { ...RESULT_TABLE[flatCount], name: RESULT_TABLE[flatCount].name };
    let isBackDo = false;

    // Back-Do rule: if exactly one stick is flat-up AND it is the special (4th) stick,
    // and it is the ONLY flat one, the throw becomes Back-Do (-1) instead of Do.
    if(useBackDo && flatCount === 1 && faces[3] === true){
      outcome = { name:'Back-Do', move:-1, extra:false };
      isBackDo = true;
    }

    showResult(outcome, faces, isBackDo);
    addHistory(outcome.name);
    throwing = false;

    handleThrowResult(outcome);
  }, 720);
}

function showResult(outcome, faces, isBackDo){
  const nameEl = resultEl.querySelector('.name');
  const metaEl = resultEl.querySelector('.meta');
  const existingBadge = resultEl.querySelector('.extra');
  if(existingBadge) existingBadge.remove();

  nameEl.textContent = outcome.name;
  nameEl.style.color = isBackDo ? '#8AA5C9' : 'var(--yellow)';
  metaEl.textContent = `Moves ${outcome.move} space${Math.abs(outcome.move)===1?'':'s'}` +
                        (isBackDo ? ' (backward)' : '');

  if(outcome.extra){
    const badge = document.createElement('div');
    badge.className = 'extra';
    badge.textContent = '★ Extra Throw';
    resultEl.appendChild(badge);
  }
}

function addHistory(name){
  const chip = document.createElement('div');
  chip.className = 'chip';
  chip.textContent = name;
  historyEl.insertBefore(chip, historyEl.firstChild);
  while(historyEl.children.length > 5){ // Limit chips to fit height constraints
    historyEl.removeChild(historyEl.lastChild);
  }
}

throwBtn.addEventListener('click', throwSticks);

// ==================== Players, Pieces & Turns ====================
const PLAYER_COLORS = ['var(--red)', 'var(--blue)'];
const players = [0,1].map(pid => ({
  id: pid,
  name: pid===0 ? 'Player 1' : 'Player 2',
  pieces: Array.from({length:4}, (_,i)=>({ id: pid+'-'+i, state:'waiting', pos:0 }))
}));

let currentPlayer = 0;
let awaitingMove = false;
let currentOutcome = null;
let gameOver = false;

let vsAI = false;
let aiDifficulty = 'medium';
const AI_PLAYER = 1;

const turnBanner = document.getElementById('turnBanner');
const movePrompt = document.getElementById('movePrompt');
const piecesLayer = document.getElementById('piecesLayer');

// ---- Forward movement graph (built from the same chains used to draw the board) ----
const NEXT = {};
function addEdge(a,b){
  NEXT[a] = NEXT[a] || [];
  if(!NEXT[a].includes(b)) NEXT[a].push(b);
}
addEdge('START', 1);
for(let i=0;i<outerChain.length-1;i++) addEdge(outerChain[i], outerChain[i+1]);
for(let i=0;i<diagChain1.length-1;i++) addEdge(diagChain1[i], diagChain1[i+1]);
for(let i=0;i<diagChain2.length-1;i++) addEdge(diagChain2[i], diagChain2[i+1]);

const BRANCH_LABELS = {
  6:  'Outer Path',
  11: 'Outer Path',
  d1: 'Shortcut ★',
  d5: 'Shortcut ★',
  d3: 'To Bottom-Left',
  d7: 'Shortcut ★ → Home',
};

function isNumericPos(pos){ return /^\d+$/.test(String(pos)); }

async function chooseBranch(node){
  const options = NEXT[node];
  return new Promise(resolve=>{
    movePrompt.innerHTML = '<div>Choose a path:</div>';
    const row = document.createElement('div');
    row.className = 'branchRow';
    options.forEach(opt=>{
      const btn = document.createElement('button');
      const label = BRANCH_LABELS[opt] || 'Outer Path';
      btn.className = 'branchBtn' + (label.includes('Shortcut') ? ' shortcut' : '');
      btn.textContent = label;
      btn.addEventListener('click', ()=> resolve(opt));
      row.appendChild(btn);
    });
    movePrompt.appendChild(row);
  });
}

async function advancePiece(startNode, steps, decide){
  decide = decide || chooseBranch;
  let node = startNode;
  for(let i=0;i<steps;i++){
    const options = NEXT[node];
    if(!options || options.length === 0) break;
    const next = options.length > 1 ? await decide(node) : options[0];
    node = next;
    if(node === 0 || node === '0') return 'HOME';
  }
  return node;
}

// ---- AI decision-making ----
function aiPolicySync(node){
  const opts = NEXT[node];
  if(!opts || opts.length <= 1) return opts ? opts[0] : null;
  if(aiDifficulty === 'easy'){
    return opts[Math.floor(Math.random()*opts.length)];
  }
  if(node === 'ctr'){
    return opts.includes('d7') ? 'd7' : opts[0]; // medium/hard always cut to home from center
  }
  const shortcut = opts.find(o => String(o).startsWith('d'));
  return shortcut || opts[0];
}
async function aiDecideBranch(node){ return aiPolicySync(node); }

function simulateAdvance(startNode, steps){
  let node = startNode;
  for(let i=0;i<steps;i++){
    const opts = NEXT[node];
    if(!opts || !opts.length) break;
    node = opts.length > 1 ? aiPolicySync(node) : opts[0];
    if(node === 0 || node === '0') return 'HOME';
  }
  return node;
}

function aiSelectPiece(outcome, options){
  if(aiDifficulty === 'easy'){
    return options[Math.floor(Math.random()*options.length)];
  }

  const oppId = 1 - currentPlayer;
  let best = null, bestScore = -Infinity;

  options.forEach(pc=>{
    let score = 0;
    let finalNode;

    if(outcome.move < 0){
      const newPos = Number(pc.pos) + outcome.move;
      finalNode = newPos <= 0 ? 'RETREAT' : String(newPos);
      if(newPos <= 0) score -= 20;
    } else {
      const startNode = pc.state === 'waiting' ? 'START' : String(pc.pos);
      finalNode = simulateAdvance(startNode, outcome.move);
    }

    if(finalNode === 'HOME'){
      score += 50;
    } else if(finalNode !== 'RETREAT'){
      const opp = players[oppId];
      const captureHit = opp.pieces.some(p => p.state==='board' && String(p.pos)===String(finalNode));
      if(captureHit) score += 100;

      const ownStack = players[currentPlayer].pieces.some(p => p!==pc && p.state==='board' && String(p.pos)===String(finalNode));
      if(ownStack) score += 25;

      const progressGuess = isNumericPos(finalNode) ? Number(finalNode) : 15;
      score += progressGuess * (aiDifficulty === 'hard' ? 1 : 0.5);

      if(aiDifficulty === 'hard' && isNumericPos(finalNode)){
        const fn = Number(finalNode);
        const threatened = players[oppId].pieces.some(p=>{
          if(p.state !== 'board' || !isNumericPos(p.pos)) return false;
          const d = fn - Number(p.pos);
          return d > 0 && d <= 5;
        });
        if(threatened) score -= 15;
      }
    }

    if(score > bestScore){ bestScore = score; best = pc; }
  });

  return best || options[0];
}

function legalPieces(outcome){
  const p = players[currentPlayer];
  if(outcome.move > 0){
    return p.pieces.filter(pc => pc.state === 'waiting' || pc.state === 'board');
  } else {
    // Back-Do: only pieces already on the board, moving along the outer ring, can go back
    return p.pieces.filter(pc => pc.state === 'board' && isNumericPos(pc.pos));
  }
}

function handleThrowResult(outcome){
  currentOutcome = outcome;
  const options = legalPieces(outcome);

  if(options.length === 0){
    movePrompt.textContent = outcome.move < 0
      ? 'No piece on the board to send back — turn passes.'
      : 'No available piece — turn passes.';
    setTimeout(()=> endTurn(false), 900);
    return;
  }

  awaitingMove = true;
  updateThrowButtonState();

  if(vsAI && currentPlayer === AI_PLAYER){
    movePrompt.textContent = 'AI is thinking…';
    renderAll();
    setTimeout(()=>{
      const chosen = aiSelectPiece(outcome, options);
      movePiece(chosen, aiDecideBranch);
    }, 650);
    return;
  }

  movePrompt.textContent = 'Tap a glowing piece to move it';
  renderAll();
}

let resolving = false;

async function movePiece(piece, decide){
  resolving = true;
  renderAll();
  const outcome = currentOutcome;
  const owner = currentPlayer;

  if(outcome.move < 0){
    // Back-Do: simple step back along the outer ring
    const newPos = Number(piece.pos) + outcome.move;
    if(newPos <= 0){ piece.pos = '0'; piece.state = 'waiting'; }
    else { piece.pos = String(newPos); piece.state = 'board'; }
  } else {
    const startNode = piece.state === 'waiting' ? 'START' : String(piece.pos);
    const finalNode = await advancePiece(startNode, outcome.move, decide);
    if(finalNode === 'HOME'){
      piece.state = 'home';
      piece.pos = '0';
    } else {
      piece.pos = String(finalNode);
      piece.state = 'board';
    }
  }

  // ---- Capture check: landing exactly on a rival sends their whole stack home ----
  let captured = false;
  if(piece.state === 'board'){
    const opp = players[1 - owner];
    const hit = opp.pieces.filter(pc => pc.state === 'board' && String(pc.pos) === String(piece.pos));
    if(hit.length > 0){
      hit.forEach(pc => { pc.state = 'waiting'; pc.pos = '0'; });
      captured = true;
    }
  }

  awaitingMove = false;
  resolving = false;
  const hadExtra = outcome.extra || captured;
  currentOutcome = null;
  movePrompt.textContent = captured ? '★ Capture! Extra throw earned.' : '';
  renderAll();

  if(captured) sfxCapture();
  else if(hadExtra) sfxExtra();
  else sfxMove();

  if(checkWin()) return;
  endTurn(hadExtra);
}

function checkWin(){
  const winnerId = players.findIndex(p => p.pieces.every(pc => pc.state === 'home'));
  if(winnerId === -1) return false;
  gameOver = true;
  updateThrowButtonState();
  showGameOver(winnerId);
  return true;
}

function showGameOver(winnerId){
  const label = (vsAI && winnerId === AI_PLAYER) ? `AI (${aiDifficulty})` : players[winnerId].name;
  document.getElementById('modalTitle').textContent = `${label} Wins!`;
  document.getElementById('modalSub').textContent = 'All 4 pieces reached Home';
  document.getElementById('overlay').classList.add('show');
  sfxWin();
}

function endTurn(extraTurn){
  updateThrowButtonState();
  if(!extraTurn){
    currentPlayer = 1 - currentPlayer;
  }
  updateTurnUI();
  maybeAITurn();
}

function updateThrowButtonState(){
  throwBtn.disabled = throwing || awaitingMove || gameOver || (vsAI && currentPlayer === AI_PLAYER);
}

function maybeAITurn(){
  if(gameOver) return;
  if(vsAI && currentPlayer === AI_PLAYER && !awaitingMove && !throwing){
    setTimeout(()=> throwSticks(), 800);
  }
}

function updateTurnUI(){
  const p = players[currentPlayer];
  const label = (vsAI && currentPlayer === AI_PLAYER) ? `AI (${aiDifficulty})` : p.name;
  turnBanner.textContent = `${label}'s turn`;
  turnBanner.className = 'turnbanner p' + currentPlayer;
  document.getElementById('playerCard0').classList.toggle('active', currentPlayer===0);
  document.getElementById('playerCard1').classList.toggle('active', currentPlayer===1);
}

function renderAll(){
  renderTrays();
  renderBoardPieces();
  renderHomeCounts();
}

function renderTrays(){
  [0,1].forEach(pid=>{
    const trayEl = document.getElementById('tray'+pid);
    trayEl.innerHTML = '';
    const p = players[pid];
    const waiting = p.pieces.filter(pc=>pc.state==='waiting');
    waiting.forEach(pc=>{
      const el = document.createElement('div');
      const movable = awaitingMove && !resolving && currentPlayer===pid && currentOutcome && currentOutcome.move > 0 && !(vsAI && pid===AI_PLAYER);
      el.className = 'wtoken' + (movable ? ' movable' : '');
      el.style.background = PLAYER_COLORS[pid];
      if(movable) el.addEventListener('click', ()=> movePiece(pc));
      trayEl.appendChild(el);
    });
  });
}

function renderBoardPieces(){
  piecesLayer.innerHTML = '';
  // group on-board pieces by station for stacking offsets
  const groups = {};
  players.forEach(p=>{
    p.pieces.filter(pc=>pc.state==='board').forEach(pc=>{
      (groups[pc.pos] = groups[pc.pos] || []).push({pc, pid:p.id});
    });
  });

  Object.entries(groups).forEach(([pos, occupants])=>{
    const s = stations[pos];
    if(!s) return;
    occupants.forEach((occ, i)=>{
      const off = occupants.length > 1 ? (i - (occupants.length-1)/2) * 3 : 0;
      const el = document.createElement('div');
      const movable = awaitingMove && !resolving && currentPlayer === occ.pid && currentOutcome &&
                      (currentOutcome.move > 0 || (currentOutcome.move < 0 && isNumericPos(occ.pc.pos))) &&
                      !(vsAI && occ.pid===AI_PLAYER);
      el.className = 'bpiece' + (movable ? ' movable' : '');
      el.style.background = PLAYER_COLORS[occ.pid];
      el.style.left = (s.x + off) + '%';
      el.style.top = (s.y + off) + '%';
      if(movable) el.addEventListener('click', ()=> movePiece(occ.pc));
      piecesLayer.appendChild(el);
    });
  });
}

function renderHomeCounts(){
  [0,1].forEach(pid=>{
    const count = players[pid].pieces.filter(pc=>pc.state==='home').length;
    document.getElementById('home'+pid).textContent = count;
  });
}

// ==================== Sound ====================
let audioCtx = null;
let soundOn = true;
function ensureAudio(){
  if(!audioCtx){
    try{ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){}
  }
}
function playTone(freq, dur, type, delay, vol){
  if(!soundOn) return;
  ensureAudio();
  if(!audioCtx) return;
  const t0 = audioCtx.currentTime + (delay||0);
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol||0.13, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(t0); osc.stop(t0 + dur);
}
function sfxThrow(){ playTone(300,0.08,'triangle',0,0.1); playTone(260,0.08,'triangle',0.08,0.08); }
function sfxMove(){ playTone(440,0.09,'sine'); }
function sfxExtra(){ playTone(700,0.1,'sine'); playTone(920,0.12,'sine',0.09); }
function sfxCapture(){ playTone(190,0.14,'sawtooth'); playTone(120,0.2,'sawtooth',0.1); }
function sfxWin(){ [523,659,784,1047].forEach((f,i)=> playTone(f,0.22,'sine',i*0.15,0.14)); }

const soundBtn = document.getElementById('soundBtn');
soundBtn.addEventListener('click', ()=>{
  soundOn = !soundOn;
  soundBtn.textContent = soundOn ? '🔊' : '🔇';
  if(soundOn) ensureAudio();
});

const rulesBtn = document.getElementById('rulesBtn');
const rulesPanel = document.getElementById('rulesPanel');
rulesBtn.addEventListener('click', ()=> rulesPanel.classList.toggle('open'));

document.getElementById('modalNewGameBtn').addEventListener('click', resetGame);

// ==================== Mode controls & reset ====================
const aiDifficultySelect = document.getElementById('aiDifficultySelect');
const resetBtn = document.getElementById('resetBtn');
const p2name = document.getElementById('p2name');

function updateP2Label(){
  p2name.textContent = vsAI ? `AI (${aiDifficulty[0].toUpperCase()+aiDifficulty.slice(1)})` : 'Player 2';
}

document.querySelectorAll('input[name="mode"]').forEach(r=>{
  r.addEventListener('change', ()=>{
    vsAI = document.querySelector('input[name="mode"]:checked').value === 'ai';
    aiDifficultySelect.disabled = !vsAI;
    updateP2Label();
    resetGame();
  });
});
aiDifficultySelect.addEventListener('change', ()=>{
  aiDifficulty = aiDifficultySelect.value;
  updateP2Label();
  resetGame();
});
resetBtn.addEventListener('click', resetGame);

function resetGame(){
  players.forEach(p => p.pieces.forEach(pc => { pc.state = 'waiting'; pc.pos = 0; }));
  currentPlayer = 0;
  awaitingMove = false;
  resolving = false;
  throwing = false;
  gameOver = false;
  currentOutcome = null;
  movePrompt.textContent = '';
  historyEl.innerHTML = '';
  resultEl.querySelector('.name').textContent = '—';
  resultEl.querySelector('.name').style.color = 'var(--yellow)';
  resultEl.querySelector('.meta').textContent = 'Throw the sticks to begin';
  const badge = resultEl.querySelector('.extra');
  if(badge) badge.remove();
  document.getElementById('overlay').classList.remove('show');
  buildSticks();
  updateThrowButtonState();
  updateTurnUI();
  renderAll();
}

// Initial triggers
updateTurnUI();
renderAll();