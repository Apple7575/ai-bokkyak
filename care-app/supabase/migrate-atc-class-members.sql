-- 성분 → 성분군(substance_class_member) 자동 채우기 — ATC 코드 기반 (2026-09-20, 2단계 계열 추가)
--
-- 왜: 검수 규칙은 "항혈소판제 × 오메가-3"처럼 계열 이름으로 적혀 있는데, substance_class_member 가
--     66행뿐이라 아스피린·클로피도그렐 같은 흔한 약이 계열에 소속돼 있지 않아 규칙이 안 걸렸다.
-- 어떻게: public.drug_product 에 심평원 ATC 코드가 이미 있다(21,933/21,953건). 성분(substance.code)
--     → DUR 제품(dur_product_ingredient.ingredient) → 제품의 ATC 코드 → ATC 앞자리 → 우리 성분군.
--     WHO ATC 분류를 그대로 쓰므로 사람이 판단할 부분이 거의 없다.
-- 안전장치:
--   · 단일 성분 제품만 근거로 쓴다(복합제는 두 성분 모두에 같은 ATC가 붙어 오염되므로 제외).
--   · 같은 (성분, 계열)을 뒷받침하는 제품이 2개 이상일 때만 넣는다. 1개짜리는 §3 검수 목록으로.
--   · 이미 있는 행은 건드리지 않는다(on conflict do nothing).
--   · §1 미리보기를 먼저 보고, §2 insert 는 확인 후 실행.
--
-- 실행 순서 (Supabase SQL Editor):  §0 → §1(확인) → §2 → §4(검증). §3 은 참고.

-- ── §0. ATC 앞자리 → 성분군 대응표 (세션 임시 테이블) ─────────────────────────
drop table if exists _atc_class; drop table if exists _single; drop table if exists _cand;
create temp table _atc_class (prefix text, class_code text, note text);
insert into _atc_class (prefix, class_code, note) values
  -- 지질
  ('C10AA', 'statin', 'HMG-CoA 환원효소 억제제'),
  ('C10BA', 'statin', '스타틴 + 다른 지질약 복합'),
  ('C10BX', 'statin', '스타틴 기타 복합'),
  ('C10AX06', 'omega3_group', '오메가-3 트리글리세리드'),
  -- 위장
  ('A02BC', 'ppi', '프로톤펌프억제제'),
  ('A02AA', 'antacid', '마그네슘 제산제'),
  ('A02AB', 'antacid', '알루미늄 제산제'),
  ('A02AC', 'antacid', '칼슘 제산제'),
  ('A02AD', 'antacid', '복합 제산제'),
  ('A02AF', 'antacid', '제산제 + 소포제'),
  ('A02AX', 'antacid', '기타 제산제'),
  -- 정신
  ('N06AB', 'ssri', 'SSRI'),
  ('N06AX16', 'snri', '벤라팍신'),
  ('N06AX17', 'snri', '밀나시프란'),
  ('N06AX21', 'snri', '둘록세틴'),
  ('N06AX23', 'snri', '데스벤라팍신'),
  ('N06AX28', 'snri', '레보밀나시프란'),
  -- 심혈관
  ('C09CA', 'arb', 'ARB 단일'),
  ('C09CA', 'ras_blocker', 'ARB 는 RAS 차단제이기도 하다'),
  ('C09AA', 'ras_blocker', 'ACE 억제제'),
  ('C09XA', 'ras_blocker', '레닌 억제제'),
  ('C08CA', 'ccb', '디히드로피리딘계 CCB'),
  ('C08DA', 'ccb', '베라파밀계'),
  ('C08DB', 'ccb', '딜티아젬'),
  ('C08EA', 'ccb', '기타 CCB'),
  ('C07AA', 'beta_blocker', '비선택 베타차단제'),
  ('C07AB', 'beta_blocker', '선택적 베타차단제'),
  ('C07AG', 'beta_blocker', '알파+베타차단제'),
  ('C03AA', 'diuretic', '티아지드'),
  ('C03BA', 'diuretic', '티아지드 유사'),
  ('C03CA', 'diuretic', '루프이뇨제'),
  ('C03DA', 'diuretic', '알도스테론 길항제(이뇨제이기도)'),
  ('C03DB', 'diuretic', '기타 칼륨보존이뇨제(이뇨제이기도)'),
  ('C03DA', 'k_sparing_diuretic', '스피로노락톤·에플레레논'),
  ('C03DB', 'k_sparing_diuretic', '아밀로라이드·트리암테렌'),
  ('C01BA', 'antiarrhythmic', 'Ia'),
  ('C01BB', 'antiarrhythmic', 'Ib'),
  ('C01BC', 'antiarrhythmic', 'Ic'),
  ('C01BD', 'antiarrhythmic', 'III(아미오다론 등)'),
  ('C01BG', 'antiarrhythmic', '기타'),
  -- 혈액
  ('B01AA', 'anticoagulant', '비타민 K 길항제(와파린)'),
  ('B01AB', 'anticoagulant', '헤파린계'),
  ('B01AE', 'anticoagulant', '직접 트롬빈 억제제'),
  ('B01AF', 'anticoagulant', '직접 Xa 억제제'),
  ('B01AC', 'antiplatelet', '항혈소판제(아스피린 B01AC06·클로피도그렐 B01AC04)'),
  -- 골
  ('M05BA', 'bisphosphonate', '비스포스포네이트'),
  ('M05BB', 'bisphosphonate', '비스포스포네이트 복합'),
  -- 당뇨
  ('A10BB', 'sulfonylurea', '설폰요소제'),
  ('A10BA', 'biguanide', '메트포르민'),
  ('A10BJ', 'glp1_agonist', 'GLP-1 수용체작용제'),
  -- 갑상선
  ('H03AA', 'thyroid_hormone', '레보티록신 등'),
  -- 진통·소염
  ('M01AB', 'nsaid', '아세트산 유도체(디클로페낙 등)'),
  ('M01AC', 'nsaid', '옥시캄'),
  ('M01AE', 'nsaid', '프로피온산(이부프로펜·나프록센)'),
  ('M01AG', 'nsaid', '페남산'),
  ('M01AH', 'nsaid', 'COX-2 억제제'),
  ('N02BA', 'nsaid', '살리실산 유도체(고용량 아스피린)'),
  -- 신경
  ('N03AA', 'antiepileptic', '바르비투르'), ('N03AB', 'antiepileptic', '히단토인'),
  ('N03AD', 'antiepileptic', '숙신이미드'), ('N03AE', 'antiepileptic', '벤조디아제핀계 항경련'),
  ('N03AF', 'antiepileptic', '카르복사미드(카바마제핀)'), ('N03AG', 'antiepileptic', '지방산(발프로산)'),
  ('N03AX', 'antiepileptic', '기타(레베티라세탐 등)'),
  ('N04AA', 'antiparkinson', '항콜린'), ('N04BA', 'antiparkinson', '레보도파'),
  ('N04BB', 'antiparkinson', '아만타딘'), ('N04BC', 'antiparkinson', '도파민 작용제'),
  ('N04BD', 'antiparkinson', 'MAO-B 억제제'), ('N04BX', 'antiparkinson', '기타'),
  -- 면역·항암
  ('L04AA', 'immunosuppressant', '선택적'), ('L04AB', 'immunosuppressant', 'TNF 억제제'),
  ('L04AC', 'immunosuppressant', '인터루킨 억제제'), ('L04AD', 'immunosuppressant', '칼시뉴린 억제제(타크로리무스·시클로스포린)'),
  ('L04AX', 'immunosuppressant', '기타(아자티오프린·MTX)'),
  ('L01', 'antineoplastic', '항암제 전체'),
  ('L02BA', 'serm', '항에스트로겐(타목시펜)'), ('G03XC', 'serm', '랄록시펜 등'),
  -- 감염
  ('J01', 'antibiotic', '전신 항생제 전체'),
  ('J05AE', 'antiretroviral', 'HIV 단백분해효소 억제제'), ('J05AF', 'antiretroviral', '뉴클레오시드 역전사효소 억제제(HBV 약 포함 — 검수)'),
  ('J05AG', 'antiretroviral', 'NNRTI'), ('J05AJ', 'antiretroviral', '인테그라제 억제제'),
  ('J05AR', 'antiretroviral', 'HIV 복합제'),
  -- 호르몬·피부·기타
  ('G03AA', 'oral_contraceptive', '복합 경구피임약'), ('G03AB', 'oral_contraceptive', '순차형'),
  ('G03AC', 'oral_contraceptive', '프로게스토겐 단독'),
  ('D10BA', 'retinoid', '이소트레티노인(전신)'), ('D10AD', 'retinoid', '국소 레티노이드'), ('D05BB', 'retinoid', '아시트레틴'),
  ('R06A', 'antihistamine', '전신 항히스타민제'),
  ('G04CB', 'five_ar_inhibitor', '피나스테리드·두타스테리드'),
  ('A08A', 'anti_obesity', '항비만약(오를리스타트·펜터민)'),
  -- 영양소(의약품으로 등록된 것만 잡힌다 — 건기식은 별도)
  ('A11CA', 'fat_soluble_vitamin', '비타민 A'), ('A11CC', 'fat_soluble_vitamin', '비타민 D'),
  ('A11HA03', 'fat_soluble_vitamin', '비타민 E'), ('B02BA', 'fat_soluble_vitamin', '비타민 K'),
  ('A12AA', 'polyvalent_cation', '칼슘'), ('A12CC', 'polyvalent_cation', '마그네슘'),
  ('A12CB', 'polyvalent_cation', '아연'), ('B03AA', 'polyvalent_cation', '철(2가)'), ('B03AB', 'polyvalent_cation', '철(3가)'),
  -- ── 2단계(migrate-class-bridge-2.sql 로 만든 계열) ─────────────────────────
  ('B01A', 'antithrombotic', '항혈전제 전체(항응고+항혈소판)'),
  ('A10', 'antidiabetic_drug', '혈당강하제 전체(인슐린 포함)'),
  ('C02', 'antihypertensive', '혈압약'), ('C03', 'antihypertensive', '이뇨제(혈압약으로도)'),
  ('C07', 'antihypertensive', '베타차단제'), ('C08', 'antihypertensive', 'CCB'), ('C09', 'antihypertensive', 'RAS'),
  ('N06A', 'antidepressant', '항우울제 전체'),
  ('N05C', 'hypnotic', '수면제'),
  ('N05BA', 'benzodiazepine', '벤조디아제핀 항불안'), ('N05CD', 'benzodiazepine', '벤조디아제핀 수면'), ('N03AE', 'benzodiazepine', '클로나제팜'),
  ('C03CA', 'loop_diuretic', '루프이뇨제'),
  ('C03AA', 'thiazide_diuretic', '티아지드'), ('C03BA', 'thiazide_diuretic', '티아지드 유사'),
  ('B01AE', 'doac', '다비가트란'), ('B01AF', 'doac', 'Xa 억제제'),
  ('A02BA', 'h2_blocker', 'H2 차단제'),
  ('A10BK', 'sglt2_inhibitor', 'SGLT2'), ('A10BH', 'dpp4_inhibitor', 'DPP-4'),
  ('H02AB', 'glucocorticoid', '전신 글루코코르티코이드'),
  ('B03XA', 'esa', '조혈자극제'),
  ('C02CA', 'alpha_blocker', '알파차단제(혈압)'), ('G04CA', 'alpha_blocker', '알파차단제(전립선)'),
  ('G04BD', 'antimuscarinic', '요실금 항무스카린'),
  ('G04BD', 'anticholinergic', '요실금'), ('N04AA', 'anticholinergic', '항파킨슨 항콜린'), ('A03BA', 'anticholinergic', '벨라돈나'), ('A03BB', 'anticholinergic', '벨라돈나 반합성'),
  ('N06DA', 'cholinesterase_inhibitor', '치매약(도네페질 등)'),
  ('L03AB', 'interferon', '인터페론'),
  ('L04AE', 's1p_modulator', 'S1P 조절제(핑골리모드 등, ATC 2024)'),
  ('J05', 'antiviral', '전신 항바이러스제'),
  ('R03BA', 'inhaled_corticosteroid', '흡입 스테로이드'),
  ('R03AC12', 'laba', '살메테롤'), ('R03AC13', 'laba', '포르모테롤'), ('R03AC18', 'laba', '인다카테롤'), ('R03AC19', 'laba', '올로다테롤'),
  ('R03AK', 'laba', 'LABA+ICS 복합'), ('R03AL', 'laba', 'LABA+항콜린 복합'),
  ('R03', 'bronchodilator', '기관지확장제 전체'),
  ('L04AX05', 'antifibrotic', '피르페니돈'), ('L01EX09', 'antifibrotic', '닌테다닙'),
  ('J04A', 'antituberculosis_drug', '항결핵제'),
  ('J05AE', 'protease_inhibitor', 'HIV 단백분해효소 억제제'), ('J05AG', 'nnrti', 'NNRTI'), ('J05AJ', 'integrase_inhibitor', '인테그라제 억제제');

-- 단일 성분 제품만: 같은 제품코드에 성분이 1개인 것
create temp table _single as
select d.product_code, d.ingredient
from public.dur_product_ingredient d
group by d.product_code, d.ingredient
having (select count(distinct ingredient) from public.dur_product_ingredient x where x.product_code = d.product_code) = 1;

-- 성분 × 계열 후보: 근거 제품 수와 ATC 예시
create temp table _cand as
select s.id as substance_id, s.code as substance_code, s.name_ko,
       c.id as class_id, c.code as class_code, c.name_ko as class_name,
       count(distinct p.product_code) as n_products,
       string_agg(distinct p.atc_code, ',' order by p.atc_code) as atc_codes,
       exists (select 1 from interaction.substance_class_member m
               where m.substance_id = s.id and m.class_id = c.id) as already
from interaction.substance s
join _single sg on sg.ingredient = s.code
join public.drug_product p on p.product_code = sg.product_code and p.atc_code is not null
join _atc_class a on p.atc_code like a.prefix || '%'
join interaction.substance_class c on c.code = a.class_code
group by s.id, s.code, s.name_ko, c.id, c.code, c.name_ko;

-- ── §1. 미리보기 — 이 표를 확인한 뒤 §2 를 실행한다 ────────────────────────
select substance_code, name_ko, class_code, class_name, n_products, atc_codes
from _cand
where not already and n_products >= 2
order by class_code, n_products desc, substance_code;

-- ── §2. 적용 (2026-09-20 부터 주석 없이 바로 실행 — §1 미리보기는 1차에서 확인 완료) ──────
insert into interaction.substance_class_member (substance_id, class_id)
select substance_id, class_id from _cand
where not already and n_products >= 2
on conflict do nothing;

-- ── §3. 검수 목록 — 근거 제품이 1개뿐인 것(자동으로 넣지 않음) ───────────────
select substance_code, name_ko, class_code, class_name, n_products, atc_codes
from _cand
where not already and n_products = 1
order by class_code, substance_code;

-- 성분인데 DUR 제품이 하나도 안 이어지는 것(ATC 로는 못 잡는 성분 — 건기식·영양소 대부분)
select s.code, s.name_ko
from interaction.substance s
where not exists (select 1 from _single sg where sg.ingredient = s.code)
order by s.code;

-- ── §4. 검증 — §2 실행 후 ──────────────────────────────────────────────────
select s.code, s.name_ko, c.code as class_code
from interaction.substance_class_member m
join interaction.substance s on s.id = m.substance_id
join interaction.substance_class c on c.id = m.class_id
where s.code in ('aspirin', 'clopidogrel', 'atorvastatin', 'amlodipine', 'metformin', 'warfarin', 'losartan')
order by s.code, c.code;

-- 그리고 앱과 같은 호출로 확인:
-- select public.quick_check_v1(array['아스피린','오메가-3'], null, '{}');
--   → findings 에 antiplatelet_bleeding_risk_hff 가 있어야 한다.
