const express = require("express");
const cors = require("cors");
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// LOGIN
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (email === "test@test.com" && password === "1234") {
    return res.json({
      success: true,
      token: "FAKE_TOKEN_123"
    });
  }

  res.status(401).json({ success: false, message: "Invalid credentials" });
});

// LOGOUT
app.post("/logout", (req, res) => {
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`));
