'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
} from 'lucide-react'
import {
  type Product,
  type ProductVariationGroup,
  type ProductVariationOption,
  type CategoryConfig,
} from '@/lib/pos-types'
import { createProduct, deleteProduct, getProducts, updateProduct } from '@/lib/api/products'
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
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryConfig | null>(null)
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [productsData, categoriesData, environmentsData] = await Promise.all([
          getProducts(),
          getCategories(),
          getSalesEnvironments(),
        ])

        setProducts(productsData)
        setCategories(categoriesData)
        setSalesEnvironments(environmentsData)
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

            <button
              onClick={handleAddNewProduct}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto xl:ml-auto"
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

      {isProductModalOpen && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          salesEnvironments={salesEnvironments}
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

function ProductModal({
  product,
  categories,
  salesEnvironments,
  onSave,
  onClose,
}: {
  product: Product | null
  categories: CategoryConfig[]
  salesEnvironments: SalesEnvironment[]
  onSave: (data: Omit<Product, 'id'>) => void
  onClose: () => void
}) {
  const [name, setName] = useState(product?.name || '')
  const [price, setPrice] = useState(product?.price.toString() || '')
  const [categoryId, setCategoryId] = useState(product?.categoryId || '')
  const [emoji, setEmoji] = useState(product?.emoji || '📦')
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
    } as Omit<Product, 'id'>)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92svh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:mx-4 sm:max-h-[90vh] sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-foreground">
            {product ? 'Editar Produto' : 'Novo Produto'}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-4 sm:space-y-6 sm:p-6">
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

          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium"
            >
              {product ? 'Salvar' : 'Adicionar'}
            </button>
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
  onSave,
  onClose,
}: {
  category: CategoryConfig | null
  onSave: (data: Omit<CategoryConfig, 'id'>) => void
  onClose: () => void
}) {
  const [name, setName] = useState(category?.name || '')
  const [emoji, setEmoji] = useState(category?.emoji || '📦')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    onSave({
      name,
      emoji,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl border border-border bg-card shadow-2xl sm:mx-4 sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-foreground">
            {category ? 'Editar Categoria' : 'Nova Categoria'}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Nome</label>
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

          <div className="flex flex-col gap-3 pt-4 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium"
            >
              {category ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
