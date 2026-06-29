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

const may25Report = seedData.dailyReports.find((report) => report.date === '2026-05-25')
assert(may25Report, 'Seed report for 2026-05-25 should exist')
const may25Totals = calculateReportTotals(may25Report, seedData.products, seedData.expenses, seedData.settings)
assert.equal(may25Totals.totalRevenue, 576, '25/05/2026 report revenue should be 576 kr.')

const ytdAdjustmentReport = seedData.dailyReports.find((report) => report.date === '2026-06-29')
assert(ytdAdjustmentReport, 'Year-to-date adjustment report for 2026-06-29 should exist')
const ytdAdjustmentTotals = calculateReportTotals(ytdAdjustmentReport, seedData.products, seedData.expenses, seedData.settings)
assert.equal(ytdAdjustmentTotals.totalRevenue, 17247, 'YTD adjustment report should fill the missing 17.247 kr.')
assert.equal(ytdAdjustmentTotals.totalItems, 558, 'YTD adjustment report should fill the missing 558 items')

assert.deepEqual(getMonthRange('2026-05-23'), { start: '2026-05-01', end: '2026-05-31' }, 'Month range should use local calendar dates')
assert.deepEqual(getWeekRange('2026-05-23'), { start: '2026-05-18', end: '2026-05-24' }, 'Week range should run Monday to Sunday')
assert.deepEqual(getWeekRange('2026-05-25'), { start: '2026-05-25', end: '2026-05-31' }, 'New week should start on Monday for 25/05/2026')
assert.equal(countDaysInclusive('2026-05-18', '2026-05-24'), 7, 'Inclusive day count should support dashboard goals')
assert.equal(getReportStreak(seedData.dailyReports, '2026-05-23'), 1, 'Report streak should count consecutive report days')
assert.equal(getReportStreak(seedData.dailyReports, '2026-05-24'), 2, 'Report streak should count both known May reports')
assert.equal(getReportStreak(seedData.dailyReports, '2026-05-25'), 3, 'Report streak should count all three known May reports')
assert.equal(calculateDateRangeSummary(seedData, '2026-05-18', '2026-05-24').totalRevenue, 8315, 'Date range dashboard summary should include both known May reports')
assert.equal(calculateDateRangeSummary(seedData, '2026-05-01', '2026-05-31').totalRevenue, 8891, 'May dashboard summary should include 23/05, 24/05, and 25/05')
const yearToDateSummary = calculateDateRangeSummary(seedData, '2026-01-01', '2026-06-29')
assert.equal(yearToDateSummary.totalRevenue, 26138, '2026 year-to-date summary should match POS revenue')
assert.equal(yearToDateSummary.totalItems, 803, '2026 year-to-date summary should match POS item count')
approx(yearToDateSummary.expenses, 10817.26, '2026 year-to-date summary should include product purchases incl. moms')
approx(yearToDateSummary.netExpenses, 8653.808, '2026 year-to-date net expenses should include product purchases ex. moms')
assert(yearToDateSummary.productBreakdown.some((entry) => entry.product === 'Flødebolle' && entry.quantity === 1 && entry.revenue === 7), 'YTD summary should include Flødebolle')
assert.equal(seedData.settings.dailyRevenueGoal, 800, 'Seed settings should include the 800 kr. daily sales goal')
const seedXp = calculateBusinessXp(seedData)
assert(seedXp > 0, 'Business XP should be earned from seeded reports')
assert.equal(calculateReportXp(exampleTotals), 495, 'Daily report XP should include report, items, profit, revenue milestones, and stock control')
assert.equal(getLevelProgress(seedXp).level, 5, 'Updated year-to-date POS data should move IsVognen to Ice Cream Empire')
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
assert(normalizeData({ dailyReports: [exampleReport] }).dailyReports.some((report) => report.date === '2026-05-25'), '25/05 report should migrate into existing saved data')
assert(normalizeData({ dailyReports: [exampleReport] }).dailyReports.some((report) => report.date === '2026-06-29'), 'YTD adjustment should migrate into existing saved data')
assert(!normalizeData({ dailyReports: [{ ...ytdAdjustmentReport, date: '2026-06-28', items: [{ productId: 'guf', quantity: 101 }] }] }).dailyReports.some((report) => report.date === '2026-06-28' && report.id === 'report-2026-ytd-adjustment'), 'Old POS adjustment should be replaced by the latest seed adjustment')
assert(normalizeData({ products: seedData.products.filter((product) => product.id !== 'flodebolle') }).products.some((product) => product.id === 'flodebolle'), 'New products should migrate into existing saved data')
assert(normalizeData({ expenses: [] }).expenses.some((expense) => expense.id === 'expense-first-product-purchase-2026-06-28'), 'First product purchase expense should migrate into existing saved data')
assert(normalizeData({ expenses: [] }).expenses.some((expense) => expense.id === 'expense-more-purchases-waffles-2026-06-28'), 'Additional purchase expenses should migrate into existing saved data')
assert(normalizeData({ stockItems: [] }).stockItems.some((item) => item.id === 'stock-cdo-chocolate-5l'), 'First purchase stock items should migrate into existing saved data')
assert(normalizeData({ stockItems: [] }).stockItems.some((item) => item.id === 'stock-cdo-pistacie-5l'), 'Additional purchase stock items should migrate into existing saved data')
assert(normalizeData({ stockMovements: [] }).stockMovements.some((movement) => movement.id === 'movement-first-purchase-cdo-chocolate-5l'), 'First purchase stock movements should migrate into existing saved data')
assert(normalizeData({ stockMovements: [] }).stockMovements.some((movement) => movement.id === 'movement-more-purchases-cdo-pistacie-5l'), 'Additional purchase stock movements should migrate into existing saved data')
assert(expenseTypes.includes('Cash register system'), 'Expense types should include cash register system')
assert(seedData.recurringExpenses.some((expense) => expense.type === 'Cash register system'), 'Seed data should include a monthly cash register expense template')
const firstPurchaseExpense = seedData.expenses.find((expense) => expense.id === 'expense-first-product-purchase-2026-06-28')
assert(firstPurchaseExpense, 'First product purchase expense should exist')
approx(firstPurchaseExpense.amount, 9370.36, 'First product purchase should be entered incl. moms')
const firstPurchaseMovements = seedData.stockMovements.filter((movement) => movement.id.startsWith('movement-first-purchase-'))
assert.equal(firstPurchaseMovements.length, 9, 'First product purchase should create one received movement per invoice line')
assert.equal(firstPurchaseMovements.reduce((sum, movement) => sum + movement.quantity, 0), 26, 'First product purchase should receive 26 kolli')
const additionalPurchaseExpenses = seedData.expenses.filter((expense) => expense.id.startsWith('expense-more-purchases-'))
approx(additionalPurchaseExpenses.reduce((sum, expense) => sum + expense.amount, 0), 1446.9, 'Additional purchases should total 1.446,90 kr. incl. moms')
const additionalPurchaseMovements = seedData.stockMovements.filter((movement) => movement.id.startsWith('movement-more-purchases-'))
assert.equal(additionalPurchaseMovements.length, 4, 'Additional purchases should create one received movement per receipt line')
assert.equal(additionalPurchaseMovements.reduce((sum, movement) => sum + movement.quantity, 0), 6, 'Additional purchases should receive 6 units/cartons')
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
assert.equal(calculateStock(gufStock, seedData.dailyReports).currentStock, -87, 'Guf stock should follow known Guf sales')
assert.equal(
  calculateStock(gufStock, seedData.dailyReports, [
    { id: 'test-received', stockItemId: 'stock-guf', date: '2026-05-24', type: 'Received', quantity: 10, notes: '' },
    { id: 'test-waste', stockItemId: 'stock-guf', date: '2026-05-24', type: 'Waste', quantity: 2, notes: '' },
  ]).currentStock,
  -79,
  'Stock movement history should adjust current stock',
)
const chocolateStock = seedData.stockItems.find((item) => item.id === 'stock-cdo-chocolate-5l')
assert(chocolateStock, 'Chocolate purchase stock item should exist')
assert.equal(calculateStock(chocolateStock, seedData.dailyReports, seedData.stockMovements).currentStock, 3, 'Chocolate purchase stock should show 3 received kolli')
const pistacieStock = seedData.stockItems.find((item) => item.id === 'stock-cdo-pistacie-5l')
assert(pistacieStock, 'Pistacie purchase stock item should exist')
assert.equal(calculateStock(pistacieStock, seedData.dailyReports, seedData.stockMovements).currentStock, 2, 'Pistacie purchase stock should show 2 received units')

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
