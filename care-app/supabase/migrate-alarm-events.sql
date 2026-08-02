-- 알파 테스트 지표용 알람 이벤트 로그.
-- intake_records(순응도 원장)와 분리된 append-only 로그. 알람이 실제 발생한 시각과
-- 사용자 응답(완료/미루기/건너뛰기) 이벤트를 시각과 함께 남긴다.
--   · 알람 정확도  = scheduled_for(예정) vs 'fired' event_at(발생)
--   · 반응 시간    = 'fired' event_at → 응답 event_at
--   · 복약 행동    = event_type 분포
--   · 미응답       = 'fired' 있으나 뒤따르는 응답 이벤트 없음
create table if not exists alarm_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  schedule_id uuid not null references schedules(id) on delete cascade,
  scheduled_for timestamptz not null,               -- 이 발생 슬롯의 예정 시각
  event_type text not null,                          -- 'fired' | 'completed' | 'snoozed' | 'skipped'
  method text,                                       -- 응답 방식(음성/버튼) — 응답 이벤트만
  event_at timestamptz not null default now(),       -- 실제 발생/응답 시각
  created_at timestamptz not null default now()
);

create index if not exists alarm_events_patient_time_idx on alarm_events (patient_id, event_at);
create index if not exists alarm_events_slot_idx on alarm_events (schedule_id, scheduled_for);

alter table alarm_events enable row level security;
do $$ begin
  create policy anon_all on alarm_events for all using (true) with check (true);
exception when duplicate_object then null;
end $$;
