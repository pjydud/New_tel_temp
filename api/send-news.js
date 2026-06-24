const SOURCES = {
  kospiVolume: "https://finance.naver.com/sise/sise_quant.naver?sosok=0",
  kosdaqVolume: "https://finance.naver.com/sise/sise_quant.naver?sosok=1"
};

const BLOCK_WORDS = [
  "KODEX", "TIGER", "ACE", "KBSTAR", "KOSEF", "HANARO", "ARIRANG", "SOL", "RISE", "TIMEFOLIO",
  "ETF", "ETN", "레버리지", "인버스", "선물", "스팩", "SPAC", "리츠", "채권", "국채", "나스닥", "S&P"
];

const PEOPLE_NEWS = [
  ["권칠승 국회의원", "권칠승 국회의원"],
  ["경기도의원 이진형", "경기도의원 이진형"],
  ["경기도의원 김회철", "경기도의원 김회철"],
  ["화성시의원 위영란", "화성시의원 위영란"],
  ["화성시의원 배현경", "화성시의원 배현경"],
  ["화성시의원 최태양", "화성시의원 최태양"],
  ["화성시의원 유상희", "화성시의원 유상희"],
  ["화성시의원 장철규", "화성시의원 장철규"],
  ["화성시의원 김창겸", "화성시의원 김창겸"]
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
    return `${label}\n` + items.map((x, i) => `${i + 1}. ${x.name} (${x.code})`).join("\n");
  } catch (error) {
    return `${label}\n- 조회 실패`;
  }
}

function newsSearchUrl(query) {
  return `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
}

function parseNewsItems(xml, query, limit = 1) {
  const matches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return matches.slice(0, limit).map((itemXml) => {
    const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
    return {
      title: clean((titleMatch && (titleMatch[1] || titleMatch[2])) || `${query} 뉴스 검색`),
      link: clean((linkMatch && linkMatch[1]) || newsSearchUrl(query))
    };
  });
}

async function newsBlock(label, query) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
    const xml = await getText(url, "utf-8");
    const items = parseNewsItems(xml, query, 1);
    if (!items.length) return `${label}\n- 검색 결과 없음`;
    return `${label}\n- ${items[0].title}`;
  } catch (error) {
    return `${label}\n- 조회 실패`;
  }
}

async function hwaseongNewsBlock() {
  const query = "화성시 주요뉴스";
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
    const xml = await getText(url, "utf-8");
    const items = parseNewsItems(xml, query, 3);
    if (!items.length) return "🏙️ 화성시 주요뉴스 3개\n- 검색 결과 없음";
    return "🏙️ 화성시 주요뉴스 3개\n" + items.map((x, i) => `${i + 1}. ${x.title}`).join("\n");
  } catch (error) {
    return "🏙️ 화성시 주요뉴스 3개\n- 조회 실패";
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
  const [kospiVolume, kosdaqVolume, peopleBlocks, hwaseongNews] = await Promise.all([
    stockBlock("💰 코스피 거래상위 TOP5", SOURCES.kospiVolume),
    stockBlock("💰 코스닥 거래상위 TOP5", SOURCES.kosdaqVolume),
    Promise.all(PEOPLE_NEWS.map(([label, query]) => newsBlock(`📰 ${label}`, query))),
    hwaseongNewsBlock()
  ]);

  return `🌅 아침 브리핑\n실행 시각: ${kst()}\n\n` +
    `※ 네이버 금융 기준이며 장중 변동·지연 가능. ETF/ETN/레버리지/인버스/선물/스팩 등은 제외 시도. 투자 참고용.\n\n` +
    `${kospiVolume}\n\n${kosdaqVolume}\n\n` +
    `🗞️ 인물별 뉴스 검색\n\n${peopleBlocks.join("\n\n")}\n\n` +
    `${hwaseongNews}\n\n` +
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
