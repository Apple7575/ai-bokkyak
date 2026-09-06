import json, re, collections, csv, os

# 1) 검수시트(작용축)에서 성분 이름 목록 추출
S = r"C:\Users\SSAFY\AppData\Local\Temp\claude\C--Users-SSAFY-orca-workspaces-ai-bokkyak-pomfret\e7a3ecf8-8112-478e-b94d-3e83da0e2d9a\scratchpad"
subs = set()
in2 = False
for line in open(os.path.join(S, 'xlsx.txt'), encoding='utf-8'):
    if line.startswith('=== SHEET: 2'):
        in2 = True; continue
    if line.startswith('=== SHEET: 3'):
        break
    if in2 and ' | ' in line:
        parts = [p.strip() for p in line.split(' | ')]
        if len(parts) >= 4 and parts[2] and parts[2] != '성분':
            subs.add(parts[2])
print('성분 후보:', len(subs))

# 2) 정규화 + 매핑 규칙
def norm(t: str) -> str:
    t = re.sub(r'\((고시형|개별인정형|고시|합성|천연)\)', '', t)
    t = re.sub(r'\s+', '', t)
    return t.strip()

# 흔한 파생 표기 → 성분 (수동 시드)
ALIAS = {
    '홍삼': ['홍삼농축액', '홍삼분말', '홍삼추출물', '홍삼농축분말'],
    '비타민 C': ['비타민C', 'L-아스코르빈산', '아스코르빈산', '아스코브산'],
    '비타민 D': ['비타민D3혼합제제', '비타민D3', '비타민D', '콜레칼시페롤'],
    '비타민 E': ['비타민E혼합제제', 'd-알파-토코페롤', '토코페롤', '초산토코페롤'],
    '비타민 A': ['비타민A혼합제제', '레티닐팔미테이트', '베타카로틴'],
    '비타민 B6': ['비타민B6염산염', '피리독신염산염'],
    '비타민 B12': ['시아노코발라민', '비타민B12혼합제제', '메코발라민'],
    '비타민 B1': ['티아민', '티아민염산염', '티아민질산염', '비타민B1염산염', '비타민B1질산염'],
    '비타민 B2': ['리보플라빈'],
    '엽산': ['엽산'],
    '나이아신': ['니코틴산아미드', '니코틴산'],
    '판토텐산': ['판토텐산칼슘'],
    '비오틴': ['비오틴'],
    '아연': ['산화아연', '글루콘산아연', '황산아연'],
    '철분': ['푸마르산제일철', '황산제일철', '헴철', '피로인산제이철'],
    '구리': ['황산구리', '글루콘산구리', '글루콘산동', '황산동', '산화동'],
    '마그네슘': ['산화마그네슘', '수산화마그네슘', '글루콘산마그네슘', '탄산마그네슘'],
    '칼슘': ['탄산칼슘', '구연산칼슘', '유청칼슘', '해조칼슘', '산호칼슘'],
    '칼륨': ['염화칼륨'],
    '셀레늄': ['셀렌', '아셀렌산나트륨', '셀레늄', '건조효모(셀렌함유)', '셀렌함유건조효모'],
    '프로바이오틱스': ['유산균혼합분말', '프로바이오틱스', '복합유산균'],
    '오메가-3': ['EPA및DHA함유유지', '오메가3', '피쉬오일', '정제어유', 'DHA농축유지'],
    '루테인': ['마리골드꽃추출물', '루테인지아잔틴복합추출물', '루테인'],
    '밀크씨슬': ['밀크씨슬추출물', '카르두스마리아누스'],
    '코엔자임 Q10': ['코엔자임Q10'],
    '글루코사민': ['글루코사민염산염', '글루코사민황산염', 'N-아세틸글루코사민'],
    '가르시니아': ['가르시니아캄보지아추출물', '가르시니아캄보지아껍질추출물'],
    '녹차 카테킨': ['녹차추출물'],
    '은행잎': ['은행잎추출물'],
    '인삼': ['인삼농축액', '인삼추출물'],
    '크랜베리': ['크랜베리추출물', '크랜베리분말'],
    '이소플라본': ['대두이소플라본'],
    '콜라겐': ['저분자콜라겐펩타이드', '콜라겐펩타이드', '피쉬콜라겐'],
    '식이섬유': ['난소화성말토덱스트린', '차전자피식이섬유', '이눌린'],
    '프리바이오틱스': ['프락토올리고당', '갈락토올리고당', '자일로올리고당'],
    '쏘팔메토': ['쏘팔메토열매추출물'],
    '아슈와간다': ['아쉬아간다추출물', '아슈와간다추출물'],
    '홍경천': ['홍경천추출물'],
    '멜라토닌': ['멜라토닌'],
    '트립토판': ['L-트립토판'],
    '아르기닌': ['L-아르기닌'],
    'MSM': ['엠에스엠', '디메틸설폰', 'MSM'],
    '히알루론산': ['히알루론산나트륨'],
    '유산균': ['유산균'],
}
alias_lookup = {}
for canon in ALIAS:
    alias_lookup[norm(canon)] = canon
for canon, alist in ALIAS.items():
    for a in alist:
        alias_lookup[norm(a)] = canon

subs_norm = {norm(s): s for s in subs}
GENUS = re.compile(r'(Lactobacillus|Bifidobacterium|Lactiplantibacillus|Lacticaseibacillus|Lactococcus|Streptococcus|Enterococcus|Ligilactobacillus|Limosilactobacillus|Levilactobacillus|Saccharomyces)', re.I)

def map_token(tok: str):
    n = norm(tok)
    if not n or re.fullmatch(r'[0-9.]+.*', n) or n in ('혼합제제', '건조효모'):
        return ('IGNORE' if n in ('혼합제제', '건조효모') or re.fullmatch(r'[0-9.]+.*', n) else None), ('skip' if True else None)
    if GENUS.search(tok):
        return '프로바이오틱스', 'high'
    if n in alias_lookup:
        return alias_lookup[n], 'high'
    if n in subs_norm:
        return subs_norm[n], 'high'
    # 부분 일치: 성분명이 토큰 안에 들어 있으면 (길이 2 이상)
    for sn, orig in subs_norm.items():
        if len(sn) >= 2 and sn in n:
            return orig, 'medium'
    for an, canon in alias_lookup.items():
        if len(an) >= 3 and an in n:
            return canon, 'medium'
    return None, None

# 3) I0030 전체 토큰에 적용 → 커버리지
cnt = collections.Counter()
for l in open(r'C:\Users\SSAFY\orca\workspaces\ai-bokkyak\pomfret\tools\hff\out\I0030.jsonl', encoding='utf-8'):
    r = json.loads(l)
    for tok in re.split(r'(?:,(?!\d{3})|，)', r.get('INDIV_RAWMTRL_NM') or ''):
        tok = tok.strip()
        if tok:
            cnt[tok] += 1

total_occ = sum(cnt.values())
mapped_occ = 0
rows_out = []
for tok, c in cnt.most_common():
    canon, conf = map_token(tok)
    if canon:
        mapped_occ += c
    rows_out.append((tok, c, canon or '', conf or 'unmapped'))

print(f'원료 토큰 {len(cnt)}종 / 출현 {total_occ:,}회')
print(f'자동 매핑: 출현 기준 {mapped_occ*100//total_occ}% / 종류 기준 {sum(1 for r in rows_out if r[2])} 종')
top_unmapped = [(t, c) for t, c, m, _ in rows_out if not m][:15]
print('미매핑 상위:', top_unmapped)

out = r'C:\Users\SSAFY\orca\workspaces\ai-bokkyak\pomfret\tools\hff\rawmtrl_map_draft.csv'
with open(out, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerow(['원료명(원문)', '출현횟수', '매핑 성분(초안)', 'confidence', '검수 판정', '의견'])
    for tok, c, m, conf in rows_out:
        w.writerow([tok, c, m, conf if m else 'uncertain', '', ''])
print('저장:', out)
