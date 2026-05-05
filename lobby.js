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
const scoreboardListEl = document.getElementById("scoreboardList");
const statsAfterGameBtn = document.getElementById("statsAfterGameBtn");
const homeAfterGameBtn = document.getElementById("homeAfterGameBtn");

const treeWrap = document.getElementById("treeWrap");

const TREE_RUNGS = 12;
const TREE_HEIGHT = 520;
const TREE_TARGET = 20;

let lanes = new Map();

let ws = null;
let myId = null;
let myUsername = "climber";
let isHost = false;
let roomCode = null;
let currentDifficulty = "easy";
let currentQuestionId = null;
let players = [];
let timerInterval = null;
let resultSaved = false;

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
  document.querySelectorAll(".diff-btn").forEach((b) => {
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
  if (!ws) {
    setEntryError("Not connected yet — refresh the page.");
    return;
  }

  if (ws.readyState === WebSocket.CONNECTING) {
    setEntryError("Still connecting — try again in a second.");
    return;
  }

  if (ws.readyState !== WebSocket.OPEN) {
    setEntryError("Disconnected from server. Refresh to reconnect.");
    return;
  }

  ws.send(JSON.stringify(msg));
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
  resultSaved = false;
  scoreDisplay.textContent = "0";
  feedback.textContent = "";
  feedback.className = "feedback";
  answerInput.value = "";
  answerInput.disabled = false;
  submitBtn.disabled = false;
  gameOverEl.style.display = "none";
  questionText.textContent = "? × ?";
}

async function saveMultiplayerResult(finalScores) {
  if (resultSaved) return;
  resultSaved = true;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    console.error("No active session. Multiplayer score not saved.");
    return;
  }

  const myResult = finalScores.find((p) => p.player_id === myId);

  if (!myResult) {
    console.error("Could not find current user's score in final scores.");
    return;
  }

  const { error } = await supabase.from("game_results").insert({
    user_id: session.user.id,
    score: myResult.score,
    difficulty: currentDifficulty,
    duration_seconds: 60,
    mode: "multiplayer",
  });

  if (error) {
    console.error("Error saving multiplayer score:", error.message);
  } else {
    console.log("Multiplayer score saved successfully.");
  }
}

function buildLanes() {
  if (!treeWrap) return;

  treeWrap.innerHTML = "";
  lanes = new Map();

  const ordered = [
    ...players.filter((p) => p.id === myId),
    ...players.filter((p) => p.id !== myId),
  ];

  ordered.forEach((p, idx) => {
    const isMe = p.id === myId;
    const hue = (idx * 47) % 360;

    const lane = document.createElement("div");
    lane.className = "iri-tree-lane" + (isMe ? " is-me" : "");
    lane.dataset.pid = p.id;

    const tree = document.createElement("div");
    tree.className = "iri-tree";

    const track = document.createElement("div");
    track.className = "iri-tree-track";
    tree.appendChild(track);

    const finish = document.createElement("div");
    finish.className = "iri-tree-finish";
    finish.textContent = "0";
    tree.appendChild(finish);

    const rungs = [];

    for (let i = 0; i < TREE_RUNGS; i++) {
      const t = i / (TREE_RUNGS - 1);
      const top = t * (TREE_HEIGHT - 60) + 20;

      const rung = document.createElement("div");
      rung.className = "iri-tree-rung";
      rung.style.top = top + "px";
      rung.dataset.threshold = (1 - t).toFixed(3);

      tree.appendChild(rung);
      rungs.push(rung);
    }

    const monkeyHolder = document.createElement("div");
    monkeyHolder.className = "iri-tree-monkey";
    monkeyHolder.style.top = TREE_HEIGHT - 40 + "px";

    const monkey = document.createElement("div");
    monkey.dataset.monkey = "";
    monkey.dataset.size = "56";
    monkey.dataset.hue = String(hue);

    monkeyHolder.appendChild(monkey);
    tree.appendChild(monkeyHolder);

    const label = document.createElement("div");
    label.className = "iri-tree-label";

    const eyebrow = document.createElement("div");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "P" + String(idx + 1).padStart(2, "0");

    const nameEl = document.createElement("div");
    nameEl.className = "iri-tree-label-name";
    nameEl.textContent = isMe ? `${p.username} (you)` : p.username;
    nameEl.title = p.username;

    const scoreEl = document.createElement("div");
    scoreEl.className = "iri-tree-label-score";
    scoreEl.textContent = "000";

    label.appendChild(eyebrow);
    label.appendChild(nameEl);
    label.appendChild(scoreEl);

    lane.appendChild(tree);
    lane.appendChild(label);
    treeWrap.appendChild(lane);

    lanes.set(p.id, {
      lane,
      monkey: monkeyHolder,
      scoreEl,
      finishEl: finish,
      rungs,
    });
  });

  if (window.ClimbQuestMonkey?.mount) {
    window.ClimbQuestMonkey.mount();
  }
}

function setLaneProgress(pid, score) {
  const entry = lanes.get(pid);
  if (!entry) return;

  const progress = Math.min(1, score / TREE_TARGET);

  entry.rungs.forEach((r) => {
    const threshold = parseFloat(r.dataset.threshold);
    r.classList.toggle("reached", threshold <= progress + 0.001);
  });

  const monkeyY = (1 - progress) * (TREE_HEIGHT - 60) + 20;
  entry.monkey.style.top = monkeyY + "px";

  if (progress >= 0.999) {
    entry.finishEl.classList.add("reached");
    entry.finishEl.textContent = "▲";
  } else {
    entry.finishEl.classList.remove("reached");
    entry.finishEl.textContent = Math.round(progress * 100);
  }

  entry.scoreEl.textContent = String(score).padStart(3, "0");
}

function applyAllScores(scores) {
  for (const s of scores) {
    setLaneProgress(s.player_id, s.score);
  }
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
      players = players.filter((p) => p.id !== msg.player_id);
      renderPlayers();
      break;
    }

    case "host_changed": {
      players = players.map((p) => ({ ...p, is_host: p.id === msg.host_id }));
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
      buildLanes();

      for (const p of players) {
        setLaneProgress(p.id, 0);
      }

      answerInput.focus();
      startCountdown(msg.duration || 60);

      renderScoreboard(
        players.map((p) => ({
          player_id: p.id,
          username: p.username,
          score: 0,
        }))
      );

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
      const prevScore = parseInt(scoreDisplay.textContent || "0", 10);
      scoreDisplay.textContent = String(msg.score);

      if (msg.correct) {
        feedback.textContent = "Correct!";
        feedback.className = "feedback";
        answerInput.classList.add("correct");
      } else {
        const lost = prevScore - msg.score;
        feedback.textContent = lost
          ? `Wrong! −1 · Answer was ${msg.correct_answer}`
          : `Wrong! Answer was ${msg.correct_answer}`;
        feedback.className = "feedback wrong";
        answerInput.classList.add("incorrect");
      }

      break;
    }

    case "score_update": {
      renderScoreboard(msg.scores);
      applyAllScores(msg.scores);
      break;
    }

    case "game_over": {
      clearInterval(timerInterval);
      timerEl.textContent = "0";

      saveMultiplayerResult(msg.final_scores);

      finalScoresEl.innerHTML = "";

      msg.final_scores.forEach((p, i) => {
        const li = document.createElement("li");
        li.className = "final-score-row" + (p.player_id === myId ? " is-me" : "");

        li.innerHTML = `
          <span class="scoreboard-rank">${i + 1}</span>
          <span class="scoreboard-name">${p.username}${p.player_id === myId ? " (you)" : ""}</span>
          <span class="scoreboard-score numeric">${p.score}</span>
        `;

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

  send({
    type: "submit_answer",
    question_id: currentQuestionId,
    answer: Number(v),
  });

  answerInput.disabled = true;
  submitBtn.disabled = true;
}

submitBtn.addEventListener("click", submitAnswer);

answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitAnswer();

  if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
    e.preventDefault();
  }
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

document.querySelectorAll("#difficultyBar .diff-btn").forEach((btn) => {
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

statsAfterGameBtn?.addEventListener("click", () => {
  location.href = "stats.html";
});

homeAfterGameBtn?.addEventListener("click", () => {
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
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    location.href = "index.html";
    return;
  }

  myId = session.user.id;
  myUsername = session.user.user_metadata?.username || session.user.email || "climber";
  navUserEl.textContent = myUsername;

  const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsProto}//${location.host}/ws/lobby?token=${encodeURIComponent(
    session.access_token
  )}`;

  console.log("[lobby] connecting to", wsUrl);
  setEntryError("Connecting…");

  ws = new WebSocket(wsUrl);

  ws.addEventListener("open", () => {
    console.log("[lobby] WS open");
    setEntryError("");
  });

  ws.addEventListener("message", (e) => {
    console.log("[lobby] <-", e.data);

    try {
      handleMessage(JSON.parse(e.data));
    } catch (err) {
      console.error("[lobby] bad JSON from server:", err);
    }
  });

  ws.addEventListener("close", (e) => {
    console.warn("[lobby] WS closed", e.code, e.reason);

    const reason = e.reason ? `: ${e.reason}` : "";

    if (e.code === 4401) {
      setEntryError(`Auth failed${reason}. Sign out and sign back in.`);
    } else if (e.code === 1006) {
      setEntryError("Server not reachable. Is uvicorn running on port 3000?");
    } else {
      setEntryError(`Disconnected (code ${e.code}${reason}).`);
    }

    waitingMessage.textContent = `Disconnected (code ${e.code}${reason}).`;
  });

  ws.addEventListener("error", (e) => {
    console.error("[lobby] WS error", e);
    setEntryError("WebSocket error — check the browser console.");
  });
}

init();
