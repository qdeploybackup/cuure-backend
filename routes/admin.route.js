const express = require("express");
const path = require("path");

const router = express.Router();

/* ===============================
   ADMIN USERS (STATIC)
================================ */
const ADMINS = [
  { username: "Benaka", password: "Benaka@123" },
  { username: "Trisha", password: "Trisha@123" },
  { username: "Nikhil", password: "Nikhil@123" },
  { username: "Rohith", password: "Rohith@123" },
  { username: "Shreyas", password: "Shreyas@123" },
];

/* ===============================
   ADMIN LOGIN
================================ */
router.post("/login", (req, res) => {
  console.log("ADMIN LOGIN BODY =", req.body);

  const { username, password } = req.body || {};

  const isValid = ADMINS.some(
    a => a.username === username && a.password === password
  );

  if (isValid) {
    req.session.isAdmin = true;
    req.session.adminUser = username;
    return res.redirect("/admin");
  }

  return res.status(401).send("Invalid username or password");
});

/* ===============================
   ADMIN AUTH MIDDLEWARE
================================ */
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.redirect("/admin-login.html");
}

/* ===============================
   SESSION REFRESH
================================ */
router.use((req, res, next) => {
  if (req.session) {
    req.session.touch(); // keep session alive
  }
  next();
});

/* ===============================
   ADMIN DASHBOARD
================================ */
router.get("/", requireAdmin, (req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "public", "admin.html")
  );
});

module.exports = router;