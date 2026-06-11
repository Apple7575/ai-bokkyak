import { Audio } from "expo-av";
import { whisperTranscribe } from "./openai";

// Swappable interface: replace this file to upgrade the STT model later.
let recording: Audio.Recording | null = null;

export async function startRecording(): Promise<void> {
  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  const { recording: rec } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );
  recording = rec;
}

export async function stopAndTranscribe(): Promise<string> {
  if (!recording) return "";
  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  recording = null;
  if (!uri) return "";
  return whisperTranscribe(uri);
}
