const express = require("express");
const cors = require("cors");
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// LOGIN - Fehlermeldung
app.post("/login", (req, res) => {
    return res.status(401).json({
        success: false,
        message: "Ungültige Zugangsdaten"
    });
});

// LOGOUT
app.post("/logout", (req, res) => {
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`));
