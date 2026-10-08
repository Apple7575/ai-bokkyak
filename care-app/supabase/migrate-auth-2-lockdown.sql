-- 간편 로그인(Supabase Auth) 2단계 — 잠그기 (새 빌드 출시일에 실행)
--
-- ⚠️ 이 파일을 실행하는 순간 옛 앱 빌드(로그인 없이 anon 키로 쓰던 버전)는 전부 멈춘다.
--    옛 빌드는 환자·일정·기록을 anon 으로 읽고 쓰는데, 아래에서 그 정책을 모두 지운다.
--    알람 화면·홈·약장·기록이 빈 화면이나 오류가 된다. 반드시 아래 순서를 지킬 것:
--      1) migrate-auth-1-additive.sql 이 이미 적용돼 있다(authenticated 정책·delete_my_account).
--      2) 로그인이 들어간 새 빌드가 스토어 심사를 통과해 배포됐다(가능하면 강제 업데이트 안내까지).
--      3) 그다음 이 파일을 실행한다.
--
-- 하는 일: 환자 데이터 테이블에서 anon(=PUBLIC) 정책을 지우고 anon 의 테이블 권한을 거둔다.
--          남는 것은 1단계의 auth_* 정책(role authenticated, 본인 행만)뿐이다.
-- 지우는 정책 (이름은 schema.sql · migrate-rls-tier1.sql · migrate-alarm-events.sql ·
--             migrate-quick-check.sql · migrate-voice-guide-events.sql 에서 모았다):
--   patients            anon_all · patients_select · patients_insert · patients_delete
--   schedules           anon_all · schedules_select · schedules_insert · schedules_update · schedules_delete
--   intake_records      anon_all · intake_select · intake_insert · intake_update · intake_delete
--   alarm_events        anon_all · alarm_events_insert
--   quick_check_results anon_all · quick_check_results_insert
--   voice_guide_events  anon_all · voice_guide_events_insert
--   그리고 옛 카카오 연결 RPC link_kakao(migrate-kakao-link.sql)의 실행 권한(새 앱은 부르지 않는다).
-- 그대로 두는 것 (로그인 전에도 쓰는 공개 자료):
--   drug_product · dur_product_ingredient · dur_contraindication 의 읽기 정책(anon_read / *_select)
--   1분 점검 판정 RPC quick_check_v1 의 anon 실행 권한 — 점검은 로그인 없이 된다.
--
-- 두 번 실행해도 안전(if exists). 되돌리기는 맨 아래.

-- ── patients ──────────────────────────────────────────────────────────────
drop policy if exists anon_all on public.patients;
drop policy if exists patients_select on public.patients;
drop policy if exists patients_insert on public.patients;
drop policy if exists patients_delete on public.patients;
revoke all on public.patients from anon;

-- ── schedules ─────────────────────────────────────────────────────────────
drop policy if exists anon_all on public.schedules;
drop policy if exists schedules_select on public.schedules;
drop policy if exists schedules_insert on public.schedules;
drop policy if exists schedules_update on public.schedules;
drop policy if exists schedules_delete on public.schedules;
revoke all on public.schedules from anon;

-- ── intake_records ────────────────────────────────────────────────────────
drop policy if exists anon_all on public.intake_records;
drop policy if exists intake_select on public.intake_records;
drop policy if exists intake_insert on public.intake_records;
drop policy if exists intake_update on public.intake_records;
drop policy if exists intake_delete on public.intake_records;
revoke all on public.intake_records from anon;

-- ── alarm_events ──────────────────────────────────────────────────────────
drop policy if exists anon_all on public.alarm_events;
drop policy if exists alarm_events_insert on public.alarm_events;
revoke all on public.alarm_events from anon;

-- ── quick_check_results ───────────────────────────────────────────────────
drop policy if exists anon_all on public.quick_check_results;
drop policy if exists quick_check_results_insert on public.quick_check_results;
revoke all on public.quick_check_results from anon;

-- ── voice_guide_events (테이블이 있을 때만) ───────────────────────────────
do $$ begin
  if to_regclass('public.voice_guide_events') is not null then
    execute 'drop policy if exists anon_all on public.voice_guide_events';
    execute 'drop policy if exists voice_guide_events_insert on public.voice_guide_events';
    execute 'revoke all on public.voice_guide_events from anon';
  end if;
end $$;

-- ── 옛 카카오 연결 RPC (함수가 있을 때만) ─────────────────────────────────
do $$ begin
  if to_regprocedure('public.link_kakao(uuid, text)') is not null then
    execute 'revoke execute on function public.link_kakao(uuid, text) from anon, authenticated';
  end if;
end $$;

-- ── 확인 쿼리 (실행 후 붙여 보기) ─────────────────────────────────────────
-- 1) 환자 데이터 테이블에는 {authenticated} 의 auth_* 정책만 남아야 한다. 약 자료 3개는 select 정책 그대로.
-- select tablename, policyname, roles, cmd from pg_policies where schemaname='public' order by 1, 2;
-- 2) anon 은 환자 데이터를 못 읽는다 — 모두 false
-- select has_table_privilege('anon', 'public.patients', 'select'),
--        has_table_privilege('anon', 'public.schedules', 'select'),
--        has_table_privilege('anon', 'public.intake_records', 'select'),
--        has_table_privilege('anon', 'public.quick_check_results', 'select');
-- 3) 공개 자료는 그대로 — 모두 true
-- select has_table_privilege('anon', 'public.drug_product', 'select'),
--        has_function_privilege('anon', 'public.quick_check_v1(text[], text, text[])', 'execute');
-- 4) RLS 가 켜져 있는지 — relrowsecurity 모두 true
-- select relname, relrowsecurity from pg_class
--  where relname in ('patients','schedules','intake_records','alarm_events','quick_check_results','voice_guide_events');
-- 5) 로그인하지 않은 상태로(anon 키만) 앱의 REST 요청을 흉내 내 보면 빈 배열이나 401/permission denied 가 와야 한다:
--    curl "$SUPABASE_URL/rest/v1/patients?select=id&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"

-- ── 되돌리기 (옛 빌드를 다시 살려야 할 때) ────────────────────────────────
-- grant select, insert, update, delete on public.patients, public.schedules, public.intake_records,
--   public.alarm_events, public.quick_check_results to anon;
-- grant insert on public.voice_guide_events to anon;
-- grant execute on function public.link_kakao(uuid, text) to anon, authenticated;
-- 그리고 migrate-rls-tier1.sql 을 다시 실행한다(옛 anon 정책을 같은 이름으로 다시 만든다).
-- voice_guide_events 의 insert 정책은 tier1 에 들어 있다.
