import { supabase } from "./supabase.js";

const totalGamesEl = document.getElementById("totalGames");
const bestScoreEl = document.getElementById("bestScore");
const dailyHighEl = document.getElementById("dailyHigh");
const weeklyHighEl = document.getElementById("weeklyHigh");
const recentGamesEl = document.getElementById("recentGames");

async function loadStats() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "index.html";
    return;
  }

  const { data, error } = await supabase
    .from("game_results")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("mode", "multiplayer")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading stats:", error.message);
    return;
  }

  const games = data || [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const scores = games.map((g) => g.score);
  const todayGames = games.filter((g) => new Date(g.created_at) >= todayStart);
  const weekGames = games.filter((g) => new Date(g.created_at) >= weekStart);

  totalGamesEl.textContent = games.length;
  bestScoreEl.textContent = scores.length ? Math.max(...scores) : 0;
  dailyHighEl.textContent = todayGames.length
    ? Math.max(...todayGames.map((g) => g.score))
    : 0;
  weeklyHighEl.textContent = weekGames.length
    ? Math.max(...weekGames.map((g) => g.score))
    : 0;

  recentGamesEl.innerHTML = games.length
    ? games
        .slice(0, 8)
        .map((game) => {
          const date = new Date(game.created_at).toLocaleDateString();
          return `
            <tr>
              <td>${date}</td>
              <td>${game.difficulty}</td>
              <td>${game.score}</td>
            </tr>
          `;
        })
        .join("")
    : `
      <tr>
        <td colspan="3">No multiplayer games played yet.</td>
      </tr>
    `;

  const chartGames = games.slice(0, 10).reverse();

  new Chart(document.getElementById("scoreChart"), {
    type: "line",
    data: {
      labels: chartGames.map((g) =>
        new Date(g.created_at).toLocaleDateString()
      ),
      datasets: [
        {
          label: "Multiplayer Score",
          data: chartGames.map((g) => g.score),
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

loadStats();