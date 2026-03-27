const pool = require("../config/postgres");
const { users, getSession } = require("../utils/sessions");

const {
  sendWhatsAppText,
  sendEntryButtons,
  sendContinueChatButton,
} = require("../services/whatsapp.service");

const { mainMenu } = require("../utils/helpers");

async function handleNewUser(from, text, interactiveId) {
  const session = getSession(from);

  // EXACT SAME LOGIC — CUT & PASTE
  if (session.step === "START") {
    session.step = "ENTRY_CHOICE";
    await sendEntryButtons(from);
    return;
  }

  if (session.step === "ENTRY_CHOICE" && interactiveId) {
    if (interactiveId === "CALL_NOW") {
      await sendWhatsAppText(
        from,
        "📞 Call Cuure.health\n\n 0821-3156014\n 7483068353\n🕘 9 AM – 8 PM"
      );
      await sendContinueChatButton(from);
      session.step = "AFTER_CALL";
      return;
    }

    if (interactiveId === "CHAT_CONTINUE") {
      session.step = "ASK_NAME";
      await sendWhatsAppText(
        from,
        "Great 👍\n\nTo begin, may I know your full name?"
      );
      return;
    }
  }

  if (session.step === "AFTER_CALL" && interactiveId === "CHAT_CONTINUE") {
    session.step = "ASK_NAME";
    await sendWhatsAppText(
      from,
      "No problem 😊\n\nMay I know your full name?"
    );
    return;
  }

  if (session.step === "ASK_NAME") {
    if (!/^[a-zA-Z\s]+$/.test(text)) {
      await sendWhatsAppText(
        from,
        "Please enter a valid name using only alphabets and spaces."
      );
      return;
    }
    session.temp.name = text;
    session.step = "ASK_AGE";
    await sendWhatsAppText(
      from,
      `Thank you, ${text}.\n\nPlease enter your age (numbers only).`
    );
    return;
  }

  if (session.step === "ASK_AGE") {
    const age = parseInt(text, 10);

    if (isNaN(age) || age <= 0 || age > 110) {
      await sendWhatsAppText(
        from,
        "Please enter a valid age using numbers only (1-110)."
      );
      return;
    }

    users[from] = { name: session.temp.name, age };

    try {
      await pool.query(
        `INSERT INTO users (phone, name, age)
         VALUES ($1, $2, $3)
         ON CONFLICT(phone) DO UPDATE SET
           name = EXCLUDED.name,
           age = EXCLUDED.age`,
        [from, session.temp.name, age]
      );
    } catch (err) {
      console.error("Error saving new user:", err);
    }

    session.step = "MENU";
    await sendWhatsAppText(
      from,
      `Thank you, ${session.temp.name}.\nYou have been successfully registered.\n\n` +
        mainMenu()
    );
    return;
  }
}

module.exports = handleNewUser;