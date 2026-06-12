export function ttsCacheKey(text: string, speed: number): string {
  const s = `${speed}|${text}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  }
  return `tts_${(h >>> 0).toString(36)}.mp3`;
}
