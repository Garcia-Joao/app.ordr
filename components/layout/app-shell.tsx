'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Sidebar } from './sidebar'
import { heartbeatDevice, logout, me, updateMe, type AuthCompany } from '@/lib/api'
import { getDeviceHeartbeatPayload, setStoredDeviceId } from '@/lib/device-identity'
import { AccountMenu } from './account-menu'
import { AppToolbar } from './app-toolbar'
import { MobileBottomNav } from './mobile-bottom-nav'
import { OrdrLoading } from '@/components/ui/ordr-loading'
import { AlertTriangle, Building2, CalendarClock, FlaskConical, Settings, X } from 'lucide-react'
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

function normalizePathname(pathname: string | null) {
  if (!pathname) return '/'

  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }

  return pathname
}

function isAuthSessionError(error: unknown) {
  const message = String(error instanceof Error ? error.message : error ?? '')

  return (
    message.includes('UNAUTHORIZED') ||
    message.includes('Unauthorized') ||
    message.includes('401') ||
    message.includes('Não autenticado') ||
    message.includes('Sessão expirada')
  )
}

function restoreCachedSession() {
  if (typeof window === 'undefined') return null

  const cachedUser = localStorage.getItem('ordr-user')
  if (!cachedUser) return null

  try {
    const parsedUser = JSON.parse(cachedUser)

    return {
      user: {
        name: parsedUser.name ?? null,
        username: parsedUser.username,
        phone: parsedUser.phone ?? null,
        photoBase64: parsedUser.photoBase64 ?? null,
        role: parsedUser.role ?? null,
      } satisfies ShellUser,
      company:
        parsedUser.currentCompany ??
        parsedUser.companies?.find((company: AuthCompany) => company.id === parsedUser.companyId) ??
        null,
    }
  } catch {
    return null
  }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const normalizedPathname = normalizePathname(pathname)
  const isPublicRoute =
    normalizedPathname === '/' || normalizedPathname === '/login'

  const [currentUser, setCurrentUser] = useState<ShellUser | null>(null)
  const [currentCompany, setCurrentCompany] = useState<AuthCompany | null>(null)
  const [time, setTime] = useState<Date | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(!isPublicRoute)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSavingAccount, setIsSavingAccount] = useState(false)
  const [isLicenseAlertDismissed, setIsLicenseAlertDismissed] = useState(false)

  useEffect(() => {
    if (isPublicRoute) {
      setIsCheckingSession(false)
      return
    }

    setTime(new Date())

    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [isPublicRoute])


  useEffect(() => {
    if (isPublicRoute) return

    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [isPublicRoute])

  useEffect(() => {
    if (isPublicRoute) {
      setIsCheckingSession(false)
      return
    }

    let isMounted = true

    async function loadSession() {
      try {
        setIsCheckingSession(true)

        const result = await me()

        if (!isMounted) return

        const mappedUser: ShellUser = {
          name: result.user.name ?? null,
          username: result.user.username,
          phone: result.user.phone ?? null,
          photoBase64: result.user.photoBase64 ?? null,
          role: result.user.role ?? null,
        }

        setCurrentUser(mappedUser)
        setCurrentCompany(result.user.currentCompany ?? result.user.companies?.find((company) => company.id === result.user.companyId) ?? null)
        localStorage.setItem('ordr-user', JSON.stringify(result.user))
        window.dispatchEvent(new Event('ordr-user-updated'))
      } catch (error) {
        if (!isMounted) return

        if (isAuthSessionError(error)) {
          setCurrentUser(null)
          setCurrentCompany(null)
          localStorage.removeItem('ordr-user')
          window.dispatchEvent(new Event('ordr-user-updated'))
          router.replace('/login/')
          return
        }

        console.error('Erro ao verificar sessão:', error)

        const cachedSession = restoreCachedSession()

        if (cachedSession) {
          setCurrentUser(cachedSession.user)
          setCurrentCompany(cachedSession.company)
          return
        }

        // Não redireciona por erro temporário/API quebrada.
        // Isso evita loop PDV <-> login quando algum endpoint falha no refresh.
      } finally {
        if (isMounted) {
          setIsCheckingSession(false)
        }
      }
    }

    loadSession()

    return () => {
      isMounted = false
    }
  }, [isPublicRoute, router])

  useEffect(() => {
    if (isPublicRoute || !currentCompany?.id || currentCompany.licenseActive === false) return

    let cancelled = false

    async function sendHeartbeat() {
      if (!currentCompany?.id) return

      try {
        const payload = await getDeviceHeartbeatPayload(currentCompany.id)
        const result = await heartbeatDevice(payload)

        if (!cancelled && result.device?.id) {
          setStoredDeviceId(currentCompany.id, result.device.id)
        }
      } catch (error) {
        console.error('Erro ao atualizar dispositivo:', error)
      }
    }

    sendHeartbeat()
    const interval = window.setInterval(sendHeartbeat, 45_000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [currentCompany?.id, currentCompany?.licenseActive, isPublicRoute])

  const handleLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true)

      await logout()

      localStorage.removeItem('ordr-user')
      window.dispatchEvent(new Event('ordr-user-updated'))

      setCurrentUser(null)
      setCurrentCompany(null)
      window.location.href = '/login/'
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
      setCurrentCompany(result.user.currentCompany ?? result.user.companies?.find((company) => company.id === result.user.companyId) ?? null)

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
    if (normalizedPathname === '/') return 'Ordr'
    if (normalizedPathname.startsWith('/PDV')) return 'Ponto de Venda'
    if (normalizedPathname.startsWith('/interno')) return 'PDV Interno'
    if (normalizedPathname.startsWith('/pedidos')) return 'Pedidos'
    if (normalizedPathname.startsWith('/produtos')) return 'Produtos'
    if (normalizedPathname.startsWith('/clientes')) return 'Clientes'
    if (normalizedPathname.startsWith('/relatorios')) return 'Relatórios'
    if (normalizedPathname.startsWith('/dispositivos')) return 'Dispositivos'
    if (normalizedPathname.startsWith('/configuracoes')) return 'Configurações'
    if (normalizedPathname.startsWith('/estoque')) return 'Estoque'
    if (normalizedPathname.startsWith('/pessoas')) return 'Pessoas'
    if (normalizedPathname.startsWith('/eventos')) return 'Eventos'
    if (normalizedPathname.startsWith('/compras')) return 'Compras'
    if (normalizedPathname.startsWith('/acessos')) return 'Acessos'
    if (normalizedPathname.startsWith('/auditoria')) return 'Auditoria'
    if (normalizedPathname.startsWith('/impressoras')) return 'Impressoras'

    return 'Ordr'
  }, [normalizedPathname])


  const isCurrentCompanyBlocked = Boolean(
    currentCompany && currentCompany.licenseActive === false
  )

  const licenseDaysRemaining =
    typeof currentCompany?.licenseDaysRemaining === 'number'
      ? currentCompany.licenseDaysRemaining
      : null

  const isLicenseExpiringSoon = Boolean(
    currentCompany?.licenseActive === true &&
      licenseDaysRemaining !== null &&
      licenseDaysRemaining >= 0 &&
      licenseDaysRemaining < 7
  )

  const isCurrentCompanyTest = Boolean(currentCompany?.isTest)

  const licenseAlertDismissKey = useMemo(() => {
    if (!currentCompany?.id || !currentCompany?.licenseEndsAt) return null
    return `ordr-license-alert-dismissed:${currentCompany.id}:${currentCompany.licenseEndsAt}`
  }, [currentCompany?.id, currentCompany?.licenseEndsAt])

  useEffect(() => {
    if (isPublicRoute || typeof window === 'undefined' || !licenseAlertDismissKey) {
      setIsLicenseAlertDismissed(false)
      return
    }

    setIsLicenseAlertDismissed(localStorage.getItem(licenseAlertDismissKey) === 'true')
  }, [isPublicRoute, licenseAlertDismissKey])

  function handleDismissLicenseAlert() {
    setIsLicenseAlertDismissed(true)

    if (licenseAlertDismissKey && typeof window !== 'undefined') {
      localStorage.setItem(licenseAlertDismissKey, 'true')
    }
  }

  function formatLicenseDate(value?: string | null) {
    if (!value) return 'Sem vencimento definido'

    return new Date(value).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }
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

  if (isPublicRoute) {
    return <>{children}</>
  }

  if (isCheckingSession) {
    return <OrdrLoading label="Carregando ORDR..." />
  }

  if (!isPublicRoute && isCurrentCompanyBlocked && !normalizedPathname.startsWith('/configuracoes')) {
    return (
      <>
        <div className="flex h-dvh overflow-hidden">
          <div className="hidden lg:flex">
            <Sidebar />
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            <AppToolbar
              title="Licença inativa"
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

            <main className="flex flex-1 items-center justify-center overflow-auto p-6 pb-24 lg:pb-6">
              <div className="w-full max-w-2xl rounded-3xl border border-destructive/25 bg-card p-6 shadow-xl">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-6 w-6" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black uppercase tracking-[0.24em] text-destructive">
                      Acesso desativado
                    </p>
                    <h1 className="mt-2 text-2xl font-bold text-foreground">
                      A licença desta empresa não está ativa
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                      A empresa <strong className="text-foreground">{currentCompany?.name}</strong> está bloqueada para uso até que a licença seja regularizada no painel administrativo.
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border bg-background p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Building2 className="h-4 w-4 text-primary" />
                          Plano
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {currentCompany?.licensePlanName ?? 'Nenhum plano ativo'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-border bg-background p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <CalendarClock className="h-4 w-4 text-primary" />
                          Vencimento
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {formatLicenseDate(currentCompany?.licenseEndsAt)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => router.push('/configuracoes/')}
                      className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                    >
                      <Settings className="h-4 w-4" />
                      Ver empresas e licença
                    </button>
                  </div>
                </div>
              </div>
            </main>

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

          <main className="flex-1 min-h-0 overflow-auto pb-24 lg:pb-0">
            {isCurrentCompanyTest && (
              <div className="border-b border-sky-500/25 bg-sky-500/10 px-4 py-2 text-sky-950 dark:text-sky-100 lg:px-6">
                <div className="mx-auto flex max-w-7xl flex-col gap-2 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-200">
                      <FlaskConical className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.2em]">
                        Ambiente de teste ativo
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        Você está usando <strong>{currentCompany?.name}</strong>. Use este ambiente apenas para testes; vendas, estoque e cadastros reais devem ser feitos na empresa de produção.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push('/configuracoes/')}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700"
                  >
                    <Building2 className="h-4 w-4" />
                    Trocar empresa
                  </button>
                </div>
              </div>
            )}

            {isLicenseExpiringSoon && !isLicenseAlertDismissed && (
              <div className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-3 text-amber-900 dark:text-amber-200 lg:px-6">
                <div className="mx-auto max-w-7xl rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.2em]">
                          Licença perto do vencimento
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          A licença da empresa <strong>{currentCompany?.name}</strong> vence {licenseDaysRemaining === 0 ? 'hoje' : `em ${licenseDaysRemaining} dia(s)`}.
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => router.push('/configuracoes/')}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600"
                      >
                        <Settings className="h-4 w-4" />
                        Ver licença
                      </button>

                      <button
                        type="button"
                        onClick={handleDismissLicenseAlert}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-background/60 px-3 text-sm font-bold text-amber-900 transition hover:bg-amber-500/15 dark:text-amber-100"
                        aria-label="Fechar alerta de licença"
                        title="Fechar alerta"
                      >
                        <X className="h-4 w-4" />
                        Fechar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {children}
          </main>

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