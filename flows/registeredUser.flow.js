const pool = require("../config/postgres");
const { TIME_SLOTS } = require("../data/constants");
const { users, getSession } = require("../utils/sessions");
const { assignDoctor } = require("../data/doctors");
const { appointmentsCache } = require("../db/initDB");
const fetch = global.fetch || require("node-fetch");
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;

const { notifyDoctor } = require("../services/doctor.service");

const {
  sendWhatsAppText,
  sendWhatsAppList,
} = require("../services/whatsapp.service");

const {
  mainMenu,
  getUpcomingDayRows,
  getTimeRowsForDate,
} = require("../utils/helpers");


async function handleRegisteredUser(from, text, interactiveId) {
  const session = getSession(from);

  // 👇 ADD THIS
  const clean = (text || "").replace(/[^\d]/g, "");

  console.log("MENU DEBUG:", {
    raw: text,
    clean,
    step: session.step
  });

  const trimmedText = (text || "").trim();
  const lower = trimmedText.toLowerCase().replace(/\s+/g, "");

  if (interactiveId) {
    // handle date/time selections by ID
    if (interactiveId.startsWith("date_")) {
      const dateStr = interactiveId.replace("date_", "");
      session.temp.date = dateStr;

      const timeRows = getTimeRowsForDate(dateStr);
      if (!timeRows.length) {
        await sendWhatsAppText(
          from,
          "All time slots for this day are currently booked.\n\nPlease select another date from the list."
        );
        session.step = "DAY_SELECT";
        await sendWhatsAppList(from, {
          header: "Select Appointment Date",
          body: "Please choose a preferred date for your appointment:",
          button: "Select date",
          rows: getUpcomingDayRows(),
        });
        return;
      }

      session.step = "TIME_SELECT";
      await sendWhatsAppList(from, {
        header: `Date: ${dateStr}`,
        body: "Please select a suitable time slot for your appointment:",
        button: "Select time",
        rows: timeRows,
      });
      return;
    }

    if (interactiveId.startsWith("time_") && session.temp.date) {
      const timeValue = interactiveId.replace("time_", "");
      const slot = TIME_SLOTS.find((s) => s.value === timeValue);
      if (!slot) {
        await sendWhatsAppText(
          from,
          "The selected time slot is not available. Please try again."
        );
        session.step = "TIME_SELECT";
        await sendWhatsAppList(from, {
          header: `Date: ${session.temp.date}`,
          body: "Please select a suitable time slot for your appointment:",
          button: "Select time",
          rows: getTimeRowsForDate(session.temp.date),
        });
        return;
      }

      session.temp.slot = slot;
      session.step = "CONFIRM";

      await sendWhatsAppText(
        from,
        "Please review your appointment details:\n\n" +
          `📅 Date: ${session.temp.date}\n` +
          `⏰ Time: ${slot.label}\n\n` +
          "Reply *YES* to confirm the appointment or *NO* to cancel."
      );
      return;
    }
  }

  if (session.step === "ASK_LOCATION") {
    const trimmedText = (text || "").trim();
    if (session.temp.location) {
      const { lat, lng, address } = session.temp.location;

      session.temp.address =
        address || "Shared via WhatsApp location";

      session.temp.location_link =
        `https://maps.google.com/?q=${lat},${lng}`;
    }
    // ✅ Manual typed address
    else if (trimmedText && trimmedText.toLowerCase() !== "skip") {
      session.temp.address = trimmedText;
      session.temp.location_link = null;
    }
    // ✅ Skip
    else {
      session.temp.address =
        session.temp.address || "Address not provided";
      session.temp.location_link = null;
    }

    session.step = "FINAL_CONFIRM";
  }

  // ✅ TYPE ADDRESS → DIRECT CONFIRM
  if (session.step === "ASK_TYPED_ADDRESS") {
    session.temp.address = trimmedText;
    session.temp.location_link = null;
    session.step = "FINAL_CONFIRM";
  }

    /* ===============================
   STEP 4 — FINAL CONFIRM
================================ */
  if (session.step === "FINAL_CONFIRM" && session.temp.slot) {

  const slot = session.temp.slot;
  const user = users[from] || {};

  const record = {
    phone: from,
    patient_name: user.name || null,
    date: session.temp.date,
    time_label: slot.label,
    time_value: slot.value,
    address: session.temp.address,
    location_link: session.temp.location_link || null
  };

  appointmentsCache.push(record);
  const doctor = assignDoctor();

  // Save to database
  try {
    const res = await pool.query(
      `INSERT INTO appointments (
        phone, patient_name, date, time_label, time_value,
        address, location_link,
        doctor_name, doctor_specialization
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        record.phone,
        record.patient_name,
        record.date,
        record.time_label,
        record.time_value,
        record.address,
        record.location_link,
        doctor.name,
        doctor.specialization
      ]
    );
    console.log("✅ Appointment saved to DB - ID:", res.rows[0].id);
  } catch (err) {
    console.error("❌ Error inserting appointment:", err);
  }

  notifyDoctor({ doctor, record }).catch(console.error);

  session.step = "MENU";

  await sendWhatsAppText(
    from,
    "Health is true wealth!"+
    "✅ Appointment Confirmed\n\n" +
    `📅 ${record.date}\n` +
    `⏰ ${record.time_label}\n\n` +
    `📍 Address:\n${record.address}\n\n` +
    (record.location_link ? `🗺️ ${record.location_link}\n\n` : "") +
    `👨‍⚕️ ${doctor.name}\n${doctor.specialization}\n\n` +
    mainMenu()
  );

  return;
}

   // CONFIRMATION STEP
if (session.step === "CONFIRM") {
  if (lower === "yes") {
    session.step = "ADDRESS_CHOICE";

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
          to: from,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: "📍 How would you like to share the visit address?",
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: { id: "ADDR_TYPE", title: "✍️ Type Address" },
                },
                {
                  type: "reply",
                  reply: { id: "ADDR_LOCATION", title: "📍 Send Location" },
                },
              ],
            },
          },
        }),
      }
    );

    return;
  }


  if (lower === "no") {
    session.step = "MENU";
    await sendWhatsAppText(
      from,
      "Your appointment request has been cancelled.\n\n" + mainMenu()
    );
    return;
  }

  await sendWhatsAppText(
    from,
    "Please reply *YES* to confirm or *NO* to cancel."
  );
  return;
}

  if (lower === "menu") {
    session.step = "MENU";
    await sendWhatsAppText(from, mainMenu());
    return;
  }

  // MAIN MENU
  if (session.step === "MENU") {
    session.step = "MENU";

    if (clean === "1") {
      session.step = "DAY_SELECT";
      await sendWhatsAppList(from, {
        header: "Select Appointment Date",
        body: "Please choose a preferred date for your appointment:",
        button: "Select date",
        rows: getUpcomingDayRows(),
      });
      return;
    }

    if (clean === "2") {
      try {
        const res = await pool.query(
          `SELECT date, time_label, patient_name
           FROM appointments
           WHERE phone = $1
           ORDER BY date, time_value`,
          [from]
        );
        const rows = res.rows;
        if (!rows.length) {
          await sendWhatsAppText(
            from,
            "You do not have any appointments scheduled at the moment.\n\n" +
              "You may book a new appointment using the *Book a doctor appointment* option.\n\n" +
              mainMenu()
          );
        } else {
          const list = rows
            .map(
              (a, i) =>
                `${i + 1}. ${a.date} at ${a.time_label} (${a.patient_name ||
                  "Not specified"})`
            )
            .join("\n");
          await sendWhatsAppText(
            from,
            "Here are your appointments:\n\n" +
              list +
              "\n\n" +
              mainMenu()
          );
        }
      } catch (err) {
        console.error("Error fetching user appointments:", err);
      }
      return;
    }

    if (clean === "3") {
      await sendWhatsAppText(
        from,
        "Cuure.health Support 🩺\n\n" +
          "For any help with appointments or other queries, you may contact us at:\n\n" +
          "📞 Helpline: 08213156014 \\ 7483068353 \n" +
          "🕒 Support hours: 9:00 AM – 8:00 PM\n\n" +
          "You can also continue to manage appointments here.\n" +
          "Type *MENU* at any time to view the options again."
      );
      return;
    }

    await sendWhatsAppText(
      from,
      "Sorry, I did not understand that.\n\n" +
        "Please choose one of the available options:\n\n" +
        mainMenu()
    );
    return;
  }

// ADDRESS CHOICE
if (session.step === "ADDRESS_CHOICE" && interactiveId) {

  if (interactiveId === "ADDR_TYPE") {
  session.step = "ASK_TYPED_ADDRESS";
  session.temp.addressMode = "TEXT";     // ✅ FIX
  session.temp.address = null;
  session.temp.location = null;
  session.temp.location_link = null;

    await sendWhatsAppText(
      from,
      "✍️ Please type the complete address:\n\n" +
      "• House / Flat No\n• Area / Street\n• City\n• Landmark (optional)"
    );
    return;
  }

  if (interactiveId === "ADDR_LOCATION") {
    session.step = "ASK_LOCATION";
    session.temp.addressMode = "LOCATION";
    session.temp.address = null;
    session.temp.location = null;
    session.temp.location_link = null;

    await sendWhatsAppText(
      from,
      "📍 Please share your current location using WhatsApp Location.\n\n" +
      "If location sharing is not possible, please type the address instead."
    );
    return;
  }
}

// ✅ TYPE ADDRESS → DIRECT CONFIRM
if (session.step === "ASK_TYPED_ADDRESS") {
  session.temp.address = trimmedText;
  session.temp.location_link = null;
  session.step = "FINAL_CONFIRM";
}

  if (session.step === "ASK_LOCATION") {
    const trimmedText = (text || "").trim();
    if (session.temp.location) {
      const { lat, lng, address } = session.temp.location;

      session.temp.address =
        address || "Shared via WhatsApp location";

      session.temp.location_link =
        `https://maps.google.com/?q=${lat},${lng}`;
    }
    // ✅ Manual typed address
    else if (trimmedText && trimmedText.toLowerCase() !== "skip") {
      session.temp.address = trimmedText;
      session.temp.location_link = null;
    }
    // ✅ Skip
    else {
      session.temp.address =
        session.temp.address || "Address not provided";
      session.temp.location_link = null;
    }

    session.step = "FINAL_CONFIRM";
  }

    /* ===============================
   STEP 4 — FINAL CONFIRM
================================ */
  if (session.step === "FINAL_CONFIRM" && session.temp.slot) {

  const slot = session.temp.slot;
  const user = users[from] || {};

  const record = {
    phone: from,
    patient_name: user.name || null,
    date: session.temp.date,
    time_label: slot.label,
    time_value: slot.value,
    address: session.temp.address,
    location_link: session.temp.location_link || null
  };

  appointmentsCache.push(record);
  const doctor = assignDoctor();

  // Save to database
  try {
    const res = await pool.query(
      `INSERT INTO appointments (
        phone, patient_name, date, time_label, time_value,
        address, location_link,
        doctor_name, doctor_specialization
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        record.phone,
        record.patient_name,
        record.date,
        record.time_label,
        record.time_value,
        record.address,
        record.location_link,
        doctor.name,
        doctor.specialization
      ]
    );
    console.log("✅ Appointment saved to DB - ID:", res.rows[0].id);
  } catch (err) {
    console.error("❌ Error inserting appointment:", err);
  }

  notifyDoctor({ doctor, record }).catch(console.error);

  session.step = "MENU";

  await sendWhatsAppText(
    from,
    "Health is true wealth!"+
    "✅ Appointment Confirmed\n\n" +
    `📅 ${record.date}\n` +
    `⏰ ${record.time_label}\n\n` +
    `📍 Address:\n${record.address}\n\n` +
    (record.location_link ? `🗺️ ${record.location_link}\n\n` : "") +
    `👨‍⚕️ ${doctor.name}\n${doctor.specialization}\n\n` +
    mainMenu()
  );

  return;
}

   // CONFIRMATION STEP
if (session.step === "CONFIRM") {
  if (lower === "yes") {
    session.step = "ADDRESS_CHOICE";

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
          to: from,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: "📍 How would you like to share the visit address?",
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: { id: "ADDR_TYPE", title: "✍️ Type Address" },
                },
                {
                  type: "reply",
                  reply: { id: "ADDR_LOCATION", title: "📍 Send Location" },
                },
              ],
            },
          },
        }),
      }
    );

    return;
  }


  if (lower === "no") {
    session.step = "MENU";
    await sendWhatsAppText(
      from,
      "Your appointment request has been cancelled.\n\n" + mainMenu()
    );
    return;
  }

  await sendWhatsAppText(
    from,
    "Please reply *YES* to confirm or *NO* to cancel."
  );
  return;
}

  if (lower === "menu") {
    session.step = "MENU";
    await sendWhatsAppText(from, mainMenu());
    return;
  }

  // MAIN MENU
  if (session.step === "MENU") {
    session.step = "MENU";

    if (clean === "1") {
      session.step = "DAY_SELECT";
      await sendWhatsAppList(from, {
        header: "Select Appointment Date",
        body: "Please choose a preferred date for your appointment:",
        button: "Select date",
        rows: getUpcomingDayRows(),
      });
      return;
    }

    if (clean === "2") {
      try {
        const res = await pool.query(
          `SELECT date, time_label, patient_name
           FROM appointments
           WHERE phone = $1
           ORDER BY date, time_value`,
          [from]
        );
        const rows = res.rows;
        if (!rows.length) {
          await sendWhatsAppText(
            from,
            "You do not have any appointments scheduled at the moment.\n\n" +
              "You may book a new appointment using the *Book a doctor appointment* option.\n\n" +
              mainMenu()
          );
        } else {
          const list = rows
            .map(
              (a, i) =>
                `${i + 1}. ${a.date} at ${a.time_label} (${a.patient_name ||
                  "Not specified"})`
            )
            .join("\n");
          await sendWhatsAppText(
            from,
            "Here are your appointments:\n\n" +
              list +
              "\n\n" +
              mainMenu()
          );
        }
      } catch (err) {
        console.error("Error fetching user appointments:", err);
      }
      return;
    }

    if (clean === "3") {
      await sendWhatsAppText(
        from,
        "Cuure.health Support 🩺\n\n" +
          "For any help with appointments or other queries, you may contact us at:\n\n" +
          "📞 Helpline: 08213156014 \\ 7483068353 \n" +
          "🕒 Support hours: 9:00 AM – 8:00 PM\n\n" +
          "You can also continue to manage appointments here.\n" +
          "Type *MENU* at any time to view the options again."
      );
      return;
    }

    await sendWhatsAppText(
      from,
      "Sorry, I did not understand that.\n\n" +
        "Please choose one of the available options:\n\n" +
        mainMenu()
    );
    return;
  }

// ADDRESS CHOICE
if (session.step === "ADDRESS_CHOICE" && interactiveId) {

  if (interactiveId === "ADDR_TYPE") {
  session.step = "ASK_TYPED_ADDRESS";
  session.temp.addressMode = "TEXT";     // ✅ FIX
  session.temp.address = null;
  session.temp.location = null;
  session.temp.location_link = null;

    await sendWhatsAppText(
      from,
      "✍️ Please type the complete address:\n\n" +
      "• House / Flat No\n• Area / Street\n• City\n• Landmark (optional)"
    );
    return;
  }

  if (interactiveId === "ADDR_LOCATION") {
    session.step = "ASK_LOCATION";
    session.temp.addressMode = "LOCATION";
    session.temp.address = null;
    session.temp.location = null;
    session.temp.location_link = null;

    await sendWhatsAppText(
      from,
      "📍 Please share your current location using WhatsApp Location.\n\n" +
      "If location sharing is not possible, please type the address instead."
    );
    return;
  }
}

// ✅ TYPE ADDRESS → DIRECT CONFIRM
if (session.step === "ASK_TYPED_ADDRESS") {
  session.temp.address = trimmedText;
  session.temp.location_link = null;
  session.step = "FINAL_CONFIRM";
}

  if (session.step === "ASK_LOCATION") {
    const trimmedText = (text || "").trim();
    if (session.temp.location) {
      const { lat, lng, address } = session.temp.location;

      session.temp.address =
        address || "Shared via WhatsApp location";

      session.temp.location_link =
        `https://maps.google.com/?q=${lat},${lng}`;
    }
    // ✅ Manual typed address
    else if (trimmedText && trimmedText.toLowerCase() !== "skip") {
      session.temp.address = trimmedText;
      session.temp.location_link = null;
    }
    // ✅ Skip
    else {
      session.temp.address =
        session.temp.address || "Address not provided";
      session.temp.location_link = null;
    }

    session.step = "FINAL_CONFIRM";
  }

    /* ===============================
   STEP 4 — FINAL CONFIRM
================================ */
  if (session.step === "FINAL_CONFIRM" && session.temp.slot) {

  const slot = session.temp.slot;
  const user = users[from] || {};

  const record = {
    phone: from,
    patient_name: user.name || null,
    date: session.temp.date,
    time_label: slot.label,
    time_value: slot.value,
    address: session.temp.address,
    location_link: session.temp.location_link || null
  };

  appointmentsCache.push(record);
  const doctor = assignDoctor();

  // Save to database
  try {
    const res = await pool.query(
      `INSERT INTO appointments (
        phone, patient_name, date, time_label, time_value,
        address, location_link,
        doctor_name, doctor_specialization
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        record.phone,
        record.patient_name,
        record.date,
        record.time_label,
        record.time_value,
        record.address,
        record.location_link,
        doctor.name,
        doctor.specialization
      ]
    );
    console.log("✅ Appointment saved to DB - ID:", res.rows[0].id);
  } catch (err) {
    console.error("❌ Error inserting appointment:", err);
  }

  notifyDoctor({ doctor, record }).catch(console.error);

  session.step = "MENU";

  await sendWhatsAppText(
    from,
    "Health is true wealth!"+
    "✅ Appointment Confirmed\n\n" +
    `📅 ${record.date}\n` +
    `⏰ ${record.time_label}\n\n` +
    `📍 Address:\n${record.address}\n\n` +
    (record.location_link ? `🗺️ ${record.location_link}\n\n` : "") +
    `👨‍⚕️ ${doctor.name}\n${doctor.specialization}\n\n` +
    mainMenu()
  );

  return;
}

   // CONFIRMATION STEP
if (session.step === "CONFIRM") {
  if (lower === "yes") {
    session.step = "ADDRESS_CHOICE";

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
          to: from,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: "📍 How would you like to share the visit address?",
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: { id: "ADDR_TYPE", title: "✍️ Type Address" },
                },
                {
                  type: "reply",
                  reply: { id: "ADDR_LOCATION", title: "📍 Send Location" },
                },
              ],
            },
          },
        }),
      }
    );

    return;
  }


  if (lower === "no") {
    session.step = "MENU";
    await sendWhatsAppText(
      from,
      "Your appointment request has been cancelled.\n\n" + mainMenu()
    );
    return;
  }

  await sendWhatsAppText(
    from,
    "Please reply *YES* to confirm or *NO* to cancel."
  );
  return;
}

  if (lower === "menu") {
    session.step = "MENU";
    await sendWhatsAppText(from, mainMenu());
    return;
  }

  // MAIN MENU
  if (session.step === "MENU") {
    session.step = "MENU";

    if (clean === "1") {
      session.step = "DAY_SELECT";
      await sendWhatsAppList(from, {
        header: "Select Appointment Date",
        body: "Please choose a preferred date for your appointment:",
        button: "Select date",
        rows: getUpcomingDayRows(),
      });
      return;
    }

    if (clean === "2") {
      try {
        const res = await pool.query(
          `SELECT date, time_label, patient_name
           FROM appointments
           WHERE phone = $1
           ORDER BY date, time_value`,
          [from]
        );
        const rows = res.rows;
        if (!rows.length) {
          await sendWhatsAppText(
            from,
            "You do not have any appointments scheduled at the moment.\n\n" +
              "You may book a new appointment using the *Book a doctor appointment* option.\n\n" +
              mainMenu()
          );
        } else {
          const list = rows
            .map(
              (a, i) =>
                `${i + 1}. ${a.date} at ${a.time_label} (${a.patient_name ||
                  "Not specified"})`
            )
            .join("\n");
          await sendWhatsAppText(
            from,
            "Here are your appointments:\n\n" +
              list +
              "\n\n" +
              mainMenu()
          );
        }
      } catch (err) {
        console.error("Error fetching user appointments:", err);
      }
      return;
    }

    if (clean === "3") {
      await sendWhatsAppText(
        from,
        "Cuure.health Support 🩺\n\n" +
          "For any help with appointments or other queries, you may contact us at:\n\n" +
          "📞 Helpline: 08213156014 \\ 7483068353 \n" +
          "🕒 Support hours: 9:00 AM – 8:00 PM\n\n" +
          "You can also continue to manage appointments here.\n" +
          "Type *MENU* at any time to view the options again."
      );
      return;
    }

    await sendWhatsAppText(
      from,
      "Sorry, I did not understand that.\n\n" +
        "Please choose one of the available options:\n\n" +
        mainMenu()
    );
    return;
  }

// ADDRESS CHOICE
if (session.step === "ADDRESS_CHOICE" && interactiveId) {

  if (interactiveId === "ADDR_TYPE") {
  session.step = "ASK_TYPED_ADDRESS";
  session.temp.addressMode = "TEXT";     // ✅ FIX
  session.temp.address = null;
  session.temp.location = null;
  session.temp.location_link = null;

    await sendWhatsAppText(
      from,
      "✍️ Please type the complete address:\n\n" +
      "• House / Flat No\n• Area / Street\n• City\n• Landmark (optional)"
    );
    return;
  }

  if (interactiveId === "ADDR_LOCATION") {
    session.step = "ASK_LOCATION";
    session.temp.addressMode = "LOCATION";
    session.temp.address = null;
    session.temp.location = null;
    session.temp.location_link = null;

    await sendWhatsAppText(
      from,
      "📍 Please share your current location using WhatsApp Location.\n\n" +
      "If location sharing is not possible, please type the address instead."
    );
    return;
  }
}

// ✅ TYPE ADDRESS → DIRECT CONFIRM
if (session.step === "ASK_TYPED_ADDRESS") {
  session.temp.address = trimmedText;
  session.temp.location_link = null;
  session.step = "FINAL_CONFIRM";
}

  if (session.step === "ASK_LOCATION") {
    const trimmedText = (text || "").trim();
    if (session.temp.location) {
      const { lat, lng, address } = session.temp.location;

      session.temp.address =
        address || "Shared via WhatsApp location";

      session.temp.location_link =
        `https://maps.google.com/?q=${lat},${lng}`;
    }
    // ✅ Manual typed address
    else if (trimmedText && trimmedText.toLowerCase() !== "skip") {
      session.temp.address = trimmedText;
      session.temp.location_link = null;
    }
    // ✅ Skip
    else {
      session.temp.address =
        session.temp.address || "Address not provided";
      session.temp.location_link = null;
    }

    session.step = "FINAL_CONFIRM";
  }

    /* ===============================
   STEP 4 — FINAL CONFIRM
================================ */
  if (session.step === "FINAL_CONFIRM" && session.temp.slot) {

  const slot = session.temp.slot;
  const user = users[from] || {};

  const record = {
    phone: from,
    patient_name: user.name || null,
    date: session.temp.date,
    time_label: slot.label,
    time_value: slot.value,
    address: session.temp.address,
    location_link: session.temp.location_link || null
  };

  appointmentsCache.push(record);
  const doctor = assignDoctor();

  // Save to database
  try {
    const res = await pool.query(
      `INSERT INTO appointments (
        phone, patient_name, date, time_label, time_value,
        address, location_link,
        doctor_name, doctor_specialization
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        record.phone,
        record.patient_name,
        record.date,
        record.time_label,
        record.time_value,
        record.address,
        record.location_link,
        doctor.name,
        doctor.specialization
      ]
    );
    console.log("✅ Appointment saved to DB - ID:", res.rows[0].id);
  } catch (err) {
    console.error("❌ Error inserting appointment:", err);
  }

  notifyDoctor({ doctor, record }).catch(console.error);

  session.step = "MENU";

  await sendWhatsAppText(
    from,
    "Health is true wealth!"+
    "✅ Appointment Confirmed\n\n" +
    `📅 ${record.date}\n` +
    `⏰ ${record.time_label}\n\n` +
    `📍 Address:\n${record.address}\n\n` +
    (record.location_link ? `🗺️ ${record.location_link}\n\n` : "") +
    `👨‍⚕️ ${doctor.name}\n${doctor.specialization}\n\n` +
    mainMenu()
  );

  return;
}

   // CONFIRMATION STEP
if (session.step === "CONFIRM") {
  if (lower === "yes") {
    session.step = "ADDRESS_CHOICE";

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
          to: from,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: "📍 How would you like to share the visit address?",
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: { id: "ADDR_TYPE", title: "✍️ Type Address" },
                },
                {
                  type: "reply",
                  reply: { id: "ADDR_LOCATION", title: "📍 Send Location" },
                },
              ],
            },
          },
        }),
      }
    );

    return;
  }


  if (lower === "no") {
    session.step = "MENU";
    await sendWhatsAppText(
      from,
      "Your appointment request has been cancelled.\n\n" + mainMenu()
    );
    return;
  }

  await sendWhatsAppText(
    from,
    "Please reply *YES* to confirm or *NO* to cancel."
  );
  return;
}

  if (lower === "menu") {
    session.step = "MENU";
    await sendWhatsAppText(from, mainMenu());
    return;
  }

  // MAIN MENU
  if (session.step === "MENU") {
    session.step = "MENU";

    if (clean === "1") {
      session.step = "DAY_SELECT";
      await sendWhatsAppList(from, {
        header: "Select Appointment Date",
        body: "Please choose a preferred date for your appointment:",
        button: "Select date",
        rows: getUpcomingDayRows(),
      });
      return;
    }

    if (clean === "2") {
      try {
        const res = await pool.query(
          `SELECT date, time_label, patient_name
           FROM appointments
           WHERE phone = $1
           ORDER BY date, time_value`,
          [from]
        );
        const rows = res.rows;
        if (!rows.length) {
          await sendWhatsAppText(
            from,
            "You do not have any appointments scheduled at the moment.\n\n" +
              "You may book a new appointment using the *Book a doctor appointment* option.\n\n" +
              mainMenu()
          );
        } else {
          const list = rows
            .map(
              (a, i) =>
                `${i + 1}. ${a.date} at ${a.time_label} (${a.patient_name ||
                  "Not specified"})`
            )
            .join("\n");
          await sendWhatsAppText(
            from,
            "Here are your appointments:\n\n" +
              list +
              "\n\n" +
              mainMenu()
          );
        }
      } catch (err) {
        console.error("Error fetching user appointments:", err);
      }
      return;
    }

    if (clean === "3") {
      await sendWhatsAppText(
        from,
        "Cuure.health Support 🩺\n\n" +
          "For any help with appointments or other queries, you may contact us at:\n\n" +
          "📞 Helpline: 08213156014 \\ 7483068353 \n" +
          "🕒 Support hours: 9:00 AM – 8:00 PM\n\n" +
          "You can also continue to manage appointments here.\n" +
          "Type *MENU* at any time to view the options again."
      );
      return;
    }

    await sendWhatsAppText(
      from,
      "Sorry, I did not understand that.\n\n" +
        "Please choose one of the available options:\n\n" +
        mainMenu()
    );
    return;
  }

// ADDRESS CHOICE
if (session.step === "ADDRESS_CHOICE" && interactiveId) {

  if (interactiveId === "ADDR_TYPE") {
  session.step = "ASK_TYPED_ADDRESS";
  session.temp.addressMode = "TEXT";     // ✅ FIX
  session.temp.address = null;
  session.temp.location = null;
  session.temp.location_link = null;

    await sendWhatsAppText(
      from,
      "✍️ Please type the complete address:\n\n" +
      "• House / Flat No\n• Area / Street\n• City\n• Landmark (optional)"
    );
    return;
  }

  if (interactiveId === "ADDR_LOCATION") {
    session.step = "ASK_LOCATION";
    session.temp.addressMode = "LOCATION";
    session.temp.address = null;
    session.temp.location = null;
    session.temp.location_link = null;

    await sendWhatsAppText(
      from,
      "📍 Please share your current location using WhatsApp Location.\n\n" +
      "If location sharing is not possible, please type the address instead."
    );
    return;
  }
}

// ✅ TYPE ADDRESS → DIRECT CONFIRM
if (session.step === "ASK_TYPED_ADDRESS") {
  session.temp.address = trimmedText;
  session.temp.location_link = null;
  session.step = "FINAL_CONFIRM";
}

  if (session.step === "ASK_LOCATION") {
    const trimmedText = (text || "").trim();
    if (session.temp.location) {
      const { lat, lng, address } = session.temp.location;

      session.temp.address =
        address || "Shared via WhatsApp location";

      session.temp.location_link =
        `https://maps.google.com/?q=${lat},${lng}`;
    }
    // ✅ Manual typed address
    else if (trimmedText && trimmedText.toLowerCase() !== "skip") {
      session.temp.address = trimmedText;
      session.temp.location_link = null;
    }
    // ✅ Skip
    else {
      session.temp.address =
        session.temp.address || "Address not provided";
      session.temp.location_link = null;
    }

    session.step = "FINAL_CONFIRM";
  }

    /* ===============================
   STEP 4 — FINAL CONFIRM
================================ */
  if (session.step === "FINAL_CONFIRM" && session.temp.slot) {

  const slot = session.temp.slot;
  const user = users[from] || {};

  const record = {
    phone: from,
    patient_name: user.name || null,
    date: session.temp.date,
    time_label: slot.label,
    time_value: slot.value,
    address: session.temp.address,
    location_link: session.temp.location_link || null
  };

  appointmentsCache.push(record);
  const doctor = assignDoctor();

  // Save to database
  try {
    const res = await pool.query(
      `INSERT INTO appointments (
        phone, patient_name, date, time_label, time_value,
        address, location_link,
        doctor_name, doctor_specialization
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        record.phone,
        record.patient_name,
        record.date,
        record.time_label,
        record.time_value,
        record.address,
        record.location_link,
        doctor.name,
        doctor.specialization
      ]
    );
    console.log("✅ Appointment saved to DB - ID:", res.rows[0].id);
  } catch (err) {
    console.error("❌ Error inserting appointment:", err);
  }

  notifyDoctor({ doctor, record }).catch(console.error);

  session.step = "MENU";

  await sendWhatsAppText(
    from,
    "Health is true wealth!"+
    "✅ Appointment Confirmed\n\n" +
    `📅 ${record.date}\n` +
    `⏰ ${record.time_label}\n\n` +
    `📍 Address:\n${record.address}\n\n` +
    (record.location_link ? `🗺️ ${record.location_link}\n\n` : "") +
    `👨‍⚕️ ${doctor.name}\n${doctor.specialization}\n\n` +
    mainMenu()
  );

  return;
}

   // CONFIRMATION STEP
if (session.step === "CONFIRM") {
  if (lower === "yes") {
    session.step = "ADDRESS_CHOICE";

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
          to: from,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: "📍 How would you like to share the visit address?",
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: { id: "ADDR_TYPE", title: "✍️ Type Address" },
                },
                {
                  type: "reply",
                  reply: { id: "ADDR_LOCATION", title: "📍 Send Location" },
                },
              ],
            },
          },
        }),
      }
    );

    return;
  }


  if (lower === "no") {
    session.step = "MENU";
    await sendWhatsAppText(
      from,
      "Your appointment request has been cancelled.\n\n" + mainMenu()
    );
    return;
  }

  await sendWhatsAppText(
    from,
    "Please reply *YES* to confirm or *NO* to cancel."
  );
  return;
}

  if (lower === "menu") {
    session.step = "MENU";
    await sendWhatsAppText(from, mainMenu());
    return;
  }

  // MAIN MENU
  if (session.step === "MENU") {
    session.step = "MENU";

    if (clean === "1") {
      session.step = "DAY_SELECT";
      await sendWhatsAppList(from, {
        header: "Select Appointment Date",
        body: "Please choose a preferred date for your appointment:",
        button: "Select date",
        rows: getUpcomingDayRows(),
      });
      return;
    }

    if (clean === "2") {
      try {
        const res = await pool.query(
          `SELECT date, time_label, patient_name
           FROM appointments
           WHERE phone = $1
           ORDER BY date, time_value`,
          [from]
        );
        const rows = res.rows;
        if (!rows.length) {
          await sendWhatsAppText(
            from,
            "You do not have any appointments scheduled at the moment.\n\n" +
              "You may book a new appointment using the *Book a doctor appointment* option.\n\n" +
              mainMenu()
          );
        } else {
          const list = rows
            .map(
              (a, i) =>
                `${i + 1}. ${a.date} at ${a.time_label} (${a.patient_name ||
                  "Not specified"})`
            )
            .join("\n");
          await sendWhatsAppText(
            from,
            "Here are your appointments:\n\n" +
              list +
              "\n\n" +
              mainMenu()
          );
        }
      } catch (err) {
        console.error("Error fetching user appointments:", err);
      }
      return;
    }

    if (clean === "3") {
      await sendWhatsAppText(
        from,
        "Cuure.health Support 🩺\n\n" +
          "For any help with appointments or other queries, you may contact us at:\n\n" +
          "📞 Helpline: 08213156014 \\ 7483068353 \n" +
          "🕒 Support hours: 9:00 AM – 8:00 PM\n\n" +
          "You can also continue to manage appointments here.\n" +
          "Type *MENU* at any time to view the options again."
      );
      return;
    }

    await sendWhatsAppText(
      from,
      "Sorry, I did not understand that.\n\n" +
        "Please choose one of the available options:\n\n" +
        mainMenu()
    );
    return;
  }
}

module.exports = handleRegisteredUser;