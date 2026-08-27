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
  textSecondary: "#5B6B82",   // 흰 바탕 5.5:1, 연한 파랑 바탕에서도 4.9:1
  successGreen: "#1F8A56",    // 흰 글씨 4.6:1
  warningOrange: "#D97706",
  dangerRed: "#D9463A",       // 흰 글씨 4.6:1
  conditionPurple: "#8B5CF6",
  canvas: "#F4F7FB",
  canvasMuted: "#E8EEF7",
  surfaceRaised: "#FFFFFF",
  primarySoft: "#EBF2FF",
  // 강조색(코랄 자리) — 파랑 팔레트에서는 진한 주황을 쓴다. 흰 글씨 4.5:1.
  coral: "#C2410C",
  coralSoft: "#FEF0E6",
  sage: "#8FB4F7",
  sageSoft: "#EAF1FE",
  sunshine: "#D97706",
  sunshineSoft: "#FEF3E2",
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
