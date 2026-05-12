require("dotenv").config();
const supabase = require("./supabaseClient");
const bcrypt = require("bcrypt");

const express = require("express");
const cors = require("cors");
const session = require("express-session"); //neu MP

const app = express();
const PORT = 3000;

const path = require("path");

app.use(express.static(path.join(__dirname, "..")));


app.use(express.json());

//Session Config
app.use(session({
  secret: process.env.SESSION_SECRET || "devsecret", //fallback
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: "lax" //before: none
  }
}));

/* =========================
   LOGIN
========================= */
app.post("/login", async (req, res) => {
  try {
    console.log("SESSION BEFORE LOGIN:", req.session);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email und Passwort erforderlich"
      });
    }

    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
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
    console.log("INPUT:", password);
    console.log("HASH:", user.password_hash);

    const isValid = await bcrypt.compare(password, user.password_hash);
    console.log("PASSWORD VALID:", isValid);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Falsche Eingaben"  //zuvor: "falsches passwort"
      });
    }

    //neu: Session setzen
    req.session.user = {
      id: user.id,
      email: user.email,
      username: user.username
    };

    console.log("SESSION AFTER LOGIN:", req.session);
    console.log("SESSION USER:", req.session.user);

    return res.json({
      success: true,
      message: "Login erfolgreich"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Serverfehler"
    });
  }
});

//neu
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

/*=========================
   LOGOUT
========================= */
app.post("/logout", (req, res) => {
  req.session.destroy(() => {       //neu
    res.json({ success: true });
  });
});

/* =========================
   FAVORITES
========================= */

// Middleware: prüft, ob der User eingeloggt ist
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Nicht eingeloggt" });
  }
  next();
}

// Erlaubte item_type-Werte (vermeidet, dass irgendein Frontend-Bug zufaellige Strings reinschreibt)
const ALLOWED_ITEM_TYPES = ["location", "catering"];

// GET /favorites - alle eigenen Favoriten (Catering + Locations) laden
app.get("/favorites", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const { data, error } = await supabase
      .from("favorites")
      .select("id, item_type, item_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Datenbankfehler" });
    }

    return res.json({ success: true, favorites: data || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

// POST /favorites - neuen Favoriten anlegen
app.post("/favorites", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { item_type, item_id } = req.body;

    if (!item_type || !ALLOWED_ITEM_TYPES.includes(item_type)) {
      return res.status(400).json({
        success: false,
        message: "Ungueltiger item_type (erlaubt: location, catering)"
      });
    }
    if (item_id === undefined || item_id === null || item_id === "") {
      return res.status(400).json({ success: false, message: "item_id erforderlich" });
    }

    const { data, error } = await supabase
      .from("favorites")
      .insert([{ user_id: userId, item_type, item_id }])
      .select()
      .single();

    if (error) {
      // 23505 = unique_violation -> Favorit existiert bereits
      if (error.code === "23505") {
        return res.status(409).json({ success: false, message: "Favorit existiert bereits" });
      }
      console.error(error);
      return res.status(500).json({ success: false, message: "Fehler beim Speichern" });
    }

    return res.status(201).json({ success: true, favorite: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

// DELETE /favorites/:type/:id - eigenen Favoriten loeschen
app.delete("/favorites/:type/:id", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { type, id } = req.params;

    if (!ALLOWED_ITEM_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Ungueltiger item_type (erlaubt: location, catering)"
      });
    }

    const { data, error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)       // wichtig: nur eigene Favoriten loeschbar
      .eq("item_type", type)
      .eq("item_id", id)
      .select();

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Fehler beim Loeschen" });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: "Favorit nicht gefunden" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});