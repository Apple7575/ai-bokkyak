import * as Speech from "expo-speech";

// Swappable interface: replace this file to upgrade the TTS model later.
export function speak(text: string, opts?: { rate?: number }): void {
  Speech.stop();
  Speech.speak(text, { language: "ko-KR", rate: opts?.rate ?? 0.85 });
}
export function stopSpeaking(): void {
  Speech.stop();
}
