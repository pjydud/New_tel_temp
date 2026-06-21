import os
from datetime import date

import requests
from openai import OpenAI

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]

client = OpenAI(api_key=OPENAI_API_KEY)

WATCHLIST = os.getenv("STOCK_WATCHLIST", "KOSPI,KOSDAQ,삼성전자,SK하이닉스,NVIDIA,AMD,TSLA,BTC")


def build_message() -> str:
    prompt = f"""
너는 매일 아침 텔레그램으로 보내는 주식/시장 요약 비서야.
오늘 날짜는 {date.today().isoformat()}야.

관심 목록: {WATCHLIST}

다음 형식으로 한국어 요약을 작성해:
1. 오늘 체크할 시장 포인트 5개
2. 관심 종목/자산별 확인 포인트
3. 위험 요인
4. 오늘 장중에 보면 좋은 지표

주의:
- 실시간 가격을 직접 조회한 것처럼 말하지 말 것
- 실제 매매 전 증권사 앱/공식 시세 확인 필요 안내
- 투자 권유가 아니라 참고 정보라고 표시
- 너무 길지 않게 작성
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
    send_telegram("📈 주식/시장 체크\n\n" + build_message())
