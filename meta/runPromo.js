require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const path = require("path");
const { sendFromExcel } = require("./sendFromExcel");

const excelPath = path.join(__dirname, "..", "promo_contacts.xlsx");

sendFromExcel(excelPath);