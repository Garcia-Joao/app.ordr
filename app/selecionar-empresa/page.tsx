'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Building2, Loader2, LogOut, PackageCheck, Search, ShieldCheck, Store } from 'lucide-react'
import { me, logout, switchCompany, type AuthCompany, type AuthUser } from '@/lib/api/auth'
import { getFirstAllowedPath } from '@/lib/auth-routing'

const SUPPLIERS_APP_URL = process.env.NEXT_PUBLIC_SUPPLIERS_APP_URL || 'https://suppliers.panelordr.com.br/'

function companyTypeLabel(company: AuthCompany) {
  return String(company.companyType ?? '').toUpperCase() === 'SUPPLIER'
    ? 'Fornecedor'
    : 'Operação'
}

function companyTypeIcon(company: AuthCompany) {
  return String(company.companyType ?? '').toUpperCase() === 'SUPPLIER' ? PackageCheck : Store
}

function isSupplierCompany(company?: AuthCompany | null) {
  return String(company?.companyType ?? '').toUpperCase() === 'SUPPLIER'
}

function sortCompanies(companies: AuthCompany[]) {
  return [...companies].sort((a, b) => {
    const aType = companyTypeLabel(a)
    const bType = companyTypeLabel(b)
    if (aType !== bType) return aType.localeCompare(bType)
    return a.name.localeCompare(b.name)
  })
}

function saveUser(user: AuthUser) {
  localStorage.setItem('ordr-user', JSON.stringify(user))
  window.dispatchEvent(new Event('ordr-user-updated'))
}

export default function CompanySelectionPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let alive = true

    async function load() {
      try {
        const result = await me()
        if (!alive) return

        saveUser(result.user)
        setUser(result.user)

        const companies = result.user.companies ?? []
        if (companies.length <= 1) {
          const onlyCompany = companies[0] ?? result.user.currentCompany
          if (isSupplierCompany(onlyCompany)) {
            window.location.href = SUPPLIERS_APP_URL
            return
          }
          router.replace(getFirstAllowedPath(result.user))
        }
      } catch {
        if (!alive) return
        localStorage.removeItem('ordr-user')
        window.dispatchEvent(new Event('ordr-user-updated'))
        router.replace('/login/')
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()

    return () => {
      alive = false
    }
  }, [router])

  const companies = useMemo(() => {
    const list = sortCompanies(user?.companies ?? [])
    const normalized = query.trim().toLowerCase()
    if (!normalized) return list

    return list.filter((company) => {
      return `${company.name} ${companyTypeLabel(company)}`.toLowerCase().includes(normalized)
    })
  }, [query, user?.companies])

  async function handleSelect(company: AuthCompany) {
    try {
      setError('')
      setSwitchingId(company.id)

      const result = await switchCompany(company.id)
      saveUser(result.user)

      if (isSupplierCompany(result.user.currentCompany)) {
        window.location.href = SUPPLIERS_APP_URL
        return
      }

      router.replace(getFirstAllowedPath(result.user))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível selecionar esta empresa.')
    } finally {
      setSwitchingId(null)
    }
  }

  async function handleLogout() {
    try {
      await logout()
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('ordr-user')
      window.dispatchEvent(new Event('ordr-user-updated'))
      router.replace('/login/')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex items-center gap-3 rounded-3xl border bg-card px-5 py-4 text-sm font-bold text-muted-foreground shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Carregando empresas...
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col justify-between gap-4 rounded-[2rem] border bg-card/85 p-6 shadow-sm md:flex-row md:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              ORDR
            </div>
            <h1 className="text-3xl font-black tracking-tight md:text-5xl">Selecione a empresa</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-muted-foreground md:text-base">
              Seu usuário possui acesso a mais de uma empresa. Escolha uma operação para abrir o PDV ou um fornecedor para abrir o portal de fornecedores.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </header>

        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar empresa..."
              className="h-12 w-full rounded-2xl border bg-card pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-primary"
            />
          </div>

          <div className="rounded-2xl border bg-card px-4 py-3 text-sm font-bold text-muted-foreground">
            {companies.length} empresa{companies.length === 1 ? '' : 's'} disponível{companies.length === 1 ? '' : 'is'}
          </div>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {companies.map((company) => {
            const Icon = companyTypeIcon(company)
            const supplier = isSupplierCompany(company)
            const disabled = switchingId !== null

            return (
              <button
                key={company.id}
                onClick={() => handleSelect(company)}
                disabled={disabled}
                className="group overflow-hidden rounded-[2rem] border bg-card p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-primary hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className={supplier ? 'grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600' : 'grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary'}>
                    <Icon className="h-7 w-7" />
                  </div>

                  <span className={supplier ? 'rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-600' : 'rounded-full bg-primary/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-primary'}>
                    {companyTypeLabel(company)}
                  </span>
                </div>

                <h2 className="text-xl font-black tracking-tight">{company.name}</h2>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  {supplier ? 'Abrir portal do fornecedor' : 'Abrir operação ORDR'}
                </p>

                <div className="mt-6 flex items-center justify-between border-t pt-4 text-sm font-black">
                  <span className="text-muted-foreground">
                    {company.licenseActive === false ? 'Licença inativa' : 'Selecionar'}
                  </span>
                  {switchingId === company.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                  )}
                </div>
              </button>
            )
          })}
        </section>

        {!companies.length ? (
          <div className="rounded-[2rem] border bg-card p-8 text-center text-muted-foreground">
            <Building2 className="mx-auto mb-3 h-10 w-10" />
            Nenhuma empresa encontrada para este filtro.
          </div>
        ) : null}
      </div>
    </main>
  )
}
