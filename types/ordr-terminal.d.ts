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
        isPackaged?: boolean
      }>

      getPrinters: () => Promise<Array<{
        name: string
        displayName?: string | null
        description?: string | null
        isDefault?: boolean | null
        source?: string | null
      }>>

      apiFetch: <T>(payload: {
        url: string
        method?: string
        body?: unknown
        token?: string | null
      }) => Promise<T>

      printText: (payload: {
        printerName: string
        text?: string
        content?: string
      }) => Promise<{ ok: boolean }>

      shutdown: () => Promise<{ ok: boolean }>

      getStartupEnabled: () => Promise<boolean>
      setStartupEnabled: (enabled: boolean) => Promise<{ enabled: boolean }>

      saveSession: (payload: unknown) => Promise<{ ok: boolean }>
      loadSession: <T = unknown>() => Promise<T | null>
      clearSession: () => Promise<{ ok: boolean }>

      onLaunchToken: (callback: (launchToken: string) => void) => () => void
    }
  }
}
