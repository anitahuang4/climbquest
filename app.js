import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://xyocwmfcfoisxqqxprpi.supabase.co";
const supabaseKey = "sb_publishable_T0j-7LSk51M5H9qCELSbRA_x7yMLOXA";

const supabase = createClient(supabaseUrl, supabaseKey);

const authForm = document.getElementById("authForm");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const registerFields = document.getElementById("registerFields");
const submitBtn = document.getElementById("submitBtn");
const message = document.getElementById("message");
const statsBtn = document.getElementById("statsBtn");

let isLoginMode = true;

if (loginTab && registerTab) {
  loginTab.addEventListener("click", () => {
    isLoginMode = true;
    loginTab.classList.add("active");
    registerTab.classList.remove("active");
    registerFields.classList.add("hidden");
    submitBtn.textContent = "Login";
    message.textContent = "";
  });

  registerTab.addEventListener("click", () => {
    isLoginMode = false;
    registerTab.classList.add("active");
    loginTab.classList.remove("active");
    registerFields.classList.remove("hidden");
    submitBtn.textContent = "Register";
    message.textContent = "";
  });
}

if (authForm) {
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    message.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const usernameInput = document.getElementById("username");
    const username = usernameInput ? usernameInput.value.trim() : "";

    if (!email || !password) {
      message.textContent = "Please fill in all required fields.";
      return;
    }

    if (!isLoginMode && !username) {
      message.textContent = "Please enter a username.";
      return;
    }

    try {
      if (isLoginMode) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          message.textContent = error.message;
          return;
        }

        window.location.href = "home.html";
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username,
            },
          },
        });

        if (error) {
          message.textContent = error.message;
          return;
        }

        message.textContent =
          "Registration successful! You can now log in.";
      }
    } catch (err) {
      console.error(err);
      message.textContent = "Something went wrong.";
    }
  });
}

const welcomeText = document.getElementById("welcomeText");
const joinLobbyBtn = document.getElementById("joinLobbyBtn");
const practiceBtn = document.getElementById("practiceBtn");
const logoutBtn = document.getElementById("logoutBtn");

async function loadUser() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!welcomeText) return;

  if (!session || !session.user) {
    window.location.href = "index.html";
    return;
  }

  const username = session.user.user_metadata?.username;
  const email = session.user.email;

  welcomeText.textContent = `Welcome, ${username || email}! Choose a mode to begin.`;
}

if (welcomeText) {
  loadUser();
}

if (joinLobbyBtn) {
  joinLobbyBtn.addEventListener("click", () => {
    alert("Join Lobby clicked (next step: multiplayer)");
  });
}

if (practiceBtn) {
  practiceBtn.addEventListener("click", () => {
    window.location.href = "practice.html";
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
  });
}

if (statsBtn) {
  statsBtn.addEventListener("click", () => {
    alert("User Statistics clicked (next step: stats page)");
  });
}