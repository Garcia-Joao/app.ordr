'use client'

import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  PackagePlus,
  Pencil,
  Plus,
  Power,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  activateMenu,
  createMenu,
  deactivateMenu,
  deleteMenu,
  duplicateMenu,
  getMenus,
  updateMenu,
  type Menu,
} from '@/lib/api/menus'
import { createProduct, getProducts } from '@/lib/api/products'
import { getCategories } from '@/lib/api/categories'
import type { CategoryConfig, Product } from '@/lib/pos-types'

type DraftItem = {
  productId: string
  price: number
  active: boolean
}

type DraftMenu = {
  name: string
  description: string
  active: boolean
  items: DraftItem[]
}

type ImportRow = {
  menuName: string
  description: string
  productName: string
  categoryName: string
  price: number
  active: boolean
}

type MissingProduct = {
  name: string
  categoryName: string
  price: number
  action: 'create' | 'ignore'
  categoryId: string
}

type ImportPreview = {
  rows: ImportRow[]
  matchedItems: DraftItem[]
  missingProducts: MissingProduct[]
  menuName: string
  description: string
}

const emptyDraft: DraftMenu = {
  name: '',
  description: '',
  active: false,
  items: [],
}

function formatBRL(value: number) {
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function parseMoney(value: string) {
  const clean = String(value ?? '')
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const number = Number(clean)
  return Number.isFinite(number) ? number : 0
}

function csvEscape(value: string | number | boolean | null | undefined) {
  const text = String(value ?? '')
  if (/[";\n,]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function parseCSV(text: string, delimiter = ';') {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === delimiter && !quoted) {
      row.push(cell.trim())
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function rowsToImportRows(text: string): ImportRow[] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows = parseCSV(text, delimiter)
  if (rows.length <= 1) return []
  const headers = rows[0].map((header) => normalizeText(header))
  const find = (names: string[]) => names.map(normalizeText).map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1

  const menuIndex = find(['cardapio', 'menu', 'nome do cardapio'])
  const descriptionIndex = find(['descricao', 'descrição'])
  const productIndex = find(['produto', 'product', 'nome do produto'])
  const categoryIndex = find(['categoria', 'category'])
  const priceIndex = find(['preco', 'preço', 'price', 'valor'])
  const activeIndex = find(['ativo', 'active', 'produto ativo'])

  if (productIndex < 0 || priceIndex < 0) {
    throw new Error('A planilha precisa ter pelo menos as colunas Produto e Preço.')
  }

  return rows.slice(1).map((row) => {
    const activeValue = String(row[activeIndex] ?? 'sim').trim().toLowerCase()
    return {
      menuName: row[menuIndex] || '',
      description: row[descriptionIndex] || '',
      productName: row[productIndex] || '',
      categoryName: row[categoryIndex] || '',
      price: parseMoney(row[priceIndex] || '0'),
      active: !['nao', 'não', 'false', '0', 'inativo'].includes(activeValue),
    }
  }).filter((row) => row.productName)
}

function menuToDraft(menu: Menu | null): DraftMenu {
  if (!menu) return { ...emptyDraft, items: [] }
  return {
    name: menu.name,
    description: menu.description ?? '',
    active: menu.active,
    items: (menu.items ?? []).map((item) => ({
      productId: item.productId,
      price: Number(item.price ?? item.product?.price ?? 0),
      active: item.active,
    })),
  }
}

function Modal({ children, title, subtitle, onClose }: { children: ReactNode; title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm md:items-center md:p-6">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-t-3xl border border-border bg-background shadow-2xl md:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-4 md:p-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground md:text-xl">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-border p-2 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function CardapiosPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [menus, setMenus] = useState<Menu[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<CategoryConfig[]>([])
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftMenu>({ ...emptyDraft, items: [] })
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null)
  const [menuModalOpen, setMenuModalOpen] = useState(false)
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false)
  const [duplicateName, setDuplicateName] = useState('')
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedMenu = useMemo(() => menus.find((menu) => menu.id === selectedMenuId) ?? null, [menus, selectedMenuId])

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  const productsByName = useMemo(() => new Map(products.map((product) => [normalizeText(product.name), product])), [products])
  const categoriesByName = useMemo(() => new Map(categories.map((category) => [normalizeText(category.name), category])), [categories])
  const defaultCategoryId = categories[0]?.id ?? ''
  const selectedProductIds = useMemo(() => new Set(draft.items.map((item) => item.productId)), [draft.items])

  const selectedItems = useMemo(() => {
    return draft.items
      .map((item) => ({ ...item, product: productsById.get(item.productId) }))
      .filter((item) => item.product)
      .sort((a, b) => String(a.product?.name ?? '').localeCompare(String(b.product?.name ?? '')))
  }, [draft.items, productsById])

  const filteredProducts = useMemo(() => {
    const search = normalizeText(productSearch)
    return products
      .filter((product) => !product.isStockOnly)
      .filter((product) => categoryFilter === 'all' || product.categoryId === categoryFilter)
      .filter((product) => !search || normalizeText(`${product.name} ${product.category?.name ?? ''}`).includes(search))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
  }, [categoryFilter, productSearch, products])

  const productCategoryGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; emoji?: string; products: Product[] }>()

    for (const product of filteredProducts) {
      const id = product.categoryId || 'uncategorized'
      if (!groups.has(id)) {
        groups.set(id, {
          id,
          name: product.category?.name ?? categories.find((category) => category.id === product.categoryId)?.name ?? 'Sem categoria',
          emoji: product.category?.emoji ?? categories.find((category) => category.id === product.categoryId)?.emoji,
          products: [],
        })
      }
      groups.get(id)?.products.push(product)
    }

    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [categories, filteredProducts])

  async function loadData(preferredMenuId?: string | null) {
    setLoading(true)
    setError('')
    try {
      const [menusResult, productsResult, categoriesResult] = await Promise.all([
        getMenus(),
        getProducts({ includeInactive: true }),
        getCategories(),
      ])
      const nextMenus = menusResult.menus ?? []
      setMenus(nextMenus)
      setProducts(productsResult.filter((product) => !product.isStockOnly))
      setCategories(categoriesResult ?? [])
      const nextSelected = nextMenus.find((menu) => menu.id === preferredMenuId)
        ?? nextMenus.find((menu) => menu.id === selectedMenuId)
        ?? nextMenus.find((menu) => menu.active)
        ?? nextMenus[0]
        ?? null
      setSelectedMenuId(nextSelected?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cardápios.')
    } finally {
      setLoading(false)
    }
  }

  function openEditor(menu: Menu | null) {
    setEditingMenu(menu)
    setDraft(menuToDraft(menu))
    setProductSearch('')
    setCategoryFilter('all')
    setMenuModalOpen(true)
  }

  function toggleProduct(product: Product) {
    setDraft((current) => {
      const exists = current.items.some((item) => item.productId === product.id)
      return {
        ...current,
        items: exists
          ? current.items.filter((item) => item.productId !== product.id)
          : [...current.items, { productId: product.id, price: Number(product.price ?? 0), active: true }],
      }
    })
  }

  function addProductsToDraft(productsToAdd: Product[]) {
    if (productsToAdd.length === 0) return
    setDraft((current) => {
      const existingIds = new Set(current.items.map((item) => item.productId))
      const nextItems = [...current.items]

      for (const product of productsToAdd) {
        if (existingIds.has(product.id)) continue
        nextItems.push({ productId: product.id, price: Number(product.price ?? 0), active: true })
        existingIds.add(product.id)
      }

      return { ...current, items: nextItems }
    })
  }

  function removeProductsFromDraft(productsToRemove: Product[]) {
    if (productsToRemove.length === 0) return
    const idsToRemove = new Set(productsToRemove.map((product) => product.id))
    setDraft((current) => ({
      ...current,
      items: current.items.filter((item) => !idsToRemove.has(item.productId)),
    }))
  }

  function toggleCategoryProducts(categoryProducts: Product[]) {
    const allSelected = categoryProducts.length > 0 && categoryProducts.every((product) => selectedProductIds.has(product.id))
    if (allSelected) {
      removeProductsFromDraft(categoryProducts)
      return
    }
    addProductsToDraft(categoryProducts)
  }

  function selectAllVisibleProducts() {
    addProductsToDraft(filteredProducts)
  }

  function removeAllVisibleProducts() {
    removeProductsFromDraft(filteredProducts)
  }

  function updateItem(productId: string, patch: Partial<DraftItem>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.productId === productId ? { ...item, ...patch } : item)),
    }))
  }

  async function saveMenu() {
    if (!draft.name.trim()) {
      setError('Informe um nome para o cardápio.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        ...draft,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        items: draft.items.map((item, index) => ({ ...item, sortOrder: index })),
      }
      const result = editingMenu ? await updateMenu(editingMenu.id, payload) : await createMenu(payload)
      await loadData(result.menu.id)
      setMenuModalOpen(false)
      setEditingMenu(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar cardápio.')
    } finally {
      setSaving(false)
    }
  }

  async function handleActivate(menu: Menu) {
    setSaving(true)
    setError('')
    try {
      const result = await activateMenu(menu.id)
      await loadData(result.menu.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ativar cardápio.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(menu: Menu) {
    if (menu.active && !window.confirm('Desativar o cardápio ativo? O PDV ficará sem cardápio ativo até você ativar outro.')) return
    setSaving(true)
    setError('')
    try {
      const result = await deactivateMenu(menu.id)
      await loadData(result.menu.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desativar cardápio.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(menu: Menu) {
    const message = menu.active
      ? 'Este cardápio está ativo. Desative ou ative outro cardápio antes de remover.'
      : `Remover definitivamente o cardápio "${menu.name}"?`
    if (menu.active) {
      setError(message)
      return
    }
    if (!window.confirm(message)) return
    setSaving(true)
    setError('')
    try {
      await deleteMenu(menu.id)
      await loadData(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover cardápio.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDuplicate(active = false) {
    if (!selectedMenu) return
    const name = duplicateName.trim() || `${selectedMenu.name} (cópia)`
    setSaving(true)
    setError('')
    try {
      const result = await duplicateMenu(selectedMenu.id, { name, active })
      await loadData(result.menu.id)
      setDuplicateModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao duplicar cardápio. Talvez já exista um cardápio com esse nome.')
    } finally {
      setSaving(false)
    }
  }

  function exportMenu(menu: Menu | null) {
    if (!menu) return
    const header = ['Cardapio', 'Descricao', 'Ativo', 'Produto', 'Categoria', 'Preco', 'Produto ativo']
    const lines = [header.join(';')]
    for (const item of menu.items ?? []) {
      lines.push([
        menu.name,
        menu.description ?? '',
        menu.active ? 'sim' : 'nao',
        item.product?.name ?? '',
        item.product?.category?.name ?? '',
        Number(item.price ?? 0).toFixed(2).replace('.', ','),
        item.active ? 'sim' : 'nao',
      ].map(csvEscape).join(';'))
    }

    if ((menu.items ?? []).length === 0) {
      lines.push([menu.name, menu.description ?? '', menu.active ? 'sim' : 'nao', '', '', '', ''].map(csvEscape).join(';'))
    }

    const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${menu.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}-cardapio.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const text = await file.text()
      const rows = rowsToImportRows(text)
      const matchedItems: DraftItem[] = []
      const missingMap = new Map<string, MissingProduct>()

      for (const row of rows) {
        const product = productsByName.get(normalizeText(row.productName))
        if (product) {
          matchedItems.push({ productId: product.id, price: row.price, active: row.active })
          continue
        }

        const key = normalizeText(row.productName)
        if (!missingMap.has(key)) {
          const category = categoriesByName.get(normalizeText(row.categoryName))
          missingMap.set(key, {
            name: row.productName,
            categoryName: row.categoryName,
            price: row.price,
            action: 'create',
            categoryId: category?.id ?? defaultCategoryId,
          })
        }
      }

      setImportPreview({
        rows,
        matchedItems,
        missingProducts: Array.from(missingMap.values()),
        menuName: rows[0]?.menuName || draft.name || 'Cardápio importado',
        description: rows[0]?.description || draft.description || '',
      })
      setImportModalOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar a planilha.')
    } finally {
      event.target.value = ''
    }
  }

  function updateMissingProduct(name: string, patch: Partial<MissingProduct>) {
    setImportPreview((current) => current ? {
      ...current,
      missingProducts: current.missingProducts.map((product) => product.name === name ? { ...product, ...patch } : product),
    } : current)
  }

  async function applyImport() {
    if (!importPreview) return
    setSaving(true)
    setError('')
    try {
      const createdProducts: Product[] = []
      for (const missing of importPreview.missingProducts) {
        if (missing.action !== 'create') continue
        if (!missing.categoryId) throw new Error(`Selecione uma categoria para cadastrar ${missing.name}.`)
        const created = await createProduct({
          categoryId: missing.categoryId,
          name: missing.name,
          description: null,
          emoji: '🍽️',
          price: missing.price,
          active: true,
          isStockOnly: false,
          trackStock: false,
          stockQuantity: 0,
          minStock: 0,
        } as Omit<Product, 'id'>)
        createdProducts.push(created)
      }

      const newItems = [...importPreview.matchedItems]
      for (const row of importPreview.rows) {
        const created = createdProducts.find((product) => normalizeText(product.name) === normalizeText(row.productName))
        if (created) newItems.push({ productId: created.id, price: row.price, active: row.active })
      }

      const uniqueItems = Array.from(new Map(newItems.map((item) => [item.productId, item])).values())
      setProducts((current) => [...current, ...createdProducts].sort((a, b) => a.name.localeCompare(b.name)))
      setDraft((current) => ({
        ...current,
        name: importPreview.menuName || current.name,
        description: importPreview.description || current.description,
        items: uniqueItems,
      }))
      setImportModalOpen(false)
      setImportPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aplicar importação.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="space-y-6 p-4 md:p-6">
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleImportFile} className="hidden" />

      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="bg-gradient-to-br from-primary/10 via-background to-background p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-primary">Cardápios</p>
              <h1 className="mt-1 text-2xl font-semibold text-foreground md:text-3xl">Gerencie cardápios, preços e produtos</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Cadastre vários cardápios, duplique estruturas prontas, importe/exporte planilhas e defina qual cardápio está ativo no PDV.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted">
                <Upload className="h-4 w-4" /> Importar
              </button>
              <button type="button" disabled={!selectedMenu} onClick={() => exportMenu(selectedMenu)} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">
                <Download className="h-4 w-4" /> Exportar
              </button>
              <button type="button" onClick={() => openEditor(null)} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm">
                <Plus className="h-4 w-4" /> Novo cardápio
              </button>
            </div>
          </div>
          {error ? <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Cardápios cadastrados</h2>
              <p className="text-xs text-muted-foreground">{menus.length} cardápio(s)</p>
            </div>
            {loading ? <span className="text-xs text-muted-foreground">Carregando...</span> : null}
          </div>
          <div className="space-y-3">
            {menus.map((menu) => (
              <button
                key={menu.id}
                type="button"
                onClick={() => setSelectedMenuId(menu.id)}
                className={`w-full rounded-3xl border p-4 text-left transition ${selectedMenuId === menu.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-background hover:bg-muted/40'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-foreground">{menu.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{menu.items?.length ?? 0} produto(s)</p>
                  </div>
                  {menu.active ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> Ativo
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">Inativo</span>
                  )}
                </div>
                {menu.description ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{menu.description}</p> : null}
              </button>
            ))}
            {!loading && menus.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                Nenhum cardápio ainda. Crie um novo ou importe uma planilha.
              </div>
            ) : null}
          </div>
        </aside>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          {selectedMenu ? (
            <>
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-semibold text-foreground">{selectedMenu.name}</h2>
                    {selectedMenu.active ? <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">Ativo no PDV</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedMenu.description || 'Sem descrição.'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!selectedMenu.active ? (
                    <button type="button" disabled={saving} onClick={() => handleActivate(selectedMenu)} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 px-3 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-500/10">
                      <Power className="h-4 w-4" /> Ativar
                    </button>
                  ) : (
                    <button type="button" disabled={saving} onClick={() => handleDeactivate(selectedMenu)} className="inline-flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
                      <Power className="h-4 w-4" /> Desativar
                    </button>
                  )}
                  <button type="button" onClick={() => openEditor(selectedMenu)} className="inline-flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
                    <Pencil className="h-4 w-4" /> Editar
                  </button>
                  <button type="button" onClick={() => { setDuplicateName(`${selectedMenu.name} (cópia)`); setDuplicateModalOpen(true) }} className="inline-flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
                    <Copy className="h-4 w-4" /> Duplicar
                  </button>
                  <button type="button" disabled={selectedMenu.active || saving} onClick={() => handleDelete(selectedMenu)} className="inline-flex items-center gap-2 rounded-2xl border border-destructive/30 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50">
                    <Trash2 className="h-4 w-4" /> Remover
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-3xl border border-border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Produtos</p>
                  <p className="text-2xl font-semibold text-foreground">{selectedMenu.items.length}</p>
                </div>
                <div className="rounded-3xl border border-border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Preço médio</p>
                  <p className="text-2xl font-semibold text-foreground">{formatBRL(selectedMenu.items.reduce((sum, item) => sum + Number(item.price ?? 0), 0) / Math.max(selectedMenu.items.length, 1))}</p>
                </div>
                <div className="rounded-3xl border border-border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Produtos inativos no cardápio</p>
                  <p className="text-2xl font-semibold text-foreground">{selectedMenu.items.filter((item) => !item.active).length}</p>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-3xl border border-border">
                <div className="grid grid-cols-[1fr_130px_110px] gap-3 bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Produto</span>
                  <span>Preço</span>
                  <span>Status</span>
                </div>
                <div className="divide-y divide-border">
                  {selectedMenu.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_130px_110px] gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{item.product?.emoji ? `${item.product.emoji} ` : ''}{item.product?.name ?? 'Produto removido'}</p>
                        <p className="text-xs text-muted-foreground">{item.product?.category?.name ?? 'Sem categoria'}</p>
                      </div>
                      <p className="font-semibold text-primary">{formatBRL(Number(item.price ?? 0))}</p>
                      <p className={item.active ? 'text-emerald-600' : 'text-muted-foreground'}>{item.active ? 'Ativo' : 'Oculto'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-border p-8 text-center">
              <FileSpreadsheet className="mb-3 h-10 w-10 text-muted-foreground" />
              <h2 className="text-xl font-semibold text-foreground">Selecione ou crie um cardápio</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">Você pode começar do zero, duplicar um existente ou importar uma planilha CSV.</p>
            </div>
          )}
        </section>
      </section>

      {menuModalOpen ? (
        <Modal
          title={editingMenu ? `Editar ${editingMenu.name}` : 'Novo cardápio'}
          subtitle="Use a busca, filtros e lista lateral para montar o cardápio com preços próprios."
          onClose={() => setMenuModalOpen(false)}
        >
          <div className="max-h-[calc(92vh-86px)] overflow-y-auto p-4 md:p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-foreground">
                Nome do cardápio
                <input className="w-full rounded-2xl border border-border bg-background px-3 py-2 outline-none focus:border-primary" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label className="space-y-1 text-sm font-medium text-foreground">
                Descrição
                <input className="w-full rounded-2xl border border-border bg-background px-3 py-2 outline-none focus:border-primary" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
              </label>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_380px]">
              <section className="rounded-3xl border border-border p-4">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">Produtos disponíveis</h3>
                    <p className="text-xs text-muted-foreground">Selecione todos os produtos, uma categoria inteira ou itens individuais.</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Buscar produto" className="w-full rounded-2xl border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary sm:w-56" />
                    </div>
                    <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary">
                      <option value="all">Todas categorias</option>
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">
                    <strong className="text-foreground">{filteredProducts.length}</strong> produto(s) visível(eis) no filtro atual · <strong className="text-foreground">{filteredProducts.filter((product) => selectedProductIds.has(product.id)).length}</strong> selecionado(s)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={selectAllVisibleProducts} className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                      Selecionar todos visíveis
                    </button>
                    <button type="button" onClick={removeAllVisibleProducts} className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted">
                      Desmarcar visíveis
                    </button>
                  </div>
                </div>

                <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
                  {productCategoryGroups.map((group) => {
                    const selectedCount = group.products.filter((product) => selectedProductIds.has(product.id)).length
                    const allSelected = group.products.length > 0 && selectedCount === group.products.length
                    return (
                      <div key={group.id} className="overflow-hidden rounded-3xl border border-border bg-background">
                        <div className="flex flex-col gap-3 border-b border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <h4 className="truncate font-semibold text-foreground">{group.emoji ? `${group.emoji} ` : ''}{group.name}</h4>
                            <p className="text-xs text-muted-foreground">{selectedCount}/{group.products.length} produto(s) selecionado(s)</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleCategoryProducts(group.products)}
                            className={`rounded-2xl px-3 py-2 text-xs font-semibold ${allSelected ? 'border border-border bg-background text-muted-foreground hover:bg-muted' : 'bg-primary text-primary-foreground'}`}
                          >
                            {allSelected ? 'Desmarcar categoria' : 'Adicionar categoria'}
                          </button>
                        </div>
                        <div className="grid gap-2 p-3 md:grid-cols-2">
                          {group.products.map((product) => {
                            const selected = selectedProductIds.has(product.id)
                            return (
                              <button key={product.id} type="button" onClick={() => toggleProduct(product)} className={`rounded-2xl border p-3 text-left transition ${selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-foreground">{product.emoji ? `${product.emoji} ` : ''}{product.name}</p>
                                    <p className="text-xs text-muted-foreground">Preço padrão {formatBRL(Number(product.price ?? 0))}</p>
                                  </div>
                                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{selected ? 'Incluído' : 'Adicionar'}</span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                  {productCategoryGroups.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Nenhum produto encontrado com os filtros atuais.</p>
                  ) : null}
                </div>
              </section>

              <section className="rounded-3xl border border-border p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-foreground">Selecionados</h3>
                    <p className="text-xs text-muted-foreground">{draft.items.length} produto(s) no cardápio.</p>
                  </div>
                  <button type="button" onClick={() => setDraft((current) => ({ ...current, items: [] }))} className="text-xs font-semibold text-destructive">Limpar</button>
                </div>
                <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                  {selectedItems.map((item) => (
                    <div key={item.productId} className="rounded-2xl border border-border bg-background p-3">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{item.product?.emoji ? `${item.product.emoji} ` : ''}{item.product?.name}</p>
                          <p className="text-xs text-muted-foreground">{item.product?.category?.name ?? 'Sem categoria'}</p>
                        </div>
                        <button type="button" onClick={() => toggleProduct(item.product as Product)} className="rounded-xl p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
                      </div>
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <span>Preço neste cardápio</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                              Padrão {formatBRL(Number(item.product?.price ?? 0))}
                            </span>
                          </span>
                          <input type="number" step="0.01" value={item.price} onChange={(event) => updateItem(item.productId, { price: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                        </label>
                        <label className="flex items-end gap-2 pb-2 text-xs font-medium text-muted-foreground">
                          <input type="checkbox" checked={item.active} onChange={(event) => updateItem(item.productId, { active: event.target.checked })} /> Visível
                        </label>
                      </div>
                    </div>
                  ))}
                  {selectedItems.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Nenhum produto selecionado.</p> : null}
                </div>
              </section>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
                <Upload className="h-4 w-4" /> Importar produtos da planilha
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setMenuModalOpen(false)} className="rounded-2xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancelar</button>
                <button type="button" disabled={saving} onClick={saveMenu} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  <Save className="h-4 w-4" /> Salvar cardápio
                </button>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}

      {duplicateModalOpen && selectedMenu ? (
        <Modal title="Duplicar cardápio" subtitle="Crie uma cópia com os mesmos produtos e preços para ajustar depois." onClose={() => setDuplicateModalOpen(false)}>
          <div className="space-y-4 p-4 md:p-5">
            <label className="space-y-1 text-sm font-medium text-foreground">
              Nome da cópia
              <input value={duplicateName} onChange={(event) => setDuplicateName(event.target.value)} className="w-full rounded-2xl border border-border bg-background px-3 py-2 outline-none focus:border-primary" />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDuplicateModalOpen(false)} className="rounded-2xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancelar</button>
              <button type="button" disabled={saving} onClick={() => handleDuplicate(false)} className="rounded-2xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">Duplicar inativo</button>
              <button type="button" disabled={saving} onClick={() => handleDuplicate(true)} className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Duplicar e ativar</button>
            </div>
          </div>
        </Modal>
      ) : null}

      {importModalOpen && importPreview ? (
        <Modal title="Prévia da importação" subtitle="Produtos encontrados são adicionados direto. Produtos não encontrados podem ser cadastrados ou ignorados." onClose={() => setImportModalOpen(false)}>
          <div className="max-h-[calc(92vh-86px)] overflow-y-auto p-4 md:p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-3xl border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">Linhas lidas</p>
                <p className="text-2xl font-semibold">{importPreview.rows.length}</p>
              </div>
              <div className="rounded-3xl border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">Produtos encontrados</p>
                <p className="text-2xl font-semibold text-emerald-600">{importPreview.matchedItems.length}</p>
              </div>
              <div className="rounded-3xl border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">Não encontrados</p>
                <p className="text-2xl font-semibold text-amber-600">{importPreview.missingProducts.length}</p>
              </div>
            </div>

            {importPreview.missingProducts.length > 0 ? (
              <section className="mt-5 rounded-3xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="mb-3 flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                  <div>
                    <h3 className="font-semibold text-foreground">Produtos da planilha que não existem no cadastro</h3>
                    <p className="text-sm text-muted-foreground">A comparação é feita pelo nome. Escolha se quer cadastrar o produto ou ignorar.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {importPreview.missingProducts.map((product) => (
                    <div key={product.name} className="grid gap-3 rounded-2xl border border-border bg-background p-3 md:grid-cols-[1fr_150px_220px] md:items-center">
                      <div>
                        <p className="font-medium text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground">Categoria na planilha: {product.categoryName || 'sem categoria'} · Preço {formatBRL(product.price)}</p>
                      </div>
                      <select value={product.action} onChange={(event) => updateMissingProduct(product.name, { action: event.target.value as MissingProduct['action'] })} className="rounded-2xl border border-border bg-background px-3 py-2 text-sm">
                        <option value="create">Cadastrar</option>
                        <option value="ignore">Ignorar</option>
                      </select>
                      <select value={product.categoryId} disabled={product.action === 'ignore'} onChange={(event) => updateMissingProduct(product.name, { categoryId: event.target.value })} className="rounded-2xl border border-border bg-background px-3 py-2 text-sm disabled:opacity-50">
                        <option value="">Selecione categoria</option>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <div className="mt-5 rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700">
                Todos os produtos da planilha foram encontrados pelo nome.
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setImportModalOpen(false)} className="rounded-2xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancelar</button>
              <button type="button" disabled={saving} onClick={applyImport} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                <PackagePlus className="h-4 w-4" /> Aplicar importação
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </main>
  )
}
