"use server";

import genAI, { schema, systemInstruction } from "@/configs/gemini";

const parseExpense = (input: string): TExpense => {
  return JSON.parse(input) as TExpense;
};

export const processInput = async (input: string) => {
  try {
    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        systemInstruction: systemInstruction,
      },
      contents: [input],
    });
    return parseExpense(result.text ?? "");
  } catch (error) {
    console.error(error);
    return null;
  }
};
