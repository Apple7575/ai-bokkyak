import { FOREGROUND_SERVICE_MAX_MS, foregroundServiceLifetime } from "../lib/foregroundService";

describe("foregroundServiceLifetime", () => {
  it("registers a bounded lifetime below three minutes", async () => {
    let callback: (() => void) | undefined;
    let delay = 0;
    const lifetime = foregroundServiceLifetime((cb, ms) => {
      callback = cb;
      delay = ms;
      return 1;
    });

    expect(delay).toBe(FOREGROUND_SERVICE_MAX_MS);
    expect(delay).toBeLessThan(180_000);
    callback?.();
    await expect(lifetime).resolves.toBeUndefined();
  });
});
