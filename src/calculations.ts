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
  StockMovement,
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

const getVatRate = (settings: Settings) => (settings.vatRegistered ? Math.max(0, settings.vatRate) : 0)

export const splitVat = (amount: number, includesVat: boolean, settings: Settings) => {
  const rate = getVatRate(settings)
  const safeAmount = Number.isFinite(amount) ? amount : 0

  if (rate <= 0) {
    return { gross: safeAmount, net: safeAmount, vat: 0 }
  }

  if (includesVat) {
    // With Danish 25% moms, the VAT part of a gross amount is gross * 25 / 125.
    const vat = safeAmount * (rate / (100 + rate))
    return { gross: safeAmount, net: safeAmount - vat, vat }
  }

  const vat = safeAmount * (rate / 100)
  return { gross: safeAmount + vat, net: safeAmount, vat }
}

export const getProductCost = (product: Product, settings: Settings) => {
  if (product.costSource === 'gufSetting' && !product.manualCostOverride) {
    const portions = Math.max(1, settings.gufPortionsPerBucket)
    // Cost per guf portion follows the selected cost basis: incl. moms or ex. moms.
    const bucketPrice = settings.productCostsIncludeVat ? getGufBucketPriceInclVat(settings) : settings.gufBucketPriceExVat
    return bucketPrice / portions
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
      const sale = splitVat(quantity * product.sellingPrice, settings.salesPricesIncludeVat, settings)
      const cost = splitVat(quantity * getProductCost(product, settings), settings.productCostsIncludeVat, settings)
      // Profit excludes moms because VAT is collected for or reclaimed from Skattestyrelsen.
      const grossProfit = sale.net - cost.net

      return {
        product,
        quantity,
        revenue: sale.gross,
        netRevenue: sale.net,
        outputVat: sale.vat,
        productCost: cost.gross,
        netProductCost: cost.net,
        inputVat: cost.vat,
        grossProfit,
      }
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line))

  const totalRevenue = lines.reduce((sum, line) => sum + line.revenue, 0)
  const netRevenue = lines.reduce((sum, line) => sum + line.netRevenue, 0)
  const outputVat = lines.reduce((sum, line) => sum + line.outputVat, 0)
  const totalProductCost = lines.reduce((sum, line) => sum + line.productCost, 0)
  const netProductCost = lines.reduce((sum, line) => sum + line.netProductCost, 0)
  const inputVatProductCosts = lines.reduce((sum, line) => sum + line.inputVat, 0)
  const grossProfit = netRevenue - netProductCost
  const expenseSplits = getReportExpenses(report, expenses).map((expense) => splitVat(expense.amount, settings.expensesIncludeVat, settings))
  const expenseTotal = expenseSplits.reduce((sum, expense) => sum + expense.gross, 0)
  const netExpenses = expenseSplits.reduce((sum, expense) => sum + expense.net, 0)
  const inputVatExpenses = expenseSplits.reduce((sum, expense) => sum + expense.vat, 0)
  // Net profit excludes VAT on sales and deductible VAT on purchases/expenses.
  const netProfit = grossProfit - netExpenses
  const vatPayable = outputVat - inputVatProductCosts - inputVatExpenses
  const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0)

  return {
    lines,
    totalRevenue,
    netRevenue,
    outputVat,
    totalProductCost,
    netProductCost,
    inputVatProductCosts,
    grossProfit,
    expenses: expenseTotal,
    netExpenses,
    inputVatExpenses,
    vatPayable,
    netProfit,
    totalItems,
  }
}

export const calculateMonthlySummary = (data: AppData, selectedMonth: string): MonthlySummary => {
  const reports = data.dailyReports.filter((report) => monthKey(report.date) === selectedMonth)
  const emptyReport: DailyReport = { id: 'empty', date: `${selectedMonth}-01`, items: [], notes: '' }
  const totals = reports.reduce(
    (summary, report) => {
      const reportTotals = calculateReportTotals(report, data.products, data.expenses, data.settings)
      summary.totalRevenue += reportTotals.totalRevenue
      summary.netRevenue += reportTotals.netRevenue
      summary.outputVat += reportTotals.outputVat
      summary.totalProductCost += reportTotals.totalProductCost
      summary.netProductCost += reportTotals.netProductCost
      summary.inputVatProductCosts += reportTotals.inputVatProductCosts
      summary.grossProfit += reportTotals.grossProfit
      summary.expenses += reportTotals.expenses
      summary.netExpenses += reportTotals.netExpenses
      summary.inputVatExpenses += reportTotals.inputVatExpenses
      summary.vatPayable += reportTotals.vatPayable
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
  const averageProfitMargin = totals.netRevenue > 0 ? totals.grossProfit / totals.netRevenue : 0

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

const getMovementQuantity = (movement: StockMovement) => {
  const quantity = Math.max(0, movement.quantity || 0)
  if (movement.type === 'Received' || movement.type === 'Adjustment +') return quantity
  return -quantity
}

export const getStockMovementTotals = (stockItemId: string, movements: StockMovement[] = []) =>
  movements
    .filter((movement) => movement.stockItemId === stockItemId)
    .reduce(
      (totals, movement) => {
        const quantity = Math.max(0, movement.quantity || 0)
        if (movement.type === 'Received' || movement.type === 'Adjustment +') totals.added += quantity
        if (movement.type === 'Used' || movement.type === 'Waste' || movement.type === 'Adjustment -') totals.removed += quantity
        totals.net += getMovementQuantity(movement)
        return totals
      },
      { added: 0, removed: 0, net: 0 },
    )

export const calculateStock = (stockItem: StockItem, reports: DailyReport[], movements: StockMovement[] = []) => {
  const linkedSales = stockItem.linkedProductId ? getLinkedSalesQuantity(stockItem.linkedProductId, reports) : 0
  const movementTotals = getStockMovementTotals(stockItem.id, movements)
  const usedStock = linkedSales + stockItem.manualUsedStock + movementTotals.removed
  const currentStock = stockItem.startingStock + stockItem.addedStock + movementTotals.added - usedStock
  return {
    linkedSales,
    movementAdded: movementTotals.added,
    movementRemoved: movementTotals.removed,
    usedStock,
    currentStock,
    reorderAlert: currentStock < stockItem.minimumStockLevel,
  }
}

export const getLowStockItems = (data: AppData) =>
  data.stockItems
    .map((item) => ({ item, status: calculateStock(item, data.dailyReports, data.stockMovements) }))
    .filter((entry) => entry.status.reorderAlert)
