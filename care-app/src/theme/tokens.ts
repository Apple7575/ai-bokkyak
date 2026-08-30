// 팔레트 — 파랑 계열 (PM 결정 2026-08-27: 디자인 시안 V8의 옛 파랑을 유지).
// 딥틸·코랄 팔레트는 git 이력(11d0b1e 이전)에 있다.
export const colors = {
  primaryNavy: "#102A5E",
  primaryBlue: "#2563EB",
  secondaryBlue: "#4F8EF7",
  lightBlueBg: "#EEF5FF",
  cardBg: "#FFFFFF",
  border: "#D8E5F6",
  text: "#1F2937",
  textSecondary: "#64748B",
  successGreen: "#36B37E",
  warningOrange: "#F5A623",
  dangerRed: "#E25353",
  conditionPurple: "#8B5CF6",
  canvas: "#F4F7FB",
  canvasMuted: "#E8EEF7",
  surfaceRaised: "#FFFFFF",
  primarySoft: "#EBF2FF",
  // 리디자인에서 생긴 보조 강조색 자리 — 옛 파랑 디자인에는 파랑 외 강조색이 없었으므로
  // 전부 파랑 계열로 되돌린다. (coral/sage = 파랑, sunshine = 기존 warningOrange)
  coral: "#2563EB",
  coralSoft: "#EEF5FF",
  sage: "#4F8EF7",
  sageSoft: "#EEF5FF",
  sunshine: "#F5A623",
  sunshineSoft: "#FFF4DF",
  white: "#FFFFFF",
  overlay: "rgba(16,42,94,0.12)",
  overlayStrong: "rgba(16,42,94,0.28)",
  dangerSoft: "#FCEBE7",
  warningSoft: "#FEF3E2",
  successSoft: "#E7F6EE",
  kakao: "#FEE500",
  kakaoInk: "#3C1E1E",
  kakaoShadow: "#B9A100",
} as const;

export const fontSizes = {
  body: 18,
  emphasis: 22,
  title: 24,
  hero: 40,
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 40 } as const;
export const radii = { small: 12, card: 24, button: 18, hero: 32, pill: 999 } as const;
export const minTouch = 56;
// 탭바가 position:absolute 라 탭 화면 스크롤 하단에 이만큼 여백을 둬야 마지막 카드가 가려지지 않는다.
export const tabBarClearance = 112;

export const shadows = {
  card: {
    shadowColor: colors.primaryNavy,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  floating: {
    shadowColor: colors.primaryNavy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 7,
  },
} as const;
