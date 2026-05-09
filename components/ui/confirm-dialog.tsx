'use client'

import { AlertTriangle, X } from 'lucide-react'

export type ConfirmDialogState = {
  visible: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  onConfirm?: () => void | Promise<void>
}

export function ConfirmDialog({
  dialog,
  onClose,
}: {
  dialog: ConfirmDialogState
  onClose: () => void
}) {
  if (!dialog.visible) return null

  const isDanger = dialog.variant === 'danger'

  async function handleConfirm() {
    await dialog.onConfirm?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md animate-in zoom-in-95 slide-in-from-bottom-2 rounded-2xl border border-border bg-card p-5 shadow-2xl duration-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                isDanger
                  ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground">
                {dialog.title}
              </h2>

              {dialog.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {dialog.description}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm font-medium text-foreground transition hover:bg-secondary"
          >
            {dialog.cancelLabel ?? 'Cancelar'}
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className={`h-10 rounded-xl px-4 text-sm font-semibold transition ${
              isDanger
                ? 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {dialog.confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}