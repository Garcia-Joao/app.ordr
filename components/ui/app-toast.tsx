'use client'

import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react'

export type AppToastType = 'success' | 'error' | 'warning' | 'info'

export type AppToastState = {
  visible: boolean
  title: string
  description?: string
  type?: AppToastType
}

const toastConfig = {
  success: {
    icon: CheckCircle2,
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200',
    iconClassName: 'text-emerald-600 dark:text-emerald-300',
  },
  error: {
    icon: XCircle,
    className:
      'border-red-200 bg-red-50 text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200',
    iconClassName: 'text-red-600 dark:text-red-300',
  },
  warning: {
    icon: AlertTriangle,
    className:
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200',
    iconClassName: 'text-amber-600 dark:text-amber-300',
  },
  info: {
    icon: Info,
    className:
      'border-border bg-card text-foreground dark:border-border dark:bg-card dark:text-foreground',
    iconClassName: 'text-primary',
  },
} satisfies Record<
  AppToastType,
  {
    icon: React.ElementType
    className: string
    iconClassName: string
  }
>

export function AppToast({
  toast,
  onClose,
}: {
  toast: AppToastState
  onClose: () => void
}) {
  if (!toast.visible) return null

  const type = toast.type ?? 'info'
  const config = toastConfig[type]
  const Icon = config.icon

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-[360px] max-w-[calc(100vw-2rem)] animate-in slide-in-from-right-4 fade-in duration-200">
      <div
        className={`pointer-events-auto w-full rounded-2xl border p-4 shadow-2xl backdrop-blur ${config.className}`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            <Icon className={`h-5 w-5 ${config.iconClassName}`} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{toast.title}</p>

            {toast.description && (
              <p className="mt-1 text-sm opacity-80">{toast.description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            aria-label="Fechar notificação"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}