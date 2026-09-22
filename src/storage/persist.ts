export function shouldRequestPersistentStorage(
  requestPersistentStorage: boolean,
  persistGranted: boolean | undefined
): boolean {
  return requestPersistentStorage && persistGranted === undefined;
}

export function needsBackup(
  lastExportAt: string | undefined,
  reminderDays: number,
  now: number = Date.now()
): boolean {
  if (!lastExportAt) return true
  const parsed = Date.parse(lastExportAt)
  if (isNaN(parsed)) return true
  return now - parsed > reminderDays * 86_400_000
}
