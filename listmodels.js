require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.my_key);
    const response = await genAI.listModels(); // Fetch all available models
    console.log("Available Models:\n", response);
  } catch (err) {
    console.error("Error listing models:", err);
  }
}

listModels();
