# 알람 신뢰성 v2 설계

**목표:** 복약 알람을 "예약했으면 무슨 일이 있어도 정시에 울린다" 수준으로 끌어올린다. 외부 알람 전문가 피드백(반복 트리거→1회 재예약, 권한 경고, 부팅/시간변경 재예약, iOS 버스트 개수 관리)을 전부 반영한다.

**확인된 사실(중요):** 설치된 `@notifee/react-native`의 AndroidManifest에는 `NotifeeInitProvider`만 있고 **BOOT_COMPLETED 리시버/RECEIVE_BOOT_COMPLETED 권한이 없다.** 안드로이드는 재부팅 시 AlarmManager 예약이 전부 삭제되므로, **부팅 후 재예약을 직접 구현하지 않으면 "폰 껐다 켜면 알람이 안 울리는" 문제가 발생한다.** → 네이티브 리시버(E)는 필수.

**아키텍처 요약:** 매일/주간 **반복 트리거를 폐기**하고, **"다음 1회 정확 알람"** 으로 바꾼다(setExactAndAllowWhileIdle는 1회성만 정확·Doze면제 가능하기 때문). 안드로이드는 알람이 울릴 때(DELIVERED 백그라운드 이벤트)와 응답 시 **다음 발생분을 재계산해 다시 1회 예약**한다. iOS는 백그라운드 체이닝이 불가하므로 **가까운 48시간치만 윈도우로 예약**하고, 앱 실행/응답 시 **재무장**한다. 부팅·시간변경은 **네이티브 BroadcastReceiver → HeadlessJsTask → 전체 재동기화**로 복구한다.

**기술 스택:** React Native + Expo (EAS, config-plugin), TypeScript, `@notifee/react-native`, RN HeadlessJsTask + 커스텀 Android BroadcastReceiver(config-plugin로 주입), jest.

---

## A. 반복 트리거 → "다음 1회 정확 알람" 재예약 (1순위)

- `lib/schedule.ts`에 순수 함수 `nextFireAt(spec, now)`: 매일(빈 repeat_days) 또는 요일 배열에 대해 **다음 발생 시각(미래의 가장 가까운 hour:minute, 요일 일치)** 을 반환. (기존 `nextNotificationTime` 재사용/확장)
- `scheduleReminders(scheduleId, …)`: `RepeatFrequency.DAILY/WEEKLY` 제거. **다음 1회**만 `TriggerType.TIMESTAMP`(repeatFrequency 없음) + `alarmManager: { allowWhileIdle: true }`(권한 시)로 예약. id는 `alarm-${scheduleId}`(단일).
- **재예약(체이닝):** 알람이 발사되면 `index.ts`/`App.tsx`의 `DELIVERED` 이벤트에서 그 일정의 **다음 발생분을 다시 1회 예약**. 응답(완료/건너뛰기) 처리 후에도 다음 1회를 예약(이미 울린 회차 다음으로). → 매 회차가 정확 알람으로 유지됨.
- 안드로이드는 DELIVERED가 백그라운드에서도 동작하므로 체이닝이 유지된다. iOS는 B로 보완.

## B. iOS — 48시간 윈도우 예약 + 재무장 + 오래된 것 취소 (5순위)

- iOS는 매 발사 시 JS가 못 도므로, `scheduleIosWindow(scheduleId, …)`: **앞으로 48시간 내** 발생하는 도즈마다 `(기본 1 + 버스트 N개)`를 예약하되, **총 예약 개수가 iOS 64개 한도에 안전하도록** 버스트 개수를 동적으로 줄인다(예: 활성 일정 수에 따라 버스트 2~6개).
- 재무장: 앱 실행/AppState 활성화 시 + 응답(stopAlarm) 시 → 윈도우 재예약. **오래된/지난 버스트는 먼저 취소**(`alarm-${id}-burst-*`, `alarm-${id}-win-*`).
- 안전장치: `getTriggerNotificationIds()`로 현재 예약 개수를 확인해 한도 초과를 방지(초과 시 가장 먼 것부터 생략하고 `log`).

## C. 앱 실행/활성화 시 전체 재동기화 (3·4순위 실용 커버)

- `lib/alarmSync.ts`: `resyncAllAlarms()` — 활성 일정 전체를 조회해, 각 일정의 **다음 1회(Android)/윈도우(iOS)** 를 재계산·재예약(기존 것 취소 후). 멱등.
- 호출 지점: 앱 콜드스타트(App 마운트), AppState `active` 복귀. → 시간/타임존을 바꾼 뒤 앱을 한 번 열면 다음 알람이 정정된다.

## D. 권한 꺼짐 강한 경고 (2순위)

- `lib/alarmPermissions.ts`에 `hasExactAlarm(): Promise<boolean>` 추가(정확 알람 허용 여부).
- **홈 화면 경고 배너**(`HomeScreen`): 정확 알람이 꺼져 있으면 상단에 빨간 배너 + "설정 이동" 버튼. 문구:
  > "정확한 복약 알람을 위해 '알람 및 리마인더' 권한이 필요해요. 이 권한이 꺼져 있으면 알람이 늦게 울릴 수 있습니다."
- **등록 시 경고:** 알람 등록 직후 권한이 꺼져 있으면 같은 취지의 Alert(이미 일부 있음 — 통일).
- 탭하면 `notifee.openAlarmPermissionSettings()`.

## E. 네이티브 리시버 — 부팅/시간변경 재예약 (3·4순위, 필수)

- **config-plugin**(`plugins/withAlarmReceiver.js`)로 Android에 주입:
  - `RECEIVE_BOOT_COMPLETED` 권한.
  - `BroadcastReceiver`(Kotlin) — 인텐트 필터: `BOOT_COMPLETED`, `QUICKBOOT_POWERON`, `TIME_SET`, `TIMEZONE_CHANGED`, `DATE_CHANGED`.
  - 수신 시 `HeadlessJsTaskService`로 JS 태스크 `"AlarmResync"` 실행.
- `index.ts`: `AppRegistry.registerHeadlessTask("AlarmResync", () => async () => { await resyncAllAlarms(); })`.
- → 재부팅·시간변경 후에도 앱을 안 열어도 다음 알람이 재예약된다.
- **빌드/검증:** config-plugin은 EAS prebuild에서 매니페스트+Kotlin을 주입. **새 빌드 필요**, 실기기 재부팅/시간변경 시나리오 수동 검증 필수.

---

## 테스트 / 검증

- **순수 로직 jest:** `nextFireAt`(매일/요일/경계/자정), iOS 윈도우 산정(48h 내 도즈 나열 + 버스트 개수 캡), 재동기화 대상 선별.
- **수동 실기기(안드로이드 필수):** 발사→다음 재예약 유지, 재부팅 후 알람 유지, 시간/타임존 변경 후 앱 열면 정정, 권한 끄면 홈 배너+등록 경고, iOS는 윈도우 예약 개수 한도 내.
- `npx tsc --noEmit`, `npx jest`, Codex 교차리뷰.

## 범위 밖

- iOS Critical Alerts(무음 관통) 애플 신청.
- 커스텀 STREAM_ALARM 등 추가 네이티브 사운드.
