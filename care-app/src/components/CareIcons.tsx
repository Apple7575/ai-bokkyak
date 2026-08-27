import React from "react";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

type IconProps = { size?: number; color: string; accent?: string };

const strokeProps = {
  fill: "none",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function CareHomeIcon({ size = 28, color, accent = color }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path d="M7 22.5 24 8l17 14.5V40H29V29H19v11H7Z" stroke={color} strokeWidth={4} {...strokeProps} />
    <Circle cx="36" cy="13" r="4" fill={accent} />
  </Svg>;
}

export function CareCabinetIcon({ size = 28, color, accent = color }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 48 48">
    <Rect x="7" y="8" width="34" height="33" rx="7" stroke={color} strokeWidth={4} {...strokeProps} />
    <Line x1="24" y1="9" x2="24" y2="40" stroke={color} strokeWidth={3} strokeLinecap="round" />
    <Circle cx="19" cy="25" r="2.5" fill={accent} />
    <Circle cx="29" cy="25" r="2.5" fill={accent} />
    <Path d="M14 16h6M28 16h6" stroke={color} strokeWidth={3} {...strokeProps} />
  </Svg>;
}

export function CareRecordIcon({ size = 28, color, accent = color }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 48 48">
    <Rect x="10" y="9" width="28" height="33" rx="6" stroke={color} strokeWidth={4} {...strokeProps} />
    <Rect x="17" y="5" width="14" height="8" rx="4" fill={accent} />
    <Path d="m17 24 3 3 6-7M29 24h4M17 34h16" stroke={color} strokeWidth={3} {...strokeProps} />
  </Svg>;
}

export function CareMoreIcon({ size = 28, color, accent = color }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 48 48">
    {[13, 24, 35].map((y, i) => <React.Fragment key={y}>
      <Circle cx="10" cy={y} r={i === 1 ? 3.5 : 3} fill={i === 1 ? accent : color} />
      <Path d={`M19 ${y}h20`} stroke={color} strokeWidth="4" strokeLinecap="round" />
    </React.Fragment>)}
  </Svg>;
}

export function CareCheckIcon({ size = 48, color, accent = color }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 48 48">
    <Circle cx="24" cy="24" r="18" fill={color} />
    <Path d="m15 24 6 6 13-14" stroke={accent} strokeWidth={5} {...strokeProps} />
    <Path d="M39 7v6M36 10h6" stroke={color} strokeWidth={3} {...strokeProps} />
  </Svg>;
}

export function CareMedicineGlyph({ size = 36, color, accent = color, shape = "capsule" }: IconProps & { shape?: "capsule" | "tablet" | "bottle" | "packet" }) {
  if (shape === "tablet") return <Svg width={size} height={size} viewBox="0 0 48 48">
    <Circle cx="24" cy="24" r="16" fill={accent} stroke={color} strokeWidth={3} />
    <Path d="M14 34 34 14" stroke={color} strokeWidth={3} strokeLinecap="round" />
    <Circle cx="18" cy="18" r="2.5" fill={color} />
  </Svg>;
  if (shape === "bottle") return <Svg width={size} height={size} viewBox="0 0 48 48">
    <Rect x="16" y="6" width="16" height="8" rx="3" fill={color} />
    <Rect x="12" y="13" width="24" height="29" rx="7" fill={accent} stroke={color} strokeWidth={3} />
    <Path d="M18 27h12M24 21v12" stroke={color} strokeWidth={3} {...strokeProps} />
  </Svg>;
  if (shape === "packet") return <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path d="M12 7h24l3 35H9Z" fill={accent} stroke={color} strokeWidth={3} strokeLinejoin="round" />
    <Path d="M12 14h24M18 27h12" stroke={color} strokeWidth={3} {...strokeProps} />
    <Circle cx="24" cy="27" r="6" fill={accent} stroke={color} strokeWidth={2.5} />
  </Svg>;
  return <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path d="M12 36a10 10 0 0 1 0-14L22 12a10 10 0 0 1 14 14L26 36a10 10 0 0 1-14 0Z" fill={accent} stroke={color} strokeWidth={3} />
    <Path d="m17 17 14 14" stroke={color} strokeWidth={3} strokeLinecap="round" />
    <Path d="M12 22 22 12a10 10 0 0 1 7-3l10 10a10 10 0 0 1-3 7L26 36Z" fill={color} opacity={0.18} />
  </Svg>;
}
