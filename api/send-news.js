import OpenAI from "openai";

const SOURCES = {
  kospiRise: "https://finance.naver.com/sise/sise_rise.naver?sosok=0",
  kosdaqRise: "https://finance.naver.com/sise/sise_rise.naver?sosok=1",
  kospiVolume: "https://finance.naver.com/sise/sise_quant.naver?sosok=0",
  kosdaqVolume: "https://finance.naver.com/sise/sise_quant.naver?sosok=1"
};

const BLOCK_WORDS = [
  "KODEX", "TIGER", "ACE", "KBSTAR", "KOSEF", "HANARO", "ARIRANG", "SOL", "RISE", "TIMEFOLIO",
  "ETF", "ETN", "레버리지", "인버스", "선물", "스팩", "SPAC", "리츠", "채권", "국채", "나스닥", "S&P"
];

const FLIGHTS = [
  ["칭다오", "https://www.skyscanner.co.kr/transport/flights/icn/tao/?adults=1&adultsv2=1&cabinclass=economy&rtn=0"],
  ["후쿠오카", "https://www.skyscanner.co.kr/transport/flights/icn/fuk/?adults=1&adultsv2=1&cabinclass=economy&rtn=0"],
  ["다낭", "https://www.skyscanner.co.kr/transport/flights/icn/dad/?adults=1&adultsv2=1&cabinclass=economy&rtn=0"]
];

const NEWS = [
  ["AI", "AI 반도체 생성형 AI 한국 증시"],
  ["바이오", "바이오 제약 임상 FDA 한국 증시"],
  ["소재", "소재 2차전지 반도체 소재 희토류 한국 증시"]
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

function isCompany(name) {
  if (!name || name.length < 2) return false;
  const upper = name.toUpperCase();
  return !BLOCK_WORDS.some((w) => upper.includes(w.toUpperCase()) || name.includes(w));
}

async function getText(url, enc = "utf-8") {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`fetch failed ${r.status}`);
  const b = await r.arrayBuffer();
  return new TextDecoder(enc).decode(b);
}

function parseStocks(html) {
  const rows = html.split("<tr");
  const items = [];
  const seen = new Set();

  for (const row of rows) {
    const code = row.match(/code=(\d{6})/);
    const nameMatch = row.match(/class="tltle"[^>]*>([\s\S]*?)<\/a>/);
    if (!code || !nameMatch) continue;

    const name = clean(nameMatch[1]);
    if (!isCompany(name) || seen.has(code[1])) continue;

    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => clean(m[1])).filter(Boolean);
    const pct = cells.find((x) => x.includes("%")) || "";
    const price = cells.find((x) => /^[0-9,]+$/.test(x)) || "";

    seen.add(code[1]);
    items.push({ name, code: code[1], price, pct, link: `https://finance.naver.com/item/main.naver?code=${code[1]}` });
    if (items.length >= 5) break;
  }
  return items;
}

async function stockBlock(label, url) {
  try {
    const html = await getText(url, "euc-kr");
    const items = parseStocks(html);
    if (!items.length) return `${label}\n- 종목 추출 실패. 직접 확인: ${url}`;
    return `${label}\n` + items.map((x, i) => `${i + 1}. ${x.name}${x.pct ? ` ${x.pct}` : ""}\n   ${x.link}`).join("\n");
  } catch (e) {
    return `${label}\n- 조회 실패. 직접 확인: ${url}`;
  }
}

function newsSearchUrl(q) {
  return `https://news.google.com/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`;
}

function firstNews(xml, query) {
  const item = xml.match(/<item>[\s\S]*?<\/item>/)?.[0];
  if (!item) return { title: `${query} 뉴스 검색`, link: newsSearchUrl(query) };
  const title = clean(item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/)?.[1] || item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || `${query} 뉴스 검색`);
  const link = clean(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || newsSearchUrl(query));
  return { title, link };
}

async function newsBlock(label, query) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
    const xml = await getText(url, "utf-8");
    const n = firstNews(xml, query);
    return `${label}\n${n.title}\n${n.link}`;
  } catch (e) {
    return `${label}\n${query} 뉴스 검색\n${newsSearchUrl(query)}`;
  }
}

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true })
  });
  if (!r.ok) throw new Error(await r.text());
}

async function buildBriefing() {
  const [kr, krq, kv, kqv, ai, bio, mat] = await Promise.all([
    stockBlock("📈 코스피 급등 5", SOURCES.kospiRise),
    stockBlock("📈 코스닥 급등 5", SOURCES.kosdaqRise),
    stockBlock("💰 코스피 거래상위 5", SOURCES.kospiVolume),
    stockBlock("💰 코스닥 거래상위 5", SOURCES.kosdaqVolume),
    newsBlock("🔬 AI", NEWS[0][1]),
    newsBlock("🧬 바이오", NEWS[1][1]),
    newsBlock("⚙️ 소재", NEWS[2][1])
  ]);

  const flights = "✈️ 항공권 특가 확인\n" + FLIGHTS.map(([name, link]) => `- ${name}: ${link}`).join("\n");
  const raw = `${kr}\n\n${krq}\n\n${kv}\n\n${kqv}\n\n${ai}\n\n${bio}\n\n${mat}\n\n${flights}`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    max_output_tokens: 1200,
    input: `아래 원자료를 텔레그램 아침 브리핑으로 정리해. 원자료의 종목명과 링크는 유지하고, ETF/ETN/레버리지/인버스/선물/스팩은 제외하려고 필터링했다는 점을 짧게 표시해. 투자 권유처럼 말하지 말고 참고용이라고 표시. 너무 길게 설명하지 말고 목록 중심으로 작성.\n\n${raw}`
  });
  return response.output_text;
}

export default async function handler(req, res) {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID || !process.env.OPENAI_API_KEY) throw new Error("Missing environment variables");
    const briefing = await buildBriefing();
    await sendTelegram(`🌅 아침 브리핑\n실행 시각: ${kst()}\n\n${briefing}\n\n투자·예약 전 공식 경로에서 반드시 재확인.`);
    res.status(200).json({ ok: true, sent: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
}
