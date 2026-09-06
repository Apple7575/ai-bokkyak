# 식약처 건강기능식품 데이터 내려받기 (식품안전나라 오픈API)
#
# 대상 (2026-09-03 회의 이슈1·7 결정):
#   I0030  건강기능식품 품목제조신고  — 제품 단위. 총 45,996건 (2026-09-06 확인)
#           핵심 필드: PRDLST_REPORT_NO(신고번호) PRDLST_NM(제품명) BSSH_NM(업소)
#                      INDIV_RAWMTRL_NM(기능성 원료) ETC_RAWMTRL_NM(부원료)
#                      CAP_RAWMTRL_NM(캡슐 원료) IFTKN_ATNT_MATR_CN(섭취 시 주의사항)
#                      PRIMARY_FNCLTY(주된 기능성) NTK_MTHD(섭취 방법)
#   I2710  원료별 정보 — 원료 단위. 총 545건
#           핵심 필드: PRDCT_NM(원료명) DAY_INTK_LOWLIMIT/HIGHLIMIT(일일섭취량 하한/상한)
#                      INTK_UNIT(단위) IFTKN_ATNT_MATR_CN(주의사항) PRIMARY_FNCLTY
#
# 사용법:
#   1) https://www.foodsafetykorea.go.kr/apiMain.do 회원가입 → 마이페이지 → 인증키 발급 (무료)
#   2) python tools/hff/fetch_hff.py <인증키>
#   → tools/hff/out/I0030.jsonl, I2710.jsonl 생성 (한 줄 = 행 하나)
#
# 주의: 인증키 없이 쓰는 /api/sample/ 경로는 5행까지만 돌려준다(확인함). 전량은 키 필수.
# 키는 커밋하지 말 것 — 인자로만 받는다.

import json
import sys
import time
import urllib.request

BASE = "http://openapi.foodsafetykorea.go.kr/api"
PAGE = 1000  # 문서상 한 번에 최대 1,000행

def fetch(key: str, service: str, start: int, end: int) -> dict:
    url = f"{BASE}/{key}/{service}/json/{start}/{end}"
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))

def download(key: str, service: str, out_path: str) -> int:
    total = None
    n = 0
    with open(out_path, "w", encoding="utf-8") as f:
        start = 1
        while True:
            d = fetch(key, service, start, start + PAGE - 1)
            body = d.get(service)
            if not body or "row" not in body:
                # 인증키 오류 등 — 서버가 {"RESULT": {...}} 형태로 답한다
                raise SystemExit(f"{service} {start}~: 응답에 row가 없습니다: {json.dumps(d, ensure_ascii=False)[:300]}")
            if total is None:
                total = int(body["total_count"])
                print(f"{service}: 총 {total}건")
            for row in body["row"]:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
                n += 1
            print(f"  {service} {n}/{total}")
            if n >= total:
                break
            start += PAGE
            time.sleep(0.3)  # 서버 예의
    return n

def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("사용법: python tools/hff/fetch_hff.py <식품안전나라 인증키>")
    key = sys.argv[1].strip()
    import os
    out = os.path.join(os.path.dirname(__file__), "out")
    os.makedirs(out, exist_ok=True)
    a = download(key, "I0030", os.path.join(out, "I0030.jsonl"))
    b = download(key, "I2710", os.path.join(out, "I2710.jsonl"))
    print(f"완료: I0030 {a}건, I2710 {b}건 → {out}/")

if __name__ == "__main__":
    main()
