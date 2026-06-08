import { expect, test } from '@playwright/test'

test('student can start a daily task', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /单词闯关/ })).toBeVisible()
  await page.getByRole('button', { name: /开始今日任务/ }).click()
  await expect(page.getByText(/选择题|拼写题/)).toBeVisible()
})
