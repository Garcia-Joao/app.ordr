'use client'

import type { CategoryConfig } from '@/lib/pos-types'

interface CategoryTabsProps {
  categories: CategoryConfig[]
  selected: string
  onSelect: (categoryId: string) => void
}

export function CategoryTabs({ categories, selected, onSelect }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 px-4 py-3 overflow-x-auto">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onSelect(category.id)}
          className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            selected === category.id
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          <span className="text-lg">{category.emoji}</span>
          <span>{category.name}</span>
        </button>
      ))}
    </div>
  )
}
