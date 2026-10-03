-- 세트 규칙의 항 역할(role) 보정 (2026-10-03)
--
-- v2 판정은 "object 항은 전부, precipitant/either 항은 하나 이상"이다. 그런데 아래 규칙들은 서로 대안인 항
-- (SSRI 또는 SNRI, RAS차단제 또는 칼륨보존이뇨제 …)이 전부 object 로 들어 있어, 사용자가 둘 다 골라야만 걸렸다.
-- 또 홍경천×인삼은 양쪽이 모두 either 라 인삼 하나만 골라도 걸렸다(오탐).
-- 여기서는 임상 의미가 바뀌지 않는 범위에서만 역할을 바꾼다. 인슐린×설폰요소제×인삼×크롬 은 "(A 또는 B) 그리고 (C 또는 D)"
-- 구조라 role 만으로 표현이 안 돼 손대지 않는다(약사 결정: 규칙을 둘로 나누거나 혈당강하제 전체로 넓힐지).
-- 실행: 전체 붙여넣고 Run. §1 은 변경 전/후 확인용.

-- §1 현재 상태
select r.code, s.ordinal, s.target_type, t.name_ko, s.role
from interaction.interaction_rule_side s
join interaction.interaction_rule r on r.id = s.rule_id
left join interaction.substance t on s.target_type = 'substance' and t.id = s.target_id
where r.code in ('five_htp_serotonergic_antidepressant','st_johns_wort_serotonergic_antidepressant','tryptophan_serotonergic_antidepressant',
                 'potassium_ras_blocker_hyperkalemia','ppi_micronutrient_depletion','orlistat_fat_soluble_timing','rhodiola_ginseng_overstimulation')
order by r.code, s.ordinal;

-- §2 보정
-- 세로토닌 3개: SSRI·SNRI 는 둘 중 하나(either), 건기식(5-HTP·세인트존스워트·트립토판)은 필수(object)
update interaction.interaction_rule_side s set role = case when t.name_ko in ('SSRI','SNRI') then 'either' else 'object' end
from interaction.interaction_rule r, interaction.substance t
where s.rule_id = r.id and s.target_type = 'substance' and t.id = s.target_id
  and r.code in ('five_htp_serotonergic_antidepressant','st_johns_wort_serotonergic_antidepressant','tryptophan_serotonergic_antidepressant');

-- 칼륨: RAS차단제·칼륨보존이뇨제 둘 중 하나 + 칼륨 필수
update interaction.interaction_rule_side s set role = case when t.name_ko = '칼륨' then 'object' else 'either' end
from interaction.interaction_rule r, interaction.substance t
where s.rule_id = r.id and s.target_type = 'substance' and t.id = s.target_id
  and r.code = 'potassium_ras_blocker_hyperkalemia';

-- PPI: PPI 필수 + 영양소(B12·마그네슘·칼슘·철) 중 하나
update interaction.interaction_rule_side s set role = case when t.name_ko = 'PPI' then 'object' else 'either' end
from interaction.interaction_rule r, interaction.substance t
where s.rule_id = r.id and s.target_type = 'substance' and t.id = s.target_id
  and r.code = 'ppi_micronutrient_depletion';

-- 오를리스타트: 오를리스타트 필수 + 지용성 비타민·오메가-3·CoQ10 중 하나
update interaction.interaction_rule_side s set role = case when t.name_ko = '오를리스타트' then 'object' else 'either' end
from interaction.interaction_rule r, interaction.substance t
where s.rule_id = r.id and s.target_type = 'substance' and t.id = s.target_id
  and r.code = 'orlistat_fat_soluble_timing';

-- 홍경천×인삼: 둘 다 있어야 한다 (object)
update interaction.interaction_rule_side s set role = 'object'
from interaction.interaction_rule r
where s.rule_id = r.id and r.code = 'rhodiola_ginseng_overstimulation';

-- §3 변경 후 확인 (§1 과 같은 질의)
select r.code, s.ordinal, t.name_ko, s.role
from interaction.interaction_rule_side s
join interaction.interaction_rule r on r.id = s.rule_id
left join interaction.substance t on s.target_type = 'substance' and t.id = s.target_id
where r.code in ('five_htp_serotonergic_antidepressant','st_johns_wort_serotonergic_antidepressant','tryptophan_serotonergic_antidepressant',
                 'potassium_ras_blocker_hyperkalemia','ppi_micronutrient_depletion','orlistat_fat_soluble_timing','rhodiola_ginseng_overstimulation')
order by r.code, s.ordinal;
