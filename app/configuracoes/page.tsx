'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Settings,
  Building2,
  FlaskConical,
  Save,
  CheckCircle2,
  Plus,
  Loader2,
  ClipboardList,
  Palette,
  Trash2,
  MapPinned,
  Copy,
  ShieldCheck,
  BadgeCheck,
  AlertTriangle,
  CalendarClock,
  KeyRound,
} from 'lucide-react'
import { getMe, switchCompany, type AuthCompany, type AuthUser } from '@/lib/api/auth'
import { createTestCompany, deleteTestCompany } from '@/lib/api/companies'
import {
  getSalesEnvironments,
  createSalesEnvironment,
  deleteSalesEnvironment,
} from '@/lib/api/sales-environments'

const REQUIRE_COMANDA_STORAGE_KEY = 'ordr-settings-require-comanda'

type SalesEnvironment = {
  id: string
  name: string
  color: string
  isDefault?: boolean
  active?: boolean
  createdAt?: string | Date
  updatedAt?: string | Date
}

function sortCompanies(companies: AuthCompany[]) {
  return [...companies].sort((a, b) => {
    if (a.isTest !== b.isTest) return a.isTest ? 1 : -1
    return a.name.localeCompare(b.name)
  })
}

function isCompanyAdmin(company: AuthCompany) {
  return company.systemRole === 'ADMIN' || company.role === 'admin'
}

function formatLicenseDate(value?: string | null) {
  if (!value) return 'Sem vencimento definido'

  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getLicenseStatusLabel(company?: AuthCompany | null) {
  if (!company) return 'Indefinida'
  if (company.licenseActive) return 'Ativa'

  if (company.platformAccessStatus === 'SUSPENDED') return 'Suspensa'
  if (company.platformAccessStatus === 'BLOCKED') return 'Bloqueada'
  if (company.platformAccessStatus === 'CANCELLED') return 'Cancelada'
  if (company.licenseStatus === 'EXPIRED') return 'Expirada'
  if (company.licenseStatus === 'CANCELLED') return 'Cancelada'

  return 'Inativa'
}

export default function ConfiguracoesPage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [companies, setCompanies] = useState<AuthCompany[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copyDataToTest, setCopyDataToTest] = useState(true)
  const [testSourceCompanyId, setTestSourceCompanyId] = useState('')
  const [isCreatingTestCompany, setIsCreatingTestCompany] = useState(false)
  const [deletingTestCompanyId, setDeletingTestCompanyId] = useState<string | null>(null)
  const [requireComanda, setRequireComanda] = useState(true)

  const [salesEnvironments, setSalesEnvironments] = useState<SalesEnvironment[]>([])
  const [isLoadingEnvironments, setIsLoadingEnvironments] = useState(true)
  const [isCreatingEnvironment, setIsCreatingEnvironment] = useState(false)
  const [deletingEnvironmentId, setDeletingEnvironmentId] = useState<string | null>(null)

  const [newEnvironmentName, setNewEnvironmentName] = useState('')
  const [newEnvironmentColor, setNewEnvironmentColor] = useState('#64748B')

  useEffect(() => {
    async function loadData() {
      try {
        const result = await getMe()
        const sortedCompanies = sortCompanies(result.user.companies ?? [])
        setUser(result.user)
        setCompanies(sortedCompanies)
        setSelectedCompanyId(result.user.companyId)

        const firstAdminProductionCompany = sortedCompanies.find(
          (company) => !company.isTest && isCompanyAdmin(company)
        )
        setTestSourceCompanyId(firstAdminProductionCompany?.id ?? '')

        const savedRequireComanda = localStorage.getItem(REQUIRE_COMANDA_STORAGE_KEY)
        if (savedRequireComanda !== null) {
          setRequireComanda(savedRequireComanda === 'true')
        }
      } catch (error) {
        console.error('Erro ao carregar configurações:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    async function loadEnvironments() {
      try {
        setIsLoadingEnvironments(true)
        const result = await getSalesEnvironments()
        setSalesEnvironments(result)
      } catch (error) {
        console.error('Erro ao carregar ambientes de venda:', error)
      } finally {
        setIsLoadingEnvironments(false)
      }
    }

    if (!isLoading) {
      loadEnvironments()
    }
  }, [isLoading])

  const selectedCompany =
    companies.find((company) => company.id === selectedCompanyId) || null

  const selectedCompanyLicenseDaysRemaining =
    typeof selectedCompany?.licenseDaysRemaining === 'number'
      ? selectedCompany.licenseDaysRemaining
      : null

  const isSelectedCompanyLicenseExpiringSoon = Boolean(
    selectedCompany?.licenseActive === true &&
      selectedCompanyLicenseDaysRemaining !== null &&
      selectedCompanyLicenseDaysRemaining >= 0 &&
      selectedCompanyLicenseDaysRemaining < 7
  )

  const adminProductionCompanies = useMemo(
    () => companies.filter((company) => !company.isTest && isCompanyAdmin(company)),
    [companies]
  )

  const existingTestSourceIds = useMemo(
    () =>
      new Set(
        companies
          .filter((company) => company.isTest && company.testSourceCompanyId)
          .map((company) => company.testSourceCompanyId as string)
      ),
    [companies]
  )

  const productionCompaniesWithoutTest = useMemo(
    () =>
      adminProductionCompanies.filter(
        (company) => !existingTestSourceIds.has(company.id)
      ),
    [adminProductionCompanies, existingTestSourceIds]
  )

  const canShowCreateTestCompany = productionCompaniesWithoutTest.length > 0

  useEffect(() => {
    if (
      testSourceCompanyId &&
      productionCompaniesWithoutTest.some((company) => company.id === testSourceCompanyId)
    ) {
      return
    }

    setTestSourceCompanyId(productionCompaniesWithoutTest[0]?.id ?? '')
  }, [productionCompaniesWithoutTest, testSourceCompanyId])

  const handleCreateTestCompany = async () => {
    if (!testSourceCompanyId) {
      alert('Escolha uma empresa base para criar o ambiente de teste.')
      return
    }

    try {
      setIsCreatingTestCompany(true)

      const result = await createTestCompany({
        sourceCompanyId: testSourceCompanyId,
        copyData: copyDataToTest,
      })

      alert(
        result.alreadyExists
          ? `A empresa de teste já existia: ${result.company.name}`
          : `Empresa de teste criada: ${result.company.name}`
      )

      const refreshed = await getMe()
      const sortedCompanies = sortCompanies(refreshed.user.companies ?? [])
      setUser(refreshed.user)
      setCompanies(sortedCompanies)
      setSelectedCompanyId(result.company.id)

      localStorage.setItem('ordr-user', JSON.stringify(refreshed.user))
    } catch (error: any) {
      console.error('Erro ao criar empresa de teste:', error)
      alert(error?.message || 'Erro ao criar empresa de teste')
    } finally {
      setIsCreatingTestCompany(false)
    }
  }

  const handleDeleteTestCompany = async (company: AuthCompany) => {
    if (!company.isTest) return

    if (!isCompanyAdmin(company)) {
      alert('Somente administradores podem excluir uma empresa de teste.')
      return
    }

    const confirmed = window.confirm(
      `Atenção: isso vai excluir permanentemente a empresa de teste "${company.name}" e todos os dados dela.\n\nEssa ação não pode ser desfeita. Deseja continuar?`
    )

    if (!confirmed) return

    try {
      setDeletingTestCompanyId(company.id)

      const fallbackCompany =
        companies.find((item) => item.id === company.testSourceCompanyId) ??
        companies.find((item) => !item.isTest && isCompanyAdmin(item)) ??
        companies.find((item) => !item.isTest)

      if (user?.companyId === company.id && fallbackCompany) {
        const switched = await switchCompany(fallbackCompany.id)
        setUser(switched.user)
        setSelectedCompanyId(switched.user.companyId)
        localStorage.setItem('ordr-user', JSON.stringify(switched.user))
      }

      await deleteTestCompany(company.id)

      const refreshed = await getMe()
      const sortedCompanies = sortCompanies(refreshed.user.companies ?? [])
      setUser(refreshed.user)
      setCompanies(sortedCompanies)

      if (selectedCompanyId === company.id) {
        setSelectedCompanyId(refreshed.user.companyId)
      }

      localStorage.setItem('ordr-user', JSON.stringify(refreshed.user))
    } catch (error: any) {
      console.error('Erro ao excluir empresa de teste:', error)
      alert(error?.message || 'Erro ao excluir empresa de teste')
    } finally {
      setDeletingTestCompanyId(null)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setSaved(false)

      localStorage.setItem(REQUIRE_COMANDA_STORAGE_KEY, String(requireComanda))

      const targetCompany = companies.find((company) => company.id === selectedCompanyId)
      if (targetCompany?.isTest && !isCompanyAdmin(targetCompany)) {
        alert('Somente administradores podem entrar em empresas de teste.')
        return
      }

      if (targetCompany?.licenseActive === false) {
        alert('A licença desta empresa não está ativa. O acesso está bloqueado.')
        return
      }

      if (selectedCompanyId && selectedCompanyId !== user?.companyId) {
        const result = await switchCompany(selectedCompanyId)
        const sortedCompanies = sortCompanies(result.user.companies ?? [])

        setUser(result.user)
        setCompanies(sortedCompanies)
        setSelectedCompanyId(result.user.companyId)

        localStorage.setItem('ordr-user', JSON.stringify(result.user))
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)

      window.location.reload()
    } catch (error: any) {
      console.error('Erro ao salvar configuração:', error)
      alert(error?.message || 'Erro ao salvar configurações')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateEnvironment = async () => {
    const name = newEnvironmentName.trim()

    if (!name) {
      alert('Informe o nome do ambiente.')
      return
    }

    try {
      setIsCreatingEnvironment(true)

      const created = await createSalesEnvironment({
        name,
        color: newEnvironmentColor,
      })

      setSalesEnvironments((prev) =>
        [...prev, created].sort((a, b) => {
          if (a.isDefault) return -1
          if (b.isDefault) return 1
          return a.name.localeCompare(b.name)
        })
      )

      setNewEnvironmentName('')
      setNewEnvironmentColor('#64748B')
    } catch (error: any) {
      console.error('Erro ao criar ambiente de venda:', error)
      alert(error?.message || 'Erro ao criar ambiente de venda')
    } finally {
      setIsCreatingEnvironment(false)
    }
  }

  const handleDeleteEnvironment = async (environment: SalesEnvironment) => {
    if (environment.isDefault) {
      alert('O ambiente padrão não pode ser removido.')
      return
    }

    const confirmed = window.confirm(
      `Deseja remover o ambiente "${environment.name}"?`
    )

    if (!confirmed) return

    try {
      setDeletingEnvironmentId(environment.id)

      await deleteSalesEnvironment(environment.id)

      setSalesEnvironments((prev) =>
        prev.filter((item) => item.id !== environment.id)
      )
    } catch (error: any) {
      console.error('Erro ao remover ambiente de venda:', error)
      alert(error?.message || 'Erro ao remover ambiente de venda')
    } finally {
      setDeletingEnvironmentId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-muted-foreground">Carregando configurações...</span>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
            <p className="text-sm text-muted-foreground">
              Empresa ativa, ambientes de venda e comportamento do PDV
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            saved
              ? 'bg-success text-success-foreground'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {saved ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Save className="h-5 w-5" />
          )}
          {saved ? 'Salvo!' : isSaving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl space-y-6">
          <section className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Empresa ativa</h2>
                <p className="text-sm text-muted-foreground">
                  Escolha qual empresa será usada no sistema
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {companies.map((company) => {
                const isSelected = company.id === selectedCompanyId
                const isCurrent = user?.companyId === company.id
                const isDeleting = deletingTestCompanyId === company.id
                const hasActiveLicense = company.licenseActive !== false
                const canEnterTestCompany = !company.isTest || isCompanyAdmin(company)
                const canSelectCompany = canEnterTestCompany && hasActiveLicense
                const canDeleteTestCompany = company.isTest && isCompanyAdmin(company)

                return (
                  <div
                    key={company.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-secondary/30 hover:bg-secondary/50'
                    } ${!canSelectCompany ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <label className="flex items-start gap-4 cursor-pointer flex-1 min-w-0">
                        <input
                          type="radio"
                          name="active-company"
                          value={company.id}
                          checked={isSelected}
                          disabled={!canSelectCompany}
                          onChange={() => setSelectedCompanyId(company.id)}
                          className="h-4 w-4 mt-1"
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground">
                              {company.name}
                            </span>

                            {company.isTest && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning/15 text-warning">
                                <FlaskConical className="h-3.5 w-3.5" />
                                Ambiente de teste
                              </span>
                            )}

                            {isCompanyAdmin(company) && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Admin
                              </span>
                            )}

                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${company.licenseActive ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
                              {company.licenseActive ? (
                                <BadgeCheck className="h-3.5 w-3.5" />
                              ) : (
                                <AlertTriangle className="h-3.5 w-3.5" />
                              )}
                              {getLicenseStatusLabel(company)}
                            </span>
                          </div>

                          <p className="text-sm text-muted-foreground mt-1">
                            Papel neste ambiente:{' '}
                            {company.systemRole === 'CUSTOM'
                              ? company.customRoleName || 'Role customizada'
                              : company.role}
                          </p>

                          {company.isTest && !canEnterTestCompany && (
                            <p className="text-xs text-warning mt-2">
                              Somente administradores podem entrar em empresas de teste.
                            </p>
                          )}

                          {!hasActiveLicense && (
                            <p className="text-xs text-destructive mt-2">
                              Esta empresa está com a licença inativa. O acesso fica bloqueado até a regularização.
                            </p>
                          )}
                        </div>
                      </label>

                      <div className="flex items-center gap-2 shrink-0">
                        {isCurrent && (
                          <span className="text-sm font-medium text-primary">
                            Atual
                          </span>
                        )}

                        {canDeleteTestCompany && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTestCompany(company)}
                            disabled={isDeleting}
                            className="h-9 px-3 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 text-sm"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Excluir teste
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className={`p-2 rounded-lg ${selectedCompany?.licenseActive ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                {selectedCompany?.licenseActive ? (
                  <BadgeCheck className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Licença da empresa</h2>
                <p className="text-sm text-muted-foreground">
                  Consulte se a empresa selecionada está liberada para uso
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-secondary/20 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <KeyRound className="h-4 w-4 text-primary" />
                  Status
                </div>
                <p className={`mt-2 text-lg font-bold ${selectedCompany?.licenseActive ? 'text-green-600' : 'text-destructive'}`}>
                  {getLicenseStatusLabel(selectedCompany)}
                </p>
                {selectedCompany?.platformBlockedReason && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {selectedCompany.platformBlockedReason}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-secondary/20 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Plano
                </div>
                <p className="mt-2 text-lg font-bold text-foreground">
                  {selectedCompany?.licensePlanName ?? 'Nenhum plano ativo'}
                </p>
                {selectedCompany?.isTest && selectedCompany.licenseSourceCompanyName && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Herdando licença de: {selectedCompany.licenseSourceCompanyName}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-secondary/20 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Vencimento
                </div>
                <p className="mt-2 text-lg font-bold text-foreground">
                  {formatLicenseDate(selectedCompany?.licenseEndsAt)}
                </p>
                {typeof selectedCompany?.licenseDaysRemaining === 'number' && selectedCompany.licenseDaysRemaining > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {selectedCompany.licenseDaysRemaining} dia(s) restante(s)
                  </p>
                )}
              </div>
            </div>

            {isSelectedCompanyLicenseExpiringSoon && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-bold">Licença perto do vencimento</p>
                    <p className="mt-1">
                      Esta licença vence {selectedCompanyLicenseDaysRemaining === 0 ? 'hoje' : `em ${selectedCompanyLicenseDaysRemaining} dia(s)`}. Renove a licença para evitar o bloqueio automático da empresa.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!selectedCompany?.licenseActive && (
              <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
                Esta empresa está com acesso desativado. Regularize a licença no painel administrativo para liberar o uso do sistema.
              </div>
            )}
          </section>

          <section className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MapPinned className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Ambientes de venda
                </h2>
                <p className="text-sm text-muted-foreground">
                  Organize contextos de venda como Default, Interno e Arca
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-secondary/20 p-4 mb-5">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Nome do ambiente
                  </label>
                  <input
                    type="text"
                    value={newEnvironmentName}
                    onChange={(e) => setNewEnvironmentName(e.target.value)}
                    placeholder="Ex: Interno, Arca, Camarim"
                    className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Cor
                  </label>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-lg bg-background border border-border">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="color"
                      value={newEnvironmentColor}
                      onChange={(e) => setNewEnvironmentColor(e.target.value)}
                      className="h-6 w-8 border-0 bg-transparent p-0"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleCreateEnvironment}
                    disabled={isCreatingEnvironment}
                    className="w-full md:w-auto h-10 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {isCreatingEnvironment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Criar
                  </button>
                </div>
              </div>
            </div>

            {isLoadingEnvironments ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando ambientes...
              </div>
            ) : salesEnvironments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum ambiente cadastrado.
              </p>
            ) : (
              <div className="space-y-3">
                {salesEnvironments.map((environment) => {
                  const isDeleting = deletingEnvironmentId === environment.id

                  return (
                    <div
                      key={environment.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-border p-4 bg-background"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div
                          className="h-10 w-10 rounded-xl border border-border shrink-0"
                          style={{ backgroundColor: environment.color }}
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground">
                              {environment.name}
                            </span>

                            {environment.isDefault && (
                              <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-primary/10 text-primary">
                                Padrão
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-muted-foreground mt-1">
                            ID: {environment.id}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteEnvironment(environment)}
                        disabled={isDeleting || environment.isDefault}
                        className="h-10 px-3 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Remover
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Configurações do PDV</h2>
                <p className="text-sm text-muted-foreground">
                  Regras aplicadas na tela de vendas
                </p>
              </div>
            </div>

            <label className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
              <div>
                <span className="text-foreground font-medium">
                  Exigir número da comanda
                </span>
                <p className="text-sm text-muted-foreground">
                  O PDV só permite finalizar o pedido se o número da comanda estiver preenchido
                </p>
              </div>

              <input
                type="checkbox"
                checked={requireComanda}
                onChange={(e) => setRequireComanda(e.target.checked)}
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
              />
            </label>
          </section>

          <section className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-base font-semibold text-foreground mb-3">
              Resumo do ambiente
            </h3>

            {selectedCompany ? (
              <div className="rounded-xl bg-secondary/40 border border-border p-4 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Empresa selecionada</span>
                  <span className="font-medium text-foreground text-right">
                    {selectedCompany.name}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tipo de ambiente</span>
                  <span
                    className={`text-sm font-medium ${
                      selectedCompany.isTest ? 'text-warning' : 'text-success'
                    }`}
                  >
                    {selectedCompany.isTest ? 'Teste' : 'Produção'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ambientes de venda</span>
                  <span className="font-medium text-foreground">
                    {salesEnvironments.length}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma empresa selecionada.
              </p>
            )}
          </section>

          {canShowCreateTestCompany ? (
            <section className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <FlaskConical className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Ambiente de teste
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Crie uma empresa de teste em branco ou copiando a estrutura de uma empresa administrada por você
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Empresa base
                  </label>
                  <select
                    value={testSourceCompanyId}
                    onChange={(e) => setTestSourceCompanyId(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg bg-background border border-border text-foreground"
                  >
                    {productionCompaniesWithoutTest.map((company) => (
                      <option key={company.id} value={company.id} className="bg-background text-foreground">
                        {company.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-muted-foreground mt-2">
                    A empresa teste será vinculada à empresa base escolhida.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCopyDataToTest(false)}
                    className={`text-left rounded-xl border p-4 transition-colors ${
                      !copyDataToTest
                        ? 'border-warning bg-warning/10'
                        : 'border-border bg-secondary/30 hover:bg-secondary/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <FlaskConical className="h-4 w-4 text-warning" />
                      Criar em branco
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Cria apenas a empresa teste e o ambiente Default, sem copiar produtos e categorias.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCopyDataToTest(true)}
                    className={`text-left rounded-xl border p-4 transition-colors ${
                      copyDataToTest
                        ? 'border-warning bg-warning/10'
                        : 'border-border bg-secondary/30 hover:bg-secondary/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <Copy className="h-4 w-4 text-warning" />
                      Copiar estrutura
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Copia categorias, produtos e variações da empresa base. Pedidos não são copiados.
                    </p>
                  </button>
                </div>

                <button
                  onClick={handleCreateTestCompany}
                  disabled={isCreatingTestCompany || !testSourceCompanyId}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg font-medium bg-warning text-black hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingTestCompany ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Criando ambiente de teste...
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      Criar empresa de teste
                    </>
                  )}
                </button>
              </div>
            </section>
          ) : adminProductionCompanies.length > 0 ? (
            <section className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Ambientes de teste já criados
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Todas as empresas em que você é administrador já possuem uma empresa de teste.
                  </p>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
