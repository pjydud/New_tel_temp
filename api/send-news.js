import OpenAI from "openai";

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function googleSearchUrl(query) {
  return "https://www.google.com/search?q=" + encodeURIComponent(query);
}

function skyscannerUrl(origin, destination) {
  return `https://www.skyscanner.co.kr/transport/flights/${origin.toLowerCase()}/${destination.toLowerCase()}/?adults=1&adultsv2=1&cabinclass=economy&rtn=0`;
}

function kayakUrl(origin, destination, dateFrom) {
  return `https://www.kayak.co.kr/flights/${origin}-${destination}/${dateFrom}-flexible-3days?sort=price_a`;
}

const ORIGIN = "ICN";
const DESTINATIONS = [
  { country: "중국", name: "칭다오", code: "TAO", deal: "18만 원 이하" },
  { country: "중국", name: "상하이", code: "PVG", deal: "22만 원 이하" },
  { country: "일본", name: "후쿠오카", code: "FUK", deal: "17만 원 이하" },
  { country: "일본", name: "오사카", code: "KIX", deal: "22만 원 이하" },
  { country: "일본", name: "도쿄/나리타", code: "NRT", deal: "25만 원 이하" },
  { country: "대만", name: "타이베이", code: "TPE", deal: "26만 원 이하" },
  { country: "베트남", name: "다낭", code: "DAD", deal: "30만 원 이하" },
  { country: "베트남", name: "나트랑", code: "CXR", deal: "33만 원 이하" },
  { country: "태국", name: "방콕", code: "BKK", deal: "36만 원 이하" },
  { country: "필리핀", name: "마닐라", code: "MNL", deal: "26만 원 이하" }
];

function buildFlightLinks(dateFrom, dateTo) {
  return DESTINATIONS.map((d, index) => {
    const googleQuery = `Google Flights ${ORIGIN} to ${d.code} ${dateFrom} ${dateTo}`;
    return `${index + 1}. ${d.country} ${d.name}(${d.code}) / 특가 기준 ${d.deal}\n` +
      `   Google: ${googleSearchUrl(googleQuery)}\n` +
      `   Skyscanner: ${skyscannerUrl(ORIGIN, d.code)}\n` +
      `   Kayak: ${kayakUrl(ORIGIN, d.code, dateFrom)}`;
  }).join("\n\n");
}

async function sendTelegram(text) {
  const telegramUrl = "https://api.telegram.org" + "/bot" + process.env.TELEGRAM_BOT_TOKEN + "/sendMessage";

  const result = await fetch(telegramUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: true
    })
  });

  if (!result.ok) {
    const body = await result.text();
    throw new Error(`Telegram error: ${result.status} ${body}`);
  }
}

export default async function handler(req, res) {
  try {
    if (!process.env.OPENAI_API_KEY || !process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      throw new Error("Missing required environment variables");
    }

    const today = new Date();
    const dateFrom = formatDate(addDays(today, 1));
    const dateTo = formatDate(addDays(today, 15));
    const flightLinks = buildFlightLinks(dateFrom, dateTo);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      max_output_tokens: 1100,
      input: `너는 매일 아침 텔레그램으로 보내는 개인 브리핑 비서야.

아래 조건으로 한국어 브리핑을 작성해.

[중요한 제한]
- 너는 실시간 항공권 가격과 실시간 주가를 직접 조회하지 못한다.
- 그래서 실제 가격/시세를 본 것처럼 말하지 말고, 사용자가 바로 눌러 확인할 검색 링크와 오늘 체크 기준을 제공한다.
- 투자 권유처럼 말하지 말고 참고용이라고 표시한다.

[구성]
1. 📈 오늘 주식/시장 체크
- KOSPI, KOSDAQ, 삼성전자, SK하이닉스, NVIDIA, AMD, TSLA, BTC 기준으로 오늘 볼 포인트를 간단히 정리
- 급등주 실시간 목록은 증권사 앱/네이버증권에서 확인하라고 안내

2. ✈️ 항공권 특가 체크
- 인천 출발, ${dateFrom} ~ ${dateTo} 출발 기준
- 중국, 일본, 동남아 위주
- 아래 링크 목록 중 오늘 먼저 눌러볼 만한 5개를 추천
- 유류할증료/세금/수하물 포함 여부와 항공사 공식 홈페이지 최종 비교 안내

3. 🤖 AI/기술 뉴스 체크
- 오늘 확인하면 좋은 AI/반도체/빅테크 이슈 키워드 5개

[항공권 검색 링크 목록]
${flightLinks}

너무 길지 않게 텔레그램 메시지로 보내기 좋은 형태로 작성해.`
    });

    const message = `🌅 아침 브리핑\n실행 시각: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}\n\n${response.output_text}`;

    await sendTelegram(message);

    res.status(200).json({ ok: true, sent: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
}
