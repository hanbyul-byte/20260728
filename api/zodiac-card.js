export const runtime = "nodejs";
export const maxDuration = 30;

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildCardSvg({ zodiac, birthDate, numbersText }) {
  const safeZodiac = escapeXml(zodiac || "별자리");
  const safeBirthDate = escapeXml(birthDate || "");
  const safeNumbers = escapeXml(numbersText || "");

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#09092b"/>
        <stop offset="55%" stop-color="#171b74"/>
        <stop offset="100%" stop-color="#050515"/>
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <rect width="1200" height="1600" fill="url(#bg)" />
    <g opacity="0.9" fill="#ffffff">
      <circle cx="120" cy="180" r="4"/>
      <circle cx="260" cy="110" r="3"/>
      <circle cx="980" cy="160" r="4"/>
      <circle cx="1050" cy="420" r="3"/>
      <circle cx="180" cy="1180" r="4"/>
      <circle cx="980" cy="1260" r="3"/>
    </g>
    <g stroke="#fff7a6" stroke-width="10" fill="none" filter="url(#glow)" stroke-linecap="round" stroke-linejoin="round">
      <path d="M340 670 C390 430, 520 340, 710 360 C870 375, 960 500, 935 650 C910 805, 785 900, 620 920 C470 935, 360 840, 340 670Z" />
      <path d="M520 430 C470 320, 430 270, 410 250" />
      <path d="M690 430 C740 320, 780 270, 810 250" />
      <path d="M435 610 C585 720, 760 730, 885 650" />
      <path d="M430 640 L260 600" />
      <path d="M900 650 L1060 540" />
      <path d="M600 920 L560 1220" />
      <path d="M670 920 L740 1225" />
      <path d="M470 920 L430 1220" />
      <path d="M840 920 L880 1220" />
    </g>
    <g fill="#fff7a6" filter="url(#glow)">
      <circle cx="510" cy="530" r="12"/>
      <circle cx="690" cy="530" r="12"/>
      <circle cx="260" cy="600" r="10"/>
      <circle cx="1060" cy="540" r="10"/>
      <circle cx="560" cy="1220" r="10"/>
      <circle cx="740" cy="1225" r="10"/>
      <circle cx="430" cy="1220" r="10"/>
      <circle cx="880" cy="1220" r="10"/>
    </g>
    <text x="600" y="1180" text-anchor="middle" font-size="82" font-family="Pretendard, Arial, sans-serif" fill="#ffffff" font-weight="700">${safeZodiac}</text>
    <text x="600" y="1255" text-anchor="middle" font-size="34" font-family="Pretendard, Arial, sans-serif" fill="#d7dcff">${safeBirthDate}</text>
    <text x="600" y="1325" text-anchor="middle" font-size="28" font-family="Pretendard, Arial, sans-serif" fill="#bfc7ff">${safeNumbers}</text>
  </svg>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const zodiac = body.zodiac || "별자리";
    const birthDate = body.birthDate || "";
    const numbersText = body.numbersText || "";
    const svg = buildCardSvg({ zodiac, birthDate, numbersText });
    const imageDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    res.status(200).json({
      mode: "demo",
      imageDataUrl
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Server error",
      message: "별자리 카드를 만들지 못했습니다."
    });
  }
}
