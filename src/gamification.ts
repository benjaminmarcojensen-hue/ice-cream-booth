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
  currentStock: number
  minimumStock: number
  usedStock: number
  progress: number
  status: 'good' | 'low' | 'critical'
  label: 'Healthy Stock' | 'Restock Soon' | 'Critical'
}

const levelNames = ['New Booth', 'Local Favorite', 'Harbor Hit', 'Summer Legend', 'Ice Cream Empire']
const levelThresholds = [0, 250, 750, 1500, 3000]

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0))

const reportsWithSales = (reports: DailyReport[]) => reports.filter((report) => report.items.some((item) => item.quantity > 0))

export const calculateBusinessXp = (data: AppData) =>
  reportsWithSales(data.dailyReports).reduce((xp, report) => {
    const totals = calculateReportTotals(report, data.products, data.expenses, data.settings)
    // XP rewards the habit of reporting, the number of products sold, and real profit.
    return xp + 10 + Math.floor(totals.totalItems) + Math.floor(Math.max(0, totals.netProfit) / 10)
  }, 0)

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

export const getAchievements = (data: AppData, level: LevelProgress): Achievement[] => {
  const soldReports = reportsWithSales(data.dailyReports)
  const reportTotals = soldReports.map((report) => calculateReportTotals(report, data.products, data.expenses, data.settings))
  const bestProfit = Math.max(0, ...reportTotals.map((totals) => totals.netProfit))
  const totalRevenue = reportTotals.reduce((sum, totals) => sum + totals.totalRevenue, 0)
  const totalGuf = soldReports.reduce(
    (sum, report) => sum + (report.items.find((item) => item.productId === 'guf')?.quantity ?? 0),
    0,
  )
  const inventory = data.stockItems.map((item) => calculateStock(item, data.dailyReports, data.stockMovements))

  return [
    { id: 'first-sale', title: 'First Sale', description: 'Record your first sold item.', unlocked: reportTotals.some((totals) => totals.totalItems > 0) },
    { id: 'revenue-1000', title: '1.000 kr Revenue Day', description: 'Hit 1.000 kr in one day.', unlocked: reportTotals.some((totals) => totals.totalRevenue >= 1000) },
    { id: 'revenue-5000', title: '5.000 kr Revenue Day', description: 'Hit 5.000 kr in one day.', unlocked: reportTotals.some((totals) => totals.totalRevenue >= 5000) },
    { id: 'ten-days', title: '10 Days Tracked', description: 'Save reports for 10 selling days.', unlocked: soldReports.length >= 10 },
    { id: 'best-profit', title: 'Best Profit Day', description: 'Create a day with positive profit.', unlocked: bestProfit > 0 },
    { id: 'sold-out', title: 'Sold Out', description: 'Track an item all the way to zero stock.', unlocked: inventory.some((stock) => stock.currentStock <= 0) },
    { id: 'perfect-stock', title: 'Perfect Stock Control', description: 'No active reorder alerts.', unlocked: data.stockItems.length > 0 && getLowStockItems(data).length === 0 },
    { id: 'no-waste', title: 'No Waste Day', description: 'Save reports without logged waste.', unlocked: soldReports.length > 0 && data.stockMovements.every((movement) => movement.type !== 'Waste') },
    { id: 'guf-master', title: 'Guf Master', description: 'Sell 25 portions of guf.', unlocked: totalGuf >= 25 },
    { id: 'ice-cream-boss', title: 'Ice Cream Boss', description: 'Reach level 5 or 50.000 kr lifetime revenue.', unlocked: level.level >= 5 || totalRevenue >= 50000 },
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
  data.stockItems.map((item) => {
    const stock = calculateStock(item, data.dailyReports, data.stockMovements)
    const target = Math.max(item.minimumStockLevel * 2, item.startingStock + item.addedStock + stock.movementAdded, 1)
    const progress = clamp(stock.currentStock / target)
    const criticalLimit = item.minimumStockLevel > 0 ? item.minimumStockLevel * 0.5 : 0
    const status: InventoryCard['status'] = stock.currentStock <= criticalLimit ? 'critical' : stock.currentStock < item.minimumStockLevel ? 'low' : 'good'

    return {
      id: item.id,
      name: item.name,
      unit: item.unit,
      currentStock: stock.currentStock,
      minimumStock: item.minimumStockLevel,
      usedStock: stock.usedStock,
      progress,
      status,
      label: status === 'critical' ? 'Critical' : status === 'low' ? 'Restock Soon' : 'Healthy Stock',
    }
  })
