export const config = {
  api: {
    bodyParser: true
  }
};

export const runtime = "nodejs";
export const maxDuration = 30;

const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);
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

function getZodiacFromBirthDate(birthDate) {
  if (!birthDate) return null;

  const parts = birthDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((value) => !Number.isFinite(value))) return null;

  const month = parts[1];
  const day = parts[2];
  const ranges = [
    { name: "염소자리", start: [12, 22], end: [1, 19] },
    { name: "물병자리", start: [1, 20], end: [2, 18] },
    { name: "물고기자리", start: [2, 19], end: [3, 20] },
    { name: "양자리", start: [3, 21], end: [4, 19] },
    { name: "황소자리", start: [4, 20], end: [5, 20] },
    { name: "쌍둥이자리", start: [5, 21], end: [6, 21] },
    { name: "게자리", start: [6, 22], end: [7, 22] },
    { name: "사자자리", start: [7, 23], end: [8, 22] },
    { name: "처녀자리", start: [8, 23], end: [9, 22] },
    { name: "천칭자리", start: [9, 23], end: [10, 22] },
    { name: "전갈자리", start: [10, 23], end: [11, 22] },
    { name: "사수자리", start: [11, 23], end: [12, 21] }
  ];

  for (const zodiac of ranges) {
    const [sMonth, sDay] = zodiac.start;
    const [eMonth, eDay] = zodiac.end;
    if ((month === sMonth && day >= sDay) || (month === eMonth && day <= eDay)) {
      return zodiac.name;
    }
  }

  return "염소자리";
}

function buildSeedFromBirthDate(birthDate) {
  if (!birthDate) return 73;
  return birthDate
    .split("-")
    .map(Number)
    .filter((value) => Number.isFinite(value))
    .reduce((acc, value) => acc * 31 + value, 17);
}

function buildDemoNumbers(birthDate) {
  const seed = buildSeedFromBirthDate(birthDate);
  const numbers = [];
  let current = seed;

  while (numbers.length < 6) {
    current = (current * 1103515245 + 12345) % 2147483648;
    const candidate = (current % 45) + 1;
    if (!numbers.includes(candidate)) {
      numbers.push(candidate);
    }
  }

  numbers.sort((a, b) => a - b);

  let bonus = ((current * 1664525 + 1013904223) % 45) + 1;
  while (numbers.includes(bonus)) {
    bonus = (bonus % 45) + 1;
  }

  return { numbers, bonus };
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

function buildDemoReply(messages) {
  const meta = extractUserMeta(messages);
  const zodiac = meta.zodiac || getZodiacFromBirthDate(meta.birthDate) || "별자리";
  const { numbers, bonus } = buildDemoNumbers(meta.birthDate);

  return [
    "데모 모드로 동작합니다.",
    "",
    `번호: ${numbers.join(", ")}`,
    `보너스: ${bonus}`,
    `이유: ${zodiac}의 흐름을 살짝 참고해서 홀짝과 구간이 너무 한쪽으로 쏠리지 않게 골랐어요. 재미로만 봐주세요.`
  ].join("\n");
}

async function readRequestBody(req) {
  if (typeof req.body === "string") {
    return JSON.parse(req.body || "{}");
  }

  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.json === "function") {
    return await req.json();
  }

  return {};
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

async function generateReply(messages) {
  if (!hasOpenAIKey) {
    return { reply: buildDemoReply(messages), mode: "demo" };
  }

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: "gpt-5.4-mini",
    instructions: buildSystemPrompt(),
    input: messages,
    reasoning: { effort: "low" },
    max_output_tokens: 500
  });

  return {
    reply: response.output_text || buildDemoReply(messages),
    mode: "live"
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const parsed = await readRequestBody(req);
    const messages = normalizeMessages(Array.isArray(parsed.messages) ? parsed.messages : []);
    const generated = await generateReply(messages);
    const recommendation = extractRecommendation(generated.reply);
    const meta = extractUserMeta(messages);

    const saved =
      generated.mode === "live" &&
      (await saveRecommendation({
        user_input: meta.userInput,
        assistant_reply: generated.reply,
        numbers: recommendation.numbers,
        bonus_number: recommendation.bonus,
        birth_date: meta.birthDate,
        zodiac: meta.zodiac
      }).catch(() => false));

    res.status(200).json({
      reply: generated.reply,
      mode: generated.mode,
      saved
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Server error",
      message: "서버 연결에 실패했어요. 잠시 후 다시 시도해 주세요."
    });
  }
}
