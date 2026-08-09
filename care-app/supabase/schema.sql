create extension if not exists "pgcrypto";

create table patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  patient_code text unique not null,
  gender text,
  birth_date date,
  region text,
  phone text,
  created_at timestamptz not null default now()
);

create table schedules (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  medicine_name text not null,
  time_of_day text not null,
  hour int not null check (hour between 0 and 23),
  minute int not null default 0 check (minute between 0 and 59),
  repeat_days int[] not null default '{}',
  active boolean not null default true,
  dose_amount text,                       -- 1회 복용량 표시 문자열("1정"/"1포")
  created_at timestamptz not null default now()
);

create table intake_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  schedule_id uuid not null references schedules(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null,
  response_method text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (schedule_id, scheduled_for)
);

-- 알파 테스트 지표용 알람 이벤트 로그 (자세한 설명은 migrate-alarm-events.sql).
create table alarm_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  schedule_id uuid not null references schedules(id) on delete cascade,
  scheduled_for timestamptz not null,
  event_type text not null,               -- 'fired' | 'completed' | 'snoozed' | 'skipped'
  method text,                            -- 응답 방식(음성/버튼) — 응답 이벤트만
  event_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index alarm_events_patient_time_idx on alarm_events (patient_id, event_at);
create index alarm_events_slot_idx on alarm_events (schedule_id, scheduled_for);

alter table patients enable row level security;
alter table schedules enable row level security;
alter table intake_records enable row level security;
alter table alarm_events enable row level security;
create policy anon_all on patients for all using (true) with check (true);
create policy anon_all on schedules for all using (true) with check (true);
create policy anon_all on intake_records for all using (true) with check (true);
create policy anon_all on alarm_events for all using (true) with check (true);
