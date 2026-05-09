document.addEventListener("DOMContentLoaded", async () => {

    const favoriteButtons = document.querySelectorAll(".favorite-btn");

    // =========================
    // CHECK LOGIN STATUS (FRONTEND LOGIC)
    // =========================
    let isLoggedIn = false;

    try {
        const res = await fetch("/me", {
            credentials: "include"
        });

        const data = await res.json();
        isLoggedIn = data.loggedIn;

    } catch (err) {
        console.error("Auth check failed", err);
    }

    // =========================
    // IF NOT LOGGED IN --> HIDE HEARTS (FRONTEND)
    // =========================
    if (!isLoggedIn) {
        favoriteButtons.forEach(btn => {
            btn.style.display = "none";
        });

        return; // keine Favorites-Funktion aktivieren
    }

    // =========================
    // FAVORITES (CURRENT FRONTEND - LOCAL STORAGE)
    // =========================
    let favorites = JSON.parse(localStorage.getItem("favorites")) || [];

    favoriteButtons.forEach(btn => {

        const card = btn.closest(".catering-card");

        const itemId = card.dataset.id;
        const itemType = btn.dataset.type;

        const favoriteKey = `${itemType}-${itemId}`;

        // UI initial state
        if (favorites.includes(favoriteKey)) {
            btn.classList.add("active");
            btn.innerHTML = `<i class="fa-solid fa-heart"></i>`;
        }

        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            toggleFavorite(btn, favoriteKey);
        });
    });

    function toggleFavorite(button, key) {

        const isActive = button.classList.contains("active");

        // =========================
        // REMOVE FAVORITE
        // =========================
        if (isActive) {
            button.classList.remove("active");
            button.innerHTML = `<i class="fa-regular fa-heart"></i>`;

            favorites = favorites.filter(fav => fav !== key);

            // =========================
            // BACKEND TODO: DELETE /favorites
            // =========================

        }

        // =========================
        // ADD FAVORITE
        // =========================
        else {
            button.classList.add("active");
            button.innerHTML = `<i class="fa-solid fa-heart"></i>`;

            favorites.push(key);

            // =========================
            // BACKEND TODO: POST /favorites
            // =========================
            
        }

        // CURRENT FRONTEND STORAGE -->SPÄTER ENTFERNEN (SOBALD BACKEND EINGEBAUT)
        localStorage.setItem("favorites", JSON.stringify(favorites));
    }
});