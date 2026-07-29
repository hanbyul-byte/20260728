export default function handler(req, res) {
  const configured = Boolean(process.env.OPENAI_API_KEY);

  res.status(200).json({
    ok: true,
    openaiConfigured: configured,
    status: configured ? "ready" : "missing_api_key"
  });
}
