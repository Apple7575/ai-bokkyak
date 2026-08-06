-- 의약품 참조 데이터 (공공데이터 기반, 읽기 전용)
--
-- 세 테이블의 역할이 다르다:
--   drug_product           약 이름으로 검색해 등록할 때 쓰는 제품 목록 (심평원 ATC 매핑)
--   dur_product_ingredient 제품 → 성분. 병용금기 조회의 진입점 (DUR 원본에서 추출)
--   dur_contraindication   성분 쌍 금기 규칙 (DUR 87만 행 → 1,706건으로 축약)
--
-- 왜 제품→성분을 DUR에서 뽑았나:
--   ATC의 "ATC코드 명칭"은 성분명이 아니라 분류명이라("other hypnotics and
--   sedatives") 이름으로 이으면 41%가 유실된다. DUR 원본은 제품코드와 성분명이
--   같은 행에 있어 어휘가 정확히 맞고, DUR에 없는 제품은 애초에 병용금기 규칙이
--   없으므로 금기 조회 목적으로는 이것으로 충분하다.
--
-- 조회 흐름:
--   사용자 약 → dur_product_ingredient 로 성분 목록
--            → 성분 2개 조합마다 dur_contraindication 조회
--            → 걸리면 reason + notice_no(고시번호)를 근거로 함께 표시
--
-- 생성 방법: node scripts/prepare-drug-data.mjs <ATC.csv> <DUR.csv>
--            → supabase/seed/*.csv → scripts/load-drug-data.mjs

-- 약 이름 부분검색(어르신이 "혈압"만 입력해도 찾히게)을 위한 트라이그램 인덱스.
create extension if not exists pg_trgm;

create table if not exists drug_product (
  product_code         text primary key,
  product_name         text not null,
  company              text,
  atc_code             text,
  atc_name             text,     -- 분류명일 수 있다. 성분으로 쓰지 말 것.
  category_code        text,     -- 식약분류
  main_ingredient_code text
);
create index if not exists drug_product_name_trgm_idx
  on drug_product using gin (product_name gin_trgm_ops);

create table if not exists dur_product_ingredient (
  product_code text not null,
  product_name text,
  ingredient   text not null,    -- 정규화된 성분명(소문자, 염 표기 제거)
  primary key (product_code, ingredient)
);
create index if not exists dur_pi_ingredient_idx on dur_product_ingredient (ingredient);
create index if not exists dur_pi_name_trgm_idx
  on dur_product_ingredient using gin (product_name gin_trgm_ops);

create table if not exists dur_contraindication (
  ingredient_a text not null,    -- 항상 ingredient_a < ingredient_b (사전순)
  ingredient_b text not null,    -- 덕분에 양방향 조회를 한 행으로 처리한다
  reason       text,             -- 상세정보 — 사용자에게 보여줄 이유
  notice_no    text,             -- 고시번호 — 근거 표시용
  product_rows int,              -- 원본에서 이 규칙이 몇 개 제품쌍으로 풀려 있었나
  primary key (ingredient_a, ingredient_b)
);

-- 참조 데이터는 앱이 읽기만 한다. 기존 사용자 테이블(anon_all)과 달리
-- 쓰기를 허용하지 않는다 — 클라이언트 키가 노출된 구조에서 공용 데이터가
-- 훼손되면 모든 사용자가 잘못된 금기 정보를 보게 된다.
alter table drug_product enable row level security;
alter table dur_product_ingredient enable row level security;
alter table dur_contraindication enable row level security;

do $$ begin
  create policy anon_read on drug_product for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy anon_read on dur_product_ingredient for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy anon_read on dur_contraindication for select using (true);
exception when duplicate_object then null; end $$;
