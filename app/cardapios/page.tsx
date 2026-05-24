'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { activateMenu, createMenu, deleteMenu, getMenus, updateMenu, type Menu } from '@/lib/api/menus'
import { getProducts } from '@/lib/api/products'
import type { Product } from '@/lib/pos-types'

function formatBRL(value: number) {
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type DraftItem = {
  productId: string
  price: number
  active: boolean
}

const emptyDraft = {
  name: '',
  description: '',
  active: false,
  items: [] as DraftItem[],
}

export default function CardapiosPage() {
  const [menus, setMenus] = useState<Menu[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedMenu = useMemo(
    () => menus.find((menu) => menu.id === selectedMenuId) ?? null,
    [menus, selectedMenuId]
  )

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [menusResult, productsResult] = await Promise.all([
        getMenus(),
        getProducts({ includeInactive: true }),
      ])
      setMenus(menusResult.menus ?? [])
      setProducts(productsResult.filter((product) => !product.isStockOnly))
      const active = menusResult.menus?.find((menu) => menu.active) ?? menusResult.menus?.[0] ?? null
      setSelectedMenuId(active?.id ?? null)
      if (active) startEditing(active, false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cardápios.')
    } finally {
      setLoading(false)
    }
  }

  function startEditing(menu: Menu | null, editing = true) {
    setSelectedMenuId(menu?.id ?? null)
    setIsEditing(editing)
    setDraft(
      menu
        ? {
            name: menu.name,
            description: menu.description ?? '',
            active: menu.active,
            items: (menu.items ?? []).map((item) => ({
              productId: item.productId,
              price: Number(item.price ?? item.product?.price ?? 0),
              active: item.active,
            })),
          }
        : emptyDraft
    )
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

  function updateItemPrice(productId: string, price: number) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.productId === productId ? { ...item, price: Number.isFinite(price) ? price : 0 } : item
      ),
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
      if (selectedMenu) {
        await updateMenu(selectedMenu.id, draft)
      } else {
        await createMenu(draft)
      }
      await loadData()
      setIsEditing(false)
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
      await activateMenu(menu.id)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ativar cardápio.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(menu: Menu) {
    if (!window.confirm(`Excluir o cardápio ${menu.name}?`)) return
    setSaving(true)
    setError('')
    try {
      await deleteMenu(menu.id)
      await loadData()
      startEditing(null, true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir cardápio.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const selectedProductIds = new Set(draft.items.map((item) => item.productId))

  return (
    <main className="space-y-6 p-4 md:p-6">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Cardápios</p>
            <h1 className="text-2xl font-semibold text-foreground">Menus ativos por operação</h1>
            <p className="text-sm text-muted-foreground">
              Crie vários cardápios com produtos e preços diferentes. Apenas um cardápio fica ativo no PDV por vez.
            </p>
          </div>
          <button
            type="button"
            onClick={() => startEditing(null, true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm"
          >
            <Plus className="h-4 w-4" /> Novo cardápio
          </button>
        </div>
        {error ? <p className="mt-4 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
          {menus.map((menu) => (
            <button
              type="button"
              key={menu.id}
              onClick={() => startEditing(menu, false)}
              className={`w-full rounded-3xl border p-4 text-left transition ${selectedMenuId === menu.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-foreground">{menu.name}</h2>
                  <p className="text-xs text-muted-foreground">{menu.items?.length ?? 0} item(ns)</p>
                </div>
                {menu.active ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" /> Ativo
                  </span>
                ) : null}
              </div>
            </button>
          ))}
        </aside>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {selectedMenu ? selectedMenu.name : 'Novo cardápio'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isEditing ? 'Edite nome, produtos e preços.' : 'Visualização do cardápio selecionado.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedMenu && !selectedMenu.active ? (
                <button type="button" disabled={saving} onClick={() => handleActivate(selectedMenu)} className="rounded-2xl border border-border px-3 py-2 text-sm font-semibold">
                  Tornar ativo
                </button>
              ) : null}
              {selectedMenu ? (
                <button type="button" onClick={() => startEditing(selectedMenu, true)} className="inline-flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-sm font-semibold">
                  <Pencil className="h-4 w-4" /> Editar
                </button>
              ) : null}
              {selectedMenu && !selectedMenu.active ? (
                <button type="button" disabled={saving} onClick={() => handleDelete(selectedMenu)} className="inline-flex items-center gap-2 rounded-2xl border border-destructive/30 px-3 py-2 text-sm font-semibold text-destructive">
                  <Trash2 className="h-4 w-4" /> Excluir
                </button>
              ) : null}
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm font-medium">
                  Nome
                  <input className="w-full rounded-2xl border border-border bg-background px-3 py-2" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Descrição
                  <input className="w-full rounded-2xl border border-border bg-background px-3 py-2" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
                </label>
              </div>

              <div className="rounded-3xl border border-border p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-semibold">Produtos do cardápio</h3>
                  <p className="text-xs text-muted-foreground">{draft.items.length} selecionado(s)</p>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {products.map((product) => {
                    const selected = selectedProductIds.has(product.id)
                    const item = draft.items.find((entry) => entry.productId === product.id)
                    return (
                      <div key={product.id} className={`rounded-2xl border p-3 ${selected ? 'border-primary bg-primary/5' : 'border-border'}`}>
                        <button type="button" onClick={() => toggleProduct(product)} className="flex w-full items-center justify-between gap-3 text-left">
                          <span>
                            <span className="block font-medium">{product.emoji ? `${product.emoji} ` : ''}{product.name}</span>
                            <span className="text-xs text-muted-foreground">Base: {formatBRL(Number(product.price ?? 0))}</span>
                          </span>
                          <span className="text-sm font-semibold">{selected ? 'Incluído' : 'Adicionar'}</span>
                        </button>
                        {selected ? (
                          <label className="mt-3 block text-xs font-medium text-muted-foreground">
                            Preço neste cardápio
                            <input type="number" step="0.01" className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground" value={item?.price ?? 0} onChange={(event) => updateItemPrice(product.id, Number(event.target.value))} />
                          </label>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => startEditing(selectedMenu, false)} className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm font-semibold">
                  <X className="h-4 w-4" /> Cancelar
                </button>
                <button type="button" disabled={saving} onClick={saveMenu} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  <Save className="h-4 w-4" /> Salvar
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(selectedMenu?.items ?? []).map((item) => (
                <div key={item.id} className="rounded-2xl border border-border p-4">
                  <p className="font-semibold">{item.product?.emoji ? `${item.product.emoji} ` : ''}{item.product?.name ?? 'Produto'}</p>
                  <p className="text-sm text-muted-foreground">{item.product?.category?.name ?? 'Sem categoria'}</p>
                  <p className="mt-3 text-lg font-bold text-primary">{formatBRL(item.price)}</p>
                </div>
              ))}
              {selectedMenu && selectedMenu.items.length === 0 ? <p className="text-sm text-muted-foreground">Este cardápio ainda não tem produtos.</p> : null}
              {!selectedMenu ? <p className="text-sm text-muted-foreground">Crie ou selecione um cardápio.</p> : null}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
