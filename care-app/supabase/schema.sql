create extension if not exists "pgcrypto";

create table patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  patient_code text unique not null,
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

alter table patients enable row level security;
alter table schedules enable row level security;
alter table intake_records enable row level security;
create policy anon_all on patients for all using (true) with check (true);
create policy anon_all on schedules for all using (true) with check (true);
create policy anon_all on intake_records for all using (true) with check (true);
