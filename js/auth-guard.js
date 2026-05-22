// js/auth-guard.js

async function checkAuth(options = {}) {
    const {
        requireAuth = false,
        redirectIfLoggedIn = false
    } = options;

    try {
        const res = await fetch("/me", {
            credentials: "include"
        });

        const data = await res.json();

        // ===== Geschützte Seite =====
        if (requireAuth && !data.loggedIn) {
            window.location.replace("login.html");
            return null;
        }

        // ===== Login/Register Seite =====
        if (redirectIfLoggedIn && data.loggedIn) {
            window.location.replace("tempPersonalDashboard.html");
            return data.user;
        }

        return data.user || null;

    } catch (err) {
        console.error("Auth Guard Fehler:", err);

        if (requireAuth) {
            window.location.replace("login.html");
        }

        return null;
    }
}