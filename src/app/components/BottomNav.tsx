import { Home, Pill, Bell, BookOpen, MoreHorizontal } from "lucide-react";

export type TabName = "home" | "medicine" | "alarm" | "record" | "more";

interface BottomNavProps {
  active: TabName;
  onTabChange: (tab: TabName) => void;
}

const tabs: { id: TabName; icon: React.FC<{ size?: number; strokeWidth?: number }>; label: string }[] = [
  { id: "home", icon: Home, label: "홈" },
  { id: "medicine", icon: Pill, label: "복약" },
  { id: "alarm", icon: Bell, label: "알림" },
  { id: "record", icon: BookOpen, label: "기록" },
  { id: "more", icon: MoreHorizontal, label: "더보기" },
];

export function BottomNav({ active, onTabChange }: BottomNavProps) {
  return (
    <nav className="w-full bg-white border-t border-[#D8E5F6] flex z-50">
      {tabs.map(({ id, icon: Icon, label }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1 min-h-[56px]"
            style={{ color: isActive ? "#2563EB" : "#64748B" }}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
            <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 400 }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
