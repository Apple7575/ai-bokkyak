-- 음성 가이드 온보딩 지표 (음성 대본 문서 §7).
--
-- 알파 테스트에서 어르신이 "어디서 막히는가"를 보려면 단계별 완료율과
-- 폴백 비율이 필요하다. 개인 식별 정보는 담지 않는다 — 발화 내용도 저장하지 않는다.
create table if not exists voice_guide_events (
  id uuid primary key default gen_random_uuid(),
  step text not null,                       -- 'done' | 'skipped'
  no_reply_count int not null default 0,    -- 무응답 5초 발생 횟수
  fail_count int not null default 0,        -- 인식 실패 횟수
  button_fallback_count int not null default 0, -- 음성 대신 버튼으로 넘어간 횟수
  created_at timestamptz not null default now()
);
create index if not exists voice_guide_events_time_idx on voice_guide_events (created_at);

alter table voice_guide_events enable row level security;
do $$ begin
  create policy anon_all on voice_guide_events for all using (true) with check (true);
exception when duplicate_object then null;
end $$;
