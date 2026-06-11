import { useState } from "react";
import { ArrowLeft, Plus, Pill } from "lucide-react";

interface MedicineListScreenProps {
  onBack: () => void;
  onAddMedicine: () => void;
}

type FilterTab = "전체" | "복용 중" | "보관 중" | "종료";

const medicines = [
  { id: 1, name: "고혈압약", schedule: "1일 1회 · 아침", status: "복용 중", color: "#EEF5FF", iconColor: "#2563EB" },
  { id: 2, name: "철분약", schedule: "1일 1회 · 저녁", status: "복용 중", color: "#E6F9F1", iconColor: "#36B37E" },
  { id: 3, name: "비타민D", schedule: "1일 1회 · 점심", status: "복용 중", color: "#FFF8ED", iconColor: "#F5A623" },
  { id: 4, name: "종합비타민", schedule: "1일 1회 · 아침", status: "복용 중", color: "#F3EEFF", iconColor: "#8B5CF6" },
];

const tabs: FilterTab[] = ["전체", "복용 중", "보관 중", "종료"];

export function MedicineListScreen({ onBack, onAddMedicine }: MedicineListScreenProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("전체");

  const filtered = activeTab === "전체" ? medicines : medicines.filter((m) => m.status === activeTab);

  return (
    <div className="relative flex flex-col h-full" style={{ background: "#F7FAFF" }}>
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 border-b border-[#D8E5F6]">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#EEF5FF" }}>
            <ArrowLeft size={20} color="#2563EB" />
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#102A5E" }}>복약 관리</h1>
        </div>
        {/* Tabs */}
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-3 py-2 rounded-xl"
              style={{
                background: activeTab === tab ? "#2563EB" : "#EEF5FF",
                color: activeTab === tab ? "#fff" : "#64748B",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 flex flex-col gap-3">
        {filtered.map(({ id, name, schedule, status, color, iconColor }) => (
          <div key={id} className="bg-white rounded-2xl p-4 border border-[#D8E5F6] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: color }}>
                <Pill size={24} color={iconColor} strokeWidth={1.8} />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#1F2937" }}>{name}</div>
                <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{schedule}</div>
              </div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#36B37E" }}>{status}</span>
          </div>
        ))}
      </div>

      {/* Bottom button */}
      <div className="absolute bottom-[72px] left-4 right-4">
        <button
          onClick={onAddMedicine}
          className="w-full rounded-2xl flex items-center justify-center gap-2"
          style={{ background: "#2563EB", color: "#fff", height: 60, fontSize: 18, fontWeight: 700 }}
        >
          <Plus size={22} />
          약 등록하기
        </button>
      </div>
    </div>
  );
}
