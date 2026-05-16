'use client'

import type { CategoryConfig } from '@/lib/pos-types'

interface CategoryTabsProps {
  categories: CategoryConfig[]
  selected: string
  onSelect: (categoryId: string) => void
  disabled?: boolean
}

export function CategoryTabs({
  categories,
  selected,
  onSelect,
  disabled = false,
}: CategoryTabsProps) {
  const baseButtonClass =
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:px-4'

  return (
    <div className="max-h-32 overflow-y-auto px-3 py-3 sm:max-h-40 sm:px-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelect('')}
          disabled={disabled}
          className={`${baseButtonClass} ${
            selected === ''
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          <span className="text-base">✨</span>
          <span>Todos</span>
        </button>

        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            disabled={disabled}
            className={`${baseButtonClass} ${
              selected === category.id
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            <span className="text-base">{category.emoji}</span>
            <span>{category.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
