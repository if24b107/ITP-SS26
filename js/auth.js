document.addEventListener("DOMContentLoaded", () => {

  const form = document.getElementById("loginForm");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        
        localStorage.setItem("user", JSON.stringify({
            email: email
        }));

  // Weiterleitung ohne URL
        window.location.href = "personaldashboard.html";
      } else {
        alert(data.message);
      }

    } catch (error) {
      console.error(error);
      alert("Server nicht erreichbar!");
    }
  });

});

//REGISTRIERUNG
//Testversion: 
function register(event) {
    event.preventDefault();

    alert("Registrierung erfolgreich (Demo)");

    //nur Weiterleitung zurück zum Login
    window.location.href = "login.html";
    }