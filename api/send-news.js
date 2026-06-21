import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `오늘 기준 대한민국 주요뉴스 5개와 AI/기술뉴스 5개를 한국어로 요약해줘.

형식:
📰 오늘의 주요 뉴스

[국내 뉴스]
1. 제목
- 핵심 요약 2문장

[AI/기술 뉴스]
1. 제목
- 핵심 요약 2문장`,
      tools: [{ type: "web_search_preview" }]
    });

    const telegramUrl = "https://api.telegram.org" + "/bot" + process.env.TELEGRAM_BOT_TOKEN + "/sendMessage";

    const telegramResponse = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: response.output_text
      })
    });

    if (!telegramResponse.ok) {
      const text = await telegramResponse.text();
      throw new Error("Telegram send failed: " + text);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}
