const SESSION_KEY = "rag_assistant_session";

function decodeJwt(token) {
    try {
        const payload = token.split(".")[1];
        const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(decoded);
    } catch {
        return {};
    }
}

export function saveSession(loginResponse) {
    const tokenData = decodeJwt(loginResponse.access_token || "");
    const user = loginResponse.user || {
        id: loginResponse.user_id || tokenData.user_id,
        username: loginResponse.username || tokenData.username
    };

    const session = {
        token: loginResponse.access_token,
        user
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
}

export function getSession() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch {
        return null;
    }
}

export function requireSession() {
    const session = getSession();

    if (!session || !session.token || !session.user || !session.user.id) {
        window.location.href = "/ui/login.html";
        return null;
    }

    return session;
}

export function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "/ui/login.html";
}

export function redirectIfAuthenticated() {
    const session = getSession();

    if (session && session.token && session.user && session.user.id) {
        window.location.href = "/ui/dashboard.html";
    }
}
