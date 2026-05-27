import {
  addDays,
  calculateDateRangeSummary,
  calculateReportTotals,
  calculateStock,
  countDaysInclusive,
  getLowStockItems,
  getProductCost,
  splitVat,
  toInputDate,
} from './calculations'
import type { AppData, DailyReport, MonthlySummary, Product } from './types'

export type LevelProgress = {
  level: number
  name: string
  xp: number
  currentLevelXp: number
  nextLevelXp: number
  xpIntoLevel: number
  xpNeeded: number
  progress: number
}

export type Achievement = {
  id: string
  title: string
  description: string
  unlocked: boolean
  unlockDate?: string
}

export type Streaks = {
  report: number
  profitable: number
  stockCalm: number
}

export type BusinessHealth = {
  score: number
  label: string
  profitMarginScore: number
  stockScore: number
  expenseScore: number
  consistencyScore: number
}

export type ProductPerformance = {
  product: Product
  price: number
  cost: number
  profitPerSale: number
  unitsSoldToday: number
  totalRevenue: number
  margin: number
  badge: 'Best Seller' | 'High Profit' | 'Needs Attention' | 'Slow Seller' | 'On Track'
}

export type InventoryCard = {
  id: string
  name: string
  unit: string
  category: 'Ingredients' | 'Packaging' | 'Toppings' | 'Other'
  currentStock: number
  minimumStock: number
  targetStock: number
  usedStock: number
  estimatedDaysLeft: number | null
  costPerUnit: number
  stockValue: number
  progress: number
  status: 'full' | 'good' | 'low' | 'critical' | 'out'
  label: 'Full' | 'Good' | 'Low' | 'Critical' | 'Out of Stock'
  restockQuantity: number
  lastRestocked?: string
}

const levelNames = ['IsVognen Start', 'Local Favorite', 'Harbor Hit', 'Summer Legend', 'IsVognen Empire']
const levelThresholds = [0, 250, 750, 1500, 3000]

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0))

const reportsWithSales = (reports: DailyReport[]) => reports.filter((report) => report.items.some((item) => item.quantity > 0))

const latestBusinessDate = (data: AppData) =>
  [...data.dailyReports.map((report) => report.date), ...data.stockMovements.map((movement) => movement.date), ...data.expenses.map((expense) => expense.date)].sort().at(-1) ?? toInputDate()

const getRecentDailyUsage = (data: AppData, item: AppData['stockItems'][number], days = 14) => {
  const end = toInputDate()
  const start = addDays(end, -(days - 1))
  const linkedSales = item.linkedProductId
    ? data.dailyReports
        .filter((report) => report.date >= start && report.date <= end)
        .reduce((sum, report) => sum + report.items.reduce((itemSum, reportItem) => itemSum + (reportItem.productId === item.linkedProductId ? reportItem.quantity : 0), 0), 0)
    : 0
  const loggedRemoved = data.stockMovements
    .filter((movement) => movement.stockItemId === item.id && movement.date >= start && movement.date <= end)
    .reduce((sum, movement) => sum + (movement.type === 'Used' || movement.type === 'Waste' || movement.type === 'Adjustment -' ? Math.max(0, movement.quantity || 0) : 0), 0)

  return (linkedSales + loggedRemoved) / days
}

const getInventoryCategory = (data: AppData, item: AppData['stockItems'][number]): InventoryCard['category'] => {
  const linkedProduct = item.linkedProductId ? data.products.find((product) => product.id === item.linkedProductId) : undefined
  const name = item.name.toLowerCase()
  if (linkedProduct?.category === 'Topping' || linkedProduct?.category === 'Add-on') return 'Toppings'
  if (linkedProduct?.category === 'Kugleis' || linkedProduct?.category === 'Softice') return 'Ingredients'
  if (/(cone|waffle|cup|napkin|spoon|box|pack|bæger|serviet|ske|vaffel)/.test(name)) return 'Packaging'
  if (/(guf|drys|topping|sauce|sprinkle|sylt|fløde)/.test(name)) return 'Toppings'
  if (/(tub|ice|cream|softice|kugle|milk|slush)/.test(name)) return 'Ingredients'
  return 'Other'
}

const revenueMilestoneXp = (revenue: number) => (revenue >= 10000 ? 500 : revenue >= 5000 ? 200 : revenue >= 1000 ? 50 : 0)

export const calculateBusinessXp = (data: AppData) =>
  reportsWithSales(data.dailyReports).reduce((xp, report) => {
    const totals = calculateReportTotals(report, data.products, data.expenses, data.settings)
    return xp + calculateReportXp(totals, getLowStockItems(data).length)
  }, 0)

export const calculateReportXp = (totals: Pick<ReturnType<typeof calculateReportTotals>, 'totalItems' | 'netProfit' | 'totalRevenue'>, stockWarnings = 0) =>
  // XP rewards completed reports, product volume, real profit, revenue milestones, and calm stock control.
  10 + Math.floor(totals.totalItems) + Math.floor(Math.max(0, totals.netProfit) / 10) + revenueMilestoneXp(totals.totalRevenue) + (stockWarnings === 0 ? 15 : 0)

export const getLevelProgress = (xp: number): LevelProgress => {
  const index = levelThresholds.findIndex((threshold, currentIndex) => xp < (levelThresholds[currentIndex + 1] ?? Number.POSITIVE_INFINITY))
  const levelIndex = index === -1 ? levelThresholds.length - 1 : index
  const currentLevelXp = levelThresholds[levelIndex]
  const nextLevelXp = levelThresholds[levelIndex + 1] ?? currentLevelXp
  const xpNeeded = Math.max(0, nextLevelXp - currentLevelXp)
  const xpIntoLevel = Math.max(0, xp - currentLevelXp)

  return {
    level: levelIndex + 1,
    name: levelNames[levelIndex],
    xp,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpNeeded,
    progress: xpNeeded > 0 ? clamp(xpIntoLevel / xpNeeded) : 1,
  }
}

const getStreak = (data: AppData, upToDate: string, qualifies: (report: DailyReport) => boolean) => {
  const reportMap = new Map(data.dailyReports.map((report) => [report.date, report]))
  let cursor = upToDate
  let streak = 0

  while (true) {
    const report = reportMap.get(cursor)
    if (!report || !qualifies(report)) return streak
    streak += 1
    cursor = addDays(cursor, -1)
  }
}

export const getBusinessStreaks = (data: AppData, upToDate = toInputDate()): Streaks => {
  const wasteDates = new Set(data.stockMovements.filter((movement) => movement.type === 'Waste').map((movement) => movement.date))

  return {
    report: getStreak(data, upToDate, (report) => report.items.some((item) => item.quantity > 0)),
    profitable: getStreak(data, upToDate, (report) => calculateReportTotals(report, data.products, data.expenses, data.settings).netProfit > 0),
    stockCalm: getStreak(data, upToDate, (report) => report.items.some((item) => item.quantity > 0) && !wasteDates.has(report.date)),
  }
}

export const getBusinessHealth = (data: AppData, summary: MonthlySummary, startDate: string, endDate: string): BusinessHealth => {
  const lowStockCount = getLowStockItems(data).length
  const stockCount = Math.max(1, data.stockItems.length)
  const activeRevenueDays = summary.dailyRevenue.filter((entry) => entry.revenue > 0).length
  const days = Math.max(1, countDaysInclusive(startDate, endDate))

  const profitMargin = summary.netRevenue > 0 ? summary.grossProfit / summary.netRevenue : 0
  const expenseRatio = summary.netRevenue > 0 ? summary.netExpenses / summary.netRevenue : summary.netExpenses > 0 ? 1 : 0
  const profitMarginScore = clamp(profitMargin / 0.65)
  const stockScore = clamp(1 - lowStockCount / stockCount)
  const expenseScore = clamp(1 - expenseRatio / 0.35)
  const consistencyScore = clamp(activeRevenueDays / Math.min(days, 14))
  const score = Math.round((profitMarginScore * 0.35 + stockScore * 0.25 + expenseScore * 0.25 + consistencyScore * 0.15) * 100)

  return {
    score,
    label: score >= 85 ? 'Thriving' : score >= 65 ? 'Solid' : score >= 40 ? 'Needs Focus' : 'At Risk',
    profitMarginScore,
    stockScore,
    expenseScore,
    consistencyScore,
  }
}

const achievement = (id: string, title: string, description: string, unlockDate?: string): Achievement => ({
  id,
  title,
  description,
  unlocked: Boolean(unlockDate),
  unlockDate,
})

const firstReportDate = (reports: DailyReport[], qualifies: (report: DailyReport) => boolean) => reports.filter(qualifies).sort((a, b) => a.date.localeCompare(b.date))[0]?.date

const reportStreakUnlockDate = (reports: DailyReport[], target: number) => {
  let streak = 0
  let previousDate = ''

  for (const report of reports.filter((entry) => entry.items.some((item) => item.quantity > 0)).sort((a, b) => a.date.localeCompare(b.date))) {
    streak = previousDate && addDays(previousDate, 1) === report.date ? streak + 1 : 1
    if (streak >= target) return report.date
    previousDate = report.date
  }

  return undefined
}

export const getAchievements = (data: AppData, level: LevelProgress): Achievement[] => {
  const soldReports = reportsWithSales(data.dailyReports)
  const reportsByDate = [...data.dailyReports].sort((a, b) => a.date.localeCompare(b.date))
  const soldReportsByDate = [...soldReports].sort((a, b) => a.date.localeCompare(b.date))
  const reportTotals = soldReportsByDate.map((report) => ({ report, totals: calculateReportTotals(report, data.products, data.expenses, data.settings) }))
  const bestProfitEntry = reportTotals.reduce<(typeof reportTotals)[number] | undefined>(
    (best, entry) => (!best || entry.totals.netProfit > best.totals.netProfit ? entry : best),
    undefined,
  )
  const totalRevenue = reportTotals.reduce((sum, entry) => sum + entry.totals.totalRevenue, 0)
  const totalGuf = soldReports.reduce(
    (sum, report) => sum + (report.items.find((item) => item.productId === 'guf')?.quantity ?? 0),
    0,
  )
  const inventory = data.stockItems.map((item) => calculateStock(item, data.dailyReports, data.stockMovements))
  const wasteDates = new Set(data.stockMovements.filter((movement) => movement.type === 'Waste').map((movement) => movement.date))
  const soldOutDate = inventory.some((stock) => stock.currentStock <= 0) ? data.stockMovements.filter((movement) => movement.type === 'Used' || movement.type === 'Waste' || movement.type === 'Adjustment -').sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? latestBusinessDate(data) : undefined
  const stockMasterDate = data.stockItems.length > 0 && getLowStockItems(data).length === 0 ? latestBusinessDate(data) : undefined
  const firstGufMasterDate =
    soldReportsByDate.reduce<{ total: number; date?: string }>(
      (state, report) => {
        const nextTotal = state.total + (report.items.find((item) => item.productId === 'guf')?.quantity ?? 0)
        return { total: nextTotal, date: state.date ?? (nextTotal >= 25 ? report.date : undefined) }
      },
      { total: 0 },
    ).date
  const bossDate = level.level >= 5 || totalRevenue >= 50000 ? latestBusinessDate(data) : undefined

  return [
    achievement('first-sale', 'First Sale', 'Record your first sold item.', firstReportDate(soldReportsByDate, (report) => report.items.some((item) => item.quantity > 0))),
    achievement('first-report', 'First Report', 'Save your first daily report.', reportsByDate[0]?.date),
    achievement('revenue-1000', '1.000 kr Revenue Day', 'Hit 1.000 kr in one day.', reportTotals.find((entry) => entry.totals.totalRevenue >= 1000)?.report.date),
    achievement('revenue-5000', '5.000 kr Revenue Day', 'Hit 5.000 kr in one day.', reportTotals.find((entry) => entry.totals.totalRevenue >= 5000)?.report.date),
    achievement('revenue-10000', '10.000 kr Revenue Day', 'Hit 10.000 kr in one day.', reportTotals.find((entry) => entry.totals.totalRevenue >= 10000)?.report.date),
    achievement('first-profitable-day', 'First Profitable Day', 'Finish a day with positive net profit.', reportTotals.find((entry) => entry.totals.netProfit > 0)?.report.date),
    achievement('report-streak-7', '7 Day Report Streak', 'Enter reports for 7 consecutive selling days.', reportStreakUnlockDate(data.dailyReports, 7)),
    achievement('report-streak-30', '30 Day Report Streak', 'Enter reports for 30 consecutive selling days.', reportStreakUnlockDate(data.dailyReports, 30)),
    achievement('best-profit', 'Best Profit Day', 'Set a new highest-profit day.', bestProfitEntry && bestProfitEntry.totals.netProfit > 0 ? bestProfitEntry.report.date : undefined),
    achievement('sold-out', 'Sold Out', 'Track an item all the way to zero stock.', soldOutDate),
    achievement('no-waste', 'No Waste Day', 'Save a sales report with no logged waste that day.', soldReportsByDate.find((report) => !wasteDates.has(report.date))?.date),
    achievement('stock-master', 'Stock Master', 'Keep every tracked stock item above its minimum level.', stockMasterDate),
    achievement('guf-master', 'Guf Master', 'Sell 25 portions of guf.', firstGufMasterDate),
    achievement('ice-cream-boss', 'IsVognen Boss', 'Reach level 5 or 50.000 kr lifetime revenue.', bossDate),
  ]
}

export const getProductPerformance = (data: AppData, startDate: string, endDate: string, today = toInputDate()): ProductPerformance[] => {
  const todayReport = data.dailyReports.find((report) => report.date === today)
  const rangeSummary = calculateDateRangeSummary(data, startDate, endDate)
  const quantityByProduct = new Map(rangeSummary.lines.map((line) => [line.product.id, line.quantity]))
  const bestProductId = rangeSummary.lines.reduce(
    (best, line) => (line.quantity > (quantityByProduct.get(best) ?? -1) ? line.product.id : best),
    '',
  )

  return data.products.map((product) => {
    const rangeLine = rangeSummary.lines.find((line) => line.product.id === product.id)
    const sale = splitVat(product.sellingPrice, data.settings.salesPricesIncludeVat, data.settings)
    const cost = splitVat(getProductCost(product, data.settings), data.settings.productCostsIncludeVat, data.settings)
    const profitPerSale = sale.net - cost.net
    const margin = sale.net > 0 ? profitPerSale / sale.net : 0
    const unitsSoldToday = todayReport?.items.find((item) => item.productId === product.id)?.quantity ?? 0
    const rangeQuantity = rangeLine?.quantity ?? 0
    const badge =
      product.id === bestProductId && rangeQuantity > 0
        ? 'Best Seller'
        : profitPerSale <= 0 || margin < 0.15
          ? 'Needs Attention'
          : rangeQuantity === 0
            ? 'Slow Seller'
            : margin >= 0.6
              ? 'High Profit'
              : 'On Track'

    return {
      product,
      price: product.sellingPrice,
      cost: getProductCost(product, data.settings),
      profitPerSale,
      unitsSoldToday,
      totalRevenue: rangeLine?.revenue ?? 0,
      margin,
      badge,
    }
  })
}

export const getInventoryCards = (data: AppData): InventoryCard[] =>
  data.stockItems
    .map((item) => {
      const stock = calculateStock(item, data.dailyReports, data.stockMovements)
      const target = Math.max(item.minimumStockLevel * 2, item.startingStock + item.addedStock, 1)
      const progress = clamp(stock.currentStock / target)
      const averageDailyUsage = getRecentDailyUsage(data, item)
      const estimatedDaysLeft = averageDailyUsage > 0 ? stock.currentStock / averageDailyUsage : null
      const status: InventoryCard['status'] =
        stock.currentStock <= 0
          ? 'out'
          : progress <= 0.25
            ? 'critical'
            : progress <= 0.5
              ? 'low'
              : progress <= 0.75
                ? 'good'
                : 'full'
      const lastRestocked = data.stockMovements
        .filter((movement) => movement.stockItemId === item.id && (movement.type === 'Received' || movement.type === 'Adjustment +'))
        .sort((a, b) => b.date.localeCompare(a.date))[0]?.date

      return {
        id: item.id,
        name: item.name,
        unit: item.unit,
        category: getInventoryCategory(data, item),
        currentStock: stock.currentStock,
        minimumStock: item.minimumStockLevel,
        targetStock: target,
        usedStock: stock.usedStock,
        estimatedDaysLeft,
        costPerUnit: item.costPerUnit,
        stockValue: Math.max(0, stock.currentStock) * item.costPerUnit,
        progress,
        status,
        label: status === 'out' ? 'Out of Stock' : status === 'critical' ? 'Critical' : status === 'low' ? 'Low' : status === 'good' ? 'Good' : 'Full',
        restockQuantity: Math.max(0, target - stock.currentStock),
        lastRestocked,
      }
    })
    .sort((a, b) => {
      const urgency = { out: 0, critical: 1, low: 2, good: 3, full: 4 }
      const statusDiff = urgency[a.status] - urgency[b.status]
      if (statusDiff !== 0) return statusDiff
      const aDays = a.estimatedDaysLeft ?? Number.POSITIVE_INFINITY
      const bDays = b.estimatedDaysLeft ?? Number.POSITIVE_INFINITY
      if (aDays !== bDays) return aDays - bDays
      return a.progress - b.progress
    })
