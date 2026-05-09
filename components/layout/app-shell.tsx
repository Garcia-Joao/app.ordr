'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Sidebar } from './sidebar'
import { logout, me, updateMe } from '@/lib/api'
import { AccountMenu } from './account-menu'
import { AppToolbar } from './app-toolbar'
import { MobileBottomNav } from './mobile-bottom-nav'
import { OrdrLoading } from '@/components/ui/ordr-loading'
import {
  EditAccountModal,
  type EditableAccountData,
} from './edit-account-modal'

type ShellUser = {
  name?: string | null
  username: string
  phone?: string | null
  photoBase64?: string | null
  role?: string | null
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isLogin = pathname === '/login'

  const [currentUser, setCurrentUser] = useState<ShellUser | null>(null)
  const [time, setTime] = useState<Date | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(!isLogin)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSavingAccount, setIsSavingAccount] = useState(false)

  useEffect(() => {
    if (isLogin) return

    setTime(new Date())
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [isLogin])

  useEffect(() => {
    if (isLogin) return

    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [isLogin])

  useEffect(() => {
    if (isLogin) {
      setIsCheckingSession(false)
      return
    }

    async function loadSession() {
      try {
        setIsCheckingSession(true)

        const result = await me()

        const mappedUser: ShellUser = {
          name: result.user.name ?? null,
          username: result.user.username,
          phone: result.user.phone ?? null,
          photoBase64: result.user.photoBase64 ?? null,
          role: result.user.role ?? null,
        }

        setCurrentUser(mappedUser)
        localStorage.setItem('ordr-user', JSON.stringify(result.user))
        window.dispatchEvent(new Event('ordr-user-updated'))
      } catch {
        localStorage.removeItem('ordr-user')
        window.dispatchEvent(new Event('ordr-user-updated'))
        router.push('/login')
      } finally {
        setIsCheckingSession(false)
      }
    }

    loadSession()
  }, [isLogin, router])

  const handleLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true)
      await logout()
      localStorage.removeItem('ordr-user')
      window.dispatchEvent(new Event('ordr-user-updated'))
      setCurrentUser(null)
      window.location.href = '/login'
    } catch (error) {
      console.error('Erro ao deslogar:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }, [])

  const handleSaveAccount = useCallback(async (data: EditableAccountData) => {
    try {
      setIsSavingAccount(true)

      const result = await updateMe({
        name: data.name,
        phone: data.phone,
        photoBase64: data.photoBase64 || null,
        username: data.editUsername ? data.username : undefined,
        currentPassword:
          data.editUsername || data.editPassword
            ? data.currentPassword
            : undefined,
        newPassword: data.editPassword ? data.newPassword : undefined,
      })

      setCurrentUser({
        name: result.user.name ?? null,
        username: result.user.username,
        phone: result.user.phone ?? null,
        photoBase64: result.user.photoBase64 ?? null,
        role: result.user.role ?? null,
      })

      localStorage.setItem('ordr-user', JSON.stringify(result.user))
      window.dispatchEvent(new Event('ordr-user-updated'))
      setIsEditModalOpen(false)
    } catch (error) {
      console.error('Erro ao salvar conta:', error)
      alert(error instanceof Error ? error.message : 'Erro ao salvar conta')
    } finally {
      setIsSavingAccount(false)
    }
  }, [])

  const pageTitle = useMemo(() => {
    if (pathname === '/') return 'Ponto de Venda'
    if (pathname.startsWith('/interno')) return 'PDV Interno'
    if (pathname.startsWith('/produtos')) return 'Produtos'
    if (pathname.startsWith('/clientes')) return 'Clientes'
    if (pathname.startsWith('/relatorios')) return 'Relatórios'
    if (pathname.startsWith('/dispositivos')) return 'Dispositivos'
    if (pathname.startsWith('/estoque')) return 'Estoque'
    if (pathname.startsWith('/pessoas')) return 'Pessoas'
    if (pathname.startsWith('/eventos')) return 'Eventos'
    if (pathname.startsWith('/compras')) return 'Compras'
    if (pathname.startsWith('/acessos')) return 'Acessos'
    if (pathname.startsWith('/auditoria')) return 'Auditoria'
    return 'Ordr'
  }, [pathname])

  const editInitialData = useMemo<EditableAccountData>(() => {
    return {
      name: currentUser?.name ?? '',
      username: currentUser?.username ?? '',
      phone: currentUser?.phone ?? '',
      photoBase64: currentUser?.photoBase64 ?? '',
      editUsername: false,
      editPassword: false,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    }
  }, [currentUser])

  if (isLogin) {
    return <>{children}</>
  }

  if (isCheckingSession) {
    return <OrdrLoading label="Carregando ORDR..." />
  }

  return (
    <>
      <div className="flex h-dvh overflow-hidden">
        <div className="hidden lg:flex">
          <Sidebar />
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <AppToolbar
            title={pageTitle}
            currentUser={null}
            isOnline={isOnline}
            time={time}
            onLogout={handleLogout}
            isBusy={isLoggingOut}
            rightContent={null}
            accountContent={
              <AccountMenu
                user={currentUser}
                onLogout={handleLogout}
                onEditAccount={() => setIsEditModalOpen(true)}
                isBusy={isLoggingOut}
              />
            }
          />

          <main className="flex-1 min-h-0 overflow-auto pb-24 lg:pb-0">{children}</main>
          <MobileBottomNav />
        </div>
      </div>

      <EditAccountModal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        initialData={editInitialData}
        onSave={handleSaveAccount}
        isSaving={isSavingAccount}
      />
    </>
  )
}