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

/*=========================
   TERMIN ANLEGEN
   Tabelle: calendar (id, user_id, title, date, time, description)
=========================*/
app.post("/appointments", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Nicht eingeloggt"
    });
  }

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
          user_id: req.session.user.id,
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

//POST /wedding-date – Datum speichern
app.post("/wedding-date", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false, message: "Nicht eingeloggt" });
  const { wedding_date } = req.body;
  if (!wedding_date) return res.status(400).json({ success: false, message: "Datum fehlt" });
  const { error } = await supabase
    .from("users")
    .update({ wedding_date })
    .eq("id", req.session.user.id);
  if (error) return res.status(500).json({ success: false, message: "Fehler beim Speichern" });
  return res.json({ success: true });
});
// GET /wedding-date – Datum laden
app.get("/wedding-date", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false, message: "Nicht eingeloggt" });
  const { data, error } = await supabase
    .from("users")
    .select("wedding_date")
    .eq("id", req.session.user.id)
    .single();
  if (error) return res.status(500).json({ success: false, message: "Fehler beim Laden" });
  return res.json({ success: true, wedding_date: data.wedding_date });
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});

/* =========================
   GAST HINZUFÜGEN
========================= */
app.post("/guests", async (req, res) => {
  try {
    const { guest_name, rsvp_status, num_guests, notes } = req.body;
    const trimmedName = typeof guest_name === "string" ? guest_name.trim() : "";
    const parsedNumGuests = Number(num_guests);

    if (!trimmedName || !rsvp_status) {
      return res.status(400).json({
        success: false,
        message: "Name und Status erforderlich"
      });
    }

    if (!Number.isFinite(parsedNumGuests)) {
      return res.status(400).json({
        success: false,
        message: "Begleitpersonen muss eine gueltige Zahl sein"
      });
    }

    const rsvpDate = (rsvp_status === "zugesagt" || rsvp_status === "abgesagt")
      ? new Date().toISOString()
      : null;

    const { data, error } = await supabase
      .from("guests")
      .insert([
        {
          guest_name: trimmedName,
          rsvp_status,
          num_guests: parsedNumGuests,
          rsvp_date: rsvpDate,
          notes: notes || null
        }
      ])
      .select();

    if (error) throw error;

    res.json({
      success: true,
      data: data[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Fehler beim Hinzufügen des Gastes"
    });
  }
});

/* =========================
   GAST AKTUALISIEREN
========================= */
app.put("/guests/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { guest_name, rsvp_status, num_guests, notes } = req.body;

    const updates = {};

    if (guest_name !== undefined) {
      const trimmedName = typeof guest_name === "string" ? guest_name.trim() : "";
      if (!trimmedName) {
        return res.status(400).json({
          success: false,
          message: "Name darf nicht leer sein"
        });
      }
      updates.guest_name = trimmedName;
    }

    if (rsvp_status !== undefined) {
      updates.rsvp_status = rsvp_status;
      updates.rsvp_date = (rsvp_status === "zugesagt" || rsvp_status === "abgesagt")
        ? new Date().toISOString()
        : null;
    }

    if (num_guests !== undefined) {
      const parsedNumGuests = Number(num_guests);
      if (!Number.isFinite(parsedNumGuests)) {
        return res.status(400).json({
          success: false,
          message: "Begleitpersonen muss eine gueltige Zahl sein"
        });
      }
      updates.num_guests = parsedNumGuests;
    }

    if (notes !== undefined) {
      updates.notes = notes || null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Keine gueltigen Felder zum Aktualisieren uebergeben"
      });
    }

    const { data, error } = await supabase
      .from("guests")
      .update(updates)
      .eq("id", id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gast nicht gefunden"
      });
    }

    res.json({
      success: true,
      data: data[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Fehler beim Aktualisieren des Gastes"
    });
  }
});

/* =========================
   GÄSTE ABRUFEN
========================= */
app.get("/guests", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("guests")
      .select("*");

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Fehler beim Abrufen der Gäste"
    });
  }
});

/* =========================
   GAST LÖSCHEN
========================= */
app.delete("/guests/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("guests")
      .delete()
      .eq("id", id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gast nicht gefunden"
      });
    }

    res.json({
      success: true,
      message: "Gast erfolgreich gelöscht"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Fehler beim Löschen des Gastes"
    });
  }
});

/* =========================
   TODOS
========================= */

// Middleware: prüft, ob der User eingeloggt ist
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Nicht eingeloggt" });
  }
  next();
}

// priority wird im Frontend als String ("low"/"medium"/"high") verwendet,
// in der DB aber als int4 (1/2/3) gespeichert. Hier wird hin und her gemappt.
const PRIORITY_STR_TO_INT = { low: 1, medium: 2, high: 3 };
const PRIORITY_INT_TO_STR = { 1: "low", 2: "medium", 3: "high" };

function priorityToInt(value) {
  if (value === null || value === undefined) return 2; // default = medium
  if (typeof value === "number") return value;
  return PRIORITY_STR_TO_INT[value] ?? 2;
}

function todoForClient(todo) {
  if (!todo) return todo;
  return { ...todo, priority: PRIORITY_INT_TO_STR[todo.priority] || "medium" };
}

// GET /todos – alle Aufgaben des eingeloggten Users laden
app.get("/todos", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const { data, error } = await supabase
      .from("todo")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Datenbankfehler" });
    }

    return res.json({ success: true, todos: (data || []).map(todoForClient) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

// POST /todos – neue Aufgabe erstellen
app.post("/todos", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { title, priority, due_date, description } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Titel erforderlich" });
    }

    const newTodo = {
      user_id: userId,
      title: title.trim(),
      priority: priorityToInt(priority),
      completed: false,
      due_date: due_date || null,
      description: description || null
    };

    const { data, error } = await supabase
      .from("todo")
      .insert([newTodo])
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Fehler beim Speichern" });
    }

    return res.status(201).json({ success: true, todo: todoForClient(data) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

// PUT /todos/:id – Aufgabe aktualisieren (auch zum Abhaken)
app.put("/todos/:id", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const todoId = req.params.id;
    const { title, priority, due_date, description, completed } = req.body;

    // nur Felder updaten, die wirklich mitgeschickt wurden
    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (priority !== undefined) updates.priority = priorityToInt(priority);
    if (due_date !== undefined) updates.due_date = due_date || null;
    if (description !== undefined) updates.description = description || null;
    if (completed !== undefined) updates.completed = completed;

    const { data, error } = await supabase
      .from("todo")
      .update(updates)
      .eq("id", todoId)
      .eq("user_id", userId) // Sicherheit: nur eigene Tasks
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Fehler beim Aktualisieren" });
    }

    if (!data) {
      return res.status(404).json({ success: false, message: "Aufgabe nicht gefunden" });
    }

    return res.json({ success: true, todo: todoForClient(data) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

// DELETE /todos/:id – Aufgabe löschen
app.delete("/todos/:id", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const todoId = req.params.id;

    const { error } = await supabase
      .from("todo")
      .delete()
      .eq("id", todoId)
      .eq("user_id", userId);

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Fehler beim Löschen" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});