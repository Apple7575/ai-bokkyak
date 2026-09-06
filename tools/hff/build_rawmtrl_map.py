# 건기식 원료명(자유 텍스트) → interaction.substance 매핑 초안 생성기
#
# 입력:  tools/hff/out/I0030.jsonl (fetch_hff.py 산출), tools/hff/substance.csv (Supabase 성분 사전)
# 출력:  tools/hff/rawmtrl_map_draft.csv       — 검수용 (원문·빈도·매핑·확신도)
#        tools/hff/sql/load-ingredient-map.sql — interaction.ingredient_substance_map INSERT
#
# 확신도 규약 (테이블 CHECK 와 동일): exact / likely / uncertain
#   exact  = 이름 정규화 후 성분명·별칭과 완전 일치
#   likely = 부분 일치 또는 유산균 균주명 규칙
#   uncertain(=미삽입) = 자동으로 못 정함 — 뷰에서 "확인하지 못한 원료"로 노출되는 대상
# mapped_by='rule'. 약사 검수 후 바뀌는 행은 mapped_by='pharmacist' 로 갱신하면 된다.

import json, re, collections, csv, os

HERE = os.path.dirname(os.path.abspath(__file__))

# ── 성분 사전 ────────────────────────────────────────────────────────────────
SUBS = {}   # name_ko -> (id, code)
for row in csv.DictReader(open(os.path.join(HERE, 'substance.csv'), encoding='utf-8-sig')):
    SUBS[row['name_ko']] = (int(row['id']), row['code'])

def norm(t: str) -> str:
    t = re.sub(r'\((고시형|개별인정형|고시|합성|천연)\)', '', t)
    t = re.sub(r'\s+', '', t)
    return t.strip()

# 별칭 → 성분 name_ko (사전에 실제로 있는 이름만 canon 으로 쓴다)
ALIAS = {
    '홍삼': ['홍삼농축액', '홍삼분말', '홍삼추출물', '홍삼농축분말'],
    '인삼': ['인삼농축액', '인삼추출물', '홍삼단'],
    '비타민 C': ['비타민C', 'L-아스코르빈산', '아스코르빈산', '아스코브산'],
    '비타민 D': ['비타민D3혼합제제', '비타민D3', '비타민D', '콜레칼시페롤', '비타민D혼합제제'],
    '비타민 E': ['비타민E혼합제제', 'd-알파-토코페롤', '토코페롤', '초산토코페롤', '비타민E'],
    '비타민 A': ['비타민A혼합제제', '레티닐팔미테이트', '비타민A'],
    '베타카로틴': ['베타카로틴', '베타카로틴혼합제제'],
    '비타민 B6': ['비타민B6염산염', '피리독신염산염', '비타민B6'],
    '비타민 B12': ['시아노코발라민', '비타민B12혼합제제', '메코발라민', '비타민B12'],
    '티아민': ['티아민염산염', '티아민질산염', '비타민B1염산염', '비타민B1질산염', '비타민B1'],
    '비타민 B2': ['리보플라빈', '비타민B2'],
    '나이아신': ['니코틴산아미드', '니코틴산'],
    '비오틴': ['비오틴'],
    '엽산': ['엽산'],
    '비타민 K2': ['비타민K2', '메나퀴논'],
    '아연': ['산화아연', '글루콘산아연', '황산아연'],
    '철분': ['푸마르산제일철', '황산제일철', '헴철', '피로인산제이철'],
    '구리': ['황산구리', '글루콘산구리', '글루콘산동', '황산동', '산화동'],
    '마그네슘': ['산화마그네슘', '수산화마그네슘', '글루콘산마그네슘', '탄산마그네슘'],
    '칼슘': ['탄산칼슘', '구연산칼슘', '유청칼슘', '해조칼슘', '산호칼슘'],
    '칼륨': ['염화칼륨'],
    '망간': ['황산망간'],
    '크롬': ['크롬효모', '염화크롬'],
    '프로바이오틱스': ['유산균혼합분말', '복합유산균', '유산균'],
    '프리바이오틱스': ['프락토올리고당', '갈락토올리고당', '자일로올리고당'],
    '난소화성 말토덱스트린': ['난소화성말토덱스트린'],
    '차전자피': ['차전자피식이섬유', '차전자피분말'],
    '이눌린': ['이눌린', '치커리추출물'],
    '오메가-3': ['EPA및DHA함유유지', '오메가3', '피쉬오일', '정제어유', 'DHA농축유지'],
    '루테인': ['마리골드꽃추출물', '루테인지아잔틴복합추출물'],
    '지아잔틴': ['지아잔틴'],
    '아스타잔틴': ['헤마토코쿠스추출물'],
    '포스파티딜세린': ['포스파티딜세린'],
    '밀크씨슬': ['밀크씨슬추출물', '카르두스마리아누스'],
    '코엔자임 Q10': ['코엔자임Q10'],
    '글루코사민': ['글루코사민염산염', '글루코사민황산염', 'NAG(엔에이지', 'N-아세틸글루코사민'],
    '콘드로이틴': ['콘드로이친', '뮤코다당.단백'],
    '가르시니아': ['가르시니아캄보지아추출물', '가르시니아캄보지아껍질추출물'],
    '녹차 카테킨': ['녹차추출물'],
    '은행잎': ['은행잎추출물'],
    '크랜베리': ['크랜베리추출물', '크랜베리분말'],
    '이소플라본': ['대두이소플라본'],
    '콜라겐': ['저분자콜라겐펩타이드', '콜라겐펩타이드', '피쉬콜라겐'],
    '쏘팔메토': ['쏘팔메토열매추출물'],
    '아슈와간다': ['아쉬아간다추출물', '아슈와간다추출물'],
    '홍경천': ['홍경천추출물'],
    '멜라토닌': ['멜라토닌'],
    '트립토판': ['L-트립토판'],
    'L-아르기닌': ['아르기닌'],
    'MSM': ['엠에스엠', '디메틸설폰', '식이유황'],
    '히알루론산': ['히알루론산나트륨'],
    '종합비타민': ['멀티비타민', '종합비타민미네랄'],
    '단백질': ['유청단백분말', '분리대두단백', '농축유청단백'],
    '프로폴리스': ['프로폴리스추출물'],
    '알파리포산': ['알파리포산'],
    '카르니틴': ['L-카르니틴'],
    '콩': ['대두추출물'],
    '감마리놀렌산': ['달맞이꽃종자유'],
    '케르세틴': ['퀘르세틴'],
    '레스베라트롤': ['레스베라트롤'],
    '보스웰리아': ['보스웰리아추출물'],
    '커큐민': ['강황추출물', '울금'],
    '타트체리 추출물': ['타트체리추출물'],
    '폴리코사놀': ['폴리코사놀-사탕수수왁스알코올'],
    '식물스테롤': ['식물스타놀에스테르', '식물성스테롤'],
    '크레아틴': ['크레아틴'],
    '이노시톨': ['이노시톨'],
    '베타글루칸': ['베타글루칸'],
    '히알루론산나트륨': [],
}

alias_lookup = {}
for canon, alist in ALIAS.items():
    if canon not in SUBS:
        continue  # 사전에 없는 canon 은 쓰지 않는다
    alias_lookup[norm(canon)] = canon
    for a in alist:
        alias_lookup[norm(a)] = canon
subs_norm = {norm(k): k for k in SUBS}

GENUS = re.compile(r'(Lactobacillus|Bifidobacterium|Lactiplantibacillus|Lacticaseibacillus|Lactococcus|Streptococcus|Enterococcus|Ligilactobacillus|Limosilactobacillus|Levilactobacillus|Pediococcus|Leuconostoc)', re.I)
IGNORE = re.compile(r'^([0-9.,]|과립|캡슐|정제|분말\)|희석제|부형제|보호제|기타가공품|혼합제제$|건조효모$)')

def map_token(tok: str):
    """returns (name_ko or 'IGNORE' or None, 'exact'|'likely'|None)"""
    n = norm(tok)
    if not n:
        return None, None
    if IGNORE.match(n) or re.fullmatch(r'[0-9.]+.*', n):
        return 'IGNORE', None
    if 'Saccharomyces' in tok or '사카로마이세스' in n:
        return ('사카로마이세스 보울라디' if '사카로마이세스 보울라디' in SUBS else '프로바이오틱스'), 'likely'
    if GENUS.search(tok):
        return '프로바이오틱스', 'likely'
    if n in alias_lookup:
        return alias_lookup[n], 'exact'
    if n in subs_norm:
        return subs_norm[n], 'exact'
    for sn, orig in subs_norm.items():
        if len(sn) >= 2 and sn in n:
            return orig, 'likely'
    for an, canon in alias_lookup.items():
        if len(an) >= 3 and an in n:
            return canon, 'likely'
    return None, None

def tokens_of(raw: str):
    for tok in re.split(r'(?:,(?!\d{3})|，)', raw or ''):
        tok = tok.strip()
        if tok:
            yield tok

def main():
    cnt = collections.Counter()
    for l in open(os.path.join(HERE, 'out', 'I0030.jsonl'), encoding='utf-8'):
        r = json.loads(l)
        for tok in tokens_of(r.get('INDIV_RAWMTRL_NM')):
            cnt[tok] += 1

    total = sum(cnt.values()); mapped = 0
    rows_out = []
    for tok, c in cnt.most_common():
        name, conf = map_token(tok)
        if name and name != 'IGNORE':
            mapped += c
            sid, code = SUBS[name]
            rows_out.append((tok, c, name, sid, code, conf))
        elif name == 'IGNORE':
            rows_out.append((tok, c, '(제외)', '', '', 'ignore'))
        else:
            rows_out.append((tok, c, '', '', '', 'uncertain'))

    print(f'원료 토큰 {len(cnt)}종 / 출현 {total:,}회 / 자동 매핑 출현 기준 {mapped*100//total}%')

    with open(os.path.join(HERE, 'rawmtrl_map_draft.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['원료명(원문)', '출현횟수', '매핑 성분', 'substance_id', 'code', 'confidence', '검수 판정', '의견'])
        for r in rows_out:
            w.writerow(list(r) + ['', ''])

    os.makedirs(os.path.join(HERE, 'sql'), exist_ok=True)
    with open(os.path.join(HERE, 'sql', 'load-ingredient-map.sql'), 'w', encoding='utf-8') as f:
        f.write('-- 원료명 → 성분 자동 매핑 (build_rawmtrl_map.py 생성, 검수 전 초안)\n')
        f.write("-- confidence: exact(이름 일치) / likely(부분 일치·균주 규칙). uncertain 은 삽입하지 않는다.\n")
        f.write('begin;\n')
        n = 0
        for tok, c, name, sid, code, conf in rows_out:
            if conf in ('exact', 'likely'):
                esc = tok.replace("'", "''")
                f.write(f"insert into interaction.ingredient_substance_map (name_raw, substance_id, confidence, mapped_by) "
                        f"values ('{esc}', {sid}, '{conf}', 'rule') on conflict (name_raw, substance_id) do nothing;\n")
                n += 1
        f.write('commit;\n')
    print(f'SQL: 매핑 {n}건 → tools/hff/sql/load-ingredient-map.sql')

if __name__ == '__main__':
    main()
