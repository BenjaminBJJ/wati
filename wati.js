const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
require("dotenv").config(); // Загружаем переменные окружения из .env файла

const app = express();
const PORT = 3000;

// 👉 Настройки amoCRM
const AMO_TOKEN = process.env.AMO_ACCESS_TOKEN;
if (!AMO_TOKEN) {
  console.error("AMO_TOKEN не установлен");
  process.exit(1);
}
const AMO_DOMAIN = process.env.AMO_DOMAIN;

// 👉 Настройки Express
app.use(bodyParser.json());

// 👉 Обработка Webhook от WATI
app.post("/wati-webhook", async (req, res) => {
  try {
    const message = req.body;
    const waId = message.waId || message.phone;
    const text = message.text || message.message;

    if (!waId || !text) {
      return res.status(400).json({ error: "Недостаточно данных от Wati" });
    }

    const phone = "+" + waId;

    // === 1. Поиск контакта в amoCRM ===
    const contactSearch = await axios.get(
      `https://${AMO_DOMAIN}/api/v4/contacts`,
      {
        headers: { Authorization: `Bearer ${AMO_TOKEN}` },
        params: { query: phone },
      }
    );

    let contactId;

    if (contactSearch.data._embedded.contacts.length > 0) {
      contactId = contactSearch.data._embedded.contacts[0].id;
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

    // === 3. Создание лида, связанного с контактом ===
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
  } catch (error) {
    console.error(
      "❌ Ошибка при обработке:",
      error.response?.data || error.message
    );
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Сервер слушает порт ${PORT}`);
});
