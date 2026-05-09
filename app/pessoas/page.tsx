'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    Plus,
    Search,
    UserRound,
    Phone,
    Mail,
    Star,
    Pencil,
    Trash2,
    X,
    Loader2,
    BadgeDollarSign,
    BriefcaseBusiness,
    MapPinned,
    MapPin,
    ChevronDown,
    Check,
    UserX,
    RotateCcw,
} from 'lucide-react'
import {
    createPerson,
    createPersonFunction,
    disablePerson,
    getPeople,
    getPersonFunctions,
    permanentlyDeletePerson,
    restorePerson,
    updatePerson,
    type ManagedPerson,
    type PersonContractType,
    type PersonFunction,
    type PersonRateType,
    type SavePersonPayload,
} from '@/lib/api/people'
import {
    getSalesEnvironments,
    type SalesEnvironment,
} from '@/lib/api/sales-environments'
import { formatBRL } from '@/lib/pos-types'
import {
    getPeopleEvaluationRatings,
    getPersonEvaluationSummary,
    type PersonEvaluationRating,
    type PersonEvaluationSummary,
} from '@/lib/api/staff-evaluations'

type PersonFormState = {
    id?: string
    name: string
    phone: string
    email: string
    city: string
    contractType: PersonContractType
    salesEnvironmentId: string
    rateType: PersonRateType
    rateAmount: string
    observations: string
    active: boolean
    functions: {
        functionId: string
        detail: string
    }[]
}

type ActiveFilter = 'active' | 'disabled' | 'all'

const emptyForm: PersonFormState = {
    name: '',
    phone: '',
    email: '',
    city: '',
    contractType: 'NONE',
    salesEnvironmentId: '',
    rateType: 'EVENT',
    rateAmount: '',
    observations: '',
    active: true,
    functions: [],
}

const contractLabels: Record<PersonContractType, string> = {
    CLT: 'CLT',
    FREELANCER: 'Freelancer',
    PJ: 'PJ',
    NONE: 'Nenhum',
    OTHER: 'Outro',
}

const rateLabels: Record<PersonRateType, string> = {
    HOURLY: 'Por hora',
    DAILY: 'Diária',
    EVENT: 'Por evento',
    MONTHLY: 'Mensal',
    NEGOTIABLE: 'Negociável',
}

function PrettySelect({
    value,
    onChange,
    children,
    className = '',
    title,
}: {
    value: string
    onChange: (value: string) => void
    children: React.ReactNode
    className?: string
    title?: string
}) {
    return (
        <div className={`relative ${className}`}>
            {title && (
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {title}
                </label>
            )}

            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-border bg-background px-3 pr-9 text-sm text-foreground shadow-sm transition-all hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
                {children}
            </select>

            <ChevronDown
                className={`pointer-events-none absolute right-3 h-4 w-4 text-muted-foreground ${title ? 'bottom-3' : 'top-1/2 -translate-y-1/2'
                    }`}
            />
        </div>
    )
}

function getRateText(person: ManagedPerson) {
    const amount = person.rateAmount == null ? null : Number(person.rateAmount)

    if (!amount || Number.isNaN(amount)) {
        return rateLabels[person.rateType]
    }

    return `${formatBRL(amount)} • ${rateLabels[person.rateType]}`
}

function getFunctionsText(person: ManagedPerson) {
    if (!person.functions?.length) return 'Sem função definida'

    return person.functions
        .map((assignment) => {
            const detail = assignment.detail ? ` (${assignment.detail})` : ''
            return `${assignment.function.name}${detail}`
        })
        .join(', ')
}

function buildPayload(form: PersonFormState): SavePersonPayload {
    return {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        city: form.city.trim() || null,
        contractType: form.contractType,
        salesEnvironmentId: form.salesEnvironmentId || null,
        rateType: form.rateType,
        rateAmount: form.rateAmount ? Number(form.rateAmount) : null,
        rating: null,
        observations: form.observations.trim() || null,
        active: form.active,
        functions: form.functions
            .filter((item) => item.functionId)
            .map((item) => ({
                functionId: item.functionId,
                detail: item.detail.trim() || null,
            })),
    }
}

export default function PessoasPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isCreatingFunction, setIsCreatingFunction] = useState(false)

    const [people, setPeople] = useState<ManagedPerson[]>([])
    const [functions, setFunctions] = useState<PersonFunction[]>([])
    const [salesEnvironments, setSalesEnvironments] = useState<SalesEnvironment[]>([])

    const [search, setSearch] = useState('')
    const [contractFilter, setContractFilter] = useState<'all' | PersonContractType>('all')
    const [environmentFilter, setEnvironmentFilter] = useState('all')
    const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active')
    const [selectedFunctionIds, setSelectedFunctionIds] = useState<string[]>([])
    const [showFunctionFilter, setShowFunctionFilter] = useState(false)

    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState<PersonFormState>(emptyForm)
    const [newFunctionName, setNewFunctionName] = useState('')
    const [showEvaluationsModal, setShowEvaluationsModal] = useState(false)
    const [evaluationSummary, setEvaluationSummary] = useState<PersonEvaluationSummary | null>(null)
    const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false)
    const [personEvaluationRatings, setPersonEvaluationRatings] = useState<Record<string, PersonEvaluationRating>>({})
    const [showCitySuggestions, setShowCitySuggestions] = useState(false)

    async function reload() {
        const [peopleData, functionsData, environmentsData, ratingsData] = await Promise.all([
            getPeople(),
            getPersonFunctions(),
            getSalesEnvironments(),
            getPeopleEvaluationRatings(),
        ])

        setPeople(peopleData)
        setFunctions(functionsData)
        setSalesEnvironments(environmentsData)
        setPersonEvaluationRatings(
            Object.fromEntries(ratingsData.map((rating) => [rating.personId, rating]))
        )
    }

    useEffect(() => {
        async function load() {
            try {
                await reload()
            } catch (error) {
                console.error('Erro ao carregar pessoas:', error)
            } finally {
                setIsLoading(false)
            }
        }

        load()
    }, [])

    const citySuggestions = useMemo(() => {
        const cities = people
            .map((person) => person.city?.trim())
            .filter((city): city is string => Boolean(city))

        return Array.from(new Set(cities)).sort((a, b) => a.localeCompare(b))
    }, [people])

    const filteredCitySuggestions = useMemo(() => {
        const term = form.city.trim().toLowerCase()

        return citySuggestions
            .filter((city) => !term || city.toLowerCase().includes(term))
            .slice(0, 8)
    }, [citySuggestions, form.city])

    const selectedFunctionNames = useMemo(() => {
        return functions
            .filter((functionItem) => selectedFunctionIds.includes(functionItem.id))
            .map((functionItem) => functionItem.name)
    }, [functions, selectedFunctionIds])

    const functionFilterLabel =
        selectedFunctionIds.length === 0
            ? 'Todas funções'
            : selectedFunctionIds.length === 1
                ? selectedFunctionNames[0] ?? '1 função'
                : `${selectedFunctionIds.length} funções`

    function toggleFunctionFilter(functionId: string) {
        setSelectedFunctionIds((current) =>
            current.includes(functionId)
                ? current.filter((id) => id !== functionId)
                : [...current, functionId]
        )
    }

    function clearFunctionFilters() {
        setSelectedFunctionIds([])
    }

    const filteredPeople = useMemo(() => {
        const term = search.trim().toLowerCase()

        return people.filter((person) => {
            if (activeFilter === 'active' && !person.active) {
                return false
            }

            if (activeFilter === 'disabled' && person.active) {
                return false
            }

            const matchesSearch =
                term === '' ||
                person.name.toLowerCase().includes(term) ||
                (person.phone ?? '').toLowerCase().includes(term) ||
                (person.email ?? '').toLowerCase().includes(term) ||
                (person.city ?? '').toLowerCase().includes(term) ||
                getFunctionsText(person).toLowerCase().includes(term)

            if (!matchesSearch) return false

            if (contractFilter !== 'all' && person.contractType !== contractFilter) {
                return false
            }

            if (
                environmentFilter !== 'all' &&
                person.salesEnvironmentId !== environmentFilter
            ) {
                return false
            }

            if (selectedFunctionIds.length > 0) {
                const personFunctionIds =
                    person.functions?.map((assignment) => assignment.function.id) ?? []

                const hasAllSelectedFunctions = selectedFunctionIds.every((functionId) =>
                    personFunctionIds.includes(functionId)
                )

                if (!hasAllSelectedFunctions) {
                    return false
                }
            }

            return true
        })
    }, [
        people,
        search,
        contractFilter,
        environmentFilter,
        activeFilter,
        selectedFunctionIds,
    ])

    function openCreateModal() {
        const defaultEnvironment =
            salesEnvironments.find((environment) => environment.isDefault) ??
            salesEnvironments[0] ??
            null

        setForm({
            ...emptyForm,
            salesEnvironmentId: defaultEnvironment?.id ?? '',
            active: true,
        })
        setNewFunctionName('')
        setShowCitySuggestions(false)
        setShowModal(true)
    }

    function openEditModal(person: ManagedPerson) {
        setForm({
            id: person.id,
            name: person.name,
            phone: person.phone ?? '',
            email: person.email ?? '',
            city: person.city ?? '',
            contractType: person.contractType,
            salesEnvironmentId: person.salesEnvironmentId ?? '',
            rateType: person.rateType,
            rateAmount: person.rateAmount == null ? '' : String(person.rateAmount),
            observations: person.observations ?? '',
            active: person.active,
            functions:
                person.functions?.map((assignment) => ({
                    functionId: assignment.function.id,
                    detail: assignment.detail ?? '',
                })) ?? [],
        })
        setNewFunctionName('')
        setShowCitySuggestions(false)
        setShowModal(true)
    }

    function addFunctionRow() {
        setForm((current) => ({
            ...current,
            functions: [...current.functions, { functionId: '', detail: '' }],
        }))
    }

    function updateFunctionRow(
        index: number,
        data: Partial<PersonFormState['functions'][number]>
    ) {
        setForm((current) => ({
            ...current,
            functions: current.functions.map((item, itemIndex) =>
                itemIndex === index ? { ...item, ...data } : item
            ),
        }))
    }

    function removeFunctionRow(index: number) {
        setForm((current) => ({
            ...current,
            functions: current.functions.filter((_, itemIndex) => itemIndex !== index),
        }))
    }

    async function handleCreateFunction() {
        const name = newFunctionName.trim()

        if (!name) {
            alert('Informe o nome da função.')
            return
        }

        try {
            setIsCreatingFunction(true)

            const created = await createPersonFunction({
                name,
            })

            setFunctions((current) => {
                const alreadyExists = current.some((item) => item.id === created.id)

                if (alreadyExists) {
                    return current.map((item) => (item.id === created.id ? created : item))
                }

                return [...current, created].sort((a, b) => a.name.localeCompare(b.name))
            })

            setNewFunctionName('')

            setForm((current) => ({
                ...current,
                functions: [
                    ...current.functions,
                    {
                        functionId: created.id,
                        detail: '',
                    },
                ],
            }))
        } catch (error: any) {
            console.error('Erro ao criar função:', error)
            alert(error?.message || 'Erro ao criar função.')
        } finally {
            setIsCreatingFunction(false)
        }
    }

    async function handleSave() {
        if (!form.name.trim()) {
            alert('Informe o nome.')
            return
        }

        try {
            setIsSaving(true)

            const payload = buildPayload(form)

            if (form.id) {
                await updatePerson(form.id, payload)
            } else {
                await createPerson(payload)
            }

            await reload()
            setShowModal(false)
            setForm(emptyForm)
            setNewFunctionName('')
        } catch (error: any) {
            console.error('Erro ao salvar pessoa:', error)
            alert(error?.message || 'Erro ao salvar pessoa')
        } finally {
            setIsSaving(false)
        }
    }


    async function openEvaluationsModal(person: ManagedPerson) {
        try {
            setIsLoadingEvaluations(true)
            setShowEvaluationsModal(true)
            const summary = await getPersonEvaluationSummary(person.id)
            setEvaluationSummary(summary)
        } catch (error: any) {
            console.error('Erro ao carregar avaliações:', error)
            alert(error?.message || 'Erro ao carregar avaliações')
            setShowEvaluationsModal(false)
        } finally {
            setIsLoadingEvaluations(false)
        }
    }

    async function handleDisablePerson(person: ManagedPerson) {
        const confirmed = window.confirm(`Deseja desativar "${person.name}"?`)
        if (!confirmed) return

        try {
            setIsDeleting(true)

            const result = await disablePerson(person.id)

            if (result.hasOpenOrders) {
                alert(
                    'Pessoa desativada, mas ainda aparece no PDV Interno porque possui pedidos pendentes.'
                )
            } else if (result.removedFromInternalPdv) {
                alert('Pessoa desativada e removida do PDV Interno.')
            } else {
                alert('Pessoa desativada com sucesso.')
            }

            await reload()
        } catch (error: any) {
            console.error('Erro ao desativar pessoa:', error)

            if (error?.message === 'PERSON_NOT_FOUND') {
                alert('Pessoa não encontrada.')
                return
            }

            alert(error?.message || 'Erro ao desativar pessoa.')
        } finally {
            setIsDeleting(false)
        }
    }

    async function handleDeletePerson(person: ManagedPerson) {
        const confirmed = window.confirm(
            `Deseja excluir permanentemente "${person.name}"? Essa ação não pode ser desfeita.`
        )

        if (!confirmed) return

        try {
            setIsDeleting(true)

            const result = await permanentlyDeletePerson(person.id)

            if (result.removedFromInternalPdv) {
                alert('Pessoa excluída permanentemente e removida do PDV Interno.')
            } else {
                alert('Pessoa excluída permanentemente.')
            }

            await reload()
        } catch (error: any) {
            if (error?.message === 'PERSON_HAS_OPEN_INTERNAL_ORDERS') {
                alert(
                    'Essa pessoa ainda possui pedidos pendentes no PDV Interno. Feche ou cancele esses pedidos antes de excluir.'
                )
                return
            }

            if (error?.message === 'PERSON_MUST_BE_DISABLED_BEFORE_DELETE') {
                alert('Você precisa desativar a pessoa antes de excluir permanentemente.')
                return
            }

            if (error?.message === 'PERSON_NOT_FOUND') {
                alert('Pessoa não encontrada.')
                return
            }

            console.error('Erro ao excluir pessoa:', error)
            alert(error?.message || 'Erro ao excluir pessoa.')
        } finally {
            setIsDeleting(false)
        }
    }

    async function handleRestorePerson(person: ManagedPerson) {
        try {
            setIsDeleting(true)
            await restorePerson(person.id)
            await reload()
        } catch (error: any) {
            console.error('Erro ao reativar pessoa:', error)
            alert(error?.message || 'Erro ao reativar pessoa')
        } finally {
            setIsDeleting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <span className="text-muted-foreground">Carregando pessoas...</span>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
                <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <UserRound className="h-5 w-5 text-primary" />
                    </div>

                    <div>
                        <h1 className="text-xl font-semibold text-foreground">
                            Gestão de Pessoas
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Freelancers, músicos, funcionários e prestadores
                        </p>
                    </div>
                </div>

                <button
                    onClick={openCreateModal}
                    className="h-10 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Nova pessoa
                </button>
            </div>

            <div className="px-6 py-4 border-b border-border bg-card">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[260px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Buscar por nome, telefone, cidade, função..."
                            className="w-full h-10 pl-10 pr-4 rounded-xl bg-background border border-border text-sm"
                        />
                    </div>

                    <PrettySelect
                        value={activeFilter}
                        onChange={(value) => setActiveFilter(value as ActiveFilter)}
                        className="min-w-[150px]"
                    >
                        <option value="active">Ativos</option>
                        <option value="disabled">Desativados</option>
                        <option value="all">Todos</option>
                    </PrettySelect>

                    <PrettySelect
                        value={contractFilter}
                        onChange={(value) => setContractFilter(value as 'all' | PersonContractType)}
                        className="min-w-[180px]"
                    >
                        <option value="all">Todos contratos</option>
                        <option value="CLT">CLT</option>
                        <option value="FREELANCER">Freelancer</option>
                        <option value="PJ">PJ</option>
                        <option value="NONE">Nenhum</option>
                        <option value="OTHER">Outro</option>
                    </PrettySelect>

                    <PrettySelect
                        value={environmentFilter}
                        onChange={setEnvironmentFilter}
                        className="min-w-[190px]"
                    >
                        <option value="all">Todos ambientes</option>
                        {salesEnvironments.map((environment) => (
                            <option key={environment.id} value={environment.id}>
                                {environment.name}
                            </option>
                        ))}
                    </PrettySelect>

                    {functions.length > 0 && (
                        <div className="relative min-w-[180px]">
                            <button
                                type="button"
                                onClick={() => setShowFunctionFilter((current) => !current)}
                                className={`h-10 w-full rounded-xl border px-3 text-sm shadow-sm transition-all flex items-center justify-between gap-2 ${selectedFunctionIds.length > 0
                                    ? 'border-primary/50 bg-primary/10 text-foreground'
                                    : 'border-border bg-background text-foreground hover:border-primary/40'
                                    }`}
                            >
                                <span className="truncate">{functionFilterLabel}</span>

                                <div className="flex items-center gap-1 shrink-0">
                                    {selectedFunctionIds.length > 0 && (
                                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                                            {selectedFunctionIds.length}
                                        </span>
                                    )}

                                    <ChevronDown
                                        className={`h-4 w-4 text-muted-foreground transition-transform ${showFunctionFilter ? 'rotate-180' : ''
                                            }`}
                                    />
                                </div>
                            </button>

                            {showFunctionFilter && (
                                <div className="absolute right-0 top-12 z-30 w-72 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
                                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                            Funções
                                        </p>

                                        {selectedFunctionIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={clearFunctionFilters}
                                                className="text-xs font-medium text-primary hover:underline"
                                            >
                                                Limpar
                                            </button>
                                        )}
                                    </div>

                                    <div className="max-h-72 overflow-y-auto p-2">
                                        {functions.map((functionItem) => {
                                            const isSelected = selectedFunctionIds.includes(functionItem.id)

                                            return (
                                                <button
                                                    key={functionItem.id}
                                                    type="button"
                                                    onClick={() => toggleFunctionFilter(functionItem.id)}
                                                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${isSelected
                                                        ? 'bg-primary/10 text-foreground'
                                                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                                        }`}
                                                >
                                                    <span className="truncate">{functionItem.name}</span>

                                                    <span
                                                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${isSelected
                                                            ? 'border-primary bg-primary text-primary-foreground'
                                                            : 'border-border bg-background'
                                                            }`}
                                                    >
                                                        {isSelected && <Check className="h-3.5 w-3.5" />}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-6">
                {filteredPeople.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                        Nenhuma pessoa encontrada.
                    </div>
                ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
                        {filteredPeople.map((person) => (
                            <div
                                key={person.id}
                                className={`rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-md ${person.active ? 'border-border' : 'border-destructive/30 opacity-70'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <UserRound className="h-5 w-5 text-primary" />
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-foreground truncate">
                                                    {person.name}
                                                </p>

                                                {!person.active && (
                                                    <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                                                        Desativado
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-xs text-muted-foreground mt-1">
                                                {contractLabels[person.contractType]}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => openEditModal(person)}
                                            className="h-8 w-8 rounded-lg border border-border hover:bg-secondary flex items-center justify-center"
                                            title="Editar"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => openEvaluationsModal(person)}
                                            className="h-8 w-8 rounded-lg border border-warning/30 text-warning hover:bg-warning/10 flex items-center justify-center"
                                            title="Avaliações"
                                        >
                                            <Star className="h-4 w-4" />
                                        </button>


                                        {person.active ? (
                                            <button
                                                onClick={() => handleDisablePerson(person)}
                                                disabled={isDeleting}
                                                className="h-8 w-8 rounded-lg border border-warning/30 text-warning hover:bg-warning/10 flex items-center justify-center disabled:opacity-50"
                                                title="Desativar pessoa"
                                            >
                                                <UserX className="h-4 w-4" />
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleRestorePerson(person)}
                                                    disabled={isDeleting}
                                                    className="h-8 w-8 rounded-lg border border-success/30 text-success hover:bg-success/10 flex items-center justify-center disabled:opacity-50"
                                                    title="Reativar pessoa"
                                                >
                                                    <RotateCcw className="h-4 w-4" />
                                                </button>

                                                <button
                                                    onClick={() => handleDeletePerson(person)}
                                                    disabled={isDeleting}
                                                    className="h-8 w-8 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 flex items-center justify-center disabled:opacity-50"
                                                    title="Excluir permanentemente"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 space-y-2 text-sm">
                                    {person.phone && (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Phone className="h-4 w-4" />
                                            <span>{person.phone}</span>
                                        </div>
                                    )}

                                    {person.email && (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Mail className="h-4 w-4" />
                                            <span>{person.email}</span>
                                        </div>
                                    )}

                                    {person.city && (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <MapPin className="h-4 w-4" />
                                            <span>{person.city}</span>
                                        </div>
                                    )}

                                    {person.salesEnvironment && (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <MapPinned className="h-4 w-4" />
                                            <span>{person.salesEnvironment.name}</span>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <BriefcaseBusiness className="h-4 w-4" />
                                        <span className="line-clamp-2">{getFunctionsText(person)}</span>
                                    </div>

                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <BadgeDollarSign className="h-4 w-4" />
                                        <span>{getRateText(person)}</span>
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center justify-between gap-3">
                                    <PersonRatingSummary rating={personEvaluationRatings[person.id]} />

                                    {person.internalCustomerId && (
                                        <span className="rounded-full border border-success/30 bg-success/10 px-2 py-1 text-[11px] font-medium text-success">
                                            No PDV Interno
                                        </span>
                                    )}
                                </div>

                                {person.observations && (
                                    <p className="mt-4 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground line-clamp-3">
                                        {person.observations}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showEvaluationsModal && (
                <PersonEvaluationsModal
                    summary={evaluationSummary}
                    isLoading={isLoadingEvaluations}
                    onClose={() => {
                        setShowEvaluationsModal(false)
                        setEvaluationSummary(null)
                    }}
                />
            )}


            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-card border border-border shadow-2xl flex flex-col">
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">
                                    {form.id ? 'Editar pessoa' : 'Nova pessoa'}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    A pessoa será vinculada automaticamente ao PDV Interno.
                                </p>
                            </div>

                            <button
                                onClick={() => setShowModal(false)}
                                className="h-9 w-9 rounded-lg hover:bg-secondary flex items-center justify-center"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-foreground">Nome</label>
                                    <input
                                        value={form.name}
                                        onChange={(event) =>
                                            setForm((current) => ({ ...current, name: event.target.value }))
                                        }
                                        className="mt-1 w-full h-10 rounded-xl bg-background border border-border px-3"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-foreground">
                                        Telefone
                                    </label>
                                    <input
                                        value={form.phone}
                                        onChange={(event) =>
                                            setForm((current) => ({ ...current, phone: event.target.value }))
                                        }
                                        className="mt-1 w-full h-10 rounded-xl bg-background border border-border px-3"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-foreground">Email</label>
                                    <input
                                        value={form.email}
                                        onChange={(event) =>
                                            setForm((current) => ({ ...current, email: event.target.value }))
                                        }
                                        className="mt-1 w-full h-10 rounded-xl bg-background border border-border px-3"
                                    />
                                </div>

                                <div className="relative">
                                    <label className="text-sm font-medium text-foreground">Cidade</label>
                                    <input
                                        value={form.city}
                                        onFocus={() => setShowCitySuggestions(true)}
                                        onChange={(event) => {
                                            setForm((current) => ({ ...current, city: event.target.value }))
                                            setShowCitySuggestions(true)
                                        }}
                                        onBlur={() => window.setTimeout(() => setShowCitySuggestions(false), 120)}
                                        className="mt-1 w-full h-10 rounded-xl bg-background border border-border px-3"
                                        placeholder="Ex: São Paulo"
                                    />

                                    {showCitySuggestions && filteredCitySuggestions.length > 0 && (
                                        <div className="absolute left-0 right-0 top-[68px] z-50 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
                                            <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                Cidades já cadastradas
                                            </div>
                                            <div className="max-h-56 overflow-y-auto p-1.5">
                                                {filteredCitySuggestions.map((city) => (
                                                    <button
                                                        key={city}
                                                        type="button"
                                                        onMouseDown={(event) => event.preventDefault()}
                                                        onClick={() => {
                                                            setForm((current) => ({ ...current, city }))
                                                            setShowCitySuggestions(false)
                                                        }}
                                                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                                                    >
                                                        <MapPin className="h-4 w-4" />
                                                        {city}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {citySuggestions.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {citySuggestions.slice(0, 5).map((city) => (
                                                <button
                                                    key={city}
                                                    type="button"
                                                    onClick={() => setForm((current) => ({ ...current, city }))}
                                                    className="rounded-full border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                                >
                                                    {city}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <PrettySelect
                                    title="Ambiente de venda"
                                    value={form.salesEnvironmentId}
                                    onChange={(value) =>
                                        setForm((current) => ({
                                            ...current,
                                            salesEnvironmentId: value,
                                        }))
                                    }
                                >
                                    <option value="">Selecione</option>
                                    {salesEnvironments.map((environment) => (
                                        <option key={environment.id} value={environment.id}>
                                            {environment.name}
                                        </option>
                                    ))}
                                </PrettySelect>

                                <PrettySelect
                                    title="Tipo de contrato"
                                    value={form.contractType}
                                    onChange={(value) =>
                                        setForm((current) => ({
                                            ...current,
                                            contractType: value as PersonContractType,
                                        }))
                                    }
                                >
                                    <option value="NONE">Nenhum</option>
                                    <option value="CLT">CLT</option>
                                    <option value="FREELANCER">Freelancer</option>
                                    <option value="PJ">PJ</option>
                                    <option value="OTHER">Outro</option>
                                </PrettySelect>

                                <PrettySelect
                                    title="Cobrança"
                                    value={form.rateType}
                                    onChange={(value) =>
                                        setForm((current) => ({
                                            ...current,
                                            rateType: value as PersonRateType,
                                        }))
                                    }
                                >
                                    <option value="EVENT">Por evento</option>
                                    <option value="HOURLY">Por hora</option>
                                    <option value="DAILY">Diária</option>
                                    <option value="MONTHLY">Mensal</option>
                                    <option value="NEGOTIABLE">Negociável</option>
                                </PrettySelect>

                                <div>
                                    <label className="text-sm font-medium text-foreground">
                                        Valor cobrado
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={form.rateAmount}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                rateAmount: event.target.value,
                                            }))
                                        }
                                        className="mt-1 w-full h-10 rounded-xl bg-background border border-border px-3"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div>
                                        <h3 className="font-semibold text-foreground">Funções</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Ex: Músico - Bateria, Técnico de som, Barman.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={addFunctionRow}
                                        className="h-9 px-3 rounded-xl border border-border hover:bg-secondary text-sm inline-flex items-center gap-2"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Adicionar função
                                    </button>
                                </div>

                                <div className="mb-3 rounded-xl border border-border bg-background p-3">
                                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Criar nova função
                                    </p>

                                    <div className="flex gap-2">
                                        <input
                                            value={newFunctionName}
                                            onChange={(event) => setNewFunctionName(event.target.value)}
                                            placeholder="Ex: Roadie, Iluminador, Produtor..."
                                            className="h-10 flex-1 rounded-xl border border-border bg-card px-3 text-sm"
                                        />

                                        <button
                                            type="button"
                                            onClick={handleCreateFunction}
                                            disabled={isCreatingFunction || !newFunctionName.trim()}
                                            className="h-10 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
                                        >
                                            {isCreatingFunction ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Plus className="h-4 w-4" />
                                            )}
                                            Criar
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {form.functions.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                                            Nenhuma função adicionada.
                                        </div>
                                    ) : (
                                        form.functions.map((item, index) => (
                                            <div
                                                key={index}
                                                className="grid md:grid-cols-[1fr_1fr_auto] gap-3 rounded-xl border border-border bg-background p-3"
                                            >
                                                <PrettySelect
                                                    value={item.functionId}
                                                    onChange={(value) =>
                                                        updateFunctionRow(index, {
                                                            functionId: value,
                                                        })
                                                    }
                                                >
                                                    <option value="">Selecione a função</option>
                                                    {functions.map((functionItem) => (
                                                        <option key={functionItem.id} value={functionItem.id}>
                                                            {functionItem.name}
                                                        </option>
                                                    ))}
                                                </PrettySelect>

                                                <input
                                                    value={item.detail}
                                                    onChange={(event) =>
                                                        updateFunctionRow(index, { detail: event.target.value })
                                                    }
                                                    placeholder="Detalhe: Bateria, Baixo, Som..."
                                                    className="h-10 rounded-xl bg-card border border-border px-3"
                                                />

                                                <button
                                                    type="button"
                                                    onClick={() => removeFunctionRow(index)}
                                                    className="h-10 w-10 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 flex items-center justify-center"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-foreground">Observações</label>
                                <textarea
                                    value={form.observations}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            observations: event.target.value,
                                        }))
                                    }
                                    rows={4}
                                    className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2"
                                    placeholder="Pontualidade, qualidade, preferências, observações gerais..."
                                />
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-border bg-card flex items-center justify-between gap-3">
                            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={form.active}
                                    onChange={(event) =>
                                        setForm((current) => ({ ...current, active: event.target.checked }))
                                    }
                                />
                                Pessoa ativa
                            </label>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="h-10 px-4 rounded-xl border border-border hover:bg-secondary"
                                >
                                    Cancelar
                                </button>

                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="h-10 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
                                >
                                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function formatRating(value: number) {
    return value.toFixed(1).replace('.', ',')
}

function PersonRatingSummary({ rating }: { rating?: PersonEvaluationRating }) {
    if (!rating || rating.count <= 0) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Star className="h-3.5 w-3.5" />
                Sem avaliação
            </span>
        )
    }

    return (
        <div className="flex items-center gap-1" title={`Média de avaliação: ${formatRating(rating.average)}/5`}>
            {Array.from({ length: 5 }).map((_, index) => {
                const active = rating.average >= index + 1

                return (
                    <Star
                        key={index}
                        className={`h-4 w-4 ${active ? 'fill-warning text-warning' : 'text-muted-foreground/35'}`}
                    />
                )
            })}
            <span className="ml-1 text-xs font-medium text-muted-foreground">
                {formatRating(rating.average)} • {rating.count}
            </span>
        </div>
    )
}

function RatingPill({ value, label }: { value: number; label?: string }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            <Star className="h-3.5 w-3.5 fill-current" />
            {label ? `${label} ` : ''}{formatRating(value)}/5
        </span>
    )
}

function formatEvaluationDate(value?: string | Date | null) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function getEventEvaluationDetails(eventItem: NonNullable<PersonEvaluationSummary['averageByEvent']>[number]) {
    const evaluations = eventItem.evaluations ?? []
    const criteriaCount = evaluations.reduce((sum, evaluation) => sum + (evaluation.scores?.length ?? 0), 0)
    const notesCount = evaluations.filter((evaluation) => evaluation.generalNotes).length
    return { evaluations, criteriaCount, notesCount }
}

function EventEvaluationItemCard({
    evaluation,
    defaultExpanded = false,
}: {
    evaluation: NonNullable<PersonEvaluationSummary['averageByEvent']>[number]['evaluations'][number]
    defaultExpanded?: boolean
}) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded)
    const isOutros = String(evaluation.functionName ?? '').toLowerCase() === 'outros'
    const scores = evaluation.scores ?? []
    const hasDetails = scores.length > 0 || Boolean(evaluation.generalNotes)
    const functionScore = Number(evaluation.functionScore ?? 0)

    return (
        <div
            className={`overflow-hidden rounded-xl border ${
                isOutros
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border bg-background'
            }`}
        >
            <button
                type="button"
                onClick={() => hasDetails && setIsExpanded((current) => !current)}
                className={`flex w-full items-center justify-between gap-3 p-4 text-left transition ${
                    hasDetails ? 'hover:bg-secondary/40' : 'cursor-default'
                }`}
            >
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">
                            {isOutros ? 'Outros' : evaluation.functionName}
                        </p>
                        {isOutros && (
                            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                Parâmetros manuais
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {isOutros
                            ? `${scores.length} parâmetro${scores.length === 1 ? '' : 's'} manual${scores.length === 1 ? '' : 'is'}`
                            : 'Avaliação da função'}
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {!isOutros && functionScore > 0 && (
                        <RatingPill value={functionScore} label="Função" />
                    )}
                    {isOutros && scores.length > 0 && (
                        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                            {scores.length} item{scores.length === 1 ? '' : 's'}
                        </span>
                    )}
                    {hasDetails && (
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    )}
                </div>
            </button>

            {hasDetails && isExpanded && (
                <div className="border-t border-border bg-card/70 p-4">
                    {scores.length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2">
                            {scores.map((score) => (
                                <div key={score.id} className="rounded-xl border border-border bg-background px-3 py-2">
                                    <p className="text-xs text-muted-foreground">{score.criterion.name}</p>
                                    <p className="mt-0.5 font-semibold text-foreground">{score.score}/5</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {evaluation.generalNotes && (
                        <p className="mt-3 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                            {evaluation.generalNotes}
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}

function EventEvaluationCard({
    eventItem,
    isExpanded,
    onToggle,
}: {
    eventItem: NonNullable<PersonEvaluationSummary['averageByEvent']>[number]
    isExpanded: boolean
    onToggle: () => void
}) {
    const details = getEventEvaluationDetails(eventItem)
    const functionEvaluations = details.evaluations.filter(
        (evaluation) => String(evaluation.functionName ?? '').toLowerCase() !== 'outros'
    )
    const outrosEvaluations = details.evaluations.filter(
        (evaluation) => String(evaluation.functionName ?? '').toLowerCase() === 'outros'
    )

    return (
        <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-start justify-between gap-4 p-4 text-left transition hover:bg-secondary/40"
            >
                <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{eventItem.eventTitle}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatEvaluationDate(eventItem.eventStartAt)}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                        <span className="rounded-full border border-border bg-card px-2 py-1">
                            {functionEvaluations.length} função{functionEvaluations.length === 1 ? '' : 'ões'} avaliada{functionEvaluations.length === 1 ? '' : 's'}
                        </span>
                        {outrosEvaluations.length > 0 && (
                            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-primary">
                                Outros
                            </span>
                        )}
                        {details.criteriaCount > 0 && (
                            <span className="rounded-full border border-border bg-card px-2 py-1">
                                {details.criteriaCount} parâmetro{details.criteriaCount === 1 ? '' : 's'}
                            </span>
                        )}
                        {details.notesCount > 0 && (
                            <span className="rounded-full border border-border bg-card px-2 py-1">
                                {details.notesCount} observação{details.notesCount === 1 ? '' : 'ões'}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                    <RatingPill value={eventItem.average} />
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isExpanded && (
                <div className="border-t border-border bg-card/60 p-4">
                    <div className="grid gap-3">
                        {functionEvaluations.map((evaluation) => (
                            <EventEvaluationItemCard
                                key={evaluation.id}
                                evaluation={evaluation}
                                defaultExpanded
                            />
                        ))}

                        {outrosEvaluations.length > 0 && (
                            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-foreground">Outros</p>
                                        <p className="text-xs text-muted-foreground">
                                            Parâmetros manuais avaliados neste evento. Clique para expandir.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-3">
                                    {outrosEvaluations.map((evaluation) => (
                                        <EventEvaluationItemCard
                                            key={evaluation.id}
                                            evaluation={evaluation}
                                            defaultExpanded={false}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

function PersonEvaluationsModal({
    summary,
    isLoading,
    onClose,
}: {
    summary: PersonEvaluationSummary | null
    isLoading: boolean
    onClose: () => void
}) {
    const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

    useEffect(() => {
        if (!summary?.averageByEvent?.length) {
            setExpandedEventId(null)
            return
        }
        setExpandedEventId((current) => current ?? summary.averageByEvent[0]?.eventDateId ?? null)
    }, [summary])

    const bestFunction = summary?.averageByFunction?.length
        ? [...summary.averageByFunction].sort((a, b) => b.average - a.average)[0]
        : null
    const bestCriterion = summary?.averageByCriterion?.length
        ? [...summary.averageByCriterion].sort((a, b) => b.average - a.average)[0]
        : null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">Avaliações</h2>
                        <p className="text-sm text-muted-foreground">{summary?.person.name ?? 'Pessoa'}</p>
                    </div>
                    <button onClick={onClose} className="h-9 w-9 rounded-lg hover:bg-secondary flex items-center justify-center">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Carregando avaliações...
                        </div>
                    ) : !summary || summary.totalEvaluations === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                                <Star className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <h3 className="font-semibold text-foreground">Sem avaliação</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Essa pessoa ainda não possui avaliações registradas.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <section className="rounded-3xl border border-border bg-background p-5">
                                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-base font-semibold text-foreground">Resumo geral</h3>
                                        <p className="text-sm text-muted-foreground">Visão consolidada das avaliações da pessoa.</p>
                                    </div>
                                    <RatingPill value={summary.overallAverage ?? 0} label="Média" />
                                </div>
                                <div className="grid gap-3 md:grid-cols-4">
                                    <div className="rounded-2xl border border-border bg-card p-4">
                                        <p className="text-xs text-muted-foreground">Avaliações</p>
                                        <p className="mt-1 text-2xl font-bold text-foreground">{summary.totalEvaluations}</p>
                                    </div>
                                    <div className="rounded-2xl border border-border bg-card p-4">
                                        <p className="text-xs text-muted-foreground">Eventos avaliados</p>
                                        <p className="mt-1 text-2xl font-bold text-foreground">{summary.averageByEvent?.length ?? 0}</p>
                                    </div>
                                    <div className="rounded-2xl border border-border bg-card p-4">
                                        <p className="text-xs text-muted-foreground">Melhor função</p>
                                        <p className="mt-1 truncate text-sm font-semibold text-foreground">{bestFunction?.functionName ?? '-'}</p>
                                        {bestFunction && <p className="mt-1 text-xs text-primary">{formatRating(bestFunction.average)}/5</p>}
                                    </div>
                                    <div className="rounded-2xl border border-border bg-card p-4">
                                        <p className="text-xs text-muted-foreground">Melhor parâmetro</p>
                                        <p className="mt-1 truncate text-sm font-semibold text-foreground">{bestCriterion?.criterionName ?? '-'}</p>
                                        {bestCriterion && <p className="mt-1 text-xs text-primary">{formatRating(bestCriterion.average)}/5</p>}
                                    </div>
                                </div>
                            </section>

                            <section>
                                <div className="mb-3">
                                    <h3 className="font-semibold text-foreground">Avaliações por evento</h3>
                                    <p className="text-sm text-muted-foreground">Clique em um evento para abrir os detalhes das funções, parâmetros e observações.</p>
                                </div>
                                <div className="grid gap-3">
                                    {(summary.averageByEvent ?? []).map((eventItem) => (
                                        <EventEvaluationCard
                                            key={eventItem.eventDateId}
                                            eventItem={eventItem}
                                            isExpanded={expandedEventId === eventItem.eventDateId}
                                            onToggle={() => setExpandedEventId((current) => current === eventItem.eventDateId ? null : eventItem.eventDateId)}
                                        />
                                    ))}
                                </div>
                            </section>

                            <div className="grid gap-6 lg:grid-cols-2">
                                <section>
                                    <h3 className="mb-3 font-semibold text-foreground">Média por função</h3>
                                    {summary.averageByFunction.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Sem avaliações por função.</div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {summary.averageByFunction.map((item) => (
                                                <div key={item.functionName} className="rounded-2xl border border-border bg-background p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="font-medium text-foreground">{item.functionName}</p>
                                                        <RatingPill value={item.average} />
                                                    </div>
                                                    <p className="mt-1 text-xs text-muted-foreground">{item.count} evento{item.count === 1 ? '' : 's'}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                                <section>
                                    <h3 className="mb-3 font-semibold text-foreground">Média por parâmetro</h3>
                                    {summary.averageByCriterion.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Sem parâmetros avaliados.</div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {summary.averageByCriterion.map((item) => (
                                                <div key={item.criterionId} className="rounded-2xl border border-border bg-background p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="font-medium text-foreground">{item.criterionName}</p>
                                                        <RatingPill value={item.average} />
                                                    </div>
                                                    <p className="mt-1 text-xs text-muted-foreground">{item.count} avaliação{item.count === 1 ? '' : 'ões'}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
