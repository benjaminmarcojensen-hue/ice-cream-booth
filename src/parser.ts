import { expenseTypes } from './data'
import type { AppData, DailyReport, Expense, ExpenseType } from './types'

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const productAliases: Record<string, string[]> = {
  'alm-softice': ['alm softice', 'almindelig softice', 'regular softice', 'softice normal'],
  'lille-softice': ['lille softice', 'small softice'],
  '1-kugle': ['1 kugle', 'en kugle', 'one scoop', '1 scoop'],
  '2-kugler': ['2 kugler', 'to kugler', 'two scoops', '2 scoops'],
  '3-kugler': ['3 kugler', 'tre kugler', 'three scoops', '3 scoops'],
  drys: ['drys', 'sprinkles'],
  flodeskum: ['flodeskum', 'flødeskum', 'whipped cream'],
  syltetoj: ['syltetoj', 'syltetøj', 'jam'],
  'softice-topping': ['softice topping', 'topping'],
  guf: ['guf', 'marshmallow topping'],
}

const parseDate = (input: string) => {
  const match = input.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (!match) return new Date().toISOString().slice(0, 10)

  const day = match[1].padStart(2, '0')
  const month = match[2].padStart(2, '0')
  const currentYear = String(new Date().getFullYear())
  const rawYear = match[3] ?? currentYear
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
  return `${year}-${month}-${day}`
}

const findProductId = (segment: string, data: AppData) => {
  const normalizedSegment = normalize(segment)
  const productsByName = data.products.map((product) => ({
    id: product.id,
    names: [product.name, ...(productAliases[product.id] ?? [])].map(normalize),
  }))

  return productsByName.find((product) => product.names.some((name) => normalizedSegment.includes(name)))?.id
}

const findExpenseType = (segment: string): ExpenseType => {
  const normalizedSegment = normalize(segment)
  return expenseTypes.find((type) => normalizedSegment.includes(normalize(type))) ?? 'Other'
}

export const parseDailyReportText = (input: string, data: AppData) => {
  const date = parseDate(input)
  const items = new Map<string, number>()
  const expenses: Expense[] = []
  const segments = input
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\s*:?\s*/g, '')
    .split(/,|;/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  segments.forEach((segment) => {
    const amountMatches = [...segment.matchAll(/(-?\d+(?:[.,]\d+)?)/g)]
    const amountMatch = amountMatches.at(-1)
    if (!amountMatch) return

    const value = Number(amountMatch[1].replace(',', '.'))
    if (!Number.isFinite(value) || value < 0) return

    if (/expense|expenses|udgift|udgifter|kr|kroner/i.test(segment)) {
      expenses.push({
        id: `expense-${Date.now()}-${expenses.length}`,
        date,
        type: findExpenseType(segment),
        description: segment.replace(amountMatch[0], '').replace(/expenses?|udgifter?|kr|kroner/gi, '').trim(),
        amount: value,
        paymentMethod: 'Other',
        notes: 'Imported from text report.',
      })
      return
    }

    const productId = findProductId(segment, data)
    if (productId) items.set(productId, (items.get(productId) ?? 0) + value)
  })

  const report: DailyReport = {
    id: `report-${date}`,
    date,
    items: data.products.map((product) => ({
      productId: product.id,
      quantity: items.get(product.id) ?? 0,
    })),
    notes: `Imported from: ${input}`,
  }

  return { report, expenses }
}
