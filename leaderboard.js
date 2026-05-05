import { supabase } from "./supabase.js";

const navUserEl = document.getElementById("navUser");
const logoutBtn = document.getElementById("logoutBtn");
const bodyEl = document.getElementById("leaderboardBody");
const emptyEl = document.getElementById("leaderboardEmpty");

const scopeBtns = document.querySelectorAll("[data-scope]");
const diffBtns = document.querySelectorAll("[data-difficulty]");

let currentScope = "all";
let currentDifficulty = "any";
let myUserId = null;
let cachedRows = null;

const DIFF_LABEL = { easy: "Novice", medium: "Climber", hard: "Apex" };

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.href = "index.html";
    return;
  }
  myUserId = session.user.id;
  const myUsername =
    session.user.user_metadata?.username ||
    session.user.email?.split("@")[0] ||
    "climber";
  navUserEl.textContent = myUsername;

  scopeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      scopeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentScope = btn.dataset.scope;
      render();
    });
  });

  diffBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      diffBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentDifficulty = btn.dataset.difficulty;
      render();
    });
  });

  await loadAndRender(myUsername);
}

async function loadAndRender(myUsername) {
  bodyEl.innerHTML = `<div class="leaderboard-empty">Loading…</div>`;

  // Use SELECT * so the page still works on older schemas that don't have a
  // `username` column on game_results yet — those rows just fall back to the
  // user_id slug.
  const { data, error } = await supabase
    .from("game_results")
    .select("*")
    .order("score", { ascending: false });

  if (error) {
    bodyEl.innerHTML = `<div class="leaderboard-empty">Couldn't load leaderboard: ${escapeHtml(error.message)}</div>`;
    return;
  }

  cachedRows = (data || []).map(row => ({
    ...row,
    // Older rows may not have a username column populated. Use the active
    // user's handle for their own rows; everyone else gets a stable fallback.
    displayName:
      row.username ||
      (row.user_id === myUserId ? myUsername : `Player ${shortId(row.user_id)}`),
  }));

  render();
}

function render() {
  if (!cachedRows) return;

  const rows = cachedRows.filter(matchesFilters);

  // Aggregate per user_id: best score, total games.
  const byUser = new Map();
  for (const row of rows) {
    const existing = byUser.get(row.user_id);
    if (!existing) {
      byUser.set(row.user_id, {
        user_id: row.user_id,
        displayName: row.displayName,
        bestScore: row.score,
        games: 1,
      });
    } else {
      existing.games += 1;
      if (row.score > existing.bestScore) {
        existing.bestScore = row.score;
        existing.displayName = row.displayName;
      }
    }
  }

  const sorted = [...byUser.values()].sort((a, b) => b.bestScore - a.bestScore);

  if (sorted.length === 0) {
    bodyEl.innerHTML = `<div class="leaderboard-empty">No games yet — be the first to climb.</div>`;
    return;
  }

  bodyEl.innerHTML = sorted.map((entry, i) => {
    const isMe = entry.user_id === myUserId;
    const rankBadge = i < 3 ? `<span class="leaderboard-medal medal-${i + 1}">${i + 1}</span>` : `<span class="leaderboard-rank-num">${i + 1}</span>`;
    const nameSuffix = isMe ? ' <span class="leaderboard-you-tag">you</span>' : '';
    return `
      <div class="leaderboard-row${isMe ? " is-me" : ""}">
        <span class="leaderboard-rank-col">${rankBadge}</span>
        <span class="leaderboard-name-col">${escapeHtml(entry.displayName)}${nameSuffix}</span>
        <span class="leaderboard-stat-col numeric">${entry.games}</span>
        <span class="leaderboard-stat-col numeric leaderboard-best">${entry.bestScore}</span>
      </div>
    `;
  }).join("");
}

function matchesFilters(row) {
  if (currentDifficulty !== "any" && row.difficulty !== currentDifficulty) {
    return false;
  }
  if (currentScope === "all") return true;

  const created = new Date(row.created_at);
  const now = new Date();

  if (currentScope === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return created >= start;
  }
  if (currentScope === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return created >= start;
  }
  return true;
}

function shortId(uuid) {
  if (!uuid) return "????";
  return uuid.replace(/-/g, "").slice(-4).toUpperCase();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.href = "index.html";
});

init();
