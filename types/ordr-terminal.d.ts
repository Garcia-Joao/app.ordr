export {}

declare global {
  interface Window {
    ordrTerminal?: {
      isElectron: boolean
      getDeviceInfo: () => Promise<{
        platform: string
        arch: string
        hostname: string
        release: string
        username: string
        isElectron: boolean
      }>
      getPrinters: () => Promise<Array<{
        name: string
        displayName?: string | null
        description?: string | null
        isDefault?: boolean | null
      }>>
    }
  }
}
