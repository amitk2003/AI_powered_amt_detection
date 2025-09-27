// services/geminiService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function callGemini(prompt, inputText) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    const result = await model.generateContent(`${prompt}\n\nInput:\n${inputText}`);
    const response = await result.response;
    return response.text();
  } catch (err) {
    console.error("Gemini Error:", err);
    return null;
  }
}

async function refineOCR(rawText) {
  const prompt = `
Fix OCR errors in text. Correct numbers like 'l200' -> '1200', 'T0tal' -> 'Total'.
Return only corrected text.
  `;
  return await callGemini(prompt, rawText);
}

async function classifyWithGemini(cleanedText, amounts) {
  const prompt = `
Classify each amount in a medical bill into categories:
[total_bill, paid, due, discount, consultation_fee, medicine_cost, tax, extra].
Return JSON in format:
{ "amounts": [ { "type": "...", "value": ... } ] }
  `;
  const input = `Amounts: ${JSON.stringify(amounts)}\nText:\n${cleanedText}`;
  return await callGemini(prompt, input);
}

module.exports = { refineOCR, classifyWithGemini };
