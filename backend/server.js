const express = require("express");
const cors = require("cors");
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// LOGIN - Prüfung von Benutzername/Passwort
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    //Fake-Datenbank (statt Hardcode)
    const fakeDB = [
        { email: "admin@test.com", password: "1234" }
    ];

    //"User aus DB holen"
    const user = fakeDB.find(u => u.email === email);

    //User existiert nicht
    if (!user) {
        return res.status(401).json({
        success: false,
        message: "User nicht gefunden"
        });
    }

    //Passwort falsch
    if (user.password !== password) {
        return res.status(401).json({
        success: false,
        message: "Falsches Passwort"
        });
    }

    //Erfolg
    return res.json({
        success: true,
        message: "Login erfolgreich"
    });
});

//erwarteter Code bei vorhandener DB: 
/*
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // User aus DB holen
  const user = await db.getUserByUsername(username);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "User nicht gefunden"
    });
  }

  // Passwort prüfen (später mit bcrypt!)
  if (user.password !== password) {
    return res.status(401).json({
      success: false,
      message: "Falsches Passwort"
    });
  }

  return res.json({
    success: true,
    message: "Login erfolgreich"
  });
}); 
*/

//REGISTRIERUNG: 



// LOGOUT
app.post("/logout", (req, res) => {
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`));
