export const colors = {
  primaryNavy: "#183B3A",
  primaryBlue: "#176B68",
  secondaryBlue: "#4D938D",
  lightBlueBg: "#EAF4F1",
  cardBg: "#FFFDF8",
  border: "#D7E2DC",
  text: "#20302E",
  textSecondary: "#60716D",
  successGreen: "#2D7D64",
  warningOrange: "#D77A3E",
  dangerRed: "#C94F4F",
  conditionPurple: "#7967A8",
  canvas: "#F7F3EA",
  canvasMuted: "#EEE8DC",
  surfaceRaised: "#FFFFFF",
  primarySoft: "#DDEEE9",
  coral: "#E88766",
  coralSoft: "#FBE7DD",
  sage: "#9DB7A7",
  sageSoft: "#E8F0E8",
  sunshine: "#E7B95C",
  sunshineSoft: "#FCF1D6",
  white: "#FFFFFF",
  overlay: "rgba(24,59,58,0.12)",
  overlayStrong: "rgba(24,59,58,0.24)",
  dangerSoft: "#FBE8E5",
  warningSoft: "#FCF0DF",
  successSoft: "#E4F2EB",
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
