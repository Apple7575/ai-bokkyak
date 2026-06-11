OpenAI Codex v0.135.0
--------
workdir: /Users/cruel/Desktop/AI-bokkyak
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 019eb692-33c4-7c93-a97c-a06a7ad06ea3
--------
user
changes against 'aad5601277b1b08e177fea7a4f372035abcf6b5c'
exec
/bin/zsh -lc 'git diff aad5601277b1b08e177fea7a4f372035abcf6b5c' in /Users/cruel/Desktop/AI-bokkyak
 succeeded in 0ms:
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-OiXwEwXH' (errno=Operation not permitted)
git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead
git: error: couldn't create cache file '/tmp/xcrun_db-oIlj26i4' (errno=Operation not permitted)
diff --git a/care-app/src/__tests__/intent.test.ts b/care-app/src/__tests__/intent.test.ts
new file mode 100644
index 0000000..a8a3a9a
--- /dev/null
+++ b/care-app/src/__tests__/intent.test.ts
@@ -0,0 +1,22 @@
+import { classifyIntent } from "../lib/intent";
+
+describe("classifyIntent", () => {
+  it("복용완료", () => {
+    expect(classifyIntent("먹었어요")).toBe("복용완료");
+    expect(classifyIntent("약 먹었어")).toBe("복용완료");
+    expect(classifyIntent("복용했어요")).toBe("복용완료");
+  });
+  it("미복용 (must beat 복용완료 substring 먹었)", () => {
+    expect(classifyIntent("아직 안 먹었어요")).toBe("미복용");
+    expect(classifyIntent("못 먹었어요")).toBe("미복용");
+  });
+  it("재알림 (highest priority)", () => {
+    expect(classifyIntent("30분 뒤에 다시 알려줘")).toBe("재알림");
+    expect(classifyIntent("이따 먹을게")).toBe("재알림");
+    expect(classifyIntent("나중에 알려줘")).toBe("재알림");
+  });
+  it("인식실패", () => {
+    expect(classifyIntent("오늘 날씨 좋네")).toBe("인식실패");
+    expect(classifyIntent("")).toBe("인식실패");
+  });
+});
diff --git a/care-app/src/__tests__/parse.test.ts b/care-app/src/__tests__/parse.test.ts
new file mode 100644
index 0000000..c7a472f
--- /dev/null
+++ b/care-app/src/__tests__/parse.test.ts
@@ -0,0 +1,23 @@
+import { validateParsedSchedule } from "../lib/parse";
+
+describe("validateParsedSchedule", () => {
+  it("accepts a valid GPT object and normalizes repeat_days", () => {
+    const r = validateParsedSchedule({
+      medicine_name: "고혈압약", time_of_day: "아침", hour: 8, minute: 0, repeat_days: "매일",
+    });
+    expect(r.ok).toBe(true);
+    if (r.ok) {
+      expect(r.value.medicine_name).toBe("고혈압약");
+      expect(r.value.repeat_days).toEqual([]);
+      expect(r.value.hour).toBe(8);
+    }
+  });
+  it("rejects out-of-range hour", () => {
+    const r = validateParsedSchedule({ medicine_name: "약", time_of_day: "아침", hour: 30, minute: 0 });
+    expect(r.ok).toBe(false);
+  });
+  it("rejects missing medicine_name", () => {
+    const r = validateParsedSchedule({ time_of_day: "아침", hour: 8, minute: 0 });
+    expect(r.ok).toBe(false);
+  });
+});
diff --git a/care-app/src/__tests__/schedule.test.ts b/care-app/src/__tests__/schedule.test.ts
new file mode 100644
index 0000000..f451a5c
--- /dev/null
+++ b/care-app/src/__tests__/schedule.test.ts
@@ -0,0 +1,26 @@
+import { normalizeRepeatDays, nextNotificationTime } from "../lib/schedule";
+
+describe("normalizeRepeatDays", () => {
+  it("매일 → []", () => {
+    expect(normalizeRepeatDays("매일")).toEqual([]);
+  });
+  it("day list → sorted unique ints", () => {
+    expect(normalizeRepeatDays([3, 1, 1])).toEqual([1, 3]);
+  });
+  it("nullish → []", () => {
+    expect(normalizeRepeatDays(undefined)).toEqual([]);
+  });
+});
+
+describe("nextNotificationTime", () => {
+  it("later today when time has not passed", () => {
+    const now = new Date("2026-06-11T07:00:00");
+    const next = nextNotificationTime({ hour: 8, minute: 0, repeat_days: [] }, now);
+    expect(next.toISOString()).toBe(new Date("2026-06-11T08:00:00").toISOString());
+  });
+  it("tomorrow when time already passed (daily)", () => {
+    const now = new Date("2026-06-11T09:00:00");
+    const next = nextNotificationTime({ hour: 8, minute: 0, repeat_days: [] }, now);
+    expect(next.toISOString()).toBe(new Date("2026-06-12T08:00:00").toISOString());
+  });
+});
diff --git a/care-app/src/lib/intent.ts b/care-app/src/lib/intent.ts
new file mode 100644
index 0000000..009de8b
--- /dev/null
+++ b/care-app/src/lib/intent.ts
@@ -0,0 +1,18 @@
+export type Intent = "복용완료" | "미복용" | "재알림" | "인식실패";
+
+const REMIND = ["나중에", "이따", "30분", "다시 알려", "다시알려"];
+const NOT_TAKEN = ["안 먹", "안먹", "못 먹", "못먹", "아직"];
+const TAKEN = ["먹었", "복용했", "먹음", "했어요", "먹었어"];
+
+function hasAny(text: string, keywords: string[]): boolean {
+  return keywords.some((k) => text.includes(k));
+}
+
+export function classifyIntent(raw: string): Intent {
+  const text = (raw ?? "").trim();
+  if (!text) return "인식실패";
+  if (hasAny(text, REMIND)) return "재알림";
+  if (hasAny(text, NOT_TAKEN)) return "미복용";
+  if (hasAny(text, TAKEN)) return "복용완료";
+  return "인식실패";
+}
diff --git a/care-app/src/lib/parse.ts b/care-app/src/lib/parse.ts
new file mode 100644
index 0000000..b9d5620
--- /dev/null
+++ b/care-app/src/lib/parse.ts
@@ -0,0 +1,27 @@
+import { normalizeRepeatDays } from "./schedule";
+
+export type ParsedSchedule = {
+  medicine_name: string; time_of_day: string;
+  hour: number; minute: number; repeat_days: number[];
+};
+export type ParseResult =
+  | { ok: true; value: ParsedSchedule }
+  | { ok: false; error: string };
+
+export function validateParsedSchedule(input: any): ParseResult {
+  if (!input || typeof input !== "object") return { ok: false, error: "not an object" };
+  const name = typeof input.medicine_name === "string" ? input.medicine_name.trim() : "";
+  if (!name) return { ok: false, error: "missing medicine_name" };
+  const hour = Number(input.hour);
+  const minute = Number(input.minute ?? 0);
+  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { ok: false, error: "bad hour" };
+  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return { ok: false, error: "bad minute" };
+  const tod = typeof input.time_of_day === "string" ? input.time_of_day : "";
+  return {
+    ok: true,
+    value: {
+      medicine_name: name, time_of_day: tod, hour, minute,
+      repeat_days: normalizeRepeatDays(input.repeat_days),
+    },
+  };
+}
diff --git a/care-app/src/lib/schedule.ts b/care-app/src/lib/schedule.ts
new file mode 100644
index 0000000..55233b8
--- /dev/null
+++ b/care-app/src/lib/schedule.ts
@@ -0,0 +1,25 @@
+export function normalizeRepeatDays(input: unknown): number[] {
+  if (input === "매일" || input == null) return [];
+  if (Array.isArray(input)) {
+    return Array.from(new Set(input.filter((n) => typeof n === "number"))).sort((a, b) => a - b);
+  }
+  return [];
+}
+
+type TimeSpec = { hour: number; minute: number; repeat_days: number[] };
+
+export function nextNotificationTime(spec: TimeSpec, now: Date): Date {
+  const candidate = new Date(now);
+  candidate.setSeconds(0, 0);
+  candidate.setHours(spec.hour, spec.minute, 0, 0);
+  const daily = spec.repeat_days.length === 0;
+  for (let i = 0; i < 8; i++) {
+    if (candidate.getTime() >= now.getTime() &&
+        (daily || spec.repeat_days.includes(candidate.getDay()))) {
+      return candidate;
+    }
+    candidate.setDate(candidate.getDate() + 1);
+    candidate.setHours(spec.hour, spec.minute, 0, 0);
+  }
+  return candidate;
+}
diff --git a/care-app/tsconfig.json b/care-app/tsconfig.json
index b9567f6..37179b8 100644
--- a/care-app/tsconfig.json
+++ b/care-app/tsconfig.json
@@ -1,6 +1,7 @@
 {
   "extends": "expo/tsconfig.base",
   "compilerOptions": {
-    "strict": true
+    "strict": true,
+    "types": ["jest", "node"]
   }
 }

exec
/bin/zsh -lc "ls -R care-app | head -100 && cat care-app/package.json && find care-app/src -maxdepth 3 -type f -not -path '*/__tests__/*' -print -exec sed -n '1,160p' {} \\;" in /Users/cruel/Desktop/AI-bokkyak
 succeeded in 0ms:
AGENTS.md
App.tsx
CLAUDE.md
LICENSE
app.json
assets
index.ts
jest.config.js
node_modules
package-lock.json
package.json
src
supabase
tsconfig.json

care-app/assets:
android-icon-background.png
android-icon-foreground.png
android-icon-monochrome.png
favicon.png
icon.png
splash-icon.png

care-app/node_modules:
@babel
@bcoe
@expo
@isaacs
@istanbuljs
@jest
@jridgewell
@react-native
@react-native-async-storage
@react-navigation
@sinclair
@sinonjs
@supabase
@tootallnate
@types
@ungap
@xmldom
abab
abort-controller
accepts
acorn
acorn-globals
acorn-walk
agent-base
anser
ansi-escapes
ansi-regex
ansi-styles
anymatch
arg
argparse
asap
asynckit
babel-jest
babel-plugin-istanbul
babel-plugin-jest-hoist
babel-plugin-polyfill-corejs2
babel-plugin-polyfill-corejs3
babel-plugin-polyfill-regenerator
babel-plugin-react-compiler
babel-plugin-react-native-web
babel-plugin-syntax-hermes-parser
babel-plugin-transform-flow-enums
babel-preset-current-node-syntax
babel-preset-jest
badgin
balanced-match
base64-js
baseline-browser-mapping
big-integer
bplist-creator
bplist-parser
brace-expansion
braces
browserslist
bser
buffer
buffer-from
bytes
call-bind-apply-helpers
callsites
camelcase
caniuse-lite
chalk
char-regex
chrome-launcher
chromium-edge-launcher
ci-info
cjs-module-lexer
cli-cursor
cli-spinners
cliui
clone
co
collect-v8-coverage
color
{
  "name": "care-app",
  "version": "1.0.0",
  "main": "index.ts",
  "dependencies": {
    "@react-native-async-storage/async-storage": "2.2.0",
    "@react-navigation/bottom-tabs": "^7.18.0",
    "@react-navigation/native": "^7.3.1",
    "@react-navigation/native-stack": "^7.17.3",
    "@supabase/supabase-js": "^2.108.1",
    "expo": "~56.0.11",
    "expo-av": "^16.0.8",
    "expo-constants": "~56.0.18",
    "expo-notifications": "~56.0.17",
    "expo-speech": "~56.0.3",
    "expo-status-bar": "~56.0.4",
    "react": "19.2.3",
    "react-native": "0.85.3",
    "react-native-safe-area-context": "~5.7.0",
    "react-native-screens": "4.25.2",
    "react-native-url-polyfill": "^3.0.0"
  },
  "devDependencies": {
    "@types/jest": "^30.0.0",
    "@types/react": "~19.2.2",
    "jest": "^29.7.0",
    "jest-expo": "^56.0.5",
    "typescript": "~6.0.3"
  },
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "test": "jest"
  },
  "private": true
}
care-app/src/theme/tokens.ts
export const colors = {
  primaryNavy: "#102A5E",
  primaryBlue: "#2563EB",
  secondaryBlue: "#4F8EF7",
  lightBlueBg: "#EEF5FF",
  cardBg: "#FFFFFF",
  border: "#D8E5F6",
  text: "#1F2937",
  textSecondary: "#64748B",
  successGreen: "#36B37E",
  warningOrange: "#F5A623",
  dangerRed: "#E25353",
  conditionPurple: "#8B5CF6",
} as const;

export const fontSizes = {
  body: 18,
  emphasis: 22,
  title: 24,
  hero: 40,
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radii = { card: 16, button: 14, pill: 999 } as const;
export const minTouch = 56;
care-app/src/lib/parse.ts
import { normalizeRepeatDays } from "./schedule";

export type ParsedSchedule = {
  medicine_name: string; time_of_day: string;
  hour: number; minute: number; repeat_days: number[];
};
export type ParseResult =
  | { ok: true; value: ParsedSchedule }
  | { ok: false; error: string };

export function validateParsedSchedule(input: any): ParseResult {
  if (!input || typeof input !== "object") return { ok: false, error: "not an object" };
  const name = typeof input.medicine_name === "string" ? input.medicine_name.trim() : "";
  if (!name) return { ok: false, error: "missing medicine_name" };
  const hour = Number(input.hour);
  const minute = Number(input.minute ?? 0);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { ok: false, error: "bad hour" };
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return { ok: false, error: "bad minute" };
  const tod = typeof input.time_of_day === "string" ? input.time_of_day : "";
  return {
    ok: true,
    value: {
      medicine_name: name, time_of_day: tod, hour, minute,
      repeat_days: normalizeRepeatDays(input.repeat_days),
    },
  };
}
care-app/src/lib/schedule.ts
export function normalizeRepeatDays(input: unknown): number[] {
  if (input === "매일" || input == null) return [];
  if (Array.isArray(input)) {
    return Array.from(new Set(input.filter((n) => typeof n === "number"))).sort((a, b) => a - b);
  }
  return [];
}

type TimeSpec = { hour: number; minute: number; repeat_days: number[] };

export function nextNotificationTime(spec: TimeSpec, now: Date): Date {
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setHours(spec.hour, spec.minute, 0, 0);
  const daily = spec.repeat_days.length === 0;
  for (let i = 0; i < 8; i++) {
    if (candidate.getTime() >= now.getTime() &&
        (daily || spec.repeat_days.includes(candidate.getDay()))) {
      return candidate;
    }
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(spec.hour, spec.minute, 0, 0);
  }
  return candidate;
}
care-app/src/lib/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Role = "patient" | "guardian";
const KEYS = { role: "care.role", patientId: "care.patientId", patientCode: "care.patientCode" };

export async function getRole(): Promise<Role | null> {
  return (await AsyncStorage.getItem(KEYS.role)) as Role | null;
}
export async function setRole(role: Role): Promise<void> {
  await AsyncStorage.setItem(KEYS.role, role);
}
export async function getPatientId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.patientId);
}
export async function setPatient(id: string, code: string): Promise<void> {
  await AsyncStorage.multiSet([[KEYS.patientId, id], [KEYS.patientCode, code]]);
}
export async function getPatientCode(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.patientCode);
}
export async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
care-app/src/lib/supabase.ts
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};
export const supabase = createClient(
  extra.supabaseUrl as string,
  extra.supabaseAnonKey as string,
  { auth: { persistSession: false } }
);

export type Patient = {
  id: string; name: string; patient_code: string; created_at: string;
};
export type Schedule = {
  id: string; patient_id: string; medicine_name: string;
  time_of_day: string; hour: number; minute: number;
  repeat_days: number[]; active: boolean; created_at: string;
};
export type IntakeStatus = "복용완료" | "미복용" | "복용예정" | "재알림";
export type IntakeRecord = {
  id: string; patient_id: string; schedule_id: string;
  scheduled_for: string; status: IntakeStatus;
  response_method: "음성" | "버튼" | null; responded_at: string | null;
  created_at: string;
};
care-app/src/lib/intent.ts
export type Intent = "복용완료" | "미복용" | "재알림" | "인식실패";

const REMIND = ["나중에", "이따", "30분", "다시 알려", "다시알려"];
const NOT_TAKEN = ["안 먹", "안먹", "못 먹", "못먹", "아직"];
const TAKEN = ["먹었", "복용했", "먹음", "했어요", "먹었어"];

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

export function classifyIntent(raw: string): Intent {
  const text = (raw ?? "").trim();
  if (!text) return "인식실패";
  if (hasAny(text, REMIND)) return "재알림";
  if (hasAny(text, NOT_TAKEN)) return "미복용";
  if (hasAny(text, TAKEN)) return "복용완료";
  return "인식실패";
}

exec
/bin/zsh -lc "find care-app -maxdepth 3 -type f | sort | sed 's#"'^#FILE #'"'" in /Users/cruel/Desktop/AI-bokkyak
 succeeded in 0ms:
FILE care-app/.claude/settings.json
FILE care-app/.gitignore
FILE care-app/AGENTS.md
FILE care-app/App.tsx
FILE care-app/CLAUDE.md
FILE care-app/LICENSE
FILE care-app/app.json
FILE care-app/assets/android-icon-background.png
FILE care-app/assets/android-icon-foreground.png
FILE care-app/assets/android-icon-monochrome.png
FILE care-app/assets/favicon.png
FILE care-app/assets/icon.png
FILE care-app/assets/splash-icon.png
FILE care-app/index.ts
FILE care-app/jest.config.js
FILE care-app/node_modules/.package-lock.json
FILE care-app/node_modules/abab/LICENSE.md
FILE care-app/node_modules/abab/README.md
FILE care-app/node_modules/abab/index.d.ts
FILE care-app/node_modules/abab/index.js
FILE care-app/node_modules/abab/package.json
FILE care-app/node_modules/abort-controller/LICENSE
FILE care-app/node_modules/abort-controller/README.md
FILE care-app/node_modules/abort-controller/browser.js
FILE care-app/node_modules/abort-controller/browser.mjs
FILE care-app/node_modules/abort-controller/package.json
FILE care-app/node_modules/abort-controller/polyfill.js
FILE care-app/node_modules/abort-controller/polyfill.mjs
FILE care-app/node_modules/accepts/HISTORY.md
FILE care-app/node_modules/accepts/LICENSE
FILE care-app/node_modules/accepts/README.md
FILE care-app/node_modules/accepts/index.js
FILE care-app/node_modules/accepts/package.json
FILE care-app/node_modules/acorn-globals/LICENSE
FILE care-app/node_modules/acorn-globals/README.md
FILE care-app/node_modules/acorn-globals/index.js
FILE care-app/node_modules/acorn-globals/package.json
FILE care-app/node_modules/acorn-walk/CHANGELOG.md
FILE care-app/node_modules/acorn-walk/LICENSE
FILE care-app/node_modules/acorn-walk/README.md
FILE care-app/node_modules/acorn-walk/package.json
FILE care-app/node_modules/acorn/CHANGELOG.md
FILE care-app/node_modules/acorn/LICENSE
FILE care-app/node_modules/acorn/README.md
FILE care-app/node_modules/acorn/package.json
FILE care-app/node_modules/agent-base/LICENSE
FILE care-app/node_modules/agent-base/README.md
FILE care-app/node_modules/agent-base/package.json
FILE care-app/node_modules/anser/LICENSE
FILE care-app/node_modules/anser/README.md
FILE care-app/node_modules/anser/package.json
FILE care-app/node_modules/ansi-escapes/index.d.ts
FILE care-app/node_modules/ansi-escapes/index.js
FILE care-app/node_modules/ansi-escapes/license
FILE care-app/node_modules/ansi-escapes/package.json
FILE care-app/node_modules/ansi-escapes/readme.md
FILE care-app/node_modules/ansi-regex/index.d.ts
FILE care-app/node_modules/ansi-regex/index.js
FILE care-app/node_modules/ansi-regex/license
FILE care-app/node_modules/ansi-regex/package.json
FILE care-app/node_modules/ansi-regex/readme.md
FILE care-app/node_modules/ansi-styles/index.d.ts
FILE care-app/node_modules/ansi-styles/index.js
FILE care-app/node_modules/ansi-styles/license
FILE care-app/node_modules/ansi-styles/package.json
FILE care-app/node_modules/ansi-styles/readme.md
FILE care-app/node_modules/anymatch/LICENSE
FILE care-app/node_modules/anymatch/README.md
FILE care-app/node_modules/anymatch/index.d.ts
FILE care-app/node_modules/anymatch/index.js
FILE care-app/node_modules/anymatch/package.json
FILE care-app/node_modules/arg/LICENSE.md
FILE care-app/node_modules/arg/README.md
FILE care-app/node_modules/arg/index.d.ts
FILE care-app/node_modules/arg/index.js
FILE care-app/node_modules/arg/package.json
FILE care-app/node_modules/argparse/CHANGELOG.md
FILE care-app/node_modules/argparse/LICENSE
FILE care-app/node_modules/argparse/README.md
FILE care-app/node_modules/argparse/argparse.js
FILE care-app/node_modules/argparse/package.json
FILE care-app/node_modules/asap/CHANGES.md
FILE care-app/node_modules/asap/LICENSE.md
FILE care-app/node_modules/asap/README.md
FILE care-app/node_modules/asap/asap.js
FILE care-app/node_modules/asap/browser-asap.js
FILE care-app/node_modules/asap/browser-raw.js
FILE care-app/node_modules/asap/package.json
FILE care-app/node_modules/asap/raw.js
FILE care-app/node_modules/asynckit/LICENSE
FILE care-app/node_modules/asynckit/README.md
FILE care-app/node_modules/asynckit/bench.js
FILE care-app/node_modules/asynckit/index.js
FILE care-app/node_modules/asynckit/package.json
FILE care-app/node_modules/asynckit/parallel.js
FILE care-app/node_modules/asynckit/serial.js
FILE care-app/node_modules/asynckit/serialOrdered.js
FILE care-app/node_modules/asynckit/stream.js
FILE care-app/node_modules/babel-jest/LICENSE
FILE care-app/node_modules/babel-jest/README.md
FILE care-app/node_modules/babel-jest/package.json
FILE care-app/node_modules/babel-plugin-istanbul/CHANGELOG.md
FILE care-app/node_modules/babel-plugin-istanbul/LICENSE
FILE care-app/node_modules/babel-plugin-istanbul/README.md
FILE care-app/node_modules/babel-plugin-istanbul/package.json
FILE care-app/node_modules/babel-plugin-jest-hoist/LICENSE
FILE care-app/node_modules/babel-plugin-jest-hoist/README.md
FILE care-app/node_modules/babel-plugin-jest-hoist/package.json
FILE care-app/node_modules/babel-plugin-polyfill-corejs2/LICENSE
FILE care-app/node_modules/babel-plugin-polyfill-corejs2/README.md
FILE care-app/node_modules/babel-plugin-polyfill-corejs2/package.json
FILE care-app/node_modules/babel-plugin-polyfill-corejs3/LICENSE
FILE care-app/node_modules/babel-plugin-polyfill-corejs3/README.md
FILE care-app/node_modules/babel-plugin-polyfill-corejs3/package.json
FILE care-app/node_modules/babel-plugin-polyfill-regenerator/LICENSE
FILE care-app/node_modules/babel-plugin-polyfill-regenerator/README.md
FILE care-app/node_modules/babel-plugin-polyfill-regenerator/package.json
FILE care-app/node_modules/babel-plugin-react-compiler/README.md
FILE care-app/node_modules/babel-plugin-react-compiler/package.json
FILE care-app/node_modules/babel-plugin-react-native-web/LICENSE
FILE care-app/node_modules/babel-plugin-react-native-web/README.md
FILE care-app/node_modules/babel-plugin-react-native-web/index.js
FILE care-app/node_modules/babel-plugin-react-native-web/package.json
FILE care-app/node_modules/babel-plugin-syntax-hermes-parser/LICENSE
FILE care-app/node_modules/babel-plugin-syntax-hermes-parser/README.md
FILE care-app/node_modules/babel-plugin-syntax-hermes-parser/package.json
FILE care-app/node_modules/babel-plugin-transform-flow-enums/CHANGELOG.md
FILE care-app/node_modules/babel-plugin-transform-flow-enums/LICENSE
FILE care-app/node_modules/babel-plugin-transform-flow-enums/README.md
FILE care-app/node_modules/babel-plugin-transform-flow-enums/index.js
FILE care-app/node_modules/babel-plugin-transform-flow-enums/package.json
FILE care-app/node_modules/babel-preset-current-node-syntax/LICENSE
FILE care-app/node_modules/babel-preset-current-node-syntax/README.md
FILE care-app/node_modules/babel-preset-current-node-syntax/package.json
FILE care-app/node_modules/babel-preset-jest/LICENSE
FILE care-app/node_modules/babel-preset-jest/README.md
FILE care-app/node_modules/babel-preset-jest/index.js
FILE care-app/node_modules/babel-preset-jest/package.json
FILE care-app/node_modules/badgin/README.md
FILE care-app/node_modules/badgin/package.json
FILE care-app/node_modules/balanced-match/LICENSE.md
FILE care-app/node_modules/balanced-match/README.md
FILE care-app/node_modules/balanced-match/package.json
FILE care-app/node_modules/base64-js/LICENSE
FILE care-app/node_modules/base64-js/README.md
FILE care-app/node_modules/base64-js/base64js.min.js
FILE care-app/node_modules/base64-js/index.d.ts
FILE care-app/node_modules/base64-js/index.js
FILE care-app/node_modules/base64-js/package.json
FILE care-app/node_modules/baseline-browser-mapping/LICENSE.txt
FILE care-app/node_modules/baseline-browser-mapping/README.md
FILE care-app/node_modules/baseline-browser-mapping/package.json
FILE care-app/node_modules/big-integer/BigInteger.d.ts
FILE care-app/node_modules/big-integer/BigInteger.js
FILE care-app/node_modules/big-integer/BigInteger.min.js
FILE care-app/node_modules/big-integer/LICENSE
FILE care-app/node_modules/big-integer/README.md
FILE care-app/node_modules/big-integer/bower.json
FILE care-app/node_modules/big-integer/package.json
FILE care-app/node_modules/big-integer/tsconfig.json
FILE care-app/node_modules/bplist-creator/LICENSE
FILE care-app/node_modules/bplist-creator/README.md
FILE care-app/node_modules/bplist-creator/bplistCreator.js
FILE care-app/node_modules/bplist-creator/package.json
FILE care-app/node_modules/bplist-parser/.editorconfig
FILE care-app/node_modules/bplist-parser/.eslintignore
FILE care-app/node_modules/bplist-parser/.eslintrc.js
FILE care-app/node_modules/bplist-parser/README.md
FILE care-app/node_modules/bplist-parser/bplistParser.d.ts
FILE care-app/node_modules/bplist-parser/bplistParser.js
FILE care-app/node_modules/bplist-parser/package.json
FILE care-app/node_modules/brace-expansion/LICENSE
FILE care-app/node_modules/brace-expansion/README.md
FILE care-app/node_modules/brace-expansion/package.json
FILE care-app/node_modules/braces/LICENSE
FILE care-app/node_modules/braces/README.md
FILE care-app/node_modules/braces/index.js
FILE care-app/node_modules/braces/package.json
FILE care-app/node_modules/browserslist/LICENSE
FILE care-app/node_modules/browserslist/README.md
FILE care-app/node_modules/browserslist/browser.js
FILE care-app/node_modules/browserslist/cli.js
FILE care-app/node_modules/browserslist/error.d.ts
FILE care-app/node_modules/browserslist/error.js
FILE care-app/node_modules/browserslist/index.d.ts
FILE care-app/node_modules/browserslist/index.js
FILE care-app/node_modules/browserslist/node.js
FILE care-app/node_modules/browserslist/package.json
FILE care-app/node_modules/browserslist/parse.js
FILE care-app/node_modules/bser/README.md
FILE care-app/node_modules/bser/index.js
FILE care-app/node_modules/bser/package.json
FILE care-app/node_modules/buffer-from/LICENSE
FILE care-app/node_modules/buffer-from/index.js
FILE care-app/node_modules/buffer-from/package.json
FILE care-app/node_modules/buffer-from/readme.md
FILE care-app/node_modules/buffer/AUTHORS.md
FILE care-app/node_modules/buffer/LICENSE
FILE care-app/node_modules/buffer/README.md
FILE care-app/node_modules/buffer/index.d.ts
FILE care-app/node_modules/buffer/index.js
FILE care-app/node_modules/buffer/package.json
FILE care-app/node_modules/bytes/History.md
FILE care-app/node_modules/bytes/LICENSE
FILE care-app/node_modules/bytes/Readme.md
FILE care-app/node_modules/bytes/index.js
FILE care-app/node_modules/bytes/package.json
FILE care-app/node_modules/call-bind-apply-helpers/.eslintrc
FILE care-app/node_modules/call-bind-apply-helpers/.nycrc
FILE care-app/node_modules/call-bind-apply-helpers/CHANGELOG.md
FILE care-app/node_modules/call-bind-apply-helpers/LICENSE
FILE care-app/node_modules/call-bind-apply-helpers/README.md
FILE care-app/node_modules/call-bind-apply-helpers/actualApply.d.ts
FILE care-app/node_modules/call-bind-apply-helpers/actualApply.js
FILE care-app/node_modules/call-bind-apply-helpers/applyBind.d.ts
FILE care-app/node_modules/call-bind-apply-helpers/applyBind.js
FILE care-app/node_modules/call-bind-apply-helpers/functionApply.d.ts
FILE care-app/node_modules/call-bind-apply-helpers/functionApply.js
FILE care-app/node_modules/call-bind-apply-helpers/functionCall.d.ts
FILE care-app/node_modules/call-bind-apply-helpers/functionCall.js
FILE care-app/node_modules/call-bind-apply-helpers/index.d.ts
FILE care-app/node_modules/call-bind-apply-helpers/index.js
FILE care-app/node_modules/call-bind-apply-helpers/package.json
FILE care-app/node_modules/call-bind-apply-helpers/reflectApply.d.ts
FILE care-app/node_modules/call-bind-apply-helpers/reflectApply.js
FILE care-app/node_modules/call-bind-apply-helpers/tsconfig.json
FILE care-app/node_modules/callsites/index.d.ts
FILE care-app/node_modules/callsites/index.js
FILE care-app/node_modules/callsites/license
FILE care-app/node_modules/callsites/package.json
FILE care-app/node_modules/callsites/readme.md
FILE care-app/node_modules/camelcase/index.d.ts
FILE care-app/node_modules/camelcase/index.js
FILE care-app/node_modules/camelcase/license
FILE care-app/node_modules/camelcase/package.json
FILE care-app/node_modules/camelcase/readme.md
FILE care-app/node_modules/caniuse-lite/LICENSE
FILE care-app/node_modules/caniuse-lite/README.md
FILE care-app/node_modules/caniuse-lite/package.json
FILE care-app/node_modules/chalk/index.d.ts
FILE care-app/node_modules/chalk/license
FILE care-app/node_modules/chalk/package.json
FILE care-app/node_modules/chalk/readme.md
FILE care-app/node_modules/char-regex/LICENSE
FILE care-app/node_modules/char-regex/README.md
FILE care-app/node_modules/char-regex/index.d.ts
FILE care-app/node_modules/char-regex/index.js
FILE care-app/node_modules/char-regex/package.json
FILE care-app/node_modules/chrome-launcher/.clang-format
FILE care-app/node_modules/chrome-launcher/LICENSE
FILE care-app/node_modules/chrome-launcher/README.md
FILE care-app/node_modules/chrome-launcher/changelog.md
FILE care-app/node_modules/chrome-launcher/compiled-check.js
FILE care-app/node_modules/chrome-launcher/contributing.md
FILE care-app/node_modules/chrome-launcher/manual-chrome-launcher.js
FILE care-app/node_modules/chrome-launcher/package.json
FILE care-app/node_modules/chrome-launcher/tsconfig.json
FILE care-app/node_modules/chromium-edge-launcher/.clang-format
FILE care-app/node_modules/chromium-edge-launcher/LICENSE
FILE care-app/node_modules/chromium-edge-launcher/README.md
FILE care-app/node_modules/chromium-edge-launcher/changelog.md
FILE care-app/node_modules/chromium-edge-launcher/compiled-check.js
FILE care-app/node_modules/chromium-edge-launcher/manual-edge-launcher.js
FILE care-app/node_modules/chromium-edge-launcher/package.json
FILE care-app/node_modules/chromium-edge-launcher/tsconfig.json
FILE care-app/node_modules/ci-info/CHANGELOG.md
FILE care-app/node_modules/ci-info/LICENSE
FILE care-app/node_modules/ci-info/README.md
FILE care-app/node_modules/ci-info/index.js
FILE care-app/node_modules/ci-info/package.json
FILE care-app/node_modules/ci-info/vendors.json
FILE care-app/node_modules/cjs-module-lexer/LICENSE
FILE care-app/node_modules/cjs-module-lexer/README.md
FILE care-app/node_modules/cjs-module-lexer/lexer.d.ts
FILE care-app/node_modules/cjs-module-lexer/lexer.js
FILE care-app/node_modules/cjs-module-lexer/package.json
FILE care-app/node_modules/cli-cursor/index.js
FILE care-app/node_modules/cli-cursor/license
FILE care-app/node_modules/cli-cursor/package.json
FILE care-app/node_modules/cli-cursor/readme.md
FILE care-app/node_modules/cli-spinners/index.d.ts
FILE care-app/node_modules/cli-spinners/index.js
FILE care-app/node_modules/cli-spinners/license
FILE care-app/node_modules/cli-spinners/package.json
FILE care-app/node_modules/cli-spinners/readme.md
FILE care-app/node_modules/cli-spinners/spinners.json
FILE care-app/node_modules/cliui/CHANGELOG.md
FILE care-app/node_modules/cliui/LICENSE.txt
FILE care-app/node_modules/cliui/README.md
FILE care-app/node_modules/cliui/index.mjs
FILE care-app/node_modules/cliui/package.json
FILE care-app/node_modules/clone/.npmignore
FILE care-app/node_modules/clone/LICENSE
FILE care-app/node_modules/clone/README.md
FILE care-app/node_modules/clone/clone.iml
FILE care-app/node_modules/clone/clone.js
FILE care-app/node_modules/clone/package.json
FILE care-app/node_modules/co/History.md
FILE care-app/node_modules/co/LICENSE
FILE care-app/node_modules/co/Readme.md
FILE care-app/node_modules/co/index.js
FILE care-app/node_modules/co/package.json
FILE care-app/node_modules/collect-v8-coverage/CHANGELOG.md
FILE care-app/node_modules/collect-v8-coverage/LICENSE
FILE care-app/node_modules/collect-v8-coverage/README.md
FILE care-app/node_modules/collect-v8-coverage/index.d.ts
FILE care-app/node_modules/collect-v8-coverage/index.js
FILE care-app/node_modules/collect-v8-coverage/package.json
FILE care-app/node_modules/color-convert/CHANGELOG.md
FILE care-app/node_modules/color-convert/LICENSE
FILE care-app/node_modules/color-convert/README.md
FILE care-app/node_modules/color-convert/conversions.js
FILE care-app/node_modules/color-convert/index.js
FILE care-app/node_modules/color-convert/package.json
FILE care-app/node_modules/color-convert/route.js
FILE care-app/node_modules/color-name/LICENSE
FILE care-app/node_modules/color-name/README.md
FILE care-app/node_modules/color-name/index.js
FILE care-app/node_modules/color-name/package.json
FILE care-app/node_modules/color-string/LICENSE
FILE care-app/node_modules/color-string/README.md
FILE care-app/node_modules/color-string/index.js
FILE care-app/node_modules/color-string/package.json
FILE care-app/node_modules/color/LICENSE
FILE care-app/node_modules/color/README.md
FILE care-app/node_modules/color/index.js
FILE care-app/node_modules/color/package.json
FILE care-app/node_modules/combined-stream/License
FILE care-app/node_modules/combined-stream/Readme.md
FILE care-app/node_modules/combined-stream/package.json
FILE care-app/node_modules/combined-stream/yarn.lock
FILE care-app/node_modules/commander/CHANGELOG.md
FILE care-app/node_modules/commander/LICENSE
FILE care-app/node_modules/commander/Readme.md
FILE care-app/node_modules/commander/esm.mjs
FILE care-app/node_modules/commander/index.js
FILE care-app/node_modules/commander/package-support.json
FILE care-app/node_modules/commander/package.json
FILE care-app/node_modules/compressible/HISTORY.md
FILE care-app/node_modules/compressible/LICENSE
FILE care-app/node_modules/compressible/README.md
FILE care-app/node_modules/compressible/index.js
FILE care-app/node_modules/compressible/package.json
FILE care-app/node_modules/compression/HISTORY.md
FILE care-app/node_modules/compression/LICENSE
FILE care-app/node_modules/compression/README.md
FILE care-app/node_modules/compression/index.js
FILE care-app/node_modules/compression/package.json
FILE care-app/node_modules/concat-map/.travis.yml
FILE care-app/node_modules/concat-map/LICENSE
FILE care-app/node_modules/concat-map/README.markdown
FILE care-app/node_modules/concat-map/index.js
FILE care-app/node_modules/concat-map/package.json
FILE care-app/node_modules/connect/HISTORY.md
FILE care-app/node_modules/connect/LICENSE
FILE care-app/node_modules/connect/README.md
FILE care-app/node_modules/connect/SECURITY.md
FILE care-app/node_modules/connect/index.js
FILE care-app/node_modules/connect/package.json
FILE care-app/node_modules/convert-source-map/LICENSE
FILE care-app/node_modules/convert-source-map/README.md
FILE care-app/node_modules/convert-source-map/index.js
FILE care-app/node_modules/convert-source-map/package.json
FILE care-app/node_modules/core-js-compat/LICENSE
FILE care-app/node_modules/core-js-compat/README.md
FILE care-app/node_modules/core-js-compat/compat.d.ts
FILE care-app/node_modules/core-js-compat/compat.js
FILE care-app/node_modules/core-js-compat/data.json
FILE care-app/node_modules/core-js-compat/entries.json
FILE care-app/node_modules/core-js-compat/external.json
FILE care-app/node_modules/core-js-compat/get-modules-list-for-target-version.d.ts
FILE care-app/node_modules/core-js-compat/get-modules-list-for-target-version.js
FILE care-app/node_modules/core-js-compat/helpers.js
FILE care-app/node_modules/core-js-compat/index.d.ts
FILE care-app/node_modules/core-js-compat/index.js
FILE care-app/node_modules/core-js-compat/modules-by-versions.json
FILE care-app/node_modules/core-js-compat/modules.json
FILE care-app/node_modules/core-js-compat/package.json
FILE care-app/node_modules/core-js-compat/shared.d.ts
FILE care-app/node_modules/core-js-compat/targets-parser.js
FILE care-app/node_modules/create-jest/LICENSE
FILE care-app/node_modules/create-jest/README.md
FILE care-app/node_modules/create-jest/package.json
FILE care-app/node_modules/cross-spawn/LICENSE
FILE care-app/node_modules/cross-spawn/README.md
FILE care-app/node_modules/cross-spawn/index.js
FILE care-app/node_modules/cross-spawn/package.json
FILE care-app/node_modules/cssom/LICENSE.txt
FILE care-app/node_modules/cssom/README.mdown
FILE care-app/node_modules/cssom/package.json
FILE care-app/node_modules/cssstyle/LICENSE
FILE care-app/node_modules/cssstyle/README.md
FILE care-app/node_modules/cssstyle/package.json
FILE care-app/node_modules/csstype/LICENSE
FILE care-app/node_modules/csstype/README.md
FILE care-app/node_modules/csstype/index.d.ts
FILE care-app/node_modules/csstype/index.js.flow
FILE care-app/node_modules/csstype/package.json
FILE care-app/node_modules/data-urls/LICENSE.txt
FILE care-app/node_modules/data-urls/README.md
FILE care-app/node_modules/data-urls/package.json
FILE care-app/node_modules/debug/LICENSE
FILE care-app/node_modules/debug/README.md
FILE care-app/node_modules/debug/package.json
FILE care-app/node_modules/decimal.js/LICENCE.md
FILE care-app/node_modules/decimal.js/README.md
FILE care-app/node_modules/decimal.js/decimal.d.ts
FILE care-app/node_modules/decimal.js/decimal.js
FILE care-app/node_modules/decimal.js/decimal.mjs
FILE care-app/node_modules/decimal.js/package.json
FILE care-app/node_modules/decode-uri-component/index.js
FILE care-app/node_modules/decode-uri-component/license
FILE care-app/node_modules/decode-uri-component/package.json
FILE care-app/node_modules/decode-uri-component/readme.md
FILE care-app/node_modules/dedent/LICENSE.md
FILE care-app/node_modules/dedent/README.md
FILE care-app/node_modules/dedent/macro.js
FILE care-app/node_modules/dedent/package.json
FILE care-app/node_modules/deepmerge/.editorconfig
FILE care-app/node_modules/deepmerge/.eslintcache
FILE care-app/node_modules/deepmerge/changelog.md
FILE care-app/node_modules/deepmerge/index.d.ts
FILE care-app/node_modules/deepmerge/index.js
FILE care-app/node_modules/deepmerge/license.txt
FILE care-app/node_modules/deepmerge/package.json
FILE care-app/node_modules/deepmerge/readme.md
FILE care-app/node_modules/deepmerge/rollup.config.js
FILE care-app/node_modules/defaults/LICENSE
FILE care-app/node_modules/defaults/README.md
FILE care-app/node_modules/defaults/index.js
FILE care-app/node_modules/defaults/package.json
FILE care-app/node_modules/defaults/test.js
FILE care-app/node_modules/delayed-stream/.npmignore
FILE care-app/node_modules/delayed-stream/License
FILE care-app/node_modules/delayed-stream/Makefile
FILE care-app/node_modules/delayed-stream/Readme.md
FILE care-app/node_modules/delayed-stream/package.json
FILE care-app/node_modules/depd/History.md
FILE care-app/node_modules/depd/LICENSE
FILE care-app/node_modules/depd/Readme.md
FILE care-app/node_modules/depd/index.js
FILE care-app/node_modules/depd/package.json
FILE care-app/node_modules/destroy/LICENSE
FILE care-app/node_modules/destroy/README.md
FILE care-app/node_modules/destroy/index.js
FILE care-app/node_modules/destroy/package.json
FILE care-app/node_modules/detect-libc/LICENSE
FILE care-app/node_modules/detect-libc/README.md
FILE care-app/node_modules/detect-libc/index.d.ts
FILE care-app/node_modules/detect-libc/package.json
FILE care-app/node_modules/detect-newline/index.d.ts
FILE care-app/node_modules/detect-newline/index.js
FILE care-app/node_modules/detect-newline/license
FILE care-app/node_modules/detect-newline/package.json
FILE care-app/node_modules/detect-newline/readme.md
FILE care-app/node_modules/diff-sequences/LICENSE
FILE care-app/node_modules/diff-sequences/README.md
FILE care-app/node_modules/diff-sequences/package.json
FILE care-app/node_modules/dnssd-advertise/CHANGELOG.md
FILE care-app/node_modules/dnssd-advertise/LICENSE.md
FILE care-app/node_modules/dnssd-advertise/README.md
FILE care-app/node_modules/dnssd-advertise/package.json
FILE care-app/node_modules/domexception/LICENSE.txt
FILE care-app/node_modules/domexception/README.md
FILE care-app/node_modules/domexception/index.js
FILE care-app/node_modules/domexception/package.json
FILE care-app/node_modules/domexception/webidl2js-wrapper.js
FILE care-app/node_modules/dunder-proto/.eslintrc
FILE care-app/node_modules/dunder-proto/.nycrc
FILE care-app/node_modules/dunder-proto/CHANGELOG.md
FILE care-app/node_modules/dunder-proto/LICENSE
FILE care-app/node_modules/dunder-proto/README.md
FILE care-app/node_modules/dunder-proto/get.d.ts
FILE care-app/node_modules/dunder-proto/get.js
FILE care-app/node_modules/dunder-proto/package.json
FILE care-app/node_modules/dunder-proto/set.d.ts
FILE care-app/node_modules/dunder-proto/set.js
FILE care-app/node_modules/dunder-proto/tsconfig.json
FILE care-app/node_modules/ee-first/LICENSE
FILE care-app/node_modules/ee-first/README.md
FILE care-app/node_modules/ee-first/index.js
FILE care-app/node_modules/ee-first/package.json
FILE care-app/node_modules/electron-to-chromium/LICENSE
FILE care-app/node_modules/electron-to-chromium/README.md
FILE care-app/node_modules/electron-to-chromium/chromium-versions.js
FILE care-app/node_modules/electron-to-chromium/chromium-versions.json
FILE care-app/node_modules/electron-to-chromium/full-chromium-versions.js
FILE care-app/node_modules/electron-to-chromium/full-chromium-versions.json
FILE care-app/node_modules/electron-to-chromium/full-versions.js
FILE care-app/node_modules/electron-to-chromium/full-versions.json
FILE care-app/node_modules/electron-to-chromium/index.js
FILE care-app/node_modules/electron-to-chromium/package.json
FILE care-app/node_modules/electron-to-chromium/versions.js
FILE care-app/node_modules/electron-to-chromium/versions.json
FILE care-app/node_modules/emittery/index.d.ts
FILE care-app/node_modules/emittery/index.js
FILE care-app/node_modules/emittery/license
FILE care-app/node_modules/emittery/maps.js
FILE care-app/node_modules/emittery/package.json
FILE care-app/node_modules/emittery/readme.md
FILE care-app/node_modules/emoji-regex/LICENSE-MIT.txt
FILE care-app/node_modules/emoji-regex/README.md
FILE care-app/node_modules/emoji-regex/index.d.ts
FILE care-app/node_modules/emoji-regex/index.js
FILE care-app/node_modules/emoji-regex/package.json
FILE care-app/node_modules/emoji-regex/text.js
FILE care-app/node_modules/encodeurl/HISTORY.md
FILE care-app/node_modules/encodeurl/LICENSE
FILE care-app/node_modules/encodeurl/README.md
FILE care-app/node_modules/encodeurl/index.js
FILE care-app/node_modules/encodeurl/package.json
FILE care-app/node_modules/entities/LICENSE
FILE care-app/node_modules/entities/decode.d.ts
FILE care-app/node_modules/entities/decode.js
FILE care-app/node_modules/entities/escape.d.ts
FILE care-app/node_modules/entities/escape.js
FILE care-app/node_modules/entities/package.json
FILE care-app/node_modules/entities/readme.md
FILE care-app/node_modules/error-ex/LICENSE
FILE care-app/node_modules/error-ex/README.md
FILE care-app/node_modules/error-ex/index.js
FILE care-app/node_modules/error-ex/package.json
FILE care-app/node_modules/error-stack-parser/LICENSE
FILE care-app/node_modules/error-stack-parser/README.md
FILE care-app/node_modules/error-stack-parser/error-stack-parser.d.ts
FILE care-app/node_modules/error-stack-parser/error-stack-parser.js
FILE care-app/node_modules/error-stack-parser/package.json
FILE care-app/node_modules/es-define-property/.eslintrc
FILE care-app/node_modules/es-define-property/.nycrc
FILE care-app/node_modules/es-define-property/CHANGELOG.md
FILE care-app/node_modules/es-define-property/LICENSE
FILE care-app/node_modules/es-define-property/README.md
FILE care-app/node_modules/es-define-property/index.d.ts
FILE care-app/node_modules/es-define-property/index.js
FILE care-app/node_modules/es-define-property/package.json
FILE care-app/node_modules/es-define-property/tsconfig.json
FILE care-app/node_modules/es-errors/.eslintrc
FILE care-app/node_modules/es-errors/CHANGELOG.md
FILE care-app/node_modules/es-errors/LICENSE
FILE care-app/node_modules/es-errors/README.md
FILE care-app/node_modules/es-errors/eval.d.ts
FILE care-app/node_modules/es-errors/eval.js
FILE care-app/node_modules/es-errors/index.d.ts
FILE care-app/node_modules/es-errors/index.js
FILE care-app/node_modules/es-errors/package.json
FILE care-app/node_modules/es-errors/range.d.ts
FILE care-app/node_modules/es-errors/range.js
FILE care-app/node_modules/es-errors/ref.d.ts
FILE care-app/node_modules/es-errors/ref.js
FILE care-app/node_modules/es-errors/syntax.d.ts
FILE care-app/node_modules/es-errors/syntax.js
FILE care-app/node_modules/es-errors/tsconfig.json
FILE care-app/node_modules/es-errors/type.d.ts
FILE care-app/node_modules/es-errors/type.js
FILE care-app/node_modules/es-errors/uri.d.ts
FILE care-app/node_modules/es-errors/uri.js
FILE care-app/node_modules/es-object-atoms/.eslintrc
FILE care-app/node_modules/es-object-atoms/CHANGELOG.md
FILE care-app/node_modules/es-object-atoms/LICENSE
FILE care-app/node_modules/es-object-atoms/README.md
FILE care-app/node_modules/es-object-atoms/RequireObjectCoercible.d.ts
FILE care-app/node_modules/es-object-atoms/RequireObjectCoercible.js
FILE care-app/node_modules/es-object-atoms/ToObject.d.ts
FILE care-app/node_modules/es-object-atoms/ToObject.js
FILE care-app/node_modules/es-object-atoms/index.d.ts
FILE care-app/node_modules/es-object-atoms/index.js
FILE care-app/node_modules/es-object-atoms/isObject.d.ts
FILE care-app/node_modules/es-object-atoms/isObject.js
FILE care-app/node_modules/es-object-atoms/package.json
FILE care-app/node_modules/es-object-atoms/tsconfig.json
FILE care-app/node_modules/es-set-tostringtag/.eslintrc
FILE care-app/node_modules/es-set-tostringtag/.nycrc
FILE care-app/node_modules/es-set-tostringtag/CHANGELOG.md
FILE care-app/node_modules/es-set-tostringtag/LICENSE
FILE care-app/node_modules/es-set-tostringtag/README.md
FILE care-app/node_modules/es-set-tostringtag/index.d.ts
FILE care-app/node_modules/es-set-tostringtag/index.js
FILE care-app/node_modules/es-set-tostringtag/package.json
FILE care-app/node_modules/es-set-tostringtag/tsconfig.json
FILE care-app/node_modules/escalade/index.d.mts
FILE care-app/node_modules/escalade/index.d.ts
FILE care-app/node_modules/escalade/license
FILE care-app/node_modules/escalade/package.json
FILE care-app/node_modules/escalade/readme.md
FILE care-app/node_modules/escape-html/LICENSE
FILE care-app/node_modules/escape-html/Readme.md
FILE care-app/node_modules/escape-html/index.js
FILE care-app/node_modules/escape-html/package.json
FILE care-app/node_modules/escape-string-regexp/index.d.ts
FILE care-app/node_modules/escape-string-regexp/index.js
FILE care-app/node_modules/escape-string-regexp/license
FILE care-app/node_modules/escape-string-regexp/package.json
FILE care-app/node_modules/escape-string-regexp/readme.md
FILE care-app/node_modules/escodegen/LICENSE.BSD
FILE care-app/node_modules/escodegen/README.md
FILE care-app/node_modules/escodegen/escodegen.js
FILE care-app/node_modules/escodegen/package.json
FILE care-app/node_modules/esprima/ChangeLog
FILE care-app/node_modules/esprima/LICENSE.BSD
FILE care-app/node_modules/esprima/README.md
FILE care-app/node_modules/esprima/package.json
FILE care-app/node_modules/estraverse/.jshintrc
FILE care-app/node_modules/estraverse/LICENSE.BSD
FILE care-app/node_modules/estraverse/README.md
FILE care-app/node_modules/estraverse/estraverse.js
FILE care-app/node_modules/estraverse/gulpfile.js
FILE care-app/node_modules/estraverse/package.json
FILE care-app/node_modules/esutils/LICENSE.BSD
FILE care-app/node_modules/esutils/README.md
FILE care-app/node_modules/esutils/package.json
FILE care-app/node_modules/etag/HISTORY.md
FILE care-app/node_modules/etag/LICENSE
FILE care-app/node_modules/etag/README.md
FILE care-app/node_modules/etag/index.js
FILE care-app/node_modules/etag/package.json
FILE care-app/node_modules/event-target-shim/LICENSE
FILE care-app/node_modules/event-target-shim/README.md
FILE care-app/node_modules/event-target-shim/index.d.ts
FILE care-app/node_modules/event-target-shim/package.json
FILE care-app/node_modules/execa/index.d.ts
FILE care-app/node_modules/execa/index.js
FILE care-app/node_modules/execa/license
FILE care-app/node_modules/execa/package.json
FILE care-app/node_modules/execa/readme.md
FILE care-app/node_modules/exit/.jshintrc
FILE care-app/node_modules/exit/.npmignore
FILE care-app/node_modules/exit/.travis.yml
FILE care-app/node_modules/exit/Gruntfile.js
FILE care-app/node_modules/exit/LICENSE-MIT
FILE care-app/node_modules/exit/README.md
FILE care-app/node_modules/exit/package.json
FILE care-app/node_modules/expect/LICENSE
FILE care-app/node_modules/expect/README.md
FILE care-app/node_modules/expect/package.json
FILE care-app/node_modules/expo-application/.eslintrc.js
FILE care-app/node_modules/expo-application/CHANGELOG.md
FILE care-app/node_modules/expo-application/LICENSE
FILE care-app/node_modules/expo-application/README.md
FILE care-app/node_modules/expo-application/expo-module.config.json
FILE care-app/node_modules/expo-application/package.json
FILE care-app/node_modules/expo-application/spm.config.json
FILE care-app/node_modules/expo-application/tsconfig.json
FILE care-app/node_modules/expo-av/.eslintrc.js
FILE care-app/node_modules/expo-av/CHANGELOG.md
FILE care-app/node_modules/expo-av/README.md
FILE care-app/node_modules/expo-av/app.plugin.js
FILE care-app/node_modules/expo-av/expo-module.config.json
FILE care-app/node_modules/expo-av/package.json
FILE care-app/node_modules/expo-av/tsconfig.json
FILE care-app/node_modules/expo-constants/.eslintrc.js
FILE care-app/node_modules/expo-constants/CHANGELOG.md
FILE care-app/node_modules/expo-constants/LICENSE
FILE care-app/node_modules/expo-constants/README.md
FILE care-app/node_modules/expo-constants/expo-module.config.json
FILE care-app/node_modules/expo-constants/jest-rsc.config.js
FILE care-app/node_modules/expo-constants/package.json
FILE care-app/node_modules/expo-constants/tsconfig.json
FILE care-app/node_modules/expo-modules-autolinking/.eslintrc.js
FILE care-app/node_modules/expo-modules-autolinking/CHANGELOG.md
FILE care-app/node_modules/expo-modules-autolinking/LICENSE
FILE care-app/node_modules/expo-modules-autolinking/README.md
FILE care-app/node_modules/expo-modules-autolinking/exports.d.ts
FILE care-app/node_modules/expo-modules-autolinking/exports.js
FILE care-app/node_modules/expo-modules-autolinking/jest.config.js
FILE care-app/node_modules/expo-modules-autolinking/jest.setup.ts
FILE care-app/node_modules/expo-modules-autolinking/package.json
FILE care-app/node_modules/expo-modules-autolinking/tsconfig.json
FILE care-app/node_modules/expo-modules-core/.eslintrc.js
FILE care-app/node_modules/expo-modules-core/CHANGELOG.md
FILE care-app/node_modules/expo-modules-core/ExpoModulesCore.podspec
FILE care-app/node_modules/expo-modules-core/ExpoModulesWorklets.podspec
FILE care-app/node_modules/expo-modules-core/ExpoModulesWorkletsAdapter.podspec
FILE care-app/node_modules/expo-modules-core/LICENSE
FILE care-app/node_modules/expo-modules-core/README.md
FILE care-app/node_modules/expo-modules-core/expo-module.config.json
FILE care-app/node_modules/expo-modules-core/index.js
FILE care-app/node_modules/expo-modules-core/jest-rsc.config.js
FILE care-app/node_modules/expo-modules-core/package.json
FILE care-app/node_modules/expo-modules-core/react-native.config.js
FILE care-app/node_modules/expo-modules-core/spm.config.json
FILE care-app/node_modules/expo-modules-core/tsconfig.json
FILE care-app/node_modules/expo-modules-core/types.d.ts
FILE care-app/node_modules/expo-modules-jsi/CHANGELOG.md
FILE care-app/node_modules/expo-modules-jsi/CLAUDE.md
FILE care-app/node_modules/expo-modules-jsi/LICENSE
FILE care-app/node_modules/expo-modules-jsi/README.md
FILE care-app/node_modules/expo-modules-jsi/expo-module.config.json
FILE care-app/node_modules/expo-modules-jsi/index.js
FILE care-app/node_modules/expo-modules-jsi/package.json
FILE care-app/node_modules/expo-modules-jsi/spm.config.json
FILE care-app/node_modules/expo-notifications/.eslintrc.js
FILE care-app/node_modules/expo-notifications/CHANGELOG.md
FILE care-app/node_modules/expo-notifications/LICENSE
FILE care-app/node_modules/expo-notifications/README.md
FILE care-app/node_modules/expo-notifications/app.plugin.js
FILE care-app/node_modules/expo-notifications/expo-module.config.json
FILE care-app/node_modules/expo-notifications/package.json
FILE care-app/node_modules/expo-notifications/spm.config.json
FILE care-app/node_modules/expo-notifications/tsconfig.json
FILE care-app/node_modules/expo-server/LICENSE
FILE care-app/node_modules/expo-server/README.md
FILE care-app/node_modules/expo-server/package.json
FILE care-app/node_modules/expo-speech/.eslintrc.js
FILE care-app/node_modules/expo-speech/CHANGELOG.md
FILE care-app/node_modules/expo-speech/LICENSE
FILE care-app/node_modules/expo-speech/README.md
FILE care-app/node_modules/expo-speech/expo-module.config.json
FILE care-app/node_modules/expo-speech/package.json
FILE care-app/node_modules/expo-speech/spm.config.json
FILE care-app/node_modules/expo-speech/tsconfig.json
FILE care-app/node_modules/expo-status-bar/.eslintrc.js
FILE care-app/node_modules/expo-status-bar/CHANGELOG.md
FILE care-app/node_modules/expo-status-bar/LICENSE
FILE care-app/node_modules/expo-status-bar/README.md
FILE care-app/node_modules/expo-status-bar/app.plugin.js
FILE care-app/node_modules/expo-status-bar/expo-module.config.json
FILE care-app/node_modules/expo-status-bar/package.json
FILE care-app/node_modules/expo-status-bar/tsconfig.json
FILE care-app/node_modules/expo/AppEntry.js
FILE care-app/node_modules/expo/Expo.podspec
FILE care-app/node_modules/expo/LICENSE
FILE care-app/node_modules/expo/README.md
FILE care-app/node_modules/expo/bundledNativeModules.json
FILE care-app/node_modules/expo/config-plugins.d.ts
FILE care-app/node_modules/expo/config-plugins.js
FILE care-app/node_modules/expo/devtools.d.ts
FILE care-app/node_modules/expo/devtools.js
FILE care-app/node_modules/expo/expo-module.config.json
FILE care-app/node_modules/expo/fetch.d.ts
FILE care-app/node_modules/expo/fetch.js
FILE care-app/node_modules/expo/fingerprint.d.ts
FILE care-app/node_modules/expo/fingerprint.js
FILE care-app/node_modules/expo/local-build-cache-provider.d.ts
FILE care-app/node_modules/expo/local-build-cache-provider.js
FILE care-app/node_modules/expo/metro-config.d.ts
FILE care-app/node_modules/expo/metro-config.js
FILE care-app/node_modules/expo/package.json
FILE care-app/node_modules/expo/react-native.config.js
FILE care-app/node_modules/expo/requiresExtraSetup.json
FILE care-app/node_modules/expo/template.tgz
FILE care-app/node_modules/expo/tsconfig.base.json
FILE care-app/node_modules/exponential-backoff/LICENSE
FILE care-app/node_modules/exponential-backoff/README.md
FILE care-app/node_modules/exponential-backoff/package.json
FILE care-app/node_modules/fast-deep-equal/LICENSE
FILE care-app/node_modules/fast-deep-equal/README.md
FILE care-app/node_modules/fast-deep-equal/index.d.ts
FILE care-app/node_modules/fast-deep-equal/index.js
FILE care-app/node_modules/fast-deep-equal/package.json
FILE care-app/node_modules/fast-deep-equal/react.d.ts
FILE care-app/node_modules/fast-deep-equal/react.js
FILE care-app/node_modules/fast-json-stable-stringify/.eslintrc.yml
FILE care-app/node_modules/fast-json-stable-stringify/.travis.yml
FILE care-app/node_modules/fast-json-stable-stringify/LICENSE
FILE care-app/node_modules/fast-json-stable-stringify/README.md
FILE care-app/node_modules/fast-json-stable-stringify/index.d.ts
FILE care-app/node_modules/fast-json-stable-stringify/index.js
FILE care-app/node_modules/fast-json-stable-stringify/package.json
FILE care-app/node_modules/fb-dotslash/README.md
FILE care-app/node_modules/fb-dotslash/index.d.ts
FILE care-app/node_modules/fb-dotslash/index.js
FILE care-app/node_modules/fb-dotslash/index.js.flow
FILE care-app/node_modules/fb-dotslash/package.json
FILE care-app/node_modules/fb-dotslash/platforms.js
FILE care-app/node_modules/fb-watchman/README.md
FILE care-app/node_modules/fb-watchman/index.js
FILE care-app/node_modules/fb-watchman/package.json
FILE care-app/node_modules/fetch-nodeshim/CHANGELOG.md
FILE care-app/node_modules/fetch-nodeshim/LICENSE.md
FILE care-app/node_modules/fetch-nodeshim/README.md
FILE care-app/node_modules/fetch-nodeshim/package.json
FILE care-app/node_modules/fill-range/LICENSE
FILE care-app/node_modules/fill-range/README.md
FILE care-app/node_modules/fill-range/index.js
FILE care-app/node_modules/fill-range/package.json
FILE care-app/node_modules/filter-obj/index.js
FILE care-app/node_modules/filter-obj/license
FILE care-app/node_modules/filter-obj/package.json
FILE care-app/node_modules/filter-obj/readme.md
FILE care-app/node_modules/finalhandler/HISTORY.md
FILE care-app/node_modules/finalhandler/LICENSE
FILE care-app/node_modules/finalhandler/README.md
FILE care-app/node_modules/finalhandler/index.js
FILE care-app/node_modules/finalhandler/package.json
FILE care-app/node_modules/find-up/index.d.ts
FILE care-app/node_modules/find-up/index.js
FILE care-app/node_modules/find-up/license
FILE care-app/node_modules/find-up/package.json
FILE care-app/node_modules/find-up/readme.md
FILE care-app/node_modules/flow-enums-runtime/CHANGELOG.md
FILE care-app/node_modules/flow-enums-runtime/LICENSE
FILE care-app/node_modules/flow-enums-runtime/README.md
FILE care-app/node_modules/flow-enums-runtime/index.js
FILE care-app/node_modules/flow-enums-runtime/package.json
FILE care-app/node_modules/fontfaceobserver/LICENSE
FILE care-app/node_modules/fontfaceobserver/README.md
FILE care-app/node_modules/fontfaceobserver/externs.js
FILE care-app/node_modules/fontfaceobserver/fontfaceobserver.js
FILE care-app/node_modules/fontfaceobserver/fontfaceobserver.standalone.js
FILE care-app/node_modules/fontfaceobserver/package.json
FILE care-app/node_modules/form-data/CHANGELOG.md
FILE care-app/node_modules/form-data/License
FILE care-app/node_modules/form-data/README.md
FILE care-app/node_modules/form-data/index.d.ts
FILE care-app/node_modules/form-data/package.json
FILE care-app/node_modules/fresh/HISTORY.md
FILE care-app/node_modules/fresh/LICENSE
FILE care-app/node_modules/fresh/README.md
FILE care-app/node_modules/fresh/index.js
FILE care-app/node_modules/fresh/package.json
FILE care-app/node_modules/fs.realpath/LICENSE
FILE care-app/node_modules/fs.realpath/README.md
FILE care-app/node_modules/fs.realpath/index.js
FILE care-app/node_modules/fs.realpath/old.js
FILE care-app/node_modules/fs.realpath/package.json
FILE care-app/node_modules/fsevents/LICENSE
FILE care-app/node_modules/fsevents/README.md
FILE care-app/node_modules/fsevents/fsevents.d.ts
FILE care-app/node_modules/fsevents/fsevents.js
FILE care-app/node_modules/fsevents/fsevents.node
FILE care-app/node_modules/fsevents/package.json
FILE care-app/node_modules/function-bind/.eslintrc
FILE care-app/node_modules/function-bind/.nycrc
FILE care-app/node_modules/function-bind/CHANGELOG.md
FILE care-app/node_modules/function-bind/LICENSE
FILE care-app/node_modules/function-bind/README.md
FILE care-app/node_modules/function-bind/implementation.js
FILE care-app/node_modules/function-bind/index.js
FILE care-app/node_modules/function-bind/package.json
FILE care-app/node_modules/gensync/LICENSE
FILE care-app/node_modules/gensync/README.md
FILE care-app/node_modules/gensync/index.js
FILE care-app/node_modules/gensync/index.js.flow
FILE care-app/node_modules/gensync/package.json
FILE care-app/node_modules/get-caller-file/LICENSE.md
FILE care-app/node_modules/get-caller-file/README.md
FILE care-app/node_modules/get-caller-file/index.d.ts
FILE care-app/node_modules/get-caller-file/index.js
FILE care-app/node_modules/get-caller-file/index.js.map
FILE care-app/node_modules/get-caller-file/package.json
FILE care-app/node_modules/get-intrinsic/.eslintrc
FILE care-app/node_modules/get-intrinsic/.nycrc
FILE care-app/node_modules/get-intrinsic/CHANGELOG.md
FILE care-app/node_modules/get-intrinsic/LICENSE
FILE care-app/node_modules/get-intrinsic/README.md
FILE care-app/node_modules/get-intrinsic/index.js
FILE care-app/node_modules/get-intrinsic/package.json
FILE care-app/node_modules/get-package-type/CHANGELOG.md
FILE care-app/node_modules/get-package-type/LICENSE
FILE care-app/node_modules/get-package-type/README.md
FILE care-app/node_modules/get-package-type/async.cjs
FILE care-app/node_modules/get-package-type/cache.cjs
FILE care-app/node_modules/get-package-type/index.cjs
FILE care-app/node_modules/get-package-type/is-node-modules.cjs
FILE care-app/node_modules/get-package-type/package.json
FILE care-app/node_modules/get-package-type/sync.cjs
FILE care-app/node_modules/get-proto/.eslintrc
FILE care-app/node_modules/get-proto/.nycrc
FILE care-app/node_modules/get-proto/CHANGELOG.md
FILE care-app/node_modules/get-proto/LICENSE
FILE care-app/node_modules/get-proto/Object.getPrototypeOf.d.ts
FILE care-app/node_modules/get-proto/Object.getPrototypeOf.js
FILE care-app/node_modules/get-proto/README.md
FILE care-app/node_modules/get-proto/Reflect.getPrototypeOf.d.ts
FILE care-app/node_modules/get-proto/Reflect.getPrototypeOf.js
FILE care-app/node_modules/get-proto/index.d.ts
FILE care-app/node_modules/get-proto/index.js
FILE care-app/node_modules/get-proto/package.json
FILE care-app/node_modules/get-proto/tsconfig.json
FILE care-app/node_modules/get-stream/buffer-stream.js
FILE care-app/node_modules/get-stream/index.d.ts
FILE care-app/node_modules/get-stream/index.js
FILE care-app/node_modules/get-stream/license
FILE care-app/node_modules/get-stream/package.json
FILE care-app/node_modules/get-stream/readme.md
FILE care-app/node_modules/getenv/LICENSE.md
FILE care-app/node_modules/getenv/README.md
FILE care-app/node_modules/getenv/index.js
FILE care-app/node_modules/getenv/package.json
FILE care-app/node_modules/glob/LICENSE.md
FILE care-app/node_modules/glob/README.md
FILE care-app/node_modules/glob/package.json
FILE care-app/node_modules/gopd/.eslintrc
FILE care-app/node_modules/gopd/CHANGELOG.md
FILE care-app/node_modules/gopd/LICENSE
FILE care-app/node_modules/gopd/README.md
FILE care-app/node_modules/gopd/gOPD.d.ts
FILE care-app/node_modules/gopd/gOPD.js
FILE care-app/node_modules/gopd/index.d.ts
FILE care-app/node_modules/gopd/index.js
FILE care-app/node_modules/gopd/package.json
FILE care-app/node_modules/gopd/tsconfig.json
FILE care-app/node_modules/graceful-fs/LICENSE
FILE care-app/node_modules/graceful-fs/README.md
FILE care-app/node_modules/graceful-fs/clone.js
FILE care-app/node_modules/graceful-fs/graceful-fs.js
FILE care-app/node_modules/graceful-fs/legacy-streams.js
FILE care-app/node_modules/graceful-fs/package.json
FILE care-app/node_modules/graceful-fs/polyfills.js
FILE care-app/node_modules/has-flag/index.d.ts
FILE care-app/node_modules/has-flag/index.js
FILE care-app/node_modules/has-flag/license
FILE care-app/node_modules/has-flag/package.json
FILE care-app/node_modules/has-flag/readme.md
FILE care-app/node_modules/has-symbols/.eslintrc
FILE care-app/node_modules/has-symbols/.nycrc
FILE care-app/node_modules/has-symbols/CHANGELOG.md
FILE care-app/node_modules/has-symbols/LICENSE
FILE care-app/node_modules/has-symbols/README.md
FILE care-app/node_modules/has-symbols/index.d.ts
FILE care-app/node_modules/has-symbols/index.js
FILE care-app/node_modules/has-symbols/package.json
FILE care-app/node_modules/has-symbols/shams.d.ts
FILE care-app/node_modules/has-symbols/shams.js
FILE care-app/node_modules/has-symbols/tsconfig.json
FILE care-app/node_modules/has-tostringtag/.eslintrc
FILE care-app/node_modules/has-tostringtag/.nycrc
FILE care-app/node_modules/has-tostringtag/CHANGELOG.md
FILE care-app/node_modules/has-tostringtag/LICENSE
FILE care-app/node_modules/has-tostringtag/README.md
FILE care-app/node_modules/has-tostringtag/index.d.ts
FILE care-app/node_modules/has-tostringtag/index.js
FILE care-app/node_modules/has-tostringtag/package.json
FILE care-app/node_modules/has-tostringtag/shams.d.ts
FILE care-app/node_modules/has-tostringtag/shams.js
FILE care-app/node_modules/has-tostringtag/tsconfig.json
FILE care-app/node_modules/hasown/.nycrc
FILE care-app/node_modules/hasown/CHANGELOG.md
FILE care-app/node_modules/hasown/LICENSE
FILE care-app/node_modules/hasown/README.md
FILE care-app/node_modules/hasown/eslint.config.mjs
FILE care-app/node_modules/hasown/index.d.ts
FILE care-app/node_modules/hasown/index.js
FILE care-app/node_modules/hasown/package.json
FILE care-app/node_modules/hasown/tsconfig.json
FILE care-app/node_modules/hermes-compiler/index.js
FILE care-app/node_modules/hermes-compiler/package.json
FILE care-app/node_modules/hermes-estree/LICENSE
FILE care-app/node_modules/hermes-estree/README.md
FILE care-app/node_modules/hermes-estree/package.json
FILE care-app/node_modules/hermes-parser/LICENSE
FILE care-app/node_modules/hermes-parser/README.md
FILE care-app/node_modules/hermes-parser/package.json
FILE care-app/node_modules/hosted-git-info/LICENSE
FILE care-app/node_modules/hosted-git-info/README.md
FILE care-app/node_modules/hosted-git-info/package.json
FILE care-app/node_modules/html-encoding-sniffer/LICENSE.txt
FILE care-app/node_modules/html-encoding-sniffer/README.md
FILE care-app/node_modules/html-encoding-sniffer/package.json
FILE care-app/node_modules/html-escaper/LICENSE.txt
FILE care-app/node_modules/html-escaper/README.md
FILE care-app/node_modules/html-escaper/index.js
FILE care-app/node_modules/html-escaper/min.js
FILE care-app/node_modules/html-escaper/package.json
FILE care-app/node_modules/http-errors/HISTORY.md
FILE care-app/node_modules/http-errors/LICENSE
FILE care-app/node_modules/http-errors/README.md
FILE care-app/node_modules/http-errors/index.js
FILE care-app/node_modules/http-errors/package.json
FILE care-app/node_modules/http-proxy-agent/README.md
FILE care-app/node_modules/http-proxy-agent/package.json
FILE care-app/node_modules/https-proxy-agent/LICENSE
FILE care-app/node_modules/https-proxy-agent/README.md
FILE care-app/node_modules/https-proxy-agent/package.json
FILE care-app/node_modules/human-signals/CHANGELOG.md
FILE care-app/node_modules/human-signals/LICENSE
FILE care-app/node_modules/human-signals/README.md
FILE care-app/node_modules/human-signals/package.json
FILE care-app/node_modules/iceberg-js/LICENSE
FILE care-app/node_modules/iceberg-js/README.md
FILE care-app/node_modules/iceberg-js/package.json
FILE care-app/node_modules/iconv-lite/Changelog.md
FILE care-app/node_modules/iconv-lite/LICENSE
FILE care-app/node_modules/iconv-lite/README.md
FILE care-app/node_modules/iconv-lite/package.json
FILE care-app/node_modules/ieee754/LICENSE
FILE care-app/node_modules/ieee754/README.md
FILE care-app/node_modules/ieee754/index.d.ts
FILE care-app/node_modules/ieee754/index.js
FILE care-app/node_modules/ieee754/package.json
FILE care-app/node_modules/ignore/LICENSE-MIT
FILE care-app/node_modules/ignore/README.md
FILE care-app/node_modules/ignore/index.d.ts
FILE care-app/node_modules/ignore/index.js
FILE care-app/node_modules/ignore/legacy.js
FILE care-app/node_modules/ignore/package.json
FILE care-app/node_modules/image-size/LICENSE
FILE care-app/node_modules/image-size/Readme.md
FILE care-app/node_modules/image-size/package.json
FILE care-app/node_modules/import-local/index.d.ts
FILE care-app/node_modules/import-local/index.js
FILE care-app/node_modules/import-local/license
FILE care-app/node_modules/import-local/package.json
FILE care-app/node_modules/import-local/readme.md
FILE care-app/node_modules/imurmurhash/README.md
FILE care-app/node_modules/imurmurhash/imurmurhash.js
FILE care-app/node_modules/imurmurhash/imurmurhash.min.js
FILE care-app/node_modules/imurmurhash/package.json
FILE care-app/node_modules/inflight/LICENSE
FILE care-app/node_modules/inflight/README.md
FILE care-app/node_modules/inflight/inflight.js
FILE care-app/node_modules/inflight/package.json
FILE care-app/node_modules/inherits/LICENSE
FILE care-app/node_modules/inherits/README.md
FILE care-app/node_modules/inherits/inherits.js
FILE care-app/node_modules/inherits/inherits_browser.js
FILE care-app/node_modules/inherits/package.json
FILE care-app/node_modules/invariant/CHANGELOG.md
FILE care-app/node_modules/invariant/LICENSE
FILE care-app/node_modules/invariant/README.md
FILE care-app/node_modules/invariant/browser.js
FILE care-app/node_modules/invariant/invariant.js
FILE care-app/node_modules/invariant/invariant.js.flow
FILE care-app/node_modules/invariant/package.json
FILE care-app/node_modules/is-arrayish/LICENSE
FILE care-app/node_modules/is-arrayish/README.md
FILE care-app/node_modules/is-arrayish/index.js
FILE care-app/node_modules/is-arrayish/package.json
FILE care-app/node_modules/is-core-module/.eslintrc
FILE care-app/node_modules/is-core-module/.nycrc
FILE care-app/node_modules/is-core-module/CHANGELOG.md
FILE care-app/node_modules/is-core-module/LICENSE
FILE care-app/node_modules/is-core-module/README.md
FILE care-app/node_modules/is-core-module/core.json
FILE care-app/node_modules/is-core-module/index.js
FILE care-app/node_modules/is-core-module/package.json
FILE care-app/node_modules/is-docker/cli.js
FILE care-app/node_modules/is-docker/index.d.ts
FILE care-app/node_modules/is-docker/index.js
FILE care-app/node_modules/is-docker/license
FILE care-app/node_modules/is-docker/package.json
FILE care-app/node_modules/is-docker/readme.md
FILE care-app/node_modules/is-fullwidth-code-point/index.d.ts
FILE care-app/node_modules/is-fullwidth-code-point/index.js
FILE care-app/node_modules/is-fullwidth-code-point/license
FILE care-app/node_modules/is-fullwidth-code-point/package.json
FILE care-app/node_modules/is-fullwidth-code-point/readme.md
FILE care-app/node_modules/is-generator-fn/index.d.ts
FILE care-app/node_modules/is-generator-fn/index.js
FILE care-app/node_modules/is-generator-fn/license
FILE care-app/node_modules/is-generator-fn/package.json
FILE care-app/node_modules/is-generator-fn/readme.md
FILE care-app/node_modules/is-number/LICENSE
FILE care-app/node_modules/is-number/README.md
FILE care-app/node_modules/is-number/index.js
FILE care-app/node_modules/is-number/package.json
FILE care-app/node_modules/is-plain-obj/index.d.ts
FILE care-app/node_modules/is-plain-obj/index.js
FILE care-app/node_modules/is-plain-obj/license
FILE care-app/node_modules/is-plain-obj/package.json
FILE care-app/node_modules/is-plain-obj/readme.md
FILE care-app/node_modules/is-potential-custom-element-name/LICENSE-MIT.txt
FILE care-app/node_modules/is-potential-custom-element-name/README.md
FILE care-app/node_modules/is-potential-custom-element-name/index.js
FILE care-app/node_modules/is-potential-custom-element-name/package.json
FILE care-app/node_modules/is-stream/index.d.ts
FILE care-app/node_modules/is-stream/index.js
FILE care-app/node_modules/is-stream/license
FILE care-app/node_modules/is-stream/package.json
FILE care-app/node_modules/is-stream/readme.md
FILE care-app/node_modules/is-wsl/index.d.ts
FILE care-app/node_modules/is-wsl/index.js
FILE care-app/node_modules/is-wsl/license
FILE care-app/node_modules/is-wsl/package.json
FILE care-app/node_modules/is-wsl/readme.md
FILE care-app/node_modules/isexe/.npmignore
FILE care-app/node_modules/isexe/LICENSE
FILE care-app/node_modules/isexe/README.md
FILE care-app/node_modules/isexe/index.js
FILE care-app/node_modules/isexe/mode.js
FILE care-app/node_modules/isexe/package.json
FILE care-app/node_modules/isexe/windows.js
FILE care-app/node_modules/istanbul-lib-coverage/CHANGELOG.md
FILE care-app/node_modules/istanbul-lib-coverage/LICENSE
FILE care-app/node_modules/istanbul-lib-coverage/README.md
FILE care-app/node_modules/istanbul-lib-coverage/index.js
FILE care-app/node_modules/istanbul-lib-coverage/package.json
FILE care-app/node_modules/istanbul-lib-instrument/CHANGELOG.md
FILE care-app/node_modules/istanbul-lib-instrument/LICENSE
FILE care-app/node_modules/istanbul-lib-instrument/README.md
FILE care-app/node_modules/istanbul-lib-instrument/package.json
FILE care-app/node_modules/istanbul-lib-report/CHANGELOG.md
FILE care-app/node_modules/istanbul-lib-report/LICENSE
FILE care-app/node_modules/istanbul-lib-report/README.md
FILE care-app/node_modules/istanbul-lib-report/index.js
FILE care-app/node_modules/istanbul-lib-report/package.json
FILE care-app/node_modules/istanbul-lib-source-maps/CHANGELOG.md
FILE care-app/node_modules/istanbul-lib-source-maps/LICENSE
FILE care-app/node_modules/istanbul-lib-source-maps/README.md
FILE care-app/node_modules/istanbul-lib-source-maps/index.js
FILE care-app/node_modules/istanbul-lib-source-maps/package.json
FILE care-app/node_modules/istanbul-reports/CHANGELOG.md
FILE care-app/node_modules/istanbul-reports/LICENSE
FILE care-app/node_modules/istanbul-reports/README.md
FILE care-app/node_modules/istanbul-reports/index.js
FILE care-app/node_modules/istanbul-reports/package.json
FILE care-app/node_modules/jest-changed-files/LICENSE
FILE care-app/node_modules/jest-changed-files/README.md
FILE care-app/node_modules/jest-changed-files/package.json
FILE care-app/node_modules/jest-circus/LICENSE
FILE care-app/node_modules/jest-circus/README.md
FILE care-app/node_modules/jest-circus/package.json
FILE care-app/node_modules/jest-circus/runner.js
FILE care-app/node_modules/jest-cli/LICENSE
FILE care-app/node_modules/jest-cli/README.md
FILE care-app/node_modules/jest-cli/package.json
FILE care-app/node_modules/jest-config/LICENSE
FILE care-app/node_modules/jest-config/package.json
FILE care-app/node_modules/jest-diff/LICENSE
FILE care-app/node_modules/jest-diff/README.md
FILE care-app/node_modules/jest-diff/package.json
FILE care-app/node_modules/jest-docblock/LICENSE
FILE care-app/node_modules/jest-docblock/README.md
FILE care-app/node_modules/jest-docblock/package.json
FILE care-app/node_modules/jest-each/LICENSE
FILE care-app/node_modules/jest-each/README.md
FILE care-app/node_modules/jest-each/package.json
FILE care-app/node_modules/jest-environment-jsdom/LICENSE
FILE care-app/node_modules/jest-environment-jsdom/package.json
FILE care-app/node_modules/jest-environment-node/LICENSE
FILE care-app/node_modules/jest-environment-node/package.json
FILE care-app/node_modules/jest-expo/LICENSE
FILE care-app/node_modules/jest-expo/README.md
FILE care-app/node_modules/jest-expo/jest-preset.js
FILE care-app/node_modules/jest-expo/package.json
FILE care-app/node_modules/jest-get-type/LICENSE
FILE care-app/node_modules/jest-get-type/package.json
FILE care-app/node_modules/jest-haste-map/LICENSE
FILE care-app/node_modules/jest-haste-map/package.json
FILE care-app/node_modules/jest-leak-detector/LICENSE
FILE care-app/node_modules/jest-leak-detector/README.md
FILE care-app/node_modules/jest-leak-detector/package.json
FILE care-app/node_modules/jest-matcher-utils/LICENSE
FILE care-app/node_modules/jest-matcher-utils/README.md
FILE care-app/node_modules/jest-matcher-utils/package.json
FILE care-app/node_modules/jest-message-util/LICENSE
FILE care-app/node_modules/jest-message-util/package.json
FILE care-app/node_modules/jest-mock/LICENSE
FILE care-app/node_modules/jest-mock/README.md
FILE care-app/node_modules/jest-mock/package.json
FILE care-app/node_modules/jest-pnp-resolver/README.md
FILE care-app/node_modules/jest-pnp-resolver/createRequire.js
FILE care-app/node_modules/jest-pnp-resolver/getDefaultResolver.js
FILE care-app/node_modules/jest-pnp-resolver/index.d.ts
FILE care-app/node_modules/jest-pnp-resolver/index.js
FILE care-app/node_modules/jest-pnp-resolver/package.json
FILE care-app/node_modules/jest-regex-util/LICENSE
FILE care-app/node_modules/jest-regex-util/package.json
FILE care-app/node_modules/jest-resolve-dependencies/LICENSE
FILE care-app/node_modules/jest-resolve-dependencies/package.json
FILE care-app/node_modules/jest-resolve/LICENSE
FILE care-app/node_modules/jest-resolve/package.json
FILE care-app/node_modules/jest-runner/LICENSE
FILE care-app/node_modules/jest-runner/package.json
FILE care-app/node_modules/jest-runtime/LICENSE
FILE care-app/node_modules/jest-runtime/package.json
FILE care-app/node_modules/jest-snapshot/LICENSE
FILE care-app/node_modules/jest-snapshot/package.json
FILE care-app/node_modules/jest-util/LICENSE
FILE care-app/node_modules/jest-util/Readme.md
FILE care-app/node_modules/jest-util/package.json
FILE care-app/node_modules/jest-validate/LICENSE
FILE care-app/node_modules/jest-validate/README.md
FILE care-app/node_modules/jest-validate/package.json
FILE care-app/node_modules/jest-watch-select-projects/CHANGELOG.md
FILE care-app/node_modules/jest-watch-select-projects/LICENSE
FILE care-app/node_modules/jest-watch-select-projects/README.md
FILE care-app/node_modules/jest-watch-select-projects/package.json
FILE care-app/node_modules/jest-watch-typeahead/LICENSE
FILE care-app/node_modules/jest-watch-typeahead/README.md
FILE care-app/node_modules/jest-watch-typeahead/filename.js
FILE care-app/node_modules/jest-watch-typeahead/package.json
FILE care-app/node_modules/jest-watch-typeahead/testname.js
FILE care-app/node_modules/jest-watcher/LICENSE
FILE care-app/node_modules/jest-watcher/package.json
FILE care-app/node_modules/jest-worker/LICENSE
FILE care-app/node_modules/jest-worker/README.md
FILE care-app/node_modules/jest-worker/package.json
FILE care-app/node_modules/jest/LICENSE
FILE care-app/node_modules/jest/README.md
FILE care-app/node_modules/jest/package.json
FILE care-app/node_modules/jimp-compact/README.md
FILE care-app/node_modules/jimp-compact/package.json
FILE care-app/node_modules/js-tokens/CHANGELOG.md
FILE care-app/node_modules/js-tokens/LICENSE
FILE care-app/node_modules/js-tokens/README.md
FILE care-app/node_modules/js-tokens/index.js
FILE care-app/node_modules/js-tokens/package.json
FILE care-app/node_modules/js-yaml/LICENSE
FILE care-app/node_modules/js-yaml/README.md
FILE care-app/node_modules/js-yaml/index.js
FILE care-app/node_modules/js-yaml/package.json
FILE care-app/node_modules/jsc-safe-url/LICENSE
FILE care-app/node_modules/jsc-safe-url/README.md
FILE care-app/node_modules/jsc-safe-url/index.d.ts
FILE care-app/node_modules/jsc-safe-url/index.js
FILE care-app/node_modules/jsc-safe-url/package.json
FILE care-app/node_modules/jsdom/LICENSE.txt
FILE care-app/node_modules/jsdom/README.md
FILE care-app/node_modules/jsdom/package.json
FILE care-app/node_modules/jsesc/LICENSE-MIT.txt
FILE care-app/node_modules/jsesc/README.md
FILE care-app/node_modules/jsesc/jsesc.js
FILE care-app/node_modules/jsesc/package.json
FILE care-app/node_modules/json-parse-even-better-errors/CHANGELOG.md
FILE care-app/node_modules/json-parse-even-better-errors/LICENSE.md
FILE care-app/node_modules/json-parse-even-better-errors/README.md
FILE care-app/node_modules/json-parse-even-better-errors/index.js
FILE care-app/node_modules/json-parse-even-better-errors/package.json
FILE care-app/node_modules/json5/LICENSE.md
FILE care-app/node_modules/json5/README.md
FILE care-app/node_modules/json5/package.json
FILE care-app/node_modules/kleur/index.js
FILE care-app/node_modules/kleur/kleur.d.ts
FILE care-app/node_modules/kleur/license
FILE care-app/node_modules/kleur/package.json
FILE care-app/node_modules/kleur/readme.md
FILE care-app/node_modules/lan-network/CHANGELOG.md
FILE care-app/node_modules/lan-network/LICENSE.md
FILE care-app/node_modules/lan-network/README.md
FILE care-app/node_modules/lan-network/package.json
FILE care-app/node_modules/leven/index.d.ts
FILE care-app/node_modules/leven/index.js
FILE care-app/node_modules/leven/license
FILE care-app/node_modules/leven/package.json
FILE care-app/node_modules/leven/readme.md
FILE care-app/node_modules/lighthouse-logger/LICENSE
FILE care-app/node_modules/lighthouse-logger/README.md
FILE care-app/node_modules/lighthouse-logger/index.js
FILE care-app/node_modules/lighthouse-logger/package.json
FILE care-app/node_modules/lightningcss-darwin-arm64/LICENSE
FILE care-app/node_modules/lightningcss-darwin-arm64/README.md
FILE care-app/node_modules/lightningcss-darwin-arm64/lightningcss.darwin-arm64.node
FILE care-app/node_modules/lightningcss-darwin-arm64/package.json
FILE care-app/node_modules/lightningcss/LICENSE
FILE care-app/node_modules/lightningcss/README.md
FILE care-app/node_modules/lightningcss/package.json
FILE care-app/node_modules/lines-and-columns/LICENSE
FILE care-app/node_modules/lines-and-columns/README.md
FILE care-app/node_modules/lines-and-columns/package.json
FILE care-app/node_modules/locate-path/index.d.ts
FILE care-app/node_modules/locate-path/index.js
FILE care-app/node_modules/locate-path/license
FILE care-app/node_modules/locate-path/package.json
FILE care-app/node_modules/locate-path/readme.md
FILE care-app/node_modules/lodash.debounce/LICENSE
FILE care-app/node_modules/lodash.debounce/README.md
FILE care-app/node_modules/lodash.debounce/index.js
FILE care-app/node_modules/lodash.debounce/package.json
FILE care-app/node_modules/lodash.throttle/LICENSE
FILE care-app/node_modules/lodash.throttle/README.md
FILE care-app/node_modules/lodash.throttle/index.js
FILE care-app/node_modules/lodash.throttle/package.json
FILE care-app/node_modules/lodash/LICENSE
FILE care-app/node_modules/lodash/README.md
FILE care-app/node_modules/lodash/_DataView.js
FILE care-app/node_modules/lodash/_Hash.js
FILE care-app/node_modules/lodash/_LazyWrapper.js
FILE care-app/node_modules/lodash/_ListCache.js
FILE care-app/node_modules/lodash/_LodashWrapper.js
FILE care-app/node_modules/lodash/_Map.js
FILE care-app/node_modules/lodash/_MapCache.js
FILE care-app/node_modules/lodash/_Promise.js
FILE care-app/node_modules/lodash/_Set.js
FILE care-app/node_modules/lodash/_SetCache.js
FILE care-app/node_modules/lodash/_Stack.js
FILE care-app/node_modules/lodash/_Symbol.js
FILE care-app/node_modules/lodash/_Uint8Array.js
FILE care-app/node_modules/lodash/_WeakMap.js
FILE care-app/node_modules/lodash/_apply.js
FILE care-app/node_modules/lodash/_arrayAggregator.js
FILE care-app/node_modules/lodash/_arrayEach.js
FILE care-app/node_modules/lodash/_arrayEachRight.js
FILE care-app/node_modules/lodash/_arrayEvery.js
FILE care-app/node_modules/lodash/_arrayFilter.js
FILE care-app/node_modules/lodash/_arrayIncludes.js
FILE care-app/node_modules/lodash/_arrayIncludesWith.js
FILE care-app/node_modules/lodash/_arrayLikeKeys.js
FILE care-app/node_modules/lodash/_arrayMap.js
FILE care-app/node_modules/lodash/_arrayPush.js
FILE care-app/node_modules/lodash/_arrayReduce.js
FILE care-app/node_modules/lodash/_arrayReduceRight.js
FILE care-app/node_modules/lodash/_arraySample.js
FILE care-app/node_modules/lodash/_arraySampleSize.js
FILE care-app/node_modules/lodash/_arrayShuffle.js
FILE care-app/node_modules/lodash/_arraySome.js
FILE care-app/node_modules/lodash/_asciiSize.js
FILE care-app/node_modules/lodash/_asciiToArray.js
FILE care-app/node_modules/lodash/_asciiWords.js
FILE care-app/node_modules/lodash/_assignMergeValue.js
FILE care-app/node_modules/lodash/_assignValue.js
FILE care-app/node_modules/lodash/_assocIndexOf.js
FILE care-app/node_modules/lodash/_baseAggregator.js
FILE care-app/node_modules/lodash/_baseAssign.js
FILE care-app/node_modules/lodash/_baseAssignIn.js
FILE care-app/node_modules/lodash/_baseAssignValue.js
FILE care-app/node_modules/lodash/_baseAt.js
FILE care-app/node_modules/lodash/_baseClamp.js
FILE care-app/node_modules/lodash/_baseClone.js
FILE care-app/node_modules/lodash/_baseConforms.js
FILE care-app/node_modules/lodash/_baseConformsTo.js
FILE care-app/node_modules/lodash/_baseCreate.js
FILE care-app/node_modules/lodash/_baseDelay.js
FILE care-app/node_modules/lodash/_baseDifference.js
FILE care-app/node_modules/lodash/_baseEach.js
FILE care-app/node_modules/lodash/_baseEachRight.js
FILE care-app/node_modules/lodash/_baseEvery.js
FILE care-app/node_modules/lodash/_baseExtremum.js
FILE care-app/node_modules/lodash/_baseFill.js
FILE care-app/node_modules/lodash/_baseFilter.js
FILE care-app/node_modules/lodash/_baseFindIndex.js
FILE care-app/node_modules/lodash/_baseFindKey.js
FILE care-app/node_modules/lodash/_baseFlatten.js
FILE care-app/node_modules/lodash/_baseFor.js
FILE care-app/node_modules/lodash/_baseForOwn.js
FILE care-app/node_modules/lodash/_baseForOwnRight.js
FILE care-app/node_modules/lodash/_baseForRight.js
FILE care-app/node_modules/lodash/_baseFunctions.js
FILE care-app/node_modules/lodash/_baseGet.js
FILE care-app/node_modules/lodash/_baseGetAllKeys.js
FILE care-app/node_modules/lodash/_baseGetTag.js
FILE care-app/node_modules/lodash/_baseGt.js
FILE care-app/node_modules/lodash/_baseHas.js
FILE care-app/node_modules/lodash/_baseHasIn.js
FILE care-app/node_modules/lodash/_baseInRange.js
FILE care-app/node_modules/lodash/_baseIndexOf.js
FILE care-app/node_modules/lodash/_baseIndexOfWith.js
FILE care-app/node_modules/lodash/_baseIntersection.js
FILE care-app/node_modules/lodash/_baseInverter.js
FILE care-app/node_modules/lodash/_baseInvoke.js
FILE care-app/node_modules/lodash/_baseIsArguments.js
FILE care-app/node_modules/lodash/_baseIsArrayBuffer.js
FILE care-app/node_modules/lodash/_baseIsDate.js
FILE care-app/node_modules/lodash/_baseIsEqual.js
FILE care-app/node_modules/lodash/_baseIsEqualDeep.js
FILE care-app/node_modules/lodash/_baseIsMap.js
FILE care-app/node_modules/lodash/_baseIsMatch.js
FILE care-app/node_modules/lodash/_baseIsNaN.js
FILE care-app/node_modules/lodash/_baseIsNative.js
FILE care-app/node_modules/lodash/_baseIsRegExp.js
FILE care-app/node_modules/lodash/_baseIsSet.js
FILE care-app/node_modules/lodash/_baseIsTypedArray.js
FILE care-app/node_modules/lodash/_baseIteratee.js
FILE care-app/node_modules/lodash/_baseKeys.js
FILE care-app/node_modules/lodash/_baseKeysIn.js
FILE care-app/node_modules/lodash/_baseLodash.js
FILE care-app/node_modules/lodash/_baseLt.js
FILE care-app/node_modules/lodash/_baseMap.js
FILE care-app/node_modules/lodash/_baseMatches.js
FILE care-app/node_modules/lodash/_baseMatchesProperty.js
FILE care-app/node_modules/lodash/_baseMean.js
FILE care-app/node_modules/lodash/_baseMerge.js
FILE care-app/node_modules/lodash/_baseMergeDeep.js
FILE care-app/node_modules/lodash/_baseNth.js
FILE care-app/node_modules/lodash/_baseOrderBy.js
FILE care-app/node_modules/lodash/_basePick.js
FILE care-app/node_modules/lodash/_basePickBy.js
FILE care-app/node_modules/lodash/_baseProperty.js
FILE care-app/node_modules/lodash/_basePropertyDeep.js
FILE care-app/node_modules/lodash/_basePropertyOf.js
FILE care-app/node_modules/lodash/_basePullAll.js
FILE care-app/node_modules/lodash/_basePullAt.js
FILE care-app/node_modules/lodash/_baseRandom.js
FILE care-app/node_modules/lodash/_baseRange.js
FILE care-app/node_modules/lodash/_baseReduce.js
FILE care-app/node_modules/lodash/_baseRepeat.js
FILE care-app/node_modules/lodash/_baseRest.js
FILE care-app/node_modules/lodash/_baseSample.js
FILE care-app/node_modules/lodash/_baseSampleSize.js
FILE care-app/node_modules/lodash/_baseSet.js
FILE care-app/node_modules/lodash/_baseSetData.js
FILE care-app/node_modules/lodash/_baseSetToString.js
FILE care-app/node_modules/lodash/_baseShuffle.js
FILE care-app/node_modules/lodash/_baseSlice.js
FILE care-app/node_modules/lodash/_baseSome.js
FILE care-app/node_modules/lodash/_baseSortBy.js
FILE care-app/node_modules/lodash/_baseSortedIndex.js
FILE care-app/node_modules/lodash/_baseSortedIndexBy.js
FILE care-app/node_modules/lodash/_baseSortedUniq.js
FILE care-app/node_modules/lodash/_baseSum.js
FILE care-app/node_modules/lodash/_baseTimes.js
FILE care-app/node_modules/lodash/_baseToNumber.js
FILE care-app/node_modules/lodash/_baseToPairs.js
FILE care-app/node_modules/lodash/_baseToString.js
FILE care-app/node_modules/lodash/_baseTrim.js
FILE care-app/node_modules/lodash/_baseUnary.js
FILE care-app/node_modules/lodash/_baseUniq.js
FILE care-app/node_modules/lodash/_baseUnset.js
FILE care-app/node_modules/lodash/_baseUpdate.js
FILE care-app/node_modules/lodash/_baseValues.js
FILE care-app/node_modules/lodash/_baseWhile.js
FILE care-app/node_modules/lodash/_baseWrapperValue.js
FILE care-app/node_modules/lodash/_baseXor.js
FILE care-app/node_modules/lodash/_baseZipObject.js
FILE care-app/node_modules/lodash/_cacheHas.js
FILE care-app/node_modules/lodash/_castArrayLikeObject.js
FILE care-app/node_modules/lodash/_castFunction.js
FILE care-app/node_modules/lodash/_castPath.js
FILE care-app/node_modules/lodash/_castRest.js
FILE care-app/node_modules/lodash/_castSlice.js
FILE care-app/node_modules/lodash/_charsEndIndex.js
FILE care-app/node_modules/lodash/_charsStartIndex.js
FILE care-app/node_modules/lodash/_cloneArrayBuffer.js
FILE care-app/node_modules/lodash/_cloneBuffer.js
FILE care-app/node_modules/lodash/_cloneDataView.js
FILE care-app/node_modules/lodash/_cloneRegExp.js
FILE care-app/node_modules/lodash/_cloneSymbol.js
FILE care-app/node_modules/lodash/_cloneTypedArray.js
FILE care-app/node_modules/lodash/_compareAscending.js
FILE care-app/node_modules/lodash/_compareMultiple.js
FILE care-app/node_modules/lodash/_composeArgs.js
FILE care-app/node_modules/lodash/_composeArgsRight.js
FILE care-app/node_modules/lodash/_copyArray.js
FILE care-app/node_modules/lodash/_copyObject.js
FILE care-app/node_modules/lodash/_copySymbols.js
FILE care-app/node_modules/lodash/_copySymbolsIn.js
FILE care-app/node_modules/lodash/_coreJsData.js
FILE care-app/node_modules/lodash/_countHolders.js
FILE care-app/node_modules/lodash/_createAggregator.js
FILE care-app/node_modules/lodash/_createAssigner.js
FILE care-app/node_modules/lodash/_createBaseEach.js
FILE care-app/node_modules/lodash/_createBaseFor.js
FILE care-app/node_modules/lodash/_createBind.js
FILE care-app/node_modules/lodash/_createCaseFirst.js
FILE care-app/node_modules/lodash/_createCompounder.js
FILE care-app/node_modules/lodash/_createCtor.js
FILE care-app/node_modules/lodash/_createCurry.js
FILE care-app/node_modules/lodash/_createFind.js
FILE care-app/node_modules/lodash/_createFlow.js
FILE care-app/node_modules/lodash/_createHybrid.js
FILE care-app/node_modules/lodash/_createInverter.js
FILE care-app/node_modules/lodash/_createMathOperation.js
FILE care-app/node_modules/lodash/_createOver.js
FILE care-app/node_modules/lodash/_createPadding.js
FILE care-app/node_modules/lodash/_createPartial.js
FILE care-app/node_modules/lodash/_createRange.js
FILE care-app/node_modules/lodash/_createRecurry.js
FILE care-app/node_modules/lodash/_createRelationalOperation.js
FILE care-app/node_modules/lodash/_createRound.js
FILE care-app/node_modules/lodash/_createSet.js
FILE care-app/node_modules/lodash/_createToPairs.js
FILE care-app/node_modules/lodash/_createWrap.js
FILE care-app/node_modules/lodash/_customDefaultsAssignIn.js
FILE care-app/node_modules/lodash/_customDefaultsMerge.js
FILE care-app/node_modules/lodash/_customOmitClone.js
FILE care-app/node_modules/lodash/_deburrLetter.js
FILE care-app/node_modules/lodash/_defineProperty.js
FILE care-app/node_modules/lodash/_equalArrays.js
FILE care-app/node_modules/lodash/_equalByTag.js
FILE care-app/node_modules/lodash/_equalObjects.js
FILE care-app/node_modules/lodash/_escapeHtmlChar.js
FILE care-app/node_modules/lodash/_escapeStringChar.js
FILE care-app/node_modules/lodash/_flatRest.js
FILE care-app/node_modules/lodash/_freeGlobal.js
FILE care-app/node_modules/lodash/_getAllKeys.js
FILE care-app/node_modules/lodash/_getAllKeysIn.js
FILE care-app/node_modules/lodash/_getData.js
FILE care-app/node_modules/lodash/_getFuncName.js
FILE care-app/node_modules/lodash/_getHolder.js
FILE care-app/node_modules/lodash/_getMapData.js
FILE care-app/node_modules/lodash/_getMatchData.js
FILE care-app/node_modules/lodash/_getNative.js
FILE care-app/node_modules/lodash/_getPrototype.js
FILE care-app/node_modules/lodash/_getRawTag.js
FILE care-app/node_modules/lodash/_getSymbols.js
FILE care-app/node_modules/lodash/_getSymbolsIn.js
FILE care-app/node_modules/lodash/_getTag.js
FILE care-app/node_modules/lodash/_getValue.js
FILE care-app/node_modules/lodash/_getView.js
FILE care-app/node_modules/lodash/_getWrapDetails.js
FILE care-app/node_modules/lodash/_hasPath.js
FILE care-app/node_modules/lodash/_hasUnicode.js
FILE care-app/node_modules/lodash/_hasUnicodeWord.js
FILE care-app/node_modules/lodash/_hashClear.js
FILE care-app/node_modules/lodash/_hashDelete.js
FILE care-app/node_modules/lodash/_hashGet.js
FILE care-app/node_modules/lodash/_hashHas.js
FILE care-app/node_modules/lodash/_hashSet.js
FILE care-app/node_modules/lodash/_initCloneArray.js
FILE care-app/node_modules/lodash/_initCloneByTag.js
FILE care-app/node_modules/lodash/_initCloneObject.js
FILE care-app/node_modules/lodash/_insertWrapDetails.js
FILE care-app/node_modules/lodash/_isFlattenable.js
FILE care-app/node_modules/lodash/_isIndex.js
FILE care-app/node_modules/lodash/_isIterateeCall.js
FILE care-app/node_modules/lodash/_isKey.js
FILE care-app/node_modules/lodash/_isKeyable.js
FILE care-app/node_modules/lodash/_isLaziable.js
FILE care-app/node_modules/lodash/_isMaskable.js
FILE care-app/node_modules/lodash/_isMasked.js
FILE care-app/node_modules/lodash/_isPrototype.js
FILE care-app/node_modules/lodash/_isStrictComparable.js
FILE care-app/node_modules/lodash/_iteratorToArray.js
FILE care-app/node_modules/lodash/_lazyClone.js
FILE care-app/node_modules/lodash/_lazyReverse.js
FILE care-app/node_modules/lodash/_lazyValue.js
FILE care-app/node_modules/lodash/_listCacheClear.js
FILE care-app/node_modules/lodash/_listCacheDelete.js
FILE care-app/node_modules/lodash/_listCacheGet.js
FILE care-app/node_modules/lodash/_listCacheHas.js
FILE care-app/node_modules/lodash/_listCacheSet.js
FILE care-app/node_modules/lodash/_mapCacheClear.js
FILE care-app/node_modules/lodash/_mapCacheDelete.js
FILE care-app/node_modules/lodash/_mapCacheGet.js
FILE care-app/node_modules/lodash/_mapCacheHas.js
FILE care-app/node_modules/lodash/_mapCacheSet.js
FILE care-app/node_modules/lodash/_mapToArray.js
FILE care-app/node_modules/lodash/_matchesStrictComparable.js
FILE care-app/node_modules/lodash/_memoizeCapped.js
FILE care-app/node_modules/lodash/_mergeData.js
FILE care-app/node_modules/lodash/_metaMap.js
FILE care-app/node_modules/lodash/_nativeCreate.js
FILE care-app/node_modules/lodash/_nativeKeys.js
FILE care-app/node_modules/lodash/_nativeKeysIn.js
FILE care-app/node_modules/lodash/_nodeUtil.js
FILE care-app/node_modules/lodash/_objectToString.js
FILE care-app/node_modules/lodash/_overArg.js
FILE care-app/node_modules/lodash/_overRest.js
FILE care-app/node_modules/lodash/_parent.js
FILE care-app/node_modules/lodash/_reEscape.js
FILE care-app/node_modules/lodash/_reEvaluate.js
FILE care-app/node_modules/lodash/_reInterpolate.js
FILE care-app/node_modules/lodash/_realNames.js
FILE care-app/node_modules/lodash/_reorder.js
FILE care-app/node_modules/lodash/_replaceHolders.js
FILE care-app/node_modules/lodash/_root.js
FILE care-app/node_modules/lodash/_safeGet.js
FILE care-app/node_modules/lodash/_setCacheAdd.js
FILE care-app/node_modules/lodash/_setCacheHas.js
FILE care-app/node_modules/lodash/_setData.js
FILE care-app/node_modules/lodash/_setToArray.js
FILE care-app/node_modules/lodash/_setToPairs.js
FILE care-app/node_modules/lodash/_setToString.js
FILE care-app/node_modules/lodash/_setWrapToString.js
FILE care-app/node_modules/lodash/_shortOut.js
FILE care-app/node_modules/lodash/_shuffleSelf.js
FILE care-app/node_modules/lodash/_stackClear.js
FILE care-app/node_modules/lodash/_stackDelete.js
FILE care-app/node_modules/lodash/_stackGet.js
FILE care-app/node_modules/lodash/_stackHas.js
FILE care-app/node_modules/lodash/_stackSet.js
FILE care-app/node_modules/lodash/_strictIndexOf.js
FILE care-app/node_modules/lodash/_strictLastIndexOf.js
FILE care-app/node_modules/lodash/_stringSize.js
FILE care-app/node_modules/lodash/_stringToArray.js
FILE care-app/node_modules/lodash/_stringToPath.js
FILE care-app/node_modules/lodash/_toKey.js
FILE care-app/node_modules/lodash/_toSource.js
FILE care-app/node_modules/lodash/_trimmedEndIndex.js
FILE care-app/node_modules/lodash/_unescapeHtmlChar.js
FILE care-app/node_modules/lodash/_unicodeSize.js
FILE care-app/node_modules/lodash/_unicodeToArray.js
FILE care-app/node_modules/lodash/_unicodeWords.js
FILE care-app/node_modules/lodash/_updateWrapDetails.js
FILE care-app/node_modules/lodash/_wrapperClone.js
FILE care-app/node_modules/lodash/add.js
FILE care-app/node_modules/lodash/after.js
FILE care-app/node_modules/lodash/array.js
FILE care-app/node_modules/lodash/ary.js
FILE care-app/node_modules/lodash/assign.js
FILE care-app/node_modules/lodash/assignIn.js
FILE care-app/node_modules/lodash/assignInWith.js
FILE care-app/node_modules/lodash/assignWith.js
FILE care-app/node_modules/lodash/at.js
FILE care-app/node_modules/lodash/attempt.js
FILE care-app/node_modules/lodash/before.js
FILE care-app/node_modules/lodash/bind.js
FILE care-app/node_modules/lodash/bindAll.js
FILE care-app/node_modules/lodash/bindKey.js
FILE care-app/node_modules/lodash/camelCase.js
FILE care-app/node_modules/lodash/capitalize.js
FILE care-app/node_modules/lodash/castArray.js
FILE care-app/node_modules/lodash/ceil.js
FILE care-app/node_modules/lodash/chain.js
FILE care-app/node_modules/lodash/chunk.js
FILE care-app/node_modules/lodash/clamp.js
FILE care-app/node_modules/lodash/clone.js
FILE care-app/node_modules/lodash/cloneDeep.js
FILE care-app/node_modules/lodash/cloneDeepWith.js
FILE care-app/node_modules/lodash/cloneWith.js
FILE care-app/node_modules/lodash/collection.js
FILE care-app/node_modules/lodash/commit.js
FILE care-app/node_modules/lodash/compact.js
FILE care-app/node_modules/lodash/concat.js
FILE care-app/node_modules/lodash/cond.js
FILE care-app/node_modules/lodash/conforms.js
FILE care-app/node_modules/lodash/conformsTo.js
FILE care-app/node_modules/lodash/constant.js
FILE care-app/node_modules/lodash/core.js
FILE care-app/node_modules/lodash/core.min.js
FILE care-app/node_modules/lodash/countBy.js
FILE care-app/node_modules/lodash/create.js
FILE care-app/node_modules/lodash/curry.js
FILE care-app/node_modules/lodash/curryRight.js
FILE care-app/node_modules/lodash/date.js
FILE care-app/node_modules/lodash/debounce.js
FILE care-app/node_modules/lodash/deburr.js
FILE care-app/node_modules/lodash/defaultTo.js
FILE care-app/node_modules/lodash/defaults.js
FILE care-app/node_modules/lodash/defaultsDeep.js
FILE care-app/node_modules/lodash/defer.js
FILE care-app/node_modules/lodash/delay.js
FILE care-app/node_modules/lodash/difference.js
FILE care-app/node_modules/lodash/differenceBy.js
FILE care-app/node_modules/lodash/differenceWith.js
FILE care-app/node_modules/lodash/divide.js
FILE care-app/node_modules/lodash/drop.js
FILE care-app/node_modules/lodash/dropRight.js
FILE care-app/node_modules/lodash/dropRightWhile.js
FILE care-app/node_modules/lodash/dropWhile.js
FILE care-app/node_modules/lodash/each.js
FILE care-app/node_modules/lodash/eachRight.js
FILE care-app/node_modules/lodash/endsWith.js
FILE care-app/node_modules/lodash/entries.js
FILE care-app/node_modules/lodash/entriesIn.js
FILE care-app/node_modules/lodash/eq.js
FILE care-app/node_modules/lodash/escape.js
FILE care-app/node_modules/lodash/escapeRegExp.js
FILE care-app/node_modules/lodash/every.js
FILE care-app/node_modules/lodash/extend.js
FILE care-app/node_modules/lodash/extendWith.js
FILE care-app/node_modules/lodash/fill.js
FILE care-app/node_modules/lodash/filter.js
FILE care-app/node_modules/lodash/find.js
FILE care-app/node_modules/lodash/findIndex.js
FILE care-app/node_modules/lodash/findKey.js
FILE care-app/node_modules/lodash/findLast.js
FILE care-app/node_modules/lodash/findLastIndex.js
FILE care-app/node_modules/lodash/findLastKey.js
FILE care-app/node_modules/lodash/first.js
FILE care-app/node_modules/lodash/flatMap.js
FILE care-app/node_modules/lodash/flatMapDeep.js
FILE care-app/node_modules/lodash/flatMapDepth.js
FILE care-app/node_modules/lodash/flatten.js
FILE care-app/node_modules/lodash/flattenDeep.js
FILE care-app/node_modules/lodash/flattenDepth.js
FILE care-app/node_modules/lodash/flip.js
FILE care-app/node_modules/lodash/floor.js
FILE care-app/node_modules/lodash/flow.js
FILE care-app/node_modules/lodash/flowRight.js
FILE care-app/node_modules/lodash/forEach.js
FILE care-app/node_modules/lodash/forEachRight.js
FILE care-app/node_modules/lodash/forIn.js
FILE care-app/node_modules/lodash/forInRight.js
FILE care-app/node_modules/lodash/forOwn.js
FILE care-app/node_modules/lodash/forOwnRight.js
FILE care-app/node_modules/lodash/fp.js
FILE care-app/node_modules/lodash/fromPairs.js
FILE care-app/node_modules/lodash/function.js
FILE care-app/node_modules/lodash/functions.js
FILE care-app/node_modules/lodash/functionsIn.js
FILE care-app/node_modules/lodash/get.js
FILE care-app/node_modules/lodash/groupBy.js
FILE care-app/node_modules/lodash/gt.js
FILE care-app/node_modules/lodash/gte.js
FILE care-app/node_modules/lodash/has.js
FILE care-app/node_modules/lodash/hasIn.js
FILE care-app/node_modules/lodash/head.js
FILE care-app/node_modules/lodash/identity.js
FILE care-app/node_modules/lodash/inRange.js
FILE care-app/node_modules/lodash/includes.js
FILE care-app/node_modules/lodash/index.js
FILE care-app/node_modules/lodash/indexOf.js
FILE care-app/node_modules/lodash/initial.js
FILE care-app/node_modules/lodash/intersection.js
FILE care-app/node_modules/lodash/intersectionBy.js
FILE care-app/node_modules/lodash/intersectionWith.js
FILE care-app/node_modules/lodash/invert.js
FILE care-app/node_modules/lodash/invertBy.js
FILE care-app/node_modules/lodash/invoke.js
FILE care-app/node_modules/lodash/invokeMap.js
FILE care-app/node_modules/lodash/isArguments.js
FILE care-app/node_modules/lodash/isArray.js
FILE care-app/node_modules/lodash/isArrayBuffer.js
FILE care-app/node_modules/lodash/isArrayLike.js
FILE care-app/node_modules/lodash/isArrayLikeObject.js
FILE care-app/node_modules/lodash/isBoolean.js
FILE care-app/node_modules/lodash/isBuffer.js
FILE care-app/node_modules/lodash/isDate.js
FILE care-app/node_modules/lodash/isElement.js
FILE care-app/node_modules/lodash/isEmpty.js
FILE care-app/node_modules/lodash/isEqual.js
FILE care-app/node_modules/lodash/isEqualWith.js
FILE care-app/node_modules/lodash/isError.js
FILE care-app/node_modules/lodash/isFinite.js
FILE care-app/node_modules/lodash/isFunction.js
FILE care-app/node_modules/lodash/isInteger.js
FILE care-app/node_modules/lodash/isLength.js
FILE care-app/node_modules/lodash/isMap.js
FILE care-app/node_modules/lodash/isMatch.js
FILE care-app/node_modules/lodash/isMatchWith.js
FILE care-app/node_modules/lodash/isNaN.js
FILE care-app/node_modules/lodash/isNative.js
FILE care-app/node_modules/lodash/isNil.js
FILE care-app/node_modules/lodash/isNull.js
FILE care-app/node_modules/lodash/isNumber.js
FILE care-app/node_modules/lodash/isObject.js
FILE care-app/node_modules/lodash/isObjectLike.js
FILE care-app/node_modules/lodash/isPlainObject.js
FILE care-app/node_modules/lodash/isRegExp.js
FILE care-app/node_modules/lodash/isSafeInteger.js
FILE care-app/node_modules/lodash/isSet.js
FILE care-app/node_modules/lodash/isString.js
FILE care-app/node_modules/lodash/isSymbol.js
FILE care-app/node_modules/lodash/isTypedArray.js
FILE care-app/node_modules/lodash/isUndefined.js
FILE care-app/node_modules/lodash/isWeakMap.js
FILE care-app/node_modules/lodash/isWeakSet.js
FILE care-app/node_modules/lodash/iteratee.js
FILE care-app/node_modules/lodash/join.js
FILE care-app/node_modules/lodash/kebabCase.js
FILE care-app/node_modules/lodash/keyBy.js
FILE care-app/node_modules/lodash/keys.js
FILE care-app/node_modules/lodash/keysIn.js
FILE care-app/node_modules/lodash/lang.js
FILE care-app/node_modules/lodash/last.js
FILE care-app/node_modules/lodash/lastIndexOf.js
FILE care-app/node_modules/lodash/lodash.js
FILE care-app/node_modules/lodash/lodash.min.js
FILE care-app/node_modules/lodash/lowerCase.js
FILE care-app/node_modules/lodash/lowerFirst.js
FILE care-app/node_modules/lodash/lt.js
FILE care-app/node_modules/lodash/lte.js
FILE care-app/node_modules/lodash/map.js
FILE care-app/node_modules/lodash/mapKeys.js
FILE care-app/node_modules/lodash/mapValues.js
FILE care-app/node_modules/lodash/matches.js
FILE care-app/node_modules/lodash/matchesProperty.js
FILE care-app/node_modules/lodash/math.js
FILE care-app/node_modules/lodash/max.js
FILE care-app/node_modules/lodash/maxBy.js
FILE care-app/node_modules/lodash/mean.js
FILE care-app/node_modules/lodash/meanBy.js
FILE care-app/node_modules/lodash/memoize.js
FILE care-app/node_modules/lodash/merge.js
FILE care-app/node_modules/lodash/mergeWith.js
FILE care-app/node_modules/lodash/method.js
FILE care-app/node_modules/lodash/methodOf.js
FILE care-app/node_modules/lodash/min.js
FILE care-app/node_modules/lodash/minBy.js
FILE care-app/node_modules/lodash/mixin.js
FILE care-app/node_modules/lodash/multiply.js
FILE care-app/node_modules/lodash/negate.js
FILE care-app/node_modules/lodash/next.js
FILE care-app/node_modules/lodash/noop.js
FILE care-app/node_modules/lodash/now.js
FILE care-app/node_modules/lodash/nth.js
FILE care-app/node_modules/lodash/nthArg.js
FILE care-app/node_modules/lodash/number.js
FILE care-app/node_modules/lodash/object.js
FILE care-app/node_modules/lodash/omit.js
FILE care-app/node_modules/lodash/omitBy.js
FILE care-app/node_modules/lodash/once.js
FILE care-app/node_modules/lodash/orderBy.js
FILE care-app/node_modules/lodash/over.js
FILE care-app/node_modules/lodash/overArgs.js
FILE care-app/node_modules/lodash/overEvery.js
FILE care-app/node_modules/lodash/overSome.js
FILE care-app/node_modules/lodash/package.json
FILE care-app/node_modules/lodash/pad.js
FILE care-app/node_modules/lodash/padEnd.js
FILE care-app/node_modules/lodash/padStart.js
FILE care-app/node_modules/lodash/parseInt.js
FILE care-app/node_modules/lodash/partial.js
FILE care-app/node_modules/lodash/partialRight.js
FILE care-app/node_modules/lodash/partition.js
FILE care-app/node_modules/lodash/pick.js
FILE care-app/node_modules/lodash/pickBy.js
FILE care-app/node_modules/lodash/plant.js
FILE care-app/node_modules/lodash/property.js
FILE care-app/node_modules/lodash/propertyOf.js
FILE care-app/node_modules/lodash/pull.js
FILE care-app/node_modules/lodash/pullAll.js
FILE care-app/node_modules/lodash/pullAllBy.js
FILE care-app/node_modules/lodash/pullAllWith.js
FILE care-app/node_modules/lodash/pullAt.js
FILE care-app/node_modules/lodash/random.js
FILE care-app/node_modules/lodash/range.js
FILE care-app/node_modules/lodash/rangeRight.js
FILE care-app/node_modules/lodash/rearg.js
FILE care-app/node_modules/lodash/reduce.js
FILE care-app/node_modules/lodash/reduceRight.js
FILE care-app/node_modules/lodash/reject.js
FILE care-app/node_modules/lodash/remove.js
FILE care-app/node_modules/lodash/repeat.js
FILE care-app/node_modules/lodash/replace.js
FILE care-app/node_modules/lodash/rest.js
FILE care-app/node_modules/lodash/result.js
FILE care-app/node_modules/lodash/reverse.js
FILE care-app/node_modules/lodash/round.js
FILE care-app/node_modules/lodash/sample.js
FILE care-app/node_modules/lodash/sampleSize.js
FILE care-app/node_modules/lodash/seq.js
FILE care-app/node_modules/lodash/set.js
FILE care-app/node_modules/lodash/setWith.js
FILE care-app/node_modules/lodash/shuffle.js
FILE care-app/node_modules/lodash/size.js
FILE care-app/node_modules/lodash/slice.js
FILE care-app/node_modules/lodash/snakeCase.js
FILE care-app/node_modules/lodash/some.js
FILE care-app/node_modules/lodash/sortBy.js
FILE care-app/node_modules/lodash/sortedIndex.js
FILE care-app/node_modules/lodash/sortedIndexBy.js
FILE care-app/node_modules/lodash/sortedIndexOf.js
FILE care-app/node_modules/lodash/sortedLastIndex.js
FILE care-app/node_modules/lodash/sortedLastIndexBy.js
FILE care-app/node_modules/lodash/sortedLastIndexOf.js
FILE care-app/node_modules/lodash/sortedUniq.js
FILE care-app/node_modules/lodash/sortedUniqBy.js
FILE care-app/node_modules/lodash/split.js
FILE care-app/node_modules/lodash/spread.js
FILE care-app/node_modules/lodash/startCase.js
FILE care-app/node_modules/lodash/startsWith.js
FILE care-app/node_modules/lodash/string.js
FILE care-app/node_modules/lodash/stubArray.js
FILE care-app/node_modules/lodash/stubFalse.js
FILE care-app/node_modules/lodash/stubObject.js
FILE care-app/node_modules/lodash/stubString.js
FILE care-app/node_modules/lodash/stubTrue.js
FILE care-app/node_modules/lodash/subtract.js
FILE care-app/node_modules/lodash/sum.js
FILE care-app/node_modules/lodash/sumBy.js
FILE care-app/node_modules/lodash/tail.js
FILE care-app/node_modules/lodash/take.js
FILE care-app/node_modules/lodash/takeRight.js
FILE care-app/node_modules/lodash/takeRightWhile.js
FILE care-app/node_modules/lodash/takeWhile.js
FILE care-app/node_modules/lodash/tap.js
FILE care-app/node_modules/lodash/template.js
FILE care-app/node_modules/lodash/templateSettings.js
FILE care-app/node_modules/lodash/throttle.js
FILE care-app/node_modules/lodash/thru.js
FILE care-app/node_modules/lodash/times.js
FILE care-app/node_modules/lodash/toArray.js
FILE care-app/node_modules/lodash/toFinite.js
FILE care-app/node_modules/lodash/toInteger.js
FILE care-app/node_modules/lodash/toIterator.js
FILE care-app/node_modules/lodash/toJSON.js
FILE care-app/node_modules/lodash/toLength.js
FILE care-app/node_modules/lodash/toLower.js
FILE care-app/node_modules/lodash/toNumber.js
FILE care-app/node_modules/lodash/toPairs.js
FILE care-app/node_modules/lodash/toPairsIn.js
FILE care-app/node_modules/lodash/toPath.js
FILE care-app/node_modules/lodash/toPlainObject.js
FILE care-app/node_modules/lodash/toSafeInteger.js
FILE care-app/node_modules/lodash/toString.js
FILE care-app/node_modules/lodash/toUpper.js
FILE care-app/node_modules/lodash/transform.js
FILE care-app/node_modules/lodash/trim.js
FILE care-app/node_modules/lodash/trimEnd.js
FILE care-app/node_modules/lodash/trimStart.js
FILE care-app/node_modules/lodash/truncate.js
FILE care-app/node_modules/lodash/unary.js
FILE care-app/node_modules/lodash/unescape.js
FILE care-app/node_modules/lodash/union.js
FILE care-app/node_modules/lodash/unionBy.js
FILE care-app/node_modules/lodash/unionWith.js
FILE care-app/node_modules/lodash/uniq.js
FILE care-app/node_modules/lodash/uniqBy.js
FILE care-app/node_modules/lodash/uniqWith.js
FILE care-app/node_modules/lodash/uniqueId.js
FILE care-app/node_modules/lodash/unset.js
FILE care-app/node_modules/lodash/unzip.js
FILE care-app/node_modules/lodash/unzipWith.js
FILE care-app/node_modules/lodash/update.js
FILE care-app/node_modules/lodash/updateWith.js
FILE care-app/node_modules/lodash/upperCase.js
FILE care-app/node_modules/lodash/upperFirst.js
FILE care-app/node_modules/lodash/util.js
FILE care-app/node_modules/lodash/value.js
FILE care-app/node_modules/lodash/valueOf.js
FILE care-app/node_modules/lodash/values.js
FILE care-app/node_modules/lodash/valuesIn.js
FILE care-app/node_modules/lodash/without.js
FILE care-app/node_modules/lodash/words.js
FILE care-app/node_modules/lodash/wrap.js
FILE care-app/node_modules/lodash/wrapperAt.js
FILE care-app/node_modules/lodash/wrapperChain.js
FILE care-app/node_modules/lodash/wrapperLodash.js
FILE care-app/node_modules/lodash/wrapperReverse.js
FILE care-app/node_modules/lodash/wrapperValue.js
FILE care-app/node_modules/lodash/xor.js
FILE care-app/node_modules/lodash/xorBy.js
FILE care-app/node_modules/lodash/xorWith.js
FILE care-app/node_modules/lodash/zip.js
FILE care-app/node_modules/lodash/zipObject.js
FILE care-app/node_modules/lodash/zipObjectDeep.js
FILE care-app/node_modules/lodash/zipWith.js
FILE care-app/node_modules/log-symbols/browser.js
FILE care-app/node_modules/log-symbols/index.js
FILE care-app/node_modules/log-symbols/license
FILE care-app/node_modules/log-symbols/package.json
FILE care-app/node_modules/log-symbols/readme.md
FILE care-app/node_modules/loose-envify/LICENSE
FILE care-app/node_modules/loose-envify/README.md
FILE care-app/node_modules/loose-envify/cli.js
FILE care-app/node_modules/loose-envify/custom.js
FILE care-app/node_modules/loose-envify/index.js
FILE care-app/node_modules/loose-envify/loose-envify.js
FILE care-app/node_modules/loose-envify/package.json
FILE care-app/node_modules/loose-envify/replace.js
FILE care-app/node_modules/lru-cache/LICENSE
FILE care-app/node_modules/lru-cache/README.md
FILE care-app/node_modules/lru-cache/index.js
FILE care-app/node_modules/lru-cache/package.json
FILE care-app/node_modules/make-dir/index.d.ts
FILE care-app/node_modules/make-dir/index.js
FILE care-app/node_modules/make-dir/license
FILE care-app/node_modules/make-dir/package.json
FILE care-app/node_modules/make-dir/readme.md
FILE care-app/node_modules/makeerror/.travis.yml
FILE care-app/node_modules/makeerror/license
FILE care-app/node_modules/makeerror/package.json
FILE care-app/node_modules/makeerror/readme.md
FILE care-app/node_modules/marky/LICENSE
FILE care-app/node_modules/marky/README.md
FILE care-app/node_modules/marky/marky.d.ts
FILE care-app/node_modules/marky/package.json
FILE care-app/node_modules/math-intrinsics/.eslintrc
FILE care-app/node_modules/math-intrinsics/CHANGELOG.md
FILE care-app/node_modules/math-intrinsics/LICENSE
FILE care-app/node_modules/math-intrinsics/README.md
FILE care-app/node_modules/math-intrinsics/abs.d.ts
FILE care-app/node_modules/math-intrinsics/abs.js
FILE care-app/node_modules/math-intrinsics/floor.d.ts
FILE care-app/node_modules/math-intrinsics/floor.js
FILE care-app/node_modules/math-intrinsics/isFinite.d.ts
FILE care-app/node_modules/math-intrinsics/isFinite.js
FILE care-app/node_modules/math-intrinsics/isInteger.d.ts
FILE care-app/node_modules/math-intrinsics/isInteger.js
FILE care-app/node_modules/math-intrinsics/isNaN.d.ts
FILE care-app/node_modules/math-intrinsics/isNaN.js
FILE care-app/node_modules/math-intrinsics/isNegativeZero.d.ts
FILE care-app/node_modules/math-intrinsics/isNegativeZero.js
FILE care-app/node_modules/math-intrinsics/max.d.ts
FILE care-app/node_modules/math-intrinsics/max.js
FILE care-app/node_modules/math-intrinsics/min.d.ts
FILE care-app/node_modules/math-intrinsics/min.js
FILE care-app/node_modules/math-intrinsics/mod.d.ts
FILE care-app/node_modules/math-intrinsics/mod.js
FILE care-app/node_modules/math-intrinsics/package.json
FILE care-app/node_modules/math-intrinsics/pow.d.ts
FILE care-app/node_modules/math-intrinsics/pow.js
FILE care-app/node_modules/math-intrinsics/round.d.ts
FILE care-app/node_modules/math-intrinsics/round.js
FILE care-app/node_modules/math-intrinsics/sign.d.ts
FILE care-app/node_modules/math-intrinsics/sign.js
FILE care-app/node_modules/math-intrinsics/tsconfig.json
FILE care-app/node_modules/memoize-one/LICENSE
FILE care-app/node_modules/memoize-one/README.md
FILE care-app/node_modules/memoize-one/package.json
FILE care-app/node_modules/merge-options/index.d.ts
FILE care-app/node_modules/merge-options/index.js
FILE care-app/node_modules/merge-options/index.mjs
FILE care-app/node_modules/merge-options/license
FILE care-app/node_modules/merge-options/package.json
FILE care-app/node_modules/merge-options/readme.md
FILE care-app/node_modules/merge-stream/LICENSE
FILE care-app/node_modules/merge-stream/README.md
FILE care-app/node_modules/merge-stream/index.js
FILE care-app/node_modules/merge-stream/package.json
FILE care-app/node_modules/metro-babel-transformer/package.json
FILE care-app/node_modules/metro-cache-key/package.json
FILE care-app/node_modules/metro-cache/package.json
FILE care-app/node_modules/metro-config/README.md
FILE care-app/node_modules/metro-config/package.json
FILE care-app/node_modules/metro-core/README.md
FILE care-app/node_modules/metro-core/package.json
FILE care-app/node_modules/metro-file-map/README.md
FILE care-app/node_modules/metro-file-map/package.json
FILE care-app/node_modules/metro-minify-terser/package.json
FILE care-app/node_modules/metro-resolver/README.md
FILE care-app/node_modules/metro-resolver/package.json
FILE care-app/node_modules/metro-runtime/package.json
FILE care-app/node_modules/metro-source-map/README.md
FILE care-app/node_modules/metro-source-map/package.json
FILE care-app/node_modules/metro-symbolicate/package.json
FILE care-app/node_modules/metro-transform-plugins/package.json
FILE care-app/node_modules/metro-transform-worker/package.json
FILE care-app/node_modules/metro/README.md
FILE care-app/node_modules/metro/package.json
FILE care-app/node_modules/micromatch/LICENSE
FILE care-app/node_modules/micromatch/README.md
FILE care-app/node_modules/micromatch/index.js
FILE care-app/node_modules/micromatch/package.json
FILE care-app/node_modules/mime-db/HISTORY.md
FILE care-app/node_modules/mime-db/LICENSE
FILE care-app/node_modules/mime-db/README.md
FILE care-app/node_modules/mime-db/db.json
FILE care-app/node_modules/mime-db/index.js
FILE care-app/node_modules/mime-db/package.json
FILE care-app/node_modules/mime-types/HISTORY.md
FILE care-app/node_modules/mime-types/LICENSE
FILE care-app/node_modules/mime-types/README.md
FILE care-app/node_modules/mime-types/index.js
FILE care-app/node_modules/mime-types/mimeScore.js
FILE care-app/node_modules/mime-types/package.json
FILE care-app/node_modules/mime/.npmignore
FILE care-app/node_modules/mime/CHANGELOG.md
FILE care-app/node_modules/mime/LICENSE
FILE care-app/node_modules/mime/README.md
FILE care-app/node_modules/mime/cli.js
FILE care-app/node_modules/mime/mime.js
FILE care-app/node_modules/mime/package.json
FILE care-app/node_modules/mime/types.json
FILE care-app/node_modules/mimic-fn/index.js
FILE care-app/node_modules/mimic-fn/license
FILE care-app/node_modules/mimic-fn/package.json
FILE care-app/node_modules/mimic-fn/readme.md
FILE care-app/node_modules/minimatch/LICENSE.md
FILE care-app/node_modules/minimatch/README.md
FILE care-app/node_modules/minimatch/package.json
FILE care-app/node_modules/minipass/LICENSE.md
FILE care-app/node_modules/minipass/README.md
FILE care-app/node_modules/minipass/package.json
FILE care-app/node_modules/mkdirp/CHANGELOG.md
FILE care-app/node_modules/mkdirp/LICENSE
FILE care-app/node_modules/mkdirp/index.js
FILE care-app/node_modules/mkdirp/package.json
FILE care-app/node_modules/mkdirp/readme.markdown
FILE care-app/node_modules/ms/index.js
FILE care-app/node_modules/ms/license.md
FILE care-app/node_modules/ms/package.json
FILE care-app/node_modules/ms/readme.md
FILE care-app/node_modules/multitars/CHANGELOG.md
FILE care-app/node_modules/multitars/LICENSE.md
FILE care-app/node_modules/multitars/README.md
FILE care-app/node_modules/multitars/package.json
FILE care-app/node_modules/nanoid/LICENSE
FILE care-app/node_modules/nanoid/README.md
FILE care-app/node_modules/nanoid/index.browser.cjs
FILE care-app/node_modules/nanoid/index.browser.js
FILE care-app/node_modules/nanoid/index.cjs
FILE care-app/node_modules/nanoid/index.d.cts
FILE care-app/node_modules/nanoid/index.d.ts
FILE care-app/node_modules/nanoid/index.js
FILE care-app/node_modules/nanoid/nanoid.js
FILE care-app/node_modules/nanoid/package.json
FILE care-app/node_modules/natural-compare/README.md
FILE care-app/node_modules/natural-compare/index.js
FILE care-app/node_modules/natural-compare/package.json
FILE care-app/node_modules/negotiator/HISTORY.md
FILE care-app/node_modules/negotiator/LICENSE
FILE care-app/node_modules/negotiator/README.md
FILE care-app/node_modules/negotiator/index.js
FILE care-app/node_modules/negotiator/package.json
FILE care-app/node_modules/node-forge/LICENSE
FILE care-app/node_modules/node-forge/README.md
FILE care-app/node_modules/node-forge/package.json
FILE care-app/node_modules/node-int64/.npmignore
FILE care-app/node_modules/node-int64/Int64.js
FILE care-app/node_modules/node-int64/LICENSE
FILE care-app/node_modules/node-int64/README.md
FILE care-app/node_modules/node-int64/package.json
FILE care-app/node_modules/node-int64/test.js
FILE care-app/node_modules/node-releases/LICENSE
FILE care-app/node_modules/node-releases/README.md
FILE care-app/node_modules/node-releases/package.json
FILE care-app/node_modules/normalize-path/LICENSE
FILE care-app/node_modules/normalize-path/README.md
FILE care-app/node_modules/normalize-path/index.js
FILE care-app/node_modules/normalize-path/package.json
FILE care-app/node_modules/npm-package-arg/LICENSE
FILE care-app/node_modules/npm-package-arg/README.md
FILE care-app/node_modules/npm-package-arg/package.json
FILE care-app/node_modules/npm-run-path/index.d.ts
FILE care-app/node_modules/npm-run-path/index.js
FILE care-app/node_modules/npm-run-path/license
FILE care-app/node_modules/npm-run-path/package.json
FILE care-app/node_modules/npm-run-path/readme.md
FILE care-app/node_modules/nullthrows/LICENSE
FILE care-app/node_modules/nullthrows/README.md
FILE care-app/node_modules/nullthrows/nullthrows.d.ts
FILE care-app/node_modules/nullthrows/nullthrows.js
FILE care-app/node_modules/nullthrows/nullthrows.js.flow
FILE care-app/node_modules/nullthrows/package.json
FILE care-app/node_modules/nwsapi/LICENSE
FILE care-app/node_modules/nwsapi/README.md
FILE care-app/node_modules/nwsapi/package.json
FILE care-app/node_modules/ob1/README.md
FILE care-app/node_modules/ob1/package.json
FILE care-app/node_modules/on-finished/HISTORY.md
FILE care-app/node_modules/on-finished/LICENSE
FILE care-app/node_modules/on-finished/README.md
FILE care-app/node_modules/on-finished/index.js
FILE care-app/node_modules/on-finished/package.json
FILE care-app/node_modules/on-headers/HISTORY.md
FILE care-app/node_modules/on-headers/LICENSE
FILE care-app/node_modules/on-headers/README.md
FILE care-app/node_modules/on-headers/index.js
FILE care-app/node_modules/on-headers/package.json
FILE care-app/node_modules/once/LICENSE
FILE care-app/node_modules/once/README.md
FILE care-app/node_modules/once/once.js
FILE care-app/node_modules/once/package.json
FILE care-app/node_modules/onetime/index.js
FILE care-app/node_modules/onetime/license
FILE care-app/node_modules/onetime/package.json
FILE care-app/node_modules/onetime/readme.md
FILE care-app/node_modules/open/index.d.ts
FILE care-app/node_modules/open/index.js
FILE care-app/node_modules/open/license
FILE care-app/node_modules/open/package.json
FILE care-app/node_modules/open/readme.md
FILE care-app/node_modules/open/xdg-open
FILE care-app/node_modules/ora/index.d.ts
FILE care-app/node_modules/ora/index.js
FILE care-app/node_modules/ora/license
FILE care-app/node_modules/ora/package.json
FILE care-app/node_modules/ora/readme.md
FILE care-app/node_modules/p-limit/index.d.ts
FILE care-app/node_modules/p-limit/index.js
FILE care-app/node_modules/p-limit/license
FILE care-app/node_modules/p-limit/package.json
FILE care-app/node_modules/p-limit/readme.md
FILE care-app/node_modules/p-locate/index.d.ts
FILE care-app/node_modules/p-locate/index.js
FILE care-app/node_modules/p-locate/license
FILE care-app/node_modules/p-locate/package.json
FILE care-app/node_modules/p-locate/readme.md
FILE care-app/node_modules/p-try/index.d.ts
FILE care-app/node_modules/p-try/index.js
FILE care-app/node_modules/p-try/license
FILE care-app/node_modules/p-try/package.json
FILE care-app/node_modules/p-try/readme.md
FILE care-app/node_modules/parse-json/index.js
FILE care-app/node_modules/parse-json/license
FILE care-app/node_modules/parse-json/package.json
FILE care-app/node_modules/parse-json/readme.md
FILE care-app/node_modules/parse-png/index.d.ts
FILE care-app/node_modules/parse-png/index.js
FILE care-app/node_modules/parse-png/license
FILE care-app/node_modules/parse-png/package.json
FILE care-app/node_modules/parse-png/readme.md
FILE care-app/node_modules/parse5/LICENSE
FILE care-app/node_modules/parse5/README.md
FILE care-app/node_modules/parse5/package.json
FILE care-app/node_modules/parseurl/HISTORY.md
FILE care-app/node_modules/parseurl/LICENSE
FILE care-app/node_modules/parseurl/README.md
FILE care-app/node_modules/parseurl/index.js
FILE care-app/node_modules/parseurl/package.json
FILE care-app/node_modules/path-exists/index.d.ts
FILE care-app/node_modules/path-exists/index.js
FILE care-app/node_modules/path-exists/license
FILE care-app/node_modules/path-exists/package.json
FILE care-app/node_modules/path-exists/readme.md
FILE care-app/node_modules/path-is-absolute/index.js
FILE care-app/node_modules/path-is-absolute/license
FILE care-app/node_modules/path-is-absolute/package.json
FILE care-app/node_modules/path-is-absolute/readme.md
FILE care-app/node_modules/path-key/index.d.ts
FILE care-app/node_modules/path-key/index.js
FILE care-app/node_modules/path-key/license
FILE care-app/node_modules/path-key/package.json
FILE care-app/node_modules/path-key/readme.md
FILE care-app/node_modules/path-parse/LICENSE
FILE care-app/node_modules/path-parse/README.md
FILE care-app/node_modules/path-parse/index.js
FILE care-app/node_modules/path-parse/package.json
FILE care-app/node_modules/path-scurry/LICENSE.md
FILE care-app/node_modules/path-scurry/README.md
FILE care-app/node_modules/path-scurry/package.json
FILE care-app/node_modules/picocolors/LICENSE
FILE care-app/node_modules/picocolors/README.md
FILE care-app/node_modules/picocolors/package.json
FILE care-app/node_modules/picocolors/picocolors.browser.js
FILE care-app/node_modules/picocolors/picocolors.d.ts
FILE care-app/node_modules/picocolors/picocolors.js
FILE care-app/node_modules/picocolors/types.d.ts
FILE care-app/node_modules/picomatch/LICENSE
FILE care-app/node_modules/picomatch/README.md
FILE care-app/node_modules/picomatch/index.js
FILE care-app/node_modules/picomatch/package.json
FILE care-app/node_modules/pirates/LICENSE
FILE care-app/node_modules/pirates/README.md
FILE care-app/node_modules/pirates/index.d.ts
FILE care-app/node_modules/pirates/package.json
FILE care-app/node_modules/pkg-dir/index.d.ts
FILE care-app/node_modules/pkg-dir/index.js
FILE care-app/node_modules/pkg-dir/license
FILE care-app/node_modules/pkg-dir/package.json
FILE care-app/node_modules/pkg-dir/readme.md
FILE care-app/node_modules/plist/.jshintrc
FILE care-app/node_modules/plist/History.md
FILE care-app/node_modules/plist/LICENSE
FILE care-app/node_modules/plist/Makefile
FILE care-app/node_modules/plist/README.md
FILE care-app/node_modules/plist/index.js
FILE care-app/node_modules/plist/package.json
FILE care-app/node_modules/pngjs/.eslintrc.json
FILE care-app/node_modules/pngjs/LICENSE
FILE care-app/node_modules/pngjs/README.md
FILE care-app/node_modules/pngjs/browser.js
FILE care-app/node_modules/pngjs/package.json
FILE care-app/node_modules/pngjs/yarn.lock
FILE care-app/node_modules/postcss/LICENSE
FILE care-app/node_modules/postcss/README.md
FILE care-app/node_modules/postcss/package.json
FILE care-app/node_modules/pretty-format/LICENSE
FILE care-app/node_modules/pretty-format/README.md
FILE care-app/node_modules/pretty-format/package.json
FILE care-app/node_modules/proc-log/LICENSE
FILE care-app/node_modules/proc-log/README.md
FILE care-app/node_modules/proc-log/package.json
FILE care-app/node_modules/progress/CHANGELOG.md
FILE care-app/node_modules/progress/LICENSE
FILE care-app/node_modules/progress/Makefile
FILE care-app/node_modules/progress/Readme.md
FILE care-app/node_modules/progress/index.js
FILE care-app/node_modules/progress/package.json
FILE care-app/node_modules/promise/.jshintrc
FILE care-app/node_modules/promise/LICENSE
FILE care-app/node_modules/promise/Readme.md
FILE care-app/node_modules/promise/build.js
FILE care-app/node_modules/promise/core.js
FILE care-app/node_modules/promise/index.d.ts
FILE care-app/node_modules/promise/index.js
FILE care-app/node_modules/promise/index.js.flow
FILE care-app/node_modules/promise/package.json
FILE care-app/node_modules/promise/polyfill-done.js
FILE care-app/node_modules/promise/polyfill.js
FILE care-app/node_modules/prompts/index.js
FILE care-app/node_modules/prompts/license
FILE care-app/node_modules/prompts/package.json
FILE care-app/node_modules/prompts/readme.md
FILE care-app/node_modules/psl/LICENSE
FILE care-app/node_modules/psl/README.md
FILE care-app/node_modules/psl/SECURITY.md
FILE care-app/node_modules/psl/browserstack-logo.svg
FILE care-app/node_modules/psl/index.js
FILE care-app/node_modules/psl/package.json
FILE care-app/node_modules/psl/vite.config.js
FILE care-app/node_modules/punycode/LICENSE-MIT.txt
FILE care-app/node_modules/punycode/README.md
FILE care-app/node_modules/punycode/package.json
FILE care-app/node_modules/punycode/punycode.es6.js
FILE care-app/node_modules/punycode/punycode.js
FILE care-app/node_modules/pure-rand/CHANGELOG.md
FILE care-app/node_modules/pure-rand/LICENSE
FILE care-app/node_modules/pure-rand/README.md
FILE care-app/node_modules/pure-rand/package.json
FILE care-app/node_modules/query-string/index.d.ts
FILE care-app/node_modules/query-string/index.js
FILE care-app/node_modules/query-string/license
FILE care-app/node_modules/query-string/package.json
FILE care-app/node_modules/query-string/readme.md
FILE care-app/node_modules/querystringify/LICENSE
FILE care-app/node_modules/querystringify/README.md
FILE care-app/node_modules/querystringify/index.js
FILE care-app/node_modules/querystringify/package.json
FILE care-app/node_modules/queue/LICENSE
FILE care-app/node_modules/queue/index.d.ts
FILE care-app/node_modules/queue/index.js
FILE care-app/node_modules/queue/package.json
FILE care-app/node_modules/queue/readme.md
FILE care-app/node_modules/range-parser/HISTORY.md
FILE care-app/node_modules/range-parser/LICENSE
FILE care-app/node_modules/range-parser/README.md
FILE care-app/node_modules/range-parser/index.js
FILE care-app/node_modules/range-parser/package.json
FILE care-app/node_modules/react-devtools-core/README.md
FILE care-app/node_modules/react-devtools-core/backend.js
FILE care-app/node_modules/react-devtools-core/package.json
FILE care-app/node_modules/react-devtools-core/standalone.js
FILE care-app/node_modules/react-freeze/LICENSE
FILE care-app/node_modules/react-freeze/README.md
FILE care-app/node_modules/react-freeze/package.json
FILE care-app/node_modules/react-is-18/LICENSE
FILE care-app/node_modules/react-is-18/README.md
FILE care-app/node_modules/react-is-18/index.js
FILE care-app/node_modules/react-is-18/package.json
FILE care-app/node_modules/react-is-19/LICENSE
FILE care-app/node_modules/react-is-19/README.md
FILE care-app/node_modules/react-is-19/index.js
FILE care-app/node_modules/react-is-19/package.json
FILE care-app/node_modules/react-is/LICENSE
FILE care-app/node_modules/react-is/README.md
FILE care-app/node_modules/react-is/index.js
FILE care-app/node_modules/react-is/package.json
FILE care-app/node_modules/react-native-safe-area-context/LICENSE
FILE care-app/node_modules/react-native-safe-area-context/README.md
FILE care-app/node_modules/react-native-safe-area-context/package.json
FILE care-app/node_modules/react-native-safe-area-context/react-native-safe-area-context.podspec
FILE care-app/node_modules/react-native-safe-area-context/react-native.config.js
FILE care-app/node_modules/react-native-screens/LICENSE
FILE care-app/node_modules/react-native-screens/README.md
FILE care-app/node_modules/react-native-screens/RNScreens.podspec
FILE care-app/node_modules/react-native-screens/package.json
FILE care-app/node_modules/react-native-screens/react-native.config.js
FILE care-app/node_modules/react-native-url-polyfill/.eslintignore
FILE care-app/node_modules/react-native-url-polyfill/.eslintrc.js
FILE care-app/node_modules/react-native-url-polyfill/.prettierrc
FILE care-app/node_modules/react-native-url-polyfill/LICENSE
FILE care-app/node_modules/react-native-url-polyfill/README.md
FILE care-app/node_modules/react-native-url-polyfill/auto.js
FILE care-app/node_modules/react-native-url-polyfill/babel.config.js
FILE care-app/node_modules/react-native-url-polyfill/index.d.ts
FILE care-app/node_modules/react-native-url-polyfill/index.js
FILE care-app/node_modules/react-native-url-polyfill/package.json
FILE care-app/node_modules/react-native/LICENSE
FILE care-app/node_modules/react-native/README.md
FILE care-app/node_modules/react-native/React-Core-prebuilt.podspec
FILE care-app/node_modules/react-native/React-Core.podspec
FILE care-app/node_modules/react-native/React.podspec
FILE care-app/node_modules/react-native/build.gradle.kts
FILE care-app/node_modules/react-native/cli.js
FILE care-app/node_modules/react-native/gradle.properties
FILE care-app/node_modules/react-native/index.js
FILE care-app/node_modules/react-native/index.js.flow
FILE care-app/node_modules/react-native/interface.js
FILE care-app/node_modules/react-native/jest-preset.js
FILE care-app/node_modules/react-native/package.json
FILE care-app/node_modules/react-native/react-native.config.js
FILE care-app/node_modules/react-native/rn-get-polyfills.js
FILE care-app/node_modules/react-native/settings.gradle.kts
FILE care-app/node_modules/react-refresh/LICENSE
FILE care-app/node_modules/react-refresh/README.md
FILE care-app/node_modules/react-refresh/babel.js
FILE care-app/node_modules/react-refresh/package.json
FILE care-app/node_modules/react-refresh/runtime.js
FILE care-app/node_modules/react-test-renderer/LICENSE
FILE care-app/node_modules/react-test-renderer/README.md
FILE care-app/node_modules/react-test-renderer/index.js
FILE care-app/node_modules/react-test-renderer/package.json
FILE care-app/node_modules/react-test-renderer/shallow.js
FILE care-app/node_modules/react/LICENSE
FILE care-app/node_modules/react/README.md
FILE care-app/node_modules/react/compiler-runtime.js
FILE care-app/node_modules/react/index.js
FILE care-app/node_modules/react/jsx-dev-runtime.js
FILE care-app/node_modules/react/jsx-dev-runtime.react-server.js
FILE care-app/node_modules/react/jsx-runtime.js
FILE care-app/node_modules/react/jsx-runtime.react-server.js
FILE care-app/node_modules/react/package.json
FILE care-app/node_modules/react/react.react-server.js
FILE care-app/node_modules/regenerate-unicode-properties/LICENSE-MIT.txt
FILE care-app/node_modules/regenerate-unicode-properties/README.md
FILE care-app/node_modules/regenerate-unicode-properties/index.js
FILE care-app/node_modules/regenerate-unicode-properties/package.json
FILE care-app/node_modules/regenerate-unicode-properties/unicode-version.js
FILE care-app/node_modules/regenerate/LICENSE-MIT.txt
FILE care-app/node_modules/regenerate/README.md
FILE care-app/node_modules/regenerate/package.json
FILE care-app/node_modules/regenerate/regenerate.js
FILE care-app/node_modules/regenerator-runtime/LICENSE
FILE care-app/node_modules/regenerator-runtime/README.md
FILE care-app/node_modules/regenerator-runtime/package.json
FILE care-app/node_modules/regenerator-runtime/path.js
FILE care-app/node_modules/regenerator-runtime/runtime.js
FILE care-app/node_modules/regexpu-core/LICENSE-MIT.txt
FILE care-app/node_modules/regexpu-core/README.md
FILE care-app/node_modules/regexpu-core/package.json
FILE care-app/node_modules/regexpu-core/rewrite-pattern.d.ts
FILE care-app/node_modules/regexpu-core/rewrite-pattern.js
FILE care-app/node_modules/regjsgen/LICENSE-MIT.txt
FILE care-app/node_modules/regjsgen/README.md
FILE care-app/node_modules/regjsgen/package.json
FILE care-app/node_modules/regjsgen/regjsgen.js
FILE care-app/node_modules/regjsparser/LICENSE.BSD
FILE care-app/node_modules/regjsparser/README.md
FILE care-app/node_modules/regjsparser/package.json
FILE care-app/node_modules/regjsparser/parser.d.ts
FILE care-app/node_modules/regjsparser/parser.js
FILE care-app/node_modules/require-directory/.jshintrc
FILE care-app/node_modules/require-directory/.npmignore
FILE care-app/node_modules/require-directory/.travis.yml
FILE care-app/node_modules/require-directory/LICENSE
FILE care-app/node_modules/require-directory/README.markdown
FILE care-app/node_modules/require-directory/index.js
FILE care-app/node_modules/require-directory/package.json
FILE care-app/node_modules/requires-port/.npmignore
FILE care-app/node_modules/requires-port/.travis.yml
FILE care-app/node_modules/requires-port/LICENSE
FILE care-app/node_modules/requires-port/README.md
FILE care-app/node_modules/requires-port/index.js
FILE care-app/node_modules/requires-port/package.json
FILE care-app/node_modules/requires-port/test.js
FILE care-app/node_modules/resolve-cwd/index.d.ts
FILE care-app/node_modules/resolve-cwd/index.js
FILE care-app/node_modules/resolve-cwd/license
FILE care-app/node_modules/resolve-cwd/package.json
FILE care-app/node_modules/resolve-cwd/readme.md
FILE care-app/node_modules/resolve-from/index.d.ts
FILE care-app/node_modules/resolve-from/index.js
FILE care-app/node_modules/resolve-from/license
FILE care-app/node_modules/resolve-from/package.json
FILE care-app/node_modules/resolve-from/readme.md
FILE care-app/node_modules/resolve-workspace-root/LICENSE.md
FILE care-app/node_modules/resolve-workspace-root/README.md
FILE care-app/node_modules/resolve-workspace-root/package.json
FILE care-app/node_modules/resolve.exports/index.d.ts
FILE care-app/node_modules/resolve.exports/license
FILE care-app/node_modules/resolve.exports/package.json
FILE care-app/node_modules/resolve.exports/readme.md
FILE care-app/node_modules/resolve/.editorconfig
FILE care-app/node_modules/resolve/.eslintrc
FILE care-app/node_modules/resolve/LICENSE
FILE care-app/node_modules/resolve/SECURITY.md
FILE care-app/node_modules/resolve/async.js
FILE care-app/node_modules/resolve/eslint.config.mjs
FILE care-app/node_modules/resolve/index.js
FILE care-app/node_modules/resolve/package.json
FILE care-app/node_modules/resolve/readme.markdown
FILE care-app/node_modules/resolve/sync.js
FILE care-app/node_modules/restore-cursor/index.js
FILE care-app/node_modules/restore-cursor/license
FILE care-app/node_modules/restore-cursor/package.json
FILE care-app/node_modules/restore-cursor/readme.md
FILE care-app/node_modules/safe-buffer/LICENSE
FILE care-app/node_modules/safe-buffer/README.md
FILE care-app/node_modules/safe-buffer/index.d.ts
FILE care-app/node_modules/safe-buffer/index.js
FILE care-app/node_modules/safe-buffer/package.json
FILE care-app/node_modules/safer-buffer/LICENSE
FILE care-app/node_modules/safer-buffer/Porting-Buffer.md
FILE care-app/node_modules/safer-buffer/Readme.md
FILE care-app/node_modules/safer-buffer/dangerous.js
FILE care-app/node_modules/safer-buffer/package.json
FILE care-app/node_modules/safer-buffer/safer.js
FILE care-app/node_modules/safer-buffer/tests.js
FILE care-app/node_modules/sax/LICENSE.md
FILE care-app/node_modules/sax/README.md
FILE care-app/node_modules/sax/package.json
FILE care-app/node_modules/saxes/README.md
FILE care-app/node_modules/saxes/package.json
FILE care-app/node_modules/saxes/saxes.d.ts
FILE care-app/node_modules/saxes/saxes.js
FILE care-app/node_modules/saxes/saxes.js.map
FILE care-app/node_modules/scheduler/LICENSE
FILE care-app/node_modules/scheduler/README.md
FILE care-app/node_modules/scheduler/index.js
FILE care-app/node_modules/scheduler/index.native.js
FILE care-app/node_modules/scheduler/package.json
FILE care-app/node_modules/scheduler/unstable_mock.js
FILE care-app/node_modules/scheduler/unstable_post_task.js
FILE care-app/node_modules/semver/LICENSE
FILE care-app/node_modules/semver/README.md
FILE care-app/node_modules/semver/index.js
FILE care-app/node_modules/semver/package.json
FILE care-app/node_modules/semver/preload.js
FILE care-app/node_modules/semver/range.bnf
FILE care-app/node_modules/send/HISTORY.md
FILE care-app/node_modules/send/LICENSE
FILE care-app/node_modules/send/README.md
FILE care-app/node_modules/send/SECURITY.md
FILE care-app/node_modules/send/index.js
FILE care-app/node_modules/send/package.json
FILE care-app/node_modules/serialize-error/index.js
FILE care-app/node_modules/serialize-error/license
FILE care-app/node_modules/serialize-error/package.json
FILE care-app/node_modules/serialize-error/readme.md
FILE care-app/node_modules/serve-static/HISTORY.md
FILE care-app/node_modules/serve-static/LICENSE
FILE care-app/node_modules/serve-static/README.md
FILE care-app/node_modules/serve-static/index.js
FILE care-app/node_modules/serve-static/package.json
FILE care-app/node_modules/server-only/empty.js
FILE care-app/node_modules/server-only/index.js
FILE care-app/node_modules/server-only/package.json
FILE care-app/node_modules/setprototypeof/LICENSE
FILE care-app/node_modules/setprototypeof/README.md
FILE care-app/node_modules/setprototypeof/index.d.ts
FILE care-app/node_modules/setprototypeof/index.js
FILE care-app/node_modules/setprototypeof/package.json
FILE care-app/node_modules/sf-symbols-typescript/LICENSE
FILE care-app/node_modules/sf-symbols-typescript/README.md
FILE care-app/node_modules/sf-symbols-typescript/package.json
FILE care-app/node_modules/shebang-command/index.js
FILE care-app/node_modules/shebang-command/license
FILE care-app/node_modules/shebang-command/package.json
FILE care-app/node_modules/shebang-command/readme.md
FILE care-app/node_modules/shebang-regex/index.d.ts
FILE care-app/node_modules/shebang-regex/index.js
FILE care-app/node_modules/shebang-regex/license
FILE care-app/node_modules/shebang-regex/package.json
FILE care-app/node_modules/shebang-regex/readme.md
FILE care-app/node_modules/shell-quote/.eslintrc
FILE care-app/node_modules/shell-quote/.nycrc
FILE care-app/node_modules/shell-quote/LICENSE
FILE care-app/node_modules/shell-quote/README.md
FILE care-app/node_modules/shell-quote/index.js
FILE care-app/node_modules/shell-quote/package.json
FILE care-app/node_modules/shell-quote/parse.js
FILE care-app/node_modules/shell-quote/quote.js
FILE care-app/node_modules/shell-quote/security.md
FILE care-app/node_modules/signal-exit/LICENSE.txt
FILE care-app/node_modules/signal-exit/README.md
FILE care-app/node_modules/signal-exit/index.js
FILE care-app/node_modules/signal-exit/package.json
FILE care-app/node_modules/signal-exit/signals.js
FILE care-app/node_modules/simple-plist/LICENSE
FILE care-app/node_modules/simple-plist/README.md
FILE care-app/node_modules/simple-plist/package.json
FILE care-app/node_modules/simple-swizzle/LICENSE
FILE care-app/node_modules/simple-swizzle/README.md
FILE care-app/node_modules/simple-swizzle/index.js
FILE care-app/node_modules/simple-swizzle/package.json
FILE care-app/node_modules/sisteransi/license
FILE care-app/node_modules/sisteransi/package.json
FILE care-app/node_modules/sisteransi/readme.md
FILE care-app/node_modules/slash/index.d.ts
FILE care-app/node_modules/slash/index.js
FILE care-app/node_modules/slash/license
FILE care-app/node_modules/slash/package.json
FILE care-app/node_modules/slash/readme.md
FILE care-app/node_modules/slugify/LICENSE
FILE care-app/node_modules/slugify/README.md
FILE care-app/node_modules/slugify/package.json
FILE care-app/node_modules/slugify/slugify.d.ts
FILE care-app/node_modules/slugify/slugify.js
FILE care-app/node_modules/source-map-js/LICENSE
FILE care-app/node_modules/source-map-js/README.md
FILE care-app/node_modules/source-map-js/package.json
FILE care-app/node_modules/source-map-js/source-map.d.ts
FILE care-app/node_modules/source-map-js/source-map.js
FILE care-app/node_modules/source-map-support/LICENSE.md
FILE care-app/node_modules/source-map-support/README.md
FILE care-app/node_modules/source-map-support/browser-source-map-support.js
FILE care-app/node_modules/source-map-support/package.json
FILE care-app/node_modules/source-map-support/register-hook-require.js
FILE care-app/node_modules/source-map-support/register.js
FILE care-app/node_modules/source-map-support/source-map-support.js
FILE care-app/node_modules/source-map/CHANGELOG.md
FILE care-app/node_modules/source-map/LICENSE
FILE care-app/node_modules/source-map/README.md
FILE care-app/node_modules/source-map/package.json
FILE care-app/node_modules/source-map/source-map.js
FILE care-app/node_modules/split-on-first/index.d.ts
FILE care-app/node_modules/split-on-first/index.js
FILE care-app/node_modules/split-on-first/license
FILE care-app/node_modules/split-on-first/package.json
FILE care-app/node_modules/split-on-first/readme.md
FILE care-app/node_modules/sprintf-js/.npmignore
FILE care-app/node_modules/sprintf-js/LICENSE
FILE care-app/node_modules/sprintf-js/README.md
FILE care-app/node_modules/sprintf-js/bower.json
FILE care-app/node_modules/sprintf-js/gruntfile.js
FILE care-app/node_modules/sprintf-js/package.json
FILE care-app/node_modules/stack-generator/LICENSE
FILE care-app/node_modules/stack-generator/README.md
FILE care-app/node_modules/stack-generator/package.json
FILE care-app/node_modules/stack-generator/stack-generator.d.ts
FILE care-app/node_modules/stack-generator/stack-generator.js
FILE care-app/node_modules/stack-utils/LICENSE.md
FILE care-app/node_modules/stack-utils/index.js
FILE care-app/node_modules/stack-utils/package.json
FILE care-app/node_modules/stack-utils/readme.md
FILE care-app/node_modules/stackframe/LICENSE
FILE care-app/node_modules/stackframe/README.md
FILE care-app/node_modules/stackframe/package.json
FILE care-app/node_modules/stackframe/stackframe.d.ts
FILE care-app/node_modules/stackframe/stackframe.js
FILE care-app/node_modules/stacktrace-gps/LICENSE
FILE care-app/node_modules/stacktrace-gps/README.md
FILE care-app/node_modules/stacktrace-gps/package.json
FILE care-app/node_modules/stacktrace-gps/stacktrace-gps.d.ts
FILE care-app/node_modules/stacktrace-gps/stacktrace-gps.js
FILE care-app/node_modules/stacktrace-js/CHANGELOG.md
FILE care-app/node_modules/stacktrace-js/LICENSE
FILE care-app/node_modules/stacktrace-js/README.md
FILE care-app/node_modules/stacktrace-js/package.json
FILE care-app/node_modules/stacktrace-js/stacktrace-js.d.ts
FILE care-app/node_modules/stacktrace-js/stacktrace.js
FILE care-app/node_modules/stacktrace-parser/LICENSE
FILE care-app/node_modules/stacktrace-parser/README.md
FILE care-app/node_modules/stacktrace-parser/package.json
FILE care-app/node_modules/standard-navigation/README.md
FILE care-app/node_modules/standard-navigation/package.json
FILE care-app/node_modules/statuses/HISTORY.md
FILE care-app/node_modules/statuses/LICENSE
FILE care-app/node_modules/statuses/README.md
FILE care-app/node_modules/statuses/codes.json
FILE care-app/node_modules/statuses/index.js
FILE care-app/node_modules/statuses/package.json
FILE care-app/node_modules/stream-buffers/.mailmap
FILE care-app/node_modules/stream-buffers/.travis.yml
FILE care-app/node_modules/stream-buffers/README.md
FILE care-app/node_modules/stream-buffers/UNLICENSE
FILE care-app/node_modules/stream-buffers/package.json
FILE care-app/node_modules/strict-uri-encode/index.js
FILE care-app/node_modules/strict-uri-encode/license
FILE care-app/node_modules/strict-uri-encode/package.json
FILE care-app/node_modules/strict-uri-encode/readme.md
FILE care-app/node_modules/string-length/index.d.ts
FILE care-app/node_modules/string-length/index.js
FILE care-app/node_modules/string-length/license
FILE care-app/node_modules/string-length/package.json
FILE care-app/node_modules/string-length/readme.md
FILE care-app/node_modules/string-width/index.d.ts
FILE care-app/node_modules/string-width/index.js
FILE care-app/node_modules/string-width/license
FILE care-app/node_modules/string-width/package.json
FILE care-app/node_modules/string-width/readme.md
FILE care-app/node_modules/strip-ansi/index.d.ts
FILE care-app/node_modules/strip-ansi/index.js
FILE care-app/node_modules/strip-ansi/license
FILE care-app/node_modules/strip-ansi/package.json
FILE care-app/node_modules/strip-ansi/readme.md
FILE care-app/node_modules/strip-bom/index.d.ts
FILE care-app/node_modules/strip-bom/index.js
FILE care-app/node_modules/strip-bom/license
FILE care-app/node_modules/strip-bom/package.json
FILE care-app/node_modules/strip-bom/readme.md
FILE care-app/node_modules/strip-final-newline/index.js
FILE care-app/node_modules/strip-final-newline/license
FILE care-app/node_modules/strip-final-newline/package.json
FILE care-app/node_modules/strip-final-newline/readme.md
FILE care-app/node_modules/strip-json-comments/index.d.ts
FILE care-app/node_modules/strip-json-comments/index.js
FILE care-app/node_modules/strip-json-comments/license
FILE care-app/node_modules/strip-json-comments/package.json
FILE care-app/node_modules/strip-json-comments/readme.md
FILE care-app/node_modules/structured-headers/package.json
FILE care-app/node_modules/structured-headers/readme.md
FILE care-app/node_modules/supports-color/browser.js
FILE care-app/node_modules/supports-color/index.js
FILE care-app/node_modules/supports-color/license
FILE care-app/node_modules/supports-color/package.json
FILE care-app/node_modules/supports-color/readme.md
FILE care-app/node_modules/supports-hyperlinks/browser.js
FILE care-app/node_modules/supports-hyperlinks/index.js
FILE care-app/node_modules/supports-hyperlinks/license
FILE care-app/node_modules/supports-hyperlinks/package.json
FILE care-app/node_modules/supports-hyperlinks/readme.md
FILE care-app/node_modules/supports-preserve-symlinks-flag/.eslintrc
FILE care-app/node_modules/supports-preserve-symlinks-flag/.nycrc
FILE care-app/node_modules/supports-preserve-symlinks-flag/CHANGELOG.md
FILE care-app/node_modules/supports-preserve-symlinks-flag/LICENSE
FILE care-app/node_modules/supports-preserve-symlinks-flag/README.md
FILE care-app/node_modules/supports-preserve-symlinks-flag/browser.js
FILE care-app/node_modules/supports-preserve-symlinks-flag/index.js
FILE care-app/node_modules/supports-preserve-symlinks-flag/package.json
FILE care-app/node_modules/symbol-tree/LICENSE
FILE care-app/node_modules/symbol-tree/README.md
FILE care-app/node_modules/symbol-tree/package.json
FILE care-app/node_modules/terminal-link/index.d.ts
FILE care-app/node_modules/terminal-link/index.js
FILE care-app/node_modules/terminal-link/license
FILE care-app/node_modules/terminal-link/package.json
FILE care-app/node_modules/terminal-link/readme.md
FILE care-app/node_modules/terser/CHANGELOG.md
FILE care-app/node_modules/terser/LICENSE
FILE care-app/node_modules/terser/PATRONS.md
FILE care-app/node_modules/terser/README.md
FILE care-app/node_modules/terser/main.js
FILE care-app/node_modules/terser/package.json
FILE care-app/node_modules/test-exclude/CHANGELOG.md
FILE care-app/node_modules/test-exclude/LICENSE.txt
FILE care-app/node_modules/test-exclude/README.md
FILE care-app/node_modules/test-exclude/index.js
FILE care-app/node_modules/test-exclude/is-outside-dir-posix.js
FILE care-app/node_modules/test-exclude/is-outside-dir-win32.js
FILE care-app/node_modules/test-exclude/is-outside-dir.js
FILE care-app/node_modules/test-exclude/package.json
FILE care-app/node_modules/throat/LICENSE
FILE care-app/node_modules/throat/README.md
FILE care-app/node_modules/throat/index.d.ts
FILE care-app/node_modules/throat/index.js
FILE care-app/node_modules/throat/index.js.flow
FILE care-app/node_modules/throat/package.json
FILE care-app/node_modules/tinyglobby/LICENSE
FILE care-app/node_modules/tinyglobby/README.md
FILE care-app/node_modules/tinyglobby/package.json
FILE care-app/node_modules/tmpl/license
FILE care-app/node_modules/tmpl/package.json
FILE care-app/node_modules/tmpl/readme.md
FILE care-app/node_modules/to-regex-range/LICENSE
FILE care-app/node_modules/to-regex-range/README.md
FILE care-app/node_modules/to-regex-range/index.js
FILE care-app/node_modules/to-regex-range/package.json
FILE care-app/node_modules/toidentifier/HISTORY.md
FILE care-app/node_modules/toidentifier/LICENSE
FILE care-app/node_modules/toidentifier/README.md
FILE care-app/node_modules/toidentifier/index.js
FILE care-app/node_modules/toidentifier/package.json
FILE care-app/node_modules/toqr/CHANGELOG.md
FILE care-app/node_modules/toqr/LICENSE.md
FILE care-app/node_modules/toqr/README.md
FILE care-app/node_modules/toqr/package.json
FILE care-app/node_modules/tough-cookie/LICENSE
FILE care-app/node_modules/tough-cookie/README.md
FILE care-app/node_modules/tough-cookie/package.json
FILE care-app/node_modules/tr46/LICENSE.md
FILE care-app/node_modules/tr46/README.md
FILE care-app/node_modules/tr46/index.js
FILE care-app/node_modules/tr46/package.json
FILE care-app/node_modules/tslib/CopyrightNotice.txt
FILE care-app/node_modules/tslib/LICENSE.txt
FILE care-app/node_modules/tslib/README.md
FILE care-app/node_modules/tslib/SECURITY.md
FILE care-app/node_modules/tslib/package.json
FILE care-app/node_modules/tslib/tslib.d.ts
FILE care-app/node_modules/tslib/tslib.es6.html
FILE care-app/node_modules/tslib/tslib.es6.js
FILE care-app/node_modules/tslib/tslib.es6.mjs
FILE care-app/node_modules/tslib/tslib.html
FILE care-app/node_modules/tslib/tslib.js
FILE care-app/node_modules/type-detect/LICENSE
FILE care-app/node_modules/type-detect/README.md
FILE care-app/node_modules/type-detect/index.js
FILE care-app/node_modules/type-detect/package.json
FILE care-app/node_modules/type-detect/type-detect.js
FILE care-app/node_modules/type-fest/index.d.ts
FILE care-app/node_modules/type-fest/license
FILE care-app/node_modules/type-fest/package.json
FILE care-app/node_modules/type-fest/readme.md
FILE care-app/node_modules/typescript/LICENSE.txt
FILE care-app/node_modules/typescript/README.md
FILE care-app/node_modules/typescript/SECURITY.md
FILE care-app/node_modules/typescript/ThirdPartyNoticeText.txt
FILE care-app/node_modules/typescript/package.json
FILE care-app/node_modules/undici-types/LICENSE
FILE care-app/node_modules/undici-types/README.md
FILE care-app/node_modules/undici-types/agent.d.ts
FILE care-app/node_modules/undici-types/api.d.ts
FILE care-app/node_modules/undici-types/balanced-pool.d.ts
FILE care-app/node_modules/undici-types/cache-interceptor.d.ts
FILE care-app/node_modules/undici-types/cache.d.ts
FILE care-app/node_modules/undici-types/client-stats.d.ts
FILE care-app/node_modules/undici-types/client.d.ts
FILE care-app/node_modules/undici-types/connector.d.ts
FILE care-app/node_modules/undici-types/content-type.d.ts
FILE care-app/node_modules/undici-types/cookies.d.ts
FILE care-app/node_modules/undici-types/diagnostics-channel.d.ts
FILE care-app/node_modules/undici-types/dispatcher.d.ts
FILE care-app/node_modules/undici-types/env-http-proxy-agent.d.ts
FILE care-app/node_modules/undici-types/errors.d.ts
FILE care-app/node_modules/undici-types/eventsource.d.ts
FILE care-app/node_modules/undici-types/fetch.d.ts
FILE care-app/node_modules/undici-types/formdata.d.ts
FILE care-app/node_modules/undici-types/global-dispatcher.d.ts
FILE care-app/node_modules/undici-types/global-origin.d.ts
FILE care-app/node_modules/undici-types/h2c-client.d.ts
FILE care-app/node_modules/undici-types/handlers.d.ts
FILE care-app/node_modules/undici-types/header.d.ts
FILE care-app/node_modules/undici-types/index.d.ts
FILE care-app/node_modules/undici-types/interceptors.d.ts
FILE care-app/node_modules/undici-types/mock-agent.d.ts
FILE care-app/node_modules/undici-types/mock-call-history.d.ts
FILE care-app/node_modules/undici-types/mock-client.d.ts
FILE care-app/node_modules/undici-types/mock-errors.d.ts
FILE care-app/node_modules/undici-types/mock-interceptor.d.ts
FILE care-app/node_modules/undici-types/mock-pool.d.ts
FILE care-app/node_modules/undici-types/package.json
FILE care-app/node_modules/undici-types/patch.d.ts
FILE care-app/node_modules/undici-types/pool-stats.d.ts
FILE care-app/node_modules/undici-types/pool.d.ts
FILE care-app/node_modules/undici-types/proxy-agent.d.ts
FILE care-app/node_modules/undici-types/readable.d.ts
FILE care-app/node_modules/undici-types/retry-agent.d.ts
FILE care-app/node_modules/undici-types/retry-handler.d.ts
FILE care-app/node_modules/undici-types/round-robin-pool.d.ts
FILE care-app/node_modules/undici-types/snapshot-agent.d.ts
FILE care-app/node_modules/undici-types/socks5-proxy-agent.d.ts
FILE care-app/node_modules/undici-types/util.d.ts
FILE care-app/node_modules/undici-types/utility.d.ts
FILE care-app/node_modules/undici-types/webidl.d.ts
FILE care-app/node_modules/undici-types/websocket.d.ts
FILE care-app/node_modules/unicode-canonical-property-names-ecmascript/LICENSE-MIT.txt
FILE care-app/node_modules/unicode-canonical-property-names-ecmascript/README.md
FILE care-app/node_modules/unicode-canonical-property-names-ecmascript/index.js
FILE care-app/node_modules/unicode-canonical-property-names-ecmascript/package.json
FILE care-app/node_modules/unicode-match-property-ecmascript/LICENSE-MIT.txt
FILE care-app/node_modules/unicode-match-property-ecmascript/README.md
FILE care-app/node_modules/unicode-match-property-ecmascript/index.js
FILE care-app/node_modules/unicode-match-property-ecmascript/package.json
FILE care-app/node_modules/unicode-match-property-value-ecmascript/LICENSE-MIT.txt
FILE care-app/node_modules/unicode-match-property-value-ecmascript/README.md
FILE care-app/node_modules/unicode-match-property-value-ecmascript/index.js
FILE care-app/node_modules/unicode-match-property-value-ecmascript/package.json
FILE care-app/node_modules/unicode-property-aliases-ecmascript/LICENSE-MIT.txt
FILE care-app/node_modules/unicode-property-aliases-ecmascript/README.md
FILE care-app/node_modules/unicode-property-aliases-ecmascript/index.js
FILE care-app/node_modules/unicode-property-aliases-ecmascript/package.json
FILE care-app/node_modules/universalify/LICENSE
FILE care-app/node_modules/universalify/README.md
FILE care-app/node_modules/universalify/index.js
FILE care-app/node_modules/universalify/package.json
FILE care-app/node_modules/unpipe/HISTORY.md
FILE care-app/node_modules/unpipe/LICENSE
FILE care-app/node_modules/unpipe/README.md
FILE care-app/node_modules/unpipe/index.js
FILE care-app/node_modules/unpipe/package.json
FILE care-app/node_modules/update-browserslist-db/LICENSE
FILE care-app/node_modules/update-browserslist-db/README.md
FILE care-app/node_modules/update-browserslist-db/check-npm-version.js
FILE care-app/node_modules/update-browserslist-db/cli.js
FILE care-app/node_modules/update-browserslist-db/index.d.ts
FILE care-app/node_modules/update-browserslist-db/index.js
FILE care-app/node_modules/update-browserslist-db/package.json
FILE care-app/node_modules/update-browserslist-db/utils.js
FILE care-app/node_modules/url-parse/LICENSE
FILE care-app/node_modules/url-parse/README.md
FILE care-app/node_modules/url-parse/index.js
FILE care-app/node_modules/url-parse/package.json
FILE care-app/node_modules/use-latest-callback/LICENSE
FILE care-app/node_modules/use-latest-callback/README.md
FILE care-app/node_modules/use-latest-callback/esm.mjs
FILE care-app/node_modules/use-latest-callback/package.json
FILE care-app/node_modules/use-sync-external-store/LICENSE
FILE care-app/node_modules/use-sync-external-store/README.md
FILE care-app/node_modules/use-sync-external-store/index.js
FILE care-app/node_modules/use-sync-external-store/package.json
FILE care-app/node_modules/use-sync-external-store/with-selector.js
FILE care-app/node_modules/utils-merge/.npmignore
FILE care-app/node_modules/utils-merge/LICENSE
FILE care-app/node_modules/utils-merge/README.md
FILE care-app/node_modules/utils-merge/index.js
FILE care-app/node_modules/utils-merge/package.json
FILE care-app/node_modules/uuid/CHANGELOG.md
FILE care-app/node_modules/uuid/CONTRIBUTING.md
FILE care-app/node_modules/uuid/LICENSE.md
FILE care-app/node_modules/uuid/README.md
FILE care-app/node_modules/uuid/deprecate.js
FILE care-app/node_modules/uuid/package.json
FILE care-app/node_modules/uuid/v1.js
FILE care-app/node_modules/uuid/v3.js
FILE care-app/node_modules/uuid/v4.js
FILE care-app/node_modules/uuid/v5.js
FILE care-app/node_modules/v8-to-istanbul/CHANGELOG.md
FILE care-app/node_modules/v8-to-istanbul/LICENSE.txt
FILE care-app/node_modules/v8-to-istanbul/README.md
FILE care-app/node_modules/v8-to-istanbul/index.d.ts
FILE care-app/node_modules/v8-to-istanbul/index.js
FILE care-app/node_modules/v8-to-istanbul/package.json
FILE care-app/node_modules/validate-npm-package-name/LICENSE
FILE care-app/node_modules/validate-npm-package-name/README.md
FILE care-app/node_modules/validate-npm-package-name/package.json
FILE care-app/node_modules/vary/HISTORY.md
FILE care-app/node_modules/vary/LICENSE
FILE care-app/node_modules/vary/README.md
FILE care-app/node_modules/vary/index.js
FILE care-app/node_modules/vary/package.json
FILE care-app/node_modules/vlq/CHANGELOG.md
FILE care-app/node_modules/vlq/LICENSE
FILE care-app/node_modules/vlq/README.md
FILE care-app/node_modules/vlq/package.json
FILE care-app/node_modules/w3c-xmlserializer/LICENSE.md
FILE care-app/node_modules/w3c-xmlserializer/README.md
FILE care-app/node_modules/w3c-xmlserializer/package.json
FILE care-app/node_modules/walker/.travis.yml
FILE care-app/node_modules/walker/LICENSE
FILE care-app/node_modules/walker/package.json
FILE care-app/node_modules/walker/readme.md
FILE care-app/node_modules/warn-once/LICENSE
FILE care-app/node_modules/warn-once/README.md
FILE care-app/node_modules/warn-once/index.d.ts
FILE care-app/node_modules/warn-once/index.js
FILE care-app/node_modules/warn-once/package.json
FILE care-app/node_modules/wcwidth/.npmignore
FILE care-app/node_modules/wcwidth/LICENSE
FILE care-app/node_modules/wcwidth/Readme.md
FILE care-app/node_modules/wcwidth/combining.js
FILE care-app/node_modules/wcwidth/index.js
FILE care-app/node_modules/wcwidth/package.json
FILE care-app/node_modules/webidl-conversions/LICENSE.md
FILE care-app/node_modules/webidl-conversions/README.md
FILE care-app/node_modules/webidl-conversions/package.json
FILE care-app/node_modules/whatwg-encoding/LICENSE.txt
FILE care-app/node_modules/whatwg-encoding/README.md
FILE care-app/node_modules/whatwg-encoding/package.json
FILE care-app/node_modules/whatwg-fetch/LICENSE
FILE care-app/node_modules/whatwg-fetch/README.md
FILE care-app/node_modules/whatwg-fetch/fetch.js
FILE care-app/node_modules/whatwg-fetch/fetch.js.flow
FILE care-app/node_modules/whatwg-fetch/package.json
FILE care-app/node_modules/whatwg-mimetype/LICENSE.txt
FILE care-app/node_modules/whatwg-mimetype/README.md
FILE care-app/node_modules/whatwg-mimetype/package.json
FILE care-app/node_modules/whatwg-url-minimum/CHANGELOG.md
FILE care-app/node_modules/whatwg-url-minimum/LICENSE.md
FILE care-app/node_modules/whatwg-url-minimum/README.md
FILE care-app/node_modules/whatwg-url-minimum/package.json
FILE care-app/node_modules/whatwg-url-without-unicode/LICENSE.txt
FILE care-app/node_modules/whatwg-url-without-unicode/README.md
FILE care-app/node_modules/whatwg-url-without-unicode/index.js
FILE care-app/node_modules/whatwg-url-without-unicode/package.json
FILE care-app/node_modules/whatwg-url-without-unicode/webidl2js-wrapper.js
FILE care-app/node_modules/whatwg-url/LICENSE.txt
FILE care-app/node_modules/whatwg-url/README.md
FILE care-app/node_modules/whatwg-url/index.js
FILE care-app/node_modules/whatwg-url/package.json
FILE care-app/node_modules/whatwg-url/webidl2js-wrapper.js
FILE care-app/node_modules/which/CHANGELOG.md
FILE care-app/node_modules/which/LICENSE
FILE care-app/node_modules/which/README.md
FILE care-app/node_modules/which/package.json
FILE care-app/node_modules/which/which.js
FILE care-app/node_modules/wrap-ansi/index.js
FILE care-app/node_modules/wrap-ansi/license
FILE care-app/node_modules/wrap-ansi/package.json
FILE care-app/node_modules/wrap-ansi/readme.md
FILE care-app/node_modules/wrappy/LICENSE
FILE care-app/node_modules/wrappy/README.md
FILE care-app/node_modules/wrappy/package.json
FILE care-app/node_modules/wrappy/wrappy.js
FILE care-app/node_modules/write-file-atomic/LICENSE.md
FILE care-app/node_modules/write-file-atomic/README.md
FILE care-app/node_modules/write-file-atomic/package.json
FILE care-app/node_modules/ws/LICENSE
FILE care-app/node_modules/ws/README.md
FILE care-app/node_modules/ws/browser.js
FILE care-app/node_modules/ws/index.js
FILE care-app/node_modules/ws/package.json
FILE care-app/node_modules/xcode/AUTHORS
FILE care-app/node_modules/xcode/CONTRIBUTING.md
FILE care-app/node_modules/xcode/LICENSE
FILE care-app/node_modules/xcode/Makefile
FILE care-app/node_modules/xcode/NOTICE
FILE care-app/node_modules/xcode/README.md
FILE care-app/node_modules/xcode/RELEASENOTES.md
FILE care-app/node_modules/xcode/index.js
FILE care-app/node_modules/xcode/package.json
FILE care-app/node_modules/xml-name-validator/LICENSE.txt
FILE care-app/node_modules/xml-name-validator/README.md
FILE care-app/node_modules/xml-name-validator/package.json
FILE care-app/node_modules/xml2js/LICENSE
FILE care-app/node_modules/xml2js/README.md
FILE care-app/node_modules/xml2js/package.json
FILE care-app/node_modules/xmlbuilder/.nycrc
FILE care-app/node_modules/xmlbuilder/CHANGELOG.md
FILE care-app/node_modules/xmlbuilder/LICENSE
FILE care-app/node_modules/xmlbuilder/README.md
FILE care-app/node_modules/xmlbuilder/package.json
FILE care-app/node_modules/xmlchars/LICENSE
FILE care-app/node_modules/xmlchars/README.md
FILE care-app/node_modules/xmlchars/package.json
FILE care-app/node_modules/xmlchars/xmlchars.d.ts
FILE care-app/node_modules/xmlchars/xmlchars.js
FILE care-app/node_modules/xmlchars/xmlchars.js.map
FILE care-app/node_modules/y18n/CHANGELOG.md
FILE care-app/node_modules/y18n/LICENSE
FILE care-app/node_modules/y18n/README.md
FILE care-app/node_modules/y18n/index.mjs
FILE care-app/node_modules/y18n/package.json
FILE care-app/node_modules/yallist/LICENSE
FILE care-app/node_modules/yallist/README.md
FILE care-app/node_modules/yallist/iterator.js
FILE care-app/node_modules/yallist/package.json
FILE care-app/node_modules/yallist/yallist.js
FILE care-app/node_modules/yaml/LICENSE
FILE care-app/node_modules/yaml/README.md
FILE care-app/node_modules/yaml/bin.mjs
FILE care-app/node_modules/yaml/package.json
FILE care-app/node_modules/yaml/util.js
FILE care-app/node_modules/yargs-parser/CHANGELOG.md
FILE care-app/node_modules/yargs-parser/LICENSE.txt
FILE care-app/node_modules/yargs-parser/README.md
FILE care-app/node_modules/yargs-parser/browser.js
FILE care-app/node_modules/yargs-parser/package.json
FILE care-app/node_modules/yargs/LICENSE
FILE care-app/node_modules/yargs/README.md
FILE care-app/node_modules/yargs/browser.d.ts
FILE care-app/node_modules/yargs/browser.mjs
FILE care-app/node_modules/yargs/index.cjs
FILE care-app/node_modules/yargs/index.mjs
FILE care-app/node_modules/yargs/package.json
FILE care-app/node_modules/yargs/yargs
FILE care-app/node_modules/yargs/yargs.mjs
FILE care-app/node_modules/yocto-queue/index.d.ts
FILE care-app/node_modules/yocto-queue/index.js
FILE care-app/node_modules/yocto-queue/license
FILE care-app/node_modules/yocto-queue/package.json
FILE care-app/node_modules/yocto-queue/readme.md
FILE care-app/node_modules/zod/LICENSE
FILE care-app/node_modules/zod/README.md
FILE care-app/node_modules/zod/index.cjs
FILE care-app/node_modules/zod/index.d.cts
FILE care-app/node_modules/zod/index.d.ts
FILE care-app/node_modules/zod/index.js
FILE care-app/node_modules/zod/package.json
FILE care-app/package-lock.json
FILE care-app/package.json
FILE care-app/src/__tests__/intent.test.ts
FILE care-app/src/__tests__/parse.test.ts
FILE care-app/src/__tests__/schedule.test.ts
FILE care-app/src/lib/intent.ts
FILE care-app/src/lib/parse.ts
FILE care-app/src/lib/schedule.ts
FILE care-app/src/lib/storage.ts
FILE care-app/src/lib/supabase.ts
FILE care-app/src/theme/tokens.ts
FILE care-app/supabase/schema.sql
FILE care-app/tsconfig.json

exec
/bin/zsh -lc "sed -n '1,220p' care-app/App.tsx && sed -n '1,120p' care-app/supabase/schema.sql && cat care-app/jest.config.js" in /Users/cruel/Desktop/AI-bokkyak
 succeeded in 0ms:
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
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
module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@react-navigation/.*|@supabase/.*))",
  ],
};

exec
/bin/zsh -lc 'nl -ba care-app/src/lib/schedule.ts && nl -ba care-app/src/lib/intent.ts' in /Users/cruel/Desktop/AI-bokkyak
 succeeded in 0ms:
     1	export function normalizeRepeatDays(input: unknown): number[] {
     2	  if (input === "매일" || input == null) return [];
     3	  if (Array.isArray(input)) {
     4	    return Array.from(new Set(input.filter((n) => typeof n === "number"))).sort((a, b) => a - b);
     5	  }
     6	  return [];
     7	}
     8	
     9	type TimeSpec = { hour: number; minute: number; repeat_days: number[] };
    10	
    11	export function nextNotificationTime(spec: TimeSpec, now: Date): Date {
    12	  const candidate = new Date(now);
    13	  candidate.setSeconds(0, 0);
    14	  candidate.setHours(spec.hour, spec.minute, 0, 0);
    15	  const daily = spec.repeat_days.length === 0;
    16	  for (let i = 0; i < 8; i++) {
    17	    if (candidate.getTime() >= now.getTime() &&
    18	        (daily || spec.repeat_days.includes(candidate.getDay()))) {
    19	      return candidate;
    20	    }
    21	    candidate.setDate(candidate.getDate() + 1);
    22	    candidate.setHours(spec.hour, spec.minute, 0, 0);
    23	  }
    24	  return candidate;
    25	}
     1	export type Intent = "복용완료" | "미복용" | "재알림" | "인식실패";
     2	
     3	const REMIND = ["나중에", "이따", "30분", "다시 알려", "다시알려"];
     4	const NOT_TAKEN = ["안 먹", "안먹", "못 먹", "못먹", "아직"];
     5	const TAKEN = ["먹었", "복용했", "먹음", "했어요", "먹었어"];
     6	
     7	function hasAny(text: string, keywords: string[]): boolean {
     8	  return keywords.some((k) => text.includes(k));
     9	}
    10	
    11	export function classifyIntent(raw: string): Intent {
    12	  const text = (raw ?? "").trim();
    13	  if (!text) return "인식실패";
    14	  if (hasAny(text, REMIND)) return "재알림";
    15	  if (hasAny(text, NOT_TAKEN)) return "미복용";
    16	  if (hasAny(text, TAKEN)) return "복용완료";
    17	  return "인식실패";
    18	}

codex
The new pure logic includes correctness issues in schedule normalization and intent classification that can lead to invalid reminder schedules and false dose-completion records. These should be fixed before considering the patch correct.

Full review comments:

- [P2] Restrict repeat_days to valid weekdays — /Users/cruel/Desktop/AI-bokkyak/care-app/src/lib/schedule.ts:4-4
  When the parser/GPT returns an array containing values outside the weekday domain, this normalization preserves them as long as they are numbers, e.g. `[7]`, `[-1]`, or `[1.5]`. That violates the project invariant that weekday arrays are `0..6` ints, and `nextNotificationTime` will never match those values with `candidate.getDay()`, causing malformed schedules to be stored and scheduled incorrectly instead of being filtered or rejected.

- [P2] Avoid treating every 했어요 as dose completion — /Users/cruel/Desktop/AI-bokkyak/care-app/src/lib/intent.ts:5-5
  Because `했어요` is included as a standalone completion keyword, unrelated utterances such as `운동했어요` or `전화했어요` are classified as `복용완료` rather than `인식실패`. This makes the voice confirmation path mark doses as taken whenever the user says any completed action ending with that common phrase; completion keywords should stay medication-specific, like `먹었` or `복용했`.
The new pure logic includes correctness issues in schedule normalization and intent classification that can lead to invalid reminder schedules and false dose-completion records. These should be fixed before considering the patch correct.

Full review comments:

- [P2] Restrict repeat_days to valid weekdays — /Users/cruel/Desktop/AI-bokkyak/care-app/src/lib/schedule.ts:4-4
  When the parser/GPT returns an array containing values outside the weekday domain, this normalization preserves them as long as they are numbers, e.g. `[7]`, `[-1]`, or `[1.5]`. That violates the project invariant that weekday arrays are `0..6` ints, and `nextNotificationTime` will never match those values with `candidate.getDay()`, causing malformed schedules to be stored and scheduled incorrectly instead of being filtered or rejected.

- [P2] Avoid treating every 했어요 as dose completion — /Users/cruel/Desktop/AI-bokkyak/care-app/src/lib/intent.ts:5-5
  Because `했어요` is included as a standalone completion keyword, unrelated utterances such as `운동했어요` or `전화했어요` are classified as `복용완료` rather than `인식실패`. This makes the voice confirmation path mark doses as taken whenever the user says any completed action ending with that common phrase; completion keywords should stay medication-specific, like `먹었` or `복용했`.
