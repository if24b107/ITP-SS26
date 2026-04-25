require("dotenv").config();
const supabase = require("./supabaseClient");
const bcrypt = require("bcrypt");

const express = require("express");
const cors = require("cors");
const session = require("express-session"); //neu MP

const app = express();
const PORT = 3000;

//neu: flexibler CORS
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

//Session Config
app.use(session({
  secret: process.env.SESSION_SECRET || "devsecret", //fallback
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

    /*  
    if (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        //message: "Datenbankfehler"
      });
    } */

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
        message: "Falsche Eingaben"  //zuvor: "falsches passwort"
      });
    }

    //neu: Session setzen
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

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});  