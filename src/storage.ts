import { seedData } from './data'
import type { AppData, CloudConfig } from './types'

const STORAGE_KEY = 'ice-cream-booth-data-v1'
const CLOUD_CONFIG_KEY = 'ice-cream-booth-cloud-config-v1'

export const cloneSeedData = (): AppData => JSON.parse(JSON.stringify(seedData)) as AppData

export const loadData = (): AppData => {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return cloneSeedData()

  try {
    return { ...cloneSeedData(), ...(JSON.parse(stored) as AppData) }
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
