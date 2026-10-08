-- 간편 로그인(Supabase Auth) 1단계 — 더하기만 한다 (2026-10-08)
--
-- 배경: 회의 2026-10-08로 로그인은 Supabase Auth 간편 로그인(카카오, iOS는 Apple도)만 쓴다.
--       새 앱은 로그인한 계정(auth.users) 하나에 환자 행(patients) 하나를 묶고(user_id),
--       처음 로그인 때 받은 동의를 patients.consent 에 남긴다. 서버가 사용자를 구분할 수 있게 됐으니
--       이제 RLS로 "내 행만"을 걸 수 있다(migrate-rls-tier1.sql 머리말의 3단계).
--       카카오 계정은 Supabase의 카카오 로그인이 아니라 엣지 함수 ?op=kakao-session 이 만든다(2026-10-09 —
--       비즈 앱이 아니라 account_email 을 요청할 수 없다). 그래서 카카오 계정도 auth.users 의 provider 는 "email"
--       (가짜 주소, 메일은 보내지 않음)이고 raw_app_meta_data 의 login = 'kakao', kakao_id 로 구분한다.
--       아래 정책·함수는 로그인 수단을 보지 않고 auth.uid() 만 보므로 이 방식과 상관없이 그대로 맞다.
--       그 엣지 함수는 옛 빌드에서 카카오를 연결해 둔 환자 행(patients.kakao_id, user_id null)을 service role 로
--       그 계정에 묶어 준다(user_id 칸이 없으면 건너뛴다) — 이 파일을 먼저 실행해 두면 테스터의 기록이 이어진다.
--
-- 이 파일은 지금 바로 실행해도 안전하다 — 옛 빌드를 깨지 않는다.
--   · 컬럼은 더하기만 한다(user_id·consent 둘 다 null 허용). 옛 빌드의 insert 는 그대로 된다.
--   · 정책은 role authenticated 에만 새로 건다. anon(옛 빌드)의 정책
--     (schema.sql 의 anon_all, migrate-rls-tier1.sql 의 *_select/_insert/... 등)은 손대지 않는다.
--     → 옛 빌드는 지금처럼 동작한다.
--   · 주의: 옛 정책은 대상 role을 적지 않아(PUBLIC) authenticated 에도 걸린다. 정책은 OR 로 합쳐지므로
--     이 파일만으로는 로그인한 사용자도 남의 행을 읽을 수 있다. 그래서 앱은 user_id·patient_id 조건을
--     직접 건다(lib/account.ts findMyPatient 등). 실제로 닫는 것은 2단계(migrate-auth-2-lockdown.sql) —
--     새 빌드 출시일에 실행한다.
--
-- 새 앱이 role authenticated 로 하는 동작 (care-app/src 전수 조사, 2026-10-08):
--   patients            select · insert(동의 화면) · (update·delete는 안 쓰지만 본인 행만 열어 둔다)
--   schedules           select · insert · update(비활성화)                  → 본인 환자 행만, 4동작 모두
--   intake_records      select · upsert(insert+update) · delete(되돌리기)    → 본인 환자 행만, 4동작 모두
--   alarm_events        insert만
--   voice_guide_events  insert만 — patient_id 가 없는 익명 지표라 행 조건 없이 insert 만 연다
--   quick_check_results insert · select(더보기 → 지난 복용 점검)
--   delete_my_account() 계정 삭제(아래)
--
-- 계정 삭제: delete_my_account() 가 auth.users 의 내 행을 지운다. patients.user_id 가
-- on delete cascade 이고, schema.sql 기준으로 schedules·intake_records·alarm_events·quick_check_results 의
-- patient_id(와 intake_records·alarm_events 의 schedule_id)도 모두 on delete cascade 라 함께 지워진다.
-- 함수 안에서 patients 를 먼저 지워 둔다 — 컬럼이 예전에 다른 제약으로 만들어졌어도 데이터가 남지 않게.
-- (voice_guide_events 는 사람과 이어지지 않는 익명 지표라 지울 것이 없다.)
--
-- 두 번 실행해도 안전(if not exists / drop policy if exists). Supabase SQL Editor 에 그대로 붙여 넣는다.

-- ── patients: 로그인 계정 · 동의 ──────────────────────────────────────────
alter table public.patients
  add column if not exists user_id uuid unique references auth.users(id) on delete cascade;
alter table public.patients
  add column if not exists consent jsonb;   -- { version, terms, privacy, sensitive, agreedAt } (lib/account.ts Consent)

-- ── patients: 본인 행만 (authenticated) ──────────────────────────────────
grant select, insert, update, delete on public.patients to authenticated;
drop policy if exists auth_patients_select on public.patients;
create policy auth_patients_select on public.patients for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists auth_patients_insert on public.patients;
create policy auth_patients_insert on public.patients for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists auth_patients_update on public.patients;
create policy auth_patients_update on public.patients for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists auth_patients_delete on public.patients;
create policy auth_patients_delete on public.patients for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── schedules: 내 환자의 행만 ─────────────────────────────────────────────
grant select, insert, update, delete on public.schedules to authenticated;
drop policy if exists auth_schedules_select on public.schedules;
create policy auth_schedules_select on public.schedules for select to authenticated
  using (patient_id in (select id from public.patients where user_id = (select auth.uid())));
drop policy if exists auth_schedules_insert on public.schedules;
create policy auth_schedules_insert on public.schedules for insert to authenticated
  with check (patient_id in (select id from public.patients where user_id = (select auth.uid())));
drop policy if exists auth_schedules_update on public.schedules;
create policy auth_schedules_update on public.schedules for update to authenticated
  using (patient_id in (select id from public.patients where user_id = (select auth.uid())))
  with check (patient_id in (select id from public.patients where user_id = (select auth.uid())));
drop policy if exists auth_schedules_delete on public.schedules;
create policy auth_schedules_delete on public.schedules for delete to authenticated
  using (patient_id in (select id from public.patients where user_id = (select auth.uid())));

-- ── intake_records: 내 환자의 행만 (upsert = insert + update, 되돌리기 = delete) ──
grant select, insert, update, delete on public.intake_records to authenticated;
drop policy if exists auth_intake_select on public.intake_records;
create policy auth_intake_select on public.intake_records for select to authenticated
  using (patient_id in (select id from public.patients where user_id = (select auth.uid())));
drop policy if exists auth_intake_insert on public.intake_records;
create policy auth_intake_insert on public.intake_records for insert to authenticated
  with check (patient_id in (select id from public.patients where user_id = (select auth.uid())));
drop policy if exists auth_intake_update on public.intake_records;
create policy auth_intake_update on public.intake_records for update to authenticated
  using (patient_id in (select id from public.patients where user_id = (select auth.uid())))
  with check (patient_id in (select id from public.patients where user_id = (select auth.uid())));
drop policy if exists auth_intake_delete on public.intake_records;
create policy auth_intake_delete on public.intake_records for delete to authenticated
  using (patient_id in (select id from public.patients where user_id = (select auth.uid())));

-- ── alarm_events: insert만, 내 환자 것만 ──────────────────────────────────
grant insert on public.alarm_events to authenticated;
drop policy if exists auth_alarm_events_insert on public.alarm_events;
create policy auth_alarm_events_insert on public.alarm_events for insert to authenticated
  with check (patient_id in (select id from public.patients where user_id = (select auth.uid())));

-- ── quick_check_results: insert · select(지난 복용 점검), 내 환자 것만 ────────
grant select, insert on public.quick_check_results to authenticated;
drop policy if exists auth_quick_check_results_select on public.quick_check_results;
create policy auth_quick_check_results_select on public.quick_check_results for select to authenticated
  using (patient_id in (select id from public.patients where user_id = (select auth.uid())));
drop policy if exists auth_quick_check_results_insert on public.quick_check_results;
create policy auth_quick_check_results_insert on public.quick_check_results for insert to authenticated
  with check (patient_id in (select id from public.patients where user_id = (select auth.uid())));

-- ── voice_guide_events: 익명 지표(patient_id 없음) — 로그인한 사용자에게 insert만 ──
-- (migrate-voice-guide-events.sql 을 돌리지 않은 프로젝트에서도 이 파일이 멈추지 않게 테이블이 있을 때만)
do $$ begin
  if to_regclass('public.voice_guide_events') is not null then
    execute 'grant insert on public.voice_guide_events to authenticated';
    execute 'drop policy if exists auth_voice_guide_events_insert on public.voice_guide_events';
    execute 'create policy auth_voice_guide_events_insert on public.voice_guide_events for insert to authenticated with check (true)';
  end if;
end $$;

-- ── 계정 삭제 (App Store 5.1.1(v)) ────────────────────────────────────────
-- security definer: 사용자는 auth.users 를 직접 지울 수 없다. 함수 안에서 auth.uid() 의 행만 지운다.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  -- 환자 행부터 — 일정·기록·알람 로그·점검 결과가 patient_id cascade 로 함께 지워진다.
  delete from public.patients where user_id = v_uid;
  -- 로그인 계정 — identities·sessions·refresh tokens 는 auth 스키마의 cascade 로 함께 지워진다.
  delete from auth.users where id = v_uid;
end $$;
-- Supabase는 새 함수에 anon·authenticated 실행 권한을 기본으로 준다 — anon 은 명시적으로 뺀다.
revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

-- ── 확인 쿼리 (실행 후 붙여 보기) ─────────────────────────────────────────
-- 1) 새 컬럼
-- select column_name, data_type, is_nullable from information_schema.columns
--  where table_schema='public' and table_name='patients' and column_name in ('user_id','consent');
-- 2) authenticated 정책 — 위 테이블마다 auth_* 정책이 {authenticated} 로 보여야 한다(옛 정책도 그대로 남아 있다)
-- select tablename, policyname, roles, cmd from pg_policies where schemaname='public' order by 1, 2;
-- 3) 자식 테이블이 patients 를 cascade 로 참조하는지 — confdeltype 'c' = cascade
-- select conrelid::regclass as child, conname, confdeltype from pg_constraint
--  where contype='f' and confrelid='public.patients'::regclass;
-- select conrelid::regclass as child, conname, confdeltype from pg_constraint
--  where contype='f' and confrelid='auth.users'::regclass and conrelid='public.patients'::regclass;
-- 4) 계정 삭제 함수 권한 — anon false, authenticated true
-- select has_function_privilege('anon', 'public.delete_my_account()', 'execute'),
--        has_function_privilege('authenticated', 'public.delete_my_account()', 'execute');
