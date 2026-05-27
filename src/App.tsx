import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { expenseTypes, paymentMethods } from './data'
import {
  calculateDateRangeSummary,
  calculateMonthlySummary,
  calculateReportTotals,
  calculateStock,
  formatKr,
  formatNumber,
  getGufBucketPriceInclVat,
  getLowStockItems,
  getMonthRange,
  getProductCost,
  getWeekRange,
  monthKey,
  splitVat,
  toInputDate,
} from './calculations'
import {
  dailyReportsRows,
  downloadCsv,
  downloadJsonBackup,
  downloadWorkbook,
  expensesRows,
  monthlySummaryRows,
  pricingRows,
  stockMovementRows,
  stockRows,
} from './exporters'
import { parseDailyReportText } from './parser'
import { loadCloudConfig, loadData, normalizeData, resetData, saveCloudConfig, saveData } from './storage'
import { loadCloudData, saveCloudData, testCloudConnection } from './cloudStorage'
import type {
  AppData,
  CloudConfig,
  DailyReport,
  Expense,
  ExpenseType,
  PaymentMethod,
  Product,
  RecurringExpense,
  StockItem,
  StockMovement,
  StockMovementType,
} from './types'

type TabId = 'dashboard' | 'daily' | 'pricing' | 'expenses' | 'stock' | 'summary' | 'import' | 'export'
type DashboardPeriod = 'day' | 'week' | 'month'
type IconComponent = (props: { size?: number }) => React.ReactElement

const IconGlyph = ({ size = 18, variant }: { size?: number; variant: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {variant === 'chart' && (
        <>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 16v-5" />
          <path d="M12 16V8" />
          <path d="M16 16v-3" />
        </>
      )}
      {variant === 'calendar' && (
        <>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </>
      )}
      {variant === 'ice' && (
        <>
          <path d="M7 8a5 5 0 0 1 10 0c0 2-2 4-5 4s-5-2-5-4Z" />
          <path d="m8 13 4 8 4-8" />
        </>
      )}
      {variant === 'wallet' && (
        <>
          <rect x="3" y="6" width="18" height="14" rx="2" />
          <path d="M16 12h5v5h-5a2.5 2.5 0 0 1 0-5Z" />
        </>
      )}
      {variant === 'box' && (
        <>
          <path d="m3 7 9-4 9 4-9 4-9-4Z" />
          <path d="M3 7v10l9 4 9-4V7" />
          <path d="m9 14 2 2 4-5" />
        </>
      )}
      {variant === 'receipt' && (
        <>
          <path d="M6 3h12v18l-2-1-2 1-2-1-2 1-2-1-2 1V3Z" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </>
      )}
      {variant === 'upload' && (
        <>
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M5 20h14" />
        </>
      )}
      {variant === 'download' && (
        <>
          <path d="M12 4v12" />
          <path d="m7 11 5 5 5-5" />
          <path d="M5 20h14" />
        </>
      )}
      {variant === 'alert' && (
        <>
          <path d="M12 3 2 21h20L12 3Z" />
          <path d="M12 9v5M12 17h.01" />
        </>
      )}
      {variant === 'plus' && <path d="M12 5v14M5 12h14" />}
      {variant === 'save' && (
        <>
          <path d="M5 3h12l2 2v16H5V3Z" />
          <path d="M8 3v6h8V3M8 21v-7h8v7" />
        </>
      )}
      {variant === 'settings' && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
        </>
      )}
      {variant === 'reset' && (
        <>
          <path d="M4 7v6h6" />
          <path d="M20 17a8 8 0 0 1-14-5.3L4 13" />
        </>
      )}
      {variant === 'sheet' && (
        <>
          <path d="M6 3h9l3 3v15H6V3Z" />
          <path d="M9 10h6M9 14h6M9 18h6" />
        </>
      )}
    </g>
  </svg>
)

const BarChart3: IconComponent = ({ size }) => <IconGlyph size={size} variant="chart" />
const CalendarDays: IconComponent = ({ size }) => <IconGlyph size={size} variant="calendar" />
const IceCreamBowl: IconComponent = ({ size }) => <IconGlyph size={size} variant="ice" />
const WalletCards: IconComponent = ({ size }) => <IconGlyph size={size} variant="wallet" />
const PackageCheck: IconComponent = ({ size }) => <IconGlyph size={size} variant="box" />
const ReceiptText: IconComponent = ({ size }) => <IconGlyph size={size} variant="receipt" />
const Upload: IconComponent = ({ size }) => <IconGlyph size={size} variant="upload" />
const Download: IconComponent = ({ size }) => <IconGlyph size={size} variant="download" />
const AlertTriangle: IconComponent = ({ size }) => <IconGlyph size={size} variant="alert" />
const Plus: IconComponent = ({ size }) => <IconGlyph size={size} variant="plus" />
const Save: IconComponent = ({ size }) => <IconGlyph size={size} variant="save" />
const Settings: IconComponent = ({ size }) => <IconGlyph size={size} variant="settings" />
const RotateCcw: IconComponent = ({ size }) => <IconGlyph size={size} variant="reset" />
const FileSpreadsheet: IconComponent = ({ size }) => <IconGlyph size={size} variant="sheet" />

const tabs: { id: TabId; label: string; icon: IconComponent }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'daily', label: 'Daily Report', icon: CalendarDays },
  { id: 'pricing', label: 'Product Pricing', icon: IceCreamBowl },
  { id: 'expenses', label: 'Expenses', icon: WalletCards },
  { id: 'stock', label: 'Stock', icon: PackageCheck },
  { id: 'summary', label: 'Monthly Summary', icon: ReceiptText },
  { id: 'import', label: 'Import Report', icon: Upload },
  { id: 'export', label: 'Export', icon: Download },
]

const stockMovementTypes: StockMovementType[] = ['Received', 'Used', 'Waste', 'Adjustment +', 'Adjustment -']

const dashboardPeriods: { id: DashboardPeriod; label: string }[] = [
  { id: 'day', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
]

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

const emptyReportForDate = (date: string, products: Product[]): DailyReport => ({
  id: `report-${date}`,
  date,
  items: products.map((product) => ({ productId: product.id, quantity: 0 })),
  notes: '',
})

const emptyExpense = (date: string, reportId?: string): Expense => ({
  id: createId('expense'),
  date,
  type: 'Other',
  description: '',
  amount: 0,
  paymentMethod: 'Other',
  notes: '',
  reportId,
})

const emptyRecurringExpense = (): RecurringExpense => ({
  id: createId('recurring-expense'),
  type: 'Cash register system',
  description: 'Cash register system',
  amount: 0,
  paymentMethod: 'Card',
  dayOfMonth: 1,
  notes: '',
  active: true,
})

const emptyStockItem = (name = 'New stock item', unit = 'units'): StockItem => ({
  id: createId('stock'),
  name,
  unit,
  startingStock: 0,
  addedStock: 0,
  manualUsedStock: 0,
  minimumStockLevel: 0,
  notes: '',
})

const emptyStockMovement = (stockItemId = '', date = toInputDate()): StockMovement => ({
  id: createId('movement'),
  stockItemId,
  date,
  type: 'Received',
  quantity: 0,
  notes: '',
})

const numberValue = (value: string) => Math.max(0, Number(value || 0))

const getDashboardRange = (period: DashboardPeriod, today = toInputDate()) => {
  if (period === 'day') return { start: today, end: today, label: 'Today' }
  if (period === 'week') return { ...getWeekRange(today), label: 'This week' }
  return { ...getMonthRange(today), label: 'This month' }
}

const recurringExpenseDate = (month: string, dayOfMonth: number) => {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  const day = String(Math.min(lastDay, Math.max(1, dayOfMonth || 1))).padStart(2, '0')
  return `${month}-${day}`
}

function App() {
  const [data, setData] = useState<AppData>(() => loadData())
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>(() => loadCloudConfig())
  const [cloudStatus, setCloudStatus] = useState(() => (loadCloudConfig().enabled ? 'Connecting to Supabase...' : 'Local browser storage'))
  const [cloudLoaded, setCloudLoaded] = useState(() => !loadCloudConfig().enabled)
  const [isCloudBusy, setIsCloudBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>('month')
  const [reportDate, setReportDate] = useState(toInputDate())
  const [draftReport, setDraftReport] = useState<DailyReport>(() => emptyReportForDate(toInputDate(), data.products))
  const [draftExpenses, setDraftExpenses] = useState<Expense[]>([])
  const [expenseDraft, setExpenseDraft] = useState<Expense>(() => ({ ...emptyExpense(toInputDate()), type: 'Other', description: 'Random item' }))
  const [selectedMonth, setSelectedMonth] = useState(monthKey(toInputDate()))
  const [expenseMonth, setExpenseMonth] = useState(monthKey(toInputDate()))
  const [selectedTubFlavor, setSelectedTubFlavor] = useState(data.flavors[0] ?? 'Vanilje')
  const [movementDraft, setMovementDraft] = useState<StockMovement>(() => emptyStockMovement(data.stockItems[0]?.id))
  const [importText, setImportText] = useState('')
  const [parsedDraft, setParsedDraft] = useState<{ report: DailyReport; expenses: Expense[] } | null>(null)
  const [saveMessage, setSaveMessage] = useState('')
  const skipNextCloudSave = useRef(false)

  useEffect(() => {
    saveData(data)
  }, [data])

  useEffect(() => {
    saveCloudConfig(cloudConfig)
  }, [cloudConfig])

  useEffect(() => {
    let cancelled = false

    if (!cloudConfig.enabled) {
      setCloudLoaded(true)
      setCloudStatus('Local browser storage')
      return
    }

    setCloudLoaded(false)
    setCloudStatus('Loading shared Supabase data...')

    loadCloudData(cloudConfig)
      .then(async (row) => {
        if (cancelled) return

        if (row?.data) {
          const normalized = normalizeData(row.data)
          skipNextCloudSave.current = true
          setData(normalized)
          loadDraftForDate(reportDate, normalized)
          setCloudStatus(`Cloud sync on. Last cloud update: ${new Date(row.updated_at).toLocaleString('da-DK')}`)
        } else {
          await saveCloudData(cloudConfig, data)
          setCloudStatus('Cloud sync on. Seeded Supabase from this browser.')
        }

        setCloudLoaded(true)
      })
      .catch((error) => {
        if (cancelled) return
        setCloudLoaded(true)
        setCloudStatus(`Cloud sync error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      })

    return () => {
      cancelled = true
    }
  }, [cloudConfig.enabled, cloudConfig.supabaseAnonKey, cloudConfig.supabaseUrl])

  useEffect(() => {
    if (!cloudConfig.enabled || !cloudLoaded) return

    if (skipNextCloudSave.current) {
      skipNextCloudSave.current = false
      return
    }

    setCloudStatus('Saving to Supabase...')
    const timeout = window.setTimeout(() => {
      saveCloudData(cloudConfig, data)
        .then(() => setCloudStatus(`Cloud sync on. Saved ${new Date().toLocaleTimeString('da-DK')}`))
        .catch((error) => setCloudStatus(`Cloud save error: ${error instanceof Error ? error.message : 'Unknown error'}`))
    }, 700)

    return () => window.clearTimeout(timeout)
  }, [cloudConfig.enabled, cloudConfig.supabaseAnonKey, cloudConfig.supabaseUrl, cloudLoaded, data])

  const monthSummary = useMemo(() => calculateMonthlySummary(data, selectedMonth), [data, selectedMonth])
  const dashboardRange = useMemo(() => getDashboardRange(dashboardPeriod), [dashboardPeriod])
  const dashboardSummary = useMemo(
    () => calculateDateRangeSummary(data, dashboardRange.start, dashboardRange.end, dashboardRange.label),
    [dashboardRange.end, dashboardRange.label, dashboardRange.start, data],
  )
  const draftTotals = useMemo(
    () => calculateReportTotals(draftReport, data.products, draftExpenses, data.settings),
    [data.products, data.settings, draftExpenses, draftReport],
  )
  const lowStockItems = getLowStockItems(data)

  const updateProduct = (productId: string, patch: Partial<Product>) => {
    setData((current) => ({
      ...current,
      products: current.products.map((product) => (product.id === productId ? { ...product, ...patch } : product)),
    }))
  }

  const updateSettings = (patch: Partial<AppData['settings']>) => {
    setData((current) => ({ ...current, settings: { ...current.settings, ...patch } }))
  }

  const updateDraftQuantity = (productId: string, quantity: number) => {
    setDraftReport((current) => ({
      ...current,
      items: current.items.map((item) => (item.productId === productId ? { ...item, quantity } : item)),
    }))
  }

  const updateFlavor = (productId: string, flavor: string, quantity: number) => {
    setDraftReport((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.productId === productId
          ? {
              ...item,
              flavors: { ...(item.flavors ?? {}), [flavor]: quantity },
            }
          : item,
      ),
    }))
  }

  const saveDraftReport = () => {
    const report = {
      ...draftReport,
      id: data.dailyReports.find((entry) => entry.date === draftReport.date)?.id ?? `report-${draftReport.date}`,
      items: draftReport.items.map((item) => ({ ...item, quantity: Math.max(0, item.quantity || 0) })),
    }
    const expenses = draftExpenses.map((expense) => ({ ...expense, date: report.date, reportId: report.id, amount: Math.max(0, expense.amount || 0) }))

    setData((current) => ({
      ...current,
      dailyReports: [...current.dailyReports.filter((entry) => entry.date !== report.date), report].sort((a, b) => a.date.localeCompare(b.date)),
      expenses: [...current.expenses.filter((expense) => expense.reportId !== report.id), ...expenses],
    }))
    setSaveMessage(`Saved ${report.date}: ${formatKr(calculateReportTotals(report, data.products, expenses, data.settings).totalRevenue)}`)
    setTimeout(() => setSaveMessage(''), 2500)
  }

  const addDraftExpense = () => setDraftExpenses((current) => [...current, emptyExpense(draftReport.date, draftReport.id)])

  const updateDraftExpense = (expenseId: string, patch: Partial<Expense>) => {
    setDraftExpenses((current) => current.map((expense) => (expense.id === expenseId ? { ...expense, ...patch } : expense)))
  }

  const saveParsedDraft = () => {
    if (!parsedDraft) return
    setReportDate(parsedDraft.report.date)
    setDraftReport(parsedDraft.report)
    setDraftExpenses(parsedDraft.expenses)
    setActiveTab('daily')
  }

  const handleParse = () => {
    setParsedDraft(parseDailyReportText(importText, data))
  }

  const exportMonthlySummary = () => downloadCsv(`monthly-summary-${selectedMonth}.csv`, monthlySummaryRows(monthSummary))

  const handleTestCloud = async () => {
    setIsCloudBusy(true)
    setCloudStatus('Testing Supabase connection...')
    try {
      await testCloudConnection(cloudConfig)
      setCloudStatus('Supabase connection works.')
    } catch (error) {
      setCloudStatus(`Supabase connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsCloudBusy(false)
    }
  }

  const handleLoadCloud = async () => {
    setIsCloudBusy(true)
    setCloudStatus('Loading from Supabase...')
    try {
      const row = await loadCloudData(cloudConfig)
      if (row?.data) {
        const normalized = normalizeData(row.data)
        skipNextCloudSave.current = true
        setData(normalized)
        loadDraftForDate(reportDate, normalized)
        setCloudStatus(`Loaded shared data from ${new Date(row.updated_at).toLocaleString('da-DK')}`)
      } else {
        setCloudStatus('No shared data found yet. Use “Push this browser to cloud”.')
      }
    } catch (error) {
      setCloudStatus(`Could not load cloud data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsCloudBusy(false)
    }
  }

  const handlePushCloud = async () => {
    setIsCloudBusy(true)
    setCloudStatus('Pushing this browser data to Supabase...')
    try {
      await saveCloudData(cloudConfig, data)
      setCloudStatus(`Pushed this browser data to Supabase at ${new Date().toLocaleTimeString('da-DK')}`)
    } catch (error) {
      setCloudStatus(`Could not push cloud data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsCloudBusy(false)
    }
  }

  const addStockItem = (stockItem = emptyStockItem()) => {
    setData((current) => ({ ...current, stockItems: [stockItem, ...current.stockItems] }))
  }

  const addIceCreamTubStock = () => {
    addStockItem({
      ...emptyStockItem(`${selectedTubFlavor} ice cream tub`, 'tubs'),
      minimumStockLevel: 1,
      notes: 'Manual tub tracking. Update used stock when a tub is finished.',
    })
  }

  const removeStockItem = (item: StockItem) => {
    if (confirm(`Remove stock item “${item.name}”?`)) {
      setData((current) => ({
        ...current,
        stockItems: current.stockItems.filter((entry) => entry.id !== item.id),
        stockMovements: current.stockMovements.filter((movement) => movement.stockItemId !== item.id),
      }))
      setMovementDraft((current) => (current.stockItemId === item.id ? emptyStockMovement(data.stockItems.find((entry) => entry.id !== item.id)?.id) : current))
    }
  }

  const updateMovementDraft = (patch: Partial<StockMovement>) => {
    setMovementDraft((current) => ({ ...current, ...patch }))
  }

  const addStockMovement = () => {
    const stockItemId = movementDraft.stockItemId || data.stockItems[0]?.id
    if (!stockItemId || movementDraft.quantity <= 0) return
    const movement = { ...movementDraft, id: createId('movement'), stockItemId, quantity: Math.max(0, movementDraft.quantity || 0) }
    setData((current) => ({ ...current, stockMovements: [movement, ...current.stockMovements] }))
    setMovementDraft(emptyStockMovement(stockItemId))
  }

  const removeStockMovement = (movementId: string) => {
    setData((current) => ({ ...current, stockMovements: current.stockMovements.filter((movement) => movement.id !== movementId) }))
  }

  const saveExpenseDraft = (override?: Partial<Expense>) => {
    const expense = { ...expenseDraft, ...override, id: createId('expense'), amount: Math.max(0, override?.amount ?? expenseDraft.amount) }
    if (expense.amount <= 0) return
    setData((current) => ({ ...current, expenses: [expense, ...current.expenses] }))
    setExpenseDraft({ ...emptyExpense(expense.date), type: 'Other', description: 'Random item', paymentMethod: expense.paymentMethod })
  }

  const updateRecurringExpense = (expenseId: string, patch: Partial<RecurringExpense>) => {
    setData((current) => ({
      ...current,
      recurringExpenses: current.recurringExpenses.map((expense) => (expense.id === expenseId ? { ...expense, ...patch } : expense)),
    }))
  }

  const addRecurringExpense = () => {
    setData((current) => ({ ...current, recurringExpenses: [emptyRecurringExpense(), ...current.recurringExpenses] }))
  }

  const addRecurringExpenseForMonth = (recurring: RecurringExpense) => {
    if (!recurring.active || recurring.amount <= 0) return
    const expense: Expense = {
      id: createId('expense'),
      date: recurringExpenseDate(expenseMonth, recurring.dayOfMonth),
      type: recurring.type,
      description: recurring.description,
      amount: recurring.amount,
      paymentMethod: recurring.paymentMethod,
      notes: recurring.notes ? `Monthly: ${recurring.notes}` : 'Monthly expense',
    }
    setData((current) => ({ ...current, expenses: [expense, ...current.expenses] }))
  }

  const loadDraftForDate = (date: string, sourceData = data) => {
    const existing = sourceData.dailyReports.find((report) => report.date === date)
    const report = existing ?? emptyReportForDate(date, sourceData.products)
    setReportDate(date)
    setDraftReport({
      ...report,
      items: sourceData.products.map((product) => ({
        productId: product.id,
        quantity: report.items.find((item) => item.productId === product.id)?.quantity ?? 0,
        flavors: report.items.find((item) => item.productId === product.id)?.flavors ?? {},
      })),
    })
    setDraftExpenses(sourceData.expenses.filter((expense) => expense.reportId === report.id))
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <IceCreamBowl size={28} />
          </div>
          <div>
            <h1>{data.settings.businessName}</h1>
            <span>Daily booth reporting</span>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="App screens">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)} type="button">
                <Icon size={18} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </aside>

      <main className="content">
        {activeTab === 'dashboard' && (
          <Screen title="Dashboard" kicker={`${dashboardRange.start} to ${dashboardRange.end}`}>
            <div className="period-filter" role="group" aria-label="Dashboard period">
              {dashboardPeriods.map((period) => (
                <button
                  key={period.id}
                  className={dashboardPeriod === period.id ? 'active' : ''}
                  type="button"
                  onClick={() => setDashboardPeriod(period.id)}
                >
                  {period.label}
                </button>
              ))}
            </div>
            <div className="metrics-grid">
              <Metric label="Sales incl. moms" value={formatKr(dashboardSummary.totalRevenue, 0)} />
              <Metric label="Sales ex. moms" value={formatKr(dashboardSummary.netRevenue, 0)} />
              <Metric label="Expenses incl. moms" value={formatKr(dashboardSummary.expenses, 0)} tone={dashboardSummary.expenses > 0 ? 'warn' : 'neutral'} />
              <Metric label="Net profit ex. moms" value={formatKr(dashboardSummary.netProfit, 0)} tone={dashboardSummary.netProfit >= 0 ? 'good' : 'bad'} />
              <Metric label="Moms payable" value={formatKr(dashboardSummary.vatPayable, 0)} tone="warn" />
              <Metric label="Items sold" value={formatNumber(dashboardSummary.totalItems, 0)} />
              <Metric label="Best seller" value={dashboardSummary.bestSellingProduct} />
            </div>

            <div className="two-column">
              <Panel title="Low Stock Warnings" icon={<AlertTriangle size={18} />}>
                {lowStockItems.length === 0 ? (
                  <p className="muted">No low stock warnings right now.</p>
                ) : (
                  <div className="warning-list">
                    {lowStockItems.map(({ item, status }) => (
                      <div className="warning-row" key={item.id}>
                        <strong>{item.name}</strong>
                        <span>
                          {formatNumber(status.currentStock)} {item.unit}
                        </span>
                        <b>Order soon</b>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel title={`${dashboardRange.label} Snapshot`} icon={<BarChart3 size={18} />}>
                <MiniBars rows={dashboardSummary.productBreakdown.map((entry) => ({ label: entry.product, value: entry.quantity }))} />
              </Panel>
            </div>
          </Screen>
        )}

        {activeTab === 'daily' && (
          <Screen title="Daily Report" kicker="Fast entry with live profit calculations">
            <div className="toolbar">
              <label>
                Date
                <input type="date" value={reportDate} onChange={(event) => loadDraftForDate(event.target.value)} />
              </label>
              <button className="primary-button" type="button" onClick={saveDraftReport}>
                <Save size={18} />
                Save report
              </button>
              {saveMessage && <span className="save-message">{saveMessage}</span>}
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Sales incl. moms</th>
                    <th>Moms</th>
                    <th>Cost ex. moms</th>
                    <th>Profit ex. moms</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((product) => {
                    const item = draftReport.items.find((entry) => entry.productId === product.id)
                    const line = draftTotals.lines.find((entry) => entry.product.id === product.id)
                    return (
                      <tr key={product.id}>
                        <td>
                          <strong>{product.name}</strong>
                          <span className="subtle">{product.sellingPrice} kr. {data.settings.salesPricesIncludeVat ? 'incl.' : 'ex.'} moms</span>
                        </td>
                        <td>
                          <input
                            min="0"
                            type="number"
                            value={item?.quantity ?? 0}
                            onChange={(event) => updateDraftQuantity(product.id, numberValue(event.target.value))}
                          />
                        </td>
                        <td>{formatKr(line?.revenue ?? 0)}</td>
                        <td>{formatKr(line?.outputVat ?? 0)}</td>
                        <td>{formatKr(line?.netProductCost ?? 0)}</td>
                        <td className={(line?.grossProfit ?? 0) >= 0 ? 'positive' : 'negative'}>{formatKr(line?.grossProfit ?? 0)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Panel title="Optional Flavor Breakdown" icon={<IceCreamBowl size={18} />}>
              <div className="flavor-grid">
                {['1-kugle', '2-kugler', '3-kugler'].map((productId) => {
                  const product = data.products.find((entry) => entry.id === productId)
                  const item = draftReport.items.find((entry) => entry.productId === productId)
                  return (
                    <div className="flavor-card" key={productId}>
                      <h3>{product?.name}</h3>
                      {data.flavors.map((flavor) => (
                        <label key={flavor}>
                          {flavor}
                          <input
                            min="0"
                            type="number"
                            value={item?.flavors?.[flavor] ?? 0}
                            onChange={(event) => updateFlavor(productId, flavor, numberValue(event.target.value))}
                          />
                        </label>
                      ))}
                    </div>
                  )
                })}
              </div>
            </Panel>

            <div className="two-column">
              <Panel title="Expenses For This Day" icon={<WalletCards size={18} />}>
                <div className="stack">
                  {draftExpenses.map((expense) => (
                    <div className="expense-editor" key={expense.id}>
                      <select value={expense.type} onChange={(event) => updateDraftExpense(expense.id, { type: event.target.value as ExpenseType })}>
                        {expenseTypes.map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                      <input
                        placeholder="Description"
                        value={expense.description}
                        onChange={(event) => updateDraftExpense(expense.id, { description: event.target.value })}
                      />
                      <div className="money-input">
                        <input
                          aria-label="Expense amount in DKK"
                          inputMode="decimal"
                          min="0"
                          placeholder="0,00"
                          step="0.01"
                          type="number"
                          value={expense.amount}
                          onChange={(event) => updateDraftExpense(expense.id, { amount: numberValue(event.target.value) })}
                        />
                        <span>kr.</span>
                      </div>
                      <button type="button" onClick={() => setDraftExpenses((current) => current.filter((entry) => entry.id !== expense.id))}>
                        Remove
                      </button>
                    </div>
                  ))}
                  <button type="button" className="secondary-button" onClick={addDraftExpense}>
                    <Plus size={16} />
                    Add expense
                  </button>
                </div>
              </Panel>

              <Panel title="Live Totals" icon={<ReceiptText size={18} />}>
                <Totals totals={draftTotals} />
                <label className="notes-field">
                  Notes
                  <textarea value={draftReport.notes} onChange={(event) => setDraftReport((current) => ({ ...current, notes: event.target.value }))} />
                </label>
              </Panel>
            </div>
          </Screen>
        )}

        {activeTab === 'pricing' && (
          <Screen title="Product Pricing" kicker="Selling prices are seeded from your real menu">
            <Panel title="VAT and Guf Settings" icon={<Settings size={18} />}>
              <div className="settings-grid">
                <label className="inline-check setting-check">
                  <input
                    type="checkbox"
                    checked={data.settings.vatRegistered}
                    onChange={(event) => updateSettings({ vatRegistered: event.target.checked })}
                  />
                  VAT/moms registered
                </label>
                <label>
                  Moms %
                  <input type="number" min="0" value={data.settings.vatRate} onChange={(event) => updateSettings({ vatRate: numberValue(event.target.value) })} />
                </label>
                <label className="inline-check setting-check">
                  <input
                    type="checkbox"
                    checked={data.settings.salesPricesIncludeVat}
                    onChange={(event) => updateSettings({ salesPricesIncludeVat: event.target.checked })}
                  />
                  Sales prices include moms
                </label>
                <label className="inline-check setting-check">
                  <input
                    type="checkbox"
                    checked={data.settings.productCostsIncludeVat}
                    onChange={(event) => updateSettings({ productCostsIncludeVat: event.target.checked })}
                  />
                  Product costs include moms
                </label>
                <label className="inline-check setting-check">
                  <input
                    type="checkbox"
                    checked={data.settings.expensesIncludeVat}
                    onChange={(event) => updateSettings({ expensesIncludeVat: event.target.checked })}
                  />
                  Expenses include moms
                </label>
                <label>
                  Guf bucket price ex. moms
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={data.settings.gufBucketPriceExVat}
                    onChange={(event) => updateSettings({ gufBucketPriceExVat: numberValue(event.target.value) })}
                  />
                </label>
                <label>
                  Bucket price incl. moms
                  <input readOnly value={formatKr(getGufBucketPriceInclVat(data.settings))} />
                </label>
                <label>
                  Portions per guf spand
                  <input
                    type="number"
                    min="1"
                    value={data.settings.gufPortionsPerBucket}
                    onChange={(event) => updateSettings({ gufPortionsPerBucket: Math.max(1, numberValue(event.target.value)) })}
                  />
                </label>
              </div>
            </Panel>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Portion</th>
                    <th>Cost/unit entered</th>
                    <th>Price entered</th>
                    <th>Price ex. moms</th>
                    <th>Profit ex. moms</th>
                    <th>Margin ex. moms</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((product) => {
                    const cost = getProductCost(product, data.settings)
                    const sale = splitVat(product.sellingPrice, data.settings.salesPricesIncludeVat, data.settings)
                    const costSplit = splitVat(cost, data.settings.productCostsIncludeVat, data.settings)
                    const profit = sale.net - costSplit.net
                    const margin = sale.net ? profit / sale.net : 0
                    return (
                      <tr key={product.id}>
                        <td>
                          <input value={product.name} onChange={(event) => updateProduct(product.id, { name: event.target.value })} />
                          {product.costSource === 'gufSetting' && (
                            <label className="inline-check">
                              <input
                                type="checkbox"
                                checked={Boolean(product.manualCostOverride)}
                                onChange={(event) => updateProduct(product.id, { manualCostOverride: event.target.checked })}
                              />
                              Manual guf cost
                            </label>
                          )}
                        </td>
                        <td>
                          <select value={product.category} onChange={(event) => updateProduct(product.id, { category: event.target.value as Product['category'] })}>
                            <option>Softice</option>
                            <option>Kugleis</option>
                            <option>Topping</option>
                            <option>Add-on</option>
                          </select>
                        </td>
                        <td>
                          <input value={product.portionSize} onChange={(event) => updateProduct(product.id, { portionSize: event.target.value })} />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={product.costSource === 'gufSetting' && !product.manualCostOverride ? cost.toFixed(2) : product.costPerUnit}
                            disabled={product.costSource === 'gufSetting' && !product.manualCostOverride}
                            onChange={(event) => updateProduct(product.id, { costPerUnit: numberValue(event.target.value) })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={product.sellingPrice}
                            onChange={(event) => updateProduct(product.id, { sellingPrice: numberValue(event.target.value) })}
                          />
                        </td>
                        <td>{formatKr(sale.net)}</td>
                        <td className={profit >= 0 ? 'positive' : 'negative'}>{formatKr(profit)}</td>
                        <td>{formatNumber(margin * 100, 1)}%</td>
                        <td>
                          <input value={product.notes} onChange={(event) => updateProduct(product.id, { notes: event.target.value })} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Screen>
        )}

        {activeTab === 'expenses' && (
          <Screen title="Expenses" kicker="Fast expense entry and monthly recurring costs">
            <Panel title="Quick Add Expense" icon={<Plus size={18} />}>
              <div className="expense-quick-grid">
                <label>
                  Date
                  <input type="date" value={expenseDraft.date} onChange={(event) => setExpenseDraft((current) => ({ ...current, date: event.target.value }))} />
                </label>
                <label>
                  Type
                  <select value={expenseDraft.type} onChange={(event) => setExpenseDraft((current) => ({ ...current, type: event.target.value as ExpenseType }))}>
                    {expenseTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Description
                  <input value={expenseDraft.description} onChange={(event) => setExpenseDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Random item, receipt, supplier..." />
                </label>
                <label>
                  Amount
                  <div className="money-input">
                    <input
                      aria-label="Quick expense amount in DKK"
                      inputMode="decimal"
                      min="0"
                      placeholder="0,00"
                      step="0.01"
                      type="number"
                      value={expenseDraft.amount}
                      onChange={(event) => setExpenseDraft((current) => ({ ...current, amount: numberValue(event.target.value) }))}
                    />
                    <span>kr.</span>
                  </div>
                </label>
                <label>
                  Payment
                  <select value={expenseDraft.paymentMethod} onChange={(event) => setExpenseDraft((current) => ({ ...current, paymentMethod: event.target.value as PaymentMethod }))}>
                    {paymentMethods.map((method) => (
                      <option key={method}>{method}</option>
                    ))}
                  </select>
                </label>
                <button className="primary-button" type="button" disabled={expenseDraft.amount <= 0} onClick={() => saveExpenseDraft()}>
                  <Save size={16} />
                  Save expense
                </button>
              </div>
              <div className="quick-chip-row">
                <button type="button" onClick={() => setExpenseDraft((current) => ({ ...current, type: 'Cash register system', description: 'Cash register system', paymentMethod: 'Card' }))}>
                  Cash register
                </button>
                <button type="button" onClick={() => setExpenseDraft((current) => ({ ...current, type: 'Other', description: 'Random item' }))}>
                  Random item
                </button>
                <button type="button" onClick={() => setExpenseDraft((current) => ({ ...current, type: 'Toppings/guf', description: 'Toppings/guf' }))}>
                  Toppings/guf
                </button>
                <button type="button" onClick={() => setExpenseDraft((current) => ({ ...current, type: 'Ice cream purchase', description: 'Ice cream purchase' }))}>
                  Ice cream purchase
                </button>
              </div>
            </Panel>

            <Panel title="Monthly Expenses" icon={<ReceiptText size={18} />}>
              <div className="toolbar">
                <label>
                  Month to add
                  <input type="month" value={expenseMonth} onChange={(event) => setExpenseMonth(event.target.value)} />
                </label>
                <button className="secondary-button" type="button" onClick={addRecurringExpense}>
                  <Plus size={16} />
                  Add monthly expense
                </button>
              </div>
              <div className="recurring-list">
                {data.recurringExpenses.map((expense) => (
                  <div className="recurring-row" key={expense.id}>
                    <label className="inline-check recurring-active">
                      <input type="checkbox" checked={expense.active} onChange={(event) => updateRecurringExpense(expense.id, { active: event.target.checked })} />
                      Active
                    </label>
                    <select value={expense.type} onChange={(event) => updateRecurringExpense(expense.id, { type: event.target.value as ExpenseType })}>
                      {expenseTypes.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                    <input value={expense.description} onChange={(event) => updateRecurringExpense(expense.id, { description: event.target.value })} />
                    <div className="money-input">
                      <input
                        aria-label="Monthly expense amount in DKK"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        type="number"
                        value={expense.amount}
                        onChange={(event) => updateRecurringExpense(expense.id, { amount: numberValue(event.target.value) })}
                      />
                      <span>kr.</span>
                    </div>
                    <input
                      aria-label="Day of month"
                      min="1"
                      max="31"
                      type="number"
                      value={expense.dayOfMonth}
                      onChange={(event) => updateRecurringExpense(expense.id, { dayOfMonth: Math.min(31, Math.max(1, numberValue(event.target.value))) })}
                    />
                    <button className="primary-button" type="button" disabled={!expense.active || expense.amount <= 0} onClick={() => addRecurringExpenseForMonth(expense)}>
                      Add to month
                    </button>
                    <button
                      className="remove-button"
                      type="button"
                      onClick={() => setData((current) => ({ ...current, recurringExpenses: current.recurringExpenses.filter((entry) => entry.id !== expense.id) }))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Amount (DKK)</th>
                    <th>Amount incl. moms</th>
                    <th>Amount ex. moms</th>
                    <th>Moms</th>
                    <th>Payment</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.expenses.map((expense) => {
                    const expenseVat = splitVat(expense.amount, data.settings.expensesIncludeVat, data.settings)
                    return (
                    <tr key={expense.id}>
                      <td>
                        <input type="date" value={expense.date} onChange={(event) => updateExpense(expense.id, { date: event.target.value })} />
                      </td>
                      <td>
                        <select value={expense.type} onChange={(event) => updateExpense(expense.id, { type: event.target.value as ExpenseType })}>
                          {expenseTypes.map((type) => (
                            <option key={type}>{type}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input value={expense.description} onChange={(event) => updateExpense(expense.id, { description: event.target.value })} />
                      </td>
                      <td>
                        <div className="money-input">
                          <input
                            aria-label="Expense amount in DKK"
                            inputMode="decimal"
                            min="0"
                            placeholder="0,00"
                            step="0.01"
                            type="number"
                            value={expense.amount}
                            onChange={(event) => updateExpense(expense.id, { amount: numberValue(event.target.value) })}
                          />
                          <span>kr.</span>
                        </div>
                      </td>
                      <td>{formatKr(expenseVat.gross)}</td>
                      <td>{formatKr(expenseVat.net)}</td>
                      <td>{formatKr(expenseVat.vat)}</td>
                      <td>
                        <select value={expense.paymentMethod} onChange={(event) => updateExpense(expense.id, { paymentMethod: event.target.value as PaymentMethod })}>
                          {paymentMethods.map((method) => (
                            <option key={method}>{method}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input value={expense.notes} onChange={(event) => updateExpense(expense.id, { notes: event.target.value })} />
                      </td>
                      <td>
                        <button type="button" onClick={() => setData((current) => ({ ...current, expenses: current.expenses.filter((entry) => entry.id !== expense.id) }))}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </Screen>
        )}

        {activeTab === 'stock' && (
          <Screen title="Stock" kicker="Linked sales update used stock where possible">
            <Panel title="Add Stock Items" icon={<Plus size={18} />}>
              <div className="stock-actions">
                <button className="primary-button" type="button" onClick={() => addStockItem()}>
                  <Plus size={16} />
                  Add stock item
                </button>
                <label>
                  Ice cream tub flavor
                  <select value={selectedTubFlavor} onChange={(event) => setSelectedTubFlavor(event.target.value)}>
                    {data.flavors.map((flavor) => (
                      <option key={flavor}>{flavor}</option>
                    ))}
                  </select>
                </label>
                <button className="secondary-button" type="button" onClick={addIceCreamTubStock}>
                  <IceCreamBowl size={16} />
                  Add ice cream tub
                </button>
              </div>
              <p className="muted">Use separate stock rows for each tub flavor, cone type, topping, packaging item, or cleaning supply.</p>
            </Panel>

            <Panel title="Stock Movement Log" icon={<ReceiptText size={18} />}>
              <div className="movement-editor">
                <label>
                  Item
                  <select value={movementDraft.stockItemId || (data.stockItems[0]?.id ?? '')} onChange={(event) => updateMovementDraft({ stockItemId: event.target.value })}>
                    {data.stockItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Date
                  <input type="date" value={movementDraft.date} onChange={(event) => updateMovementDraft({ date: event.target.value })} />
                </label>
                <label>
                  Type
                  <select value={movementDraft.type} onChange={(event) => updateMovementDraft({ type: event.target.value as StockMovementType })}>
                    {stockMovementTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={movementDraft.quantity}
                    onChange={(event) => updateMovementDraft({ quantity: numberValue(event.target.value) })}
                  />
                </label>
                <label>
                  Notes
                  <input value={movementDraft.notes} onChange={(event) => updateMovementDraft({ notes: event.target.value })} placeholder="Invoice, waste, correction..." />
                </label>
                <button className="primary-button" type="button" disabled={!data.stockItems.length || movementDraft.quantity <= 0} onClick={addStockMovement}>
                  <Plus size={16} />
                  Add movement
                </button>
              </div>
              <div className="table-wrap movement-history">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Qty</th>
                      <th>Notes</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.stockMovements]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .slice(0, 8)
                      .map((movement) => (
                        <tr key={movement.id}>
                          <td>{movement.date}</td>
                          <td>{data.stockItems.find((item) => item.id === movement.stockItemId)?.name ?? 'Removed item'}</td>
                          <td>{movement.type}</td>
                          <td>{formatNumber(movement.quantity)}</td>
                          <td>{movement.notes}</td>
                          <td>
                            <button className="remove-button" type="button" onClick={() => removeStockMovement(movement.id)}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!data.stockMovements.length && <p className="muted empty-table-note">No stock movements yet.</p>}
              </div>
            </Panel>

            <div className="table-wrap stock-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="action-column">Action</th>
                    <th>Product / ingredient</th>
                    <th>Unit</th>
                    <th>Starting</th>
                    <th>Quick added</th>
                    <th>Logged added</th>
                    <th>Used/sold</th>
                    <th>Manual used</th>
                    <th>Current</th>
                    <th>Minimum</th>
                    <th>Alert</th>
                    <th>Linked product</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stockItems.map((item) => {
                    const stock = calculateStock(item, data.dailyReports, data.stockMovements)
                    return (
                      <tr key={item.id}>
                        <td className="action-column">
                          <button className="remove-button" type="button" onClick={() => removeStockItem(item)}>
                            Remove
                          </button>
                        </td>
                        <td>
                          <input value={item.name} onChange={(event) => updateStock(item.id, { name: event.target.value })} />
                        </td>
                        <td>
                          <input value={item.unit} onChange={(event) => updateStock(item.id, { unit: event.target.value })} />
                        </td>
                        <td>
                          <input type="number" min="0" value={item.startingStock} onChange={(event) => updateStock(item.id, { startingStock: numberValue(event.target.value) })} />
                        </td>
                        <td>
                          <input type="number" min="0" value={item.addedStock} onChange={(event) => updateStock(item.id, { addedStock: numberValue(event.target.value) })} />
                        </td>
                        <td>{formatNumber(stock.movementAdded)}</td>
                        <td>
                          {formatNumber(stock.usedStock)}
                          {item.linkedProductId && <span className="subtle">sales: {formatNumber(stock.linkedSales)}</span>}
                          {stock.movementRemoved > 0 && <span className="subtle">log: {formatNumber(stock.movementRemoved)}</span>}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={item.manualUsedStock}
                            onChange={(event) => updateStock(item.id, { manualUsedStock: numberValue(event.target.value) })}
                          />
                        </td>
                        <td>{formatNumber(stock.currentStock)}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={item.minimumStockLevel}
                            onChange={(event) => updateStock(item.id, { minimumStockLevel: numberValue(event.target.value) })}
                          />
                        </td>
                        <td>{stock.reorderAlert ? <span className="pill warn">Order soon</span> : <span className="pill ok">OK</span>}</td>
                        <td>
                          <select value={item.linkedProductId ?? ''} onChange={(event) => updateStock(item.id, { linkedProductId: event.target.value || undefined })}>
                            <option value="">Manual</option>
                            {data.products.map((product) => (
                              <option value={product.id} key={product.id}>
                                {product.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input value={item.notes} onChange={(event) => updateStock(item.id, { notes: event.target.value })} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Screen>
        )}

        {activeTab === 'summary' && (
          <Screen title="Monthly Summary" kicker="Revenue, costs, profit, and breakdown charts">
            <div className="toolbar">
              <label>
                Month
                <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
              </label>
              <button className="secondary-button" type="button" onClick={exportMonthlySummary}>
                <Download size={16} />
                Export month CSV
              </button>
            </div>
            <div className="metrics-grid">
              <Metric label="Sales incl. moms" value={formatKr(monthSummary.totalRevenue, 0)} />
              <Metric label="Sales ex. moms" value={formatKr(monthSummary.netRevenue, 0)} />
              <Metric label="Product cost ex. moms" value={formatKr(monthSummary.netProductCost, 0)} />
              <Metric label="Expenses ex. moms" value={formatKr(monthSummary.netExpenses, 0)} tone={monthSummary.netExpenses > 0 ? 'warn' : 'neutral'} />
              <Metric label="Gross profit ex. moms" value={formatKr(monthSummary.grossProfit, 0)} tone="good" />
              <Metric label="Net profit ex. moms" value={formatKr(monthSummary.netProfit, 0)} tone={monthSummary.netProfit >= 0 ? 'good' : 'bad'} />
              <Metric label="Moms payable" value={formatKr(monthSummary.vatPayable, 0)} tone="warn" />
              <Metric label="Best-selling product" value={monthSummary.bestSellingProduct} />
              <Metric label="Items sold" value={formatNumber(monthSummary.totalItems, 0)} />
              <Metric label="Average margin" value={`${formatNumber(monthSummary.averageProfitMargin * 100, 1)}%`} />
            </div>
            <div className="chart-grid">
              <Panel title="Daily Revenue" icon={<BarChart3 size={18} />}>
                <MiniBars rows={monthSummary.dailyRevenue.map((entry) => ({ label: entry.date.slice(8), value: entry.revenue, display: formatKr(entry.revenue, 0) }))} />
              </Panel>
              <Panel title="Product Sales" icon={<IceCreamBowl size={18} />}>
                <MiniBars rows={monthSummary.productBreakdown.map((entry) => ({ label: entry.product, value: entry.quantity }))} />
              </Panel>
              <Panel title="Expense Breakdown" icon={<WalletCards size={18} />}>
                <MiniBars rows={monthSummary.expenseBreakdown.map((entry) => ({ label: entry.type, value: entry.amount, display: formatKr(entry.amount, 0) }))} />
              </Panel>
            </div>
          </Screen>
        )}

        {activeTab === 'import' && (
          <Screen title="Import Daily Report" kicker="Paste a simple Danish or English text report">
            <Panel title="Paste report text" icon={<Upload size={18} />}>
              <textarea
                className="import-box"
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder="24/05: Alm. Softice 12, 1 Kugle 8, 2 Kugler 5, Guf 4, Drys 3, expenses 250 kr ice cream purchase"
              />
              <button className="primary-button" type="button" onClick={handleParse}>
                Parse report
              </button>
            </Panel>
            {parsedDraft && (
              <Panel title="Parsed Draft" icon={<ReceiptText size={18} />}>
                <p>
                  <strong>Date:</strong> {parsedDraft.report.date}
                </p>
                <div className="table-wrap compact">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedDraft.report.items
                        .filter((item) => item.quantity > 0)
                        .map((item) => (
                          <tr key={item.productId}>
                            <td>{data.products.find((product) => product.id === item.productId)?.name}</td>
                            <td>{item.quantity}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted">{parsedDraft.expenses.length} expense line(s) parsed.</p>
                <button className="primary-button" type="button" onClick={saveParsedDraft}>
                  Open as daily report draft
                </button>
              </Panel>
            )}
          </Screen>
        )}

        {activeTab === 'export' && (
          <Screen title="Export" kicker="Cloud sync, CSV, XLSX, and JSON backups">
            <Panel title="Shared Supabase Sync" icon={<Settings size={18} />}>
              <div className="cloud-panel">
                <div className="settings-grid cloud-settings">
                  <label>
                    Supabase project URL
                    <input
                      placeholder="https://your-project.supabase.co"
                      value={cloudConfig.supabaseUrl}
                      onChange={(event) => setCloudConfig((current) => ({ ...current, supabaseUrl: event.target.value }))}
                    />
                  </label>
                  <label>
                    Supabase anon public key
                    <input
                      type="password"
                      placeholder="eyJhbGciOi..."
                      value={cloudConfig.supabaseAnonKey}
                      onChange={(event) => setCloudConfig((current) => ({ ...current, supabaseAnonKey: event.target.value }))}
                    />
                  </label>
                  <label className="cloud-toggle">
                    <input
                      type="checkbox"
                      checked={cloudConfig.enabled}
                      onChange={(event) => setCloudConfig((current) => ({ ...current, enabled: event.target.checked }))}
                    />
                    Enable shared cloud sync
                  </label>
                </div>
                <div className="toolbar">
                  <button className="secondary-button" type="button" disabled={isCloudBusy} onClick={handleTestCloud}>
                    Test connection
                  </button>
                  <button className="secondary-button" type="button" disabled={isCloudBusy} onClick={handleLoadCloud}>
                    Load from cloud
                  </button>
                  <button className="primary-button" type="button" disabled={isCloudBusy} onClick={handlePushCloud}>
                    Push this browser to cloud
                  </button>
                </div>
                <p className={cloudStatus.includes('error') || cloudStatus.includes('failed') ? 'sync-status bad' : 'sync-status'}>{cloudStatus}</p>
                <p className="muted">
                  Run the SQL in <code>supabase-setup.sql</code> first. With no login, anyone who has the site and anon key can edit the shared booth data.
                </p>
              </div>
            </Panel>
            <div className="export-grid">
              <ExportButton label="Daily reports CSV" onClick={() => downloadCsv('daily-reports.csv', dailyReportsRows(data))} />
              <ExportButton label="Product pricing CSV" onClick={() => downloadCsv('product-pricing.csv', pricingRows(data))} />
              <ExportButton label="Expenses CSV" onClick={() => downloadCsv('expenses.csv', expensesRows(data))} />
              <ExportButton label="Stock CSV" onClick={() => downloadCsv('stock.csv', stockRows(data))} />
              <ExportButton label="Stock history CSV" onClick={() => downloadCsv('stock-history.csv', stockMovementRows(data))} />
              <ExportButton label="Monthly summary CSV" onClick={exportMonthlySummary} />
              <ExportButton label="Full backup JSON" onClick={() => downloadJsonBackup(data)} />
              <ExportButton label="Workbook XLSX" onClick={() => downloadWorkbook(data, selectedMonth)} icon={<FileSpreadsheet size={18} />} />
              <button
                type="button"
                className="danger-button"
                onClick={() => {
                  if (confirm('Reset all local data back to seed data? Export a backup first if needed.')) {
                    const seeded = resetData()
                    setData(seeded)
                    loadDraftForDate(toInputDate(), seeded)
                  }
                }}
              >
                <RotateCcw size={18} />
                Reset local data
              </button>
            </div>
          </Screen>
        )}
      </main>
    </div>
  )

  function updateExpense(expenseId: string, patch: Partial<Expense>) {
    setData((current) => ({
      ...current,
      expenses: current.expenses.map((expense) => (expense.id === expenseId ? { ...expense, ...patch } : expense)),
    }))
  }

  function updateStock(stockId: string, patch: Partial<StockItem>) {
    setData((current) => ({
      ...current,
      stockItems: current.stockItems.map((item) => (item.id === stockId ? { ...item, ...patch } : item)),
    }))
  }
}

function Screen({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <span>{kicker}</span>
          <h2>{title}</h2>
        </div>
      </header>
      {children}
    </section>
  )
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <header>
        {icon}
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'neutral' | 'good' | 'bad' | 'warn' }) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Totals({ totals }: { totals: ReturnType<typeof calculateReportTotals> }) {
  return (
    <div className="totals-list">
      <div>
        <span>Total revenue incl. moms</span>
        <strong>{formatKr(totals.totalRevenue)}</strong>
      </div>
      <div>
        <span>Revenue ex. moms</span>
        <strong>{formatKr(totals.netRevenue)}</strong>
      </div>
      <div>
        <span>Sales moms</span>
        <strong>{formatKr(totals.outputVat)}</strong>
      </div>
      <div>
        <span>Product cost ex. moms</span>
        <strong>{formatKr(totals.netProductCost)}</strong>
      </div>
      <div>
        <span>Product cost incl. moms</span>
        <strong>{formatKr(totals.totalProductCost)}</strong>
      </div>
      <div>
        <span>Gross profit ex. moms</span>
        <strong>{formatKr(totals.grossProfit)}</strong>
      </div>
      <div>
        <span>Expenses ex. moms</span>
        <strong>{formatKr(totals.netExpenses)}</strong>
      </div>
      <div>
        <span>Expenses incl. moms</span>
        <strong>{formatKr(totals.expenses)}</strong>
      </div>
      <div>
        <span>Moms payable</span>
        <strong className={totals.vatPayable >= 0 ? 'negative' : 'positive'}>{formatKr(totals.vatPayable)}</strong>
      </div>
      <div>
        <span>Net profit ex. moms</span>
        <strong className={totals.netProfit >= 0 ? 'positive' : 'negative'}>{formatKr(totals.netProfit)}</strong>
      </div>
    </div>
  )
}

function MiniBars({ rows }: { rows: { label: string; value: number; display?: string }[] }) {
  const max = Math.max(...rows.map((row) => row.value), 1)
  if (!rows.length) return <p className="muted">No data yet.</p>

  return (
    <div className="mini-bars">
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <span>{row.label}</span>
          <div>
            <i style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
          </div>
          <b>{row.display ?? formatNumber(row.value, 0)}</b>
        </div>
      ))}
    </div>
  )
}

function ExportButton({ label, onClick, icon = <Download size={18} /> }: { label: string; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button type="button" className="export-button" onClick={onClick}>
      {icon}
      {label}
    </button>
  )
}

export default App
