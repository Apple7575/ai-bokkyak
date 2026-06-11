import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

interface StatusCheckScreenProps {
  onDone: () => void;
}

type YesNo = "yes" | "no" | null;
type Condition = "good" | "normal" | "bad" | null;

export function StatusCheckScreen({ onDone }: StatusCheckScreenProps) {
  const [taken, setTaken] = useState<YesNo>(null);
  const [symptom, setSymptom] = useState<YesNo>(null);
  const [condition, setCondition] = useState<Condition>(null);

  const canSubmit = taken !== null && symptom !== null && condition !== null;

  return (
    <div className="relative flex flex-col h-full bg-white">
      <div className="px-5 pt-12 pb-4 border-b border-[#D8E5F6]">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#102A5E" }}>복약 후 상태 확인</h1>
        <p style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>간단히 응답해 주시면 됩니다.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-32 flex flex-col gap-8">
        {/* Q1 */}
        <div className="flex flex-col gap-3">
          <p style={{ fontSize: 19, fontWeight: 700, color: "#1F2937" }}>약을 드셨나요?</p>
          <div className="flex gap-3">
            <button
              onClick={() => setTaken("yes")}
              className="flex-1 rounded-2xl py-5 flex items-center justify-center gap-2"
              style={{
                background: taken === "yes" ? "#2563EB" : "#EEF5FF",
                color: taken === "yes" ? "#fff" : "#1F2937",
                fontSize: 17,
                fontWeight: 700,
                border: taken === "yes" ? "none" : "2px solid #D8E5F6",
              }}
            >
              {taken === "yes" && <CheckCircle2 size={18} />}
              네, 먹었어요
            </button>
            <button
              onClick={() => setTaken("no")}
              className="flex-1 rounded-2xl py-5 flex items-center justify-center"
              style={{
                background: taken === "no" ? "#E25353" : "#FFF0F0",
                color: taken === "no" ? "#fff" : "#E25353",
                fontSize: 17,
                fontWeight: 700,
                border: taken === "no" ? "none" : "2px solid #FFCFCF",
              }}
            >
              아니요, 못 먹었어요
            </button>
          </div>
        </div>

        {/* Q2 */}
        <div className="flex flex-col gap-3">
          <p style={{ fontSize: 19, fontWeight: 700, color: "#1F2937" }}>이상 증상이 있나요?</p>
          <div className="flex gap-3">
            {[
              { val: "no" as YesNo, emoji: "😊", label: "없어요", active: "#36B37E", inactiveBg: "#E6F9F1", inactiveColor: "#36B37E" },
              { val: "yes" as YesNo, emoji: "😟", label: "있어요", active: "#E25353", inactiveBg: "#FFF0F0", inactiveColor: "#E25353" },
            ].map(({ val, emoji, label, active, inactiveBg, inactiveColor }) => (
              <button
                key={val}
                onClick={() => setSymptom(val)}
                className="flex-1 rounded-2xl py-5 flex flex-col items-center gap-1"
                style={{
                  background: symptom === val ? active : inactiveBg,
                  color: symptom === val ? "#fff" : inactiveColor,
                  fontSize: 17,
                  fontWeight: 700,
                  border: `2px solid ${symptom === val ? active : inactiveBg}`,
                }}
              >
                <span style={{ fontSize: 28 }}>{emoji}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Q3 */}
        <div className="flex flex-col gap-3">
          <p style={{ fontSize: 19, fontWeight: 700, color: "#1F2937" }}>오늘 컨디션은 어떤가요?</p>
          <div className="flex gap-2">
            {[
              { val: "good" as Condition, emoji: "😄", label: "좋음", color: "#36B37E" },
              { val: "normal" as Condition, emoji: "😐", label: "보통", color: "#F5A623" },
              { val: "bad" as Condition, emoji: "😔", label: "나쁨", color: "#E25353" },
            ].map(({ val, emoji, label, color }) => (
              <button
                key={val}
                onClick={() => setCondition(val)}
                className="flex-1 rounded-2xl py-5 flex flex-col items-center gap-1 border-2"
                style={{
                  background: condition === val ? color : "#fff",
                  borderColor: condition === val ? color : "#D8E5F6",
                  color: condition === val ? "#fff" : "#64748B",
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                <span style={{ fontSize: 28 }}>{emoji}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#D8E5F6] px-5 py-4">
        <button
          onClick={canSubmit ? onDone : undefined}
          className="w-full rounded-2xl flex items-center justify-center"
          style={{
            background: canSubmit ? "#2563EB" : "#D8E5F6",
            color: canSubmit ? "#fff" : "#64748B",
            height: 60,
            fontSize: 18,
            fontWeight: 700,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          기록 완료
        </button>
      </div>
    </div>
  );
}
