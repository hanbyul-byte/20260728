export default function handler(req, res) {
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const supabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

  res.status(200).json({
    ok: true,
    openaiConfigured,
    supabaseConfigured,
    status: openaiConfigured && supabaseConfigured ? "ready" : "missing_env"
  });
}
