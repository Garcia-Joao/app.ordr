import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Surface({
  children,
  className,
  compact = false,
}: {
  children: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn('ordr-surface', compact ? 'p-4' : 'p-5 sm:p-6', className)}>
      {children}
    </div>
  )
}

export function SurfaceHeader({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-black tracking-tight text-foreground sm:text-lg">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
