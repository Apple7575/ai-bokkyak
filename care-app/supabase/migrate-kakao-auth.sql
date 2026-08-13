-- 카카오 로그인 연결 (기존 무인증 구조를 깨지 않는 추가 방식)
--
-- 왜 이렇게 하나:
--   지금 앱은 인증 없이 6자리 patient_code로 동작하고, 알파 테스터들이 이미 쓰고 있다.
--   Supabase Auth로 한 번에 갈아타면 그분들의 약·기록이 끊긴다. 그래서 patients에
--   auth_user_id를 "추가"만 하고, 기존 행은 null인 채로 그대로 둔다.
--
--   · 카카오로 로그인한 사람  → auth_user_id로 자기 patients 행을 찾는다.
--                              기기를 바꿔도 약과 기록이 따라온다.
--   · 기존 테스터            → auth_user_id가 null. 지금까지처럼 동작한다.
--                              나중에 카카오 로그인하면 그때 연결하면 된다.
--
-- RLS는 지금 단계에서 조이지 않는다. 무인증 사용자가 여전히 존재하므로,
-- 여기서 auth.uid() 기반 정책을 걸면 그분들이 자기 데이터를 못 읽게 된다.
-- 인증 전환이 끝난 뒤 별도 마이그레이션으로 처리한다.

alter table patients add column if not exists auth_user_id uuid;

-- 한 계정이 여러 환자 행을 만들지 않게. (null은 unique 제약에서 제외되므로
-- 기존 테스터 행이 여러 개 null이어도 문제없다.)
create unique index if not exists patients_auth_user_id_key
  on patients (auth_user_id)
  where auth_user_id is not null;
