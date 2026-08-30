-- RLS 1단계 — 앱을 깨지 않는 범위에서 anon 권한을 줄인다 (2026-08-30)
--
-- 배경: 모든 public 테이블이 `anon_all for all using(true) with check(true)` 라
--       anon 키 하나로 환자 정보를 읽고·고치고·지울 수 있다(상호작용DB-v1 검토요청 Q5).
--       인증이 없어 "본인 행만" 같은 조건은 아직 걸 수 없다. 그래서 이 파일은
--       앱이 실제로 쓰지 않는 동작(SELECT/UPDATE/DELETE)을 테이블별로 끊는 것까지만 한다.
--
-- 앱이 쓰는 동작 (care-app/src 전수 조사, 2026-08-30):
--   patients            select · insert · delete(PrivacyScreen 본인 삭제)      → update 차단
--   schedules           select · insert · update · delete                      → 그대로
--   intake_records      select · upsert(insert+update) · delete(되돌리기)       → 그대로
--   alarm_events        insert만                                               → select/update/delete 차단
--   voice_guide_events  insert만                                               → select/update/delete 차단
--   quick_check_results insert만                                               → select/update/delete 차단
--   drug_product · dur_product_ingredient · dur_contraindication  select만     → 쓰기 전부 차단
--
-- 효과: anon 키로 지표 테이블을 읽거나 지우는 것, 약 자료를 바꾸는 것, 환자 행을 고치는 것이 막힌다.
-- 한계: patients/schedules/intake_records 의 열람·삭제는 여전히 열려 있다 — 앱이 그 동작을 쓰기 때문.
--       이건 2단계(RPC 감싸기, 앱 배포 필요) 또는 3단계(Supabase Auth)에서 닫는다. 아래 참고.
--
-- 두 번 실행해도 안전(if exists / do 블록). Supabase SQL Editor에 그대로 붙여 넣는다.
-- 이 파일을 실행하기 전에 지표를 anon 키로 읽는 외부 대시보드가 없는지 확인할 것(있다면 service_role로 바꾼다).

-- ── patients: update 차단 ─────────────────────────────────────────────
drop policy if exists anon_all on patients;
do $$ begin
  create policy patients_select on patients for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy patients_insert on patients for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy patients_delete on patients for delete using (true);
exception when duplicate_object then null; end $$;

-- ── schedules · intake_records: 앱이 4동작 모두 쓴다 — 현상 유지(명시적으로 분리만) ──
drop policy if exists anon_all on schedules;
do $$ begin create policy schedules_select on schedules for select using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy schedules_insert on schedules for insert with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy schedules_update on schedules for update using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy schedules_delete on schedules for delete using (true); exception when duplicate_object then null; end $$;

drop policy if exists anon_all on intake_records;
do $$ begin create policy intake_select on intake_records for select using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy intake_insert on intake_records for insert with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy intake_update on intake_records for update using (true) with check (true); exception when duplicate_object then null; end $$;  -- upsert 충돌 갱신
do $$ begin create policy intake_delete on intake_records for delete using (true); exception when duplicate_object then null; end $$;   -- 완료 되돌리기

-- ── 지표·결과 테이블: insert만 ─────────────────────────────────────────
drop policy if exists anon_all on alarm_events;
do $$ begin create policy alarm_events_insert on alarm_events for insert with check (true); exception when duplicate_object then null; end $$;

drop policy if exists anon_all on voice_guide_events;
do $$ begin create policy voice_guide_events_insert on voice_guide_events for insert with check (true); exception when duplicate_object then null; end $$;

drop policy if exists anon_all on quick_check_results;
do $$ begin create policy quick_check_results_insert on quick_check_results for insert with check (true); exception when duplicate_object then null; end $$;

-- ── 약 자료: 읽기 전용 ───────────────────────────────────────────────
-- (이 테이블들은 migrate-drug-data.sql 에서 RLS 없이 만들었을 수 있다 → 켜고 select만 허용)
alter table if exists drug_product enable row level security;
alter table if exists dur_product_ingredient enable row level security;
alter table if exists dur_contraindication enable row level security;
drop policy if exists anon_all on drug_product;
drop policy if exists anon_all on dur_product_ingredient;
drop policy if exists anon_all on dur_contraindication;
do $$ begin create policy drug_product_select on drug_product for select using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy dur_pi_select on dur_product_ingredient for select using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy dur_ci_select on dur_contraindication for select using (true); exception when duplicate_object then null; end $$;

-- ── 확인 쿼리 (실행 후 붙여 보기) ─────────────────────────────────────
-- select tablename, policyname, cmd from pg_policies where schemaname='public' order by 1,3;
-- 기대: patients(select/insert/delete) · schedules/intake_records(4개) · 이벤트 3개(insert) · 약 자료 3개(select)

-- ── 2단계 스케치 (앱 배포와 함께) ─────────────────────────────────────
-- patients 의 select 를 끊고 RPC 로 감싼다. anon 은 id(uuid) 나 kakao_id 를 알아야만 한 행을 얻는다.
--   create function get_patient(p_id uuid) returns setof patients language sql security definer as
--     $$ select * from patients where id = p_id $$;
--   create function find_patient_by_kakao(p_kakao_id text) returns setof patients language sql security definer as
--     $$ select * from patients where kakao_id = p_kakao_id $$;
--   revoke select on patients from anon;  drop policy patients_select on patients;
-- 앱: supabase.from("patients").select("*").eq("id", pid)  →  supabase.rpc("get_patient", { p_id: pid })
-- schedules/intake_records 도 같은 방식으로 patient_id 를 받는 RPC 로 바꾸면 전수 열람이 막힌다.
-- 3단계는 Supabase Auth(카카오 OIDC) + `auth.uid() = patient_id` 정책 — 근본 해법.
