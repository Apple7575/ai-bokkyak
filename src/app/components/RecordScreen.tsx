import { useState } from "react";
import { CalendarDays, CheckCircle2, Clock, XCircle } from "lucide-react";

interface RecordScreenProps {}

type FilterType = "전체" | "복용 완료" | "재알림" | "미복용";

const records = [
  { id: 1, date: "06월 11일", time: "오전 8:30", name: "고혈압약", status: "done" as const },
  { id: 2, date: "06월 11일", time: "오후 12:30", name: "점심 약", status: "done" as const },
  { id: 3, date: "06월 10일", time: "오후 6:30", name: "저녁 약", status: "remind" as const },
  { id: 4, date: "06월 10일", time: "오후 9:30", name: "취침 약", status: "missed" as const },
];

const statusConfig = {
  done: { label: "복용 완료", color: "#36B37E", bg: "#E6F9F1", Icon: CheckCircle2 },
  remind: { label: "30분 뒤 복용", color: "#F5A623", bg: "#FFF8ED", Icon: Clock },
  missed: { label: "미복용", color: "#E25353", bg: "#FFF0F0", Icon: XCircle },
};

const filters: FilterType[] = ["전체", "복용 완료", "재알림", "미복용"];

const filterMap: Record<FilterType, string[]> = {
  "전체": ["done", "remind", "missed"],
  "복용 완료": ["done"],
  "재알림": ["remind"],
  "미복용": ["missed"],
};

export function RecordScreen({}: RecordScreenProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>("전체");

  const filtered = records.filter((r) => filterMap[activeFilter].includes(r.status));
  const doneCount = records.filter((r) => r.status === "done").length;
  const total = records.length;
  const pct = Math.round((doneCount / total) * 100);
  const circumference = 2 * Math.PI * 28;

  return (
    <div className="flex flex-col h-full" style={{ background: "#F7FAFF" }}>
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 border-b border-[#D8E5F6]">
        <div className="flex items-center justify-between">
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#102A5E" }}>복약 기록</h1>
          <button className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#EEF5FF" }}>
            <CalendarDays size={20} color="#2563EB" />
          </button>
        </div>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>복약 기록과 건강 변화를 확인하세요.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 flex flex-col gap-4">
        {/* Summary card */}
        <div className="bg-white rounded-2xl p-4 border border-[#D8E5F6] flex items-center gap-4">
          <svg width={68} height={68} viewBox="0 0 68 68">
            <circle cx={34} cy={34} r={28} fill="none" stroke="#EEF5FF" strokeWidth={8} />
            <circle
              cx={34}
              cy={34}
              r={28}
              fill="none"
              stroke="#36B37E"
              strokeWidth={8}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - pct / 100)}
              strokeLinecap="round"
              transform="rotate(-90 34 34)"
            />
            <text x={34} y={39} textAnchor="middle" fill="#102A5E" fontSize={16} fontWeight={700}>
              {pct}%
            </text>
          </svg>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#1F2937" }}>이번 주 복약률 {pct}%</p>
            <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
              총 {total}회 중 {doneCount}회 복용 완료
            </p>
          </div>
          <div className="ml-auto w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#EEF5FF" }}>
            <CheckCircle2 size={20} color="#2563EB" />
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className="px-3 py-2 rounded-xl"
              style={{
                background: activeFilter === f ? "#2563EB" : "#fff",
                color: activeFilter === f ? "#fff" : "#64748B",
                fontSize: 13,
                fontWeight: 600,
                border: `1px solid ${activeFilter === f ? "#2563EB" : "#D8E5F6"}`,
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Record list */}
        <div className="flex flex-col gap-3">
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1F2937" }}>최근 복약 기록</h2>
          {filtered.map(({ id, date, time, name, status }) => {
            const { label, color, bg, Icon } = statusConfig[status];
            return (
              <div key={id} className="bg-white rounded-2xl p-4 border border-[#D8E5F6] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: bg }}>
                    <Icon size={22} color={color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1F2937" }}>{name}</div>
                    <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
                      {date} {time}
                    </div>
                  </div>
                </div>
                <span
                  className="px-2 py-1 rounded-full"
                  style={{ background: bg, color, fontSize: 12, fontWeight: 600 }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
