import assert from 'node:assert/strict'
import { calculateDateRangeSummary, calculateReportTotals, calculateStock, countDaysInclusive, getLowStockItems, getMonthRange, getReportStreak, getWeekRange } from '../src/calculations.ts'
import { expenseTypes, seedData } from '../src/data.ts'
import { dailyReportsRows, expensesRows, monthlySummaryRows, pricingRows, stockMovementRows, stockRows } from '../src/exporters.ts'
import { calculateBusinessXp, calculateReportXp, getAchievements, getBusinessHealth, getBusinessStreaks, getInventoryCards, getLevelProgress, getProductPerformance } from '../src/gamification.ts'
import { parseDailyReportText } from '../src/parser.ts'
import { normalizeData } from '../src/storage.ts'
import type { DailyReport } from '../src/types.ts'

const approx = (actual: number, expected: number, message: string) => assert(Math.abs(actual - expected) < 0.001, message)

const exampleReport = seedData.dailyReports.find((report) => report.date === '2026-05-23')
assert(exampleReport, 'Seed report for 2026-05-23 should exist')

const exampleTotals = calculateReportTotals(exampleReport, seedData.products, seedData.expenses, seedData.settings)
assert.equal(exampleTotals.totalRevenue, 4060, '23/05/2026 report revenue should be 4.060 kr.')
approx(exampleTotals.netRevenue, 3248, '23/05/2026 report revenue ex. moms should be 3.248 kr.')
approx(exampleTotals.outputVat, 812, '23/05/2026 report sales moms should be 812 kr.')
approx(exampleTotals.vatPayable, 812, '23/05/2026 VAT payable should be 812 kr. with no deductible purchase VAT')
approx(exampleTotals.netProfit, 3248, '23/05/2026 net profit ex. moms should be 3.248 kr. before costs and expenses')

const may24Report = seedData.dailyReports.find((report) => report.date === '2026-05-24')
assert(may24Report, 'Seed report for 2026-05-24 should exist')
const may24Totals = calculateReportTotals(may24Report, seedData.products, seedData.expenses, seedData.settings)
assert.equal(may24Totals.totalRevenue, 4255, '24/05/2026 report revenue should be 4.255 kr.')

assert.deepEqual(getMonthRange('2026-05-23'), { start: '2026-05-01', end: '2026-05-31' }, 'Month range should use local calendar dates')
assert.deepEqual(getWeekRange('2026-05-23'), { start: '2026-05-18', end: '2026-05-24' }, 'Week range should run Monday to Sunday')
assert.equal(countDaysInclusive('2026-05-18', '2026-05-24'), 7, 'Inclusive day count should support dashboard goals')
assert.equal(getReportStreak(seedData.dailyReports, '2026-05-23'), 1, 'Report streak should count consecutive report days')
assert.equal(getReportStreak(seedData.dailyReports, '2026-05-24'), 2, 'Report streak should count both known May reports')
assert.equal(calculateDateRangeSummary(seedData, '2026-05-18', '2026-05-24').totalRevenue, 8315, 'Date range dashboard summary should include both known May reports')
assert.equal(seedData.settings.dailyRevenueGoal, 800, 'Seed settings should include the 800 kr. daily sales goal')
const seedXp = calculateBusinessXp(seedData)
assert(seedXp > 0, 'Business XP should be earned from seeded reports')
assert.equal(calculateReportXp(exampleTotals), 495, 'Daily report XP should include report, items, profit, revenue milestones, and stock control')
assert.equal(getLevelProgress(seedXp).level, 3, 'Known May reports should move IsVognen to Harbor Hit')
assert.equal(getBusinessStreaks(seedData, '2026-05-23').report, 1, 'Gamified report streak should use saved sales reports')
assert(getAchievements(seedData, getLevelProgress(seedXp)).some((achievement) => achievement.id === 'first-sale' && achievement.unlocked), 'First Sale achievement should unlock from seed report')
assert(getAchievements(seedData, getLevelProgress(seedXp)).some((achievement) => achievement.id === 'first-report' && achievement.unlockDate === '2026-05-23'), 'First Report achievement should include an unlock date')
assert(getAchievements(seedData, getLevelProgress(seedXp)).some((achievement) => achievement.id === 'revenue-1000' && achievement.unlockDate === '2026-05-23'), 'Revenue achievements should derive unlock dates from reports')
assert.equal(getBusinessHealth(seedData, calculateDateRangeSummary(seedData, '2026-05-18', '2026-05-24'), '2026-05-18', '2026-05-24').score > 0, true, 'Business health should calculate a positive score')
assert(getProductPerformance(seedData, '2026-05-18', '2026-05-24', '2026-05-23').some((entry) => entry.badge === 'Best Seller'), 'Product performance should identify a best seller')
assert(getInventoryCards(seedData).some((entry) => entry.status === 'out' || entry.status === 'critical' || entry.status === 'low'), 'Inventory cards should surface urgent stock states')
assert.equal(normalizeData({ settings: { ...seedData.settings, dailyRevenueGoal: 4000, shopQuestGoalVersion: 0 } }).settings.dailyRevenueGoal, 800, 'Old saved IsVognen goal should migrate to 800 kr.')
assert.equal(normalizeData({ settings: { ...seedData.settings, dailyRevenueGoal: 1200, shopQuestGoalVersion: 1 } }).settings.dailyRevenueGoal, 1200, 'User-edited current goal should be preserved')
assert(normalizeData({ dailyReports: [exampleReport] }).dailyReports.some((report) => report.date === '2026-05-24'), 'Known May reports should migrate into existing saved data')
assert(expenseTypes.includes('Cash register system'), 'Expense types should include cash register system')
assert(seedData.recurringExpenses.some((expense) => expense.type === 'Cash register system'), 'Seed data should include a monthly cash register expense template')
const expenseOnlySummary = calculateDateRangeSummary(
  { ...seedData, dailyReports: [], expenses: [{ id: 'expense-test', date: '2026-05-27', type: 'Other', description: 'Test', amount: 250, paymentMethod: 'Card', notes: '' }] },
  '2026-05-27',
  '2026-05-27',
)
assert.equal(expenseOnlySummary.expenses, 250, 'Dashboard range should not double count expense-only dates')

const changedReport: DailyReport = {
  ...exampleReport,
  items: exampleReport.items.map((item) => (item.productId === 'drys' ? { ...item, quantity: 4 } : item)),
}
const changedTotals = calculateReportTotals(changedReport, seedData.products, seedData.expenses, seedData.settings)
assert.equal(changedTotals.totalRevenue, 4067, 'Changing Drys from 3 to 4 should add 7 kr.')
approx(changedTotals.outputVat, 813.4, 'Changing Drys from 3 to 4 should update sales moms')

const lowStock = getLowStockItems(seedData)
assert(lowStock.some(({ item }) => item.id === 'stock-drys'), 'Drys stock should show an Order soon alert')

const gufStock = seedData.stockItems.find((item) => item.id === 'stock-guf')
assert(gufStock, 'Guf stock item should exist')
assert.equal(calculateStock(gufStock, seedData.dailyReports).currentStock, 20, 'Guf stock should follow known Guf sales')
assert.equal(
  calculateStock(gufStock, seedData.dailyReports, [
    { id: 'test-received', stockItemId: 'stock-guf', date: '2026-05-24', type: 'Received', quantity: 10, notes: '' },
    { id: 'test-waste', stockItemId: 'stock-guf', date: '2026-05-24', type: 'Waste', quantity: 2, notes: '' },
  ]).currentStock,
  28,
  'Stock movement history should adjust current stock',
)

const parsed = parseDailyReportText('24/05: Alm. Softice 12, 1 Kugle 8, 2 Kugler 5, Guf 4, Drys 3, expenses 250 kr ice cream purchase', seedData)
const parsedTotals = calculateReportTotals(parsed.report, seedData.products, parsed.expenses, seedData.settings)
assert.equal(parsed.report.date, '2026-05-24', 'Parser should infer current year for 24/05')
assert.equal(parsedTotals.totalRevenue, 1135, 'Parsed sample report should calculate revenue')
assert.equal(parsed.expenses[0]?.amount, 250, 'Parser should capture expense amount')

assert(dailyReportsRows(seedData).length > 0, 'Daily reports CSV rows should be generated')
assert('outputVat' in dailyReportsRows(seedData)[0], 'Daily reports CSV should include VAT columns')
assert(pricingRows(seedData).length === seedData.products.length, 'Pricing CSV rows should include all products')
assert('profitPerSaleExVat' in pricingRows(seedData)[0], 'Pricing CSV should calculate profit ex. moms')
assert(Array.isArray(expensesRows(seedData)), 'Expenses CSV rows should be generated')
assert(stockRows(seedData).some((row) => row.reorderAlert === 'Order soon'), 'Stock CSV rows should include reorder alerts')
assert(stockRows(seedData).some((row) => 'stockValue' in row && 'costPerUnit' in row), 'Stock CSV rows should include inventory value fields')
assert(Array.isArray(stockMovementRows(seedData)), 'Stock movement CSV rows should be generated')
assert(monthlySummaryRows({
  ...exampleTotals,
  month: '2026-05',
  bestSellingProduct: '1 Kugle',
  averageProfitMargin: 1,
  dailyRevenue: [],
  productBreakdown: [],
  expenseBreakdown: [],
}).length > 0, 'Monthly summary CSV rows should be generated')

console.log('Logic checks passed')
