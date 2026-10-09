# Google Play 심사 준비 점검 — 2026-10-09

검증 기준: `main` d78fab2, 작업 브랜치 `codex/play-review-readiness-20261009`.
Android 신규 제출 대상은 `com.care.bokyak`이다. `com.modoobokyak.app`은 옛 Console 앱이며
이번 Android 제출 대상으로 되돌리지 않는다.

## 제출 전 차단 요인

1. Play Console을 읽을 수 있는 브라우저 세션이 연결되지 않아 `com.care.bokyak` 앱 항목,
   프로덕션 접근 자격, 필수 테스트, 선언 상태를 확인하지 못했다. 조직 계정에 12명·14일
   테스트를 일괄 적용하지 않는다.
2. Android의 모든 지속 기능은 Kakao 로그인이 필요하다. 로그인 없는 1분 점검은 가능하지만
   저장·알람 설정은 로그인 화면으로 이동한다. 기존 심사 메모의 “카카오 없이 모든 기능 사용”은
   현재 코드와 다르다. 심사자가 제한 기능을 모두 확인할 수 있도록 Play Console의 앱 액세스에
   Kakao 로그인 가능한 심사 경로를 보안 방식으로 제공하거나, 별도 심사 접근 방식을 제품 결정해야 한다.
   비밀번호·OTP를 저장소나 채팅에 기록하지 않는다.
3. 개인정보처리방침과 계정 삭제 웹 페이지의 운영자/문의 이메일이 조직 전환 정보와 다르다.
   제출 전 회사 `(주)안팜 / AhnPharm Inc.`와 `official@modubokyak.com` 반영 범위 및 시행일을
   승인받아 앱 내 문서, 웹 문서, Console 입력을 함께 맞춰야 한다.
4. 건강 앱 선언, 데이터 보안, 정확한 알람, 전체 화면 인텐트, 포그라운드 서비스 선언은
   Console에서 미확인이다. 코드만으로 완료 처리하지 않는다.
5. 실제 Android 14+ 기기에서 알림 거부/철회, 정확한 알람 거부/철회, 잠금 화면,
   절전·재부팅·시간대 변경, 동시 알람, 오프라인 완료/미루기, 수정/삭제를 실행하지 못했다.
6. 개인정보처리방침은 OpenAI 처리를 약 봉투 사진 OCR 중심으로 설명하지만 실제 코드에는
   약 이름을 보내는 약 설명 조회와 복약 일정 텍스트 파싱도 있다. 가입 동의 전 1분 점검은
   약 이름·나이·질환을 Supabase RPC로 전송한다. 최초 전송 전 고지/동의 방식과 OpenAI 처리
   범위 문구는 개인정보 결정 사항으로 승인받아 앱/웹/Console을 함께 수정해야 한다.
7. 저장소에는 인증 전환 1단계의 permissive 정책과 2단계 lockdown 마이그레이션이 모두 있다.
   운영 DB에 lockdown이 적용됐는지 확인하지 못했다. 실제 노출로 단정하거나 여기서 운영
   정책을 변경하지 말고, Supabase 운영 정책을 읽기 전용으로 검증한다.
8. 반복 알람은 다음 1회만 로컬 예약하며 그 다음 회차 재예약이 서버 일정 조회에 의존한다.
   오프라인 전달 뒤 장기 반복 지속성은 아직 보장되지 않았으므로 실기기 검증과 로컬 반복
   메타데이터 설계가 필요하다.
9. 이번 수정은 완료/미루기 시 로컬 알람 제어를 서버 기록보다 먼저 실행할 뿐, 실패한 복약
   기록을 idempotent하게 보관·재전송하는 영구 큐를 추가하지 않았다. 서버 기록 실패 안내는
   표시하지만 앱 종료 뒤 기록 유실을 복구하지 못하므로 로컬 outbox와 중복 방지 키 설계가 필요하다.

## 코드·빌드 확인

- Expo SDK 54 / React Native 0.81.5의 Android 설정은 minSdk 24, targetSdk 36,
  compileSdk 36이다.
- `app.json`: Android package `com.care.bokyak`, versionCode 16.
- `eas.json`: production Android buildType `app-bundle`.
- 알림 권한: POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM, USE_FULL_SCREEN_INTENT,
  FOREGROUND_SERVICE, WAKE_LOCK. 실제 Console 선언과 기기 허용 여부는 별도 확인이 필요하다.
- Notifee foreground service는 라이브러리 manifest에서 `shortService`로 선언된다.
- foreground service 콜백은 165초에 종료되도록 제한해 Android의 short-service 제한을 넘겨
  무기한 대기하지 않는다. 4분 이상 실제 기기 방치 시 ANR이 없는지는 별도 확인한다.
- 계정 삭제: 앱 안의 설정/개인정보 화면에서 `delete_my_account` RPC를 호출하고,
  웹 삭제 안내 URL은 `https://modubokyak.vercel.app/delete-account.html`이다.

## 데이터 흐름 대조

- Supabase: 이름, 로그인 식별자, 복약 일정, 복약 기록, 알람 이벤트,
  1분 점검 입력/결과를 저장한다.
- OpenAI: 약 봉투 이미지 OCR, 약 이름/일정 텍스트 파싱, 약 정보 조회에 사용된다.
  마이크/음성 인식 데이터는 현재 Android 앱 권한에서 차단되고 코드 경로도 사용하지 않는다.
- Kakao: 회원번호와 닉네임을 로그인에 사용한다. Apple 로그인은 iOS 전용이다.
- 제3자 광고/분석 SDK는 package.json에서 확인되지 않았다. 자체 `alarm_events`와
  `voice_guide_events`는 앱 활동/분석 목적의 서버 로그이므로 데이터 보안 신고에서 누락하면 안 된다.
- 건강 앱 선언은 최소 `Medication and Treatment Management`가 실제 기능과 일치한다.
  1분 점검은 약물 상호작용/건강 상태 입력을 처리하므로 Console의 추가 건강 기능 항목이 있는지
  실제 설문을 열어 검토해야 한다.

## 심사 입력 초안

- 앱/패키지: 모두의 복약 / `com.care.bokyak`
- 개발자 계정: Carenavi, ID 9081054576079116151, 조직 계정
- 회사/문의: `(주)안팜 / AhnPharm Inc.` / `official@modubokyak.com` (정책 문서 반영 승인 필요)
- 개인정보처리방침: `https://modubokyak.vercel.app/privacy.html`
- 계정 삭제: `https://modubokyak.vercel.app/delete-account.html`
- 건강 기능: 복약 일정·알림 및 약물 상호작용 1분 점검
- 비의료기기 고지: 진단·처방·치료를 대체하지 않으며 의사·약사 상담이 필요하다는 문구가
  앱 개인정보 화면과 스토어 설명 초안에 있다. 실제 스토어 입력을 확인해야 한다.
- 전체 화면 인텐트 핵심 용도: 사용자가 등록한 복약 시각에 울리는 알람 화면.
  다른 용도로 사용하지 않는다는 설명과 실제 기기 데모 영상이 필요하다.
- 심사자 접근: 로그인 없는 1분 점검 경로와, Kakao 로그인이 필요한 저장·알람 경로를
  구분해 영어 안내를 작성한다. 제한 기능용 접근 수단은 Play Console의 보안 입력란으로 제공한다.

## 수행 검사

- 통과: `npm exec jest -- --runInBand` — 39 suites, 439 tests.
- 통과: `npx tsc --noEmit`.
- 통과: Expo introspection — package/versionCode/권한/receiver 생성 확인.
- 부분 실패: `npm run check:server` — 공개 프리셋 칩만 순차 검사하던 중 `항우울제`
  성공 다음 호출이 statement timeout(HTTP 500)으로 종료됐다. 다음 프리셋인
  `당뇨병약`만 개인정보 없이 단독 재검사했을 때는 HTTP 200(약 1.45초)이어서,
  해당 입력의 결정적 실패가 아니라 간헐적 서버/쿼리 타임아웃으로 기록한다.
- 경고: Expo Doctor는 SDK 54 패치 버전 정합성을 맞춘 뒤 18개 중 17개를 통과했고,
  Notifee 유지보수 경고 1개가 남았다.
- 경고: `npm audit --omit=dev`은 빌드/런타임 의존성 트리에 다수 취약점을 보고했다.
  `npm audit fix --force`는 Expo 44로 역행하므로 실행하지 않았다.
- 코드 수정: 알림 payload를 알람 화면 폴백으로 전달해 서버 일정 조회가 실패해도 로컬 응답
  버튼을 제공하고, 완료/미루기는 로컬 알람 제어 후 서버 기록을 시도한다.
- 미해결: 서버 기록 실패의 idempotent 재전송 큐와 다음 날 이후 반복 알람의 완전한 오프라인
  재예약은 구현하지 않았다. 기록 유실과 다음 날 알림 누락 가능성은 별도 후속 작업이다.
- 통과: `npm exec expo export -- --platform android --clear` — Android JS/Hermes 번들 생성.
- 미실행: production AAB 서명 빌드 및 16 KB 정렬 검사(원격 EAS 인증/빌드 필요).
- 미실행: 실제 기기 알람·권한·절전·재부팅·시간대·동시성 테스트.
- 미확인: Play Console 실시간 상태와 프로덕션 제출 자격.

## 최소 다음 조치

1. 로그인된 Play Console 브라우저를 연결하고 `com.care.bokyak` 앱의 대시보드,
   프로덕션 접근, 앱 콘텐츠, 데이터 보안, 건강 앱, 전체 화면 인텐트/FGS 선언을 읽기 전용으로 확인한다.
2. 회사명·문의 이메일·시행일과 심사 접근 방식을 승인한다.
3. 승인 후 정책 문서/심사 메모를 일치시키고 production AAB를 한 번 생성한다.
4. AAB의 target SDK, 서명, manifest, 네이티브 라이브러리 16 KB 정렬을 검사한 뒤 실제 기기 표를 수행한다.

최종 제출, PR, 병합, 배포는 아직 하지 않는다.
