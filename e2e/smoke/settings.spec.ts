import { test, expect } from '../support/fixtures.ts'
import { S } from '../support/app.ts'
import { readProgress } from '../support/storage.ts'

test.describe('settings', () => {
  test('shows version info and backup status', async ({ app }) => {
    await app.goto()
    await app.openSettings()
    await expect(app.versionInfo()).toContainText(S.SETTINGS_VERSION_APP(''))
    await expect(app.versionInfo()).toContainText(S.SETTINGS_VERSION_COMMIT(''))
    await expect(app.versionInfo()).toContainText(S.SETTINGS_VERSION_CONTENT(''))
    await expect(app.page.getByText(S.SETTINGS_LAST_BACKUP(undefined))).toBeVisible()
  })

  test('a changed setting survives a reload', async ({ app }) => {
    await app.goto()
    await app.openSettings()
    const field = app.page.getByLabel(S.SETTINGS_NEW_ITEMS_PER_LESSON)
    // Stay within the field's range, whatever the defaults in config/app.json are
    const value = Number(await field.inputValue())
    const next = String(value < Number(await field.getAttribute('max')) ? value + 1 : value - 1)
    await field.fill(next)
    await expect.poll(async () => (await readProgress(app.page))?.settings.newItemsPerLesson).toBe(Number(next))

    await app.reload()
    await app.openSettings()
    await expect(app.page.getByLabel(S.SETTINGS_NEW_ITEMS_PER_LESSON)).toHaveValue(next)
  })

  test('unlock all asks for confirmation and can be switched back', async ({ app }) => {
    await app.goto()
    await app.openSettings()
    app.acceptNextConfirm()
    await app.unlockSwitch().click()
    await expect(app.unlockSwitch()).toHaveAttribute('aria-checked', 'true')
    await expect(app.page.getByText(S.SETTINGS_UNLOCK_ON)).toBeVisible()
    await app.unlockSwitch().click()
    await expect(app.unlockSwitch()).toHaveAttribute('aria-checked', 'false')
    await expect(app.page.getByText(S.SETTINGS_UNLOCK_OFF)).toBeVisible()
  })
})
