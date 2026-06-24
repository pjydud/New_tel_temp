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

const HWASEONG_POLICY_QUERIES = [
  "화성시 민원 정책",
  "화성시 행정 정책 시민 불편",
  "화성시 교통 주차 민원",
  "화성시 개발 도시계획 민원",
  "화성시 예산 조례 정책"
];

const EXCLUDE_NEWS_WORDS = [
  "봉사", "자원봉사", "MOU", "업무협약", "협약식", "기부", "후원", "나눔", "캠페인", "행사 개최"
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

function getKstDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { year: Number(obj.year), month: Number(obj.month), day: Number(obj.day) };
}

function kstMidnightUtcMs(offsetDays = 0) {
  const { year, month, day } = getKstDateParts();
  return Date.UTC(year, month - 1, day + offsetDays, -9, 0, 0, 0);
}

function isYesterdayOrTodayKst(pubDate) {
  const published = Date.parse(pubDate || "");
  if (Number.isNaN(published)) return false;
  const yesterdayStart = kstMidnightUtcMs(-1);
  const tomorrowStart = kstMidnightUtcMs(1);
  return published >= yesterdayStart && published < tomorrowStart;
}

function formatKstDateTime(pubDate) {
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return "날짜 미확인";
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function shouldExcludeNews(title) {
  return EXCLUDE_NEWS_WORDS.some((word) => title.toUpperCase().includes(word.toUpperCase()));
}

function parseNewsItems(xml, query, limit = 1, options = {}) {
  const matches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  const items = [];

  for (const itemXml of matches) {
    const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const pubDate = clean((pubDateMatch && pubDateMatch[1]) || "");
    const title = clean((titleMatch && (titleMatch[1] || titleMatch[2])) || `${query} 뉴스 검색`);
    const link = clean((linkMatch && linkMatch[1]) || newsSearchUrl(query));

    if (!title) continue;
    if (options.recentOnly && !isYesterdayOrTodayKst(pubDate)) continue;
    if (options.excludeSoftNews && shouldExcludeNews(title)) continue;

    items.push({ title, link, pubDate });
    if (items.length >= limit) break;
  }
  return items;
}

async function personNewsBlock(label, query) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
    const xml = await getText(url, "utf-8");
    const items = parseNewsItems(xml, query, 1, { recentOnly: true });
    if (!items.length) return "";
    const item = items[0];
    return `📰 ${label}\n- ${item.title}\n  작성일: ${formatKstDateTime(item.pubDate)}\n  ${item.link}`;
  } catch (error) {
    return "";
  }
}

async function fetchHwaseongPolicyNews() {
  const collected = [];
  const seenLinks = new Set();

  for (const query of HWASEONG_POLICY_QUERIES) {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
      const xml = await getText(url, "utf-8");
      const items = parseNewsItems(xml, query, 5, { recentOnly: true, excludeSoftNews: true });
      for (const item of items) {
        if (seenLinks.has(item.link)) continue;
        seenLinks.add(item.link);
        collected.push(item);
      }
    } catch (error) {
      // 일부 검색어가 실패해도 나머지 검색 결과는 사용
    }
  }

  collected.sort((a, b) => Date.parse(b.pubDate || "") - Date.parse(a.pubDate || ""));
  return collected.slice(0, 3);
}

async function hwaseongNewsBlock() {
  const items = await fetchHwaseongPolicyNews();
  if (!items.length) return "";
  return "🏙️ 화성시 민원·정책 주요뉴스\n" + items.map((x, i) => {
    return `${i + 1}. ${x.title}\n   작성일: ${formatKstDateTime(x.pubDate)}\n   ${x.link}`;
  }).join("\n");
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
  const [kospiVolume, kosdaqVolume, peopleBlocksRaw, hwaseongNews] = await Promise.all([
    stockBlock("💰 코스피 거래상위 TOP5", SOURCES.kospiVolume),
    stockBlock("💰 코스닥 거래상위 TOP5", SOURCES.kosdaqVolume),
    Promise.all(PEOPLE_NEWS.map(([label, query]) => personNewsBlock(label, query))),
    hwaseongNewsBlock()
  ]);

  const peopleBlocks = peopleBlocksRaw.filter(Boolean);
  const peopleSection = peopleBlocks.length ? `🗞️ 인물별 최근 뉴스\n어제·오늘 작성 기사만 표시\n\n${peopleBlocks.join("\n\n")}\n\n` : "";
  const hwaseongSection = hwaseongNews ? `${hwaseongNews}\n\n` : "";

  return `🌅 아침 브리핑\n실행 시각: ${kst()}\n\n` +
    `※ 네이버 금융 기준이며 장중 변동·지연 가능. ETF/ETN/레버리지/인버스/선물/스팩 등은 제외 시도. 투자 참고용.\n\n` +
    `${kospiVolume}\n\n${kosdaqVolume}\n\n` +
    peopleSection +
    hwaseongSection +
    `뉴스는 구글 뉴스 RSS 기준이며, 같은 이름의 다른 인물이 포함될 수 있으니 기사 원문에서 확인하세요. 투자 전 공식 경로에서 반드시 재확인.`;
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
