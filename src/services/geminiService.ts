import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const analyzeReceipt = async (base64Image: string): Promise<Partial<Transaction>> => {
  const model = "gemini-3-flash-preview";
  const prompt = `Extract transaction details from this East African Mobile Money (MoMo) or utility receipt screenshot. 
  Return JSON with: amount (number), type ('IN' or 'OUT'), category ('MoMo', 'Trade', 'Utility', 'Other'), date (ISO 8601), description (string).
  If it's a Yaka! or Water bill, category is 'Utility'. If it's a payment to a supplier, category is 'Trade'.`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      { text: prompt },
      { inlineData: { data: base64Image.split(',')[1] || base64Image, mimeType: "image/png" } }
    ],
    config: { responseMimeType: "application/json" }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return {};
  }
};
