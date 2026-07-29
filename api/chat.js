import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function buildSystemPrompt() {
  return [
    "You are a warm Korean chatbot that recommends lottery numbers.",
    "Use the user's birth date and zodiac sign if provided.",
    "Always produce exactly 6 unique numbers from 1 to 45 and exactly 1 bonus number from 1 to 45 that is not in the 6 numbers.",
    "Format the reply with these exact labels on separate lines:",
    "번호: 1, 2, 3, 4, 5, 6",
    "보너스: 7",
    "이유: ...",
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

function extractRecommendation(replyText) {
  const numbersMatch = replyText.match(/번호\s*[:：]\s*([0-9,\s]+)/);
  const bonusMatch = replyText.match(/보너스\s*[:：]\s*(\d+)/);

  const numbers = numbersMatch
    ? numbersMatch[1]
        .split(/[\s,]+/)
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value))
        .slice(0, 6)
    : [];

  const bonus = bonusMatch ? Number(bonusMatch[1]) : null;
  return { numbers, bonus };
}

function extractUserMeta(messages) {
  const latestUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const birthMatch = latestUserMessage.match(/생년월일:\s*(\d{4}-\d{2}-\d{2})/);
  const zodiacMatch = latestUserMessage.match(/별자리:\s*([^\n]+)/);

  return {
    userInput: latestUserMessage,
    birthDate: birthMatch ? birthMatch[1] : null,
    zodiac: zodiacMatch ? zodiacMatch[1].trim() : null
  };
}

async function saveRecommendation(payload) {
  if (!supabaseUrl || !supabaseServiceRoleKey) return false;

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/lottery_recommendations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      Prefer: "return=minimal"
    },
    body: JSON.stringify(payload)
  });

  return response.ok;
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

    const reply = response.output_text || "응답을 생성하지 못했습니다.";
    const recommendation = extractRecommendation(reply);
    const meta = extractUserMeta(messages);

    const saved = await saveRecommendation({
      user_input: meta.userInput,
      assistant_reply: reply,
      numbers: recommendation.numbers,
      bonus_number: recommendation.bonus,
      birth_date: meta.birthDate,
      zodiac: meta.zodiac
    }).catch(() => false);

    res.status(200).json({
      reply,
      saved
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Server error" });
  }
}
