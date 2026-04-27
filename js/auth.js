document.addEventListener("DOMContentLoaded", () => {

  const form = document.getElementById("loginForm");

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      try {
        const response = await fetch("/login", { //"http://localhost:3000/login"
          method: "POST",
          credentials: "include",               //neu für sessions
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
          window.location.href = "personalDashboard.html"; //oder tempPersonalDashboard.html/personalDashboard.html
        } else {
          alert(data.message);
        }

      } catch (error) {
        alert("Server Fehler");
      }
    });
  }

});


//REGISTRIERUNG Neu

async function register(event) {
  event.preventDefault();

  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const passwordConfirm = document.getElementById("passwordConfirm").value;

  if (!username || !email || !password) {
    alert("Bitte alle Felder ausfüllen");
    return;
  }
  if (password !== passwordConfirm) {
    alert("Passwörter stimmen nicht überein");
    return;
  }

  const res = await fetch("http://localhost:3000/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, email, password })
  });

  const data = await res.json();

  if (data.success) {
    alert("Registrierung erfolgreich");
    window.location.href = "login.html";
  } else {
    alert(data.message);
  }
}
