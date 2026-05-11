'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Building2,
  Check,
  Grid3X3,
  ImageIcon,
  List,
  Loader2,
  Package,
  Plus,
  Search,
  Tags,
  X,
} from 'lucide-react'
import {
  createSupplier,
  getSuppliers,
  type Supplier,
  type SupplierInput,
} from '@/lib/api/suppliers'

type ViewMode = 'grid' | 'list'

type SupplierForm = {
  name: string
  document: string
  contactName: string
  phone: string
  email: string
  address: string
  notes: string
  photoUrl: string
  categories: string
}

const emptySupplierForm: SupplierForm = {
  name: '',
  document: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  photoUrl: '',
  categories: '',
}

function normalize(value?: string | null) {
  return value?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() ?? ''
}

function slugify(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'fornecedor'
}

function supplierUrl(supplier: Supplier) {
  return `/fornecedores/detalhe?slug=${encodeURIComponent(slugify(supplier.name))}`
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'F'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('pt-BR')
}

function supplierItemsCount(supplier: Supplier) {
  return supplier.priceTables.reduce((total, table) => total + table.items.length, 0)
}

function supplierLinkedItemsCount(supplier: Supplier) {
  return supplier.priceTables.reduce(
    (total, table) => total + table.items.filter((item) => Boolean(item.productId)).length,
    0,
  )
}

function inferCategories(supplier: Supplier) {
  const savedCategories = supplier.categories ?? []
  if (savedCategories.length > 0) return savedCategories

  const categories = new Set<string>()
  supplier.priceTables.forEach((table) => {
    table.items.forEach((item) => {
      if (item.product?.category?.name) categories.add(item.product.category.name)
    })
  })

  return Array.from(categories).slice(0, 5)
}

function buildSupplierPayload(form: SupplierForm): SupplierInput {
  return {
    name: form.name.trim(),
    document: form.document.trim() || null,
    contactName: form.contactName.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    address: form.address.trim() || null,
    notes: form.notes.trim() || null,
    photoUrl: form.photoUrl.trim() || null,
    categories: form.categories.split(',').map((item) => item.trim()).filter(Boolean),
    createDefaultTable: true,
  }
}

export default function FornecedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplierForm)

  async function loadSuppliers() {
    setError('')
    setLoading(true)

    try {
      setSuppliers(await getSuppliers())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar fornecedores.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSuppliers()
  }, [])

  const filteredSuppliers = useMemo(() => {
    const term = normalize(search)
    if (!term) return suppliers

    return suppliers.filter((supplier) => {
      const categories = inferCategories(supplier).join(' ')
      const haystack = [
        supplier.name,
        supplier.document,
        supplier.contactName,
        supplier.phone,
        supplier.email,
        supplier.address,
        supplier.notes,
        categories,
      ].map(normalize).join(' ')

      return haystack.includes(term)
    })
  }, [search, suppliers])

  const stats = useMemo(() => {
    return {
      active: suppliers.filter((supplier) => supplier.active).length,
      tables: suppliers.reduce((total, supplier) => total + supplier.priceTables.length, 0),
      items: suppliers.reduce((total, supplier) => total + supplierItemsCount(supplier), 0),
      linkedItems: suppliers.reduce((total, supplier) => total + supplierLinkedItemsCount(supplier), 0),
    }
  }, [suppliers])

  function showSuccess(message: string) {
    setSuccess(message)
    window.setTimeout(() => setSuccess(''), 2500)
  }

  function closeModal() {
    if (saving) return
    setModalOpen(false)
    setSupplierForm(emptySupplierForm)
  }

  async function handleCreateSupplier() {
    if (!supplierForm.name.trim()) return

    setError('')
    setSaving(true)

    try {
      await createSupplier(buildSupplierPayload(supplierForm))
      await loadSuppliers()
      closeModal()
      showSuccess('Fornecedor cadastrado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar fornecedor.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-6 text-foreground">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-3xl border border-border bg-card px-5 py-4 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="font-semibold">Carregando fornecedores...</span>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-2xl">
          <div className="relative p-5 sm:p-6">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-primary">
                  <Building2 className="h-4 w-4" />
                  Gestão
                </div>
                <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Fornecedores</h1>
                <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  Visualize fornecedores por card ou tabela, organize por categorias e acesse uma página dedicada para tabelas de preço e itens.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
                <StatCard label="Fornecedores ativos" value={stats.active} />
                <StatCard label="Tabelas de preço" value={stats.tables} />
                <StatCard label="Itens cadastrados" value={stats.items} />
                <StatCard label="Itens vinculados" value={stats.linkedItems} />
              </div>
            </div>

            {(error || success) && (
              <div className={`relative mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                error
                  ? 'border-red-500/30 bg-red-500/10 text-red-300'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              }`}>
                {error || success}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-4 shadow-xl sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-4 text-sm outline-none focus:border-primary"
                placeholder="Buscar por nome, contato, categoria, documento..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-2xl border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
                >
                  <Grid3X3 className="h-4 w-4" />
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
                >
                  <List className="h-4 w-4" />
                  Lista
                </button>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-lg transition hover:brightness-110"
              >
                <Plus className="h-4 w-4" />
                Novo fornecedor
              </button>
            </div>
          </div>
        </section>

        {filteredSuppliers.length === 0 ? (
          <section className="rounded-[2rem] border border-dashed border-border bg-card p-12 text-center shadow-xl">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-black">Nenhum fornecedor encontrado</h2>
            <p className="mt-2 text-sm text-muted-foreground">Cadastre um novo fornecedor ou ajuste a busca.</p>
          </section>
        ) : viewMode === 'grid' ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredSuppliers.map((supplier) => (
              <SupplierCard key={supplier.id} supplier={supplier} />
            ))}
          </section>
        ) : (
          <section className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl">
            <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_100px_100px_120px] gap-3 border-b border-border bg-muted/40 px-5 py-3 text-xs font-black uppercase text-muted-foreground lg:grid">
              <span>Fornecedor</span>
              <span>Categorias</span>
              <span>Contato</span>
              <span>Tabelas</span>
              <span>Itens</span>
              <span>Atualizado</span>
            </div>
            <div className="divide-y divide-border">
              {filteredSuppliers.map((supplier) => (
                <SupplierRow key={supplier.id} supplier={supplier} />
              ))}
            </div>
          </section>
        )}
      </div>

      {modalOpen && (
        <SupplierModal
          form={supplierForm}
          saving={saving}
          onClose={closeModal}
          onSave={handleCreateSupplier}
          onChange={(patch) => setSupplierForm((current) => ({ ...current, ...patch }))}
        />
      )}
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  )
}

function SupplierAvatar({ supplier, large = false }: { supplier: Supplier; large?: boolean }) {
  const size = large ? 'h-24 w-24 text-3xl' : 'h-14 w-14 text-lg'

  if (supplier.photoUrl) {
    return (
      <div className={`${size} overflow-hidden rounded-3xl border border-border bg-muted`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={supplier.photoUrl} alt={supplier.name} className="h-full w-full object-cover" />
      </div>
    )
  }

  return (
    <div className={`${size} inline-flex shrink-0 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10 font-black text-primary`}>
      {initials(supplier.name)}
    </div>
  )
}

function CategoryChips({ categories }: { categories: string[] }) {
  if (categories.length === 0) {
    return <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-bold text-muted-foreground">Sem categoria</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.slice(0, 4).map((category) => (
        <span key={category} className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-black text-primary">
          {category}
        </span>
      ))}
      {categories.length > 4 && (
        <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-black text-muted-foreground">+{categories.length - 4}</span>
      )}
    </div>
  )
}

function SupplierCard({ supplier }: { supplier: Supplier }) {
  const categories = inferCategories(supplier)
  const items = supplierItemsCount(supplier)

  return (
    <Link
      href={supplierUrl(supplier)}
      className="group overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-2xl"
    >
      <div className="relative h-36 bg-muted">
        {supplier.photoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={supplier.photoUrl} alt={supplier.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          </>
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 via-background to-muted">
            <SupplierAvatar supplier={supplier} large />
          </div>
        )}
        <div className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1 text-xs font-black backdrop-blur">
          {supplier.active ? 'Ativo' : 'Inativo'}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black tracking-tight">{supplier.name}</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {supplier.contactName || supplier.phone || supplier.email || 'Sem contato cadastrado'}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <CategoryChips categories={categories} />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniMetric icon={<Tags className="h-4 w-4" />} label="Tabelas" value={supplier.priceTables.length} />
          <MiniMetric icon={<Package className="h-4 w-4" />} label="Itens" value={items} />
          <MiniMetric icon={<Check className="h-4 w-4" />} label="Vinc." value={supplierLinkedItemsCount(supplier)} />
        </div>
      </div>
    </Link>
  )
}

function SupplierRow({ supplier }: { supplier: Supplier }) {
  const categories = inferCategories(supplier)

  return (
    <Link
      href={supplierUrl(supplier)}
      className="grid gap-3 px-5 py-4 transition hover:bg-secondary/60 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_100px_100px_120px] lg:items-center"
    >
      <div className="flex min-w-0 items-center gap-3">
        <SupplierAvatar supplier={supplier} />
        <div className="min-w-0">
          <p className="truncate font-black">{supplier.name}</p>
          <p className="truncate text-xs text-muted-foreground">{supplier.document || supplier.address || 'Sem documento/endereço'}</p>
        </div>
      </div>
      <CategoryChips categories={categories} />
      <div className="min-w-0 text-sm text-muted-foreground">
        <p className="truncate">{supplier.contactName || '—'}</p>
        <p className="truncate text-xs">{supplier.phone || supplier.email || 'Sem contato'}</p>
      </div>
      <p className="text-sm font-black">{supplier.priceTables.length}</p>
      <p className="text-sm font-black">{supplierItemsCount(supplier)}</p>
      <p className="text-sm font-bold text-muted-foreground">{formatDate(supplier.updatedAt)}</p>
    </Link>
  )
}

function MiniMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[10px] font-black uppercase">{label}</span></div>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  )
}

function SupplierModal({
  form,
  saving,
  onClose,
  onSave,
  onChange,
}: {
  form: SupplierForm
  saving: boolean
  onClose: () => void
  onSave: () => void
  onChange: (patch: Partial<SupplierForm>) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-border bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 p-5 backdrop-blur">
          <div>
            <h2 className="text-xl font-black">Novo fornecedor</h2>
            <p className="text-sm text-muted-foreground">Cadastre os dados principais. As tabelas de preço ficam na página do fornecedor.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Nome do fornecedor" className="md:col-span-2">
            <input value={form.name} onChange={(event) => onChange({ name: event.target.value })} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Ex: Distribuidora Central" />
          </Field>

          <Field label="Categorias vendidas" className="md:col-span-2" hint="Separe por vírgula. Ex: Bebidas, Carnes, Descartáveis">
            <input value={form.categories} onChange={(event) => onChange({ categories: event.target.value })} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Bebidas, Alimentos, Limpeza" />
          </Field>

          <Field label="Foto / imagem do fornecedor" className="md:col-span-2" hint="Use uma URL pública. Pode ser logo, fachada ou imagem representativa.">
            <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)] md:items-center">
              <div className="flex h-28 items-center justify-center overflow-hidden rounded-3xl border border-border bg-background">
                {form.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.photoUrl} alt="Prévia" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <input value={form.photoUrl} onChange={(event) => onChange({ photoUrl: event.target.value })} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" placeholder="https://..." />
            </div>
          </Field>

          <Field label="Documento">
            <input value={form.document} onChange={(event) => onChange({ document: event.target.value })} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" placeholder="CNPJ/CPF" />
          </Field>
          <Field label="Contato">
            <input value={form.contactName} onChange={(event) => onChange({ contactName: event.target.value })} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Nome do vendedor" />
          </Field>
          <Field label="Telefone">
            <input value={form.phone} onChange={(event) => onChange({ phone: event.target.value })} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" placeholder="(11) 99999-9999" />
          </Field>
          <Field label="E-mail">
            <input value={form.email} onChange={(event) => onChange({ email: event.target.value })} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" placeholder="contato@fornecedor.com" />
          </Field>
          <Field label="Endereço" className="md:col-span-2">
            <input value={form.address} onChange={(event) => onChange({ address: event.target.value })} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" placeholder="Rua, bairro, cidade..." />
          </Field>
          <Field label="Observações" className="md:col-span-2">
            <textarea value={form.notes} onChange={(event) => onChange({ notes: event.target.value })} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary min-h-[110px] resize-none" placeholder="Prazo, pedido mínimo, entrega, condição de pagamento..." />
          </Field>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-card/95 p-5 backdrop-blur">
          <button type="button" onClick={onClose} className="rounded-2xl border border-border px-4 py-3 text-sm font-black hover:bg-secondary">
            Cancelar
          </button>
          <button type="button" onClick={onSave} disabled={saving || !form.name.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Cadastrar
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, className = '', children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <label className={`grid gap-1.5 text-sm font-bold ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <span className="text-xs font-medium text-muted-foreground">{hint}</span>}
    </label>
  )
}
