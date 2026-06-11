import { useEffect } from "react";
import { Pill } from "lucide-react";

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-white">
      <div className="flex flex-col items-center gap-6 mb-16">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{ background: "#EEF5FF" }}
        >
          <Pill size={48} color="#2563EB" strokeWidth={1.8} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#102A5E", lineHeight: 1.3 }}>
            모두의 복약
          </h1>
          <p style={{ fontSize: 16, color: "#64748B", textAlign: "center" }}>
            말로 쉽게 기록하는 복약 관리
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full animate-pulse"
            style={{
              background: i === 1 ? "#2563EB" : "#D8E5F6",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
