'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Check,
  Edit3,
  Loader2,
  PackagePlus,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import {
  createSupplier,
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
  type SupplierPriceTable,
  type SupplierPriceTableItem,
} from '@/lib/api/suppliers'
import { getStockProducts, type StockProduct, type StockUnit } from '@/lib/api/stock'

const UNITS: { value: StockUnit; label: string }[] = [
  { value: 'unit', label: 'un.' },
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'l' },
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
]

const emptySupplierForm = {
  name: '',
  document: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
}

const emptyTableForm = {
  name: '',
  description: '',
  validFrom: '',
  validUntil: '',
}

const emptyItemForm = {
  productId: '',
  itemName: '',
  sku: '',
  unit: 'unit' as StockUnit,
  quantity: '1',
  unitPrice: '',
  notes: '',
}

function formatBRL(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatQuantity(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    maximumFractionDigits: 3,
  })
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('pt-BR')
}

function normalize(value?: string | null) {
  return value?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() ?? ''
}

function getUnitLabel(unit?: StockUnit | null) {
  return UNITS.find((item) => item.value === unit)?.label ?? unit ?? 'un.'
}

function toDateInput(value?: string | null) {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
}

function getProductLabel(product: StockProduct) {
  const category = product.category?.name ? ` • ${product.category.name}` : ''
  return `${product.emoji ? `${product.emoji} ` : ''}${product.name}${category}`
}

type ItemForm = typeof emptyItemForm

type SupplierForm = typeof emptySupplierForm

type TableForm = typeof emptyTableForm

export default function FornecedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<StockProduct[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplierForm)
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null)

  const [tableForm, setTableForm] = useState<TableForm>(emptyTableForm)
  const [editingTableId, setEditingTableId] = useState<string | null>(null)

  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  async function loadData() {
    setError('')
    setLoading(true)

    try {
      const [supplierResult, productResult] = await Promise.all([
        getSuppliers(),
        getStockProducts(),
      ])

      setSuppliers(supplierResult)
      setProducts(productResult.filter((product) => !((product as any).deletedAt)))

      if (!selectedSupplierId && supplierResult.length > 0) {
        setSelectedSupplierId(supplierResult[0].id)
        setSelectedTableId(supplierResult[0].priceTables?.[0]?.id ?? null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar fornecedores.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredSuppliers = useMemo(() => {
    const term = normalize(search)
    if (!term) return suppliers

    return suppliers.filter((supplier) => {
      const haystack = [
        supplier.name,
        supplier.document,
        supplier.contactName,
        supplier.phone,
        supplier.email,
        supplier.notes,
      ].map(normalize).join(' ')

      return haystack.includes(term)
    })
  }, [search, suppliers])

  const selectedSupplier = useMemo(() => {
    return suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? filteredSuppliers[0] ?? null
  }, [filteredSuppliers, selectedSupplierId, suppliers])

  const selectedTable = useMemo(() => {
    if (!selectedSupplier) return null
    return selectedSupplier.priceTables.find((table) => table.id === selectedTableId) ?? selectedSupplier.priceTables[0] ?? null
  }, [selectedSupplier, selectedTableId])

  const totalItems = selectedSupplier?.priceTables.reduce((total, table) => total + table.items.length, 0) ?? 0

  function resetSupplierForm() {
    setSupplierForm(emptySupplierForm)
    setEditingSupplierId(null)
  }

  function resetTableForm() {
    setTableForm(emptyTableForm)
    setEditingTableId(null)
  }

  function resetItemForm() {
    setItemForm(emptyItemForm)
    setEditingItemId(null)
  }

  function showSuccess(message: string) {
    setSuccess(message)
    window.setTimeout(() => setSuccess(''), 2500)
  }

  async function refreshSelected(updatedSupplier?: Supplier) {
    const nextSuppliers = await getSuppliers()
    setSuppliers(nextSuppliers)

    const nextSelected = updatedSupplier
      ? nextSuppliers.find((supplier) => supplier.id === updatedSupplier.id)
      : nextSuppliers.find((supplier) => supplier.id === selectedSupplierId)

    if (nextSelected) {
      setSelectedSupplierId(nextSelected.id)
      if (!nextSelected.priceTables.some((table) => table.id === selectedTableId)) {
        setSelectedTableId(nextSelected.priceTables[0]?.id ?? null)
      }
    }
  }

  async function handleSaveSupplier() {
    setError('')
    setSaving(true)

    try {
      const payload = {
        ...supplierForm,
        createDefaultTable: true,
      }

      const supplier = editingSupplierId
        ? await updateSupplier(editingSupplierId, payload)
        : await createSupplier(payload)

      await refreshSelected(supplier)
      setSelectedSupplierId(supplier.id)
      setSelectedTableId(supplier.priceTables[0]?.id ?? null)
      resetSupplierForm()
      showSuccess(editingSupplierId ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar fornecedor.')
    } finally {
      setSaving(false)
    }
  }

  function startEditSupplier(supplier: Supplier) {
    setEditingSupplierId(supplier.id)
    setSupplierForm({
      name: supplier.name ?? '',
      document: supplier.document ?? '',
      contactName: supplier.contactName ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
      notes: supplier.notes ?? '',
    })
  }

  async function handleDeactivateSupplier(supplier: Supplier) {
    if (!window.confirm(`Desativar o fornecedor ${supplier.name}?`)) return

    setError('')
    setSaving(true)

    try {
      await deleteSupplier(supplier.id)
      await refreshSelected()
      showSuccess('Fornecedor desativado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desativar fornecedor.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveTable() {
    if (!selectedSupplier) return

    setError('')
    setSaving(true)

    try {
      const supplier = editingTableId
        ? await updateSupplierPriceTable(selectedSupplier.id, editingTableId, tableForm)
        : await createSupplierPriceTable(selectedSupplier.id, tableForm)

      await refreshSelected(supplier)
      resetTableForm()
      showSuccess(editingTableId ? 'Tabela atualizada.' : 'Tabela criada.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar tabela.')
    } finally {
      setSaving(false)
    }
  }

  function startEditTable(table: SupplierPriceTable) {
    setEditingTableId(table.id)
    setTableForm({
      name: table.name,
      description: table.description ?? '',
      validFrom: toDateInput(table.validFrom),
      validUntil: toDateInput(table.validUntil),
    })
  }

  async function handleDeleteTable(table: SupplierPriceTable) {
    if (!selectedSupplier) return
    if (!window.confirm(`Excluir a tabela ${table.name}?`)) return

    setError('')
    setSaving(true)

    try {
      const supplier = await deleteSupplierPriceTable(selectedSupplier.id, table.id)
      await refreshSelected(supplier)
      setSelectedTableId(supplier.priceTables[0]?.id ?? null)
      showSuccess('Tabela removida.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover tabela.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveItem() {
    if (!selectedSupplier || !selectedTable) return

    setError('')
    setSaving(true)

    try {
      const linkedProduct = products.find((product) => product.id === itemForm.productId)
      const payload = {
        ...itemForm,
        productId: itemForm.productId || null,
        itemName: itemForm.itemName || linkedProduct?.name || '',
        unit: itemForm.unit || linkedProduct?.stockUnit || 'unit',
        unitPrice: itemForm.unitPrice,
      }

      const supplier = editingItemId
        ? await updateSupplierPriceTableItem(selectedSupplier.id, selectedTable.id, editingItemId, payload)
        : await createSupplierPriceTableItem(selectedSupplier.id, selectedTable.id, payload)

      await refreshSelected(supplier)
      resetItemForm()
      showSuccess(editingItemId ? 'Item atualizado.' : 'Item adicionado à tabela.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar item.')
    } finally {
      setSaving(false)
    }
  }

  function startEditItem(item: SupplierPriceTableItem) {
    setEditingItemId(item.id)
    setItemForm({
      productId: item.productId ?? '',
      itemName: item.itemName ?? '',
      sku: item.sku ?? '',
      unit: item.unit ?? 'unit',
      quantity: String(item.quantity ?? '1'),
      unitPrice: String(item.unitPrice ?? ''),
      notes: item.notes ?? '',
    })
  }

  async function handleDeleteItem(item: SupplierPriceTableItem) {
    if (!selectedSupplier || !selectedTable) return
    if (!window.confirm(`Remover ${item.itemName} da tabela?`)) return

    setError('')
    setSaving(true)

    try {
      const supplier = await deleteSupplierPriceTableItem(selectedSupplier.id, selectedTable.id, item.id)
      await refreshSelected(supplier)
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
            <span className="font-semibold">Carregando fornecedores...</span>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="rounded-[2rem] border border-border bg-card/95 p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-primary">
                <Building2 className="h-4 w-4" />
                Gestão
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Fornecedores</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Cadastre fornecedores e mantenha tabelas de preços vinculadas ou não aos produtos do estoque.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[460px]">
              <div className="rounded-2xl border border-border bg-background/70 p-3">
                <p className="text-xs font-bold uppercase text-muted-foreground">Fornecedores</p>
                <p className="mt-1 text-2xl font-black">{suppliers.length}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background/70 p-3">
                <p className="text-xs font-bold uppercase text-muted-foreground">Tabelas</p>
                <p className="mt-1 text-2xl font-black">
                  {suppliers.reduce((total, supplier) => total + supplier.priceTables.length, 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-background/70 p-3">
                <p className="text-xs font-bold uppercase text-muted-foreground">Itens de preço</p>
                <p className="mt-1 text-2xl font-black">
                  {suppliers.reduce((total, supplier) => total + supplier.priceTables.reduce((inner, table) => inner + table.items.length, 0), 0)}
                </p>
              </div>
            </div>
          </div>

          {(error || success) && (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
              error
                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            }`}>
              {error || success}
            </div>
          )}
        </section>

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-[2rem] border border-border bg-card p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Cadastro</h2>
                <p className="text-xs text-muted-foreground">Crie ou edite fornecedores.</p>
              </div>
              {editingSupplierId && (
                <button
                  type="button"
                  onClick={resetSupplierForm}
                  className="rounded-full border border-border px-3 py-1 text-xs font-bold hover:bg-secondary"
                >
                  Cancelar
                </button>
              )}
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-bold">
                Nome do fornecedor
                <input
                  value={supplierForm.name}
                  onChange={(event) => setSupplierForm((current) => ({ ...current, name: event.target.value }))}
                  className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                  placeholder="Ex: Distribuidora Central"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <label className="grid gap-1 text-sm font-bold">
                  Documento
                  <input
                    value={supplierForm.document}
                    onChange={(event) => setSupplierForm((current) => ({ ...current, document: event.target.value }))}
                    className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                    placeholder="CNPJ/CPF"
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold">
                  Contato
                  <input
                    value={supplierForm.contactName}
                    onChange={(event) => setSupplierForm((current) => ({ ...current, contactName: event.target.value }))}
                    className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                    placeholder="Nome do vendedor"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <label className="grid gap-1 text-sm font-bold">
                  Telefone
                  <input
                    value={supplierForm.phone}
                    onChange={(event) => setSupplierForm((current) => ({ ...current, phone: event.target.value }))}
                    className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                    placeholder="(11) 99999-9999"
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold">
                  E-mail
                  <input
                    value={supplierForm.email}
                    onChange={(event) => setSupplierForm((current) => ({ ...current, email: event.target.value }))}
                    className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                    placeholder="contato@fornecedor.com"
                  />
                </label>
              </div>

              <label className="grid gap-1 text-sm font-bold">
                Endereço
                <input
                  value={supplierForm.address}
                  onChange={(event) => setSupplierForm((current) => ({ ...current, address: event.target.value }))}
                  className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                  placeholder="Rua, bairro, cidade..."
                />
              </label>

              <label className="grid gap-1 text-sm font-bold">
                Observações
                <textarea
                  value={supplierForm.notes}
                  onChange={(event) => setSupplierForm((current) => ({ ...current, notes: event.target.value }))}
                  className="min-h-[90px] rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                  placeholder="Prazo, pedido mínimo, entregas..."
                />
              </label>

              <button
                type="button"
                onClick={handleSaveSupplier}
                disabled={saving || !supplierForm.name.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingSupplierId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingSupplierId ? 'Salvar fornecedor' : 'Cadastrar fornecedor'}
              </button>
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-4 text-sm outline-none focus:border-primary"
                  placeholder="Buscar fornecedor..."
                />
              </div>

              <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {filteredSuppliers.map((supplier) => {
                  const active = selectedSupplier?.id === supplier.id
                  const itemCount = supplier.priceTables.reduce((total, table) => total + table.items.length, 0)

                  return (
                    <button
                      key={supplier.id}
                      type="button"
                      onClick={() => {
                        setSelectedSupplierId(supplier.id)
                        setSelectedTableId(supplier.priceTables[0]?.id ?? null)
                      }}
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        active
                          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                          : 'border-border bg-background/70 hover:border-primary/40 hover:bg-secondary/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-black">{supplier.name}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {supplier.contactName || supplier.phone || supplier.email || 'Sem contato cadastrado'}
                          </p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                          supplier.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-muted text-muted-foreground'
                        }`}>
                          {supplier.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-2 text-[11px] font-bold text-muted-foreground">
                        <span className="rounded-full bg-muted px-2 py-1">{supplier.priceTables.length} tabela(s)</span>
                        <span className="rounded-full bg-muted px-2 py-1">{itemCount} item(ns)</span>
                      </div>
                    </button>
                  )
                })}

                {filteredSuppliers.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Nenhum fornecedor encontrado.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="min-w-0 rounded-[2rem] border border-border bg-card p-4 shadow-xl sm:p-5">
            {!selectedSupplier ? (
              <div className="flex min-h-[480px] items-center justify-center rounded-3xl border border-dashed border-border p-8 text-center">
                <div>
                  <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h2 className="mt-4 text-xl font-black">Nenhum fornecedor selecionado</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Cadastre um fornecedor para começar a montar tabelas de preços.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="rounded-3xl border border-border bg-background/70 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-black">{selectedSupplier.name}</h2>
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                          selectedSupplier.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-muted text-muted-foreground'
                        }`}>
                          {selectedSupplier.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-muted-foreground md:grid-cols-2">
                        <p><strong className="text-foreground">Contato:</strong> {selectedSupplier.contactName || '—'}</p>
                        <p><strong className="text-foreground">Telefone:</strong> {selectedSupplier.phone || '—'}</p>
                        <p><strong className="text-foreground">E-mail:</strong> {selectedSupplier.email || '—'}</p>
                        <p><strong className="text-foreground">Documento:</strong> {selectedSupplier.document || '—'}</p>
                      </div>
                      {selectedSupplier.notes && (
                        <p className="mt-3 rounded-2xl bg-muted/60 p-3 text-sm text-muted-foreground">{selectedSupplier.notes}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEditSupplier(selectedSupplier)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm font-black hover:bg-secondary"
                      >
                        <Edit3 className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeactivateSupplier(selectedSupplier)}
                        disabled={!selectedSupplier.active || saving}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-500/30 px-4 py-2 text-sm font-black text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                        Desativar
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-card p-3">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Tabelas</p>
                      <p className="text-2xl font-black">{selectedSupplier.priceTables.length}</p>
                    </div>
                    <div className="rounded-2xl bg-card p-3">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Itens</p>
                      <p className="text-2xl font-black">{totalItems}</p>
                    </div>
                    <div className="rounded-2xl bg-card p-3">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Atualizado</p>
                      <p className="text-lg font-black">{formatDate(selectedSupplier.updatedAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="rounded-3xl border border-border bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="font-black">Tabelas de preço</h3>
                        <p className="text-xs text-muted-foreground">Ex: atacado, evento, tabela mensal.</p>
                      </div>
                      {editingTableId && (
                        <button type="button" onClick={resetTableForm} className="rounded-full p-2 hover:bg-secondary">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="mt-3 grid gap-2">
                      <input
                        value={tableForm.name}
                        onChange={(event) => setTableForm((current) => ({ ...current, name: event.target.value }))}
                        className="rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
                        placeholder="Nome da tabela"
                      />
                      <input
                        value={tableForm.description}
                        onChange={(event) => setTableForm((current) => ({ ...current, description: event.target.value }))}
                        className="rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
                        placeholder="Descrição opcional"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={tableForm.validFrom}
                          onChange={(event) => setTableForm((current) => ({ ...current, validFrom: event.target.value }))}
                          className="rounded-2xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary"
                        />
                        <input
                          type="date"
                          value={tableForm.validUntil}
                          onChange={(event) => setTableForm((current) => ({ ...current, validUntil: event.target.value }))}
                          className="rounded-2xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveTable}
                        disabled={saving || !tableForm.name.trim()}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground disabled:opacity-50"
                      >
                        {editingTableId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {editingTableId ? 'Salvar tabela' : 'Nova tabela'}
                      </button>
                    </div>

                    <div className="mt-4 space-y-2">
                      {selectedSupplier.priceTables.map((table) => {
                        const active = selectedTable?.id === table.id
                        return (
                          <button
                            key={table.id}
                            type="button"
                            onClick={() => setSelectedTableId(table.id)}
                            className={`w-full rounded-2xl border p-3 text-left transition ${
                              active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-secondary/60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate font-black">{table.name}</p>
                                <p className="text-xs text-muted-foreground">{table.items.length} item(ns)</p>
                              </div>
                              <Tag className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="mt-3 flex gap-2">
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  startEditTable(table)
                                }}
                                className="rounded-full border border-border px-2 py-1 text-[11px] font-bold hover:bg-secondary"
                              >
                                Editar
                              </span>
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleDeleteTable(table)
                                }}
                                className="rounded-full border border-red-500/30 px-2 py-1 text-[11px] font-bold text-red-300 hover:bg-red-500/10"
                              >
                                Excluir
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="min-w-0 rounded-3xl border border-border bg-background/70 p-4">
                    {selectedTable ? (
                      <>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <h3 className="text-xl font-black">{selectedTable.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {selectedTable.description || 'Tabela sem descrição'} • validade {formatDate(selectedTable.validFrom)} até {formatDate(selectedTable.validUntil)}
                            </p>
                          </div>
                          <span className="rounded-full bg-muted px-3 py-1 text-xs font-black text-muted-foreground">
                            {selectedTable.items.length} item(ns)
                          </span>
                        </div>

                        <div className="mt-4 rounded-3xl border border-border bg-card p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <h4 className="font-black">{editingItemId ? 'Editar item' : 'Adicionar item'}</h4>
                              <p className="text-xs text-muted-foreground">Vincule ao estoque ou cadastre um item livre.</p>
                            </div>
                            {editingItemId && (
                              <button type="button" onClick={resetItemForm} className="rounded-full p-2 hover:bg-secondary">
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_90px_100px_120px]">
                            <select
                              value={itemForm.productId}
                              onChange={(event) => handleProductSelected(event.target.value)}
                              className="rounded-2xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
                            >
                              <option value="">Item livre / sem vínculo</option>
                              {products.map((product) => (
                                <option key={product.id} value={product.id}>{getProductLabel(product)}</option>
                              ))}
                            </select>
                            <input
                              value={itemForm.itemName}
                              onChange={(event) => setItemForm((current) => ({ ...current, itemName: event.target.value }))}
                              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                              placeholder="Nome do item"
                            />
                            <select
                              value={itemForm.unit}
                              onChange={(event) => setItemForm((current) => ({ ...current, unit: event.target.value as StockUnit }))}
                              className="rounded-2xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
                            >
                              {UNITS.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
                            </select>
                            <input
                              value={itemForm.quantity}
                              onChange={(event) => setItemForm((current) => ({ ...current, quantity: event.target.value }))}
                              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                              placeholder="Qtd."
                            />
                            <input
                              value={itemForm.unitPrice}
                              onChange={(event) => setItemForm((current) => ({ ...current, unitPrice: event.target.value }))}
                              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                              placeholder="Preço"
                            />
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_160px]">
                            <input
                              value={itemForm.sku}
                              onChange={(event) => setItemForm((current) => ({ ...current, sku: event.target.value }))}
                              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                              placeholder="Código/SKU"
                            />
                            <input
                              value={itemForm.notes}
                              onChange={(event) => setItemForm((current) => ({ ...current, notes: event.target.value }))}
                              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                              placeholder="Observações do item"
                            />
                            <button
                              type="button"
                              onClick={handleSaveItem}
                              disabled={saving || !itemForm.unitPrice || (!itemForm.itemName.trim() && !itemForm.productId)}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground disabled:opacity-50"
                            >
                              {editingItemId ? <Check className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}
                              {editingItemId ? 'Salvar' : 'Adicionar'}
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 overflow-hidden rounded-3xl border border-border bg-card">
                          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_90px_110px_110px_120px] gap-3 border-b border-border bg-muted/40 px-4 py-3 text-xs font-black uppercase text-muted-foreground lg:grid">
                            <span>Item</span>
                            <span>Vínculo</span>
                            <span>Qtd.</span>
                            <span>Unidade</span>
                            <span>Preço</span>
                            <span>Ações</span>
                          </div>

                          <div className="divide-y divide-border">
                            {selectedTable.items.map((item) => (
                              <div key={item.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_90px_110px_110px_120px] lg:items-center">
                                <div className="min-w-0">
                                  <p className="font-black">{item.itemName}</p>
                                  <p className="truncate text-xs text-muted-foreground">{item.sku ? `SKU: ${item.sku}` : item.notes || 'Sem observações'}</p>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {item.product ? (
                                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                                      {item.product.emoji ? `${item.product.emoji} ` : ''}{item.product.name}
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-muted px-2 py-1 text-xs font-bold">Item livre</span>
                                  )}
                                </div>
                                <div className="text-sm font-bold">{formatQuantity(item.quantity)}</div>
                                <div className="text-sm font-bold">{getUnitLabel(item.unit)}</div>
                                <div className="text-sm font-black">{formatBRL(item.unitPrice)}</div>
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => startEditItem(item)} className="rounded-xl border border-border p-2 hover:bg-secondary" title="Editar">
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                  <button type="button" onClick={() => handleDeleteItem(item)} className="rounded-xl border border-red-500/30 p-2 text-red-300 hover:bg-red-500/10" title="Remover">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))}

                            {selectedTable.items.length === 0 && (
                              <div className="p-8 text-center text-sm text-muted-foreground">
                                Nenhum item cadastrado nessa tabela ainda.
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-border p-8 text-center">
                        <div>
                          <Tag className="mx-auto h-12 w-12 text-muted-foreground" />
                          <h3 className="mt-4 text-xl font-black">Nenhuma tabela criada</h3>
                          <p className="mt-2 text-sm text-muted-foreground">Crie uma tabela de preços para começar a cadastrar itens.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
