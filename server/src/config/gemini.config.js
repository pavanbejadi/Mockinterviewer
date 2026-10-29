import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL_NAME = "gemini-3.6-flash";
const MAX_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

const getStatusCode = (error) => {
  const directStatus = Number(error.status ?? error.statusCode ?? error.code);
  if (Number.isFinite(directStatus) && directStatus >= 400) return directStatus;

  // The SDK may expose the API error as a JSON string in `message`.
  try {
    return JSON.parse(error.message)?.error?.code;
  } catch {
    return undefined;
  }
};

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const generateContent = async (prompt) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
      });

      return response.text;
    } catch (error) {
      const statusCode = getStatusCode(error);
      if (attempt < MAX_RETRIES && RETRYABLE_STATUS_CODES.has(statusCode)) {
        // Short exponential backoff gives temporary capacity spikes time to clear.
        await wait(500 * 2 ** attempt);
        continue;
      }

      // Preserve transport detail without logging request headers or credentials.
      console.error("Gemini API Error:", {
        message: error.message,
        cause: error.cause?.code || error.cause?.message || "No cause details",
      });
      throw new Error(`Gemini API failed: ${error.message}`);
    }
  }
};

export { generateContent };
