import { strToU8, zipSync } from 'fflate'
import { calculateMonthlySummary, calculateReportTotals, calculateStock, formatKr, getProductCost } from './calculations'
import type { AppData, MonthlySummary } from './types'

const escapeCsv = (value: unknown) => {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const downloadFile = (fileName: string, contents: string | Blob, type: string) => {
  const blob = contents instanceof Blob ? contents : new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export const downloadCsv = (fileName: string, rows: Record<string, unknown>[]) => {
  const headers = Object.keys(rows[0] ?? { empty: '' })
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(','))].join('\n')
  downloadFile(fileName, csv, 'text/csv;charset=utf-8')
}

export const downloadJsonBackup = (data: AppData) => {
  downloadFile(`ice-cream-booth-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json')
}

export const dailyReportsRows = (data: AppData) =>
  data.dailyReports.flatMap((report) => {
    const totals = calculateReportTotals(report, data.products, data.expenses, data.settings)
    return totals.lines.map((line) => ({
      date: report.date,
      product: line.product.name,
      quantity: line.quantity,
      revenue: line.revenue,
      productCost: line.productCost,
      grossProfit: line.grossProfit,
      reportRevenue: totals.totalRevenue,
      reportNetProfit: totals.netProfit,
      notes: report.notes,
    }))
  })

export const pricingRows = (data: AppData) =>
  data.products.map((product) => {
    const cost = getProductCost(product, data.settings)
    const profit = product.sellingPrice - cost
    return {
      product: product.name,
      category: product.category,
      portionSize: product.portionSize,
      costPerUnit: cost,
      sellingPrice: product.sellingPrice,
      profitPerSale: profit,
      profitMargin: product.sellingPrice ? profit / product.sellingPrice : 0,
      notes: product.notes,
    }
  })

export const expensesRows = (data: AppData) =>
  data.expenses.map((expense) => ({
    date: expense.date,
    type: expense.type,
    description: expense.description,
    amount: expense.amount,
    paymentMethod: expense.paymentMethod,
    notes: expense.notes,
  }))

export const stockRows = (data: AppData) =>
  data.stockItems.map((item) => {
    const stock = calculateStock(item, data.dailyReports)
    return {
      product: item.name,
      unit: item.unit,
      startingStock: item.startingStock,
      addedStock: item.addedStock,
      usedSoldStock: stock.usedStock,
      currentStock: stock.currentStock,
      minimumStockLevel: item.minimumStockLevel,
      reorderAlert: stock.reorderAlert ? 'Order soon' : 'OK',
      notes: item.notes,
    }
  })

export const monthlySummaryRows = (summary: MonthlySummary) => [
  { metric: 'Total revenue', value: summary.totalRevenue, formatted: formatKr(summary.totalRevenue) },
  { metric: 'Total product cost', value: summary.totalProductCost, formatted: formatKr(summary.totalProductCost) },
  { metric: 'Total expenses', value: summary.expenses, formatted: formatKr(summary.expenses) },
  { metric: 'Gross profit', value: summary.grossProfit, formatted: formatKr(summary.grossProfit) },
  { metric: 'Net profit', value: summary.netProfit, formatted: formatKr(summary.netProfit) },
  { metric: 'Best-selling product', value: summary.bestSellingProduct, formatted: summary.bestSellingProduct },
  { metric: 'Total items sold', value: summary.totalItems, formatted: summary.totalItems },
  { metric: 'Average profit margin', value: summary.averageProfitMargin, formatted: `${Math.round(summary.averageProfitMargin * 100)}%` },
]

export const downloadWorkbook = (data: AppData, selectedMonth: string) => {
  const summary = calculateMonthlySummary(data, selectedMonth)
  const sheets = {
    DailyReports: dailyReportsRows(data),
    ProductPricing: pricingRows(data),
    Expenses: expensesRows(data),
    Stock: stockRows(data),
    MonthlySummary: monthlySummaryRows(summary),
  }

  downloadXlsx(`ice-cream-booth-${selectedMonth}.xlsx`, sheets)
}

const xml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const columnName = (index: number) => {
  let name = ''
  let current = index + 1
  while (current > 0) {
    const remainder = (current - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    current = Math.floor((current - 1) / 26)
  }
  return name
}

const sheetXml = (rows: Record<string, unknown>[]) => {
  const headers = Object.keys(rows[0] ?? { empty: '' })
  const allRows = [headers, ...rows.map((row) => headers.map((header) => row[header]))]
  const rowXml = allRows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const ref = `${columnName(columnIndex)}${rowIndex + 1}`
          if (typeof value === 'number') return `<c r="${ref}"><v>${Number.isFinite(value) ? value : 0}</v></c>`
          return `<c r="${ref}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`
        })
        .join('')
      return `<row r="${rowIndex + 1}">${cells}</row>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowXml}</sheetData>
</worksheet>`
}

const downloadXlsx = (fileName: string, sheets: Record<string, Record<string, unknown>[]>) => {
  const sheetEntries = Object.entries(sheets)
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheetEntries.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetEntries
    .map(([name], index) => `<sheet name="${xml(name).slice(0, 31)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join('')}</sheets>
</workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetEntries
    .map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
    .join('')}
</Relationships>`),
  }

  sheetEntries.forEach(([, rows], index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(sheetXml(rows))
  })

  const zipped = zipSync(files)
  downloadFile(fileName, new Blob([zipped], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}
