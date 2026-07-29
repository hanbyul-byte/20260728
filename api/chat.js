import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildSystemPrompt() {
  return [
    "You are a warm Korean chatbot that recommends lottery numbers.",
    "Use the user's birth date and zodiac sign if provided.",
    "Always produce exactly 6 unique numbers from 1 to 45 and exactly 1 bonus number from 1 to 45 that is not in the 6 numbers.",
    "Keep the reply playful and concise, and explain why those numbers were chosen.",
    "If possible, mention zodiac tendencies in the explanation.",
    "Do not claim the numbers are predictive or guaranteed."
  ].join(" ");
}

function normalizeMessages(messages) {
  return messages
    .filter((m) => m && typeof m.content === "string")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content
    }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: "OPENAI_API_KEY is not configured." });
    return;
  }

  try {
    const parsed = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const messages = normalizeMessages(Array.isArray(parsed.messages) ? parsed.messages : []);

    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      instructions: buildSystemPrompt(),
      input: messages,
      reasoning: { effort: "low" },
      max_output_tokens: 500
    });

    res.status(200).json({
      reply: response.output_text || "응답을 생성하지 못했습니다."
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Server error" });
  }
}
