import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";

interface ButtonRegisterScreenProps {
  onBack: () => void;
  onSave: () => void;
}

const timePeriods = ["아침", "점심", "저녁", "취침 전"];
const timeOptions = ["7시", "8시", "9시", "직접 설정"];
const dayOptions = ["매일", "월", "화", "수", "목", "금", "토", "일"];

export function ButtonRegisterScreen({ onBack, onSave }: ButtonRegisterScreenProps) {
  const [medicineName, setMedicineName] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("아침");
  const [selectedTime, setSelectedTime] = useState("8시");
  const [selectedDays, setSelectedDays] = useState<string[]>(["매일"]);

  const toggleDay = (day: string) => {
    if (day === "매일") {
      setSelectedDays(["매일"]);
    } else {
      const without = selectedDays.filter((d) => d !== "매일");
      if (without.includes(day)) {
        setSelectedDays(without.filter((d) => d !== day));
      } else {
        setSelectedDays([...without, day]);
      }
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 border-b border-[#D8E5F6]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#EEF5FF" }}>
            <ArrowLeft size={20} color="#2563EB" />
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#102A5E" }}>버튼으로 약 등록</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-32 flex flex-col gap-6">
        {/* 약 이름 */}
        <div>
          <label style={{ fontSize: 16, fontWeight: 700, color: "#1F2937" }}>약 이름</label>
          <input
            className="mt-2 w-full rounded-xl border border-[#D8E5F6] px-4 outline-none"
            style={{ height: 56, fontSize: 16, color: "#1F2937", background: "#F7FAFF" }}
            placeholder="예: 고혈압약"
            value={medicineName}
            onChange={(e) => setMedicineName(e.target.value)}
          />
        </div>

        {/* 복용 시간대 */}
        <div>
          <label style={{ fontSize: 16, fontWeight: 700, color: "#1F2937" }}>복용 시간대</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {timePeriods.map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className="rounded-xl py-4 flex items-center justify-center gap-2"
                style={{
                  background: selectedPeriod === period ? "#2563EB" : "#EEF5FF",
                  color: selectedPeriod === period ? "#fff" : "#64748B",
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                {selectedPeriod === period && <Check size={16} />}
                {period}
              </button>
            ))}
          </div>
        </div>

        {/* 세부 시간 */}
        <div>
          <label style={{ fontSize: 16, fontWeight: 700, color: "#1F2937" }}>세부 시간</label>
          <div className="mt-2 flex gap-2 flex-wrap">
            {timeOptions.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTime(t)}
                className="px-4 py-3 rounded-xl"
                style={{
                  background: selectedTime === t ? "#2563EB" : "#EEF5FF",
                  color: selectedTime === t ? "#fff" : "#64748B",
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 반복 요일 */}
        <div>
          <label style={{ fontSize: 16, fontWeight: 700, color: "#1F2937" }}>반복 요일</label>
          <div className="mt-2 flex gap-2 flex-wrap">
            {dayOptions.map((day) => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className="px-3 py-3 rounded-xl min-w-[48px]"
                style={{
                  background: selectedDays.includes(day) ? "#2563EB" : "#EEF5FF",
                  color: selectedDays.includes(day) ? "#fff" : "#64748B",
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#D8E5F6] px-5 py-4">
        <button
          onClick={onSave}
          className="w-full rounded-2xl flex items-center justify-center"
          style={{ background: "#2563EB", color: "#fff", height: 60, fontSize: 18, fontWeight: 700 }}
        >
          저장하기
        </button>
      </div>
    </div>
  );
}
