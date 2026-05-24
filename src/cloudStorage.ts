import type { AppData, CloudConfig } from './types'

const TABLE_NAME = 'ice_cream_app_state'
const ROW_ID = 'default'

const cleanUrl = (url: string) => url.trim().replace(/\/$/, '')

const request = async (config: CloudConfig, path: string, init: RequestInit = {}) => {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error('Missing Supabase URL or anon key.')
  }

  const response = await fetch(`${cleanUrl(config.supabaseUrl)}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Supabase request failed with ${response.status}`)
  }

  return response
}

export const loadCloudData = async (config: CloudConfig) => {
  const response = await request(config, `${TABLE_NAME}?id=eq.${ROW_ID}&select=data,updated_at`)
  const rows = (await response.json()) as { data: AppData; updated_at: string }[]
  return rows[0] ?? null
}

export const saveCloudData = async (config: CloudConfig, data: AppData) => {
  await request(config, TABLE_NAME, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ id: ROW_ID, data }),
  })
}

export const testCloudConnection = async (config: CloudConfig) => {
  await request(config, `${TABLE_NAME}?id=eq.${ROW_ID}&select=id&limit=1`)
}
