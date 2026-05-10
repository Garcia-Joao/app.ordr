import { apiFetch } from './client'

export type DeviceType = 'DESKTOP' | 'MOBILE' | 'TABLET' | 'UNKNOWN'
export type DeviceStatus = 'online' | 'offline'

export type CompanyDevice = {
  id: string
  name: string
  type: DeviceType
  browser?: string | null
  os?: string | null
  userAgent?: string | null
  ipAddress?: string | null
  firstSeenAt: string
  lastSeenAt: string
  status: DeviceStatus
  currentUser?: {
    id: string
    username: string
    name?: string | null
  } | null
  salesCount: number
  totalSales: number
}

export type DeviceHeartbeatInput = {
  deviceId?: string | null
  name: string
  type: DeviceType
  browser?: string | null
  os?: string | null
  userAgent?: string | null
}

export function listDevices() {
  return apiFetch<{ devices: CompanyDevice[] }>('/devices', {
    method: 'GET',
  })
}

export function heartbeatDevice(data: DeviceHeartbeatInput) {
  return apiFetch<{ device: Pick<CompanyDevice, 'id' | 'name' | 'type' | 'status' | 'lastSeenAt' | 'currentUser'> }>('/devices/heartbeat', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function deleteDevice(deviceId: string) {
  return apiFetch<{ ok: true }>(`/devices/${deviceId}`, {
    method: 'DELETE',
  })
}
