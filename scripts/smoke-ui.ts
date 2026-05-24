import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'commit', timeout: 10000 })
await page.getByRole('button', { name: 'Dashboard' }).waitFor({ timeout: 20000 })
await page.getByRole('button', { name: 'Daily Report' }).click()
await page.locator('input[type="date"]').fill('2026-05-23')

await page.getByText('Total revenue').waitFor()
const text = async () => ((await page.textContent('body')) ?? '').replace(/\s+/g, ' ')
assert((await text()).includes('4.060,00 kr.'), 'Seeded 23/05/2026 revenue should show 4.060,00 kr.')
assert((await text()).includes('812,00 kr.'), 'Seeded 23/05/2026 sales VAT should show 812,00 kr.')

const drysRow = page.locator('tr').filter({ hasText: 'Drys' })
await drysRow.locator('input[type="number"]').first().fill('4')
assert((await text()).includes('4.067,00 kr.'), 'Changing Drys quantity should update total revenue')

await page.getByRole('button', { name: 'Stock' }).click()
assert((await page.textContent('body'))?.includes('Order soon'), 'Low stock should show Order soon')
await page.getByRole('button', { name: 'Add ice cream tub' }).click()
const stockNames = await page.locator('tbody tr td:first-child input').evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).value))
assert(stockNames.includes('Vanilje ice cream tub'), 'Stock should allow adding ice cream tub variations')

await page.getByRole('button', { name: 'Export' }).click()
const csvDownload = page.waitForEvent('download')
await page.getByRole('button', { name: 'Daily reports CSV' }).click()
assert((await csvDownload).suggestedFilename().endsWith('.csv'), 'Daily report CSV should download')

const xlsxDownload = page.waitForEvent('download')
await page.getByRole('button', { name: 'Workbook XLSX' }).click()
assert((await xlsxDownload).suggestedFilename().endsWith('.xlsx'), 'Workbook XLSX should download')

await browser.close()
console.log('UI smoke checks passed')
