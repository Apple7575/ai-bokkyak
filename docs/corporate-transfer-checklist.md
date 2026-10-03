# 법인 명의 이전 체크리스트 (2026-10-03)

지금은 앱이 쓰는 외부 서비스가 전부 장수철 개인 명의다. 법인(안팜) 설립 후 옮겨야 할 것을
**코드와 설정에서 실제로 확인한 것만** 적었다. 출처: `care-app/app.json`, `eas.json`,
`src/lib/kakaoAuth.ts`, `supabase/functions/ai/index.ts`, `tools/hff/fetch_hff.py`, EAS/App Store Connect 조회.

## 0. 순서 (병목부터)

1. **사업자등록 → D-U-N-S 번호 발급** (무료, 며칠~2주). Apple·Google 조직 계정 둘 다 요구한다. 전체 일정의 병목.
2. 사업자 없이도 되는 것 먼저: Supabase · Expo · Vercel · GitHub 이전 (30분, 사용자에게 보이는 변화 없음).
3. 카카오 비즈 앱 전환 (사업자등록번호만 있으면 됨).
4. Apple · Google 조직 계정 개설 → 앱 이전. 이전 중 하루 정도 새 빌드를 못 올리니 배포 일정과 겹치지 않게.
5. OpenAI 법인 조직 + 키 교체, 식약처 API 키 재발급.
6. 앱 안의 명의(개인정보처리방침·스토어 설명) 수정 → 빌드.

## 1. 서비스별 체크리스트

| # | 서비스 | 지금 (개인) | 법인으로 바꾸는 방법 | 코드/설정 변경 | 담당·상태 |
|---|---|---|---|---|---|
| 1 | **Apple Developer / App Store Connect** | 개인 팀 `NR4Y2WD2S7`(Sucheol Jang, Individual), 앱 ID 6797708328, 번들 `com.modoobokyak.app` | D-U-N-S 번호로 **법인 Organization 계정** 신규 등록(승인 1~2주) → App Store Connect **앱 이전(App Transfer)**. 주의: 이전은 **App Store에 한 번이라도 심사 통과한 앱**만 가능. 아직 출시 전이면 법인 계정에서 새 앱으로 등록하고, 번들 ID를 그대로 쓰려면 개인 계정에서 그 ID를 먼저 삭제 | 인증서·프로비저닝 재발급, EAS 자격 증명 재연결, `eas.json`의 `ascAppId`가 바뀌면 수정 | ☐ |
| 2 | **Google Play Console** | 개인 개발자 계정, 패키지 `com.care.bokyak` | 법인 개발자 계정 개설(D-U-N-S) → 콘솔 **앱 이전** 요청(미출시 앱도 가능) | 없음(Play 앱 서명이면 키 유지) | ☐ |
| 3 | **Kakao Developers** | 개인 앱. REST 키는 `app.json`의 `kakaoRestKey`, 클라이언트 시크릿은 엣지 함수 환경변수 | 카카오 콘솔 **비즈 앱 전환**(사업자등록번호) + 팀 관리자에 법인 카카오 계정 추가 후 소유권 이전. **새 앱을 만들면 안 됨** — 앱 ID가 바뀌면 사용자의 `kakao_id`가 달라져 기존 사용자 복구가 끊긴다. 비즈 앱이 되면 지금 못 쓰던 `account_email` 동의 항목도 열린다 | 키가 유지되면 없음. 바뀌면 `app.json` `kakaoRestKey` + 엣지 함수 `KAKAO_REST_KEY`·`KAKAO_CLIENT_SECRET` | ☐ |
| 4 | **Supabase** | 개인 Organization 아래 프로젝트 `atzosfqrzsfrveympcfj` | 법인 Organization 생성 → Settings → **Transfer project**. URL·anon 키 그대로 | 없음 | ☐ |
| 5 | **Expo / EAS** | 계정 `shawn777`, 프로젝트 `248ad789-5d52-4843-a401-20c7a22afc9e` | 법인 Organization 생성 → 프로젝트 이전. 빌드 자격 증명(Apple API 키·Android 키스토어)은 다시 넣어야 할 수 있음 | `app.json`의 `owner`를 새 조직명으로 | ☐ |
| 6 | **Vercel** | 개인 계정, 카카오 로그인 중계 페이지 `https://modubokyak.vercel.app/kakao-callback.html` | 팀(Team) 생성 → 프로젝트 이전. 도메인이 `vercel.app` 그대로면 주소 유지 | 주소가 바뀌면 `kakaoAuth.ts`의 `REDIRECT_URI`와 카카오 콘솔 Redirect URI 둘 다 | ☐ |
| 7 | **OpenAI API** | 개인 키(엣지 함수 `OPENAI_API_KEY`: TTS 미리듣기, 약 이름 파싱, OCR) | 법인 Organization 생성, 결제 수단 법인 카드, 새 키 발급 | 엣지 함수 환경변수 교체. `app.json`의 `openaiApiKey`는 빈 값이라 무관 | ☐ |
| 8 | **GitHub** | `Apple7575/ai-bokkyak` (개인) | 법인 Organization 생성 → 저장소 Transfer. 옛 주소는 자동 리다이렉트 | 없음 | ☐ |
| 9 | **식약처 공공데이터 API** | 개인 인증키(`tools/hff/fetch_hff.py`: 건기식 I0030·I2710, DUR) | 공공데이터포털에서 법인 명의로 재발급 | 스크립트 실행 시 키만 교체 | ☐ |
| 10 | **Claude / Codex 구독** | 공용 요금제(9/10 회의: 5배 요금제로 조정) | 법인 카드로 결제 수단 변경, 가능하면 팀 플랜 | 없음 | ☐ |

## 2. 앱 안에서 바꿔야 하는 것 (빌드 필요)

| 항목 | 위치 | 바꿀 내용 |
|---|---|---|
| 개인정보처리방침 | `src/screens/PrivacyScreen.tsx` | 개인정보 처리자·책임자를 법인명·대표자·법인 연락처로. 현재 문구에는 개인 이름이 없지만 "처리자" 항목이 없으니 추가 필요 |
| 스토어 등록 정보 | App Store Connect · Play Console | 개발자명, 지원 연락처, 개인정보처리방침 URL(현재 없음 — 법인 도메인 또는 Vercel 페이지로 하나 만들어야 함) |
| Apple 규정 준수 정보 | App Store Connect → 비즈니스 → 계약 | 개인 → 법인(사업자등록번호·통신판매업 신고번호)으로 갱신. 2026-10-03에 개인으로 입력해 둔 상태 |

## 3. 바꿀 필요 없는 것

- Supabase DB 데이터·테이블·RPC, 앱 코드 로직 — 명의와 무관.
- 사용자의 `kakao_id`·`patient_id` — 카카오 앱을 이전(새로 만들지 않음)하면 그대로 유효.

## 4. 이전 후 확인 명령

```bash
cd care-app
grep -n "owner\|kakaoRestKey\|ascAppId" app.json eas.json   # 새 값인지
npm run check:server                                        # Supabase 이전 후 RPC 정상
```
그리고 실기기에서 카카오 로그인(불러오기·연결하기) 한 번, EAS 빌드 한 번.
