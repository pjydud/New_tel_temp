const SOURCES = {
  kospiVolume: "https://finance.naver.com/sise/sise_quant.naver?sosok=0",
  kosdaqVolume: "https://finance.naver.com/sise/sise_quant.naver?sosok=1"
};

const BLOCK_WORDS = ["KODEX", "TIGER", "ACE", "KBSTAR", "KOSEF", "HANARO", "ARIRANG", "SOL", "RISE", "TIMEFOLIO", "ETF", "ETN", "레버리지", "인버스", "선물", "스팩", "SPAC", "리츠", "채권", "국채", "나스닥", "S&P"];
const PEOPLE_NEWS = [
  { label: "권칠승 국회의원", name: "권칠승", queries: ["권칠승", "권칠승 국회의원", "권칠승 의원"] },
  { label: "경기도의원 이진형", name: "이진형", queries: ["이진형 경기도의원", "이진형 의원"] },
  { label: "경기도의원 김회철", name: "김회철", queries: ["김회철 경기도의원", "김회철 의원"] },
  { label: "화성시의원 위영란", name: "위영란", queries: ["위영란 화성시의원", "위영란 의원"] },
  { label: "화성시의원 배현경", name: "배현경", queries: ["배현경 화성시의원", "배현경 의원"] },
  { label: "화성시의원 최태양", name: "최태양", queries: ["최태양 화성시의원", "최태양 의원"] },
  { label: "화성시의원 유상희", name: "유상희", queries: ["유상희 화성시의원", "유상희 의원"] },
  { label: "화성시의원 장철규", name: "장철규", queries: ["장철규 화성시의원", "장철규 의원"] },
  { label: "화성시의원 김창겸", name: "김창겸", queries: ["김창겸 화성시의원", "김창겸 의원"] }
];
const HWASEONG_POLICY_QUERIES = ["화성시 정책 민원", "화성시의회 조례 예산", "화성시청 교통 주차 민원", "화성시 도시계획 개발 민원", "화성시 GTX 철도 교통", "화성시 반도체 산업단지 정책", "정명근 화성시 정책"];
const HWASEONG_MUST_WORDS = ["화성시", "화성시청", "화성시의회", "정명근", "동탄", "봉담", "향남", "병점", "남양"];
const HWASEONG_POLICY_WORDS = ["민원", "정책", "예산", "조례", "도시계획", "교통", "주차", "개발", "철도", "GTX", "산업단지", "반도체", "행정", "도로", "주민", "시민", "의회", "시청"];
const EXCLUDE_NEWS_WORDS = ["봉사", "자원봉사", "MOU", "업무협약", "협약식", "기부", "후원", "나눔", "캠페인", "행사 개최", "축제", "장학금", "전달식", "기념식"];
const DEMOCRATIC_TREND_GROUPS = [
  { label: "더불어민주당 주요 동향", icon: "🔵", queries: ["더불어민주당 주요 소식", "더불어민주당 최고위원회의", "더불어민주당 정책 민생", "더불어민주당 지방선거", "더불어민주당 전당대회"], type: "party" },
  { label: "정청래 최근 행보", icon: "👤", queries: ["정청래 더불어민주당", "정청래 당대표", "정청래 최고위원", "정청래 행보", "정청래 전당대회"], type: "jung" },
  { label: "김민석 최근 행보", icon: "👤", queries: ["김민석 더불어민주당", "김민석 당대표", "김민석 최고위원", "김민석 행보", "김민석 전당대회"], type: "kim" }
];
const TREND_RULES = [
  { keys: ["전당대회", "당대표", "출마", "경선", "선거", "당권"], party: "전당대회와 당대표 선출 관련 보도가 이어지고 있습니다.", jung: "당대표 선거·전당대회 관련 행보가 확인됩니다.", kim: "당대표 선거·전당대회 관련 공개 행보가 확인됩니다." },
  { keys: ["당원", "권리당원", "당원주권", "온라인", "SNS", "소통"], party: "당원 참여와 온라인 소통 관련 이슈가 함께 부각되고 있습니다.", jung: "당원 중심 운영과 직접 소통 메시지가 부각되고 있습니다.", kim: "당원·조직 기반 소통 행보가 일부 확인됩니다." },
  { keys: ["민생", "경제", "물가", "소상공인", "추경", "복지", "정책"], party: "민생·경제 정책 메시지와 현안 대응 보도가 이어지고 있습니다.", jung: "정책 현안에 대한 발언과 당내 메시지가 함께 보도되고 있습니다.", kim: "경제·민생 정책 중심의 메시지가 상대적으로 부각되고 있습니다." },
  { keys: ["지역", "간담회", "방문", "순회", "광주", "호남", "대구", "부산", "충청"], party: "지역 일정과 현장 방문성 보도가 확인됩니다.", jung: "지역 방문·간담회 등 현장 행보가 확인됩니다.", kim: "지역 조직 접촉과 현장 행보 관련 보도가 확인됩니다." },
  { keys: ["통합", "혁신", "쇄신", "조직", "지도부", "최고위원", "리더십"], party: "당 지도부 운영·조직 정비·쇄신 관련 논의가 나타나고 있습니다.", jung: "강한 리더십과 당 운영 방향 관련 메시지가 부각됩니다.", kim: "통합·안정·조직 운영 관련 메시지가 부각됩니다." },
  { keys: ["검찰", "특검", "윤석열", "정부", "국민의힘", "개혁"], party: "대여 공세와 개혁 이슈 관련 보도가 이어지고 있습니다.", jung: "정부·여당 비판과 개혁성 메시지가 확인됩니다.", kim: "정부 대응 및 개혁 관련 입장 보도가 일부 확인됩니다." }
];

function kst() { return new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }); }
function clean(s) { return String(s || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim(); }
function escapeHtml(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function articleLink(title, url) { return `<a href="${escapeHtml(url)}">${escapeHtml(title)}</a>`; }
function isCompany(name) { if (!name || name.length < 2) return false; const upper = name.toUpperCase(); return !BLOCK_WORDS.some((w) => upper.includes(w.toUpperCase()) || name.includes(w)); }
async function getText(url, enc = "utf-8") { const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 MorningBriefBot" } }); if (!response.ok) throw new Error(`fetch failed ${response.status}`); const buffer = await response.arrayBuffer(); return new TextDecoder(enc).decode(buffer); }

function parseStocks(html) { const rows = html.split("<tr"); const items = []; const seen = new Set(); for (const row of rows) { const codeMatch = row.match(/code=(\d{6})/); const nameMatch = row.match(/class="tltle"[^>]*>([\s\S]*?)<\/a>/); if (!codeMatch || !nameMatch) continue; const code = codeMatch[1]; const name = clean(nameMatch[1]); if (!isCompany(name) || seen.has(code)) continue; seen.add(code); items.push({ name, code }); if (items.length >= 5) break; } return items; }
async function stockBlock(label, url) { try { const html = await getText(url, "euc-kr"); const items = parseStocks(html); if (!items.length) return `${label}\n- 종목 추출 실패`; return `${label}\n` + items.map((x, i) => `${i + 1}. ${escapeHtml(x.name)} (${x.code})`).join("\n"); } catch (error) { return `${label}\n- 조회 실패`; } }
function getKstDateParts(date = new Date()) { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date); const obj = Object.fromEntries(parts.map((p) => [p.type, p.value])); return { year: Number(obj.year), month: Number(obj.month), day: Number(obj.day) }; }
function kstMidnightUtcMs(offsetDays = 0) { const { year, month, day } = getKstDateParts(); return Date.UTC(year, month - 1, day + offsetDays, -9, 0, 0, 0); }
function isWithinKstDays(pubDate, daysBack = 7) { const published = Date.parse(pubDate || ""); if (Number.isNaN(published)) return false; const start = kstMidnightUtcMs(-(daysBack - 1)); const tomorrowStart = kstMidnightUtcMs(1); return published >= start && published < tomorrowStart; }
function formatKstDateTime(pubDate) { const d = new Date(pubDate); if (Number.isNaN(d.getTime())) return "날짜 미확인"; return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }); }
function includesAny(text, words) { const upper = text.toUpperCase(); return words.some((word) => upper.includes(word.toUpperCase())); }
function shouldExcludeNews(title) { return includesAny(title, EXCLUDE_NEWS_WORDS); }
function isHwaseongPolicyNews(title) { if (shouldExcludeNews(title)) return false; return includesAny(title, HWASEONG_MUST_WORDS) && includesAny(title, HWASEONG_POLICY_WORDS); }
function parseNewsItems(xml, query, limit = 1, options = {}) { const matches = xml.match(/<item>[\s\S]*?<\/item>/g) || []; const items = []; for (const itemXml of matches) { const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/); const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/); const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/); const pubDate = clean((pubDateMatch && pubDateMatch[1]) || ""); const title = clean((titleMatch && (titleMatch[1] || titleMatch[2])) || `${query} 뉴스 검색`); const link = clean((linkMatch && linkMatch[1]) || `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`); if (!title) continue; if (options.daysBack && !isWithinKstDays(pubDate, options.daysBack)) continue; if (options.excludeSoftNews && shouldExcludeNews(title)) continue; if (options.hwaseongPolicyOnly && !isHwaseongPolicyNews(title)) continue; if (options.requiredName && !title.includes(options.requiredName)) continue; items.push({ title, link, pubDate }); if (items.length >= limit) break; } return items; }
async function collectNewsByQueries(queries, limit = 5, options = {}) { const collected = []; const seen = new Set(); for (const query of queries) { try { const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`; const xml = await getText(url, "utf-8"); const items = parseNewsItems(xml, query, limit, options); for (const item of items) { const key = item.title.replace(/\s+/g, "").slice(0, 55); if (seen.has(key)) continue; seen.add(key); collected.push(item); } } catch (error) {} } return collected.sort((a, b) => Date.parse(b.pubDate || "") - Date.parse(a.pubDate || "")).slice(0, limit); }
function titleBasedSummary(items, type) { if (!items.length) return ["최근 7일 기준 뚜렷한 관련 보도가 확인되지 않았습니다."]; const text = items.map((x) => x.title).join(" "); const bullets = []; for (const rule of TREND_RULES) { if (rule.keys.some((key) => text.includes(key))) bullets.push(rule[type] || rule.party); if (bullets.length >= 3) break; } if (!bullets.length) { bullets.push("최근 기사 제목 기준으로 관련 보도 흐름이 확인됩니다."); bullets.push("구체적인 쟁점은 제목만으로는 제한적이지만, 정치 일정과 당내 현안 보도가 이어지고 있습니다."); } if (items[0]?.title) bullets.push(`주요 제목: ${items[0].title}`); return bullets.slice(0, 3); }
async function democraticTrendBlock() { const blocks = await Promise.all(DEMOCRATIC_TREND_GROUPS.map(async (group) => { const items = await collectNewsByQueries(group.queries, 8, { daysBack: 7, excludeSoftNews: true }); const bullets = titleBasedSummary(items, group.type); return `${group.icon} ${group.label}\n` + bullets.map((x) => `• ${escapeHtml(x)}`).join("\n"); })); return `🧭 민주당·당대표 관련 동향\n※ OpenAI API를 쓰지 않고 구글뉴스 RSS 기사 제목만 기준으로 정리\n\n${blocks.join("\n\n")}`; }
async function personNewsBlock(person) { try { const collected = await collectNewsByQueries(person.queries, 6, { daysBack: 7, requiredName: person.name }); if (!collected.length) return ""; const item = collected[0]; return `📰 ${escapeHtml(person.label)}\n- ${articleLink(item.title, item.link)}\n  작성일: ${formatKstDateTime(item.pubDate)}`; } catch (error) { return ""; } }
async function fetchHwaseongPolicyNews() { return collectNewsByQueries(HWASEONG_POLICY_QUERIES, 3, { daysBack: 7, excludeSoftNews: true, hwaseongPolicyOnly: true }); }
async function hwaseongNewsBlock() { const items = await fetchHwaseongPolicyNews(); if (!items.length) return ""; return "🏙️ 화성시 민원·정책 주요뉴스\n최근 7일 / 화성시·화성시의회·시정 관련 기사만 표시\n" + items.map((x, i) => `${i + 1}. ${articleLink(x.title, x.link)}\n   작성일: ${formatKstDateTime(x.pubDate)}`).join("\n"); }
function envName(a, b, c = "") { return a + b + c; }
function getTelegramChatIds() { const keySingle = envName("TEL", "EGRAM_", "CHAT_ID"); const keyMulti = envName("TEL", "EGRAM_", "CHAT_IDS"); const defaults = [process.env[keySingle], "-5595644220"]; const raw = process.env[keyMulti] || defaults.filter(Boolean).join(","); return [...new Set(raw.split(",").map((x) => x.trim()).filter(Boolean))]; }
async function sendTelegramToChat(text, chatId) { const key1 = envName("TEL", "EGRAM_", "BOT_TOKEN"); const url = ["https://api.", "telegram.org/", "bot", process.env[key1], "/sendMessage"].join(""); const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }) }); if (!response.ok) throw new Error(`chat ${chatId}: ${await response.text()}`); }
async function sendTelegram(text) { const chatIds = getTelegramChatIds(); if (!chatIds.length) throw new Error("Missing Telegram chat id"); await Promise.all(chatIds.map((chatId) => sendTelegramToChat(text, chatId))); return chatIds; }
async function buildMessage() { const [kospiVolume, kosdaqVolume, peopleBlocksRaw, hwaseongNews, democraticTrends] = await Promise.all([stockBlock("💰 코스피 거래상위 TOP5", SOURCES.kospiVolume), stockBlock("💰 코스닥 거래상위 TOP5", SOURCES.kosdaqVolume), Promise.all(PEOPLE_NEWS.map((person) => personNewsBlock(person))), hwaseongNewsBlock(), democraticTrendBlock()]); const peopleBlocks = peopleBlocksRaw.filter(Boolean); const peopleSection = peopleBlocks.length ? `🗞️ 인물별 최근 뉴스\n최근 7일 작성 기사 중 제목에 해당 인물 이름이 포함된 기사만 표시\n\n${peopleBlocks.join("\n\n")}\n\n` : ""; const hwaseongSection = hwaseongNews ? `${hwaseongNews}\n\n` : ""; const democraticSection = democraticTrends ? `${democraticTrends}\n\n` : ""; return `🌅 아침 브리핑\n실행 시각: ${kst()}\n\n` + `※ 네이버 금융 기준이며 장중 변동·지연 가능. ETF/ETN/레버리지/인버스/선물/스팩 등은 제외 시도. 투자 참고용.\n\n` + `${kospiVolume}\n\n${kosdaqVolume}\n\n` + peopleSection + hwaseongSection + democraticSection + `뉴스는 구글 뉴스 RSS 기준이며, 같은 이름의 다른 인물이 포함될 수 있으니 기사 원문에서 확인하세요. 투자 전 공식 경로에서 반드시 재확인.`; }
export default async function handler(req, res) { try { const key1 = envName("TEL", "EGRAM_", "BOT_TOKEN"); if (!process.env[key1]) throw new Error("Missing Telegram bot token"); const message = await buildMessage(); const sentChatIds = await sendTelegram(message); res.status(200).json({ ok: true, sent: true, chat_ids: sentChatIds }); } catch (error) { console.error(error); res.status(500).json({ ok: false, error: error.message }); } }
