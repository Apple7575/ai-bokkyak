import { Bell, BellOff, ChevronRight } from "lucide-react";

interface AlarmListScreenProps {
  onTriggerAlarm: () => void;
}

const alarms = [
  { id: 1, name: "아침 약", time: "오전 8:30", enabled: true, days: "매일" },
  { id: 2, name: "점심 약", time: "오후 12:30", enabled: true, days: "매일" },
  { id: 3, name: "저녁 약", time: "오후 6:30", enabled: true, days: "매일" },
  { id: 4, name: "취침 약", time: "오후 9:30", enabled: false, days: "매일" },
];

export function AlarmListScreen({ onTriggerAlarm }: AlarmListScreenProps) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#F7FAFF" }}>
      <div className="bg-white px-5 pt-12 pb-4 border-b border-[#D8E5F6]">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#102A5E" }}>알림</h1>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>복약 알림을 관리하세요.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 flex flex-col gap-3">
        {/* Test alarm button */}
        <button
          onClick={onTriggerAlarm}
          className="w-full rounded-2xl p-4 flex items-center gap-3 border-2"
          style={{ borderColor: "#2563EB", background: "#EEF5FF" }}
        >
          <Bell size={22} color="#2563EB" />
          <span style={{ fontSize: 16, fontWeight: 700, color: "#2563EB" }}>알림 화면 미리 보기</span>
          <ChevronRight size={18} color="#2563EB" className="ml-auto" />
        </button>

        {alarms.map(({ id, name, time, enabled, days }) => (
          <div key={id} className="bg-white rounded-2xl p-4 border border-[#D8E5F6] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: enabled ? "#EEF5FF" : "#F7FAFF" }}
              >
                {enabled ? <Bell size={22} color="#2563EB" /> : <BellOff size={22} color="#64748B" />}
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: enabled ? "#1F2937" : "#64748B" }}>{name}</p>
                <p style={{ fontSize: 13, color: "#64748B" }}>{time} · {days}</p>
              </div>
            </div>
            <div
              className="relative rounded-full"
              style={{ width: 48, height: 28, background: enabled ? "#2563EB" : "#D8E5F6" }}
            >
              <span
                className="absolute top-1 rounded-full bg-white"
                style={{ width: 20, height: 20, left: enabled ? 24 : 4, transition: "left 0.2s" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
