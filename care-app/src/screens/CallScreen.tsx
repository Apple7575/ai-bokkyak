import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Alert, Pressable, ScrollView } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Phone } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { supabase, Patient, Schedule } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { recordIntake } from "../lib/records";
import { todaySlot } from "../lib/schedule";
import { ensurePermission, scheduleReminders, cancelSchedule } from "../lib/notifications";
import { ensureStrongAlarmReady } from "../lib/alarmPermissions";
import { playCallGreeting, stopSpeaking } from "../lib/tts";
import { startCall, CallEvent, CallState } from "../lib/realtimeCall";
import {
  parseRecordMedicationArgs,
  parseBirthDateArgs,
  parseAddMedicationArgs,
  parseUpdateMedicationArgs,
  parseRemoveMedicationArgs,
  summarizeMedList,
  toolStatusToIntake,
  matchSchedule,
  buildMedsContext,
} from "../lib/callTools";
import { colors, fontSizes, spacing, radii, minTouch } from "../theme/tokens";

// 통화 시간 상한(초). 도달하면 자동 종료하고 "오늘 통화가 끝났어요"를 보여준다.
const CALL_LIMIT_SEC = 180;

function fmtElapsed(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

type Notice = { text: string; kind: "error" | "success" };

export function CallScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  // 가입 직후 프로필/복약 수집 통화. 이 모드에선 생년월일·약 등록 도구를 처리한다.
  const isSetup = route.params?.setup === true;

  const [callState, setCallState] = useState<CallState>("connecting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const [aiText, setAiText] = useState("");
  const [userText, setUserText] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  // 통화 세션 식별자. 재시도/이탈 시 증가시켜, 이전 통화에서 늦게 도착하는
  // 이벤트(전사·상태·도구 호출)가 현재 화면 상태를 건드리지 못하게 한다.
  const sessionRef = useRef(0);
  const handleRef = useRef<Awaited<ReturnType<typeof startCall>> | null>(null);
  const patientIdRef = useRef<string | null>(null);
  const genderRef = useRef<string | undefined>(undefined);
  const schedulesRef = useRef<Schedule[]>([]);
  // 이 통화 세션의 기준 날짜. begin()에서 스케줄 목록·taken 컨텍스트를 만든 시점에
  // 캡처하고(재시도 시 새로 캡처), 이 세션의 모든 todaySlot 계산에 사용한다.
  const callDateRef = useRef<Date>(new Date());
  // 같은 callId의 tool-call이 중복 도착해도 한 번만 처리 (중복 기록/중복 회신 방지).
  const handledCallIdsRef = useRef<Set<string>>(new Set());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const limitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers(): void {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (limitRef.current) { clearTimeout(limitRef.current); limitRef.current = null; }
    if (endDelayRef.current) { clearTimeout(endDelayRef.current); endDelayRef.current = null; }
  }

  function startTimers(session: number): void {
    clearTimers(); // 방어: 중복 호출로 기존 interval/timeout이 누수되지 않게
    const startedAt = Date.now();
    tickRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    limitRef.current = setTimeout(() => {
      if (sessionRef.current !== session) return;
      setTimeUp(true);
      handleRef.current?.end().catch(() => {});
    }, CALL_LIMIT_SEC * 1000);
  }

  async function handleToolCall(
    session: number,
    e: { name: string; argsJson: string; callId: string }
  ): Promise<void> {
    if (handledCallIdsRef.current.has(e.callId)) return;
    handledCallIdsRef.current.add(e.callId);
    const handle = handleRef.current;
    if (!handle) return; // 도구 호출은 연결 후에만 오지만 방어

    if (e.name === "end_call") {
      handle.sendToolResult(e.callId, '{"ok":true}');
      // 모델의 마지막 인사가 재생될 여유를 주고 끊는다.
      endDelayRef.current = setTimeout(() => {
        handleRef.current?.end().catch(() => {});
      }, 2000);
      return;
    }

    // ── 가입 직후 setup 통화 도구 ──────────────────────────────
    if (e.name === "set_birth_date") {
      const birth = parseBirthDateArgs(e.argsJson);
      const pid = patientIdRef.current;
      if (!birth || !pid) {
        handle.sendToolResult(e.callId, '{"ok":false,"reason":"생년월일 형식 오류"}');
        return;
      }
      const { error } = await supabase.from("patients").update({ birth_date: birth }).eq("id", pid);
      if (error) {
        handle.sendToolResult(e.callId, '{"ok":false,"reason":"저장 실패"}');
      } else {
        handle.sendToolResult(e.callId, '{"ok":true}');
        if (sessionRef.current === session) setNotice({ text: "생년월일을 저장했어요.", kind: "success" });
      }
      return;
    }
    if (e.name === "add_medication") {
      const med = parseAddMedicationArgs(e.argsJson);
      const pid = patientIdRef.current;
      if (!med || !pid) {
        handle.sendToolResult(e.callId, '{"ok":false,"reason":"약 정보 형식 오류"}');
        return;
      }
      const { data, error } = await supabase.from("schedules").insert({
        patient_id: pid, medicine_name: med.medicine_name, time_of_day: med.time_of_day,
        hour: med.hour, minute: med.minute, repeat_days: [] as number[], active: true, // 빈 배열=매일(설계 결정 #1)
      }).select().single();
      if (error || !data) {
        handle.sendToolResult(e.callId, '{"ok":false,"reason":"저장 실패"}');
        if (sessionRef.current === session) {
          setNotice({ text: "약 등록에 실패했어요. 통화 후 약 등록 화면에서 확인해 주세요.", kind: "error" });
        }
        return;
      }
      // 이후 record/update/remove가 최신 목록을 보게 반영.
      schedulesRef.current = [...schedulesRef.current, data as Schedule];
      // 방금 등록한 약의 번호와 전체 목록을 함께 돌려줘, 모델이 update/remove에 쓸
      // index를 자기 기억이 아니라 실제 목록 기준으로 갖게 한다.
      handle.sendToolResult(
        e.callId,
        JSON.stringify({
          ok: true,
          index: schedulesRef.current.length - 1,
          meds: summarizeMedList(schedulesRef.current),
        })
      );
      if (sessionRef.current === session) {
        setNotice({ text: `${med.medicine_name}을(를) 등록했어요.`, kind: "success" });
      }
      // 알림 예약은 베스트에포트(일정은 이미 저장됨). 실패해도 통화를 막지 않는다.
      try {
        await ensureStrongAlarmReady();
        if (await ensurePermission()) {
          await scheduleReminders(data.id, data.medicine_name, med.hour, med.minute, [], med.time_of_day);
        }
      } catch {}
      return;
    }

    if (e.name === "update_medication") {
      const upd = parseUpdateMedicationArgs(e.argsJson);
      if (!upd) {
        handle.sendToolResult(e.callId, '{"ok":false,"reason":"수정 정보 형식 오류"}');
        return;
      }
      const target = schedulesRef.current[upd.index];
      if (!target) {
        handle.sendToolResult(
          e.callId,
          JSON.stringify({ ok: false, reason: "해당 번호의 약 없음", meds: summarizeMedList(schedulesRef.current) })
        );
        return;
      }
      // 바꿀 필드만 patch — 나머지는 기존 값 유지.
      const patch: Partial<Schedule> = {};
      if (upd.medicine_name !== undefined) patch.medicine_name = upd.medicine_name;
      if (upd.time_of_day !== undefined) patch.time_of_day = upd.time_of_day;
      if (upd.hour !== undefined) patch.hour = upd.hour;
      if (upd.minute !== undefined) patch.minute = upd.minute;
      const { data, error } = await supabase
        .from("schedules").update(patch).eq("id", target.id).select().single();
      if (error || !data) {
        handle.sendToolResult(e.callId, '{"ok":false,"reason":"저장 실패"}');
        if (sessionRef.current === session) {
          setNotice({ text: "약 수정에 실패했어요. 통화 후 복약 관리에서 확인해 주세요.", kind: "error" });
        }
        return;
      }
      const next = [...schedulesRef.current];
      next[upd.index] = data as Schedule;
      schedulesRef.current = next;
      handle.sendToolResult(
        e.callId,
        JSON.stringify({ ok: true, meds: summarizeMedList(schedulesRef.current) })
      );
      if (sessionRef.current === session) {
        setNotice({ text: `${data.medicine_name} 정보를 수정했어요.`, kind: "success" });
      }
      // 시간·시간대가 바뀌었을 수 있으니 알림을 다시 예약(베스트에포트).
      try {
        await cancelSchedule(data.id);
        if (await ensurePermission()) {
          await scheduleReminders(
            data.id, data.medicine_name, data.hour, data.minute, data.repeat_days ?? [], data.time_of_day
          );
        }
      } catch {}
      return;
    }
    if (e.name === "remove_medication") {
      const idx = parseRemoveMedicationArgs(e.argsJson);
      if (idx === null) {
        handle.sendToolResult(e.callId, '{"ok":false,"reason":"인자 형식 오류"}');
        return;
      }
      const target = schedulesRef.current[idx];
      if (!target) {
        handle.sendToolResult(
          e.callId,
          JSON.stringify({ ok: false, reason: "해당 번호의 약 없음", meds: summarizeMedList(schedulesRef.current) })
        );
        return;
      }
      const { error } = await supabase.from("schedules").delete().eq("id", target.id);
      if (error) {
        handle.sendToolResult(e.callId, '{"ok":false,"reason":"삭제 실패"}');
        if (sessionRef.current === session) {
          setNotice({ text: `'${target.medicine_name}' 삭제에 실패했어요.`, kind: "error" });
        }
        return;
      }
      // 삭제 후 번호가 앞으로 당겨진다 — 갱신된 목록을 결과에 실어 모델 index를 재동기화.
      schedulesRef.current = schedulesRef.current.filter((_, i) => i !== idx);
      handle.sendToolResult(
        e.callId,
        JSON.stringify({ ok: true, meds: summarizeMedList(schedulesRef.current) })
      );
      if (sessionRef.current === session) {
        setNotice({ text: `${target.medicine_name}을(를) 목록에서 뺐어요.`, kind: "success" });
      }
      try { await cancelSchedule(target.id); } catch {}
      return;
    }

    if (e.name !== "record_medication") {
      handle.sendToolResult(e.callId, JSON.stringify({ ok: false, reason: "지원하지 않는 요청" }));
      return;
    }

    const args = parseRecordMedicationArgs(e.argsJson);
    if (!args) {
      handle.sendToolResult(e.callId, '{"ok":false,"reason":"인자 형식 오류"}');
      return;
    }
    const sched = matchSchedule(schedulesRef.current, args);
    if (!sched) {
      handle.sendToolResult(e.callId, '{"ok":false,"reason":"해당 약 없음"}');
      return;
    }
    const pid = patientIdRef.current;
    if (!pid) {
      handle.sendToolResult(e.callId, '{"ok":false,"reason":"저장 실패"}');
      return;
    }
    const status = toolStatusToIntake(args.status);
    try {
      await recordIntake({
        patientId: pid,
        scheduleId: sched.id,
        // doseSlot이 아니라 todaySlot: 통화는 오늘의 모든 스케줄(아직 안 울린 미래
        // 시간 포함)을 확인하므로, 미래 시각을 어제로 되돌리는 doseSlot을 쓰면
        // 어제 슬롯의 실제 복용 기록을 upsert로 덮어쓴다.
        // 호출 시점 new Date()가 아니라 캡처한 기준 날짜: 자정 직전에 시작한 통화에
        // 자정 넘어 답해도, 다음날 슬롯이 아닌 컨텍스트를 만든 날의 슬롯에 기록한다.
        scheduledFor: todaySlot(sched.hour, sched.minute, callDateRef.current),
        status,
        method: "음성",
      });
      handle.sendToolResult(e.callId, '{"ok":true}');
      if (sessionRef.current === session) {
        setNotice({
          text:
            args.status === "복용함"
              ? `${sched.medicine_name} 복용을 기록했어요.`
              : `${sched.medicine_name} 미복용으로 기록했어요.`,
          kind: "success",
        });
      }
    } catch {
      handle.sendToolResult(e.callId, '{"ok":false,"reason":"저장 실패"}');
      if (sessionRef.current === session) {
        setNotice({
          text: "복약 기록 저장에 실패했어요. 통화 후 기록 화면에서 확인해 주세요.",
          kind: "error",
        });
      }
    }
  }

  function handleEvent(session: number, e: CallEvent): void {
    if (sessionRef.current !== session) return;
    switch (e.type) {
      case "state":
        if (e.state === "active") {
          setCallState("active");
          startTimers(session);
        } else if (e.state === "ended") {
          clearTimers();
          setCallState("ended");
        } else if (e.state === "error") {
          clearTimers();
          setErrorMsg(e.message ?? "통화 연결에 실패했어요.");
          setCallState("error");
        } else {
          setCallState("connecting");
        }
        break;
      case "ai-transcript":
        setAiText(e.text);
        break;
      case "user-transcript":
        setUserText(e.text);
        break;
      case "tool-call":
        void handleToolCall(session, e);
        break;
    }
  }

  async function begin(): Promise<void> {
    const session = ++sessionRef.current;
    clearTimers();
    handledCallIdsRef.current = new Set();
    handleRef.current?.end().catch(() => {}); // 재시도 시 이전 통화 잔여 자원 정리 (end는 멱등)
    handleRef.current = null;
    setCallState("connecting");
    setErrorMsg(null);
    setElapsed(0);
    setTimeUp(false);
    setAiText("");
    setUserText("");
    setNotice(null);
    try {
      // 연결되는 동안(호출 시간) 대기 인사말을 즉시 재생한다. 내부에서 stopSpeaking을
      // 먼저 수행해 다른 화면의 TTS와 겹치지 않는다. 재생이 끝나는 시점(promise)은
      // startCall에 넘겨, 인사말 직후 AI 첫 발화가 바로 이어지게 한다.
      const greetingDone = playCallGreeting();
      const pid = await getPatientId();
      if (sessionRef.current !== session) return; // 이탈/재시도 시 여기서 중단
      if (!pid) throw new Error("환자 정보가 없어요. 앱을 다시 설정해 주세요.");

      const { data: patient, error: pErr } = await supabase
        .from("patients").select("*").eq("id", pid).single();
      if (sessionRef.current !== session) return;
      if (pErr) throw new Error("환자 정보를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.");

      callDateRef.current = new Date();
      patientIdRef.current = pid;
      genderRef.current = (patient as Patient | null)?.gender ?? undefined;

      // setup 통화(가입 직후): 아직 등록된 약이 없으므로 스케줄/기록 조회를 건너뛴다.
      // 생년월일·복약 정보를 음성으로 받아 저장하는 setup 세션으로 시작한다.
      if (isSetup) {
        schedulesRef.current = [];
        const handle = await startCall({
          patientName: (patient as Patient | null)?.name,
          gender: genderRef.current,
          meds: [],
          setup: true,
          onEvent: (e) => handleEvent(session, e),
          greetingDone,
        });
        if (sessionRef.current !== session) { handle.end().catch(() => {}); return; }
        handleRef.current = handle;
        return;
      }

      const { data: schs, error: sErr } = await supabase
        .from("schedules").select("*").eq("patient_id", pid).eq("active", true).order("hour");
      if (sessionRef.current !== session) return;
      if (sErr) throw new Error("복약 일정을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.");

      // 오늘 요일에 해당하는 약만 (빈 repeat_days=매일, 설계 결정 #1) — HomeScreen과 동일.
      // 이 `now`가 이 세션의 기준 날짜: 요일 필터·taken 조회·복약 기록 슬롯이 전부
      // 같은 날짜를 보게 캡처해 둔다 (자정을 넘겨도 통화 중에는 날짜가 안 바뀐다).
      const now = callDateRef.current;
      const dueToday = ((schs ?? []) as Schedule[]).filter((s) => {
        const days = s.repeat_days ?? [];
        return days.length === 0 || days.includes(now.getDay());
      });

      // 오늘 이미 복용 완료한 스케줄 — AI가 "드셨어요?"를 중복으로 묻지 않게 컨텍스트에 반영.
      const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
      const { data: recs, error: rErr } = await supabase
        .from("intake_records").select("*").eq("patient_id", pid)
        .gte("scheduled_for", dayStart.toISOString())
        .lt("scheduled_for", dayEnd.toISOString());
      // startCall 전 마지막 가드 — 이탈한 사용자의 기기에서 토큰 발급→마이크
      // 획득→WebRTC 연결이 진행되지 않게 한다.
      if (sessionRef.current !== session) return;
      if (rErr) throw new Error("오늘 복약 기록을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.");
      const taken = new Set(
        (recs ?? []).filter((r) => r.status === "completed").map((r) => r.schedule_id as string)
      );

      schedulesRef.current = dueToday;

      const handle = await startCall({
        patientName: (patient as Patient | null)?.name,
        gender: genderRef.current,
        meds: buildMedsContext(dueToday, taken),
        onEvent: (e) => handleEvent(session, e),
        greetingDone,
      });
      // 연결되는 사이 화면을 떠났거나 재시도가 시작됐으면 즉시 끊는다
      // (startCall은 연결 중 취소 수단이 없어 여기서 정리하는 수밖에 없다).
      if (sessionRef.current !== session) {
        handle.end().catch(() => {});
        return;
      }
      handleRef.current = handle;
    } catch (e) {
      if (sessionRef.current !== session) return;
      const msg = e instanceof Error && e.message ? e.message : "통화 연결에 실패했어요.";
      setErrorMsg(msg);
      setCallState("error");
      Alert.alert("통화 연결 실패", msg, [
        { text: "닫기", style: "cancel", onPress: () => nav.goBack() },
        { text: "다시 걸기", onPress: () => { void begin(); } },
      ]);
    }
  }

  // 마운트 시 통화 시작, 언마운트 시 반드시 종료 — 통화가 백그라운드에 남지 않게.
  useEffect(() => {
    void begin();
    return () => {
      sessionRef.current++; // 이후 도착하는 이벤트 전부 무시
      clearTimers();
      void stopSpeaking(); // 연결 중 이탈 시 대기 인사말도 멈춘다
      handleRef.current?.end().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 다른 화면으로 이동(blur)해도 통화를 끊는다. end()는 멱등이라 언마운트와 겹쳐도 안전.
  useEffect(() => {
    const unsub = nav.addListener("blur", () => {
      clearTimers();
      void stopSpeaking(); // 연결 중 이탈 시 대기 인사말도 멈춘다
      handleRef.current?.end().catch(() => {});
    });
    return unsub;
  }, [nav]);

  async function pressEnd(): Promise<void> {
    clearTimers();
    try {
      await handleRef.current?.end();
    } catch {}
    nav.goBack();
  }

  const statusText =
    callState === "connecting" ? "연결 중…"
      : callState === "active" ? `통화 중 ${fmtElapsed(elapsed)}`
        : callState === "ended" ? (timeUp ? "오늘 통화가 끝났어요" : "통화가 끝났어요")
          : errorMsg ?? "통화 연결에 실패했어요.";
  const inCall = callState === "connecting" || callState === "active";

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <View style={styles.phoneWrap}>
          <View style={styles.phoneHalo}>
            <View style={styles.phoneCircle}>
              <Phone size={48} color={colors.primaryBlue} strokeWidth={1.8} />
            </View>
          </View>
        </View>

        <Text style={styles.title}>AI 건강전화</Text>
        <Text style={styles.status}>{statusText}</Text>

        {/* 자막: AI 발화와 내 발화 최근 1개씩 */}
        {aiText ? (
          <View style={styles.bubbleAi}>
            <Text style={styles.bubbleLabel}>AI</Text>
            <Text style={styles.bubbleText}>{aiText}</Text>
          </View>
        ) : null}
        {userText ? (
          <View style={styles.bubbleUser}>
            <Text style={styles.bubbleLabel}>나</Text>
            <Text style={styles.bubbleText}>{userText}</Text>
          </View>
        ) : null}

        {notice ? (
          <Text style={[styles.notice, notice.kind === "error" ? styles.noticeError : styles.noticeSuccess]}>
            {notice.text}
          </Text>
        ) : null}

        <View style={{ height: spacing.xl }} />
        {inCall ? (
          <Pressable
            onPress={() => { void pressEnd(); }}
            style={({ pressed }) => [styles.endBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.endBtnText}>통화 종료</Text>
          </Pressable>
        ) : (
          <>
            {callState === "error" ? (
              <BigButton label="다시 걸기" onPress={() => { void begin(); }} />
            ) : null}
            <BigButton label="닫기" variant="secondary" onPress={() => nav.goBack()} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.lightBlueBg },
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: "center" },
  phoneWrap: { alignItems: "center", marginBottom: spacing.md },
  phoneHalo: {
    width: 132, height: 132, borderRadius: 66,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(37,99,235,0.12)",
  },
  phoneCircle: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.cardBg,
    shadowColor: colors.primaryBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 4,
  },
  title: {
    fontSize: fontSizes.title, fontWeight: "800", color: colors.primaryNavy,
    textAlign: "center", marginTop: spacing.md,
  },
  status: {
    fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.primaryBlue,
    textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.lg,
  },
  bubbleAi: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md, marginBottom: spacing.sm,
  },
  bubbleUser: {
    backgroundColor: "#E6F9F1", borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md, marginBottom: spacing.sm,
  },
  bubbleLabel: { fontSize: fontSizes.body, fontWeight: "700", color: colors.textSecondary, marginBottom: spacing.xs },
  bubbleText: { fontSize: fontSizes.body, color: colors.text },
  notice: { fontSize: fontSizes.body, fontWeight: "700", textAlign: "center", marginTop: spacing.sm },
  noticeError: { color: colors.dangerRed },
  noticeSuccess: { color: colors.successGreen },
  endBtn: {
    minHeight: minTouch,
    borderRadius: radii.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginVertical: 6,
    backgroundColor: colors.dangerRed,
    shadowColor: colors.dangerRed,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
  },
  endBtnText: { fontSize: fontSizes.emphasis, fontWeight: "700", color: "#fff" },
});
