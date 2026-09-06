-- I2710 원료별 일일섭취량 상·하한 → interaction.substance_limit (build_limits_sql.py 생성)
-- 출처: 식약처 식품안전나라 I2710 (건강기능식품 원료별 정보). limit_type = krfda_max / krfda_min.
-- 이미 같은 (성분, 종류) 행이 있으면 건너뛴다 — 검수로 넣은 값(아연 35 등)을 덮지 않기 위해.
begin;
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 14, 'krfda_max', 7.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 14 and limit_type = 'krfda_max');  -- 베타카로틴 → 베타카로틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 14, 'krfda_min', 0.42, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 14 and limit_type = 'krfda_min');  -- 베타카로틴 → 베타카로틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 129, 'krfda_max', 0.9, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 129 and limit_type = 'krfda_max');  -- 비오틴 → 비오틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 129, 'krfda_min', 0.009, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 129 and limit_type = 'krfda_min');  -- 비오틴 → 비오틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 16, 'krfda_max', 1500.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 16 and limit_type = 'krfda_max');  -- 가르시니아캄보지아 추출물 → 가르시니아
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 16, 'krfda_min', 750.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 16 and limit_type = 'krfda_min');  -- 가르시니아캄보지아 추출물 → 가르시니아
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 52, 'krfda_max', 27.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 52 and limit_type = 'krfda_max');  -- 대두이소플라본 → 이소플라본
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 52, 'krfda_min', 24.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 52 and limit_type = 'krfda_min');  -- 대두이소플라본 → 이소플라본
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 26, 'krfda_max', 36.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 26 and limit_type = 'krfda_max');  -- 은행잎 추출물 → 은행잎
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 26, 'krfda_min', 28.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 26 and limit_type = 'krfda_min');  -- 은행잎 추출물 → 은행잎
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 38, 'krfda_max', 130.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 38 and limit_type = 'krfda_max');  -- 밀크씨슬(카르두스 마리아누스) 추출물 → 밀크씨슬
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 38, 'krfda_min', 130.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 38 and limit_type = 'krfda_min');  -- 밀크씨슬(카르두스 마리아누스) 추출물 → 밀크씨슬
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 31, 'krfda_max', 400.0, 'mg α-TE'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 31 and limit_type = 'krfda_max');  -- 비타민 E → 비타민 E
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 31, 'krfda_min', 3.3, 'mg α-TE'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 31 and limit_type = 'krfda_min');  -- 비타민 E → 비타민 E
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 103, 'krfda_max', 1.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 103 and limit_type = 'krfda_max');  -- 비타민 K → 비타민 K
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 103, 'krfda_min', 0.021, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 103 and limit_type = 'krfda_min');  -- 비타민 K → 비타민 K
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 113, 'krfda_max', 100.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 113 and limit_type = 'krfda_max');  -- 비타민 B1 → 티아민
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 113, 'krfda_min', 0.36, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 113 and limit_type = 'krfda_min');  -- 비타민 B1 → 티아민
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 165, 'krfda_max', 40.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 165 and limit_type = 'krfda_max');  -- 비타민 B2 → 비타민 B2
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 165, 'krfda_min', 0.42, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 165 and limit_type = 'krfda_min');  -- 비타민 B2 → 비타민 B2
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 121, 'krfda_max', 670.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 121 and limit_type = 'krfda_max');  -- 나이아신 → 나이아신
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 121, 'krfda_min', 4.5, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 121 and limit_type = 'krfda_min');  -- 나이아신 → 나이아신
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 148, 'krfda_max', 67.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 148 and limit_type = 'krfda_max');  -- 비타민 B6 → 비타민 B6
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 148, 'krfda_min', 0.45, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 148 and limit_type = 'krfda_min');  -- 비타민 B6 → 비타민 B6
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 11, 'krfda_max', 400.0, 'μg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 11 and limit_type = 'krfda_max');  -- 엽산 → 엽산
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 11, 'krfda_min', 120.0, 'μg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 11 and limit_type = 'krfda_min');  -- 엽산 → 엽산
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 6, 'krfda_max', 2.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 6 and limit_type = 'krfda_max');  -- 비타민 B12 → 비타민 B12
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 6, 'krfda_min', 0.00072, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 6 and limit_type = 'krfda_min');  -- 비타민 B12 → 비타민 B12
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 29, 'krfda_max', 1000.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 29 and limit_type = 'krfda_max');  -- 비타민 C → 비타민 C
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 29, 'krfda_min', 30.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 29 and limit_type = 'krfda_min');  -- 비타민 C → 비타민 C
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 5, 'krfda_max', 800.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 5 and limit_type = 'krfda_max');  -- 칼슘 → 칼슘
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 5, 'krfda_min', 210.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 5 and limit_type = 'krfda_min');  -- 칼슘 → 칼슘
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 7, 'krfda_max', 250.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 7 and limit_type = 'krfda_max');  -- 마그네슘 → 마그네슘
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 7, 'krfda_min', 94.5, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 7 and limit_type = 'krfda_min');  -- 마그네슘 → 마그네슘
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 109, 'krfda_max', 999999999.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 109 and limit_type = 'krfda_max');  -- 차전자피식이섬유 → 차전자피
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 109, 'krfda_min', 5.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 109 and limit_type = 'krfda_min');  -- 차전자피식이섬유 → 차전자피
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 35, 'krfda_max', 8.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 35 and limit_type = 'krfda_max');  -- 프락토올리고당 → 프리바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 35, 'krfda_min', 3.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 35 and limit_type = 'krfda_min');  -- 프락토올리고당 → 프리바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 104, 'krfda_max', 1.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 104 and limit_type = 'krfda_max');  -- 마늘 → 마늘
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 104, 'krfda_min', 0.6, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 104 and limit_type = 'krfda_min');  -- 마늘 → 마늘
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 42, 'krfda_max', 600.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 42 and limit_type = 'krfda_max');  -- 홍경천 추출물 → 홍경천
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 42, 'krfda_min', 200.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 42 and limit_type = 'krfda_min');  -- 홍경천 추출물 → 홍경천
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_max', 20.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_max');  -- 마리골드꽃추출물 → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_min', 10.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_min');  -- 마리골드꽃추출물 → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 225, 'krfda_max', 350.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 225 and limit_type = 'krfda_max');  -- 회화나무열매추출물 → 회화나무열매추출물
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 225, 'krfda_min', 350.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 225 and limit_type = 'krfda_min');  -- 회화나무열매추출물 → 회화나무열매추출물
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 186, 'krfda_max', 20.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 186 and limit_type = 'krfda_max');  -- 이눌린/치커리추출물 → 이눌린
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 186, 'krfda_min', 6.4, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 186 and limit_type = 'krfda_min');  -- 이눌린/치커리추출물 → 이눌린
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 15, 'krfda_max', 1000.0, 'μg RAE'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 15 and limit_type = 'krfda_max');  -- 비타민 A → 비타민 A
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 15, 'krfda_min', 210.0, 'μg RAE'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 15 and limit_type = 'krfda_min');  -- 비타민 A → 비타민 A
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 4, 'krfda_max', 0.01, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 4 and limit_type = 'krfda_max');  -- 비타민 D → 비타민 D
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 4, 'krfda_min', 0.003, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 4 and limit_type = 'krfda_min');  -- 비타민 D → 비타민 D
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 10000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- 프로바이오틱스 → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 100000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- 프로바이오틱스 → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 23, 'krfda_max', 8.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 23 and limit_type = 'krfda_max');  -- 홍국 → 홍국
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 23, 'krfda_min', 4.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 23 and limit_type = 'krfda_min');  -- 홍국 → 홍국
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 41, 'krfda_max', 300.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 41 and limit_type = 'krfda_max');  -- 포스파티딜세린 → 포스파티딜세린
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 41, 'krfda_min', 300.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 41 and limit_type = 'krfda_min');  -- 포스파티딜세린 → 포스파티딜세린
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 44, 'krfda_max', 250.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 44 and limit_type = 'krfda_max');  -- 테아닌 → 테아닌
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 44, 'krfda_min', 200.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 44 and limit_type = 'krfda_min');  -- 테아닌 → 테아닌
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 47, 'krfda_max', 2.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 47 and limit_type = 'krfda_max');  -- 엠에스엠(MSM, Methyl sulfonylmethane, 디메틸설폰) → MSM
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 47, 'krfda_min', 1.5, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 47 and limit_type = 'krfda_min');  -- 엠에스엠(MSM, Methyl sulfonylmethane, 디메틸설폰) → MSM
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 224, 'krfda_max', 514.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 224 and limit_type = 'krfda_max');  -- 백수오 등 복합추출물(제2010-20호) → 백수오등복합추출물
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 224, 'krfda_min', 514.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 224 and limit_type = 'krfda_min');  -- 백수오 등 복합추출물(제2010-20호) → 백수오등복합추출물
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 124, 'krfda_max', 20.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 124 and limit_type = 'krfda_max');  -- 폴리코사놀-사탕수수왁스알코올(제2006-4호) → 폴리코사놀
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 124, 'krfda_min', 5.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 124 and limit_type = 'krfda_min');  -- 폴리코사놀-사탕수수왁스알코올(제2006-4호) → 폴리코사놀
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 24, 'krfda_max', 3400.1, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 24 and limit_type = 'krfda_max');  -- 식물스타놀에스테르(제2006-11호) → 식물스테롤
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 24, 'krfda_min', 3399.9, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 24 and limit_type = 'krfda_min');  -- 식물스타놀에스테르(제2006-11호) → 식물스테롤
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 142, 'krfda_max', 2.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 142 and limit_type = 'krfda_max');  -- L-카르니틴 타르트레이트(제2012-19호) → 카르니틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 142, 'krfda_min', 2.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 142 and limit_type = 'krfda_min');  -- L-카르니틴 타르트레이트(제2012-19호) → 카르니틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_max', 2.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_max');  -- Collactive 콜라겐펩타이드(제2012-24호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_min', 2.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_min');  -- Collactive 콜라겐펩타이드(제2012-24호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 110, 'krfda_max', 1000.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 110 and limit_type = 'krfda_max');  -- 청국장균배양정제물(폴리감마글루탐산칼륨)(제2012-25호) → 칼륨
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 110, 'krfda_min', 1000.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 110 and limit_type = 'krfda_min');  -- 청국장균배양정제물(폴리감마글루탐산칼륨)(제2012-25호) → 칼륨
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 43, 'krfda_max', 180.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 43 and limit_type = 'krfda_max');  -- 아쉬아간다 추출물(제2012-33호) → 아슈와간다
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 43, 'krfda_min', 125.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 43 and limit_type = 'krfda_min');  -- 아쉬아간다 추출물(제2012-33호) → 아슈와간다
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 54, 'krfda_max', 705.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 54 and limit_type = 'krfda_max');  -- 쏘팔메토 열매 추출물 등 복합물(제2008-79호) → 쏘팔메토
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 54, 'krfda_min', 705.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 54 and limit_type = 'krfda_min');  -- 쏘팔메토 열매 추출물 등 복합물(제2008-79호) → 쏘팔메토
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 40, 'krfda_max', 2460.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 40 and limit_type = 'krfda_max');  -- 헛개나무과병추출분말(제2008-55호) → 헛개나무
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 40, 'krfda_min', 2460.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 40 and limit_type = 'krfda_min');  -- 헛개나무과병추출분말(제2008-55호) → 헛개나무
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 66, 'krfda_max', 20.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 66 and limit_type = 'krfda_max');  -- 지아잔틴 추출물(제2008-65호) → 지아잔틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 66, 'krfda_min', 10.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 66 and limit_type = 'krfda_min');  -- 지아잔틴 추출물(제2008-65호) → 지아잔틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_max', 20.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_max');  -- 루테인/지아잔틴 복합추출물(제2008-66호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_min', 10.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_min');  -- 루테인/지아잔틴 복합추출물(제2008-66호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 21, 'krfda_max', 20.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 21 and limit_type = 'krfda_max');  -- 밀전분유래 난소화성말토덱스트린(제2011-6호) → 난소화성 말토덱스트린
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 21, 'krfda_min', 8.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 21 and limit_type = 'krfda_min');  -- 밀전분유래 난소화성말토덱스트린(제2011-6호) → 난소화성 말토덱스트린
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 114, 'krfda_max', 150.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 114 and limit_type = 'krfda_max');  -- 스페인감초추출물(제2014-4호) → 감초
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 114, 'krfda_min', 150.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 114 and limit_type = 'krfda_min');  -- 스페인감초추출물(제2014-4호) → 감초
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 151, 'krfda_max', 1000.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 151 and limit_type = 'krfda_max');  -- 호박씨추출물 등 복합물(제2011-15호) → 호박씨 추출물
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 151, 'krfda_min', 600.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 151 and limit_type = 'krfda_min');  -- 호박씨추출물 등 복합물(제2011-15호) → 호박씨 추출물
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 1.5, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- 유산균발효다시마추출물(제2011-22호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 1.5, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- 유산균발효다시마추출물(제2011-22호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 1.5, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- 유산균 발효 다시마추출물(제2011-23호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 1.5, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- 유산균 발효 다시마추출물(제2011-23호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 40, 'krfda_max', 2460.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 40 and limit_type = 'krfda_max');  -- 헛개나무과병추출분말(제2014-1호) → 헛개나무
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 40, 'krfda_min', 2460.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 40 and limit_type = 'krfda_min');  -- 헛개나무과병추출분말(제2014-1호) → 헛개나무
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 48, 'krfda_max', 1000.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 48 and limit_type = 'krfda_max');  -- 보스웰리아 추출물(Boswellia serrata R. extract)(제2014-23호) → 보스웰리아
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 48, 'krfda_min', 1000.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 48 and limit_type = 'krfda_min');  -- 보스웰리아 추출물(Boswellia serrata R. extract)(제2014-23호) → 보스웰리아
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 40, 'krfda_max', 2460.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 40 and limit_type = 'krfda_max');  -- 헛개나무과병추출분말(제2016-10호) → 헛개나무
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 40, 'krfda_min', 2460.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 40 and limit_type = 'krfda_min');  -- 헛개나무과병추출분말(제2016-10호) → 헛개나무
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_max', 3000.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_max');  -- 저분자콜라겐펩타이드(제2013-30호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_min', 1000.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_min');  -- 저분자콜라겐펩타이드(제2013-30호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 27, 'krfda_max', 250.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 27 and limit_type = 'krfda_max');  -- 효모베타글루칸(제2013-34호) → 베타글루칸
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 27, 'krfda_min', 250.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 27 and limit_type = 'krfda_min');  -- 효모베타글루칸(제2013-34호) → 베타글루칸
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 1000.1, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Enterococcus faecalis 가열처리건조분말(제2008-31호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 999.9, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Enterococcus faecalis 가열처리건조분말(제2008-31호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 61, 'krfda_max', 3.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 61 and limit_type = 'krfda_max');  -- 홍삼, 사상자, 산수유 복합추출물(제2008-67호) → 홍삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 61, 'krfda_min', 3.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 61 and limit_type = 'krfda_min');  -- 홍삼, 사상자, 산수유 복합추출물(제2008-67호) → 홍삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 10000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Lactobacillus gasseri BNR17(제2014-5호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 10000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Lactobacillus gasseri BNR17(제2014-5호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_max', 20.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_max');  -- 마리골드 추출물(루테인 에스테르)(제2012-22호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_min', 18.5, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_min');  -- 마리골드 추출물(루테인 에스테르)(제2012-22호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 1000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- UREX 프로바이오틱스(제2014-27호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 1000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- UREX 프로바이오틱스(제2014-27호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 84, 'krfda_max', 960.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 84 and limit_type = 'krfda_max');  -- 인삼가수분해 농축액(제2011-27호) → 인삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 84, 'krfda_min', 960.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 84 and limit_type = 'krfda_min');  -- 인삼가수분해 농축액(제2011-27호) → 인삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 24, 'krfda_max', 3.4, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 24 and limit_type = 'krfda_max');  -- 식물스타놀 에스테르(제2014-32호) → 식물스테롤
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 24, 'krfda_min', 2.5, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 24 and limit_type = 'krfda_min');  -- 식물스타놀 에스테르(제2014-32호) → 식물스테롤
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 23, 'krfda_max', 8.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 23 and limit_type = 'krfda_max');  -- 홍국쌀(제2009-19호) → 홍국
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 23, 'krfda_min', 4.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 23 and limit_type = 'krfda_min');  -- 홍국쌀(제2009-19호) → 홍국
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 3000000000000.0, ''
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- 프로바이오틱스(드시모네)(제2009-28호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 100000000.0, ''
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- 프로바이오틱스(드시모네)(제2009-28호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 89, 'krfda_max', 7.5, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 89 and limit_type = 'krfda_max');  -- 실크단백질 산가수분해물(Sil-Q1)(제2021-1호) → 단백질
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 89, 'krfda_min', 7.5, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 89 and limit_type = 'krfda_min');  -- 실크단백질 산가수분해물(Sil-Q1)(제2021-1호) → 단백질
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 48, 'krfda_max', 400.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 48 and limit_type = 'krfda_max');  -- 보스웰리아추출물등 복합물(Flexir)(제2021-9호) → 보스웰리아
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 48, 'krfda_min', 200.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 48 and limit_type = 'krfda_min');  -- 보스웰리아추출물등 복합물(Flexir)(제2021-9호) → 보스웰리아
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_max', 2.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_max');  -- 저분자콜라겐펩타이드SH(제2022-5호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_min', 2.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_min');  -- 저분자콜라겐펩타이드SH(제2022-5호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 1200000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- 유산균복합물(AB-LIFE®)(제2022-15호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 1200000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- 유산균복합물(AB-LIFE®)(제2022-15호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 48, 'krfda_max', 400.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 48 and limit_type = 'krfda_max');  -- 보스웰리아추출물(SERRATRIN)(제2022-17호) → 보스웰리아
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 48, 'krfda_min', 400.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 48 and limit_type = 'krfda_min');  -- 보스웰리아추출물(SERRATRIN)(제2022-17호) → 보스웰리아
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_max', 12.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_max');  -- 루테인지아잔틴추출복합물(제2022-29호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_min', 12.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_min');  -- 루테인지아잔틴추출복합물(제2022-29호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 100000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Weissella cibaria JW15 프로바이오틱스(제2022-35호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 100000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Weissella cibaria JW15 프로바이오틱스(제2022-35호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_max', 12.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_max');  -- 루테인지아잔틴추출복합물(제2021-21호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_min', 12.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_min');  -- 루테인지아잔틴추출복합물(제2021-21호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 2000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Bacillus coagulans Unique IS-2 프로바이오틱스(제2022-45호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 2000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Bacillus coagulans Unique IS-2 프로바이오틱스(제2022-45호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 147, 'krfda_max', 200.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 147 and limit_type = 'krfda_max');  -- 에키네시아추출물(제2023-1호) → 에키네시아
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 147, 'krfda_min', 200.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 147 and limit_type = 'krfda_min');  -- 에키네시아추출물(제2023-1호) → 에키네시아
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 10000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Lactiplantibacillus plantarum TWK10 프로바이오틱스(제2022-32호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 10000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Lactiplantibacillus plantarum TWK10 프로바이오틱스(제2022-32호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_max', 1.5, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_max');  -- 저분자 피쉬 콜라겐 펩타이드 (Naticol® BPMG)(제2023-25호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_min', 1.5, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_min');  -- 저분자 피쉬 콜라겐 펩타이드 (Naticol® BPMG)(제2023-25호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 12, 'krfda_max', 2.24, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 12 and limit_type = 'krfda_max');  -- EPA 및 DHA 함유 유지 → 오메가-3
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 12, 'krfda_min', 0.5, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 12 and limit_type = 'krfda_min');  -- EPA 및 DHA 함유 유지 → 오메가-3
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_max', 2.0, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_max');  -- 저분자콜라겐펩타이드(제2023-33호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_min', 2.0, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_min');  -- 저분자콜라겐펩타이드(제2023-33호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 800.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Lactiplantibacillus plantarum C29 프로바이오틱스와 발효대두분말의 복합물(DW2009)(제2022-43호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 800.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Lactiplantibacillus plantarum C29 프로바이오틱스와 발효대두분말의 복합물(DW2009)(제2022-43호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 104, 'krfda_max', 1.8, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 104 and limit_type = 'krfda_max');  -- 유산균발효마늘추출분말(제2016-16호) → 마늘
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 104, 'krfda_min', 1.8, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 104 and limit_type = 'krfda_min');  -- 유산균발효마늘추출분말(제2016-16호) → 마늘
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_max', 1000.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_max');  -- 저분자콜라겐펩타이드(제2023-14호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_min', 4000.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_min');  -- 저분자콜라겐펩타이드(제2023-14호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 4000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Lactiplantibacillus plantarum HAC01 프로바이오틱스(제2022-21호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 4000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Lactiplantibacillus plantarum HAC01 프로바이오틱스(제2022-21호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 36, 'krfda_max', 100.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 36 and limit_type = 'krfda_max');  -- 파비플로라생강뿌리추출물(제2024-14호) → 생강
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 36, 'krfda_min', 100.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 36 and limit_type = 'krfda_min');  -- 파비플로라생강뿌리추출물(제2024-14호) → 생강
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 1.0, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- 유산균발효대두분말(제2024-38호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 1.0, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- 유산균발효대두분말(제2024-38호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 500.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- 유산균발효굴추출물(FGO)(제2024-27호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 500.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- 유산균발효굴추출물(FGO)(제2024-27호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 5000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Latilactobacillus curvatus LB-P9 프로바이오틱스(제2025-5호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 5000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Latilactobacillus curvatus LB-P9 프로바이오틱스(제2025-5호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 66, 'krfda_max', 12.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 66 and limit_type = 'krfda_max');  -- 마리골드꽃추출물(지아잔틴함유)(제2025-7호) → 지아잔틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 66, 'krfda_min', 12.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 66 and limit_type = 'krfda_min');  -- 마리골드꽃추출물(지아잔틴함유)(제2025-7호) → 지아잔틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 10000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- L. mucosae NK41과 B. longum NK46의 프로바이오틱스 복합물(NVP-2106)(제2025-15호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 10000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- L. mucosae NK41과 B. longum NK46의 프로바이오틱스 복합물(NVP-2106)(제2025-15호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 40, 'krfda_max', 500.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 40 and limit_type = 'krfda_max');  -- 헛개나무과병·오미자박추출복합물(제2025-12호) → 헛개나무
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 40, 'krfda_min', 500.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 40 and limit_type = 'krfda_min');  -- 헛개나무과병·오미자박추출복합물(제2025-12호) → 헛개나무
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 203, 'krfda_max', 388.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 203 and limit_type = 'krfda_max');  -- 프로폴리스망고스틴껍질복합물(제2025-13호) → 프로폴리스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 203, 'krfda_min', 388.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 203 and limit_type = 'krfda_min');  -- 프로폴리스망고스틴껍질복합물(제2025-13호) → 프로폴리스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 5000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Lactilactobacillus curvatus LB-P9 프로바이오틱스(제2025-6호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 5000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Lactilactobacillus curvatus LB-P9 프로바이오틱스(제2025-6호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 147, 'krfda_max', 200.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 147 and limit_type = 'krfda_max');  -- 에키네시아추출물(제2024-3호) → 에키네시아
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 147, 'krfda_min', 200.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 147 and limit_type = 'krfda_min');  -- 에키네시아추출물(제2024-3호) → 에키네시아
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_max', 3.5, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_max');  -- 저분자콜라겐펩타이드(제2024-35호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_min', 1.5, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_min');  -- 저분자콜라겐펩타이드(제2024-35호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 84, 'krfda_max', 28.8, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 84 and limit_type = 'krfda_max');  -- 인삼(제2021-10호) → 인삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 84, 'krfda_min', 28.8, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 84 and limit_type = 'krfda_min');  -- 인삼(제2021-10호) → 인삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 84, 'krfda_max', 450.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 84 and limit_type = 'krfda_max');  -- 새싹인삼추출분말(제2023-27호) → 인삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 84, 'krfda_min', 450.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 84 and limit_type = 'krfda_min');  -- 새싹인삼추출분말(제2023-27호) → 인삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_max', 30.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_max');  -- 루테인지아잔틴추출복합물(제2025-35호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_min', 12.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_min');  -- 루테인지아잔틴추출복합물(제2025-35호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 184, 'krfda_max', 1200.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 184 and limit_type = 'krfda_max');  -- 콘드로이친황산염(제2025-63호) → 콘드로이틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 184, 'krfda_min', 1200.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 184 and limit_type = 'krfda_min');  -- 콘드로이친황산염(제2025-63호) → 콘드로이틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 580.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- 녹용유산균발효분말(제2025-45호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 580.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- 녹용유산균발효분말(제2025-45호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 40000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Lactiplantibacillus plantarum ATG-K2 프로바이오틱스(제2025-58호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 4000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Lactiplantibacillus plantarum ATG-K2 프로바이오틱스(제2025-58호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 43, 'krfda_max', 125.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 43 and limit_type = 'krfda_max');  -- 아쉬아간다추출물(Sensoril®)(제2024-30호) → 아슈와간다
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 43, 'krfda_min', 125.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 43 and limit_type = 'krfda_min');  -- 아쉬아간다추출물(Sensoril®)(제2024-30호) → 아슈와간다
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 1667.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- 대두배아유산균발효물(SE5-OH)(제2025-20호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 1667.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- 대두배아유산균발효물(SE5-OH)(제2025-20호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_max', 2.0, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_max');  -- 홍어껍질콜라겐펩타이드(제2025-49호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_min', 2.0, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_min');  -- 홍어껍질콜라겐펩타이드(제2025-49호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 33, 'krfda_max', 400.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 33 and limit_type = 'krfda_max');  -- 강황추출물(제2025-51호) → 커큐민
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 33, 'krfda_min', 400.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 33 and limit_type = 'krfda_min');  -- 강황추출물(제2025-51호) → 커큐민
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 124, 'krfda_max', 20.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 124 and limit_type = 'krfda_max');  -- 사탕수수왁스알코올(폴리코사놀)(제2025-19호) → 폴리코사놀
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 124, 'krfda_min', 20.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 124 and limit_type = 'krfda_min');  -- 사탕수수왁스알코올(폴리코사놀)(제2025-19호) → 폴리코사놀
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 50000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Lacticaseibacillus paracasei BEPC22와 Lactiplantibacillus plantarum BELP53의 프로바이오틱스 복합물(HH202-LB)(제2026-22호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 50000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Lacticaseibacillus paracasei BEPC22와 Lactiplantibacillus plantarum BELP53의 프로바이오틱스 복합물(HH202-LB)(제2026-22호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_max', 24.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_max');  -- 루테인지아잔틴복합추출물(제2018-11호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_min', 12.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_min');  -- 루테인지아잔틴복합추출물(제2018-11호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 84, 'krfda_max', 25.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 84 and limit_type = 'krfda_max');  -- 인삼(제2019-2호) → 인삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 84, 'krfda_min', 25.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 84 and limit_type = 'krfda_min');  -- 인삼(제2019-2호) → 인삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_max', 20.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_max');  -- 루테인지아잔틴복합추출물(제2019-16호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_min', 10.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_min');  -- 루테인지아잔틴복합추출물(제2019-16호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 114, 'krfda_max', 150.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 114 and limit_type = 'krfda_max');  -- 스페인감초추출물(제2019-7호) → 감초
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 114, 'krfda_min', 150.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 114 and limit_type = 'krfda_min');  -- 스페인감초추출물(제2019-7호) → 감초
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_max', 3270.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_max');  -- 피쉬 콜라겐펩타이드(제2019-12호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_min', 3270.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_min');  -- 피쉬 콜라겐펩타이드(제2019-12호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_max', 1.0, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_max');  -- 저분자콜라겐펩타이드 AG(제2023-10호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_min', 1.0, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_min');  -- 저분자콜라겐펩타이드 AG(제2023-10호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 4000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Lactiplantibacillus plantarum Q180(제2021-23호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 4000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Lactiplantibacillus plantarum Q180(제2021-23호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_max', 3.5, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_max');  -- 저분자콜라겐펩타이드(제2024-34호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_min', 1.5, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_min');  -- 저분자콜라겐펩타이드(제2024-34호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 66, 'krfda_max', 20.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 66 and limit_type = 'krfda_max');  -- 마리골드꽃추출물(지아잔틴함유)(제2026-9호) → 지아잔틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 66, 'krfda_min', 10.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 66 and limit_type = 'krfda_min');  -- 마리골드꽃추출물(지아잔틴함유)(제2026-9호) → 지아잔틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 10000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Weissella confusa WIKIM51 프로바이오틱스(Wilac D001)(제2026-6호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 10000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Weissella confusa WIKIM51 프로바이오틱스(Wilac D001)(제2026-6호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 300.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- 프로바이오틱스(Lactiplantibacillus plantarum Q180)·미세조류(Phaeodactylum tricornutum) 복합물(CKDB-322)(제2026-19호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 300.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- 프로바이오틱스(Lactiplantibacillus plantarum Q180)·미세조류(Phaeodactylum tricornutum) 복합물(CKDB-322)(제2026-19호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 37, 'krfda_max', 250.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 37 and limit_type = 'krfda_max');  -- 인동덩굴꽃봉오리추출물(그린세라-F)(제2019-14호) → 인동덩굴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 37, 'krfda_min', 250.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 37 and limit_type = 'krfda_min');  -- 인동덩굴꽃봉오리추출물(그린세라-F)(제2019-14호) → 인동덩굴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 33, 'krfda_max', 250.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 33 and limit_type = 'krfda_max');  -- 강황추출물(제2023-5호) → 커큐민
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 33, 'krfda_min', 250.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 33 and limit_type = 'krfda_min');  -- 강황추출물(제2023-5호) → 커큐민
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 10000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- L. plantarum LC27과 B. longum LC67의 프로바이오틱스 복합물(NVP-1702)(제2023-19호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 10000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- L. plantarum LC27과 B. longum LC67의 프로바이오틱스 복합물(NVP-1702)(제2023-19호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 61, 'krfda_max', 23.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 61 and limit_type = 'krfda_max');  -- 홍삼(제2024-20호) → 홍삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 61, 'krfda_min', 23.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 61 and limit_type = 'krfda_min');  -- 홍삼(제2024-20호) → 홍삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 50, 'krfda_max', 3.0, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 50 and limit_type = 'krfda_max');  -- CaHMB(Calcium β-Hydroxy-β-methylbutyrate)(제2023-26호) → HMB
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 50, 'krfda_min', 3.0, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 50 and limit_type = 'krfda_min');  -- CaHMB(Calcium β-Hydroxy-β-methylbutyrate)(제2023-26호) → HMB
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 66, 'krfda_max', 12.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 66 and limit_type = 'krfda_max');  -- 마리골드꽃추출물(지아잔틴함유)(제2024-25호) → 지아잔틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 66, 'krfda_min', 12.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 66 and limit_type = 'krfda_min');  -- 마리골드꽃추출물(지아잔틴함유)(제2024-25호) → 지아잔틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 219, 'krfda_max', 190.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 219 and limit_type = 'krfda_max');  -- 대두추출물등 복합물(메노세라)(제2019-29호) → 콩
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 219, 'krfda_min', 190.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 219 and limit_type = 'krfda_min');  -- 대두추출물등 복합물(메노세라)(제2019-29호) → 콩
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 61, 'krfda_max', 400.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 61 and limit_type = 'krfda_max');  -- 홍삼추출효소처리분말(제2024-33호) → 홍삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 61, 'krfda_min', 400.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 61 and limit_type = 'krfda_min');  -- 홍삼추출효소처리분말(제2024-33호) → 홍삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 500.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- 유산균발효굴추출물(FGO)(제2024-26호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 500.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- 유산균발효굴추출물(FGO)(제2024-26호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 980.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- 프로바이오틱스(Lactiplantibacillus plantarum KC3)·익모초추출복합물(CKDB-315)(제2025-1호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 980.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- 프로바이오틱스(Lactiplantibacillus plantarum KC3)·익모초추출복합물(CKDB-315)(제2025-1호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 40, 'krfda_max', 500.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 40 and limit_type = 'krfda_max');  -- 헛개나무과병·오미자박추출복합물(제2025-18호) → 헛개나무
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 40, 'krfda_min', 500.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 40 and limit_type = 'krfda_min');  -- 헛개나무과병·오미자박추출복합물(제2025-18호) → 헛개나무
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 10.0, 'mL/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- 골드키위유산균발효물(Kiwibiotics®)(제2025-22호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 10.0, 'mL/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- 골드키위유산균발효물(Kiwibiotics®)(제2025-22호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 5000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Lactiplantibacillus plantarum LMT1-48 프로바이오틱스(제2025-32호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 5000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Lactiplantibacillus plantarum LMT1-48 프로바이오틱스(제2025-32호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 28, 'krfda_max', 12.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 28 and limit_type = 'krfda_max');  -- 아연 → 아연
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 28, 'krfda_min', 2.55, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 28 and limit_type = 'krfda_min');  -- 아연 → 아연
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 75, 'krfda_max', 7.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 75 and limit_type = 'krfda_max');  -- 구리 → 구리
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 75, 'krfda_min', 0.24, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 75 and limit_type = 'krfda_min');  -- 구리 → 구리
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 94, 'krfda_max', 0.15, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 94 and limit_type = 'krfda_max');  -- 요오드 → 요오드
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 94, 'krfda_min', 0.045, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 94 and limit_type = 'krfda_min');  -- 요오드 → 요오드
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 193, 'krfda_max', 3.5, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 193 and limit_type = 'krfda_max');  -- 망간 → 망간
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 193, 'krfda_min', 0.9, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 193 and limit_type = 'krfda_min');  -- 망간 → 망간
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 110, 'krfda_max', 3700.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 110 and limit_type = 'krfda_max');  -- 칼륨 → 칼륨
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 110, 'krfda_min', 1050.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 110 and limit_type = 'krfda_min');  -- 칼륨 → 칼륨
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 127, 'krfda_max', 9.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 127 and limit_type = 'krfda_max');  -- 크롬 → 크롬
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 127, 'krfda_min', 0.009, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 127 and limit_type = 'krfda_min');  -- 크롬 → 크롬
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 89, 'krfda_max', 999999999.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 89 and limit_type = 'krfda_max');  -- 단백질 → 단백질
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 89, 'krfda_min', 12.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 89 and limit_type = 'krfda_min');  -- 단백질 → 단백질
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 84, 'krfda_max', 80.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 84 and limit_type = 'krfda_max');  -- 인삼 → 인삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 84, 'krfda_min', 3.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 84 and limit_type = 'krfda_min');  -- 인삼 → 인삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 61, 'krfda_max', 80.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 61 and limit_type = 'krfda_max');  -- 홍삼 → 홍삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 61, 'krfda_min', 2.4, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 61 and limit_type = 'krfda_min');  -- 홍삼 → 홍삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 203, 'krfda_max', 40.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 203 and limit_type = 'krfda_max');  -- 프로폴리스추출물 → 프로폴리스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 203, 'krfda_min', 20.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 203 and limit_type = 'krfda_min');  -- 프로폴리스추출물 → 프로폴리스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 24, 'krfda_max', 3.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 24 and limit_type = 'krfda_max');  -- 식물스테롤/식물스테롤에스테르 → 식물스테롤
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 24, 'krfda_min', 0.8, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 24 and limit_type = 'krfda_min');  -- 식물스테롤/식물스테롤에스테르 → 식물스테롤
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 46, 'krfda_max', 1.5, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 46 and limit_type = 'krfda_max');  -- 글루코사민 → 글루코사민
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 46, 'krfda_min', 1.5, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 46 and limit_type = 'krfda_min');  -- 글루코사민 → 글루코사민
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 184, 'krfda_max', 1.5, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 184 and limit_type = 'krfda_max');  -- 뮤코다당.단백 → 콘드로이틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 184, 'krfda_min', 1.2, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 184 and limit_type = 'krfda_min');  -- 뮤코다당.단백 → 콘드로이틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 70, 'krfda_max', 240.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 70 and limit_type = 'krfda_max');  -- 히알루론산 → 히알루론산
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 70, 'krfda_min', 120.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 70 and limit_type = 'krfda_min');  -- 히알루론산 → 히알루론산
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 46, 'krfda_max', 1.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 46 and limit_type = 'krfda_max');  -- NAG(엔에이지, N-아세틸글루코사민, N-Acetylglucosamine) → 글루코사민
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 46, 'krfda_min', 0.5, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 46 and limit_type = 'krfda_min');  -- NAG(엔에이지, N-아세틸글루코사민, N-Acetylglucosamine) → 글루코사민
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 222, 'krfda_max', 3.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 222 and limit_type = 'krfda_max');  -- 크레아틴 → 크레아틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 222, 'krfda_min', 3.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 222 and limit_type = 'krfda_min');  -- 크레아틴 → 크레아틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 226, 'krfda_max', 4.1, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 226 and limit_type = 'krfda_max');  -- 유단백가수분해물 → 유단백가수분해물
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 226, 'krfda_min', 2.7, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 226 and limit_type = 'krfda_min');  -- 유단백가수분해물 → 유단백가수분해물
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 142, 'krfda_max', 2.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 142 and limit_type = 'krfda_max');  -- L-카르니틴 타르트레이트(제2010-50호) → 카르니틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 142, 'krfda_min', 2.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 142 and limit_type = 'krfda_min');  -- L-카르니틴 타르트레이트(제2010-50호) → 카르니틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 44, 'krfda_max', 1680.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 44 and limit_type = 'krfda_max');  -- 녹차추출물/테아닌 복합물(제2010-51호) → 테아닌
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 44, 'krfda_min', 1680.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 44 and limit_type = 'krfda_min');  -- 녹차추출물/테아닌 복합물(제2010-51호) → 테아닌
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 10000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Lactobacillus gasseri BNR17(제2017-6호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 10000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Lactobacillus gasseri BNR17(제2017-6호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_max', 20.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_max');  -- 루테인지아잔틴복합추출물(제2018-4호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_min', 10.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_min');  -- 루테인지아잔틴복합추출물(제2018-4호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 223, 'krfda_max', 6.0, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 223 and limit_type = 'krfda_max');  -- L-아르기닌(제2015-19호) → L-아르기닌
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 223, 'krfda_min', 6.0, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 223 and limit_type = 'krfda_min');  -- L-아르기닌(제2015-19호) → L-아르기닌
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 10000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- 프로바이오틱스 HY7714(제2015-1호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 10000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- 프로바이오틱스 HY7714(제2015-1호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 33, 'krfda_max', 1.0, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 33 and limit_type = 'krfda_max');  -- 강황 추출물(터마신)(제2014-2호) → 커큐민
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 33, 'krfda_min', 1.0, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 33 and limit_type = 'krfda_min');  -- 강황 추출물(터마신)(제2014-2호) → 커큐민
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 20, 'krfda_max', 2.4, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 20 and limit_type = 'krfda_max');  -- 미숙여주주정추출분말(제2020-14호) → 여주
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 20, 'krfda_min', 2.4, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 20 and limit_type = 'krfda_min');  -- 미숙여주주정추출분말(제2020-14호) → 여주
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 35, 'krfda_max', 2.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 35 and limit_type = 'krfda_max');  -- 갈락토올리고당 분말(네오고스-P70)(제2021-8호) → 프리바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 35, 'krfda_min', 2.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 35 and limit_type = 'krfda_min');  -- 갈락토올리고당 분말(네오고스-P70)(제2021-8호) → 프리바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_max', 2.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_max');  -- 저분자콜라겐펩타이드GT(제2022-6호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_min', 2.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_min');  -- 저분자콜라겐펩타이드GT(제2022-6호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 36, 'krfda_max', 480.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 36 and limit_type = 'krfda_max');  -- 증숙생강추출분말(GGE03)(제2022-24호) → 생강
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 36, 'krfda_min', 480.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 36 and limit_type = 'krfda_min');  -- 증숙생강추출분말(GGE03)(제2022-24호) → 생강
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 61, 'krfda_max', 1000.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 61 and limit_type = 'krfda_max');  -- 홍삼오일(KGC11o)(제2022-33호) → 홍삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 61, 'krfda_min', 1000.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 61 and limit_type = 'krfda_min');  -- 홍삼오일(KGC11o)(제2022-33호) → 홍삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 21, 'krfda_max', 30.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 21 and limit_type = 'krfda_max');  -- 난소화성말토덱스트린 → 난소화성 말토덱스트린
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 21, 'krfda_min', 4.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 21 and limit_type = 'krfda_min');  -- 난소화성말토덱스트린 → 난소화성 말토덱스트린
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 8, 'krfda_max', 100.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 8 and limit_type = 'krfda_max');  -- 코엔자임Q10 → 코엔자임 Q10
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 8, 'krfda_min', 90.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 8 and limit_type = 'krfda_min');  -- 코엔자임Q10 → 코엔자임 Q10
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 54, 'krfda_max', 115.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 54 and limit_type = 'krfda_max');  -- 쏘팔메토 열매 추출물 → 쏘팔메토
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 54, 'krfda_min', 70.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 54 and limit_type = 'krfda_min');  -- 쏘팔메토 열매 추출물 → 쏘팔메토
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 71, 'krfda_max', 12.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 71 and limit_type = 'krfda_max');  -- 헤마토코쿠스 추출물 → 아스타잔틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 71, 'krfda_min', 4.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 71 and limit_type = 'krfda_min');  -- 헤마토코쿠스 추출물 → 아스타잔틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 53, 'krfda_max', 300.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 53 and limit_type = 'krfda_max');  -- 감마리놀렌산 함유 유지 → 감마리놀렌산
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 53, 'krfda_min', 160.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 53 and limit_type = 'krfda_min');  -- 감마리놀렌산 함유 유지 → 감마리놀렌산
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 84, 'krfda_max', 6.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 84 and limit_type = 'krfda_max');  -- 인삼다당체추출물(제2015-11호) → 인삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 84, 'krfda_min', 6.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 84 and limit_type = 'krfda_min');  -- 인삼다당체추출물(제2015-11호) → 인삼
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 102, 'krfda_max', 900.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 102 and limit_type = 'krfda_max');  -- 자몽추출물등 복합물(Sinetrol)(제2019-24호) → 자몽
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 102, 'krfda_min', 900.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 102 and limit_type = 'krfda_min');  -- 자몽추출물등 복합물(Sinetrol)(제2019-24호) → 자몽
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 151, 'krfda_max', 1000.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 151 and limit_type = 'krfda_max');  -- 호박씨추출물 등 복합물(제2014-43호) → 호박씨 추출물
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 151, 'krfda_min', 600.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 151 and limit_type = 'krfda_min');  -- 호박씨추출물 등 복합물(제2014-43호) → 호박씨 추출물
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 1000000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- 과채유래유산균(L.plantarum CJLP133)(제2013-11호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 10000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- 과채유래유산균(L.plantarum CJLP133)(제2013-11호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 1000000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Lactobacillus sakei Probio65(제2013-17호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 10000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Lactobacillus sakei Probio65(제2013-17호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_max', 1500.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_max');  -- AP 콜라겐 효소분해 펩타이드(제2010-25호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_min', 1000.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_min');  -- AP 콜라겐 효소분해 펩타이드(제2010-25호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 27, 'krfda_max', 8.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 27 and limit_type = 'krfda_max');  -- 보리 베타글루칸 추출물(Barley b-glucan Extract)(제2010-32호) → 베타글루칸
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 27, 'krfda_min', 3.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 27 and limit_type = 'krfda_min');  -- 보리 베타글루칸 추출물(Barley b-glucan Extract)(제2010-32호) → 베타글루칸
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 105, 'krfda_max', 500.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 105 and limit_type = 'krfda_max');  -- 크랜베리 추출물(제2011-39호) → 크랜베리
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 105, 'krfda_min', 500.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 105 and limit_type = 'krfda_min');  -- 크랜베리 추출물(제2011-39호) → 크랜베리
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 105, 'krfda_max', 500.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 105 and limit_type = 'krfda_max');  -- 크랜베리 추출물(Cran-Max)(제2010-39호) → 크랜베리
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 105, 'krfda_min', 500.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 105 and limit_type = 'krfda_min');  -- 크랜베리 추출물(Cran-Max)(제2010-39호) → 크랜베리
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 89, 'krfda_max', 300.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 89 and limit_type = 'krfda_max');  -- 락토페린(우유정제단백질)(제2013-20호) → 단백질
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 89, 'krfda_min', 300.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 89 and limit_type = 'krfda_min');  -- 락토페린(우유정제단백질)(제2013-20호) → 단백질
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_max', 20.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_max');  -- 루테인지아잔틴복합추출물20%(제2013-23호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 56, 'krfda_min', 10.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 56 and limit_type = 'krfda_min');  -- 루테인지아잔틴복합추출물20%(제2013-23호) → 루테인
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 226, 'krfda_max', 300.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 226 and limit_type = 'krfda_max');  -- 유단백가수분해물(락티움)(제2020-2호) → 유단백가수분해물
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 226, 'krfda_min', 300.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 226 and limit_type = 'krfda_min');  -- 유단백가수분해물(락티움)(제2020-2호) → 유단백가수분해물
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 27, 'krfda_max', 412.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 27 and limit_type = 'krfda_max');  -- 베타글루칸분말(제2020-10호) → 베타글루칸
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 27, 'krfda_min', 412.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 27 and limit_type = 'krfda_min');  -- 베타글루칸분말(제2020-10호) → 베타글루칸
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 17, 'krfda_max', 900.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 17 and limit_type = 'krfda_max');  -- 열처리녹차추출물(제2022-34호) → 녹차 카테킨
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 17, 'krfda_min', 900.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 17 and limit_type = 'krfda_min');  -- 열처리녹차추출물(제2022-34호) → 녹차 카테킨
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 43, 'krfda_max', 120.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 43 and limit_type = 'krfda_max');  -- 아쉬아간다 추출물(ShodenⓇ)(제2022-27호) → 아슈와간다
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 43, 'krfda_min', 120.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 43 and limit_type = 'krfda_min');  -- 아쉬아간다 추출물(ShodenⓇ)(제2022-27호) → 아슈와간다
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 17, 'krfda_max', 1.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 17 and limit_type = 'krfda_max');  -- 녹차추출물 → 녹차 카테킨
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 17, 'krfda_min', 0.3, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 17 and limit_type = 'krfda_min');  -- 녹차추출물 → 녹차 카테킨
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 19, 'krfda_max', 1.3, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 19 and limit_type = 'krfda_max');  -- 바나바잎 추출물 → 바나바잎
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 19, 'krfda_min', 0.45, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 19 and limit_type = 'krfda_min');  -- 바나바잎 추출물 → 바나바잎
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 27, 'krfda_max', 8.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 27 and limit_type = 'krfda_max');  -- 보리 베타글루칸 추출물(Barley β-glucan Extract)(제2009-73호) → 베타글루칸
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 27, 'krfda_min', 3.0, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 27 and limit_type = 'krfda_min');  -- 보리 베타글루칸 추출물(Barley β-glucan Extract)(제2009-73호) → 베타글루칸
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 35, 'krfda_max', 7.5, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 35 and limit_type = 'krfda_max');  -- 자일로올리고당(xylooligosaccharide) 분말(제2009-80호) → 프리바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 35, 'krfda_min', 0.7, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 35 and limit_type = 'krfda_min');  -- 자일로올리고당(xylooligosaccharide) 분말(제2009-80호) → 프리바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 35, 'krfda_max', 7.5, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 35 and limit_type = 'krfda_max');  -- 자일로올리고당(xylooligosaccharide)(제2009-81호) → 프리바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 35, 'krfda_min', 0.7, 'g'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 35 and limit_type = 'krfda_min');  -- 자일로올리고당(xylooligosaccharide)(제2009-81호) → 프리바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 105, 'krfda_max', 1000.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 105 and limit_type = 'krfda_max');  -- 파크랜 크랜베리 분말(PACran Whole Cranberry Powder)(제2009-84호) → 크랜베리
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 105, 'krfda_min', 500.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 105 and limit_type = 'krfda_min');  -- 파크랜 크랜베리 분말(PACran Whole Cranberry Powder)(제2009-84호) → 크랜베리
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 105, 'krfda_max', 1000.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 105 and limit_type = 'krfda_max');  -- 파크랜 크랜베리 분말(제2014-34호) → 크랜베리
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 105, 'krfda_min', 500.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 105 and limit_type = 'krfda_min');  -- 파크랜 크랜베리 분말(제2014-34호) → 크랜베리
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 105, 'krfda_max', 1000.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 105 and limit_type = 'krfda_max');  -- 파크랜 크랜베리 분말(제2014-35호) → 크랜베리
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 105, 'krfda_min', 500.0, 'mg'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 105 and limit_type = 'krfda_min');  -- 파크랜 크랜베리 분말(제2014-35호) → 크랜베리
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 18, 'krfda_max', 300.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 18 and limit_type = 'krfda_max');  -- 시서스추출물(제2018-14호) → 시서스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 18, 'krfda_min', 300.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 18 and limit_type = 'krfda_min');  -- 시서스추출물(제2018-14호) → 시서스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_max', 1.65, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_max');  -- 저분자콜라겐펩타이드NS(제2019-20호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_min', 1.65, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_min');  -- 저분자콜라겐펩타이드NS(제2019-20호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 102, 'krfda_max', 250.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 102 and limit_type = 'krfda_max');  -- 로즈마리자몽추출복합물(Nutroxsun)(제2019-25호) → 자몽
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 102, 'krfda_min', 100.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 102 and limit_type = 'krfda_min');  -- 로즈마리자몽추출복합물(Nutroxsun)(제2019-25호) → 자몽
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 100000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Lactobacillus acidophilus YT1(제2019-22호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 100000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Lactobacillus acidophilus YT1(제2019-22호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 124.35, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- 리스펙타(Respecta®)[프로바이오틱스 등 복합물](제2019-26호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 124.35, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- 리스펙타(Respecta®)[프로바이오틱스 등 복합물](제2019-26호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 5000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Bifidobacterium breve B-3 프로바이오틱스(제2023-2호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 5000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Bifidobacterium breve B-3 프로바이오틱스(제2023-2호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_max', 1.5, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_max');  -- 저분자 피쉬 콜라겐 펩타이드 (Naticol® BPMG)(제2023-24호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 55, 'krfda_min', 1.5, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 55 and limit_type = 'krfda_min');  -- 저분자 피쉬 콜라겐 펩타이드 (Naticol® BPMG)(제2023-24호) → 콜라겐
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 10000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- L. curvatus HY7601와 L. plantarum KY1032의 프로바이오틱스 복합물(제2019-4호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 10000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- L. curvatus HY7601와 L. plantarum KY1032의 프로바이오틱스 복합물(제2019-4호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 1000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Bacillus coagulans SNZ 1969 프로바이오틱스(제2023-34호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 1000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Bacillus coagulans SNZ 1969 프로바이오틱스(제2023-34호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 184, 'krfda_max', 1200.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 184 and limit_type = 'krfda_max');  -- 콘드로이친 황산염(제2020-1호) → 콘드로이틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 184, 'krfda_min', 1200.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 184 and limit_type = 'krfda_min');  -- 콘드로이친 황산염(제2020-1호) → 콘드로이틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 48, 'krfda_max', 500.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 48 and limit_type = 'krfda_max');  -- 보스웰리아추출물(제2024-15호) → 보스웰리아
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 48, 'krfda_min', 500.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 48 and limit_type = 'krfda_min');  -- 보스웰리아추출물(제2024-15호) → 보스웰리아
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 12, 'krfda_max', 1.0, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 12 and limit_type = 'krfda_max');  -- 팔밋올레산 함유 명태(알래스카폴락)유래 정제어유(제2024-18호) → 오메가-3
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 12, 'krfda_min', 1.0, 'g/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 12 and limit_type = 'krfda_min');  -- 팔밋올레산 함유 명태(알래스카폴락)유래 정제어유(제2024-18호) → 오메가-3
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 400000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Weissella cibaria CMU 프로바이오틱스(제2026-2호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 400000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Weissella cibaria CMU 프로바이오틱스(제2026-2호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 33, 'krfda_max', 400.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 33 and limit_type = 'krfda_max');  -- 강황추출물(제2025-53호) → 커큐민
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 33, 'krfda_min', 400.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 33 and limit_type = 'krfda_min');  -- 강황추출물(제2025-53호) → 커큐민
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 10000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Latilactobacillus sakei LB-P12 프로바이오틱스(제2025-55호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 10000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Latilactobacillus sakei LB-P12 프로바이오틱스(제2025-55호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 10.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Latilactobacillus sakei K040706 열처리배양건조물(노바사케이)(제2026-10호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 10.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Latilactobacillus sakei K040706 열처리배양건조물(노바사케이)(제2026-10호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 50.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Lacticaseibacillus paracasei subsp. paracasei 327(K-1) 열처리배양건조물(제2025-43호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 50.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Lacticaseibacillus paracasei subsp. paracasei 327(K-1) 열처리배양건조물(제2025-43호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 89, 'krfda_max', 300.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 89 and limit_type = 'krfda_max');  -- 락토페린LF300(우유유래정제단백질)(제2023-38호) → 단백질
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 89, 'krfda_min', 300.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 89 and limit_type = 'krfda_min');  -- 락토페린LF300(우유유래정제단백질)(제2023-38호) → 단백질
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 33, 'krfda_max', 400.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 33 and limit_type = 'krfda_max');  -- 강황추출물(제2025-54호) → 커큐민
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 33, 'krfda_min', 400.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 33 and limit_type = 'krfda_min');  -- 강황추출물(제2025-54호) → 커큐민
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 2000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Bacillus coagulans BC99 프로바이오틱스(제2026-5호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 2000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Bacillus coagulans BC99 프로바이오틱스(제2026-5호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 5000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Lacticaseibacillus paracasei HY7017 프로바이오틱스(제2025-69호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 5000000000.0, 'CFU/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Lacticaseibacillus paracasei HY7017 프로바이오틱스(제2025-69호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 66, 'krfda_max', 24.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 66 and limit_type = 'krfda_max');  -- 마리골드꽃주정추출물(지아잔틴함유)(제2025-70호) → 지아잔틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 66, 'krfda_min', 24.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 66 and limit_type = 'krfda_min');  -- 마리골드꽃주정추출물(지아잔틴함유)(제2025-70호) → 지아잔틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 43, 'krfda_max', 600.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 43 and limit_type = 'krfda_max');  -- 아쉬아간다추출물(KSM-66®)(제2025-67호) → 아슈와간다
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 43, 'krfda_min', 250.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 43 and limit_type = 'krfda_min');  -- 아쉬아간다추출물(KSM-66®)(제2025-67호) → 아슈와간다
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 184, 'krfda_max', 1200.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 184 and limit_type = 'krfda_max');  -- 콘드로이친황산염(제2026-16호) → 콘드로이틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 184, 'krfda_min', 1200.0, 'mg/일'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 184 and limit_type = 'krfda_min');  -- 콘드로이친황산염(제2026-16호) → 콘드로이틴
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 5000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Lactobacillus delbrueckii subsp. lactis CKDB001 프로바이오틱스(제2026-13호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 5000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Lactobacillus delbrueckii subsp. lactis CKDB001 프로바이오틱스(제2026-13호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_max', 100000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_max');  -- Lactococcus lactis subsp. lactis CAB701 프로바이오틱스(제2026-1호) → 프로바이오틱스
insert into interaction.substance_limit (substance_id, limit_type, amount, unit)
select 30, 'krfda_min', 100000000000.0, 'CFU'
where not exists (select 1 from interaction.substance_limit
  where substance_id = 30 and limit_type = 'krfda_min');  -- Lactococcus lactis subsp. lactis CAB701 프로바이오틱스(제2026-1호) → 프로바이오틱스
commit;
