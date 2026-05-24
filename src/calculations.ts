import type {
  AppData,
  DailyReport,
  Expense,
  ExpenseType,
  MonthlySummary,
  Product,
  ReportTotals,
  Settings,
  StockItem,
} from './types'

export const formatKr = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: maximumFractionDigits === 0 ? 0 : 2,
    maximumFractionDigits,
  }).format(Number.isFinite(value) ? value : 0)

export const formatNumber = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat('da-DK', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(Number.isFinite(value) ? value : 0)

export const toInputDate = (date = new Date()) => date.toISOString().slice(0, 10)

export const monthKey = (date: string) => date.slice(0, 7)

export const getGufBucketPriceInclVat = (settings: Settings) =>
  settings.gufBucketPriceExVat * (1 + settings.vatRate / 100)

export const getProductCost = (product: Product, settings: Settings) => {
  if (product.costSource === 'gufSetting' && !product.manualCostOverride) {
    const portions = Math.max(1, settings.gufPortionsPerBucket)
    // Cost per guf portion = bucket price including moms divided by portions per bucket.
    return getGufBucketPriceInclVat(settings) / portions
  }

  return product.costPerUnit
}

export const getReportExpenses = (report: DailyReport, expenses: Expense[]) =>
  expenses.filter((expense) => expense.reportId === report.id || (!expense.reportId && expense.date === report.date))

export const calculateReportTotals = (
  report: DailyReport,
  products: Product[],
  expenses: Expense[],
  settings: Settings,
): ReportTotals => {
  const lines = report.items
    .map((item) => {
      const product = products.find((entry) => entry.id === item.productId)
      if (!product) return null

      const quantity = Math.max(0, item.quantity || 0)
      const revenue = quantity * product.sellingPrice
      const productCost = quantity * getProductCost(product, settings)
      // Gross profit is revenue minus the direct cost of sold products.
      const grossProfit = revenue - productCost

      return { product, quantity, revenue, productCost, grossProfit }
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line))

  const totalRevenue = lines.reduce((sum, line) => sum + line.revenue, 0)
  const totalProductCost = lines.reduce((sum, line) => sum + line.productCost, 0)
  const grossProfit = totalRevenue - totalProductCost
  const expenseTotal = getReportExpenses(report, expenses).reduce((sum, expense) => sum + expense.amount, 0)
  // Net profit is gross profit minus the day's non-product expenses.
  const netProfit = grossProfit - expenseTotal
  const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0)

  return { lines, totalRevenue, totalProductCost, grossProfit, expenses: expenseTotal, netProfit, totalItems }
}

export const calculateMonthlySummary = (data: AppData, selectedMonth: string): MonthlySummary => {
  const reports = data.dailyReports.filter((report) => monthKey(report.date) === selectedMonth)
  const emptyReport: DailyReport = { id: 'empty', date: `${selectedMonth}-01`, items: [], notes: '' }
  const totals = reports.reduce(
    (summary, report) => {
      const reportTotals = calculateReportTotals(report, data.products, data.expenses, data.settings)
      summary.totalRevenue += reportTotals.totalRevenue
      summary.totalProductCost += reportTotals.totalProductCost
      summary.grossProfit += reportTotals.grossProfit
      summary.expenses += reportTotals.expenses
      summary.netProfit += reportTotals.netProfit
      summary.totalItems += reportTotals.totalItems
      summary.lines.push(...reportTotals.lines)
      return summary
    },
    calculateReportTotals(emptyReport, data.products, data.expenses, data.settings),
  )

  const productMap = new Map<string, { product: string; quantity: number; revenue: number }>()
  totals.lines.forEach((line) => {
    const existing = productMap.get(line.product.id) ?? { product: line.product.name, quantity: 0, revenue: 0 }
    existing.quantity += line.quantity
    existing.revenue += line.revenue
    productMap.set(line.product.id, existing)
  })

  const productBreakdown = [...productMap.values()].sort((a, b) => b.quantity - a.quantity)
  const bestSellingProduct = productBreakdown[0]?.product ?? 'No sales yet'
  const averageProfitMargin = totals.totalRevenue > 0 ? totals.grossProfit / totals.totalRevenue : 0

  const dailyRevenue = reports
    .map((report) => ({
      date: report.date,
      revenue: calculateReportTotals(report, data.products, data.expenses, data.settings).totalRevenue,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const expensesForMonth = data.expenses.filter((expense) => monthKey(expense.date) === selectedMonth)
  const expenseTotals = expensesForMonth.reduce(
    (map, expense) => map.set(expense.type, (map.get(expense.type) ?? 0) + expense.amount),
    new Map<ExpenseType, number>(),
  )
  const expenseBreakdown = [...expenseTotals.entries()].map(([type, amount]) => ({ type, amount }))

  return {
    ...totals,
    month: selectedMonth,
    bestSellingProduct,
    averageProfitMargin,
    dailyRevenue,
    productBreakdown,
    expenseBreakdown,
  }
}

export const getLinkedSalesQuantity = (productId: string, reports: DailyReport[]) =>
  reports.reduce(
    (sum, report) => sum + report.items.reduce((itemSum, item) => itemSum + (item.productId === productId ? item.quantity : 0), 0),
    0,
  )

export const calculateStock = (stockItem: StockItem, reports: DailyReport[]) => {
  const linkedSales = stockItem.linkedProductId ? getLinkedSalesQuantity(stockItem.linkedProductId, reports) : 0
  const usedStock = linkedSales + stockItem.manualUsedStock
  const currentStock = stockItem.startingStock + stockItem.addedStock - usedStock
  return {
    usedStock,
    currentStock,
    reorderAlert: currentStock < stockItem.minimumStockLevel,
  }
}

export const getLowStockItems = (data: AppData) =>
  data.stockItems
    .map((item) => ({ item, status: calculateStock(item, data.dailyReports) }))
    .filter((entry) => entry.status.reorderAlert)
