import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `한국 주식시장 개장 후 기준으로 전일 종가 대비 10% 이상 상승한 코스피 또는 코스닥 종목 중 거래가 활발한 종목 최대 5개만 정리해줘.

각 종목별로:
- 종목명
- 상승률
- 급등 사유 추정 2줄 이내

불필요한 설명 없이 간결하게 작성.
해당 종목이 거의 없으면 있는 종목만 작성.`
    });

    const telegramUrl = "https://api.telegram.org" + "/bot" + process.env.TELEGRAM_BOT_TOKEN + "/sendMessage";

    await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: response.output_text
      })
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}
