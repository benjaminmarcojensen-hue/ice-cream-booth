export type ProductCategory = 'Softice' | 'Kugleis' | 'Topping' | 'Add-on'

export type ExpenseType =
  | 'Ice cream purchase'
  | 'Waffles/cones'
  | 'Toppings/guf'
  | 'Staff wages'
  | 'Electricity'
  | 'Packaging'
  | 'Cleaning'
  | 'Rent'
  | 'Card fees'
  | 'Other'

export type PaymentMethod = 'Cash' | 'Card' | 'MobilePay' | 'Bank' | 'Other'

export type Product = {
  id: string
  name: string
  category: ProductCategory
  portionSize: string
  costPerUnit: number
  sellingPrice: number
  notes: string
  costSource?: 'manual' | 'gufSetting'
  manualCostOverride?: boolean
}

export type FlavorBreakdown = Record<string, number>

export type DailyReportItem = {
  productId: string
  quantity: number
  flavors?: FlavorBreakdown
}

export type DailyReport = {
  id: string
  date: string
  items: DailyReportItem[]
  notes: string
}

export type Expense = {
  id: string
  date: string
  type: ExpenseType
  description: string
  amount: number
  paymentMethod: PaymentMethod
  notes: string
  reportId?: string
}

export type StockItem = {
  id: string
  name: string
  unit: string
  startingStock: number
  addedStock: number
  manualUsedStock: number
  minimumStockLevel: number
  linkedProductId?: string
  notes: string
}

export type Settings = {
  vatRegistered: boolean
  vatRate: number
  currency: 'DKK'
  salesPricesIncludeVat: boolean
  productCostsIncludeVat: boolean
  expensesIncludeVat: boolean
  gufBucketPriceExVat: number
  gufPortionsPerBucket: number
  businessName: string
}

export type AppData = {
  products: Product[]
  dailyReports: DailyReport[]
  expenses: Expense[]
  stockItems: StockItem[]
  flavors: string[]
  settings: Settings
}

export type CloudConfig = {
  enabled: boolean
  supabaseUrl: string
  supabaseAnonKey: string
}

export type ProductLineResult = {
  product: Product
  quantity: number
  revenue: number
  netRevenue: number
  outputVat: number
  productCost: number
  netProductCost: number
  inputVat: number
  grossProfit: number
}

export type ReportTotals = {
  lines: ProductLineResult[]
  totalRevenue: number
  netRevenue: number
  outputVat: number
  totalProductCost: number
  netProductCost: number
  inputVatProductCosts: number
  grossProfit: number
  expenses: number
  netExpenses: number
  inputVatExpenses: number
  vatPayable: number
  netProfit: number
  totalItems: number
}

export type MonthlySummary = ReportTotals & {
  month: string
  bestSellingProduct: string
  averageProfitMargin: number
  dailyRevenue: { date: string; revenue: number }[]
  productBreakdown: { product: string; quantity: number; revenue: number }[]
  expenseBreakdown: { type: ExpenseType; amount: number }[]
}
