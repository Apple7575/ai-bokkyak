-- 회원가입 전화번호(선택) 저장용 컬럼. Supabase SQL Editor에서 1회 실행.
alter table patients add column if not exists phone text;
