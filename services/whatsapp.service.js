const fetch = global.fetch || require("node-fetch");
const {
  WHATSAPP_PHONE_ID,
  WHATSAPP_TOKEN,
} = require("../config/env");

/* ===============================
   BASIC TEXT MESSAGE
================================ */
async function sendWhatsAppText(to, body) {
  await fetch(
    `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    }
  );
}

/* ===============================
   ENTRY BUTTONS (CALL / CHAT)
================================ */
async function sendEntryButtons(to) {
  await fetch(
    `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text:
              "Welcome to Cuure.health 🩺\n\n" +
              "🌐 Website: https://cuure.health\n\n" +
              "Book verified doctors, healthcare services and manage appointments from the comfort of your home.\n\n" +
              "How would you like to proceed?",
          },
          action: {
            buttons: [
              { type: "reply", reply: { id: "CALL_NOW", title: "📞 Call Now" } },
              {
                type: "reply",
                reply: { id: "CHAT_CONTINUE", title: "💬 Continue in Chat" },
              },
            ],
          },
        },
      }),
    }
  );
}

/* ===============================
   CONTINUE CHAT BUTTON
================================ */
async function sendContinueChatButton(to) {
  await fetch(
    `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "Would you like to continue via chat?" },
          action: {
            buttons: [
              {
                type: "reply",
                reply: { id: "CHAT_CONTINUE", title: "💬 Continue in Chat" },
              },
            ],
          },
        },
      }),
    }
  );
}

/* ===============================
   LIST MESSAGE (DATE / TIME / PATIENT)
================================ */
async function sendWhatsAppList(to, { header, body, button, rows }) {
  await fetch(
    `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: header },
          body: { text: body },
          footer: { text: "Cuure.health" },
          action: {
            button,
            sections: [
              {
                title: "Options",
                rows,
              },
            ],
          },
        },
      }),
    }
  );
}

module.exports = {
  sendWhatsAppText,
  sendEntryButtons,
  sendContinueChatButton,
  sendWhatsAppList,
};