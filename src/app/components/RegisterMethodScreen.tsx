import { ArrowLeft, Mic, LayoutList, Camera, ChevronRight } from "lucide-react";

interface RegisterMethodScreenProps {
  onBack: () => void;
  onVoice: () => void;
  onButton: () => void;
  onNext: () => void;
}

export function RegisterMethodScreen({ onBack, onVoice, onButton }: RegisterMethodScreenProps) {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 border-b border-[#D8E5F6]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#EEF5FF" }}>
            <ArrowLeft size={20} color="#2563EB" />
          </button>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1F2937", marginTop: 20, lineHeight: 1.3 }}>
          어떻게 약을 등록할까요?
        </h1>
        <p style={{ fontSize: 15, color: "#64748B", marginTop: 4 }}>원하는 방법을 선택해 주세요.</p>
      </div>

      <div className="flex-1 px-5 pt-6 flex flex-col gap-4">
        {/* Voice - Primary */}
        <button
          onClick={onVoice}
          className="w-full rounded-2xl p-5 flex items-center gap-4 relative"
          style={{ background: "#2563EB", color: "#fff" }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
            <Mic size={28} color="#fff" />
          </div>
          <div className="flex-1 text-left">
            <div style={{ fontSize: 18, fontWeight: 700 }}>음성으로 간편 등록</div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 3 }}>말씀해 주시면 자동으로 입력해 드려요</div>
          </div>
          <ChevronRight size={20} color="#fff" />
        </button>

        {/* Button */}
        <button
          onClick={onButton}
          className="w-full rounded-2xl p-5 flex items-center gap-4 border border-[#D8E5F6]"
          style={{ background: "#fff" }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#EEF5FF" }}>
            <LayoutList size={28} color="#2563EB" />
          </div>
          <div className="flex-1 text-left">
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1F2937" }}>버튼으로 직접 등록</div>
            <div style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>항목을 하나씩 눌러 등록할 수 있어요</div>
          </div>
          <ChevronRight size={20} color="#64748B" />
        </button>

        {/* Camera */}
        <button
          className="w-full rounded-2xl p-5 flex items-center gap-4 border border-[#D8E5F6] relative opacity-70"
          style={{ background: "#fff" }}
          disabled
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#F7FAFF" }}>
            <Camera size={28} color="#64748B" />
          </div>
          <div className="flex-1 text-left">
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1F2937" }}>사진으로 등록</div>
            <div style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>약 봉투나 약 포장을 촬영해 주세요</div>
          </div>
          <span
            className="px-2 py-1 rounded-full"
            style={{ background: "#F3EEFF", color: "#8B5CF6", fontSize: 11, fontWeight: 600 }}
          >
            준비 중
          </span>
        </button>
      </div>

      <div className="px-5 pb-10">
        <button
          onClick={onVoice}
          className="w-full rounded-2xl flex items-center justify-center"
          style={{ background: "#EEF5FF", color: "#2563EB", height: 56, fontSize: 17, fontWeight: 700 }}
        >
          다음
        </button>
      </div>
    </div>
  );
}
