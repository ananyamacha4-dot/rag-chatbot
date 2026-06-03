import { api } from "./api.js";
import { redirectIfAuthenticated, saveSession } from "./auth.js";

redirectIfAuthenticated();

const form = document.getElementById("loginForm");
const status = document.getElementById("authStatus");
const submitButton = document.getElementById("submitButton");

function setStatus(message, isError = false) {
    status.textContent = message;
    status.style.color = isError ? "var(--danger)" : "var(--muted)";
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
        setStatus("Enter both username and password.", true);
        return;
    }

    submitButton.disabled = true;
    setStatus("Signing in...");

    try {
        const response = await api.login(username, password);
        saveSession(response);
        window.location.href = "/ui/dashboard.html";
    } catch (error) {
        setStatus(error.message, true);
    } finally {
        submitButton.disabled = false;
    }
});
