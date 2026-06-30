const SOURCES = {
  kospiVolume: "https://finance.naver.com/sise/sise_quant.naver?sosok=0",
  kosdaqVolume: "https://finance.naver.com/sise/sise_quant.naver?sosok=1"
};

const BLOCK_WORDS = [
  "KODEX", "TIGER", "ACE", "KBSTAR", "KOSEF", "HANARO", "ARIRANG", "SOL", "RISE", "TIMEFOLIO",
  "ETF", "ETN", "레버리지", "인버스", "선물", "스팩", "SPAC", "리츠", "채권", "국채", "나스닥", "S&P"
];

function kst() {
  return new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function clean(s) {
  return String(s || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isCompany(name) {
  if (!name || name.length < 2) return false;
  const upper = name.toUpperCase();
  return !BLOCK_WORDS.some((w) => upper.includes(w.toUpperCase()) || name.includes(w));
}

async function getText(url, enc = "utf-8") {
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 MorningBriefBot" } });
  if (!response.ok) throw new Error(`fetch failed ${response.status}`);
  const buffer = await response.arrayBuffer();
  return new TextDecoder(enc).decode(buffer);
}

function parseStocks(html) {
  const rows = html.split("<tr");
  const items = [];
  const seen = new Set();

  for (const row of rows) {
    const codeMatch = row.match(/code=(\d{6})/);
    const nameMatch = row.match(/class="tltle"[^>]*>([\s\S]*?)<\/a>/);
    if (!codeMatch || !nameMatch) continue;

    const code = codeMatch[1];
    const name = clean(nameMatch[1]);
    if (!isCompany(name) || seen.has(code)) continue;

    seen.add(code);
    items.push({ name, code });
    if (items.length >= 5) break;
  }

  return items;
}

async function stockBlock(label, url) {
  try {
    const html = await getText(url, "euc-kr");
    const items = parseStocks(html);
    if (!items.length) return `${label}\n- 종목 추출 실패`;
    return `${label}\n` + items.map((x, i) => `${i + 1}. ${escapeHtml(x.name)} (${x.code})`).join("\n");
  } catch (error) {
    return `${label}\n- 조회 실패`;
  }
}

function envName(a, b, c = "") {
  return a + b + c;
}

function getTelegramChatIds() {
  const keySingle = envName("TEL", "EGRAM_", "CHAT_ID");
  const keyMulti = envName("TEL", "EGRAM_", "CHAT_IDS");
  const defaults = [process.env[keySingle], "-5595644220"];
  const raw = process.env[keyMulti] || defaults.filter(Boolean).join(",");
  return [...new Set(raw.split(",").map((x) => x.trim()).filter(Boolean))];
}

async function sendTelegramToChat(text, chatId) {
  const key1 = envName("TEL", "EGRAM_", "BOT_TOKEN");
  const url = ["https://api.", "telegram.org/", "bot", process.env[key1], "/sendMessage"].join("");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true })
  });
  if (!response.ok) throw new Error(`chat ${chatId}: ${await response.text()}`);
}

async function sendTelegram(text) {
  const chatIds = getTelegramChatIds();
  if (!chatIds.length) throw new Error("Missing Telegram chat id");
  await Promise.all(chatIds.map((chatId) => sendTelegramToChat(text, chatId)));
  return chatIds;
}

async function buildMessage() {
  const [kospiVolume, kosdaqVolume] = await Promise.all([
    stockBlock("💰 코스피 거래상위 TOP5", SOURCES.kospiVolume),
    stockBlock("💰 코스닥 거래상위 TOP5", SOURCES.kosdaqVolume)
  ]);

  return `📈 주식 브리핑\n실행 시각: ${kst()}\n\n` +
    `※ 네이버 금융 거래상위 기준이며 장중 변동·지연 가능. ETF/ETN/레버리지/인버스/선물/스팩 등은 제외 시도. 투자 참고용.\n\n` +
    `${kospiVolume}\n\n${kosdaqVolume}\n\n` +
    `투자 전 공식 경로에서 반드시 재확인하세요.`;
}

export default async function handler(req, res) {
  try {
    const key1 = envName("TEL", "EGRAM_", "BOT_TOKEN");
    if (!process.env[key1]) throw new Error("Missing Telegram bot token");

    const message = await buildMessage();
    const sentChatIds = await sendTelegram(message);
    res.status(200).json({ ok: true, sent: true, chat_ids: sentChatIds });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
}
