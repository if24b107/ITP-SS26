document.addEventListener("DOMContentLoaded", async () => {

    const nav = document.getElementById("auth-nav-item");
    if (!nav) return;

    const res = await fetch("http://localhost:3000/me", {
        credentials: "include"
    });

    const data = await res.json();

    if (data.loggedIn) {
        nav.innerHTML = `
      <a href="personaldashboard.html" class="btn btn-outline-light me-2">Dashboard</a>
      <button onclick="logout()" class="btn btn-danger">Logout</button>
    `;
    } else {
        nav.innerHTML = `
      <a href="login.html" class="btn btn-outline-light">Login</a>
    `;
    }

    window.logout = async function () {
        await fetch("http://localhost:3000/logout", {
            method: "POST",
            credentials: "include"
        });

        window.location.href = "login.html";
    };

});