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
# 사용법 (2026-09-03 API 정책 변경 반영 — CSV 전체파일이 생겨 이쪽이 기본):
#   방법 A · CSV (권장, 초기 적재):
#     식품안전나라 회원가입 → 인증키 신청 → 공공데이터활용 > 인증키관리 > OpenAPI 신청 목록에서
#     I0030 · I2710 의 "전체 데이터 CSV" 다운로드(매일 0시 갱신) 후:
#       python tools/hff/fetch_hff.py --csv I0030 <받은파일.csv>
#       python tools/hff/fetch_hff.py --csv I2710 <받은파일.csv>
#   방법 B · API (증분 갱신용):
#       python tools/hff/fetch_hff.py <인증키>            # 전량 (47회 호출 — 시간당 100회 제한 내)
#       python tools/hff/fetch_hff.py <인증키> 20260901   # CHNG_DT 증분 (호출일 기준 7일 이내만)
#   → tools/hff/out/I0030.jsonl, I2710.jsonl 생성 (한 줄 = 행 하나)
#
# 주의: /api/sample/ 경로는 5행 + 1일 100회 제한. 전량은 인증키 또는 CSV 필수.
# 키는 커밋하지 말 것 — 인자로만 받는다.

import json
import sys
import time
import urllib.request

BASE = "http://openapi.foodsafetykorea.go.kr/api"
PAGE = 1000  # 문서상 한 번에 최대 1,000행

def fetch(key: str, service: str, start: int, end: int, suffix: str = "") -> dict:
    url = f"{BASE}/{key}/{service}/json/{start}/{end}{suffix}"
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))

def download(key: str, service: str, out_path: str, suffix: str = "") -> int:
    total = None
    n = 0
    with open(out_path, "w", encoding="utf-8") as f:
        start = 1
        while True:
            d = fetch(key, service, start, start + PAGE - 1, suffix)
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

def csv_to_jsonl(service: str, csv_path: str, out_path: str) -> int:
    """인증키관리 페이지에서 받은 전체 데이터 CSV → jsonl. 헤더명은 API 필드명과 같다고 가정하되
    다르면 그대로 보존한다(적재 단계에서 매핑). BOM·구분자는 관대하게 처리."""
    import csv as _csv
    n = 0
    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        sample = f.read(4096); f.seek(0)
        delim = "	" if sample.count("	") > sample.count(",") else ","
        reader = _csv.DictReader(f, delimiter=delim)
        with open(out_path, "w", encoding="utf-8") as o:
            for row in reader:
                o.write(json.dumps(row, ensure_ascii=False) + "\n")
                n += 1
    print(f"{service}: CSV {n}건 → {out_path}")
    return n

def main() -> None:
    import os
    out = os.path.join(os.path.dirname(__file__), "out")
    os.makedirs(out, exist_ok=True)
    if len(sys.argv) >= 2 and sys.argv[1] == "--csv":
        if len(sys.argv) != 4 or sys.argv[2] not in ("I0030", "I2710"):
            raise SystemExit("사용법: python tools/hff/fetch_hff.py --csv <I0030|I2710> <파일.csv>")
        csv_to_jsonl(sys.argv[2], sys.argv[3], os.path.join(out, f"{sys.argv[2]}.jsonl"))
        return
    if len(sys.argv) not in (2, 3):
        raise SystemExit("사용법: python tools/hff/fetch_hff.py <인증키> [CHNG_DT(YYYYMMDD, 7일 이내)]")
    key = sys.argv[1].strip()
    chng = f"/CHNG_DT={sys.argv[2]}" if len(sys.argv) == 3 else ""
    def dl(service):
        return download(key, service, os.path.join(out, f"{service}.jsonl"), chng)
    a = dl("I0030"); b = dl("I2710")
    print(f"완료: I0030 {a}건, I2710 {b}건 → {out}/")

if __name__ == "__main__":
    main()
