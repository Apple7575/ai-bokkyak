-- 건기식 적재 2단계 — 스테이징 → hff_product / hff_product_ingredient (2026-09-06)
-- 전제: 1단계 실행 + hff_stage 에 CSV Import 완료 (45,996행)
-- 두 번 실행해도 안전: 제품은 report_no 충돌 무시, 원재료는 제품별로 지우고 다시 만든다.

begin;

-- ① 제품 (report_no 없는 행은 식별 불가라 제외 — 있으면 개수 확인 쿼리에서 드러남)
insert into interaction.hff_product
  (report_no, name, manufacturer, main_function, caution_text, shelf_life, reported_on)
select distinct on (s.report_no)
  s.report_no,
  s.name,
  nullif(s.manufacturer, ''),
  nullif(s.main_function, ''),
  nullif(s.caution_text, ''),
  nullif(s.shelf_life, ''),
  to_date(nullif(s.reported_on, ''), 'YYYYMMDD')
from interaction.hff_stage s
where coalesce(s.report_no, '') <> '' and coalesce(s.name, '') <> ''
on conflict (report_no) do nothing;

-- ② 원재료 — 스테이징에 있는 제품 것만 지우고 다시 분해
--    쉼표 분해 전에 "1,000" 같은 천 단위 쉼표를 제거한다 (POSIX 정규식엔 lookaround 가 없어서).
delete from interaction.hff_product_ingredient i
using interaction.hff_product p, interaction.hff_stage s
where i.product_id = p.id and p.report_no = s.report_no;

insert into interaction.hff_product_ingredient (product_id, ordinal, name_raw, is_functional)
select
  p.id,
  row_number() over (partition by p.id order by u.is_functional desc, u.ord)::smallint,
  u.tok,
  u.is_functional
from interaction.hff_stage s
join interaction.hff_product p on p.report_no = s.report_no
cross join lateral (
  select trim(t.tok) as tok, true as is_functional, t.ord
  from regexp_split_to_table(
         regexp_replace(coalesce(s.indiv, ''), '(\d),(\d\d\d)', '\1\2', 'g'), ',')
       with ordinality as t(tok, ord)
  union all
  select trim(t.tok), false, t.ord + 1000
  from regexp_split_to_table(
         regexp_replace(coalesce(s.etc_raw, ''), '(\d),(\d\d\d)', '\1\2', 'g'), ',')
       with ordinality as t(tok, ord)
) u
where u.tok <> '';

commit;

-- ③ 확인 (각각 따로 실행)
-- select count(*) as 제품 from interaction.hff_product;                        -- 기대: ≈45,900+
-- select count(*) as 원재료행 from interaction.hff_product_ingredient;
-- select p.name, p.manufacturer, i.ordinal, i.name_raw, i.is_functional
--   from interaction.hff_product p
--   join interaction.hff_product_ingredient i on i.product_id = p.id
--  where p.name like '%락토핏%' order by p.id, i.ordinal limit 30;             -- 락토핏 시연
-- ④ 다 끝나면 스테이징 정리(선택): drop table interaction.hff_stage;
