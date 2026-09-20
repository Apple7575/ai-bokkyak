-- 계열 다리 2단계 (2026-09-20): 계열 표에 없던 가짜 성분 35개 처리
--   · 이름만 다른 4개는 기존 계열에 연결
--   · 나머지 가운데 ATC 로 회원을 채울 수 있는 27개는 계열 행을 새로 만들고 연결
--   · immunomodulator·biologics 는 ATC 가 없어 보류(검수 목록)
-- 실행 순서: 이 파일 → migrate-atc-class-members.sql 다시(§1 확인 → §2 주석 풀고 실행)

-- 1) 이름만 다른 것 — 기존 계열에 연결
update interaction.substance_class c set generic_substance_id = s.id
from interaction.substance s where s.kind = 'drug_class_generic' and c.generic_substance_id is null and (
  (c.code = 'antiepileptic'      and s.code = 'anticonvulsant') or
  (c.code = 'antineoplastic'     and s.code = 'anticancer_drug') or
  (c.code = 'anti_obesity'       and s.code = 'anti_obesity_drug') or
  (c.code = 'k_sparing_diuretic' and s.code = 'potassium_sparing_diuretic'));

-- 2) 새 계열 행 — code 는 가짜 성분 code 와 같게, 이름은 가짜 성분 이름 그대로
insert into interaction.substance_class (code, name_ko, generic_substance_id)
select s.code, s.name_ko, s.id
from interaction.substance s
where s.kind = 'drug_class_generic'
  and s.code in ('antithrombotic','antidiabetic_drug','antihypertensive','antidepressant','hypnotic','benzodiazepine',
                 'loop_diuretic','thiazide_diuretic','doac','h2_blocker','sglt2_inhibitor','dpp4_inhibitor',
                 'glucocorticoid','esa','alpha_blocker','antimuscarinic','anticholinergic','cholinesterase_inhibitor',
                 'interferon','s1p_modulator','antiviral','inhaled_corticosteroid','laba','bronchodilator',
                 'antifibrotic','antituberculosis_drug','protease_inhibitor','nnrti','integrase_inhibitor')
  and not exists (select 1 from interaction.substance_class c where c.code = s.code);

-- 3) 확인 — 이제 남는 가짜 성분은 immunomodulator·biologics 둘만이어야 한다
select s.id, s.code, s.name_ko
from interaction.substance s
where s.kind = 'drug_class_generic'
  and not exists (select 1 from interaction.substance_class c where c.generic_substance_id = s.id)
order by s.id;
