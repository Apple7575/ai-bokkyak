import React from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import { fontFamilyForWeight } from "./fonts";

// 앱 전체 글꼴을 Pretendard로 바꾼다.
//
// 화면이 24개인데 StyleSheet마다 fontFamily를 적어 넣는 것은 현실적이지 않고,
// 빠뜨린 화면만 시스템 폰트로 남아 티가 난다. 그래서 Text/TextInput의 render를
// 한 번 감싸서, 스타일에 들어 있는 fontWeight를 보고 알맞은 파일을 붙여 준다.
//
// React 19에서 Text.defaultProps 는 사라졌으므로 그 방식은 쓸 수 없다.
//
// 되돌리려면 App.tsx의 호출 한 줄만 지우면 된다.

let applied = false;

export function applyPretendard(): void {
  if (applied) return;          // Fast Refresh로 두 번 감싸지 않게
  applied = true;

  for (const Comp of [Text, TextInput] as any[]) {
    const original = Comp.render;
    if (typeof original !== "function") continue;

    Comp.render = function patched(...args: any[]) {
      const el = original.apply(this, args);
      if (!React.isValidElement(el)) return el;

      const style = (el.props as any).style;
      const flat = StyleSheet.flatten(style) ?? {};
      const fontFamily = fontFamilyForWeight(flat.fontWeight as any);

      // 굵기별로 파일이 따로이므로 fontWeight는 넘기지 않는다.
      // 남겨 두면 iOS가 그 위에 가짜 굵게를 한 번 더 씌워 뭉개진다.
      return React.cloneElement(el as any, {
        style: [style, { fontFamily, fontWeight: undefined }],
      });
    };
  }
}
