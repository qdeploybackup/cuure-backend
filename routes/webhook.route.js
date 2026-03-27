const express = require("express");
const router = express.Router();

const { users, getSession } = require("../utils/sessions");
const { doctors } = require("../data/doctors");

const handleNewUser = require("../flows/newUser.flow");
const handleRegisteredUser = require("../flows/registeredUser.flow");
const handleDoctorFlow = require("../flows/doctor.flow");

router.get("/", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === process.env.VERIFY_TOKEN
  ) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

router.post("/", async (req, res) => {
  try {
    const msg = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    let text = msg.text?.body || "";
    let interactiveId =
      msg.interactive?.button_reply?.id ||
      msg.interactive?.list_reply?.id;

    const session = getSession(from);

    if (msg.location) {

      // Accept location ONLY if user explicitly chose "Send Location"
      if (
        session.step === "ASK_LOCATION" &&
        session.temp.addressMode === "LOCATION"
      ) {
        session.temp.location = {
          lat: msg.location.latitude,
          lng: msg.location.longitude,
          address: msg.location.address || null
        };
        text = "__LOCATION__";
      } else {
        // Ignore unexpected / late / accidental location
        return res.sendStatus(200);
      }
    }

    if (doctors.find(d => d.phone === from)) {
      await handleDoctorFlow(from, text, interactiveId);
      return res.sendStatus(200);
    }

    if (!users[from]) {
      await handleNewUser(from, text, interactiveId);
      return res.sendStatus(200);
    }

    await handleRegisteredUser(from, text, interactiveId);
    res.sendStatus(200);
  } catch (e) {
    console.error("Webhook error:", e);
    res.sendStatus(500);
  }
});

module.exports = router;