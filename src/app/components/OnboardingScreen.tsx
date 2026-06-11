import { useState } from "react";
import { Mic, CheckCircle, Users } from "lucide-react";

interface OnboardingScreenProps {
  onDone: () => void;
}

const slides = [
  {
    Icon: Mic,
    title: "약 먹을 시간이 되면\n음성으로 알려드려요",
    color: "#2563EB",
    bg: "#EEF5FF",
  },
  {
    Icon: CheckCircle,
    title: '"먹었어요"라고 말하면\n자동으로 기록돼요',
    color: "#36B37E",
    bg: "#E6F9F1",
  },
  {
    Icon: Users,
    title: "보호자도 복약 여부를\n함께 확인할 수 있어요",
    color: "#8B5CF6",
    bg: "#F3EEFF",
  },
];

export function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const [current, setCurrent] = useState(0);

  const handleNext = () => {
    if (current < slides.length - 1) {
      setCurrent(current + 1);
    } else {
      onDone();
    }
  };

  const slide = slides[current];

  return (
    <div className="flex flex-col h-full bg-white px-6">
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div
          className="w-32 h-32 rounded-full flex items-center justify-center"
          style={{ background: slide.bg }}
        >
          <slide.Icon size={60} color={slide.color} strokeWidth={1.5} />
        </div>
        <p
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#1F2937",
            textAlign: "center",
            lineHeight: 1.5,
            whiteSpace: "pre-line",
          }}
        >
          {slide.title}
        </p>
        <div className="flex gap-2 mt-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === current ? 24 : 8,
                height: 8,
                background: i === current ? "#2563EB" : "#D8E5F6",
              }}
            />
          ))}
        </div>
      </div>
      <div className="pb-10">
        <button
          onClick={handleNext}
          className="w-full rounded-2xl flex items-center justify-center"
          style={{
            background: "#2563EB",
            color: "#fff",
            height: 60,
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          {current < slides.length - 1 ? "다음" : "시작하기"}
        </button>
      </div>
    </div>
  );
}
