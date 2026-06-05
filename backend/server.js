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

// Middleware: prüft, ob der User eingeloggt ist
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Nicht eingeloggt" });
  }
  next();
}

/* =========================
   FAVORITES
========================= */

// Erlaubte item_type-Werte
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

// Termine laden
app.get("/appointments", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Nicht eingeloggt" });
  }

  const { data, error } = await supabase
    .from("calendar")
    .select("*")
    .eq("user_id", req.session.user.id)
    .order("date", { ascending: true });

  if (error) {
    return res.status(500).json({ success: false, message: "Fehler beim Laden" });
  }

  return res.json({ success: true, appointments: data });
});

// Termin bearbeiten
app.put("/appointments/:id", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Nicht eingeloggt" });
  }

  const { title, date, description } = req.body;

  if (!title || !date) {
    return res.status(400).json({ success: false, message: "Titel und Datum erforderlich" });
  }

  const { data, error } = await supabase
    .from("calendar")
    .update({ title: title.trim(), date, description: description || null })
    .eq("id", req.params.id)
    .eq("user_id", req.session.user.id)
    .select();

  if (error) {
    return res.status(500).json({ success: false, message: "Fehler beim Aktualisieren" });
  }

  return res.json({ success: true, appointment: data[0] });
});

// Termin löschen
app.delete("/appointments/:id", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Nicht eingeloggt" });
  }

  const { error } = await supabase
    .from("calendar")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.session.user.id);

  if (error) {
    return res.status(500).json({ success: false, message: "Fehler beim Löschen" });
  }

  return res.json({ success: true });
});

// POST /wedding-date – Datum speichern
app.post("/wedding-date", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Nicht eingeloggt" });
  }

  const { wedding_date } = req.body;

  if (!wedding_date) {
    return res.status(400).json({ success: false, message: "Datum fehlt" });
  }

  const { error } = await supabase
    .from("users")
    .update({ wedding_date })
    .eq("id", req.session.user.id);

  if (error) {
    return res.status(500).json({ success: false, message: "Fehler beim Speichern" });
  }

  return res.json({ success: true });
});

// GET /wedding-date – Datum laden
app.get("/wedding-date", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Nicht eingeloggt" });
  }

  const { data, error } = await supabase
    .from("users")
    .select("wedding_date")
    .eq("id", req.session.user.id)
    .single();

  if (error) {
    return res.status(500).json({ success: false, message: "Fehler beim Laden" });
  }

  return res.json({ success: true, wedding_date: data.wedding_date });
});

/* =========================
   GAST HINZUFÜGEN
========================= */
app.post("/guests", requireLogin, async (req, res) => {
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
          user_id: req.session.user.id,
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
app.put("/guests/:id", requireLogin, async (req, res) => {
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
      .eq("user_id", req.session.user.id)
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
app.get("/guests", requireLogin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("guests")
      .select("*")
      .eq("user_id", req.session.user.id)
      .order("guest_name", { ascending: true });

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
app.delete("/guests/:id", requireLogin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("guests")
      .delete()
      .eq("id", id)
      .eq("user_id", req.session.user.id)
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

/* =========================
   BUDGET PLANER
   Tabellen: budgets  (id, user_id, name, amount, created_at)
             expenses (id, user_id, budget_id, title, amount, date, created_at)
========================= */

// GET /budget – eigenes Budget laden
app.get("/budget", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const { data, error } = await supabase
      .from("budgets")
      .select("id, name, amount, created_at")
      .eq("user_id", userId)
      .limit(1)
      .single();

    // PGRST116 = kein Eintrag vorhanden → noch kein Budget angelegt
    if (error && error.code !== "PGRST116") {
      console.error(error);
      return res.status(500).json({ success: false, message: "Fehler beim Laden des Budgets" });
    }

    return res.json({ success: true, budget: data || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

// POST /budget – neues Budget anlegen
app.post("/budget", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { name, amount } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Name erforderlich" });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ success: false, message: "Ungültiger Betrag" });
    }

    // Prüfen ob bereits ein Budget existiert
    const { data: existing } = await supabase
      .from("budgets")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Budget existiert bereits – bitte aktualisieren statt neu anlegen"
      });
    }

    const { data, error } = await supabase
      .from("budgets")
      .insert([{ user_id: userId, name: name.trim(), amount: parsedAmount }])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error (budgets):", JSON.stringify(error));
      return res.status(500).json({ success: false, message: error.message || "Fehler beim Speichern" });
    }

    return res.status(201).json({ success: true, budget: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

// PUT /budget/:id – bestehendes Budget aktualisieren
app.put("/budget/:id", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const budgetId = req.params.id;
    const { name, amount } = req.body;

    const updates = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ success: false, message: "Name darf nicht leer sein" });
      }
      updates.name = name.trim();
    }

    if (amount !== undefined) {
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
        return res.status(400).json({ success: false, message: "Ungültiger Betrag" });
      }
      updates.amount = parsedAmount;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "Keine Felder zum Aktualisieren übergeben" });
    }

    const { data, error } = await supabase
      .from("budgets")
      .update(updates)
      .eq("id", budgetId)
      .eq("user_id", userId)   // Sicherheit: nur eigenes Budget änderbar
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Fehler beim Aktualisieren" });
    }

    if (!data) {
      return res.status(404).json({ success: false, message: "Budget nicht gefunden" });
    }

    return res.json({ success: true, budget: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

// DELETE /budget/costs/:id – Ausgabe löschen (nur eigene)
app.delete("/budget/costs/:id", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const expenseId = req.params.id;

    // Budget-IDs des Users ermitteln, damit nur eigene Expenses gelöscht werden können
    const { data: budgets, error: budgetError } = await supabase
      .from("budgets")
      .select("id")
      .eq("user_id", userId);

    if (budgetError) {
      console.error(budgetError);
      return res.status(500).json({ success: false, message: "Fehler beim Prüfen der Budgets" });
    }

    const budgetIds = (budgets || []).map(b => b.id);

    if (budgetIds.length === 0) {
      return res.status(404).json({ success: false, message: "Keine Budgets gefunden" });
    }

    const { data, error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expenseId)
      .in("budget_id", budgetIds)   // Sicherheit: nur Expenses aus eigenen Budgets löschbar
      .select();

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Fehler beim Löschen" });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: "Ausgabe nicht gefunden" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

// GET /budget/summary – vollständige Budgetübersicht:
// maximales Budget, Gesamtausgaben, verbleibendes Budget + Liste aller Expenses
app.get("/budget/summary", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Alle Budgets des Users laden
    const { data: budgets, error: budgetError } = await supabase
      .from("budgets")
      .select("id, amount")
      .eq("user_id", userId);

    if (budgetError) {
      console.error(budgetError);
      return res.status(500).json({ success: false, message: "Fehler beim Laden des Budgets" });
    }

    const totalBudget = (budgets || []).reduce((sum, b) => sum + Number(b.amount), 0);
    const budgetIds = (budgets || []).map(b => b.id);

    // Expenses laden: Summe berechnen + vollständige Liste zurückgeben
    let spent = 0;
    let expenses = [];

    if (budgetIds.length > 0) {
      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("id, title, amount, date, created_at")
        .in("budget_id", budgetIds)
        .order("created_at", { ascending: false });

      if (expensesError) {
        console.error(expensesError);
        return res.status(500).json({ success: false, message: "Fehler beim Laden der Ausgaben" });
      }

      expenses = expensesData || [];
      spent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    }

    return res.json({
      success: true,
      summary: {
        total_budget: totalBudget,
        spent,
        available: totalBudget - spent,
        expenses
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

// GET /budget/costs – Ausgabenliste laden
app.get("/budget/costs", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Budget-IDs des Users ermitteln
    const { data: budgets, error: budgetError } = await supabase
      .from("budgets")
      .select("id")
      .eq("user_id", userId);

    if (budgetError) {
      console.error(budgetError);
      return res.status(500).json({ success: false, message: "Fehler beim Laden der Budgets" });
    }

    const budgetIds = (budgets || []).map(b => b.id);

    if (budgetIds.length === 0) {
      return res.json({ success: true, costs: [] });
    }

    const { data: expenses, error } = await supabase
      .from("expenses")
      .select("id, title, amount, date, created_at")
      .in("budget_id", budgetIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Fehler beim Laden der Ausgaben" });
    }

    return res.json({ success: true, costs: expenses || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

// POST /budget/costs – neue Ausgabe speichern (wird dem ersten Budget des Users zugeordnet)
app.post("/budget/costs", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { title, amount } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Titel erforderlich" });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ success: false, message: "Ungültiger Betrag" });
    }

    // Erstes Budget des Users als Ziel verwenden
    const { data: budget, error: budgetError } = await supabase
      .from("budgets")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (budgetError || !budget) {
      return res.status(400).json({
        success: false,
        message: "Kein Budget gefunden – bitte zuerst ein Budget anlegen"
      });
    }

    const { data, error } = await supabase
      .from("expenses")
      .insert([{
        user_id: userId,
        budget_id: budget.id,
        title: title.trim(),
        amount: parsedAmount,
        date: new Date().toISOString().split("T")[0]  // heutiges Datum als YYYY-MM-DD
      }])
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Fehler beim Speichern" });
    }

    return res.status(201).json({ success: true, cost: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

/* =========================
   BENUTZERPROFIL
========================= */

// GET /user – eigene Daten lesen
app.get("/user", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const { data, error } = await supabase
      .from("users")
      .select("id, username, email")
      .eq("id", userId)
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Datenbankfehler" });
    }

    return res.json({ success: true, user: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

// PUT /user – eigene Daten ändern (nur email und username)
app.put("/user", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { username, email } = req.body;

    // 1. Benutzername darf nicht leer sein
    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: "Benutzername darf nicht leer sein" });
    }

    // 2. E-Mail-Format prüfen
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: "Ungültiges E-Mail-Format" });
    }

    // 3. E-Mail bereits von anderem User vergeben?
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.trim())
      .neq("id", userId)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(409).json({ success: false, message: "Diese E-Mail-Adresse wird bereits verwendet" });
    }

    const { data, error } = await supabase
      .from("users")
      .update({ username: username.trim(), email: email.trim() })
      .eq("id", userId)
      .select("id, username, email")
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Fehler beim Aktualisieren" });
    }

    // Session aktualisieren
    req.session.user.username = data.username;
    req.session.user.email = data.email;

    return res.json({ success: true, user: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

// PATCH /user/password – eigenes Passwort ändern
app.patch("/user/password", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { current_password, new_password, confirm_password } = req.body;

    // 1. Pflichtfelder prüfen
    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({
        success: false,
        message: "Alle drei Passwort-Felder sind erforderlich"
      });
    }

    // 2. Neues Passwort und Bestätigung müssen übereinstimmen
    if (new_password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: "Neues Passwort und Bestätigung stimmen nicht überein"
      });
    }

    // 3. Mindestlänge neues Passwort
    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Neues Passwort muss mindestens 6 Zeichen lang sein"
      });
    }

    // 4. Aktuellen Hash aus der DB laden
    const { data: userRow, error: fetchError } = await supabase
      .from("users")
      .select("password_hash")
      .eq("id", userId)
      .single();

    if (fetchError || !userRow) {
      console.error(fetchError);
      return res.status(500).json({ success: false, message: "Datenbankfehler" });
    }

    // 5. Aktuelles Passwort verifizieren
    const isValid = await bcrypt.compare(current_password, userRow.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Aktuelles Passwort ist falsch"
      });
    }

    // 6. Neues Passwort darf nicht identisch mit dem alten sein
    const isSame = await bcrypt.compare(new_password, userRow.password_hash);
    if (isSame) {
      return res.status(400).json({
        success: false,
        message: "Das neue Passwort muss sich vom aktuellen unterscheiden"
      });
    }

    // 7. Neues Passwort hashen und speichern
    const new_hash = await bcrypt.hash(new_password, 10);

    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash: new_hash })
      .eq("id", userId);

    if (updateError) {
      console.error(updateError);
      return res.status(500).json({ success: false, message: "Fehler beim Speichern des neuen Passworts" });
    }

    return res.json({ success: true, message: "Passwort erfolgreich geändert" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

/* =========================
   WUNSCHLISTE
========================= */

// GET /wishlist – alle Wünsche des eingeloggten Users laden
app.get("/wishlist", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { data, error } = await supabase
      .from("wishlist")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Datenbankfehler" });
    }

    return res.json({ success: true, wishes: data || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

// POST /wishlist – neuen Wunsch erstellen
app.post("/wishlist", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { name, description, price, link, is_reserved, reserved_by } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Name erforderlich" });
    }

    const { data, error } = await supabase
      .from("wishlist")
      .insert([{
        user_id: userId,
        name: name.trim(),
        description: description || null,
        price: price !== "" && price !== undefined && price !== null ? parseFloat(price) : null,
        link: link || null,
        is_reserved: is_reserved === true || is_reserved === "true",
        reserved_by: reserved_by || null
      }])
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Fehler beim Speichern" });
    }

    return res.status(201).json({ success: true, wish: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

// PUT /wishlist/:id – Wunsch aktualisieren
app.put("/wishlist/:id", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const wishId = req.params.id;
    const { name, description, price, link, is_reserved, reserved_by } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Name erforderlich" });
    }

    const { data, error } = await supabase
      .from("wishlist")
      .update({
        name: name.trim(),
        description: description || null,
        price: price !== "" && price !== undefined && price !== null ? parseFloat(price) : null,
        link: link || null,
        is_reserved: is_reserved === true || is_reserved === "true",
        reserved_by: reserved_by || null
      })
      .eq("id", wishId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Fehler beim Aktualisieren" });
    }

    if (!data) {
      return res.status(404).json({ success: false, message: "Wunsch nicht gefunden" });
    }

    return res.json({ success: true, wish: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Serverfehler" });
  }
});

// DELETE /wishlist/:id – Wunsch löschen
app.delete("/wishlist/:id", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const wishId = req.params.id;

    const { error } = await supabase
      .from("wishlist")
      .delete()
      .eq("id", wishId)
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

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});