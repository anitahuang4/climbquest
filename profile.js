import { supabase } from "./supabase.js";

const navUserEl = document.getElementById("navUser");
const usernameInput = document.getElementById("profileUsername");
const emailInput = document.getElementById("profileEmail");
const profileForm = document.getElementById("profileForm");
const profileSaveBtn = document.getElementById("profileSaveBtn");
const profileMessage = document.getElementById("profileMessage");

const passwordForm = document.getElementById("passwordForm");
const passwordSaveBtn = document.getElementById("passwordSaveBtn");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const passwordMessage = document.getElementById("passwordMessage");

const logoutBtn = document.getElementById("logoutBtn");

let currentUser = null;

async function init() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    location.href = "index.html";
    return;
  }
  currentUser = user;

  const username =
    user.user_metadata?.username ||
    user.email?.split("@")[0] ||
    "climber";
  usernameInput.value = username;
  emailInput.value = user.email || "";
  navUserEl.textContent = username;
}

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  profileMessage.textContent = "";
  profileMessage.classList.remove("success");

  const newUsername = usernameInput.value.trim();
  if (!newUsername) {
    profileMessage.textContent = "Handle cannot be empty.";
    return;
  }

  profileSaveBtn.disabled = true;
  const { data, error } = await supabase.auth.updateUser({
    data: { username: newUsername },
  });
  profileSaveBtn.disabled = false;

  if (error) {
    profileMessage.textContent = error.message;
    return;
  }

  currentUser = data.user;
  navUserEl.textContent = newUsername;
  profileMessage.textContent = "Saved.";
  profileMessage.classList.add("success");
});

passwordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  passwordMessage.textContent = "";
  passwordMessage.classList.remove("success");

  const next = newPasswordInput.value;
  const confirm = confirmPasswordInput.value;

  if (!next || next.length < 6) {
    passwordMessage.textContent = "Password must be at least 6 characters.";
    return;
  }
  if (next !== confirm) {
    passwordMessage.textContent = "Passwords don't match.";
    return;
  }

  passwordSaveBtn.disabled = true;
  const { error } = await supabase.auth.updateUser({ password: next });
  passwordSaveBtn.disabled = false;

  if (error) {
    passwordMessage.textContent = error.message;
    return;
  }

  newPasswordInput.value = "";
  confirmPasswordInput.value = "";
  passwordMessage.textContent = "Password updated.";
  passwordMessage.classList.add("success");
});

logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.href = "index.html";
});

init();
