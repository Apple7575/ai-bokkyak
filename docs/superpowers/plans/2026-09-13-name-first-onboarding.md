# 이름 먼저 온보딩(B안) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 별도 가입 화면 없이 1분 점검 3/3에서 이름 한 줄을 받아 그 순간 환자 레코드를 만들고, 결과는 잠금 없이 한 번에 전부 보여 주며, 카카오는 "가입"이 아니라 "기기 이전용 연결"로 자리를 옮긴다 (2026-09-10 회의 결정 5·6·8, 목업 `온보딩-전체플로우-목업.html` B안).

**Architecture:** 환자 생성 시점을 "가입 화면"에서 "점검 3/3의 내 복용 분석하기"로 옮긴다. 점검 없이 건너뛴 사용자(Case C·D)는 이름 한 칸짜리 `NameEntry` 화면에서 같은 일을 한다. 결과 화면은 가입 전/후 두 상태를 버리고 "전체 공개" 하나만 남긴다. 카카오는 `lib/kakaoAccount.ts` 뒤에 두고 복구(intro·NameEntry)와 연결(알람 완료·홈 배너·더보기)의 두 역할로 나눈다. 연결은 RLS가 `patients` update를 막으므로 서버 함수 `link_kakao`로 한다.

**Tech Stack:** React Native 0.81 + Expo SDK 54, TypeScript, Supabase (anon, RLS tier1), jest(jest-expo). 기존 규칙 `AGENTS.md` 전부 적용.

## Global Constraints

- 모든 사용자 노출 문구는 한국어. 디자인 토큰은 `src/theme/tokens.ts`에서만. 본문 ≥18px, 주요 버튼 ≥56px(`BigButton`).
- 순수 로직은 RN/네트워크 의존 없이 jest. 화면은 `npx tsc --noEmit` + 실기기 수동.
- 3대 설계 결정(repeat_days `[]`=매일 / intake_records upsert / 응답은 화면 터치) 건드리지 않음.
- 소리·네트워크가 버튼을 막지 않는다: 눌린 버튼만 busy, 나머지 입력은 살아 있어야 한다.
- Supabase 에러는 삼키지 않고 Alert로 알린다.
- "가입"·"회원가입" 문구를 사용자 화면에서 없앤다. 카카오는 "연결" / "불러오기"로 말한다.
- 생년월일·성별은 받지 않는다(`patients.birth_date`·`gender`는 nullable, 회의 결정 8).
- 잠금(첫 건 공개 + 나머지 잠금)은 없앤다(목업 B-1). 안전 정보를 대가로 잠그지 않는다.
- 커밋마다 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` 와 `Claude-Session: https://claude.ai/code/session_01Ejb1ZPFuYmtAFB5ZntAer5` 두 줄로 끝낸다. 작업 트리의 무관한 미커밋 파일(`index.ts`, `applyPretendard.tsx`, `metro.config.js`, `web-shims/`, 루트 untracked)은 절대 add 하지 않는다.

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `src/lib/storage.ts` (수정) | `care.patientName` 저장/조회 추가 |
| `src/lib/kakaoAccount.ts` (신규) | `restoreWithKakao()` 복구, `linkKakao()` 연결, `isKakaoLinked()`, 순수 `linkResultMessage()` |
| `src/screens/NameEntryScreen.tsx` (신규, `RoleSelectScreen.tsx` 삭제) | Case C·D: 이름 한 칸 → 시작 |
| `src/navigation/types.ts`, `RootNavigator.tsx` (수정) | `RoleSelect` → `NameEntry`, 결과 params 정리 |
| `src/screens/IntroScreen.tsx` (수정) | CTA 하단 "카카오로 불러오기", 라우팅 |
| `src/screens/QuickCheckInputScreen.tsx` (수정) | 3/3에 이름 칸, 분석 직전 환자 생성 |
| `src/screens/QuickCheckAnalyzingScreen.tsx` (수정) | 판정 직후 서버 저장(commit), 결과로 전체 전달 |
| `src/screens/QuickCheckResultScreen.tsx` (수정) | 잠금·가입 시트 제거, 전체 공개, 알람/나중에 버튼 |
| `src/lib/quickCheck.ts` (수정) | `lockedGroups`·`splitResult` 제거, `checkedNamesLine()` 추가 |
| `src/lib/quickCheckRules.ts` (수정) | `LOCKED_GROUPS` 제거 |
| `supabase/migrate-kakao-link.sql` (신규) | `public.link_kakao` RPC |
| `src/screens/SettingsScreen.tsx`, `VoiceGuideScreen.tsx`, `HomeScreen.tsx` (수정) | 카카오 연결 자리 3곳 + 홈 인사 |
| `src/__tests__/quickCheck.test.ts`, `kakaoAccount.test.ts` | 순수 로직 테스트 |

---

### Task 1: 이름 저장 + NameEntry 화면 + 라우팅 (Case C·D, 카카오 복구)

**Files:**
- Modify: `care-app/src/lib/storage.ts`
- Create: `care-app/src/lib/kakaoAccount.ts`
- Create: `care-app/src/screens/NameEntryScreen.tsx`
- Delete: `care-app/src/screens/RoleSelectScreen.tsx`
- Modify: `care-app/src/navigation/types.ts`, `care-app/src/navigation/RootNavigator.tsx`
- Modify: `care-app/src/screens/IntroScreen.tsx` (CTA 하단 링크, `leave()` 경로)
- Modify: `RoleSelect` 참조 전부 — `QuickCheckInputScreen.tsx`(goBack/skip), `QuickCheckAnalyzingScreen.tsx`(실패 화면 버튼), `PrivacyScreen.tsx`, `SettingsScreen.tsx`, `QuickCheckResultScreen.tsx`(`toSignup` — Task 2에서 지우지만 컴파일이 되도록 여기서 `NameEntry`로 바꿔 둔다)
- Test: `care-app/src/__tests__/kakaoAccount.test.ts`

**Interfaces:**
- Produces `storage.ts`: `getPatientName(): Promise<string | null>`, `setPatientName(name: string): Promise<void>`; `KEYS.patientName = "care.patientName"` 이 `clearAll()`에 포함.
- Produces `kakaoAccount.ts`:
  ```ts
  export type RestoreResult = { ok: true; patientId: string; name: string } | { ok: false; canceled: boolean; message: string };
  export async function restoreWithKakao(): Promise<RestoreResult>;
  export const RESTORE_NOT_FOUND = "이 카카오 계정으로 저장된 정보가 없어요. 처음이시면 이름으로 시작해 주세요.";
  ```
  동작: `signInWithKakao()` → 실패면 그대로 전달 → `patients.select("id,name").eq("kakao_id", kakaoId).maybeSingle()` → 에러면 throw 대신 `{ok:false, canceled:false, message:"인터넷 연결을 확인해 주세요."}` → 없으면 `RESTORE_NOT_FOUND` → 있으면 `setPatient(id)`, `setPatientName(name)`, `setOnboarded()` 후 ok.
- Produces route `NameEntry: undefined` (types.ts). `RoleSelect` 키 제거.

- [x] **Step 1: storage에 이름 저장 추가** — `KEYS`에 `patientName: "care.patientName"`, 두 함수 추가. 기존 테스트 없음(AsyncStorage 목 없음) — `npx tsc --noEmit`로 확인.
- [x] **Step 2: `kakaoAccount.test.ts` 작성(실패 확인)** — `restoreWithKakao`는 네트워크라 테스트하지 않는다. 대신 이 파일에 순수 함수 `restoreMessage(found: boolean): string`를 두지 말고, Task 3의 `linkResultMessage`를 위해 파일만 만든다. 이 Task에서는 테스트 파일에 `describe.todo`를 두지 말고, `restoreWithKakao` 의 not-found 문구 상수 export 를 `toBe`로 고정하는 1개 테스트만 둔다.
  ```ts
  jest.mock("../lib/supabase", () => ({ supabase: { from: jest.fn() } }));
  jest.mock("../lib/kakaoAuth", () => ({ signInWithKakao: jest.fn() }));
  import { RESTORE_NOT_FOUND } from "../lib/kakaoAccount";
  it("복구 실패 문구는 '이름으로 시작'을 안내한다", () => { expect(RESTORE_NOT_FOUND).toContain("이름으로 시작"); });
  ```
- [x] **Step 3: `kakaoAccount.ts` 구현** (위 인터페이스대로, RN import 없음: `storage`·`supabase`·`kakaoAuth`만).
- [x] **Step 4: `NameEntryScreen.tsx` 작성** — 구성(위에서 아래):
  - 상단 인셋, `KeyboardAvoidingView behavior="padding"` 최외곽(키보드 수정 커밋 19819f9와 같은 방식), ScrollView `keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"`.
  - 고르다 만 초안이 있으면(`loadDraft()` 결과가 있고 `findings === null`) 배너 Pressable "고르다 만 1분 점검이 있어요 · 이어서 하기" → `nav.navigate("QuickCheckInput")` (RoleSelect의 것을 옮긴다).
  - `Logo` + "모두의 복약".
  - 제목 "어떻게 불러드릴까요?" / 부제 "결과를 알려드릴 때 사용해요".
  - `TextInput` placeholder "홍길동", `maxLength={20}`, `returnKeyType="done"`, `onSubmitEditing`=시작.
  - 안내문 "비밀번호도 이메일도 없어요. 이름만 있으면 바로 시작할 수 있어요."
  - `BigButton label="시작하기"` (busy면 "시작하는 중…", disabled=이름 비었을 때). onPress: `supabase.from("patients").insert({ name }).select("id").single()` → `setPatient(id)`, `setPatientName(name)` → `nav.reset({ index: 0, routes: [{ name: "Tabs" }] })`. 에러: `Alert.alert("시작하지 못했어요", error.message ?? "인터넷 연결을 확인하고 다시 시도해 주세요.")`, busy 해제.
  - 하단 보조 링크 두 개(Pressable, 본문 18px, 높이 ≥56): "이미 쓰던 계정이 있어요 · 카카오로 불러오기" → `restoreWithKakao()` → ok면 `nav.reset` Tabs, 아니면 canceled가 아닐 때만 `Alert.alert("카카오로 불러오기", message)`; "둘러보기 (데모)" → 기존 `enterDemo()` 그대로.
  - 스타일은 RoleSelect의 것을 가져오되 성별·생년월일 관련은 모두 삭제. `birthInput.ts`는 지우지 않는다(테스트가 있음).
- [x] **Step 5: 라우팅 교체** — `types.ts`: `RoleSelect` 삭제, `NameEntry: undefined` 추가. `RootNavigator.tsx`: import/Screen 교체, 초기 라우트 `!signedUp && !onboarded ? "Intro" : !signedUp ? "NameEntry" : "Tabs"`(알람 우선 로직은 그대로). `IntroScreen.tsx`: `startQuickCheck = () => leave([{ name: "QuickCheckInput" }])`, `skipSetup = () => leave([{ name: "NameEntry" }])`; CTA 하단(두 버튼 아래)에 Pressable "이미 쓰던 계정이 있어요 · 카카오로 불러오기" (textSecondary, 18px, 높이 56) → `restoreWithKakao()` → ok면 `leave([{ name: "Tabs" }])`, 아니면 canceled 아닐 때 Alert. 다른 파일의 `"RoleSelect"` 문자열을 전부 `"NameEntry"`로. `QuickCheckAnalyzingScreen.tsx`의 버튼 라벨 "건너뛰고 가입하기" → "건너뛰고 시작하기". `QuickCheckInputScreen.tsx`의 goBack 폴백·skip → `NameEntry`(Task 2에서 환자 유무에 따라 Tabs로 바꾼다).
- [x] **Step 6: 검증** — `npx tsc --noEmit`, `npm test` 통과. `grep -rn "RoleSelect" src` 결과 0건.
- [x] **Step 7: 커밋** — `feat: 가입 화면을 이름 한 칸(NameEntry)으로 — 카카오는 복구 링크로, RoleSelect 삭제`.

---

### Task 2: 점검 3/3 이름 + 환자 생성 + 결과 전체 공개 (Case A·B)

**Files:**
- Modify: `care-app/src/screens/QuickCheckInputScreen.tsx`
- Modify: `care-app/src/screens/QuickCheckAnalyzingScreen.tsx`
- Modify: `care-app/src/screens/QuickCheckResultScreen.tsx`
- Modify: `care-app/src/lib/quickCheck.ts`, `care-app/src/lib/quickCheckRules.ts`
- Modify: `care-app/src/navigation/types.ts` (QuickCheckResult params)
- Modify: `care-app/src/screens/HomeScreen.tsx` (인사말만)
- Test: `care-app/src/__tests__/quickCheck.test.ts`

**Interfaces:**
- Consumes Task 1: `getPatientId/setPatient/getPatientName/setPatientName`, route `NameEntry`.
- Produces `quickCheck.ts`:
  ```ts
  /** "혈압약 · 오메가3 · 비타민D 를 대조했어요" — 4개 이상이면 앞 3개 + "외 N개" */
  export function checkedNamesLine(names: string[]): string;
  ```
  규칙: 0개 → `""`; 1~3개 → `${names.join(" · ")} 를 대조했어요`; 4개 이상 → `${names.slice(0,3).join(" · ")} 외 ${names.length-3}개를 대조했어요`.
- Produces route params:
  ```ts
  QuickCheckResult: {
    findings?: QuickFinding[]; unmatched?: string[]; names?: string[]; durUnavailable?: boolean;
    unmappedIngredients?: string[]; uncoveredConditions?: string[]; engine?: "server" | "local";
  } | undefined;
  ```
  (`unlocked`·`checked` 제거. `checked`는 `names.length - unmatched.length`로 계산.)

- [x] **Step 1: 테스트 먼저** — `quickCheck.test.ts`에서 `lockedGroups`/`splitResult` 테스트를 지우고 `checkedNamesLine` 테스트 추가:
  ```ts
  it("checkedNamesLine — 3개까지는 전부, 4개부터는 외 N개", () => {
    expect(checkedNamesLine([])).toBe("");
    expect(checkedNamesLine(["혈압약"])).toBe("혈압약 를 대조했어요");
    expect(checkedNamesLine(["혈압약","오메가3","비타민D"])).toBe("혈압약 · 오메가3 · 비타민D 를 대조했어요");
    expect(checkedNamesLine(["a","b","c","d","e"])).toBe("a · b · c 외 2개를 대조했어요");
  });
  ```
  실행해 실패 확인 → 구현 → 통과. `lockedGroups`·`splitResult`·`LOCKED_GROUPS` 삭제(다른 참조가 없는지 grep).
- [x] **Step 2: `QuickCheckInputScreen.tsx` 3/3** —
  - 상태 `name`(초기값: `getPatientName()`이 있으면 그것).
  - 3/3 렌더: 제목 "마지막으로 몇 가지만", 부제 "나이와 상태에 따라 주의할 조합이 달라요". 첫 질문 "어떻게 불러드릴까요?" + `TextInput`(placeholder "홍길동", maxLength 20, 기존 `styles.input`류 재사용, 높이 ≥56). 그 다음 기존 연령대·해당 항목 그대로. 도움말은 "복용 조합을 확인하기 위한 최소 정보입니다. 비밀번호도 이메일도 없어요."
  - `canNext`(profile 단계) = `name.trim().length > 0 && age !== null`.
  - `next()` profile 단계: draft 저장 전에 환자 보장: `let pid = await getPatientId(); if (!pid) { const { data, error } = await supabase.from("patients").insert({ name: name.trim() }).select("id").single(); if (error || !data) { Alert.alert("시작하지 못했어요", error?.message ?? "인터넷 연결을 확인하고 다시 시도해 주세요."); return; } await setPatient(data.id); }` 그리고 항상 `await setPatientName(name.trim())`. 이후 기존 `saveDraft` → `QuickCheckAnalyzing`. `nextBusy`로 이중 탭 방지 유지. 버튼은 busy 동안 "잠시만요…".
  - `skip()`/`goBack()` 폴백: 환자가 있으면 `Tabs`, 없으면 `NameEntry`.
- [x] **Step 3: `QuickCheckAnalyzingScreen.tsx`** — `run()`에서 `saveDraft` 성공 후: `const pid = await getPatientId(); let committed: QuickCheckDraft | null = null; if (pid) { try { committed = await commitQuickCheckDraft(pid); } catch { committed = null; } }` (실패는 삼키되 초안이 남아 HomeScreen이 재시도한다 — 이 동작은 이미 있다). 최소 표시 시간 대기 후 `nav.replace("QuickCheckResult", committed ? { findings: committed.findings, unmatched: committed.unmatched, names: checkItems(committed), durUnavailable: committed.durUnavailable === true, unmappedIngredients: committed.unmappedIngredients ?? [], uncoveredConditions: committed.uncoveredConditions ?? [], engine: committed.engine } : undefined)`. 실패 화면의 보조 버튼: 환자가 있으면 "건너뛰고 홈으로"(Tabs), 없으면 "건너뛰고 시작하기"(NameEntry).
- [x] **Step 4: `QuickCheckResultScreen.tsx` 전면 정리** —
  - 삭제: `unlocked`, `lockedCount`, `lockedGroups`, `topFinding` 기반 "가장 먼저 확인" 카드, 가입 시트(`sheet === "signup"` 분기와 `toSignup`), "결과 저장하고 …" 버튼들, "무료 회원가입 · 결과 자동 저장" 문구, `Modal`의 signup 분기(공유 분기만 남김).
  - 상태 로드: params가 있으면 params, 없으면 draft에서(기존 방식). `names` = params.names ?? checkItems(draft). `name` = `getPatientName()`.
  - 렌더 순서: ① 제목 — `summary.total > 0 ? `${name ? name + "님, " : ""}확인 필요 ${summary.total}건` : "확인된 주의 조합이 없어요"`; ② 부제 `checkedNamesLine(names)`(빈 문자열이면 생략); ③ 안내 노트들(로컬 폴백·DUR 불가·점검하지 못한 항목·확인하지 못한 정보·성분 미매핑) — 기존 컴포넌트 그대로, `!unlocked` 조건만 제거; ④ 0건이면 카드 한 장: "고르신 약과 영양제 사이에 알려진 주의 조합은 없었어요." (약사 문장은 여기서 빼고 하단 고지 한 곳으로 모은다); ⑤ 1건 이상이면 `groupByKind(findings)`로 종류별 전부(`KIND_LABEL` + `FindingCard`); ⑥ `nothingChecked`(대조 2개 미만)면 기존 "점검할 조합이 부족해요" + "다시 고르기"; ⑦ 버튼: 주 `BigButton label="이 약들 복용 알람 설정하기"`(`nav.reset({index:1, routes:[{name:"Tabs"},{name:"VoiceGuide"}]})`), 보조 `BigButton variant="secondary" label="나중에 할게요"`(`nav.reset({index:0, routes:[{name:"Tabs"}]})`); `nothingChecked`면 주 버튼을 "다시 고르기"(QuickCheckInput)로, 보조는 그대로; ⑧ 공유 박스는 유지하되 제목만 "가족·지인에게 1분 점검 보내기" 한 줄 링크로 축소; ⑨ 고지: "스스로 약을 끊거나 바꾸지 마시고, 약사나 의사에게 꼭 확인하세요." 한 번 + `DISCLAIMER` 한 번. 회의 12번: 중복 문구 제거.
  - 사용하지 않게 된 스타일·import 정리(`lockedCount` 등).
- [x] **Step 5: `HomeScreen.tsx` 인사** — `getPatientName()` 읽어 `name ? `${name}님, 안녕하세요` : "안녕하세요!"`. 그 외 변경 없음.
- [x] **Step 6: 검증** — `npx tsc --noEmit`, `npm test`. `grep -rn "unlocked\|lockedGroups\|splitResult\|회원가입\|가입하" src` → 사용자 문구/코드 잔재 0건(주석 제외).
- [x] **Step 7: 커밋** — `feat: 1분 점검 3/3에서 이름을 받아 환자 생성, 결과는 잠금 없이 전체 공개 — 알람 설정/나중에 두 갈래`.

---

### Task 3: 카카오 "연결" 자리 3곳 + 서버 함수

**Files:**
- Create: `care-app/supabase/migrate-kakao-link.sql`
- Modify: `care-app/src/lib/kakaoAccount.ts` (`linkKakao`, `isKakaoLinked`, `linkResultMessage`)
- Modify: `care-app/src/screens/SettingsScreen.tsx`, `VoiceGuideScreen.tsx`, `HomeScreen.tsx`
- Modify: `care-app/src/lib/storage.ts` (`care.kakaoBannerDismissed`)
- Test: `care-app/src/__tests__/kakaoAccount.test.ts`

**Interfaces:**
- SQL:
  ```sql
  create or replace function public.link_kakao(p_patient_id uuid, p_kakao_id text)
  returns jsonb language plpgsql security definer set search_path = public as $$
  declare v_other uuid; v_current text;
  begin
    select kakao_id into v_current from patients where id = p_patient_id;
    if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
    if v_current is not null and v_current <> p_kakao_id then return jsonb_build_object('ok', false, 'reason', 'already_linked'); end if;
    select id into v_other from patients where kakao_id = p_kakao_id and id <> p_patient_id;
    if found then return jsonb_build_object('ok', false, 'reason', 'taken'); end if;
    update patients set kakao_id = p_kakao_id where id = p_patient_id;
    return jsonb_build_object('ok', true);
  end $$;
  revoke all on function public.link_kakao(uuid, text) from public;
  grant execute on function public.link_kakao(uuid, text) to anon, authenticated;
  ```
  파일 머리 주석: RLS tier1이 patients update를 막아 RPC로 감쌌다는 것, Supabase SQL Editor에서 실행해야 앱의 "카카오 연결하기"가 동작한다는 것.
- `kakaoAccount.ts`:
  ```ts
  export type LinkReason = "not_found" | "already_linked" | "taken" | "network";
  export function linkResultMessage(reason: LinkReason): string;
  // not_found → "내 정보를 찾지 못했어요. 앱을 다시 시작해 주세요."
  // already_linked → "이미 다른 카카오 계정과 연결돼 있어요."
  // taken → "이 카카오 계정은 다른 휴대폰의 정보와 이미 연결돼 있어요. 그 정보를 쓰시려면 '카카오로 불러오기'를 눌러 주세요."
  // network → "인터넷 연결을 확인하고 다시 시도해 주세요."
  export async function linkKakao(patientId: string): Promise<{ ok: true } | { ok: false; canceled: boolean; message: string }>;
  export async function isKakaoLinked(patientId: string): Promise<boolean | null>; // null = 조회 실패
  ```
  `linkKakao`: `signInWithKakao()` → `supabase.rpc("link_kakao", { p_patient_id, p_kakao_id })` → `error`면 `{ok:false, canceled:false, message: linkResultMessage("network")}`(RPC가 없을 때도 여기로 온다) → `data.ok`가 아니면 `linkResultMessage(data.reason)`.
- `storage.ts`: `getKakaoBannerDismissed(): Promise<boolean>`, `setKakaoBannerDismissed(): Promise<void>`, 키 `care.kakaoBannerDismissed` (clearAll 포함).

- [ ] **Step 1: 테스트 먼저** — `kakaoAccount.test.ts`에 `linkResultMessage` 4가지 문구 `toContain`으로 고정. 실패 확인 후 구현.
- [ ] **Step 2: SQL 파일** 작성(위 그대로).
- [ ] **Step 3: `SettingsScreen.tsx` 계정 영역(목록 맨 위)** — 카드: 첫 줄 `name`(없으면 "이름 없음"), 둘째 줄 linked ? "카카오와 연결돼 있어요 · 휴대폰을 바꿔도 그대로" : "이 휴대폰에만 저장돼 있어요", 미연결일 때만 `BigButton variant="secondary" label="카카오 연결하기"`(busy 시 "연결 중…"). 성공 → `Alert.alert("연결됐어요", "휴대폰을 바꿔도 이 정보를 그대로 쓸 수 있어요.")` 후 상태 갱신. 실패는 canceled가 아닐 때만 Alert. 조회 실패(null)면 버튼은 보이되 상태 문구는 "연결 상태를 확인하지 못했어요".
- [ ] **Step 4: `VoiceGuideScreen.tsx` 완료 단계** — `state.step === "done"`에서 `isKakaoLinked(pid)`가 false일 때만 `doneCard` 아래에 카드: 제목 "휴대폰을 바꿔도 그대로", 본문 "지금 정보는 이 휴대폰에만 있어요. 카카오를 연결하면 새 기기에서도 이어서 쓸 수 있어요.", `BigButton variant="secondary" label="카카오 연결하기"`. 성공 시 카드가 사라지고 짧은 Alert. "홈으로 가기"는 그대로 아래.
- [ ] **Step 5: `HomeScreen.tsx` 배너** — `!linked && total >= 1 && !dismissed`일 때 인사말 아래 한 줄 배너: "휴대폰을 바꿔도 그대로 쓰시려면" + Pressable "연결"(→ `linkKakao`) + ✕(→ `setKakaoBannerDismissed`). 배너 높이 ≥56, 글자 18px.
- [ ] **Step 6: 검증** — tsc, jest. 실기기: SQL 미적용 상태에서도 앱이 죽지 않고 "인터넷 연결을 확인…" Alert만 뜨는지 코드로 확인.
- [ ] **Step 7: 커밋** — `feat: 카카오를 기기 이전용 연결로 — link_kakao RPC, 더보기 계정 영역, 알람 완료·홈 배너`.

---

### Task 4: 마무리 검증

- [ ] `cd care-app && npm test && npx tsc --noEmit`.
- [ ] `grep -rn "RoleSelect\|patient_code\|회원가입" src` 0건.
- [ ] 리뷰어(Claude) 1회: 세 커밋 합쳐서 정확성·AGENTS.md 준수. Codex는 쓰지 않는다(사용자 결정 2026-09-10).
- [ ] 문서: 이 계획 파일의 체크박스 갱신, `docs/quick-check-server-gap.md`는 변경 없음.
- [ ] 사용자에게: `migrate-kakao-link.sql` 실행 필요, 실기기 확인 항목(3/3 이름 입력 → 결과 전체 → 알람 설정 / 건너뛰기 → 이름 → 홈 / 인트로 카카오 불러오기 / 더보기 연결).
