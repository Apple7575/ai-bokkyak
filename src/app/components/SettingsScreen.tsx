import { useState } from "react";
import { Users, Volume2, Mic2, Type, RotateCcw, Shield, LogOut, ChevronRight, Bell } from "lucide-react";

interface SettingsScreenProps {}

const speedOptions = ["느리게", "보통", "빠르게"];

export function SettingsScreen({}: SettingsScreenProps) {
  const [largeText, setLargeText] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState("느리게");

  const menuItems = [
    { Icon: Users, label: "보호자 연결 관리", color: "#8B5CF6" },
    { Icon: Volume2, label: "알림 소리 설정", color: "#2563EB" },
    { Icon: Shield, label: "개인정보 설정", color: "#64748B" },
    { Icon: LogOut, label: "로그아웃", color: "#E25353" },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: "#F7FAFF" }}>
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 border-b border-[#D8E5F6]">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#102A5E" }}>더보기</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 flex flex-col gap-4">
        {/* Profile card */}
        <div className="bg-white rounded-2xl p-4 border border-[#D8E5F6] flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#EEF5FF" }}>
            <span style={{ fontSize: 28 }}>👩‍🦳</span>
          </div>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#1F2937" }}>김영희 님</p>
            <p style={{ fontSize: 13, color: "#64748B" }}>010-1234-5678</p>
          </div>
        </div>

        {/* Accessibility settings */}
        <div className="bg-white rounded-2xl border border-[#D8E5F6] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#D8E5F6]">
            <p style={{ fontSize: 13, fontWeight: 700, color: "#64748B" }}>접근성 설정</p>
          </div>

          {/* Large text toggle */}
          <div className="px-4 py-4 flex items-center justify-between border-b border-[#D8E5F6]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#EEF5FF" }}>
                <Type size={20} color="#2563EB" />
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 600, color: "#1F2937" }}>큰 글씨 모드</p>
                <p style={{ fontSize: 12, color: "#64748B" }}>글씨를 크게 표시해요</p>
              </div>
            </div>
            <button
              onClick={() => setLargeText(!largeText)}
              className="relative rounded-full transition-colors duration-200"
              style={{
                width: 52,
                height: 30,
                background: largeText ? "#2563EB" : "#D8E5F6",
              }}
            >
              <span
                className="absolute top-1 rounded-full bg-white transition-all duration-200"
                style={{ width: 22, height: 22, left: largeText ? 26 : 4 }}
              />
            </button>
          </div>

          {/* Voice speed */}
          <div className="px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#EEF5FF" }}>
                <Mic2 size={20} color="#2563EB" />
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 600, color: "#1F2937" }}>음성 안내 속도</p>
                <p style={{ fontSize: 12, color: "#64748B" }}>기본값: 느리게</p>
              </div>
            </div>
            <div className="flex gap-2">
              {speedOptions.map((speed) => (
                <button
                  key={speed}
                  onClick={() => setVoiceSpeed(speed)}
                  className="flex-1 py-3 rounded-xl"
                  style={{
                    background: voiceSpeed === speed ? "#2563EB" : "#EEF5FF",
                    color: voiceSpeed === speed ? "#fff" : "#64748B",
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  {speed}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Replay voice */}
        <div className="bg-white rounded-2xl border border-[#D8E5F6] overflow-hidden">
          <button className="w-full px-4 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#EEF5FF" }}>
              <RotateCcw size={20} color="#2563EB" />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#1F2937", flex: 1, textAlign: "left" }}>
              음성 안내 다시 듣기
            </p>
            <ChevronRight size={18} color="#64748B" />
          </button>
        </div>

        {/* Notification */}
        <div className="bg-white rounded-2xl border border-[#D8E5F6] overflow-hidden">
          <button className="w-full px-4 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#EEF5FF" }}>
              <Bell size={20} color="#2563EB" />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#1F2937", flex: 1, textAlign: "left" }}>
              알림 소리 설정
            </p>
            <ChevronRight size={18} color="#64748B" />
          </button>
        </div>

        {/* Other menu */}
        <div className="bg-white rounded-2xl border border-[#D8E5F6] overflow-hidden">
          {menuItems.map(({ Icon, label, color }, i) => (
            <button
              key={label}
              className="w-full px-4 py-4 flex items-center gap-3"
              style={{ borderBottom: i < menuItems.length - 1 ? "1px solid #D8E5F6" : "none" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                <Icon size={20} color={color} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: label === "로그아웃" ? color : "#1F2937", flex: 1, textAlign: "left" }}>
                {label}
              </p>
              {label !== "로그아웃" && <ChevronRight size={18} color="#64748B" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
