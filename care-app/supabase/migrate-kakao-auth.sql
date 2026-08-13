-- 카카오 로그인 연결 (기존 무인증 구조를 깨지 않는 추가 방식)
--
-- 왜 이렇게 하나:
--   지금 앱은 인증 없이 6자리 patient_code로 동작하고, 알파 테스터들이 이미 쓰고 있다.
--   한 번에 인증 구조를 갈아타면 그분들의 약·기록이 끊긴다. 그래서 patients에
--   kakao_id를 "추가"만 하고, 기존 행은 null인 채로 그대로 둔다.
--
--   · 카카오로 로그인한 사람  → kakao_id로 자기 patients 행을 찾는다.
--                              기기를 바꿔도 약과 기록이 따라온다.
--   · 기존 테스터            → kakao_id가 null. 지금까지처럼 동작한다.
--
-- 왜 Supabase Auth(auth_user_id)가 아니라 kakao_id인가:
--   Supabase의 카카오 커넥터는 scope에 account_email을 하드코딩해 요청한다. 그 항목은
--   비즈 앱(사업자등록)이 없으면 켤 수 없어 카카오가 KOE205로 거부한다(실측 확인).
--   이메일을 쓰지 않는 서비스가 이메일 동의 때문에 막히는 건 맞지 않으므로,
--   엣지 함수(?op=kakao-login)에서 직접 토큰을 교환하고 회원번호만 저장한다.
--
-- RLS는 지금 단계에서 조이지 않는다. 무인증 사용자가 여전히 존재하므로
-- auth.uid() 기반 정책을 걸면 그분들이 자기 데이터를 못 읽는다.
-- 인증 전환이 끝난 뒤 별도 마이그레이션으로 처리한다.

alter table patients add column if not exists kakao_id text;

-- 한 카카오 계정이 여러 환자 행을 만들지 않게. (null은 제외되므로 기존 테스터 행이
-- 여러 개 null이어도 문제없다.)
create unique index if not exists patients_kakao_id_key
  on patients (kakao_id)
  where kakao_id is not null;
