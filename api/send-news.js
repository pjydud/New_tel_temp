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

const NEWS = [
  ["🔬 AI", "AI 반도체 생성형 AI 한국 증시"],
  ["🧬 바이오", "바이오 제약 임상 FDA 한국 증시"],
  ["⚙️ 소재", "소재 2차전지 반도체 소재 희토류 한국 증시"]
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
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 MorningBriefBot" } });
  if (!response.ok) throw new Error(`fetch failed ${response.status}`);
  const buffer = await response.arrayBuffer();
  return new TextDecoder(enc).decode(buffer);
}

function parseStocks(html, mode = "rise") {
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

    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => clean(m[1])).filter(Boolean);
    const pct = cells.find((x) => x.includes("%")) || "";

    seen.add(code);
    items.push({
      name,
      code,
      pct: mode === "rise" ? pct : "",
      link: `https://finance.naver.com/item/main.naver?code=${code}`
    });

    if (items.length >= 5) break;
  }
  return items;
}

async function stockBlock(label, url, mode) {
  try {
    const html = await getText(url, "euc-kr");
    const items = parseStocks(html, mode);
    if (!items.length) return `${label}\n- 종목 추출 실패: ${url}`;
    return `${label}\n` + items.map((x, i) => {
      const extra = x.pct ? ` ${x.pct}` : "";
      return `${i + 1}. ${x.name}${extra}\n   ${x.link}`;
    }).join("\n");
  } catch (error) {
    return `${label}\n- 조회 실패: ${url}`;
  }
}

function newsSearchUrl(query) {
  return `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
}

function parseFirstNews(xml, query) {
  const item = xml.match(/<item>[\s\S]*?<\/item>/)?.[0];
  if (!item) return { title: `${query} 뉴스 검색`, link: newsSearchUrl(query) };

  const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/);
  const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
  const title = clean((titleMatch && (titleMatch[1] || titleMatch[2])) || `${query} 뉴스 검색`);
  const link = clean((linkMatch && linkMatch[1]) || newsSearchUrl(query));
  return { title, link };
}

async function newsBlock(label, query) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
    const xml = await getText(url, "utf-8");
    const item = parseFirstNews(xml, query);
    return `${label}\n${item.title}\n기사보기: ${item.link}`;
  } catch (error) {
    return `${label}\n${query} 뉴스 검색\n기사보기: ${newsSearchUrl(query)}`;
  }
}

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true })
  });
  if (!response.ok) throw new Error(await response.text());
}

async function buildMessage() {
  const [kospiRise, kosdaqRise, kospiVolume, kosdaqVolume, ai, bio, material] = await Promise.all([
    stockBlock("📈 코스피 급등 TOP5", SOURCES.kospiRise, "rise"),
    stockBlock("📈 코스닥 급등 TOP5", SOURCES.kosdaqRise, "rise"),
    stockBlock("💰 코스피 거래상위 TOP5", SOURCES.kospiVolume, "volume"),
    stockBlock("💰 코스닥 거래상위 TOP5", SOURCES.kosdaqVolume, "volume"),
    newsBlock(NEWS[0][0], NEWS[0][1]),
    newsBlock(NEWS[1][0], NEWS[1][1]),
    newsBlock(NEWS[2][0], NEWS[2][1])
  ]);

  return `🌅 아침 브리핑\n실행 시각: ${kst()}\n\n` +
    `※ 네이버 금융 기준이며 장중 변동·지연 가능. ETF/ETN/레버리지/인버스/선물/스팩 등은 제외 시도. 투자 참고용.\n\n` +
    `${kospiRise}\n\n${kosdaqRise}\n\n${kospiVolume}\n\n${kosdaqVolume}\n\n` +
    `📰 관심 섹터 뉴스\n\n${ai}\n\n${bio}\n\n${material}\n\n` +
    `투자 전 공식 경로에서 반드시 재확인.`;
}

export default async function handler(req, res) {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      throw new Error("Missing Telegram environment variables");
    }
    const message = await buildMessage();
    await sendTelegram(message);
    res.status(200).json({ ok: true, sent: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
}
