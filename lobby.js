import { supabase } from "./supabase.js";

const DIFF_LABEL = { easy: "Novice", medium: "Climber", hard: "Apex" };

const entryView = document.getElementById("entryView");
const waitingView = document.getElementById("waitingView");
const matchView = document.getElementById("matchView");

const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const joinCodeInput = document.getElementById("joinCode");
const entryMessage = document.getElementById("entryMessage");

const roomCodeEl = document.getElementById("roomCode");
const copyHint = document.getElementById("copyHint");
const playerListEl = document.getElementById("playerList");
const hostBadge = document.getElementById("hostBadge");
const startBtn = document.getElementById("startBtn");
const leaveBtn = document.getElementById("leaveBtn");
const waitingMessage = document.getElementById("waitingMessage");
const difficultyBar = document.getElementById("difficultyBar");
const difficultyDisplay = document.getElementById("difficultyDisplay");
const difficultyText = document.getElementById("difficultyText");
const navUserEl = document.getElementById("navUser");

const matchDiff = document.getElementById("matchDiff");
const matchCode = document.getElementById("matchCode");
const questionText = document.getElementById("questionText");
const answerInput = document.getElementById("answerInput");
const submitBtn = document.getElementById("submitBtn");
const feedback = document.getElementById("feedback");
const scoreDisplay = document.getElementById("scoreDisplay");
const timerEl = document.getElementById("timer");
const gameOverEl = document.getElementById("gameOver");
const finalScoresEl = document.getElementById("finalScores");
const rematchBtn = document.getElementById("rematchBtn");
const backToLobbyBtn = document.getElementById("backToLobbyBtn");
const scoreboardListEl = document.getElementById("scoreboardList");

let ws = null;
let myId = null;
let myUsername = "climber";
let isHost = false;
let roomCode = null;
let currentDifficulty = "easy";
let currentQuestionId = null;
let players = [];   // [{id, username, score, is_host}]
let timerInterval = null;

function show(view) {
  entryView.classList.toggle("hidden", view !== "entry");
  waitingView.classList.toggle("hidden", view !== "waiting");
  matchView.classList.toggle("hidden", view !== "match");
}

function setHostUI() {
  hostBadge.textContent = isHost ? "Host" : "Joined";
  startBtn.style.display = isHost ? "" : "none";
  difficultyBar.style.display = isHost ? "" : "none";
  difficultyDisplay.style.display = isHost ? "none" : "";
  rematchBtn.style.display = isHost ? "" : "none";
}

function setDifficultyUI(diff) {
  currentDifficulty = diff;
  document.querySelectorAll(".diff-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.level === diff);
  });
  difficultyText.textContent = DIFF_LABEL[diff] || "Novice";
  matchDiff.textContent = DIFF_LABEL[diff] || "Novice";
}

function renderPlayers() {
  playerListEl.innerHTML = "";
  for (const p of players) {
    const li = document.createElement("li");
    li.className = "player-row";
    const dot = document.createElement("span");
    dot.className = "player-dot";
    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = p.username + (p.id === myId ? " (you)" : "");
    li.appendChild(dot);
    li.appendChild(name);
    if (p.is_host) {
      const tag = document.createElement("span");
      tag.className = "player-host-tag";
      tag.textContent = "HOST";
      li.appendChild(tag);
    }
    playerListEl.appendChild(li);
  }
}

function renderScoreboard(scores) {
  scoreboardListEl.innerHTML = "";
  scores.forEach((p, i) => {
    const li = document.createElement("li");
    li.className = "scoreboard-row" + (p.player_id === myId ? " is-me" : "");
    li.innerHTML = `
      <span class="scoreboard-rank">${i + 1}</span>
      <span class="scoreboard-name">${p.username}${p.player_id === myId ? " (you)" : ""}</span>
      <span class="scoreboard-score numeric">${p.score}</span>
    `;
    scoreboardListEl.appendChild(li);
  });
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function setEntryError(text) {
  entryMessage.textContent = text;
  entryMessage.className = "message";
}

function startCountdown(duration) {
  clearInterval(timerInterval);
  let left = duration;
  timerEl.textContent = left;
  timerEl.className = "timer";
  timerInterval = setInterval(() => {
    left--;
    timerEl.textContent = left;
    if (left <= 10) timerEl.className = "timer danger";
    else if (left <= 20) timerEl.className = "timer warning";
    if (left <= 0) clearInterval(timerInterval);
  }, 1000);
}

function resetMatchUI() {
  scoreDisplay.textContent = "0";
  feedback.textContent = "";
  feedback.className = "feedback";
  answerInput.value = "";
  answerInput.disabled = false;
  submitBtn.disabled = false;
  gameOverEl.style.display = "none";
  questionText.textContent = "? × ?";
}

function handleMessage(msg) {
  switch (msg.type) {
    case "room_created":
    case "room_joined": {
      roomCode = msg.code;
      isHost = !!msg.is_host;
      players = msg.players;
      setDifficultyUI(msg.difficulty);
      roomCodeEl.textContent = msg.code;
      matchCode.textContent = msg.code;
      setHostUI();
      renderPlayers();
      show("waiting");
      break;
    }
    case "player_joined": {
      players.push({
        id: msg.player.id,
        username: msg.player.username,
        score: msg.player.score || 0,
        is_host: false,
      });
      renderPlayers();
      break;
    }
    case "player_left": {
      players = players.filter(p => p.id !== msg.player_id);
      renderPlayers();
      break;
    }
    case "host_changed": {
      players = players.map(p => ({ ...p, is_host: p.id === msg.host_id }));
      isHost = msg.host_id === myId;
      setHostUI();
      renderPlayers();
      break;
    }
    case "difficulty_changed": {
      setDifficultyUI(msg.difficulty);
      break;
    }
    case "game_started": {
      resetMatchUI();
      show("match");
      answerInput.focus();
      startCountdown(msg.duration || 60);
      // initial scoreboard from waiting-room players
      renderScoreboard(players.map(p => ({
        player_id: p.id, username: p.username, score: 0,
      })));
      break;
    }
    case "question": {
      currentQuestionId = msg.question_id;
      questionText.textContent = msg.question;
      answerInput.value = "";
      answerInput.disabled = false;
      submitBtn.disabled = false;
      answerInput.className = "";
      feedback.textContent = "";
      feedback.className = "feedback";
      answerInput.focus();
      break;
    }
    case "answer_result": {
      scoreDisplay.textContent = String(msg.score);
      if (msg.correct) {
        feedback.textContent = "Correct!";
        feedback.className = "feedback";
        answerInput.classList.add("correct");
      } else {
        feedback.textContent = `Wrong! Answer was ${msg.correct_answer}`;
        feedback.className = "feedback wrong";
        answerInput.classList.add("incorrect");
      }
      break;
    }
    case "score_update": {
      renderScoreboard(msg.scores);
      break;
    }
    case "game_over": {
      clearInterval(timerInterval);
      timerEl.textContent = "0";
      finalScoresEl.innerHTML = "";
      msg.final_scores.forEach((p, i) => {
        const li = document.createElement("li");
        li.className = "final-score-row" + (p.player_id === myId ? " is-me" : "");
        li.innerHTML = `<span class="scoreboard-rank">${i + 1}</span>
                        <span class="scoreboard-name">${p.username}</span>
                        <span class="scoreboard-score numeric">${p.score}</span>`;
        finalScoresEl.appendChild(li);
      });
      gameOverEl.style.display = "flex";
      answerInput.disabled = true;
      submitBtn.disabled = true;
      break;
    }
    case "error": {
      if (entryView.classList.contains("hidden")) {
        waitingMessage.textContent = msg.message;
      } else {
        setEntryError(msg.message);
      }
      break;
    }
  }
}

function submitAnswer() {
  const v = answerInput.value.trim();
  if (!v || !currentQuestionId) return;
  send({ type: "submit_answer", question_id: currentQuestionId, answer: Number(v) });
  // Lock until server responds with the next question.
  answerInput.disabled = true;
  submitBtn.disabled = true;
}

submitBtn.addEventListener("click", submitAnswer);
answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitAnswer();
  if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") e.preventDefault();
});

createBtn.addEventListener("click", () => {
  setEntryError("");
  send({ type: "create_room", difficulty: "easy" });
});

joinBtn.addEventListener("click", () => {
  const code = (joinCodeInput.value || "").trim().toUpperCase();
  if (code.length !== 6) {
    setEntryError("Enter a 6-character code.");
    return;
  }
  setEntryError("");
  send({ type: "join_room", code });
});

joinCodeInput.addEventListener("input", () => {
  joinCodeInput.value = joinCodeInput.value.toUpperCase();
});
joinCodeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinBtn.click();
});

document.querySelectorAll("#difficultyBar .diff-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (!isHost) return;
    send({ type: "set_difficulty", difficulty: btn.dataset.level });
  });
});

startBtn.addEventListener("click", () => {
  if (!isHost) return;
  send({ type: "start_game" });
});

leaveBtn.addEventListener("click", () => {
  send({ type: "leave_room" });
  location.href = "home.html";
});

rematchBtn.addEventListener("click", () => {
  if (!isHost) return;
  send({ type: "start_game" });
});

backToLobbyBtn.addEventListener("click", () => {
  // Server already considers the room in `finished` state. Easiest path: leave + reload.
  send({ type: "leave_room" });
  location.href = "home.html";
});

roomCodeEl.addEventListener("click", async () => {
  if (!roomCode) return;
  try {
    await navigator.clipboard.writeText(roomCode);
    copyHint.textContent = "Copied";
    setTimeout(() => (copyHint.textContent = "Click to copy"), 1200);
  } catch {
    copyHint.textContent = "Copy failed";
  }
});

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.href = "index.html";
    return;
  }
  myId = session.user.id;
  myUsername = session.user.user_metadata?.username || session.user.email || "climber";
  navUserEl.textContent = myUsername;

  const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${wsProto}//${location.host}/ws/lobby?token=${encodeURIComponent(session.access_token)}`);

  ws.addEventListener("message", (e) => {
    try { handleMessage(JSON.parse(e.data)); } catch {}
  });
  ws.addEventListener("close", () => {
    waitingMessage.textContent = "Disconnected from server.";
  });
  ws.addEventListener("error", () => {
    setEntryError("Could not reach server.");
  });
}

init();
