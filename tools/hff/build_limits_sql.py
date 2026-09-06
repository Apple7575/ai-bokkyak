# I2710(원료별 일일섭취량 상·하한) → interaction.substance_limit 적재 SQL 생성
#
# limit_type 은 이상언 스키마의 CHECK 값 중 식약처 고시 상·하한에 해당하는
# krfda_max / krfda_min 을 쓴다. 이미 있는 행(검수 반영 5건 등)과 겹치지 않게
# not exists 가드를 건다. 원료명 → 성분 매핑은 build_rawmtrl_map 의 규칙을 재사용.

import json, os, sys, csv

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_rawmtrl_map import map_token, SUBS  # noqa: E402

def esc(s: str) -> str:
    return (s or '').replace("'", "''")

def main():
    rows = [json.loads(l) for l in open(os.path.join(HERE, 'out', 'I2710.jsonl'), encoding='utf-8')]
    os.makedirs(os.path.join(HERE, 'sql'), exist_ok=True)
    out = os.path.join(HERE, 'sql', 'load-limits.sql')
    n_ok = n_skip = 0
    lines = [
        '-- I2710 원료별 일일섭취량 상·하한 → interaction.substance_limit (build_limits_sql.py 생성)',
        '-- 출처: 식약처 식품안전나라 I2710 (건강기능식품 원료별 정보). limit_type = krfda_max / krfda_min.',
        '-- 이미 같은 (성분, 종류) 행이 있으면 건너뛴다 — 검수로 넣은 값(아연 35 등)을 덮지 않기 위해.',
        'begin;',
    ]
    report = []
    for r in rows:
        name = (r.get('PRDCT_NM') or '').strip()
        canon, conf = map_token(name)
        if not canon or canon == 'IGNORE':
            n_skip += 1
            report.append((name, '', '', 'unmapped'))
            continue
        sid, code = SUBS[canon]
        unit = esc((r.get('INTK_UNIT') or '').strip())
        for field, ltype in (('DAY_INTK_HIGHLIMIT', 'krfda_max'), ('DAY_INTK_LOWLIMIT', 'krfda_min')):
            val = (r.get(field) or '').strip()
            try:
                amt = float(val)
            except ValueError:
                continue
            lines.append(
                f"insert into interaction.substance_limit (substance_id, limit_type, amount, unit)\n"
                f"select {sid}, '{ltype}', {amt}, '{unit}'\n"
                f"where not exists (select 1 from interaction.substance_limit\n"
                f"  where substance_id = {sid} and limit_type = '{ltype}');"
                f"  -- {esc(name)} → {esc(canon)}"
            )
            n_ok += 1
        report.append((name, canon, code, conf))
    lines.append('commit;')
    open(out, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

    with open(os.path.join(HERE, 'limits_map_report.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['원료명(I2710)', '매핑 성분', 'code', 'confidence'])
        for row in report:
            w.writerow(row)
    print(f'limit INSERT {n_ok}건 / 미매핑 원료 {n_skip}종 → {out}')

if __name__ == '__main__':
    main()
