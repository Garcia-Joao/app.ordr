'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  Tag,
  X,
  ChevronRight,
  GripVertical,
  MapPinned,
  FileDown,
  FileUp,
  AlertTriangle,
} from 'lucide-react'
import {
  type Product,
  type ProductVariationGroup,
  type ProductVariationOption,
  type CategoryConfig,
} from '@/lib/pos-types'
import { createProduct, deleteProduct, getProducts, updateProduct } from '@/lib/api/products'
import { listPrintPorts, type PrintPort } from '@/lib/api/printers'
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from '@/lib/api/categories'
import {
  getSalesEnvironments,
  type SalesEnvironment,
} from '@/lib/api/sales-environments'

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

type ProductEnvironmentPriceInput = {
  salesEnvironmentId: string
  price: number
}

type EditableProductVariationOption = ProductVariationOption & {
  sortOrder?: number
}

type EditableProductVariationGroup = Omit<ProductVariationGroup, 'options'> & {
  sortOrder?: number
  options: EditableProductVariationOption[]
}



type ProductImportEnvironmentPrice = {
  salesEnvironmentId: string
  salesEnvironmentName: string
  price: number
}

type ProductImportRow = {
  rowNumber: number
  name: string
  categoryName: string
  emoji: string
  price: number
  active: boolean
  printPortName: string
  environmentPrices: ProductImportEnvironmentPrice[]
}

type ProductImportPlan = {
  rows: ProductImportRow[]
  toCreate: ProductImportRow[]
  toUpdate: Array<{ row: ProductImportRow; product: Product }>
  removed: Product[]
  categoriesToCreate: string[]
  errors: string[]
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function parseSpreadsheetNumber(value: string | null | undefined) {
  const raw = String(value ?? '').trim()
  if (!raw) return 0

  const cleaned = raw.replace(/R\$|\s/g, '')
  if (cleaned.includes(',')) {
    return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0
  }

  return Number(cleaned) || 0
}

function parseSpreadsheetBoolean(value: string | null | undefined, fallback = true) {
  const normalized = normalizeText(value)
  if (!normalized) return fallback
  return ['sim', 's', 'true', '1', 'ativo', 'yes', 'y'].includes(normalized)
}

function escapeCsvCell(value: string | number | boolean | null | undefined) {
  const text = String(value ?? '')
  if (/[";\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function parseCsvLine(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

function parseCsvText(text: string) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) return []

  const firstLine = lines[0]
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0)
    ? ';'
    : ','
  const headers = parseCsvLine(firstLine, delimiter)

  return lines
    .slice(1)
    .map((line, index) => {
      const cells = parseCsvLine(line, delimiter)
      const row: Record<string, string> = {}

      headers.forEach((header, headerIndex) => {
        row[header.trim()] = cells[headerIndex] ?? ''
      })

      return {
        rowNumber: index + 2,
        row,
      }
    })
    .filter(({ row }) =>
      Object.values(row).some((value) => String(value ?? '').trim().length > 0)
    )
}

function downloadTextFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function randomTempId() {
  return `tmp-${Math.random().toString(36).substring(2, 10)}`
}

function isTemporaryId(id?: string | null) {
  return !id || id.startsWith('tmp-')
}

function normalizeVariationGroupsForSubmit(groups: EditableProductVariationGroup[]) {
  return groups
    .filter((group) => group.name.trim())
    .map((group, groupIndex) => ({
      id: isTemporaryId(group.id) ? undefined : group.id,
      name: group.name.trim(),
      required: Boolean(group.required),
      selectionType: group.selectionType,
      sortOrder: group.sortOrder ?? groupIndex,
      options: (group.options ?? [])
        .filter((option) => option.name.trim())
        .map((option, optionIndex) => ({
          id: isTemporaryId(option.id) ? undefined : option.id,
          name: option.name.trim(),
          priceModifier: Number(option.priceModifier ?? 0),
          sortOrder: option.sortOrder ?? optionIndex,
          active: option.active ?? true,
          environmentPrices: option.environmentPrices ?? [],

          // Cost data is intentionally not editable on this page.
          // It is preserved here so changing price/variations does not wipe costs
          // configured in Estoque.
          costMode: option.costMode,
          simpleCost: option.simpleCost,
          stockUnit: option.stockUnit,
          referenceQuantity: option.referenceQuantity,
          referenceCost: option.referenceCost,
          recipeItems: option.recipeItems ?? [],
        })),
    }))
}

export default function ProdutosPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all')
  const [categories, setCategories] = useState<CategoryConfig[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [salesEnvironments, setSalesEnvironments] = useState<SalesEnvironment[]>([])
  const [printPorts, setPrintPorts] = useState<PrintPort[]>([])
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryConfig | null>(null)
  const [importPlan, setImportPlan] = useState<ProductImportPlan | null>(null)
  const [removeMissingProducts, setRemoveMissingProducts] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [productsData, categoriesData, environmentsData, portsData] = await Promise.all([
          getProducts(),
          getCategories(),
          getSalesEnvironments(),
          listPrintPorts(),
        ])

        setProducts(productsData)
        setCategories(categoriesData)
        setSalesEnvironments(environmentsData)
        setPrintPorts(portsData.ports)
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return products.filter((product) => {
      const matchesSearch =
        term === '' ||
        product.name.toLowerCase().includes(term) ||
        (product.emoji ?? '').toLowerCase().includes(term) ||
        (product.category?.name ?? '').toLowerCase().includes(term)

      const matchesCategory =
        selectedCategory === 'all' || product.categoryId === selectedCategory

      return matchesSearch && matchesCategory && !product.isStockOnly
    })
  }, [products, searchTerm, selectedCategory])



  function buildProductImportPlan(csvText: string): ProductImportPlan {
    const parsedRows = parseCsvText(csvText)
    const productsByName = new Map(products.map((product) => [normalizeText(product.name), product]))
    const categoriesByName = new Map(categories.map((category) => [normalizeText(category.name), category]))
    const environmentsByName = new Map(
      salesEnvironments.map((environment) => [normalizeText(environment.name), environment])
    )
    const seenProductNames = new Set<string>()
    const rows: ProductImportRow[] = []
    const errors: string[] = []

    for (const parsed of parsedRows) {
      const row = parsed.row
      const name = String(row.Nome ?? row.Produto ?? row.name ?? '').trim()
      const categoryName = String(row.Categoria ?? row.category ?? '').trim()
      const price = parseSpreadsheetNumber(
        row['Preço base'] ?? row['Preco base'] ?? row.Preço ?? row.Preco ?? row.price
      )

      if (!name) {
        errors.push(`Linha ${parsed.rowNumber}: produto sem nome.`)
        continue
      }

      if (seenProductNames.has(normalizeText(name))) {
        errors.push(`Linha ${parsed.rowNumber}: produto duplicado na planilha: ${name}.`)
        continue
      }

      if (!categoryName) {
        errors.push(`Linha ${parsed.rowNumber}: categoria não informada para ${name}.`)
      }

      seenProductNames.add(normalizeText(name))

      const environmentPrices: ProductImportEnvironmentPrice[] = []
      Object.entries(row).forEach(([header, value]) => {
        const normalizedHeader = normalizeText(header)
        if (!normalizedHeader.startsWith('ambiente:')) return

        const environmentName = header.split(':').slice(1).join(':').trim()
        const environment = environmentsByName.get(normalizeText(environmentName))
        if (!environment) return
        if (String(value ?? '').trim() === '') return

        environmentPrices.push({
          salesEnvironmentId: environment.id,
          salesEnvironmentName: environment.name,
          price: parseSpreadsheetNumber(value),
        })
      })

      rows.push({
        rowNumber: parsed.rowNumber,
        name,
        categoryName,
        emoji: String(row.Emoji ?? row.emoji ?? '').trim() || '📦',
        price,
        active: parseSpreadsheetBoolean(row.Ativo ?? row.active, true),
        printPortName: String(row['Port de impressão'] ?? row['Port de impressao'] ?? row.PrintPort ?? '').trim(),
        environmentPrices,
      })
    }

    const toUpdate = rows
      .map((row) => ({ row, product: productsByName.get(normalizeText(row.name)) }))
      .filter((item): item is { row: ProductImportRow; product: Product } => Boolean(item.product))

    const toCreate = rows.filter((row) => !productsByName.has(normalizeText(row.name)))
    const importedNames = new Set(rows.map((row) => normalizeText(row.name)))
    const removed = products.filter(
      (product) => !product.isStockOnly && !importedNames.has(normalizeText(product.name))
    )

    const categoriesToCreate = Array.from(
      new Set(
        rows
          .map((row) => row.categoryName.trim())
          .filter((name) => name && !categoriesByName.has(normalizeText(name)))
      )
    )

    return {
      rows,
      toCreate,
      toUpdate,
      removed,
      categoriesToCreate,
      errors,
    }
  }

  function handleExportProducts() {
    const environmentHeaders = salesEnvironments.map((environment) => `Ambiente: ${environment.name}`)
    const headers = [
      'Nome',
      'Categoria',
      'Emoji',
      'Preço base',
      'Ativo',
      'Port de impressão',
      ...environmentHeaders,
    ]

    const lines = [headers.map(escapeCsvCell).join(';')]

    products
      .filter((product) => !product.isStockOnly)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((product) => {
        const category = categories.find((item) => item.id === product.categoryId)
        const port = printPorts.find((item) => item.id === product.printPortId)
        const environmentValues = salesEnvironments.map((environment) => {
          const item = product.environmentPrices?.find(
            (environmentPrice) => environmentPrice.salesEnvironmentId === environment.id
          )
          return item ? Number(item.price).toFixed(2).replace('.', ',') : ''
        })

        const row = [
          product.name,
          category?.name ?? product.category?.name ?? '',
          product.emoji ?? '',
          Number(product.price ?? 0).toFixed(2).replace('.', ','),
          product.active === false ? 'não' : 'sim',
          port?.name ?? product.printPort?.name ?? '',
          ...environmentValues,
        ]

        lines.push(row.map(escapeCsvCell).join(';'))
      })

    downloadTextFile('produtos-ordr.csv', `\uFEFF${lines.join('\n')}`)
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const text = await file.text()
      const plan = buildProductImportPlan(text)
      setImportPlan(plan)
      setRemoveMissingProducts(false)
    } catch (error) {
      console.error('Erro ao ler planilha:', error)
      alert('Não foi possível ler a planilha. Exporte uma planilha modelo e tente novamente.')
    }
  }

  async function handleApplyImport() {
    if (!importPlan || importPlan.errors.length > 0) return

    const confirmed = window.confirm('Deseja aplicar esta importação agora?')
    if (!confirmed) return

    setIsImporting(true)

    try {
      const categoryMap = new Map(categories.map((category) => [normalizeText(category.name), category]))
      const createdCategories: CategoryConfig[] = []

      for (const categoryName of importPlan.categoriesToCreate) {
        const created = await createCategory({
          name: categoryName,
          emoji: '📦',
          printPortId: null,
        })
        categoryMap.set(normalizeText(created.name), created)
        createdCategories.push(created)
      }

      const portByName = new Map(printPorts.map((port) => [normalizeText(port.name), port]))
      const savedProducts: Product[] = []

      const buildPayload = (row: ProductImportRow, existing?: Product): Omit<Product, 'id'> => {
        const category = categoryMap.get(normalizeText(row.categoryName))
        if (!category) throw new Error(`Categoria não encontrada: ${row.categoryName}`)

        const port = row.printPortName ? portByName.get(normalizeText(row.printPortName)) : null

        return {
          ...(existing ?? {}),
          name: row.name,
          categoryId: category.id,
          category,
          emoji: row.emoji || existing?.emoji || '📦',
          price: row.price,
          active: row.active,
          printPortId: row.printPortName ? port?.id ?? null : null,
          environmentPrices: row.environmentPrices.map((environmentPrice) => ({
            salesEnvironmentId: environmentPrice.salesEnvironmentId,
            price: environmentPrice.price,
          })),
          variationGroups: existing?.variationGroups ?? [],
          isStockOnly: existing?.isStockOnly ?? false,
          trackStock: existing?.trackStock ?? false,
          stockQuantity: existing?.stockQuantity ?? 0,
          minStock: existing?.minStock ?? 0,
          costMode: existing?.costMode ?? 'simple',
          simpleCost: existing?.simpleCost ?? null,
          stockUnit: existing?.stockUnit ?? null,
          referenceQuantity: existing?.referenceQuantity ?? null,
          referenceCost: existing?.referenceCost ?? null,
          madeOnDemand: existing?.madeOnDemand ?? false,
          unlimitedStock: existing?.unlimitedStock ?? false,
          recipeOutputQuantity: existing?.recipeOutputQuantity ?? null,
          recipeOutputUnit: existing?.recipeOutputUnit ?? null,
          recipeItems: existing?.recipeItems ?? [],
        } as Omit<Product, 'id'>
      }

      for (const item of importPlan.toUpdate) {
        const updated = await updateProduct(item.product.id, buildPayload(item.row, item.product))
        savedProducts.push(updated)
      }

      for (const row of importPlan.toCreate) {
        const created = await createProduct(buildPayload(row))
        savedProducts.push(created)
      }

      if (removeMissingProducts) {
        for (const product of importPlan.removed) {
          await deleteProduct(product.id)
        }
      }

      const deletedIds = new Set(removeMissingProducts ? importPlan.removed.map((product) => product.id) : [])
      const savedById = new Map(savedProducts.map((product) => [product.id, product]))

      setCategories((prev) => [...prev, ...createdCategories])
      setProducts((prev) => {
        const updatedExisting = prev
          .filter((product) => !deletedIds.has(product.id))
          .map((product) => savedById.get(product.id) ?? product)
        const existingIds = new Set(updatedExisting.map((product) => product.id))
        const newProducts = savedProducts.filter((product) => !existingIds.has(product.id))
        return [...newProducts, ...updatedExisting]
      })

      setImportPlan(null)
      alert('Importação aplicada com sucesso.')
    } catch (error: any) {
      console.error('Erro ao importar produtos:', error)
      alert(error?.message || 'Erro ao importar produtos.')
    } finally {
      setIsImporting(false)
    }
  }

  async function handleDeleteProduct(productId: string) {
    const confirmed = window.confirm('Deseja realmente excluir este produto?')
    if (!confirmed) return

    try {
      await deleteProduct(productId)
      setProducts((prev) => prev.filter((product) => product.id !== productId))
    } catch (error) {
      console.error('Erro ao excluir produto:', error)
      alert('Erro ao excluir produto.')
    }
  }

  function handleEditProduct(product: Product) {
    setEditingProduct(product)
    setIsProductModalOpen(true)
  }

  function handleAddNewProduct() {
    setEditingProduct(null)
    setIsProductModalOpen(true)
  }

  async function handleSaveProduct(productData: Omit<Product, 'id'>) {
    try {
      if (editingProduct) {
        const updated = await updateProduct(editingProduct.id, productData)
        setProducts((prev) =>
          prev.map((product) => (product.id === editingProduct.id ? updated : product))
        )
      } else {
        const created = await createProduct(productData)
        setProducts((prev) => [created, ...prev])
      }

      setIsProductModalOpen(false)
      setEditingProduct(null)
    } catch (error: any) {
      console.error('Erro ao salvar produto:', error)
      alert(error?.message || 'Erro ao salvar produto.')
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    const confirmed = window.confirm('Deseja realmente excluir esta categoria?')
    if (!confirmed) return

    try {
      await deleteCategory(categoryId)
      setCategories((prev) => prev.filter((category) => category.id !== categoryId))

      if (selectedCategory === categoryId) {
        setSelectedCategory('all')
      }
    } catch (error) {
      console.error('Erro ao excluir categoria:', error)
      alert('Erro ao excluir categoria.')
    }
  }

  function handleEditCategory(category: CategoryConfig) {
    setEditingCategory(category)
    setIsCategoryModalOpen(true)
  }

  function handleAddNewCategory() {
    setEditingCategory(null)
    setIsCategoryModalOpen(true)
  }

  async function handleSaveCategory(categoryData: Omit<CategoryConfig, 'id'>) {
    try {
      if (editingCategory) {
        const updated = await updateCategory(editingCategory.id, categoryData)
        setCategories((prev) =>
          prev.map((category) =>
            category.id === editingCategory.id ? updated : category
          )
        )
      } else {
        const created = await createCategory(categoryData)
        setCategories((prev) => [...prev, created])
      }

      setIsCategoryModalOpen(false)
      setEditingCategory(null)
    } catch (error: any) {
      console.error('Erro ao salvar categoria:', error)
      alert(error?.message || 'Erro ao salvar categoria.')
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-muted-foreground">Carregando...</span>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden mobile-page-scroll">
      <div className="flex flex-col gap-4 border-b border-border bg-card px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Produtos</h1>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'products'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            Produtos
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'categories'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            <Tag className="h-4 w-4 inline mr-1" />
            Categorias
          </button>
        </div>
      </div>

      {activeTab === 'products' ? (
        <>
          <div className="flex flex-col gap-3 border-b border-border bg-card/50 px-4 py-4 sm:px-6 xl:flex-row xl:items-center">
            <div className="relative w-full flex-1 xl:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                Todos
              </button>

              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto xl:ml-auto">
              <button
                type="button"
                onClick={handleExportProducts}
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <FileDown className="h-4 w-4" />
                Exportar
              </button>

              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <FileUp className="h-4 w-4" />
                Importar
              </button>

              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>

            <button
              onClick={handleAddNewProduct}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
            >
              <Plus className="h-5 w-5" />
              Novo Produto
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <table className="hidden w-full min-w-[980px] lg:table">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                      Produto
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                      Categoria
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                      Variações
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                      Ambientes
                    </th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-muted-foreground">
                      Preço base
                    </th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-muted-foreground">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{product.emoji}</span>
                          <span className="font-medium text-foreground">
                            {product.name}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-secondary rounded-full text-xs font-medium text-secondary-foreground">
                          {categories.find((category) => category.id === product.categoryId)
                            ?.name || '-'}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        {product.variationGroups && product.variationGroups.length > 0 ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <ChevronRight className="h-4 w-4" />
                            <span>{product.variationGroups.length} grupos</span>
                            {product.variationGroups.some((group) => group.required) && (
                              <span className="ml-1 px-1.5 py-0.5 bg-warning/20 text-warning text-xs rounded">
                                obrigatório
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {product.environmentPrices && product.environmentPrices.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {product.environmentPrices.map((item) => (
                              <span
                                key={item.salesEnvironmentId}
                                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-secondary text-xs text-secondary-foreground"
                              >
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      item.salesEnvironment?.color ?? '#64748B',
                                  }}
                                />
                                {item.salesEnvironment?.name || 'Ambiente'}:{' '}
                                {formatCurrency(Number(item.price))}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Preço base apenas
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="font-mono text-foreground">
                          {formatCurrency(product.price)}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                            title="Editar produto"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                            title="Excluir produto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid gap-3 p-3 lg:hidden">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="text-3xl">{product.emoji}</span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{product.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {categories.find((category) => category.id === product.categoryId)?.name || '-'}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full border border-border bg-card px-2.5 py-1 text-sm font-semibold text-foreground">
                        {formatCurrency(product.price)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2">
                        <span>Variações</span>
                        <span className="font-medium text-foreground">
                          {product.variationGroups?.length ? `${product.variationGroups.length} grupo(s)` : '-'}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3 rounded-xl bg-card px-3 py-2">
                        <span>Ambientes</span>
                        <span className="max-w-[60%] text-right text-xs font-medium text-foreground">
                          {product.environmentPrices?.length
                            ? product.environmentPrices.map((item) => `${item.salesEnvironment?.name || 'Ambiente'}: ${formatCurrency(Number(item.price))}`).join(' • ')
                            : 'Preço base apenas'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button onClick={() => handleEditProduct(product)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-secondary">
                        <Pencil className="h-4 w-4" /> Editar
                      </button>
                      <button onClick={() => handleDeleteProduct(product.id)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 text-sm font-medium text-destructive hover:bg-destructive/15">
                        <Trash2 className="h-4 w-4" /> Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredProducts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nenhum produto encontrado</p>
                  <p className="text-sm">Tente ajustar os filtros ou adicione um novo produto</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
            <p className="text-sm text-muted-foreground">
              {categories.length} categoria{categories.length !== 1 ? 's' : ''}
            </p>

            <button
              onClick={handleAddNewCategory}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Nova Categoria
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {categories.map((category) => {
                const productCount = products.filter(
                  (product) => product.categoryId === category.id && !product.isStockOnly
                ).length

                return (
                  <div
                    key={category.id}
                    className="bg-card rounded-lg border border-border p-4 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{category.emoji}</span>
                        <div>
                          <h3 className="font-semibold text-foreground">{category.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {productCount} produto{productCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      <GripVertical className="h-5 w-5 text-muted-foreground/50" />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditCategory(category)}
                        className="flex-1 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors"
                      >
                        Editar
                      </button>

                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="px-3 py-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {importPlan && (
        <ProductImportPreviewModal
          plan={importPlan}
          removeMissingProducts={removeMissingProducts}
          isImporting={isImporting}
          onChangeRemoveMissingProducts={setRemoveMissingProducts}
          onApply={handleApplyImport}
          onClose={() => setImportPlan(null)}
        />
      )}

      {isProductModalOpen && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          salesEnvironments={salesEnvironments}
          printPorts={printPorts}
          onSave={handleSaveProduct}
          onClose={() => {
            setIsProductModalOpen(false)
            setEditingProduct(null)
          }}
        />
      )}

      {isCategoryModalOpen && (
        <CategoryModal
          category={editingCategory}
          printPorts={printPorts}
          onSave={handleSaveCategory}
          onClose={() => {
            setIsCategoryModalOpen(false)
            setEditingCategory(null)
          }}
        />
      )}
    </div>
  )
}


function ProductImportPreviewModal({
  plan,
  removeMissingProducts,
  isImporting,
  onChangeRemoveMissingProducts,
  onApply,
  onClose,
}: {
  plan: ProductImportPlan
  removeMissingProducts: boolean
  isImporting: boolean
  onChangeRemoveMissingProducts: (value: boolean) => void
  onApply: () => void
  onClose: () => void
}) {
  const canApply = plan.errors.length === 0 && plan.rows.length > 0 && !isImporting

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex h-[94svh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[2rem] border border-border bg-card shadow-2xl sm:mx-4 sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
        <div className="shrink-0 border-b border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Confirmar importação de produtos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Revise o que será criado, alterado e removido antes de aplicar.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Novos produtos</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{plan.toCreate.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Produtos alterados</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{plan.toUpdate.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Fora da planilha</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{plan.removed.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Categorias novas</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{plan.categoriesToCreate.length}</p>
            </div>
          </div>

          {plan.errors.length > 0 && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Corrija os erros antes de importar
              </div>
              <ul className="list-disc space-y-1 pl-5">
                {plan.errors.slice(0, 8).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
              {plan.errors.length > 8 && (
                <p className="mt-2 text-xs">+ {plan.errors.length - 8} erro(s)</p>
              )}
            </div>
          )}

          {plan.categoriesToCreate.length > 0 && (
            <div className="rounded-2xl border border-border bg-background p-4">
              <h3 className="font-semibold text-foreground">Categorias que serão criadas</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Produtos novos precisam de categoria. Quando a categoria da planilha não existir, ela será criada automaticamente.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {plan.categoriesToCreate.map((category) => (
                  <span key={category} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    {category}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-4">
              <h3 className="font-semibold text-foreground">Produtos que serão criados</h3>
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                {plan.toCreate.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum produto novo.</p>
                ) : (
                  plan.toCreate.map((row) => (
                    <div key={`${row.rowNumber}-${row.name}`} className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2 text-sm">
                      <span className="font-medium text-foreground">{row.emoji} {row.name}</span>
                      <span className="text-muted-foreground">{formatCurrency(row.price)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <h3 className="font-semibold text-foreground">Produtos que serão alterados</h3>
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                {plan.toUpdate.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum produto existente será alterado.</p>
                ) : (
                  plan.toUpdate.map(({ row, product }) => (
                    <div key={product.id} className="rounded-xl bg-card px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-foreground">{row.emoji} {row.name}</span>
                        <span className="text-muted-foreground">{formatCurrency(product.price)} → {formatCurrency(row.price)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Categoria: {row.categoryName} • Ambientes: {row.environmentPrices.length}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {plan.removed.length > 0 && (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">Produtos removidos da planilha</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Escolha se produtos que existem no sistema, mas não aparecem na planilha importada, devem permanecer ou ser removidos.
                  </p>
                </div>

                <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={removeMissingProducts}
                    onChange={(event) => onChangeRemoveMissingProducts(event.target.checked)}
                  />
                  Remover do sistema
                </label>
              </div>

              <div className="mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                {plan.removed.map((product) => (
                  <span key={product.id} className="rounded-full bg-card px-3 py-1 text-xs text-muted-foreground">
                    {product.emoji} {product.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border bg-card/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur sm:p-6 sm:pb-6">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="min-h-11 rounded-2xl bg-secondary px-4 py-3 font-bold text-secondary-foreground sm:min-w-32 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={onApply}
              disabled={!canApply}
              className="min-h-11 rounded-2xl bg-primary px-4 py-3 font-bold text-primary-foreground shadow-sm sm:min-w-44 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isImporting ? 'Importando...' : 'Aplicar importação'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductModal({
  product,
  categories,
  salesEnvironments,
  printPorts,
  onSave,
  onClose,
}: {
  product: Product | null
  categories: CategoryConfig[]
  salesEnvironments: SalesEnvironment[]
  printPorts: PrintPort[]
  onSave: (data: Omit<Product, 'id'>) => void
  onClose: () => void
}) {
  const [name, setName] = useState(product?.name || '')
  const [price, setPrice] = useState(product?.price.toString() || '')
  const [categoryId, setCategoryId] = useState(product?.categoryId || '')
  const [emoji, setEmoji] = useState(product?.emoji || '📦')
  const [printPortId, setPrintPortId] = useState(product?.printPortId || '')
  const [variationGroups, setVariationGroups] = useState<EditableProductVariationGroup[]>(
    () =>
      ((product?.variationGroups ?? []) as EditableProductVariationGroup[]).map(
        (group, groupIndex) => ({
          ...group,
          sortOrder: group.sortOrder ?? groupIndex,
          options: (group.options ?? []).map((option, optionIndex) => ({
            ...option,
            sortOrder: option.sortOrder ?? optionIndex,
            priceModifier: Number(option.priceModifier ?? 0),
          })),
        })
      )
  )

  const [environmentPrices, setEnvironmentPrices] = useState<Record<string, string>>(() => {
    return Object.fromEntries(
      (product?.environmentPrices ?? []).map((item) => [
        item.salesEnvironmentId,
        String(item.price),
      ])
    )
  })

  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupRequired, setNewGroupRequired] = useState(false)
  const [newGroupSelectionType, setNewGroupSelectionType] = useState<'single' | 'multiple'>(
    'single'
  )

  function handleAddGroup() {
    if (!newGroupName.trim()) return

    const newGroup: EditableProductVariationGroup = {
      id: randomTempId(),
      name: newGroupName.trim(),
      required: newGroupRequired,
      selectionType: newGroupSelectionType,
      sortOrder: variationGroups.length,
      options: [],
    }

    setVariationGroups((prev) => [...prev, newGroup])
    setNewGroupName('')
    setNewGroupRequired(false)
    setNewGroupSelectionType('single')
  }

  function handleRemoveGroup(groupId: string) {
    const group = variationGroups.find((item) => item.id === groupId)

    if (group?.options?.length) {
      const confirmed = window.confirm(
        `Deseja remover o grupo "${group.name}" e todas as ${group.options.length} variações dele?`
      )

      if (!confirmed) return
    }

    setVariationGroups((prev) => prev.filter((group) => group.id !== groupId))
  }

  function handleUpdateGroup(
    groupId: string,
    updates: Partial<EditableProductVariationGroup>
  ) {
    setVariationGroups((prev) =>
      prev.map((group) => (group.id === groupId ? { ...group, ...updates } : group))
    )
  }

  function handleAddOption(groupId: string, optionName: string, optionPrice: string) {
    if (!optionName.trim()) return

    setVariationGroups((prev) =>
      prev.map((group) => {
        if (group.id !== groupId) return group

        const newOption: EditableProductVariationOption = {
          id: randomTempId(),
          groupId,
          name: optionName.trim(),
          priceModifier: parseFloat(optionPrice) || 0,
          sortOrder: group.options.length,
          active: true,

          // Created without cost configuration.
          // Cost is configured only in Estoque.
          costMode: 'simple',
          simpleCost: null,
          stockUnit: null,
          referenceQuantity: null,
          referenceCost: null,
          recipeItems: [],
          environmentPrices: [],
        }

        return {
          ...group,
          options: [...(group.options ?? []), newOption],
        }
      })
    )
  }

  function handleRemoveOption(groupId: string, optionId: string) {
    setVariationGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: (group.options ?? []).filter((option) => option.id !== optionId),
            }
          : group
      )
    )
  }

  function handleUpdateOption(
    groupId: string,
    optionId: string,
    updates: Partial<EditableProductVariationOption>
  ) {
    setVariationGroups((prev) =>
      prev.map((group) =>
        group.id !== groupId
          ? group
          : {
              ...group,
              options: (group.options ?? []).map((option) =>
                option.id === optionId ? { ...option, ...updates } : option
              ),
            }
      )
    )
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    if (!categoryId) {
      alert('Selecione uma categoria.')
      return
    }

    const parsedEnvironmentPrices: ProductEnvironmentPriceInput[] = Object.entries(
      environmentPrices
    )
      .map(([salesEnvironmentId, value]) => ({
        salesEnvironmentId,
        price: parseFloat(value),
      }))
      .filter((item) => !Number.isNaN(item.price))

    onSave({
      name,
      price: parseFloat(price) || 0,
      categoryId,
      emoji,
      variationGroups: normalizeVariationGroupsForSubmit(
        variationGroups
      ) as ProductVariationGroup[],
      environmentPrices: parsedEnvironmentPrices,

      // Product cost/stock data is not editable here.
      // These fields are preserved from the current product so editing price/variation
      // from Produtos does not erase cost configuration from Estoque.
      isStockOnly: product?.isStockOnly ?? false,
      trackStock: product?.trackStock ?? false,
      stockQuantity: product?.stockQuantity ?? 0,
      minStock: product?.minStock ?? 0,
      costMode: product?.costMode ?? 'simple',
      simpleCost: product?.simpleCost ?? null,
      stockUnit: product?.stockUnit ?? null,
      referenceQuantity: product?.referenceQuantity ?? null,
      referenceCost: product?.referenceCost ?? null,
      madeOnDemand: product?.madeOnDemand ?? false,
      unlimitedStock: product?.unlimitedStock ?? false,
      recipeOutputQuantity: product?.recipeOutputQuantity ?? null,
      recipeOutputUnit: product?.recipeOutputUnit ?? null,
      recipeItems: product?.recipeItems ?? [],
      printPortId: printPortId || null,
    } as Omit<Product, 'id'>)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex h-[94svh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[2rem] border border-border bg-card shadow-2xl sm:mx-4 sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
        <div className="shrink-0 border-b border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted sm:hidden" />
          <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {product ? 'Editar Produto' : 'Novo Produto'}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:space-y-6 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground mb-2">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground"
                required
              />
            </div>

            <div className="w-full sm:w-24">
              <label className="block text-sm font-medium text-foreground mb-2">Emoji</label>
              <input
                type="text"
                value={emoji}
                onChange={(event) => setEmoji(event.target.value)}
                className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground text-center text-2xl"
                maxLength={2}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground mb-2">
                Preço base
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground"
                required
              />
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground mb-2">Categoria</label>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground"
                required
              >
                <option value="" disabled>
                  Selecione uma categoria
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.emoji} {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/40 p-4">
            <label className="block text-sm font-medium text-foreground mb-2">Port de impressão</label>
            <select
              value={printPortId}
              onChange={(event) => setPrintPortId(event.target.value)}
              className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground"
            >
              <option value="">Seguir port da categoria</option>
              {printPorts.map((port) => (
                <option key={port.id} value={port.id}>
                  {port.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">
              Use isto apenas quando o produto precisar ir para uma impressora diferente da categoria.
            </p>
          </div>

          <div className="border border-border rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <MapPinned className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Preços por ambiente de venda
              </h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {salesEnvironments.map((environment) => (
                <div
                  key={environment.id}
                  className="rounded-lg border border-border bg-background p-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: environment.color ?? '#64748B' }}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {environment.name}
                    </span>
                  </div>

                  <input
                    type="number"
                    step="0.01"
                    value={environmentPrices[environment.id] ?? ''}
                    placeholder="Usar preço base"
                    onChange={(event) => {
                      const raw = event.target.value
                      setEnvironmentPrices((prev) => {
                        const next = { ...prev }

                        if (raw.trim() === '') {
                          delete next[environment.id]
                        } else {
                          next[environment.id] = raw
                        }

                        return next
                      })
                    }}
                    className="w-full px-3 py-2 bg-secondary/20 border border-border rounded-lg text-foreground"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Variações do produto</h3>

            <div className="grid md:grid-cols-[1fr_160px_150px_auto] gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="Nome do grupo. Ex: Fruta"
                className="px-3 py-2 bg-input border border-border rounded-lg text-foreground"
              />

              <select
                value={newGroupSelectionType}
                onChange={(event) =>
                  setNewGroupSelectionType(event.target.value as 'single' | 'multiple')
                }
                className="px-3 py-2 bg-input border border-border rounded-lg text-foreground"
              >
                <option value="single">Seleção única</option>
                <option value="multiple">Múltipla</option>
              </select>

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={newGroupRequired}
                  onChange={(event) => setNewGroupRequired(event.target.checked)}
                />
                Obrigatório
              </label>

              <button
                type="button"
                onClick={handleAddGroup}
                className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg inline-flex items-center justify-center"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {variationGroups.map((group) => (
                <VariationGroupEditor
                  key={group.id}
                  group={group}
                  onRemove={() => handleRemoveGroup(group.id)}
                  onUpdate={(updates) => handleUpdateGroup(group.id, updates)}
                  onAddOption={(optionName, optionPrice) =>
                    handleAddOption(group.id, optionName, optionPrice)
                  }
                  onRemoveOption={(optionId) => handleRemoveOption(group.id, optionId)}
                  onUpdateOption={(optionId, updates) =>
                    handleUpdateOption(group.id, optionId, updates)
                  }
                />
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Esta página configura apenas preços de venda. Custos simples, receitas e
              controle de estoque ficam na página Estoque.
            </p>
          </div>

          </div>

          <div className="shrink-0 border-t border-border bg-card/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur sm:p-6 sm:pb-6">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 rounded-2xl bg-secondary px-4 py-3 font-bold text-secondary-foreground sm:min-w-32"
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="min-h-11 rounded-2xl bg-primary px-4 py-3 font-bold text-primary-foreground shadow-sm sm:min-w-36"
              >
                {product ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function VariationGroupEditor({
  group,
  onRemove,
  onUpdate,
  onAddOption,
  onRemoveOption,
  onUpdateOption,
}: {
  group: EditableProductVariationGroup
  onRemove: () => void
  onUpdate: (updates: Partial<EditableProductVariationGroup>) => void
  onAddOption: (name: string, price: string) => void
  onRemoveOption: (optionId: string) => void
  onUpdateOption: (optionId: string, updates: Partial<EditableProductVariationOption>) => void
}) {
  const [optionName, setOptionName] = useState('')
  const [optionPrice, setOptionPrice] = useState('')

  function handleAddOption() {
    if (!optionName.trim()) return

    onAddOption(optionName, optionPrice)
    setOptionName('')
    setOptionPrice('')
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-secondary/20 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="grid flex-1 gap-2 md:grid-cols-[1fr_160px_140px]">
          <input
            type="text"
            value={group.name}
            onChange={(event) => onUpdate({ name: event.target.value })}
            placeholder="Nome do grupo"
            className="px-3 py-2 bg-input border border-border rounded-lg text-foreground"
          />

          <select
            value={group.selectionType}
            onChange={(event) =>
              onUpdate({ selectionType: event.target.value as 'single' | 'multiple' })
            }
            className="px-3 py-2 bg-input border border-border rounded-lg text-foreground"
          >
            <option value="single">Seleção única</option>
            <option value="multiple">Múltipla</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={group.required}
              onChange={(event) => onUpdate({ required: event.target.checked })}
            />
            Obrigatório
          </label>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
          title="Remover grupo"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        {(group.options ?? []).map((option) => (
          <div
            key={option.id}
            className="grid gap-2 rounded-xl border border-border bg-background p-2 md:grid-cols-[1fr_160px_auto] md:items-center md:border-0 md:bg-transparent md:p-0"
          >
            <input
              type="text"
              value={option.name}
              onChange={(event) =>
                onUpdateOption(option.id, { name: event.target.value })
              }
              placeholder="Nome da opção. Ex: Limão"
              className="px-3 py-2 bg-input border border-border rounded-lg text-foreground"
            />

            <input
              type="number"
              step="0.01"
              value={String(option.priceModifier ?? 0)}
              onChange={(event) =>
                onUpdateOption(option.id, {
                  priceModifier: parseFloat(event.target.value) || 0,
                })
              }
              placeholder="Preço extra"
              className="px-3 py-2 bg-input border border-border rounded-lg text-foreground"
            />

            <button
              type="button"
              onClick={() => onRemoveOption(option.id)}
              className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
              title="Remover opção"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="grid gap-2 border-t border-border pt-2 md:grid-cols-[1fr_160px_auto]">
        <input
          type="text"
          value={optionName}
          onChange={(event) => setOptionName(event.target.value)}
          placeholder="Nova opção. Ex: Morango"
          className="px-3 py-2 bg-input border border-border rounded-lg text-foreground"
        />

        <input
          type="number"
          step="0.01"
          value={optionPrice}
          onChange={(event) => setOptionPrice(event.target.value)}
          placeholder="Preço extra"
          className="px-3 py-2 bg-input border border-border rounded-lg text-foreground"
        />

        <button
          type="button"
          onClick={handleAddOption}
          className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg inline-flex items-center justify-center"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function CategoryModal({
  category,
  printPorts,
  onSave,
  onClose,
}: {
  category: CategoryConfig | null
  printPorts: PrintPort[]
  onSave: (data: Omit<CategoryConfig, 'id'>) => void
  onClose: () => void
}) {
  const [name, setName] = useState(category?.name || '')
  const [emoji, setEmoji] = useState(category?.emoji || '📦')
  const [printPortId, setPrintPortId] = useState(category?.printPortId || '')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    onSave({
      name,
      emoji,
      printPortId: printPortId || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex h-auto max-h-[94svh] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] border border-border bg-card shadow-2xl sm:mx-4 sm:max-h-[90vh] sm:rounded-2xl">
        <div className="shrink-0 border-b border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted sm:hidden" />
          <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {category ? 'Editar Categoria' : 'Nova Categoria'}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Emoji</label>
            <input
              type="text"
              value={emoji}
              onChange={(event) => setEmoji(event.target.value)}
              className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground text-center text-3xl"
              maxLength={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Port de impressão</label>
            <select
              value={printPortId}
              onChange={(event) => setPrintPortId(event.target.value)}
              className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground"
            >
              <option value="">Sem port configurada</option>
              {printPorts.map((port) => (
                <option key={port.id} value={port.id}>{port.name}</option>
              ))}
            </select>
          </div>

          </div>

          <div className="shrink-0 border-t border-border bg-card/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur sm:p-6 sm:pb-6">
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 flex-1 rounded-2xl bg-secondary px-4 py-3 font-bold text-secondary-foreground"
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="min-h-11 flex-1 rounded-2xl bg-primary px-4 py-3 font-bold text-primary-foreground shadow-sm"
              >
                {category ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
