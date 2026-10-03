# 음성 가이드 멘트 파일

> **2026-10-03: 녹음 파일(V*.mp3)은 지웠다.** 알람 설정 안내는 글자만 보여 준다. 문구는 `src/lib/voiceScript.ts`에 있다.

이 폴더에는 더 이상 음성 파일이 없다. 사전 녹음 인출 방식(`docs/voice-guide/`)으로
V01~V14 mp3를 두던 시절의 대본은 `src/lib/voiceScript.ts` 한 곳에만 남아 있고, 화면
자막이 그 파일을 그대로 읽는다. 임시 음성 생성 스크립트(`generate-voice-cues.mjs`)도
함께 지웠다 — 음성 안내를 되살리면 git 이력(d86e19a 이전)에서 복구한다.
