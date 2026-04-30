// WAIT FOR NAVBAR 
function waitForAuthNavContainers() {
    return new Promise((resolve) => {
        const check = setInterval(() => {
            const dynamicLinks = document.getElementById("dynamic-nav-links");
            const authContainer = document.getElementById("auth-nav-item");
            if (dynamicLinks && authContainer) {
                clearInterval(check);
                resolve({ dynamicLinks, authContainer });
            }
        }, 50);
    });
}

// MAIN AUTH NAV FUNCTION
window.initAuthNav = async function () {

    const { dynamicLinks, authContainer } = await waitForAuthNavContainers();
    if (!dynamicLinks || !authContainer) return;

    try {
        const res = await fetch("/me", {
            credentials: "include"
        });

        const data = await res.json();

        
        // LOGGED IN STATE
        if (data.loggedIn) {
            // Normale Menüpunkte für eingeloggte Benutzer
            dynamicLinks.innerHTML = `
                <li class="nav-item"><a class="nav-link" href="personalDashboard.html">Dashboard</a></li>
                <li class="nav-item"><a class="nav-link" href="calendarOverview.html">Kalender & Termine</a></li>
                <li class="nav-item"><a class="nav-link" href="todo.html">To‑Do‑Liste</a></li>
            `;
            authContainer.innerHTML = `
                <div class="dropdown">
                    <button class="btn btn-link dropdown-toggle profile-icon-btn"
                        type="button" data-bs-toggle="dropdown">
                        <i class="fas fa-user-circle fa-2x"></i>
                    </button>

                    <ul class="dropdown-menu dropdown-menu-end">
                        <li><a class="dropdown-item" href="personalDashboard.html">Dashboard</a></li>
                        <li><a class="dropdown-item" href="calendarOverview.html">Kalender</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item" href="#" id="logout-btn">Logout</a></li>
                    </ul>
                </div>
            `;

            
            const logoutBtn = document.getElementById("logout-btn");

            if (logoutBtn) {
                logoutBtn.addEventListener("click", async (e) => {
                    e.preventDefault();

                    await fetch("/logout", {
                        method: "POST",
                        credentials: "include"
                    });

                    // redirect 
                    window.location.replace("index.html");
                });
            }
        }

        // LOGGED OUT STATE
        else {
            dynamicLinks.innerHTML = "";
            authContainer.innerHTML = `
                <a href="login.html" class="btn login-btn">Login</a>
            `;
        }

    } catch (err) {
        console.error("Auth Nav Fehler:", err);

        dynamicLinks.innerHTML = "";

        // Fallback UI
        authContainer.innerHTML = `
            <a href="login.html" class="btn login-btn">Login</a>
        `;
    }
};

// AUTO INIT 
document.addEventListener("DOMContentLoaded", () => {
    initAuthNav();
});