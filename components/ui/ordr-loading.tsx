'use client'

import { OrdrIcon } from '@/components/brand/ordr-brand'

export function OrdrLoading({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute -inset-4 rounded-[2rem] bg-primary/10 blur-2xl" />
          <OrdrIcon size="lg" spin ariaLabel="Carregando ORDR" />
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">Preparando sua operação</p>
        </div>
      </div>
    </div>
  )
}
