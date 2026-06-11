import { useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, Mic, LayoutList } from "lucide-react";

type STTState = "success" | "remind" | "fail";

interface STTResponseScreenProps {
  onConfirm: () => void;
  onViewRecord: () => void;
}

export function STTResponseScreen({ onConfirm, onViewRecord }: STTResponseScreenProps) {
  const [variant, setVariant] = useState<STTState>("success");

  const states: { id: STTState; label: string }[] = [
    { id: "success", label: "복용 완료" },
    { id: "remind", label: "재알림 요청" },
    { id: "fail", label: "인식 실패" },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 border-b border-[#D8E5F6]">
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#102A5E" }}>음성 응답 확인</h1>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>말씀하신 내용을 확인해 주세요.</p>
      </div>

      {/* Variant selector */}
      <div className="px-5 pt-4 flex gap-2">
        {states.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setVariant(id)}
            className="px-3 py-2 rounded-xl"
            style={{
              background: variant === id ? "#2563EB" : "#EEF5FF",
              color: variant === id ? "#fff" : "#64748B",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-6">
        {variant === "success" && (
          <>
            <div className="rounded-2xl px-5 py-3 w-full" style={{ background: "#EEF5FF" }}>
              <p style={{ fontSize: 13, color: "#64748B" }}>인식된 음성</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "#1F2937", marginTop: 4 }}>❝ 먹었어요 ❞</p>
            </div>
            <div className="w-28 h-28 rounded-full flex items-center justify-center" style={{ background: "#E6F9F1" }}>
              <CheckCircle2 size={64} color="#36B37E" strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#1F2937", textAlign: "center" }}>
              복약 완료로 기록했어요
            </div>
            <div className="w-full rounded-2xl border border-[#D8E5F6] p-4 flex flex-col gap-3">
              <p style={{ fontSize: 14, fontWeight: 700, color: "#64748B" }}>기록 요약</p>
              {[
                { icon: "💊", label: "약 이름", value: "저녁 약" },
                { icon: "🕐", label: "기록 시간", value: "오후 6:32" },
                { icon: "🎤", label: "응답 방식", value: "음성" },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{icon}</span>
                    <span style={{ fontSize: 14, color: "#64748B" }}>{label}</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#1F2937" }}>{value}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {variant === "remind" && (
          <>
            <div className="rounded-2xl px-5 py-3 w-full" style={{ background: "#EEF5FF" }}>
              <p style={{ fontSize: 13, color: "#64748B" }}>인식된 음성</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "#1F2937", marginTop: 4 }}>❝ 30분 뒤에 알려줘 ❞</p>
            </div>
            <div className="w-28 h-28 rounded-full flex items-center justify-center" style={{ background: "#FFF8ED" }}>
              <Clock size={64} color="#F5A623" strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#1F2937", textAlign: "center" }}>
              30분 뒤에 다시 알려드릴게요
            </div>
            <div className="rounded-xl px-4 py-3 w-full" style={{ background: "#FFF8ED" }}>
              <p style={{ fontSize: 14, color: "#F5A623", textAlign: "center", fontWeight: 600 }}>
                오후 7:00에 다시 알림을 드릴게요
              </p>
            </div>
          </>
        )}

        {variant === "fail" && (
          <>
            <div className="rounded-2xl px-5 py-3 w-full" style={{ background: "#FFF0F0" }}>
              <p style={{ fontSize: 14, color: "#E25353", fontWeight: 600 }}>음성 인식에 실패했어요</p>
            </div>
            <div className="w-28 h-28 rounded-full flex items-center justify-center" style={{ background: "#FFF0F0" }}>
              <AlertTriangle size={64} color="#E25353" strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1F2937", textAlign: "center" }}>
              잘 듣지 못했어요.<br />다시 말씀해 주세요.
            </div>
            <div className="flex flex-col gap-3 w-full">
              <button
                className="w-full rounded-2xl flex items-center justify-center gap-2"
                style={{ background: "#2563EB", color: "#fff", height: 60, fontSize: 17, fontWeight: 700 }}
              >
                <Mic size={20} />
                다시 말하기
              </button>
              <button
                className="w-full rounded-2xl flex items-center justify-center gap-2"
                style={{ background: "#EEF5FF", color: "#2563EB", height: 56, fontSize: 17, fontWeight: 700 }}
              >
                <LayoutList size={20} />
                버튼으로 선택하기
              </button>
            </div>
          </>
        )}
      </div>

      {/* Bottom buttons */}
      {variant !== "fail" && (
        <div className="px-5 pb-10 flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full rounded-2xl flex items-center justify-center"
            style={{ background: "#2563EB", color: "#fff", height: 60, fontSize: 18, fontWeight: 700 }}
          >
            확인
          </button>
          <button
            onClick={onViewRecord}
            className="w-full rounded-2xl flex items-center justify-center"
            style={{ background: "#EEF5FF", color: "#2563EB", height: 56, fontSize: 17, fontWeight: 700 }}
          >
            기록 보기
          </button>
        </div>
      )}
    </div>
  );
}
