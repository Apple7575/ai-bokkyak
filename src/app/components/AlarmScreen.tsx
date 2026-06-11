import { Mic, Bell, RotateCcw } from "lucide-react";

interface AlarmScreenProps {
  onTaken: () => void;
  onNotTaken: () => void;
  onRemind: () => void;
  onSpeak: () => void;
}

export function AlarmScreen({ onTaken, onNotTaken, onRemind, onSpeak }: AlarmScreenProps) {
  return (
    <div className="flex flex-col h-full items-center" style={{ background: "#EEF5FF" }}>
      {/* Top brand */}
      <div className="w-full flex items-center justify-between px-5 pt-12 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#2563EB" }}>
            <Bell size={16} color="#fff" />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#102A5E" }}>모두의 복약</span>
        </div>
        <button className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(37,99,235,0.1)", color: "#2563EB", fontSize: 18, fontWeight: 700 }}>
          ×
        </button>
      </div>

      {/* Bell + waveform */}
      <div className="flex flex-col items-center mt-6 gap-3">
        <div className="flex items-center gap-1 h-8">
          {[3, 6, 10, 8, 14, 10, 7, 12, 6, 4].map((h, i) => (
            <div key={i} className="w-1.5 rounded-full animate-pulse" style={{ height: h * 2, background: "#4F8EF7", animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
        <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: "#fff", boxShadow: "0 0 0 16px rgba(37,99,235,0.12)" }}>
          <Bell size={44} color="#2563EB" strokeWidth={1.8} />
        </div>
        <div className="flex items-center gap-1 h-8">
          {[4, 7, 12, 9, 14, 11, 6, 10, 5, 3].map((h, i) => (
            <div key={i} className="w-1.5 rounded-full animate-pulse" style={{ height: h * 2, background: "#4F8EF7", animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>

      {/* Time + title */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <p style={{ fontSize: 15, color: "#4F8EF7", fontWeight: 600 }}>오후 6:30</p>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#102A5E", textAlign: "center", lineHeight: 1.3 }}>
          저녁 약 드실 시간이에요
        </h1>
        <p style={{ fontSize: 16, color: "#64748B", textAlign: "center", lineHeight: 1.7, marginTop: 4 }}>
          김영희 님, 저녁 약을 복용할 시간입니다.<br />
          복용하신 뒤 말씀해 주세요.
        </p>
      </div>

      {/* Mic button */}
      <div className="mt-8">
        <button
          onClick={onSpeak}
          className="w-28 h-28 rounded-full flex flex-col items-center justify-center gap-1 shadow-xl"
          style={{ background: "#2563EB", boxShadow: "0 8px 32px rgba(37,99,235,0.35)" }}
        >
          <Mic size={36} color="#fff" />
          <span style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>말하기</span>
        </button>
      </div>

      {/* Bottom action buttons */}
      <div className="mt-auto w-full px-5 pb-10 flex gap-3">
        <button
          onClick={onTaken}
          className="flex-1 rounded-2xl flex flex-col items-center justify-center gap-1 py-4 border-2"
          style={{ borderColor: "#36B37E", background: "#fff" }}
        >
          <span style={{ fontSize: 22 }}>✅</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#36B37E" }}>복용했어요</span>
        </button>
        <button
          onClick={onNotTaken}
          className="flex-1 rounded-2xl flex flex-col items-center justify-center gap-1 py-4 border-2"
          style={{ borderColor: "#E25353", background: "#fff" }}
        >
          <span style={{ fontSize: 22 }}>❌</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#E25353" }}>아직 안 먹었어요</span>
        </button>
        <button
          onClick={onRemind}
          className="flex-1 rounded-2xl flex flex-col items-center justify-center gap-1 py-4 border-2"
          style={{ borderColor: "#F5A623", background: "#fff" }}
        >
          <RotateCcw size={22} color="#F5A623" />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#F5A623" }}>30분 뒤 다시</span>
        </button>
      </div>
    </div>
  );
}
