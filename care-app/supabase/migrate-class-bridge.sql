-- 계열 다리: substance_class ↔ 가짜 성분(substance.kind = 'drug_class_generic') (2026-09-20)
--
-- 규칙(interaction_rule_side)은 계열을 substance 표의 가짜 성분(스타틴 id 9, 항혈소판제 59 …)으로
-- 가리킨다. 실제 약은 substance_class_member 로 계열에 소속돼 있다(migrate-atc-class-members.sql).
-- 이 둘을 잇는 열을 substance_class 에 하나 두고, RPC v3 가 그 열로 실제 약 → 계열 → 가짜 성분을 이어 준다.
-- 실행 순서: 이 파일 → migrate-quick-check-rpc.sql(v3). 두 번 실행해도 안전.

alter table interaction.substance_class
  add column if not exists generic_substance_id bigint references interaction.substance(id);

-- 1) 코드가 같은 것끼리 자동 연결 (statin↔statin, antiplatelet↔antiplatelet, arb, diuretic, beta_blocker …)
update interaction.substance_class c
set generic_substance_id = s.id
from interaction.substance s
where s.kind = 'drug_class_generic' and s.code = c.code
  and c.generic_substance_id is null;

-- 2) 코드가 다른 것은 손으로 (확인된 것: ccb ↔ calcium_channel_blocker)
update interaction.substance_class c
set generic_substance_id = s.id
from interaction.substance s
where c.code = 'ccb' and s.code = 'calcium_channel_blocker' and c.generic_substance_id is null;

-- 3) 남은 것 확인 — 아래 두 표가 비어야 완성. 남으면 이름을 보고 2) 처럼 한 줄씩 잇는다.
-- 3a. 가짜 성분이 없는 계열
select c.id, c.code, c.name_ko
from interaction.substance_class c
where c.generic_substance_id is null
order by c.id;
-- 3b. 계열에 연결되지 않은 가짜 성분
select s.id, s.code, s.name_ko
from interaction.substance s
where s.kind = 'drug_class_generic'
  and not exists (select 1 from interaction.substance_class c where c.generic_substance_id = s.id)
order by s.id;
