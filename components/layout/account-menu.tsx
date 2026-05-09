'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  LogOut,
  Pencil,
  Shield,
  User as UserIcon,
} from 'lucide-react'

type AccountMenuUser = {
  name?: string | null
  username: string
  phone?: string | null
  photoBase64?: string | null
  role?: string | null
}

type AccountMenuProps = {
  user: AccountMenuUser | null
  onLogout: () => void | Promise<void>
  onEditAccount: () => void
  isBusy?: boolean
}

function getDisplayName(user: AccountMenuUser | null) {
  if (!user) return 'Conta'
  return user.name?.trim() || user.username
}

function getInitial(user: AccountMenuUser | null) {
  const base = getDisplayName(user)
  return base.charAt(0).toUpperCase()
}

export function AccountMenu({
  user,
  onLogout,
  onEditAccount,
  isBusy = false,
}: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-xl border border-border bg-background p-1.5 transition-colors hover:bg-accent sm:gap-3 sm:px-3 sm:py-2"
      >
        {user?.photoBase64 ? (
          <img
            src={user.photoBase64}
            alt={getDisplayName(user)}
            className="h-8 w-8 rounded-full border border-border object-cover sm:h-9 sm:w-9"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-primary/10 text-sm font-semibold text-primary sm:h-9 sm:w-9">
            {getInitial(user)}
          </div>
        )}

        <div className="hidden flex-col items-start leading-none sm:flex">
          <span className="text-sm font-medium text-foreground max-w-[160px] truncate">
            {getDisplayName(user)}
          </span>
          <span className="text-xs text-muted-foreground max-w-[160px] truncate">
            @{user?.username ?? 'carregando'}
          </span>
        </div>

        <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
      </button>

      {isOpen && (
        <div className="fixed inset-x-3 top-16 z-50 max-h-[80dvh] overflow-y-auto rounded-2xl border border-border bg-card shadow-xl sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
          <div className="p-4 border-b border-border">
            <div className="flex items-start gap-3">
              {user?.photoBase64 ? (
                <img
                  src={user.photoBase64}
                  alt={getDisplayName(user)}
                  className="h-14 w-14 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold border border-border shrink-0">
                  {getInitial(user)}
                </div>
              )}

              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {getDisplayName(user)}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  @{user?.username ?? '---'}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {user?.phone?.trim() || 'Sem número cadastrado'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-2 border-b border-border">
            <div className="flex items-start gap-3 rounded-xl px-3 py-2">
              <Shield className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Detalhes da conta
                </p>
                <p className="text-xs text-muted-foreground">
                  Permissões: {user?.role ?? 'indefinido'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl px-3 py-2">
              <UserIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Nome</p>
                <p className="text-sm text-foreground truncate">
                  {user?.name?.trim() || 'Não definido'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl px-3 py-2">
              <UserIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Número</p>
                <p className="text-sm text-foreground truncate">
                  {user?.phone?.trim() || 'Não definido'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-2">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                onEditAccount()
              }}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Editar conta
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                onLogout()
              }}
              disabled={isBusy}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}