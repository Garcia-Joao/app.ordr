import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  className,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: ElementType
  trend?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('ordr-stat-card', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <div className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">{value}</div>
        </div>
        {Icon && (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      {(hint || trend) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          {hint && <p className="text-muted-foreground">{hint}</p>}
          {trend && <div className="font-bold text-primary">{trend}</div>}
        </div>
      )}
    </div>
  )
}
