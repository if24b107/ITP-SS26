fetch("/partials/navbarGuest.html")
    .then(response => response.text())
    .then(data => {

        document.getElementById("navbar-placeholder").innerHTML = data;

        markGuestActiveLink();
        initGuestLogout();

    })
    .catch(error => {
        console.error("Fehler beim Laden der Gast-Navbar:", error);
    });


function markGuestActiveLink() {

    const currentPath = window.location.pathname;

    document.querySelectorAll(".nav-link").forEach(link => {

        const href = link.getAttribute("href");

        if (!href) return;

        const linkPath = new URL(
            href,
            window.location.origin
        ).pathname;

        if (linkPath === currentPath) {

            link.classList.add("active");
            link.setAttribute("aria-current", "page");

        }
    });
}


function initGuestLogout() {

    const logoutBtn = document.getElementById("guest-logout-btn");

    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", async (e) => {

        e.preventDefault();

        try {

            await fetch("/guest/logout", {
                method: "POST",
                credentials: "include"
            });

            window.location.replace(
                "/pages/auth/guestLogin.html"
            );

        } catch (err) {

            console.error("Gast Logout Fehler:", err);

        }
    });
}