import { Bell, UserCheck, ChevronRight, CheckCircle2, Clock, Sun, Cloud, Moon, Sunset } from "lucide-react";
import { StatusBadge, StatusType } from "./StatusBadge";

interface HomeScreenProps {
  onViewSchedule: () => void;
  onAlarmTrigger: () => void;
}

const scheduleItems = [
  { id: 1, name: "아침 약", time: "08:30", Icon: Sun, status: "done" as StatusType },
  { id: 2, name: "점심 약", time: "12:30", Icon: Cloud, status: "done" as StatusType },
  { id: 3, name: "저녁 약", time: "18:30", Icon: Sunset, status: "upcoming" as StatusType },
  { id: 4, name: "취침 약", time: "21:30", Icon: Moon, status: "upcoming" as StatusType },
];

export function HomeScreen({ onViewSchedule, onAlarmTrigger }: HomeScreenProps) {
  const doneCount = scheduleItems.filter((s) => s.status === "done").length;
  const total = scheduleItems.length;
  const pct = Math.round((doneCount / total) * 100);
  const circumference = 2 * Math.PI * 36;

  return (
    <div className="flex flex-col h-full" style={{ background: "#F7FAFF" }}>
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-5 flex items-start justify-between border-b border-[#D8E5F6]">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#102A5E", lineHeight: 1.3 }}>
            안녕하세요, 김영희 님
          </h1>
          <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>오늘도 건강한 하루 보내세요.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onAlarmTrigger}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "#EEF5FF" }}
          >
            <Bell size={20} color="#2563EB" />
          </button>
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#E6F9F1" }}>
            <UserCheck size={20} color="#36B37E" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4 flex flex-col gap-4">
        {/* Next medicine card */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "linear-gradient(135deg, #2563EB 0%, #4F8EF7 100%)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} color="#fff" />
            <span style={{ fontSize: 13, color: "#fff", opacity: 0.85 }}>다음 복약 시간</span>
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>
            오늘 오후 6:30
          </div>
          <div style={{ fontSize: 16, color: "#fff", opacity: 0.9, marginTop: 4 }}>저녁 약</div>
          <button
            onClick={onViewSchedule}
            className="mt-4 flex items-center gap-1 rounded-xl px-4 py-2"
            style={{ background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 14, fontWeight: 600 }}
          >
            복약 일정 보기 <ChevronRight size={16} />
          </button>
        </div>

        {/* Today's schedule */}
        <div className="bg-white rounded-2xl p-4 border border-[#D8E5F6]">
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1F2937", marginBottom: 12 }}>
            오늘의 복약
          </h2>
          <div className="flex flex-col gap-3">
            {scheduleItems.map(({ id, name, time, Icon, status }) => (
              <div key={id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: status === "done" ? "#E6F9F1" : "#EEF5FF" }}
                  >
                    <Icon size={20} color={status === "done" ? "#36B37E" : "#2563EB"} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#1F2937" }}>{name}</div>
                    <div style={{ fontSize: 13, color: "#64748B" }}>{time}</div>
                  </div>
                </div>
                <StatusBadge status={status} />
              </div>
            ))}
          </div>
        </div>

        {/* Progress card */}
        <div className="bg-white rounded-2xl p-4 border border-[#D8E5F6]">
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1F2937", marginBottom: 12 }}>
            오늘의 복약 현황
          </h2>
          <div className="flex items-center gap-5">
            <svg width={88} height={88} viewBox="0 0 88 88">
              <circle cx={44} cy={44} r={36} fill="none" stroke="#EEF5FF" strokeWidth={10} />
              <circle
                cx={44}
                cy={44}
                r={36}
                fill="none"
                stroke="#2563EB"
                strokeWidth={10}
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - pct / 100)}
                strokeLinecap="round"
                transform="rotate(-90 44 44)"
              />
              <text x={44} y={49} textAnchor="middle" fill="#102A5E" fontSize={20} fontWeight={700}>
                {pct}%
              </text>
            </svg>
            <div>
              <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.6 }}>
                오늘 {total}번 중<br />
                <span style={{ fontSize: 18, fontWeight: 700, color: "#1F2937" }}>
                  {doneCount}번
                </span>{" "}
                복용했어요
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
