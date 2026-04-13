
require("dotenv").config();
const supabase = require("./supabaseClient");
const bcrypt = require("bcrypt");
/*
require('dotenv').config();
const supabase = require('./supabaseClient');
const bcrypt = require('bcrypt');
*/

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());


/*
 =========================
   ALTER LOGIN
========================= 
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username und Passwort erforderlich"
      });
    }

    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .limit(1);

    if (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Datenbankfehler"
      });
    }

    if (!users || users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Benutzer nicht gefunden"
      });
    }

    const user = users[0];

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Falsches Passwort"
      });
    }

    return res.json({
      success: true,
      message: "Login erfolgreich"
    });
  }
});
*/

/*
// LOGIN - Prüfung von Benutzername/Passwort
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    //Fake-Datenbank (statt Hardcode)
    const fakeDB = [
        { email: "admin@test.com", password: "1234" }
    ];

    //"User aus DB holen"
    const user = fakeDB.find(u => u.username === username);

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
*/


/* =========================
   REGISTRIERUNG
========================= */
app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 1. Validierung
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Alle Felder sind erforderlich"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Passwort zu kurz (min. 6 Zeichen)"
      });
    }

    // 2. prüfen ob User existiert
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: "User existiert bereits"
      });
    }

    // 3. Passwort hashen
    const password_hash = await bcrypt.hash(password, 10);

    // 4. speichern
    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          username,
          email,
          password_hash
        }
      ])
      .select();

    if (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Fehler beim Speichern"
      });
    }

    return res.status(201).json({
      success: true,
      message: "Registrierung erfolgreich",
      user: data
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Serverfehler"
    });
  }
});

// LOGOUT

app.post("/logout", (req, res) => {
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Backend läuft auf Port ${PORT}`);
});