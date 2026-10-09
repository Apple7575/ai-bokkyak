export type LocalAlarmAction = {
  stop: () => Promise<void>;
  afterStop?: () => Promise<unknown>;
  persist: () => Promise<void>;
};

export type LocalAlarmActionResult =
  | { persisted: true }
  | { persisted: false; error: unknown };

// Complete device-local alarm control before attempting network persistence.
// A server failure must not undo or block the user's stop/snooze action.
export async function runLocalAlarmAction(
  action: LocalAlarmAction,
): Promise<LocalAlarmActionResult> {
  await action.stop();
  if (action.afterStop) await action.afterStop();
  try {
    await action.persist();
    return { persisted: true };
  } catch (error) {
    return { persisted: false, error };
  }
}
