"use server";

import dayjs from "@/configs/date";
import { google } from "googleapis";

export async function appendToGoogleSheet(data: TExpense & { by: string }) {
  try {
    const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    if (!key) {
      throw new Error("GOOGLE_SHEETS_PRIVATE_KEY is not set");
    }
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      key: key.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const rowData = [
      dayjs(data.date, "DD/MM/YYYY").format("DD/MM/YYYY"),
      data.amount,
      data.note || "",
      data.category,
      data.by,
    ];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      range: process.env.GOOGLE_SHEETS_RANGE || "Sheet1!A:E", // Default to first sheet
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [rowData],
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error appending to Google Sheet:", error);
    const errorResponse = error as {
      response: { data: { error: { message: string } } };
    };
    console.error(errorResponse.response);
    throw new Error("Failed to append to Google Sheet");
  }
}
