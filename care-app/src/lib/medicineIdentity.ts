export type MedicineShape = "capsule" | "tablet" | "bottle" | "packet";

export type MedicineIdentity = {
  shape: MedicineShape;
  paletteIndex: number;
};

// 약 이름만으로 안정적인 시각 표식을 만든다. 같은 약은 모든 화면에서 항상
// 같은 모양과 색을 받고, 별도 DB 컬럼 없이도 기존 데이터에 바로 적용된다.
export function medicineIdentity(name: string): MedicineIdentity {
  let hash = 2166136261;
  for (const char of name.trim().toLowerCase()) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  const value = hash >>> 0;
  const shapes: MedicineShape[] = ["capsule", "tablet", "bottle", "packet"];
  return {
    shape: shapes[value % shapes.length],
    paletteIndex: Math.floor(value / shapes.length) % 6,
  };
}
