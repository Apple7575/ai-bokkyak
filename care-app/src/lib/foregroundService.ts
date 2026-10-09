// Notifee 9.1.8 declares its Android foreground service as shortService.
// Finish below Android's roughly three-minute limit even if the user ignores
// the alarm. Notification repeat delivery is capped at 150 seconds.
export const FOREGROUND_SERVICE_MAX_MS = 165_000;

export function foregroundServiceLifetime(
  setTimer: (callback: () => void, delay: number) => unknown = setTimeout,
): Promise<void> {
  return new Promise((resolve) => {
    setTimer(resolve, FOREGROUND_SERVICE_MAX_MS);
  });
}
