import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from statistics import mean
from typing import Any

import requests
from pykrx import stock

TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]

KST = timezone(timedelta(hours=9))
SNAPSHOT_PATH = Path("data/volume_snapshots.json")
MARKETS = ("KOSPI", "KOSDAQ")
TOP_N = int(os.getenv("STOCK_TOP_N", "5"))
LOOKBACK_DAYS = int(os.getenv("STOCK_LOOKBACK_DAYS", "7"))
MIN_BASELINE_VOLUME = int(os.getenv("STOCK_MIN_BASELINE_VOLUME", "1000"))
RUN_TIME_LABEL = os.getenv("STOCK_RUN_TIME_LABEL", "09:10")


def today_kst() -> datetime:
    return datetime.now(KST)


def fetch_market_volumes(target_date: str) -> dict[str, dict[str, Any]]:
    """Fetch current accumulated volume for KOSPI/KOSDAQ tickers.

    When this script runs at 09:10 KST, pykrx returns the current day's
    accumulated volume available from KRX. We store that snapshot and compare it
    with the last 7 same-time snapshots gathered by this workflow.
    """
    items: dict[str, dict[str, Any]] = {}

    for market in MARKETS:
        df = stock.get_market_ohlcv_by_ticker(target_date, market=market)
        if df is None or df.empty:
            continue

        for ticker, row in df.iterrows():
            volume = int(row.get("거래량", 0) or 0)
            if volume <= 0:
                continue
            items[ticker] = {
                "ticker": ticker,
                "name": stock.get_market_ticker_name(ticker),
                "market": market,
                "volume": volume,
            }

    return items


def load_snapshots() -> list[dict[str, Any]]:
    if not SNAPSHOT_PATH.exists():
        return []
    try:
        data = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def save_snapshots(snapshots: list[dict[str, Any]]) -> None:
    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_PATH.write_text(
        json.dumps(snapshots[-30:], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def build_snapshot(now: datetime, items: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return {
        "date": now.strftime("%Y-%m-%d"),
        "time": RUN_TIME_LABEL,
        "created_at": now.isoformat(),
        "items": items,
    }


def replace_today_snapshot(
    snapshots: list[dict[str, Any]], today_snapshot: dict[str, Any]
) -> list[dict[str, Any]]:
    today = today_snapshot["date"]
    return [s for s in snapshots if s.get("date") != today] + [today_snapshot]


def select_volume_surge_stocks(
    current_items: dict[str, dict[str, Any]], snapshots: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    baseline_snapshots = snapshots[-LOOKBACK_DAYS:]
    selected: list[dict[str, Any]] = []

    for ticker, item in current_items.items():
        historical_volumes = []
        for snapshot in baseline_snapshots:
            past_item = snapshot.get("items", {}).get(ticker)
            if past_item and int(past_item.get("volume", 0)) > 0:
                historical_volumes.append(int(past_item["volume"]))

        if not historical_volumes:
            continue

        avg_volume = mean(historical_volumes)
        if avg_volume < MIN_BASELINE_VOLUME:
            continue

        current_volume = int(item["volume"])
        surge_ratio = current_volume / avg_volume
        selected.append(
            {
                **item,
                "avg_volume": round(avg_volume),
                "surge_ratio": surge_ratio,
                "baseline_days": len(historical_volumes),
            }
        )

    return sorted(
        selected,
        key=lambda x: (x["surge_ratio"], x["volume"]),
        reverse=True,
    )[:TOP_N]


def format_ratio(value: float) -> str:
    return f"{value:.1f}배"


def build_message() -> str:
    now = today_kst()
    target_date = now.strftime("%Y%m%d")

    snapshots = load_snapshots()
    current_items = fetch_market_volumes(target_date)
    ranking = select_volume_surge_stocks(current_items, snapshots)

    today_snapshot = build_snapshot(now, current_items)
    save_snapshots(replace_today_snapshot(snapshots, today_snapshot))

    if not current_items:
        return (
            "📈 09:10 거래량 급등 종목\n\n"
            "오늘 KRX 거래량 데이터를 가져오지 못했습니다.\n"
            "장 개시일/공휴일 여부와 pykrx 데이터 응답 상태를 확인해 주세요."
        )

    if not ranking:
        return (
            "📈 09:10 거래량 급등 종목\n\n"
            f"오늘 {len(current_items):,}개 종목의 09:10 누적거래량 스냅샷을 저장했습니다.\n"
            f"최근 {LOOKBACK_DAYS}회 같은 시간대 비교 데이터가 아직 부족하면 순위가 표시되지 않을 수 있습니다.\n"
            "며칠간 자동 실행되면 최근 7일 기준 급등 종목 5개가 표시됩니다."
        )

    lines = [
        "📈 09:10 거래량 급등 종목 TOP 5",
        f"기준: 코스피·코스닥 / 최근 {LOOKBACK_DAYS}회 같은 시간대 평균 대비",
        "",
    ]

    for idx, item in enumerate(ranking, start=1):
        lines.append(
            f"{idx}. {item['name']}({item['ticker']}, {item['market']})\n"
            f"   현재 거래량 {item['volume']:,}주 / "
            f"최근평균 {item['avg_volume']:,}주 / "
            f"급등률 {format_ratio(item['surge_ratio'])} "
            f"({item['baseline_days']}일 비교)"
        )

    lines.extend(
        [
            "",
            "※ 09:10 시점 누적거래량 기준 자동 산출입니다.",
            "※ 투자 권유가 아니라 참고 정보이며, 매매 전 증권사 앱에서 가격·호가·공시를 확인하세요.",
        ]
    )
    return "\n".join(lines)


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
    send_telegram(build_message())
