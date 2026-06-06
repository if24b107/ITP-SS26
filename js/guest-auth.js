async function checkGuestAuth() {

    try {

        const res = await fetch("/guest/me", {
            credentials: "include"
        });

        const data = await res.json();

        if (!data.guestLoggedIn) {

            window.location.replace(
                "/pages/auth/guestLogin.html"
            );

            return null;
        }

        return data.guest;

    } catch (err) {

        console.error("Guest Auth Fehler:", err);

        window.location.replace(
            "/pages/auth/guestLogin.html"
        );

        return null;
    }
}


document.addEventListener("DOMContentLoaded", () => {
    checkGuestAuth();
});