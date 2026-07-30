import { expect, test } from '@playwright/test'

test('student can start a daily task', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '单词闯关', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /开始今日(?:任务|学习)/ }).click()
  await expect(page.getByText(/看英文，选择中文意思|看中文，选择英文单词|根据中文意思拼写英文/)).toBeVisible()
})
