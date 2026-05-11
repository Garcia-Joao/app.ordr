'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  Building2,
  Check,
  Edit3,
  Grid3X3,
  ImageIcon,
  List,
  Loader2,
  Mail,
  PackagePlus,
  Phone,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import {
  createSupplierPriceTable,
  createSupplierPriceTableItem,
  deleteSupplier,
  deleteSupplierPriceTable,
  deleteSupplierPriceTableItem,
  getSuppliers,
  updateSupplier,
  updateSupplierPriceTable,
  updateSupplierPriceTableItem,
  type Supplier,
  type SupplierInput,
  type SupplierPriceTable,
  type SupplierPriceTableInput,
  type SupplierPriceTableItem,
  type SupplierPriceTableItemInput,
} from '@/lib/api/suppliers'
import { getStockProducts, type StockProduct, type StockUnit } from '@/lib/api/stock'

type ViewMode = 'grid' | 'list'
type ModalKind = 'supplier' | 'table' | 'item' | null

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
  active: boolean
}

type TableForm = {
  name: string
  description: string
  validFrom: string
  validUntil: string
  active: boolean
}

type ItemForm = {
  productId: string
  itemName: string
  sku: string
  unit: StockUnit
  quantity: string
  unitPrice: string
  notes: string
}

const UNITS: { value: StockUnit; label: string }[] = [
  { value: 'unit', label: 'un.' },
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'l' },
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
]

const emptyTableForm: TableForm = {
  name: '',
  description: '',
  validFrom: '',
  validUntil: '',
  active: true,
}

const emptyItemForm: ItemForm = {
  productId: '',
  itemName: '',
  sku: '',
  unit: 'unit',
  quantity: '1',
  unitPrice: '',
  notes: '',
}

function normalize(value?: string | null) {
  return value?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() ?? ''
}

function slugify(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'fornecedor'
}

function formatBRL(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatQuantity(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('pt-BR')
}

function toDateInput(value?: string | null) {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
}

function getUnitLabel(unit?: StockUnit | null) {
  return UNITS.find((item) => item.value === unit)?.label ?? unit ?? 'un.'
}

function getProductLabel(product: StockProduct) {
  const category = product.category?.name ? ` • ${product.category.name}` : ''
  return `${product.emoji ? `${product.emoji} ` : ''}${product.name}${category}`
}

function supplierItemsCount(supplier: Supplier) {
  return supplier.priceTables.reduce((total, table) => total + table.items.length, 0)
}

function supplierLinkedItemsCount(supplier: Supplier) {
  return supplier.priceTables.reduce((total, table) => total + table.items.filter((item) => Boolean(item.productId)).length, 0)
}

function supplierToForm(supplier: Supplier): SupplierForm {
  return {
    name: supplier.name ?? '',
    document: supplier.document ?? '',
    contactName: supplier.contactName ?? '',
    phone: supplier.phone ?? '',
    email: supplier.email ?? '',
    address: supplier.address ?? '',
    notes: supplier.notes ?? '',
    photoUrl: supplier.photoUrl ?? '',
    categories: (supplier.categories ?? []).join(', '),
    active: supplier.active,
  }
}

function supplierPayload(form: SupplierForm): Partial<SupplierInput> {
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
    active: form.active,
  }
}

function tableToForm(table?: SupplierPriceTable | null): TableForm {
  if (!table) return emptyTableForm
  return {
    name: table.name,
    description: table.description ?? '',
    validFrom: toDateInput(table.validFrom),
    validUntil: toDateInput(table.validUntil),
    active: table.active,
  }
}

function itemToForm(item?: SupplierPriceTableItem | null): ItemForm {
  if (!item) return emptyItemForm
  return {
    productId: item.productId ?? '',
    itemName: item.itemName ?? '',
    sku: item.sku ?? '',
    unit: item.unit ?? 'unit',
    quantity: String(item.quantity ?? '1'),
    unitPrice: String(item.unitPrice ?? ''),
    notes: item.notes ?? '',
  }
}

export default function SupplierDetailPage() {
  const router = useRouter()
  const [wantedSlug, setWantedSlug] = useState('')

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<StockProduct[]>([])
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [itemSearch, setItemSearch] = useState('')
  const [itemViewMode, setItemViewMode] = useState<ViewMode>('list')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [modalKind, setModalKind] = useState<ModalKind>(null)
  const [editingTableId, setEditingTableId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [supplierForm, setSupplierForm] = useState<SupplierForm | null>(null)
  const [tableForm, setTableForm] = useState<TableForm>(emptyTableForm)
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm)

  const supplier = useMemo(() => {
    return suppliers.find((item) => slugify(item.name) === wantedSlug || item.id === wantedSlug) ?? null
  }, [suppliers, wantedSlug])

  const selectedTable = useMemo(() => {
    if (!supplier) return null
    return supplier.priceTables.find((table) => table.id === selectedTableId) ?? supplier.priceTables[0] ?? null
  }, [selectedTableId, supplier])

  const filteredItems = useMemo(() => {
    const items = selectedTable?.items ?? []
    const term = normalize(itemSearch)
    if (!term) return items

    return items.filter((item) => {
      const haystack = [
        item.itemName,
        item.sku,
        item.notes,
        item.product?.name,
        item.product?.category?.name,
      ].map(normalize).join(' ')

      return haystack.includes(term)
    })
  }, [itemSearch, selectedTable])

  async function loadData() {
    setError('')
    setLoading(true)

    try {
      const [supplierResult, productResult] = await Promise.all([getSuppliers(), getStockProducts()])
      setSuppliers(supplierResult)
      setProducts(productResult.filter((product) => !((product as { deletedAt?: unknown }).deletedAt)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar fornecedor.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('slug') ?? ''
    setWantedSlug(decodeURIComponent(slug))
  }, [])

  useEffect(() => {
    if (!wantedSlug) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedSlug])

  useEffect(() => {
    if (!supplier) return
    if (!selectedTableId || !supplier.priceTables.some((table) => table.id === selectedTableId)) {
      setSelectedTableId(supplier.priceTables[0]?.id ?? null)
    }
  }, [selectedTableId, supplier])

  function showSuccess(message: string) {
    setSuccess(message)
    window.setTimeout(() => setSuccess(''), 2500)
  }

  async function refreshSupplier(nextSupplier?: Supplier) {
    const nextSuppliers = await getSuppliers()
    setSuppliers(nextSuppliers)

    const current = nextSupplier
      ? nextSuppliers.find((item) => item.id === nextSupplier.id)
      : supplier
        ? nextSuppliers.find((item) => item.id === supplier.id)
        : null

    if (current && slugify(current.name) !== wantedSlug) {
      router.replace(`/fornecedores/detalhe?slug=${encodeURIComponent(slugify(current.name))}`)
    }
  }

  function openSupplierModal() {
    if (!supplier) return
    setSupplierForm(supplierToForm(supplier))
    setModalKind('supplier')
  }

  function openTableModal(table?: SupplierPriceTable) {
    setEditingTableId(table?.id ?? null)
    setTableForm(tableToForm(table))
    setModalKind('table')
  }

  function openItemModal(item?: SupplierPriceTableItem) {
    setEditingItemId(item?.id ?? null)
    setItemForm(itemToForm(item))
    setModalKind('item')
  }

  function closeModal() {
    if (saving) return
    setModalKind(null)
    setEditingTableId(null)
    setEditingItemId(null)
    setSupplierForm(null)
    setTableForm(emptyTableForm)
    setItemForm(emptyItemForm)
  }

  async function handleSaveSupplier() {
    if (!supplier || !supplierForm?.name.trim()) return

    setSaving(true)
    setError('')

    try {
      const nextSupplier = await updateSupplier(supplier.id, supplierPayload(supplierForm))
      await refreshSupplier(nextSupplier)
      closeModal()
      showSuccess('Fornecedor atualizado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar fornecedor.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivateSupplier() {
    if (!supplier) return
    if (!window.confirm(`Desativar o fornecedor ${supplier.name}?`)) return

    setSaving(true)
    setError('')

    try {
      await deleteSupplier(supplier.id)
      await refreshSupplier()
      showSuccess('Fornecedor desativado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desativar fornecedor.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveTable() {
    if (!supplier || !tableForm.name.trim()) return

    setSaving(true)
    setError('')

    try {
      const payload: SupplierPriceTableInput = {
        name: tableForm.name,
        description: tableForm.description || null,
        validFrom: tableForm.validFrom || null,
        validUntil: tableForm.validUntil || null,
        active: tableForm.active,
      }
      const nextSupplier = editingTableId
        ? await updateSupplierPriceTable(supplier.id, editingTableId, payload)
        : await createSupplierPriceTable(supplier.id, payload)

      await refreshSupplier(nextSupplier)
      setSelectedTableId(nextSupplier.priceTables[0]?.id ?? null)
      closeModal()
      showSuccess(editingTableId ? 'Tabela atualizada.' : 'Tabela criada.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar tabela.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTable(table: SupplierPriceTable) {
    if (!supplier) return
    if (!window.confirm(`Excluir a tabela ${table.name}?`)) return

    setSaving(true)
    setError('')

    try {
      const nextSupplier = await deleteSupplierPriceTable(supplier.id, table.id)
      await refreshSupplier(nextSupplier)
      setSelectedTableId(nextSupplier.priceTables[0]?.id ?? null)
      showSuccess('Tabela removida.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover tabela.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveItem() {
    if (!supplier || !selectedTable) return

    const linkedProduct = products.find((product) => product.id === itemForm.productId)
    const payload: SupplierPriceTableItemInput = {
      productId: itemForm.productId || null,
      itemName: itemForm.itemName || linkedProduct?.name || null,
      sku: itemForm.sku || null,
      unit: itemForm.unit || linkedProduct?.stockUnit || 'unit',
      quantity: itemForm.quantity || '1',
      unitPrice: itemForm.unitPrice,
      notes: itemForm.notes || null,
    }

    if (!payload.unitPrice || (!payload.itemName && !payload.productId)) return

    setSaving(true)
    setError('')

    try {
      const nextSupplier = editingItemId
        ? await updateSupplierPriceTableItem(supplier.id, selectedTable.id, editingItemId, payload)
        : await createSupplierPriceTableItem(supplier.id, selectedTable.id, payload)

      await refreshSupplier(nextSupplier)
      closeModal()
      showSuccess(editingItemId ? 'Item atualizado.' : 'Item adicionado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar item.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteItem(item: SupplierPriceTableItem) {
    if (!supplier || !selectedTable) return
    if (!window.confirm(`Remover ${item.itemName} da tabela?`)) return

    setSaving(true)
    setError('')

    try {
      const nextSupplier = await deleteSupplierPriceTableItem(supplier.id, selectedTable.id, item.id)
      await refreshSupplier(nextSupplier)
      showSuccess('Item removido.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover item.')
    } finally {
      setSaving(false)
    }
  }

  function handleProductSelected(productId: string) {
    const product = products.find((item) => item.id === productId)
    setItemForm((current) => ({
      ...current,
      productId,
      itemName: product?.name ?? current.itemName,
      unit: product?.stockUnit ?? current.unit,
    }))
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-6 text-foreground">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-3xl border border-border bg-card px-5 py-4 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="font-semibold">Carregando fornecedor...</span>
          </div>
        </div>
      </main>
    )
  }

  if (!supplier) {
    return (
      <main className="min-h-screen bg-background p-6 text-foreground">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-border bg-card p-8 text-center shadow-xl">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-black">Fornecedor não encontrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">Volte para a listagem e selecione um fornecedor válido.</p>
          <Link href="/fornecedores" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground">
            <ArrowLeft className="h-4 w-4" />
            Voltar para fornecedores
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <Link href="/fornecedores" className="inline-flex w-fit items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2 text-sm font-black hover:bg-secondary">
          <ArrowLeft className="h-4 w-4" />
          Fornecedores
        </Link>

        <section className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-2xl">
          <div className="relative min-h-[240px] bg-muted">
            {supplier.photoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={supplier.photoUrl} alt={supplier.name} className="h-64 w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-black/10" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-muted" />
            )}

            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${supplier.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                      {supplier.active ? 'Ativo' : 'Inativo'}
                    </span>
                    {(supplier.categories ?? []).map((category) => (
                      <span key={category} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">{category}</span>
                    ))}
                  </div>
                  <h1 className="text-3xl font-black tracking-tight sm:text-5xl">{supplier.name}</h1>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Phone className="h-4 w-4" /> {supplier.phone || 'Sem telefone'}</span>
                    <span className="inline-flex items-center gap-1"><Mail className="h-4 w-4" /> {supplier.email || 'Sem e-mail'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={openSupplierModal} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-black hover:bg-secondary">
                    <Edit3 className="h-4 w-4" />
                    Editar fornecedor
                  </button>
                  <button type="button" onClick={handleDeactivateSupplier} disabled={!supplier.active || saving} className="inline-flex items-center gap-2 rounded-2xl border border-red-500/30 bg-card px-4 py-3 text-sm font-black text-red-300 hover:bg-red-500/10 disabled:opacity-40">
                    <Trash2 className="h-4 w-4" />
                    Desativar
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <InfoCard label="Contato" value={supplier.contactName || '—'} />
            <InfoCard label="Documento" value={supplier.document || '—'} />
            <InfoCard label="Tabelas" value={String(supplier.priceTables.length)} />
            <InfoCard label="Itens" value={String(supplierItemsCount(supplier))} />
          </div>

          {(supplier.address || supplier.notes) && (
            <div className="grid gap-3 border-t border-border p-5 lg:grid-cols-2">
              {supplier.address && <InfoPanel title="Endereço" text={supplier.address} />}
              {supplier.notes && <InfoPanel title="Observações" text={supplier.notes} />}
            </div>
          )}
        </section>

        {(error || success) && (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
            {error || success}
          </div>
        )}

        <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-[2rem] border border-border bg-card p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Tabelas de preço</h2>
                <p className="text-xs text-muted-foreground">Organize por data, condição ou fornecedor.</p>
              </div>
              <button type="button" onClick={() => openTableModal()} className="rounded-2xl bg-primary p-3 text-primary-foreground hover:brightness-110" title="Nova tabela">
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {supplier.priceTables.map((table) => {
                const active = selectedTable?.id === table.id
                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => setSelectedTableId(table.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${active ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10' : 'border-border bg-background/70 hover:border-primary/40 hover:bg-secondary/60'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-black">{table.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{table.items.length} item(ns)</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${table.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-muted text-muted-foreground'}`}>{table.active ? 'Ativa' : 'Inativa'}</span>
                    </div>
                  </button>
                )
              })}

              {supplier.priceTables.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Nenhuma tabela criada.
                </div>
              )}
            </div>
          </aside>

          <section className="min-w-0 rounded-[2rem] border border-border bg-card p-4 shadow-xl sm:p-5">
            {!selectedTable ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-border p-8 text-center">
                <div>
                  <Tag className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-xl font-black">Nenhuma tabela selecionada</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Crie uma tabela de preços para cadastrar os itens vendidos.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-black">{selectedTable.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedTable.description || 'Tabela sem descrição'} • validade {formatDate(selectedTable.validFrom)} até {formatDate(selectedTable.validUntil)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => openTableModal(selectedTable)} className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm font-black hover:bg-secondary">
                      <Edit3 className="h-4 w-4" />
                      Editar tabela
                    </button>
                    <button type="button" onClick={() => handleDeleteTable(selectedTable)} className="inline-flex items-center gap-2 rounded-2xl border border-red-500/30 px-4 py-2 text-sm font-black text-red-300 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </button>
                    <button type="button" onClick={() => openItemModal()} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground hover:brightness-110">
                      <PackagePlus className="h-4 w-4" />
                      Novo item
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <input
                    value={itemSearch}
                    onChange={(event) => setItemSearch(event.target.value)}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary lg:max-w-md"
                    placeholder="Buscar item, SKU, categoria..."
                  />
                  <div className="inline-flex w-fit rounded-2xl border border-border bg-background p-1">
                    <button type="button" onClick={() => setItemViewMode('grid')} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black ${itemViewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
                      <Grid3X3 className="h-4 w-4" /> Grid
                    </button>
                    <button type="button" onClick={() => setItemViewMode('list')} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black ${itemViewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
                      <List className="h-4 w-4" /> Lista
                    </button>
                  </div>
                </div>

                {itemViewMode === 'grid' ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredItems.map((item) => (
                      <ItemCard key={item.id} item={item} onEdit={() => openItemModal(item)} onDelete={() => handleDeleteItem(item)} />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-3xl border border-border bg-card">
                    <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_90px_90px_110px_110px] gap-3 border-b border-border bg-muted/40 px-4 py-3 text-xs font-black uppercase text-muted-foreground lg:grid">
                      <span>Item</span><span>Vínculo</span><span>Qtd.</span><span>Unidade</span><span>Preço</span><span>Ações</span>
                    </div>
                    <div className="divide-y divide-border">
                      {filteredItems.map((item) => (
                        <ItemRow key={item.id} item={item} onEdit={() => openItemModal(item)} onDelete={() => handleDeleteItem(item)} />
                      ))}
                    </div>
                  </div>
                )}

                {filteredItems.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Nenhum item encontrado nessa tabela.
                  </div>
                )}
              </div>
            )}
          </section>
        </section>
      </div>

      {modalKind === 'supplier' && supplierForm && (
        <SupplierModal form={supplierForm} saving={saving} onClose={closeModal} onSave={handleSaveSupplier} onChange={(patch) => setSupplierForm((current) => current ? { ...current, ...patch } : current)} />
      )}
      {modalKind === 'table' && (
        <TableModal form={tableForm} saving={saving} editing={Boolean(editingTableId)} onClose={closeModal} onSave={handleSaveTable} onChange={(patch) => setTableForm((current) => ({ ...current, ...patch }))} />
      )}
      {modalKind === 'item' && (
        <ItemModal form={itemForm} products={products} saving={saving} editing={Boolean(editingItemId)} onClose={closeModal} onSave={handleSaveItem} onProductSelected={handleProductSelected} onChange={(patch) => setItemForm((current) => ({ ...current, ...patch }))} />
      )}
    </main>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-background/70 p-4"><p className="text-xs font-bold uppercase text-muted-foreground">{label}</p><p className="mt-1 truncate text-lg font-black">{value}</p></div>
}

function InfoPanel({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-border bg-background/70 p-4"><p className="text-xs font-bold uppercase text-muted-foreground">{title}</p><p className="mt-2 text-sm text-muted-foreground">{text}</p></div>
}

function ItemCard({ item, onEdit, onDelete }: { item: SupplierPriceTableItem; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-3xl border border-border bg-background/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-black">{item.itemName}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{item.sku ? `SKU: ${item.sku}` : item.notes || 'Sem observações'}</p>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={onEdit} className="rounded-xl border border-border p-2 hover:bg-secondary"><Edit3 className="h-4 w-4" /></button>
          <button type="button" onClick={onDelete} className="rounded-xl border border-red-500/30 p-2 text-red-300 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {item.product ? <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-black text-primary">{item.product.emoji ? `${item.product.emoji} ` : ''}{item.product.name}</span> : <span className="rounded-full bg-muted px-2 py-1 text-xs font-black text-muted-foreground">Item livre</span>}
        {item.product?.category?.name && <span className="rounded-full bg-muted px-2 py-1 text-xs font-black text-muted-foreground">{item.product.category.name}</span>}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <InfoCard label="Qtd." value={formatQuantity(item.quantity)} />
        <InfoCard label="Unid." value={getUnitLabel(item.unit)} />
        <InfoCard label="Preço" value={formatBRL(item.unitPrice)} />
      </div>
    </div>
  )
}

function ItemRow({ item, onEdit, onDelete }: { item: SupplierPriceTableItem; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_90px_90px_110px_110px] lg:items-center">
      <div className="min-w-0"><p className="font-black">{item.itemName}</p><p className="truncate text-xs text-muted-foreground">{item.sku ? `SKU: ${item.sku}` : item.notes || 'Sem observações'}</p></div>
      <div>{item.product ? <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{item.product.emoji ? `${item.product.emoji} ` : ''}{item.product.name}</span> : <span className="rounded-full bg-muted px-2 py-1 text-xs font-bold">Item livre</span>}</div>
      <div className="text-sm font-bold">{formatQuantity(item.quantity)}</div>
      <div className="text-sm font-bold">{getUnitLabel(item.unit)}</div>
      <div className="text-sm font-black">{formatBRL(item.unitPrice)}</div>
      <div className="flex gap-2"><button type="button" onClick={onEdit} className="rounded-xl border border-border p-2 hover:bg-secondary"><Edit3 className="h-4 w-4" /></button><button type="button" onClick={onDelete} className="rounded-xl border border-red-500/30 p-2 text-red-300 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button></div>
    </div>
  )
}

const inputClass = 'rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary'

function ModalShell({ title, description, children, footer, onClose }: { title: string; description?: string; children: ReactNode; footer: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-border bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 p-5 backdrop-blur">
          <div><h2 className="text-xl font-black">{title}</h2>{description && <p className="text-sm text-muted-foreground">{description}</p>}</div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">{children}</div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-card/95 p-5 backdrop-blur">{footer}</div>
      </div>
    </div>
  )
}

function Field({ label, hint, className = '', children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  return <label className={`grid gap-1.5 text-sm font-bold ${className}`}><span>{label}</span>{children}{hint && <span className="text-xs font-medium text-muted-foreground">{hint}</span>}</label>
}

function SupplierModal({ form, saving, onClose, onSave, onChange }: { form: SupplierForm; saving: boolean; onClose: () => void; onSave: () => void; onChange: (patch: Partial<SupplierForm>) => void }) {
  return (
    <ModalShell title="Editar fornecedor" description="Atualize dados visuais, categorias e contato." onClose={onClose} footer={<><button type="button" onClick={onClose} className="rounded-2xl border border-border px-4 py-3 text-sm font-black hover:bg-secondary">Cancelar</button><button type="button" onClick={onSave} disabled={saving || !form.name.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Salvar</button></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nome" className="md:col-span-2"><input value={form.name} onChange={(event) => onChange({ name: event.target.value })} className={inputClass} /></Field>
        <Field label="Categorias" className="md:col-span-2" hint="Separe por vírgula. Ex: Bebidas, Alimentos, Limpeza"><input value={form.categories} onChange={(event) => onChange({ categories: event.target.value })} className={inputClass} /></Field>
        <Field label="Foto / imagem" className="md:col-span-2"><div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)] md:items-center"><div className="flex h-28 items-center justify-center overflow-hidden rounded-3xl border border-border bg-background">{form.photoUrl ? <img src={form.photoUrl} alt="Prévia" className="h-full w-full object-cover" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}</div><input value={form.photoUrl} onChange={(event) => onChange({ photoUrl: event.target.value })} className={inputClass} placeholder="https://..." /></div></Field>
        <Field label="Documento"><input value={form.document} onChange={(event) => onChange({ document: event.target.value })} className={inputClass} /></Field>
        <Field label="Contato"><input value={form.contactName} onChange={(event) => onChange({ contactName: event.target.value })} className={inputClass} /></Field>
        <Field label="Telefone"><input value={form.phone} onChange={(event) => onChange({ phone: event.target.value })} className={inputClass} /></Field>
        <Field label="E-mail"><input value={form.email} onChange={(event) => onChange({ email: event.target.value })} className={inputClass} /></Field>
        <Field label="Endereço" className="md:col-span-2"><input value={form.address} onChange={(event) => onChange({ address: event.target.value })} className={inputClass} /></Field>
        <Field label="Observações" className="md:col-span-2"><textarea value={form.notes} onChange={(event) => onChange({ notes: event.target.value })} className={`${inputClass} min-h-[110px] resize-none`} /></Field>
        <label className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-sm font-black md:col-span-2"><input type="checkbox" checked={form.active} onChange={(event) => onChange({ active: event.target.checked })} />Fornecedor ativo</label>
      </div>
    </ModalShell>
  )
}

function TableModal({ form, saving, editing, onClose, onSave, onChange }: { form: TableForm; saving: boolean; editing: boolean; onClose: () => void; onSave: () => void; onChange: (patch: Partial<TableForm>) => void }) {
  return (
    <ModalShell title={editing ? 'Editar tabela' : 'Nova tabela'} description="Use tabelas para separar cotações, validade ou condições comerciais." onClose={onClose} footer={<><button type="button" onClick={onClose} className="rounded-2xl border border-border px-4 py-3 text-sm font-black hover:bg-secondary">Cancelar</button><button type="button" onClick={onSave} disabled={saving || !form.name.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{editing ? 'Salvar' : 'Criar'}</button></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nome" className="md:col-span-2"><input value={form.name} onChange={(event) => onChange({ name: event.target.value })} className={inputClass} placeholder="Tabela padrão, cotação maio..." /></Field>
        <Field label="Descrição" className="md:col-span-2"><textarea value={form.description} onChange={(event) => onChange({ description: event.target.value })} className={`${inputClass} min-h-[90px] resize-none`} /></Field>
        <Field label="Válida de"><input type="date" value={form.validFrom} onChange={(event) => onChange({ validFrom: event.target.value })} className={inputClass} /></Field>
        <Field label="Válida até"><input type="date" value={form.validUntil} onChange={(event) => onChange({ validUntil: event.target.value })} className={inputClass} /></Field>
        <label className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-sm font-black md:col-span-2"><input type="checkbox" checked={form.active} onChange={(event) => onChange({ active: event.target.checked })} />Tabela ativa</label>
      </div>
    </ModalShell>
  )
}

function ItemModal({ form, products, saving, editing, onClose, onSave, onChange, onProductSelected }: { form: ItemForm; products: StockProduct[]; saving: boolean; editing: boolean; onClose: () => void; onSave: () => void; onChange: (patch: Partial<ItemForm>) => void; onProductSelected: (productId: string) => void }) {
  return (
    <ModalShell title={editing ? 'Editar item' : 'Novo item'} description="Cadastre um item livre ou vincule a um produto do estoque." onClose={onClose} footer={<><button type="button" onClick={onClose} className="rounded-2xl border border-border px-4 py-3 text-sm font-black hover:bg-secondary">Cancelar</button><button type="button" onClick={onSave} disabled={saving || !form.unitPrice || (!form.itemName.trim() && !form.productId)} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{editing ? 'Salvar' : 'Adicionar'}</button></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Produto do estoque" className="md:col-span-2"><select value={form.productId} onChange={(event) => onProductSelected(event.target.value)} className={inputClass}><option value="">Item livre / sem vínculo</option>{products.map((product) => <option key={product.id} value={product.id}>{getProductLabel(product)}</option>)}</select></Field>
        <Field label="Nome do item"><input value={form.itemName} onChange={(event) => onChange({ itemName: event.target.value })} className={inputClass} /></Field>
        <Field label="Código/SKU"><input value={form.sku} onChange={(event) => onChange({ sku: event.target.value })} className={inputClass} /></Field>
        <Field label="Unidade"><select value={form.unit} onChange={(event) => onChange({ unit: event.target.value as StockUnit })} className={inputClass}>{UNITS.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</select></Field>
        <Field label="Quantidade"><input value={form.quantity} onChange={(event) => onChange({ quantity: event.target.value })} className={inputClass} /></Field>
        <Field label="Preço"><input value={form.unitPrice} onChange={(event) => onChange({ unitPrice: event.target.value })} className={inputClass} placeholder="0,00" /></Field>
        <Field label="Observações" className="md:col-span-2"><textarea value={form.notes} onChange={(event) => onChange({ notes: event.target.value })} className={`${inputClass} min-h-[90px] resize-none`} /></Field>
      </div>
    </ModalShell>
  )
}
