function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function newsLink(query) {
  return `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
}

function flightLink(origin, dest) {
  return `https://www.skyscanner.co.kr/transport/flights/${origin.toLowerCase()}/${dest.toLowerCase()}/?adults=1&adultsv2=1&cabinclass=economy&rtn=0`;
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

  if (!result.ok) {
    throw new Error(await result.text());
  }
}

function buildMessage() {
  const now = new Date();
  const dateFrom = formatDate(addDays(now, 1));
  const dateTo = formatDate(addDays(now, 15));
  const time = now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  return `🌅 아침 브리핑\n실행 시각: ${time}\n\n` +
`📈 9시10분 주식 체크\n` +
`※ 네이버 금융 기준. 장중 변동·지연 가능. 투자 참고용.\n\n` +
`코스피 급등 5\nhttps://finance.naver.com/sise/sise_rise.naver?sosok=0\n\n` +
`코스닥 급등 5\nhttps://finance.naver.com/sise/sise_rise.naver?sosok=1\n\n` +
`코스피 거래상위 5\nhttps://finance.naver.com/sise/sise_quant.naver?sosok=0\n\n` +
`코스닥 거래상위 5\nhttps://finance.naver.com/sise/sise_quant.naver?sosok=1\n\n` +
`🔬 관심 섹터 뉴스\n\n` +
`AI\n${newsLink("AI 반도체 생성형 AI 한국 증시")}\n\n` +
`바이오\n${newsLink("바이오 제약 임상 FDA 한국 증시")}\n\n` +
`소재\n${newsLink("소재 2차전지 반도체 소재 희토류 한국 증시")}\n\n` +
`✈️ 항공권 특가 확인\n` +
`기간: ${dateFrom} ~ ${dateTo}, 인천 출발 기준\n\n` +
`중국: 칭다오 / 상하이\n${flightLink("ICN", "TAO")}\n${flightLink("ICN", "PVG")}\n\n` +
`일본: 후쿠오카 / 오사카\n${flightLink("ICN", "FUK")}\n${flightLink("ICN", "KIX")}\n\n` +
`동남아: 다낭 / 방콕\n${flightLink("ICN", "DAD")}\n${flightLink("ICN", "BKK")}\n\n` +
`투자·예약 전 공식 경로에서 반드시 재확인.`;
}

export default async function handler(req, res) {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      throw new Error("Missing Telegram environment variables");
    }

    const message = buildMessage();
    await sendTelegram(message);
    res.status(200).json({ ok: true, sent: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
}
