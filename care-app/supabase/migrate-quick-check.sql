-- "1분 복용 점검" 결과 보관.
-- 가입 전에 기기에서 돌린 DUR 병용금기 점검 초안을, 가입 직후 환자에 묶어 한 줄로 남긴다.
--   items    : { supplements: string[], medicines: string[], names: string[] }
--   findings : interactions.ts 의 Finding[] (medA, medB, ingredientA, ingredientB, reason, notice_no)
create table if not exists quick_check_results (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  items jsonb not null,
  findings jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists quick_check_results_patient_idx on quick_check_results (patient_id, created_at);

alter table quick_check_results enable row level security;
do $$ begin
  create policy anon_all on quick_check_results for all using (true) with check (true);
exception when duplicate_object then null;
end $$;
