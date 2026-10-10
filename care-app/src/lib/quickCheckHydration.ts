export type HydrationGate = {
  succeed(): void;
  fail(): void;
  isReady(): boolean;
  runWhenReady(work: () => void | Promise<void>): Promise<boolean>;
};

export function createHydrationGate(): HydrationGate {
  let settled = false;
  let ready = false;
  let resolve!: (value: boolean) => void;
  const result = new Promise<boolean>((done) => { resolve = done; });

  const settle = (value: boolean) => {
    if (settled) return;
    settled = true;
    ready = value;
    resolve(value);
  };

  return {
    succeed: () => settle(true),
    fail: () => settle(false),
    isReady: () => ready,
    runWhenReady: async (work) => {
      if (!(await result)) return false;
      await work();
      return true;
    },
  };
}
