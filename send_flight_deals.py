import os
import urllib.parse
from datetime import date, timedelta

import requests
from openai import OpenAI

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]

client = OpenAI(api_key=OPENAI_API_KEY)

ORIGIN = "ICN"
TODAY = date.today()
DATE_FROM = TODAY + timedelta(days=1)
DATE_TO = TODAY + timedelta(days=15)

DESTINATIONS = [
    {"name": "칭다오", "country": "중국", "code": "TAO", "baseline": 180000, "note": "짧은 일정·온천/먹거리 여행 후보"},
    {"name": "상하이", "country": "중국", "code": "PVG", "baseline": 220000, "note": "직항 많음, 주말여행 후보"},
    {"name": "후쿠오카", "country": "일본", "code": "FUK", "baseline": 170000, "note": "가까운 일본 특가 확인용"},
    {"name": "오사카", "country": "일본", "code": "KIX", "baseline": 220000, "note": "항공편 많아 특가 가능성 높음"},
    {"name": "도쿄", "country": "일본", "code": "NRT", "baseline": 250000, "note": "나리타 기준 특가 확인"},
    {"name": "타이베이", "country": "대만", "code": "TPE", "baseline": 260000, "note": "동남아 대체 단거리 후보"},
    {"name": "다낭", "country": "베트남", "code": "DAD", "baseline": 300000, "note": "가족여행·휴양 후보"},
    {"name": "나트랑", "country": "베트남", "code": "CXR", "baseline": 330000, "note": "휴양 특가 확인"},
    {"name": "방콕", "country": "태국", "code": "BKK", "baseline": 360000, "note": "항공편 많고 특가 자주 나옴"},
    {"name": "마닐라", "country": "필리핀", "code": "MNL", "baseline": 260000, "note": "저가항공 특가 확인"},
]


def google_flights_url(destination_code: str) -> str:
    query = f"Google Flights {ORIGIN} to {destination_code} {DATE_FROM.isoformat()} {DATE_TO.isoformat()}"
    return "https://www.google.com/search?q=" + urllib.parse.quote(query)


def skyscanner_url(destination_code: str) -> str:
    return f"https://www.skyscanner.co.kr/transport/flights/{ORIGIN.lower()}/{destination_code.lower()}/?adults=1&adultsv2=1&cabinclass=economy&rtn=0"


def kayak_url(destination_code: str) -> str:
    return f"https://www.kayak.co.kr/flights/{ORIGIN}-{destination_code}/{DATE_FROM.isoformat()}-flexible-3days?sort=price_a"


def make_candidate_text() -> str:
    lines = []
    for d in DESTINATIONS:
        lines.append(
            f"- {d['country']} {d['name']}({d['code']}): 특가 기준 {d['baseline']:,}원 이하. "
            f"메모: {d['note']}\n"
            f"  Google: {google_flights_url(d['code'])}\n"
            f"  Skyscanner: {skyscanner_url(d['code'])}\n"
            f"  Kayak: {kayak_url(d['code'])}"
        )
    return "\n".join(lines)


def build_message() -> str:
    candidates = make_candidate_text()
    prompt = f"""
너는 항공권 특가 알림 비서야.
아래 후보 목적지별 검색 링크를 바탕으로, 사용자가 오늘 바로 눌러 확인할 수 있는 텔레그램 알림 문구를 작성해.

조건:
- 인천(ICN) 출발
- 출발일: {DATE_FROM.isoformat()} ~ {DATE_TO.isoformat()} 사이
- 중국, 일본, 동남아 특가 우선
- 실제 가격은 링크에서 직접 확인해야 함을 분명히 표시
- 유류할증료/세금/수하물 포함 여부 확인 안내
- 항공사 공식 홈페이지와 최종 비교 안내
- 너무 길지 않게, 상위 추천 5개와 전체 확인 링크를 정리
- 한국어

후보 목록:
{candidates}
"""
    response = client.responses.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        input=prompt,
        max_output_tokens=900,
    )
    return response.output_text.strip()


def send_telegram(message: str) -> None:
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    response = requests.post(
        url,
        json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "disable_web_page_preview": True,
        },
        timeout=30,
    )
    response.raise_for_status()


if __name__ == "__main__":
    header = f"✈️ 항공권 특가 체크\n기간: {DATE_FROM.isoformat()} ~ {DATE_TO.isoformat()}\n"
    send_telegram(header + "\n" + build_message())
