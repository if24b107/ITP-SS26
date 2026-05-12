document.addEventListener("DOMContentLoaded", async () => {

    const favoriteButtons = document.querySelectorAll(".favorite-btn");
    if (favoriteButtons.length === 0) return;

    // CHECK LOGIN STATUS
    let isLoggedIn = false;
    try {
        const res = await fetch("/me", { credentials: "include" });
        const data = await res.json();
        isLoggedIn = data.loggedIn;
    } catch (err) {
        console.error("Auth check failed", err);
    }

    // Nicht eingeloggt -> Hearts ausblenden, keine Favoriten-Logik
    if (!isLoggedIn) {
        favoriteButtons.forEach(btn => { btn.style.display = "none"; });
        return;
    }

    // FAVORITEN AUS BACKEND LADEN
    // Set mit Keys "type-id", damit O(1)-Lookup pro Button moeglich ist
    const favoriteSet = new Set();
    try {
        const res = await fetch("/favorites", { credentials: "include" });
        if (res.ok) {
            const data = await res.json();
            (data.favorites || []).forEach(f => {
                favoriteSet.add(f.item_type + "-" + f.item_id);
            });
        } else {
            console.error("Konnte Favoriten nicht laden:", res.status);
        }
    } catch (err) {
        console.error("Favoriten laden fehlgeschlagen", err);
    }

    // BUTTONS INITIALISIEREN
    favoriteButtons.forEach(btn => {
        const card = btn.closest(".catering-card");
        if (!card) return;

        const itemId = card.dataset.id;
        const itemType = btn.dataset.type;
        const key = itemType + "-" + itemId;

        setActive(btn, favoriteSet.has(key));

        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(btn, itemType, itemId);
        });
    });

    // TOGGLE (POST oder DELETE)
    async function toggleFavorite(button, itemType, itemId) {
        const key = itemType + "-" + itemId;
        const wasActive = button.classList.contains("active");

        // Doppelklicks waehrend des Requests verhindern
        if (button.disabled) return;
        button.disabled = true;

        // Optimistic UI: erst toggeln, bei Fehler revertieren
        setActive(button, !wasActive);

        try {
            if (wasActive) {
                // ENTFERNEN
                const url = "/favorites/" + encodeURIComponent(itemType) + "/" + encodeURIComponent(itemId);
                const res = await fetch(url, { method: "DELETE", credentials: "include" });
                if (!res.ok) throw new Error("DELETE fehlgeschlagen (" + res.status + ")");
                favoriteSet.delete(key);
            } else {
                // HINZUFUEGEN
                const res = await fetch("/favorites", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ item_type: itemType, item_id: itemId })
                });
                // 409 (existiert schon) ist okay -> trotzdem als aktiv halten
                if (!res.ok && res.status !== 409) {
                    throw new Error("POST fehlgeschlagen (" + res.status + ")");
                }
                favoriteSet.add(key);
            }
        } catch (err) {
            console.error("Favorit-Toggle fehlgeschlagen:", err);
            // Revert UI auf den vorherigen Zustand
            setActive(button, wasActive);
        } finally {
            button.disabled = false;
        }
    }

    function setActive(button, active) {
        if (active) {
            button.classList.add("active");
            button.innerHTML = '<i class="fa-solid fa-heart"></i>';
        } else {
            button.classList.remove("active");
            button.innerHTML = '<i class="fa-regular fa-heart"></i>';
        }
    }
});
