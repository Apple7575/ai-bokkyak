-- 성분 별칭 보강 (2026-10-03): 식약처 표준 표기와 다른 흔한 표기·대표 상품명을 aliases 에 추가
-- 예) 식약처 '설트랄린' ↔ 흔히 '세르트랄린'. RPC v3.1 은 aliases 로도 찾는다. 두 번 실행해도 안전.
create temp table _alias (code text, alias text);
insert into _alias (code, alias) values
  ('sertraline','세르트랄린'), ('sertraline','졸로프트'),
  ('escitalopram','에스시탈로프람'), ('escitalopram','렉사프로'),
  ('fluoxetine','푸로작'), ('paroxetine','팍실'), ('paroxetine','세로자트'),
  ('esomeprazole','에스오메프라졸'), ('esomeprazole','넥시움'),
  ('omeprazole','오메프라졸'), ('lansoprazole','란소프라졸'), ('pantoprazole','판토프라졸'), ('rabeprazole','라베프라졸'),
  ('acetaminophen','타이레놀'), ('acetaminophen','아세트아미노펜'), ('acetaminophen','파라세타몰'),
  ('ibuprofen','부루펜'), ('ibuprofen','애드빌'),
  ('aspirin','아스피린프로텍트'), ('clopidogrel','플라빅스'),
  ('atorvastatin','리피토'), ('rosuvastatin','크레스토'), ('simvastatin','심바스타틴'),
  ('amlodipine','노바스크'), ('losartan','코자'), ('valsartan','디오반'), ('telmisartan','미카르디스'),
  ('metformin','메트포르민'), ('metformin','글루코파지'), ('glimepiride','아마릴'), ('sitagliptin','자누비아'),
  ('levothyroxine','씬지로이드'), ('levothyroxine','레보티록신'),
  ('warfarin','와파린'), ('warfarin','쿠마딘'),
  ('alprazolam','자낙스'), ('zolpidem','스틸녹스'), ('zolpidem','졸피뎀'),
  ('loratadine','클라리틴'), ('cetirizine','지르텍'), ('fexofenadine','알레그라'),
  ('tamsulosin','하루날'), ('finasteride','프로페시아'), ('dutasteride','아보다트'),
  ('donepezil','아리셉트'), ('memantine','에빅사'),
  ('tramadol','트라마돌'), ('celecoxib','쎄레브렉스'), ('naproxen','낙센'),
  ('amoxicillin','아목시실린'), ('azithromycin','지스로맥스'), ('ciprofloxacin','씨프로'),
  ('prednisolone','프레드니솔론'), ('dexamethasone','덱사메타손');

-- 없는 code 는 건너뛰고, 이미 있는 별칭·name_ko 와 같은 것은 중복 추가하지 않는다
update interaction.substance s
set aliases = (
  select array_agg(distinct a) from unnest(coalesce(s.aliases, '{}'::text[]) || x.arr) as a
)
from (select code, array_agg(alias) as arr from _alias group by code) x
where s.code = x.code
  and not (x.arr <@ coalesce(s.aliases, '{}'::text[]));

-- 확인
select s.code, s.name_ko, s.aliases from interaction.substance s join _alias a on a.code = s.code group by s.id order by s.code;
-- 참고: _alias 에 있지만 substance 에 없는 code (사전에 아직 없는 약)
select distinct a.code from _alias a where not exists (select 1 from interaction.substance s where s.code = a.code) order by 1;
