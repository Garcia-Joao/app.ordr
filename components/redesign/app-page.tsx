import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'

import { cn } from '@/lib/utils'

type PageAction = {
  label: string
  href?: string
  onClick?: () => void
  icon?: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
}

type AppPageProps = {
  eyebrow?: string
  title: string
  description?: string
  children: ReactNode
  actions?: PageAction[]
  className?: string
  contentClassName?: string
}

function getActionClassName(variant: PageAction['variant'] = 'primary') {
  if (variant === 'secondary') {
    return 'border border-white/10 bg-white/[0.06] text-foreground hover:bg-white/[0.1]'
  }

  if (variant === 'ghost') {
    return 'border border-transparent bg-transparent text-muted-foreground hover:bg-white/[0.06] hover:text-foreground'
  }

  return 'border border-primary/30 bg-primary text-primary-foreground shadow-[0_12px_34px_rgba(221,124,18,0.24)] hover:bg-primary/90'
}

export function AppPage({
  eyebrow,
  title,
  description,
  children,
  actions = [],
  className,
  contentClassName,
}: AppPageProps) {
  return (
    <section className={cn('ordr-page-shell', className)}>
      <div className="ordr-page-glow" aria-hidden="true" />

      <header className="ordr-page-header">
        <div className="min-w-0">
          {eyebrow && <p className="ordr-eyebrow">{eyebrow}</p>}
          <h1 className="ordr-page-title">{title}</h1>
          {description && <p className="ordr-page-description">{description}</p>}
        </div>

        {actions.length > 0 && (
          <div className="ordr-page-actions">
            {actions.map((action) => {
              const content = (
                <>
                  {action.icon}
                  <span>{action.label}</span>
                  {action.href && !action.icon && <ArrowUpRight className="h-4 w-4" />}
                </>
              )

              const className = cn('ordr-action-button', getActionClassName(action.variant))

              if (action.href) {
                return (
                  <a key={action.label} href={action.href} className={className}>
                    {content}
                  </a>
                )
              }

              return (
                <button key={action.label} type="button" onClick={action.onClick} className={className}>
                  {content}
                </button>
              )
            })}
          </div>
        )}
      </header>

      <div className={cn('ordr-page-content', contentClassName)}>{children}</div>
    </section>
  )
}
