import { strToU8, zipSync } from 'fflate'
import { calculateMonthlySummary, calculateReportTotals, calculateStock, formatKr, getProductCost, splitVat } from './calculations'
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
      salesInclVat: line.revenue,
      salesExVat: line.netRevenue,
      outputVat: line.outputVat,
      productCostInclVat: line.productCost,
      productCostExVat: line.netProductCost,
      inputVatProductCost: line.inputVat,
      grossProfitExVat: line.grossProfit,
      reportSalesInclVat: totals.totalRevenue,
      reportSalesExVat: totals.netRevenue,
      reportOutputVat: totals.outputVat,
      reportVatPayable: totals.vatPayable,
      reportNetProfitExVat: totals.netProfit,
      notes: report.notes,
    }))
  })

export const pricingRows = (data: AppData) =>
  data.products.map((product) => {
    const cost = getProductCost(product, data.settings)
    const sale = splitVat(product.sellingPrice, data.settings.salesPricesIncludeVat, data.settings)
    const costSplit = splitVat(cost, data.settings.productCostsIncludeVat, data.settings)
    const profit = sale.net - costSplit.net
    return {
      product: product.name,
      category: product.category,
      portionSize: product.portionSize,
      costEntered: cost,
      costInclVat: costSplit.gross,
      costExVat: costSplit.net,
      inputVat: costSplit.vat,
      sellingPriceEntered: product.sellingPrice,
      sellingPriceInclVat: sale.gross,
      sellingPriceExVat: sale.net,
      outputVat: sale.vat,
      profitPerSaleExVat: profit,
      profitMarginExVat: sale.net ? profit / sale.net : 0,
      notes: product.notes,
    }
  })

export const expensesRows = (data: AppData) =>
  data.expenses.map((expense) => {
    const split = splitVat(expense.amount, data.settings.expensesIncludeVat, data.settings)
    return {
      date: expense.date,
      type: expense.type,
      description: expense.description,
      amountEntered: expense.amount,
      amountInclVat: split.gross,
      amountExVat: split.net,
      inputVat: split.vat,
      paymentMethod: expense.paymentMethod,
      notes: expense.notes,
    }
  })

export const stockRows = (data: AppData) =>
  data.stockItems.map((item) => {
    const stock = calculateStock(item, data.dailyReports, data.stockMovements)
    return {
      product: item.name,
      unit: item.unit,
      startingStock: item.startingStock,
      quickAddedStock: item.addedStock,
      loggedAddedStock: stock.movementAdded,
      linkedSalesUsage: stock.linkedSales,
      loggedRemovedStock: stock.movementRemoved,
      manualUsedStock: item.manualUsedStock,
      usedSoldStock: stock.usedStock,
      currentStock: stock.currentStock,
      minimumStockLevel: item.minimumStockLevel,
      costPerUnit: item.costPerUnit,
      stockValue: Math.max(0, stock.currentStock) * item.costPerUnit,
      reorderAlert: stock.reorderAlert ? 'Order soon' : 'OK',
      notes: item.notes,
    }
  })

export const stockMovementRows = (data: AppData) =>
  data.stockMovements.map((movement) => ({
    date: movement.date,
    product: data.stockItems.find((item) => item.id === movement.stockItemId)?.name ?? 'Removed item',
    type: movement.type,
    quantity: movement.quantity,
    notes: movement.notes,
  }))

export const monthlySummaryRows = (summary: MonthlySummary) => [
  { metric: 'Sales incl. moms', value: summary.totalRevenue, formatted: formatKr(summary.totalRevenue) },
  { metric: 'Sales ex. moms', value: summary.netRevenue, formatted: formatKr(summary.netRevenue) },
  { metric: 'Sales moms', value: summary.outputVat, formatted: formatKr(summary.outputVat) },
  { metric: 'Product cost incl. moms', value: summary.totalProductCost, formatted: formatKr(summary.totalProductCost) },
  { metric: 'Product cost ex. moms', value: summary.netProductCost, formatted: formatKr(summary.netProductCost) },
  { metric: 'Product cost moms', value: summary.inputVatProductCosts, formatted: formatKr(summary.inputVatProductCosts) },
  { metric: 'Expenses incl. moms', value: summary.expenses, formatted: formatKr(summary.expenses) },
  { metric: 'Expenses ex. moms', value: summary.netExpenses, formatted: formatKr(summary.netExpenses) },
  { metric: 'Expense moms', value: summary.inputVatExpenses, formatted: formatKr(summary.inputVatExpenses) },
  { metric: 'Moms payable', value: summary.vatPayable, formatted: formatKr(summary.vatPayable) },
  { metric: 'Gross profit ex. moms', value: summary.grossProfit, formatted: formatKr(summary.grossProfit) },
  { metric: 'Net profit ex. moms', value: summary.netProfit, formatted: formatKr(summary.netProfit) },
  { metric: 'Best-selling product', value: summary.bestSellingProduct, formatted: summary.bestSellingProduct },
  { metric: 'Total items sold', value: summary.totalItems, formatted: summary.totalItems },
  { metric: 'Average profit margin ex. moms', value: summary.averageProfitMargin, formatted: `${Math.round(summary.averageProfitMargin * 100)}%` },
]

export const downloadWorkbook = (data: AppData, selectedMonth: string) => {
  const summary = calculateMonthlySummary(data, selectedMonth)
  const sheets = {
    DailyReports: dailyReportsRows(data),
    ProductPricing: pricingRows(data),
    Expenses: expensesRows(data),
    Stock: stockRows(data),
    StockHistory: stockMovementRows(data),
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
