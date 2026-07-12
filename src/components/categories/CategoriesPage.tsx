import { Pencil, Plus } from 'lucide-react'
import type { Category } from '../../types'
import type { CategoryTotal } from '../../lib/finance-calculations'
import { PageTitle } from '../common/PageTitle'
import { getCategoryIcon } from '../icons'

const money = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })

export function CategoriesPage({ categories, categoryTotals, onAdd, onEdit }: { categories: Category[]; categoryTotals: CategoryTotal[]; onAdd: () => void; onEdit: (category: Category) => void }) {
  const total = categoryTotals.reduce((sum, category) => sum + category.total, 0)
  return <div className="page"><PageTitle title="Kategorie" subtitle="Porządkuj wydatki według własnych zasad" action={<button className="button primary" onClick={onAdd}><Plus size={17} />Nowa kategoria</button>} />{categories.length ? <div className="category-grid">{categories.map((category) => { const item = categoryTotals.find((entry) => entry.id === category.id); const Icon = getCategoryIcon(category.icon); const percentage = total > 0 && item ? Math.round((item.total / total) * 100) : 0; return <article className="category-card" key={category.id}><span className="category-large-icon" style={{ background: `${category.color}18`, color: category.color }}><Icon size={22} /></span><div><strong>{category.name}</strong><span>{item?.total ? money.format(item.total) : 'Brak wydatków'}</span></div><small>{item?.total ? `${percentage}% wszystkich wydatków` : 'Nowa kategoria'}</small><button className="edit-button category-edit" type="button" onClick={() => onEdit(category)}><Pencil size={15} />Edytuj</button></article> })}</div> : <div className="list-empty">Brak kategorii.</div>}</div>
}
