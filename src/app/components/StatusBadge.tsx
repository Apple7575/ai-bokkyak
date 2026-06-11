import { CheckCircle2, Clock, XCircle } from "lucide-react";

export type StatusType = "done" | "upcoming" | "missed" | "remind";

const config: Record<StatusType, { label: string; color: string; bg: string; Icon: React.FC<{ size?: number }> }> = {
  done: { label: "복용 완료", color: "#36B37E", bg: "#E6F9F1", Icon: CheckCircle2 },
  upcoming: { label: "복용 예정", color: "#2563EB", bg: "#EEF5FF", Icon: Clock },
  missed: { label: "미복용", color: "#E25353", bg: "#FFF0F0", Icon: XCircle },
  remind: { label: "30분 뒤 복용", color: "#F5A623", bg: "#FFF8ED", Icon: Clock },
};

export function StatusBadge({ status }: { status: StatusType }) {
  const { label, color, bg, Icon } = config[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full"
      style={{ background: bg, color }}
    >
      <Icon size={13} />
      <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
    </span>
  );
}
