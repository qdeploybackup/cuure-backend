const express = require("express");
const path = require("path");
const cors = require("cors");
const session = require("express-session");

const webhookRoute = require("./routes/webhook.route");
const adminRoute = require("./routes/admin.route");
const adminApiRoute = require("./routes/adminApi.route");
const websiteRoute = require("./routes/website.route");

// AI Medical Chatbot Routes
const chatRoutes = require('./routes/chat');
const appointmentRoutes = require('./routes/appointment');
const chatbotAppointmentRoutes = require('./routes/chatbotAppointment');
const reportRoutes = require('./routes/report');

const app = express();

// app.use(cors({ origin: "http://localhost:3039", credentials: true }));
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://www.cuure.health"
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "cuure-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 15 * 60 * 1000 }
  })
);

app.use(express.static(path.join(__dirname, "public")));

app.use("/webhook", webhookRoute);
app.use("/admin", adminRoute);
app.use("/api/admin", adminApiRoute);
app.use("/api", websiteRoute);

// Mount AI Medical Chatbot Routes
app.use('/api/chat', chatRoutes);
app.use('/api/chatbot-appointment', chatbotAppointmentRoutes);
app.use('/api/upload-report', reportRoutes);

app.get("/", (req, res) => {
  res.send("Cuure Healthcare Bot is live ✅");
});

module.exports = app;