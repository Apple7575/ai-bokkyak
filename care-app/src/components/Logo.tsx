import React from "react";
import { Image } from "react-native";

// 브랜드 로고 이미지(엠블럼 + "모두의 복약" 워드마크 포함). 정사각형.
const LOGO = require("../../assets/logo.png");

// showWordmark는 호환을 위해 남겨두지만, 로고 이미지에 워드마크가 포함돼 있어 별도 텍스트는 렌더하지 않는다.
export function Logo({ size = 64 }: { size?: number; showWordmark?: boolean }) {
  return <Image source={LOGO} style={{ width: size, height: size }} resizeMode="contain" />;
}
