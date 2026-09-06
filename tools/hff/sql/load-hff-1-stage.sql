-- 건기식 적재 1단계 — 스테이징 테이블 (2026-09-06)
-- 실행 후: Table Editor → 스키마 interaction → hff_stage → Import data via CSV
--          (바탕화면 hff_stage.csv — make_stage_csv.py 가 만든 파일)
-- CSV 헤더가 아래 컬럼명과 같아 그대로 매핑된다.

create table if not exists interaction.hff_stage (
  report_no     text,
  name          text,
  manufacturer  text,
  main_function text,
  caution_text  text,
  shelf_life    text,
  reported_on   text,   -- YYYYMMDD 문자열 그대로. 2단계에서 date 로 변환
  indiv         text,   -- 기능성 원료 원문 (INDIV_RAWMTRL_NM)
  etc_raw       text    -- 부원료 원문 (ETC_RAWMTRL_NM)
);

-- 다시 적재할 때는 비우고 시작
truncate interaction.hff_stage;
