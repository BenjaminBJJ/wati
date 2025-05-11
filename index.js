const axios = require("axios");
require("dotenv").config();

const accessToken = process.env.AMO_ACCESS_TOKEN;
const domain = process.env.AMO_DOMAIN;

async function createSimpleLead() {
  try {
    const response = await axios.post(
      `https://${domain}/api/v4/leads`,
      [
        {
          name: "Тестовый лид",
        },
      ],
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Лид создан:", response.data);
  } catch (error) {
    console.error("Ошибка:", error.response?.data || error.message);
  }
}

createSimpleLead();
