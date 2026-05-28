import { seedData } from './data'
import type { AppData, CloudConfig } from './types'

const STORAGE_KEY = 'ice-cream-booth-data-v1'
const CLOUD_CONFIG_KEY = 'ice-cream-booth-cloud-config-v1'
const OLD_BUSINESS_NAMES = new Set(['Isvognen / Ice Cream Booth', 'Ice Cream Booth', 'Ice Cream Booth Tycoon'])

export const cloneSeedData = (): AppData => JSON.parse(JSON.stringify(seedData)) as AppData

export const normalizeData = (data: Partial<AppData>): AppData => {
  const seed = cloneSeedData()
  const savedSettings = data.settings ?? {}
  const shouldMigrateShopQuestGoal = savedSettings.shopQuestGoalVersion !== seed.settings.shopQuestGoalVersion
  const stockItems = (data.stockItems ?? seed.stockItems).map((item) => ({ ...item, costPerUnit: item.costPerUnit ?? 0 }))
  const dailyReportsByDate = new Map(seed.dailyReports.map((report) => [report.date, report]))
  const savedDailyReports = data.dailyReports ?? []
  savedDailyReports.forEach((report) => dailyReportsByDate.set(report.date, report))
  const dailyReports = [...dailyReportsByDate.values()].sort((a, b) => a.date.localeCompare(b.date))

  return {
    ...seed,
    ...data,
    dailyReports,
    stockItems,
    settings: {
      ...seed.settings,
      ...savedSettings,
      dailyRevenueGoal: shouldMigrateShopQuestGoal ? seed.settings.dailyRevenueGoal : (savedSettings.dailyRevenueGoal ?? seed.settings.dailyRevenueGoal),
      businessName: !savedSettings.businessName || OLD_BUSINESS_NAMES.has(savedSettings.businessName) ? seed.settings.businessName : savedSettings.businessName,
      shopQuestGoalVersion: seed.settings.shopQuestGoalVersion,
    },
  }
}

export const loadData = (): AppData => {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return cloneSeedData()

  try {
    return normalizeData(JSON.parse(stored) as AppData)
  } catch {
    return cloneSeedData()
  }
}

export const saveData = (data: AppData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export const resetData = () => {
  localStorage.removeItem(STORAGE_KEY)
  return cloneSeedData()
}

export const loadCloudConfig = (): CloudConfig => {
  const stored = localStorage.getItem(CLOUD_CONFIG_KEY)
  if (!stored) return { enabled: false, supabaseUrl: '', supabaseAnonKey: '' }

  try {
    return { enabled: false, supabaseUrl: '', supabaseAnonKey: '', ...(JSON.parse(stored) as CloudConfig) }
  } catch {
    return { enabled: false, supabaseUrl: '', supabaseAnonKey: '' }
  }
}

export const saveCloudConfig = (config: CloudConfig) => {
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config))
}
