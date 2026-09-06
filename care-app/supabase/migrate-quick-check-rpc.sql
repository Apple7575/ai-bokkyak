-- 1분 복용 점검 서버 판정 RPC v1 (2026-09-06)
--
-- 회의 결정(9/3) Option 1: 검수된 규칙 문구를 그대로 내보낸다. AI 설명은 별도 POC.
-- 구성: 앱(anon) → public.quick_check_v1(...) [security definer]
--        → interaction 스키마(게시 규칙 75 · 건기식 제품 46k · 매핑) + public DUR 를 읽어 판정.
--   · interaction 은 계속 API 미노출 — 이 함수만 문이다.
--   · 규칙은 is_active(=검수 승인 게시)만 읽는다. DB CHECK 가 게이트를 강제한다.
--
-- 입력:  p_names      점검할 이름들(칩 라벨·제품명 섞여도 됨)
--        p_age        연령대 라벨 (예: '60대 이상') — condition.name_ko 와 일치할 때만 조건으로 사용
--        p_conditions 해당 항목 라벨들 (예: '임신·수유 중')
-- 출력(jsonb):
--   resolved:   [{input, via, substance_ids}]  via: chip|substance|hff_product|drug_product
--   unresolved: [입력했지만 아무 데서도 못 찾은 이름]
--   unmapped:   [{product, ingredient}]  제품은 찾았지만 성분 매핑이 없는 기능성 원료 (P4: 확인 못 함)
--   findings:   [{code, severity, evidence_level, relation_kind, summary, what_happens, what_to_do,
--                 min_separation_hours, stop_days_before, matched}]
--   dur:        [{ingredient_a, ingredient_b, reason, notice_no}]  식약처 병용금기(제품명 입력분)
--
-- v1 범위: rule_kind pair/set/standalone, side 대상 substance/substance_class/intake_class/condition.
--          axis 대상 side 와 aggregate 규칙은 다음 버전 (게시분에 있으면 매칭 안 될 뿐 오류는 없음).

create or replace function public.quick_check_v1(
  p_names text[],
  p_age text default null,
  p_conditions text[] default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = interaction, public
as $$
declare
  v_result jsonb;
begin
  -- ── 1. 입력 해석 ────────────────────────────────────────────────────────
  create temp table _inp on commit drop as
    select distinct trim(x) as input from unnest(coalesce(p_names, '{}')) as x
    where trim(coalesce(x, '')) <> '';

  -- 칩(intake_class 라벨) → 성분/성분군
  create temp table _res on commit drop as
  select i.input, 'chip'::text as via, ic.id as intake_class_id,
         coalesce(r.substance_id, m.substance_id) as substance_id,
         r.class_id
  from _inp i
  join intake_class ic on ic.label_ko = i.input or ic.code = i.input
  left join intake_class_resolution r on r.intake_class_id = ic.id
  left join substance_class_member m on m.class_id = r.class_id;

  -- 성분 이름 직접 입력
  insert into _res
  select i.input, 'substance', null, s.id, null
  from _inp i
  join substance s on s.name_ko = i.input
  where not exists (select 1 from _res r where r.input = i.input);

  -- 건기식 제품명 (부분 일치, 가장 짧은 이름 = 가장 그럴듯한 것 1개)
  create temp table _hff on commit drop as
  select distinct on (i.input) i.input, p.id as product_id, p.name as product_name
  from _inp i
  join hff_product p on p.name ilike '%' || i.input || '%'
  where not exists (select 1 from _res r where r.input = i.input)
  order by i.input, length(p.name), p.id;

  insert into _res
  select h.input, 'hff_product', null, m.substance_id, null
  from _hff h
  join hff_product_ingredient pi on pi.product_id = h.product_id
  join ingredient_substance_map m
    on m.name_raw = pi.name_raw and m.confidence in ('exact', 'likely');

  -- 의약품 제품명 (식약처 DUR 제품→성분, 성분 영문코드 = substance.code)
  create temp table _drug on commit drop as
  select distinct i.input, d.ingredient
  from _inp i
  join public.dur_product_ingredient d on d.product_name ilike '%' || i.input || '%'
  where not exists (select 1 from _res r where r.input = i.input)
    and not exists (select 1 from _hff h where h.input = i.input);

  insert into _res
  select d.input, 'drug_product', null, s.id, null
  from _drug d
  join substance s on s.code = d.ingredient;

  -- ── 2. 사용자 집합 ──────────────────────────────────────────────────────
  create temp table _subs on commit drop as
    select distinct substance_id from _res where substance_id is not null;
  create temp table _classes on commit drop as
    select distinct class_id from _res where class_id is not null
    union
    select distinct m.class_id from substance_class_member m
    join _subs u on u.substance_id = m.substance_id;
  create temp table _chips on commit drop as
    select distinct intake_class_id from _res where intake_class_id is not null;
  create temp table _conds on commit drop as
    select distinct c.id as condition_id
    from condition c
    where c.name_ko = any (coalesce(p_conditions, '{}'))
       or (p_age is not null and c.name_ko = p_age);

  -- ── 3. 규칙 매칭 ────────────────────────────────────────────────────────
  create temp table _side_ok on commit drop as
  select s.rule_id, s.ordinal
  from interaction_rule_side s
  where (s.target_type = 'substance'       and s.target_id in (select substance_id from _subs))
     or (s.target_type = 'substance_class' and s.target_id in (select class_id from _classes))
     or (s.target_type = 'intake_class'    and s.target_id in (select intake_class_id from _chips))
     or (s.target_type = 'condition'       and s.target_id in (select condition_id from _conds));

  create temp table _hit on commit drop as
  select r.*
  from interaction_rule r
  where r.is_active
    and r.rule_kind in ('pair', 'set', 'standalone')
    and not exists (        -- 모든 항이 충족돼야 발화
      select 1 from interaction_rule_side s
      where s.rule_id = r.id
        and not exists (select 1 from _side_ok k where k.rule_id = s.rule_id and k.ordinal = s.ordinal))
    and exists (select 1 from interaction_rule_side s where s.rule_id = r.id)
    -- rule_condition: required = 조건 있어야, excluded = 조건 있으면 제외
    and not exists (
      select 1 from rule_condition rc
      where rc.rule_id = r.id and rc.effect = 'required'
        and rc.condition_id not in (select condition_id from _conds))
    and not exists (
      select 1 from rule_condition rc
      where rc.rule_id = r.id and rc.effect = 'excluded'
        and rc.condition_id in (select condition_id from _conds));

  -- ── 4. 결과 조립 ────────────────────────────────────────────────────────
  select jsonb_build_object(
    'resolved', coalesce((
       select jsonb_agg(jsonb_build_object(
         'input', t.input, 'via', t.via,
         'substance_ids', t.sids))
       from (select input, min(via) as via,
                    jsonb_agg(distinct substance_id) filter (where substance_id is not null) as sids
             from _res group by input) t), '[]'::jsonb),
    'unresolved', coalesce((
       select jsonb_agg(i.input) from _inp i
       where not exists (select 1 from _res r where r.input = i.input)), '[]'::jsonb),
    'unmapped', coalesce((
       select jsonb_agg(jsonb_build_object('product', h.product_name, 'ingredient', pi.name_raw))
       from _hff h
       join hff_product_ingredient pi on pi.product_id = h.product_id and pi.is_functional
       where not exists (
         select 1 from ingredient_substance_map m
         where m.name_raw = pi.name_raw and m.confidence in ('exact', 'likely'))), '[]'::jsonb),
    'findings', coalesce((
       select jsonb_agg(jsonb_build_object(
         'code', h.code,
         'severity', coalesce((   -- escalate/deescalate 조건이 걸려 있으면 덮어씀
             select rc.severity_override from rule_condition rc
             where rc.rule_id = h.id and rc.effect in ('escalate', 'deescalate')
               and rc.condition_id in (select condition_id from _conds)
               and rc.severity_override is not null
             limit 1), h.severity),
         'evidence_level', h.evidence_level,
         'relation_kind', h.relation_kind,
         'summary', h.summary_ko,
         'what_happens', h.what_happens_ko,
         'what_to_do', h.what_to_do_ko,
         'min_separation_hours', h.min_separation_hours,
         'stop_days_before', h.stop_days_before,
         'matched', (
            select coalesce(jsonb_agg(distinct r2.input), '[]'::jsonb)
            from interaction_rule_side s
            join _res r2 on
                 (s.target_type = 'substance'       and r2.substance_id = s.target_id)
              or (s.target_type = 'substance_class' and (r2.class_id = s.target_id or exists (
                     select 1 from substance_class_member m
                     where m.class_id = s.target_id and m.substance_id = r2.substance_id)))
              or (s.target_type = 'intake_class'    and r2.intake_class_id = s.target_id)
            where s.rule_id = h.id)
         ) order by array_position(
             array['contraindicated','caution','timing','monitor','info'], h.severity))
       from _hit h), '[]'::jsonb),
    'dur', coalesce((
       select jsonb_agg(distinct jsonb_build_object(
         'ingredient_a', c.ingredient_a, 'ingredient_b', c.ingredient_b,
         'reason', c.reason, 'notice_no', c.notice_no))
       from _drug a
       join _drug b on a.ingredient < b.ingredient
       join public.dur_contraindication c
         on c.ingredient_a = least(a.ingredient, b.ingredient)
        and c.ingredient_b = greatest(a.ingredient, b.ingredient)), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.quick_check_v1(text[], text, text[]) from public;
grant execute on function public.quick_check_v1(text[], text, text[]) to anon, authenticated;

-- 확인 예 (SQL Editor):
-- select jsonb_pretty(public.quick_check_v1(array['철분','갑상선약'], null, '{}'));
-- select jsonb_pretty(public.quick_check_v1(array['락토핏','항생제'], null, '{}'));
-- select jsonb_pretty(public.quick_check_v1(array['홍국'], null, array['임신·수유 중']));
