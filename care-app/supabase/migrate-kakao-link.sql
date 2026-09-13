-- 카카오 "연결" RPC (2026-09-13)
--
-- 회의 2026-09-10: 카카오는 가입이 아니라 기기 이전용 연결이다. 앱은 이름 한 줄로 환자를 만들고,
-- 나중에 "카카오 연결하기"(더보기 계정 영역·알람 완료·홈 배너)로 patients.kakao_id 를 채운다.
-- 새 휴대폰에서는 kakao_id 로 환자를 되찾는다(앱 lib/kakaoAccount.ts restoreWithKakao).
--
-- 왜 RPC인가: migrate-rls-tier1.sql 이 anon 의 patients update 를 막는다. 그래서 update 한 줄을
-- security definer 함수로 감쌌다. 함수 안에서만 세 가지를 검사한다.
--   not_found      그 환자가 없다
--   already_linked 이 환자는 이미 다른 카카오 계정에 묶여 있다(같은 계정이면 그냥 ok)
--   taken          이 카카오 계정은 이미 다른 환자에 묶여 있다 → 앱은 "카카오로 불러오기"를 안내
--
-- 적용: Supabase 대시보드 → SQL Editor 에서 이 파일 전체를 실행한다.
-- 실행하기 전까지 앱의 "카카오 연결하기"는 rpc 에러를 받아 "인터넷 연결을 확인…" 문구로 끝난다(죽지 않는다).

create or replace function public.link_kakao(p_patient_id uuid, p_kakao_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_other uuid; v_current text;
begin
  select kakao_id into v_current from patients where id = p_patient_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_current is not null and v_current <> p_kakao_id then return jsonb_build_object('ok', false, 'reason', 'already_linked'); end if;
  select id into v_other from patients where kakao_id = p_kakao_id and id <> p_patient_id;
  if found then return jsonb_build_object('ok', false, 'reason', 'taken'); end if;
  update patients set kakao_id = p_kakao_id where id = p_patient_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.link_kakao(uuid, text) from public;
grant execute on function public.link_kakao(uuid, text) to anon, authenticated;
