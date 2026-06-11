import { useState } from "react";
import { ArrowLeft, Mic, Pill, RefreshCw, Calendar, Clock } from "lucide-react";

interface VoiceRegisterScreenProps {
  onBack: () => void;
  onRegister: () => void;
}

export function VoiceRegisterScreen({ onBack, onRegister }: VoiceRegisterScreenProps) {
  const [listening, setListening] = useState(false);
  const [recognized, setRecognized] = useState(false);

  const handleMic = () => {
    if (!recognized) {
      setListening(true);
      setTimeout(() => {
        setListening(false);
        setRecognized(true);
      }, 2000);
    }
  };

  const handleRetry = () => {
    setRecognized(false);
    setListening(false);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 border-b border-[#D8E5F6]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#EEF5FF" }}>
            <ArrowLeft size={20} color="#2563EB" />
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#102A5E" }}>음성으로 약 등록</h1>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-5 pt-8 gap-6">
        {/* Waveform + Mic */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-1 h-10">
            {[4, 8, 16, 12, 20, 14, 8, 18, 10, 6].map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full transition-all duration-300"
                style={{
                  height: listening ? h * 2 : h,
                  background: listening ? "#2563EB" : "#D8E5F6",
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          <button
            onClick={handleMic}
            className="w-28 h-28 rounded-full flex items-center justify-center shadow-lg transition-all"
            style={{
              background: listening ? "#4F8EF7" : "#2563EB",
              boxShadow: listening ? "0 0 0 16px #EEF5FF" : "0 4px 24px rgba(37,99,235,0.3)",
            }}
          >
            <Mic size={44} color="#fff" />
          </button>
          {!recognized && (
            <>
              <p style={{ fontSize: 17, fontWeight: 600, color: "#1F2937", textAlign: "center" }}>
                복용하는 약과 시간을 말씀해 주세요
              </p>
              <div className="rounded-xl px-4 py-3" style={{ background: "#EEF5FF" }}>
                <p style={{ fontSize: 13, color: "#4F8EF7", textAlign: "center" }}>
                  예시: "매일 아침 8시에 고혈압약을 먹어요"
                </p>
              </div>
            </>
          )}
        </div>

        {/* Recognized result */}
        {recognized && (
          <div className="w-full flex flex-col gap-4">
            <div className="rounded-2xl p-4" style={{ background: "#EEF5FF" }}>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 4 }}>인식된 문장</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#1F2937" }}>
                "매일 아침 8시에 고혈압약을 먹어요"
              </p>
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#1F2937", marginBottom: 10 }}>자동 분류 결과</p>
              <div className="flex flex-col gap-3">
                {[
                  { Icon: Pill, label: "약 이름", value: "고혈압약" },
                  { Icon: Calendar, label: "복용 주기", value: "매일" },
                  { Icon: Clock, label: "복용 시간", value: "오전 8:00" },
                ].map(({ Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 rounded-xl p-3 border border-[#D8E5F6]">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#EEF5FF" }}>
                      <Icon size={16} color="#2563EB" />
                    </div>
                    <span style={{ fontSize: 14, color: "#64748B" }}>{label}</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#1F2937", marginLeft: "auto" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom buttons */}
      <div className="px-5 pb-10 flex flex-col gap-3">
        {recognized ? (
          <>
            <button
              onClick={onRegister}
              className="w-full rounded-2xl flex items-center justify-center"
              style={{ background: "#2563EB", color: "#fff", height: 60, fontSize: 18, fontWeight: 700 }}
            >
              이대로 등록하기
            </button>
            <button
              onClick={handleRetry}
              className="w-full rounded-2xl flex items-center justify-center gap-2"
              style={{ background: "#EEF5FF", color: "#2563EB", height: 56, fontSize: 17, fontWeight: 700 }}
            >
              <RefreshCw size={18} />
              다시 말하기
            </button>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "#64748B", textAlign: "center" }}>
            {listening ? "듣고 있어요..." : "마이크 버튼을 눌러 말씀해 주세요"}
          </p>
        )}
      </div>
    </div>
  );
}
