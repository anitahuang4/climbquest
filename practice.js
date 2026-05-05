import { supabase } from "./supabase.js";

const BACKEND = "";

// Game state
let currentAnswer = null;
let score = 0;
let timeLeft = 60;
let timerInterval = null;
let difficulty = "easy";
let lastQuestion = "";

// Canvas setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// DOM refs
const questionText = document.getElementById("questionText");
const answerInput = document.getElementById("answerInput");
const submitBtn = document.getElementById("submitBtn");
const feedback = document.getElementById("feedback");
const scoreDisplay = document.getElementById("scoreDisplay");
const timerEl = document.getElementById("timer");
const gameOverEl = document.getElementById("gameOver");
const finalScoreEl = document.getElementById("finalScore");
const playAgainBtn = document.getElementById("playAgainBtn");

// Difficulty buttons
document.querySelectorAll(".diff-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".diff-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    difficulty = btn.dataset.level;

    clearInterval(timerInterval);
    score = 0;
    lastQuestion = "";
    scoreDisplay.textContent = 0;
    gameOverEl.style.display = "none";
    submitBtn.disabled = false;
    answerInput.disabled = false;

    loadQuestion();
    startTimer();
  });
});

// Draw the tree and monkey
function drawGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // TODO: Add tree and monkey drawings
}

// Animate monkey climbing up or down
function animateMonkey(direction) {
  // TODO: Add animation logic
}

// Fetch a question from backend
async function loadQuestion() {
  try {
    const res = await fetch(`${BACKEND}/question?difficulty=${difficulty}`);
    const data = await res.json();

    if (data.question === lastQuestion) {
      loadQuestion();
      return;
    }

    lastQuestion = data.question;
    currentAnswer = data.answer;
    questionText.textContent = data.question;
    answerInput.value = "";
    answerInput.className = "";
    answerInput.focus();
    feedback.textContent = "";
    feedback.className = "feedback";
  } catch (err) {
    let a, b;
    if (difficulty === "easy") {
      a = Math.floor(Math.random() * 6) + 1;
      b = Math.floor(Math.random() * 6) + 1;
    } else if (difficulty === "medium") {
      a = Math.floor(Math.random() * 12) + 1;
      b = Math.floor(Math.random() * 3) + 7;
    } else {
      a = Math.floor(Math.random() * 15) + 1;
      b = Math.floor(Math.random() * 6) + 10;
    }

    const question = `${a} × ${b}`;

    if (question === lastQuestion) {
      loadQuestion();
      return;
    }

    lastQuestion = question;
    currentAnswer = a * b;
    questionText.textContent = question;
    answerInput.value = "";
    answerInput.className = "";
    answerInput.focus();
    feedback.textContent = "";
    feedback.className = "feedback";
  }
}

// Validate answer
async function submitAnswer() {
  const playerAnswer = answerInput.value.trim();
  if (!playerAnswer) return;

  let success = false;

  try {
    const res = await fetch(`${BACKEND}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerAnswer: Number(playerAnswer), correctAnswer: currentAnswer })
    });
    const data = await res.json();
    success = data.success;
  } catch {
    success = Number(playerAnswer) === currentAnswer;
  }

  if (success) {
    score++;
    scoreDisplay.textContent = score;
    feedback.textContent = "Correct!";
    feedback.className = "feedback";
    answerInput.classList.add("correct");
    animateMonkey("up");
    setTimeout(loadQuestion, 600);
  } else {
    feedback.textContent = `Wrong! The answer was ${currentAnswer}`;
    feedback.className = "feedback wrong";
    answerInput.classList.add("incorrect");
    answerInput.disabled = true;
    submitBtn.disabled = true;
    animateMonkey("down");
    setTimeout(() => {
      answerInput.disabled = false;
      submitBtn.disabled = false;
      loadQuestion();
    }, 1200);
  }
}

// Timer
function startTimer() {
  timeLeft = 60;
  timerEl.textContent = timeLeft;
  timerEl.className = "timer";

  timerInterval = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;

    if (timeLeft <= 10) timerEl.className = "timer danger";
    else if (timeLeft <= 20) timerEl.className = "timer warning";

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);
}

// End game
function endGame() {
  submitBtn.disabled = true;
  answerInput.disabled = true;
  finalScoreEl.textContent = score;
  gameOverEl.style.display = "flex";

  saveGameResult();
}

async function saveGameResult() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    console.error("No active session. Score not saved.");
    return;
  }

  const username =
    session.user.user_metadata?.username ||
    session.user.email?.split("@")[0] ||
    "climber";

  const payload = {
    user_id: session.user.id,
    score: score,
    difficulty: difficulty,
    duration_seconds: 60,
    username,
  };

  let { error } = await supabase.from("game_results").insert(payload);

  // Backwards compatibility: if the `username` column doesn't exist yet on
  // game_results, retry without it so older Supabase schemas keep working.
  if (error && /username/i.test(error.message)) {
    delete payload.username;
    ({ error } = await supabase.from("game_results").insert(payload));
  }

  if (error) {
    console.error("Error saving game result:", error.message);
  } else {
    console.log("Game result saved successfully.");
  }
}

// Play again
playAgainBtn.addEventListener("click", () => {
  score = 0;
  lastQuestion = "";
  scoreDisplay.textContent = 0;
  gameOverEl.style.display = "none";
  submitBtn.disabled = false;
  answerInput.disabled = false;
  drawGame();
  loadQuestion();
  startTimer();
});

// Submit on button click or Enter key
submitBtn.addEventListener("click", submitAnswer);
answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitAnswer();
  if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
    e.preventDefault();
  }
});

// Check auth session
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return;
  }

  drawGame();
  loadQuestion();
  startTimer();
}

init();