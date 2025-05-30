const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
require("dotenv").config(); // Загружаем переменные окружения из .env файла

const app = express();
const PORT = 3000;

// === amoCRM настройки ===
const AMO_TOKEN = process.env.AMO_ACCESS_TOKEN;
if (!AMO_TOKEN) {
  console.error("AMO_TOKEN не установлен");
  process.exit(1);
}
const AMO_DOMAIN = process.env.AMO_DOMAIN;
if (!AMO_TOKEN || !AMO_DOMAIN) {
  console.error("AMO_TOKEN или AMO_DOMAIN не установлены");
  process.exit(1);
}

app.use(bodyParser.json());

// === Убедимся, что папка для логов существует ===
const logDir = path.join(__dirname, "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// === Функция для логирования входящих сообщений ===
function logMessage(data) {
  const logFile = path.join(logDir, "wati-incoming.log");
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `${timestamp} | ${JSON.stringify(data)}\n`);
}

// === Webhook от Wati ===
app.post("/wati-webhook", async (req, res) => {
  try {
    const message = req.body;
    logMessage(message); // 📦 Сохраняем сообщение в лог

    const waId = message.waId || message.phone;
    const text = message.text || message.message || "Сообщение без текста";

    if (!waId) {
      return res.status(400).json({ error: "waId отсутствует в сообщении" });
    }

    const phone = "+" + waId.replace(/\D/g, "");

    // === 1. Поиск контакта ===
    const contactSearchRes = await axios.get(
      `https://${AMO_DOMAIN}/api/v4/contacts`,
      {
        headers: { Authorization: `Bearer ${AMO_TOKEN}` },
        params: { query: phone },
      }
    );

    const contacts = contactSearchRes.data?._embedded?.contacts;
    let contactId;

    if (contacts && contacts.length > 0) {
      contactId = contacts[0].id;
    } else {
      // === 2. Создание контакта ===
      const contactCreate = await axios.post(
        `https://${AMO_DOMAIN}/api/v4/contacts`,
        [
          {
            name: `Контакт с WATI`,
            custom_fields_values: [
              {
                field_code: "PHONE",
                values: [{ value: phone }],
              },
            ],
          },
        ],
        {
          headers: {
            Authorization: `Bearer ${AMO_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );
      contactId = contactCreate.data._embedded.contacts[0].id;
    }

    // === 3. Создание лида ===
    const leadCreate = await axios.post(
      `https://${AMO_DOMAIN}/api/v4/leads`,
      [
        {
          name: `WATI: ${text}`,
          _embedded: {
            contacts: [{ id: contactId }],
          },
        },
      ],
      {
        headers: {
          Authorization: `Bearer ${AMO_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Лид создан:", leadCreate.data);
    res.sendStatus(200);
  } catch (err) {
    const errMsg = err.response?.data || err.message;
    console.error("❌ Ошибка при обработке Webhook:", errMsg);
    logMessage({ error: errMsg });
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});
