import { describe, it, expect } from 'vitest';
import { shouldRequestPersistentStorage, needsBackup } from '../../src/storage/persist';

describe('shouldRequestPersistentStorage', () => {
  it('returns true when config enabled and status never checked', () => {
    expect(shouldRequestPersistentStorage(true, undefined)).toBe(true);
  });

  it('returns false when config disabled', () => {
    expect(shouldRequestPersistentStorage(false, undefined)).toBe(false);
  });

  it('returns false when already granted', () => {
    expect(shouldRequestPersistentStorage(true, true)).toBe(false);
  });

  it('returns false when already denied', () => {
    expect(shouldRequestPersistentStorage(true, false)).toBe(false);
  });
});

describe('needsBackup', () => {
  const DAY = 86_400_000
  const NOW = Date.parse('2026-09-22T12:00:00Z')

  it('returns true when lastExportAt is missing', () => {
    expect(needsBackup(undefined, 14, NOW)).toBe(true)
  })

  it('returns false when exported today (well within threshold)', () => {
    const today = new Date(NOW).toISOString()
    expect(needsBackup(today, 14, NOW)).toBe(false)
  })

  it('returns false when exported exactly 14 days ago (boundary)', () => {
    const exactly14 = new Date(NOW - 14 * DAY).toISOString()
    expect(needsBackup(exactly14, 14, NOW)).toBe(false)
  })

  it('returns true when exported 15 days ago (past threshold)', () => {
    const fifteenDaysAgo = new Date(NOW - 15 * DAY).toISOString()
    expect(needsBackup(fifteenDaysAgo, 14, NOW)).toBe(true)
  })

  it('returns true when exported exactly 14 days + 1 ms ago (just over boundary)', () => {
    const justOver = new Date(NOW - 14 * DAY - 1).toISOString()
    expect(needsBackup(justOver, 14, NOW)).toBe(true)
  })

  it('returns true when lastExportAt is empty string', () => {
    expect(needsBackup('', 14, NOW)).toBe(true)
  })

  it('returns true when lastExportAt is a corrupt string', () => {
    expect(needsBackup('not-a-date', 14, NOW)).toBe(true)
  })
});
