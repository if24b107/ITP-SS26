require("dotenv").config();
const supabase = require("./supabaseClient");
const bcrypt = require("bcrypt");

const express = require("express");
const cors = require("cors");
const session = require("express-session");

const app = express();
const PORT = 3000;

const path = require("path");

app.use(express.static(path.join(__dirname, "..")));

/*
app.use(cors({
  origin: true,
  credentials: true
}));*/

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || "devsecret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: "lax"
  }
}));

/* =========================
   LOGIN
========================= */
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email und Passwort erforderlich"
      });
    }

    const { data: users } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .limit(1);

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
        message: "Falsche Eingaben"
      });
    }

    req.session.user = {
      id: user.id,
      email: user.email,
      username: user.username
    };

    return res.json({
      success: true,
      message: "Login erfolgreich"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Serverfehler1"
    });
  }
});

/* =========================
   SESSION CHECK
========================= */
app.get("/me", (req, res) => {
  if (req.session.user) {
    return res.json({ loggedIn: true, user: req.session.user });
  } else {
    return res.json({ loggedIn: false });
  }
});

/* =========================
   REGISTRIERUNG
========================= */
app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

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

    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from("users")
      .insert([{ username, email, password_hash }])
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
      message: "Serverfehler2"
    });
  }
});

/* =========================
   LOGOUT
========================= */
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

/*=========================
   TERMIN ANLEGEN
   Tabelle: calendar (id, user_id, title, date, time, description)
=========================*/
app.post("/appointments", async (req, res) => {
  /*if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Nicht eingeloggt"
    });
  }*/

  try {
    const { title, date, time, description } = req.body;

    // Pflichtfelder
    if (!title || !date) {
      return res.status(400).json({
        success: false,
        message: "Titel und Datum sind erforderlich"
      });
    }

    // Datumsformat (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        message: "Ungültiges Datumsformat (erwartet: YYYY-MM-DD)"
      });
    }

    // Zeitformat (HH:MM) – optional
    if (time) {
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!timeRegex.test(time)) {
        return res.status(400).json({
          success: false,
          message: "Ungültiges Zeitformat (erwartet: HH:MM)"
        });
      }
    }

    const { data, error } = await supabase
      .from("calendar")
      .insert([
        {
          user_id: "e323e37d-b016-4dbc-b8f5-150b6d9fd8c3",//req.session.user.id,
          title: title.trim(),
          date: date,
          time: time || null,
          description: description ? description.trim() : null
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
      message: "Termin angelegt",
      appointment: data[0]
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Serverfehler3"
    });
  }
});

//Termine laden
app.get("/appointments", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false, message: "Nicht eingeloggt" });
  const { data, error } = await supabase
    .from("calendar")
    .select("*")
    .eq("user_id", req.session.user.id)
    .order("date", { ascending: true });
  if (error) return res.status(500).json({ success: false, message: "Fehler beim Laden" });
  return res.json({ success: true, appointments: data });
});

//Termin bearbeiten
app.put("/appointments/:id", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false, message: "Nicht eingeloggt" });
  const { title, date, description } = req.body;
  if (!title || !date) return res.status(400).json({ success: false, message: "Titel und Datum erforderlich" });
  const { data, error } = await supabase
    .from("calendar")
    .update({ title: title.trim(), date, description: description || null })
    .eq("id", req.params.id)
    .eq("user_id", req.session.user.id)
    .select();
  if (error) return res.status(500).json({ success: false, message: "Fehler beim Aktualisieren" });
  return res.json({ success: true, appointment: data[0] });
});

//Termin löschen
app.delete("/appointments/:id", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false, message: "Nicht eingeloggt" });
  const { error } = await supabase
    .from("calendar")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.session.user.id);
  if (error) return res.status(500).json({ success: false, message: "Fehler beim Löschen" });
  return res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});