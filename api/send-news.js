import OpenAI from "openai";

const STOCK_LINKS = {
  kospiRise: "https://finance.naver.com/sise/sise_rise.naver?sosok=0",
  kosdaqRise: "https://finance.naver.com/sise/sise_rise.naver?sosok=1",
  kospiVolume: "https://finance.naver.com/sise/sise_quant.naver?sosok=0",
  kosdaqVolume: "https://finance.naver.com/sise/sise_quant.naver?sosok=1"
};

const SECTOR_LINKS = {
  ai: "https://news.google.com/search?q=AI%20%EB%B0%98%EB%8F%84%EC%B2%B4%20%EC%83%9D%EC%84%B1%ED%98%95%20AI%20%ED%95%9C%EA%B5%AD%20%EC%A6%9D%EC%8B%9C&hl=ko&gl=KR&ceid=KR:ko",
  bio: "https://news.google.com/search?q=%EB%B0%94%EC%9D%B4%EC%98%A4%20%EC%A0%9C%EC%95%BD%20%EC%9E%84%EC%83%81%20FDA%20%ED%95%9C%EA%B5%AD%20%EC%A6%9D%EC%8B%9C&hl=ko&gl=KR&ceid=KR:ko",
  material: "https://news.google.com/search?q=%EC%86%8C%EC%9E%AC%202%EC%B0%A8%EC%A0%84%EC%A7%80%20%EB%B0%98%EB%8F%84%EC%B2%B4%20%EC%86%8C%EC%9E%AC%20%ED%9D%AC%ED%86%A0%EB%A5%98%20%ED%95%9C%EA%B5%AD%20%EC%A6%9D%EC%8B%9C&hl=ko&gl=KR&ceid=KR:ko"
};

const FLIGHT_LINKS = {
  qingdao: "https://www.skyscanner.co.kr/transport/flights/icn/tao/?adults=1&adultsv2=1&cabinclass=economy&rtn=0",
  fukuoka: "https://www.skyscanner.co.kr/transport/flights/icn/fuk/?adults=1&adultsv2=1&cabinclass=economy&rtn=0",
  danang: "https://www.skyscanner.co.kr/transport/flights/icn/dad/?adults=1&adultsv2=1&cabinclass=economy&rtn=0"
};

function todayKst() {
  return new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const result = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: true
    })
  });
  if (!result.ok) throw new Error(await result.text());
}

async function buildBriefing() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const input = `아침 텔레그램 브리핑을 한국어로 짧고 읽기 좋게 작성해.

조건:
- 실시간 종목명과 기사 원문을 직접 조회한 것처럼 말하지 말 것.
- 대신 아래 링크를 눌러 확인하라는 식으로 안내.
- 주식은 급락 제외.
- 코스피 급등 5, 코스닥 급등 5, 코스피 거래상위 5, 코스닥 거래상위 5를 각각 링크와 함께 표시.
- 관심섹터는 AI, 바이오, 소재 3개만 표시하고 각 뉴스 링크를 붙여.
- 항공권은 칭다오, 후쿠오카, 다낭 3개만 추천하고 링크를 붙여.
- 링크가 너무 길어도 그대로 붙이지 말고 항목별로 한 줄씩 깔끔하게 배치.
- 마지막에 투자·예약 전 공식 경로 재확인 문구를 넣어.

자료 링크:
코스피 급등 5: ${STOCK_LINKS.kospiRise}
코스닥 급등 5: ${STOCK_LINKS.kosdaqRise}
코스피 거래상위 5: ${STOCK_LINKS.kospiVolume}
코스닥 거래상위 5: ${STOCK_LINKS.kosdaqVolume}
AI 뉴스: ${SECTOR_LINKS.ai}
바이오 뉴스: ${SECTOR_LINKS.bio}
소재 뉴스: ${SECTOR_LINKS.material}
칭다오 항공권: ${FLIGHT_LINKS.qingdao}
후쿠오카 항공권: ${FLIGHT_LINKS.fukuoka}
다낭 항공권: ${FLIGHT_LINKS.danang}`;

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input,
    max_output_tokens: 900
  });

  return response.output_text;
}

export default async function handler(req, res) {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID || !process.env.OPENAI_API_KEY) {
      throw new Error("Missing environment variables");
    }

    const briefing = await buildBriefing();
    const message = `🌅 아침 브리핑\n실행 시각: ${todayKst()}\n\n${briefing}`;
    await sendTelegram(message);
    res.status(200).json({ ok: true, sent: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
}
