import { GoogleGenAI, Type } from "@google/genai";

export const schema = {
  type: Type.OBJECT,
  properties: {
    date: {
      type: Type.STRING,
      description:
        "Transaction date in DD/MM/YYYY format. If not provided, the current date will be used. This is required.",
    },
    note: {
      type: Type.STRING,
      description: "Short description of the expense",
    },
    amount: {
      type: Type.NUMBER,
      description: "Transaction amount. This is required.",
    },
    category: {
      type: Type.STRING,
      enum: ["Tiền chợ", "Ăn ngoài", "Mua sắm", "Chi tiêu khác"],
      format: "enum",
      description: "Category of the expense",
    },
  },
  required: ["note", "date", "amount", "category"],
  propertyOrdering: ["date", "amount", "note", "category"],
};

export const systemInstruction = `You are a financial assistant that extracts structured expense data from natural language.

    Rules:
    - Always return **only valid JSON** that follows the schema.
    - If the input does not provide a date, use the current date: ${new Date().toLocaleDateString("vi-VN")}
    - Parse amounts like "45k" → 45000, "1.2tr" → 1200000.
    - Translate months to numbers (e.g., "tháng 8" → "08").
    - Map categories:
      - groceries/market/rau/cá/thịt → "Tiền chợ"
      - eating out/restaurant/cafe/bún phở → "Ăn ngoài"
      - shopping/buying stuff/clothes/electronics → "Mua sắm"
      - everything else → "Chi tiêu khác"
    - Keep notes short.
  `;

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_TOKEN || "",
});

export default genAI;
