import { ArrowLeft, ArrowRight, CreditCard, ShoppingBasket, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { buildSpendingPoints, getAverageExpense, getCategoryShare, type CategoryTotal } from '../../lib/finance-calculations'
import type { Category, Expense, View } from '../../types'
import { ExpenseList } from '../expenses/ExpenseList'

const money = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })

export function Dashboard({ expenses, categories, total, categoryTotals, onNavigate, onAddExpense }: { expenses: Expense[]; categories: Category[]; total: number; categoryTotals: CategoryTotal[]; onNavigate: (view: View) => void; onAddExpense: () => void }) {
  const largest = categoryTotals.find((category) => category.total > 0)
  const average = getAverageExpense(total, expenses.length)

  return <div className="page dashboard"><section className="page-heading"><div><span className="eyebrow">Twoje prywatne wydatki</span><h2>Przegląd finansów</h2></div><div className="month-selector"><ArrowLeft size={15} /><strong>Bieżący miesiąc</strong><ArrowRight size={15} /></div></section>
    <section className="summary-grid"><SummaryCard label="Wydatki" value={money.format(total)} note={expenses.length ? 'Suma zapisanych wydatków' : 'Brak zapisanych wydatków'} icon={<CreditCard />} onClick={() => onNavigate('expenses')} /><SummaryCard label="Transakcje" value={String(expenses.length)} note={`Średnio ${average === null ? '—' : money.format(average)}`} icon={<ArrowRight />} onClick={() => onNavigate('expenses')} /><SummaryCard label="Największa kategoria" value={largest?.name ?? '—'} note={largest ? `${money.format(largest.total)} · ${getCategoryShare(largest.total, total)}%` : 'Brak danych'} icon={<ShoppingBasket />} onClick={() => onNavigate('categories')} /></section>
    {expenses.length === 0 ? <EmptyDashboard onAddExpense={onAddExpense} /> : <><section className="charts-grid"><SpendingChart expenses={expenses} total={total} /><CategoryChart categories={categoryTotals} total={total} /></section><section className="feature-banner"><span className="review-icon"><Sparkles size={19} /></span><div><strong>Moduł paragonów w przygotowaniu</strong><span>Dodawanie zdjęć i rozpoznawanie OCR pojawi się w kolejnym etapie.</span></div><button className="button secondary" onClick={() => onNavigate('receipts')}>Szczegóły</button></section><RecentExpenses expenses={expenses} categories={categories} onNavigate={onNavigate} /></>}
  </div>
}

function EmptyDashboard({ onAddExpense }: { onAddExpense: () => void }) {
  return <section className="empty-state"><span className="empty-state-icon"><CreditCard size={26} /></span><h3>Brak wydatków</h3><p>Dodaj pierwszy wydatek, aby zobaczyć podsumowanie finansów i wykresy.</p><button className="button primary" onClick={onAddExpense}>Dodaj pierwszy wydatek</button></section>
}

function SummaryCard({ label, value, note, icon, onClick }: { label: string; value: string; note: string; icon: ReactNode; onClick: () => void }) {
  return <article className="summary-card"><div className="card-label"><span>{label}</span><span className="card-icon">{icon}</span></div><strong className="summary-value">{value}</strong><div className="summary-note">{note}</div><button className="details-button" onClick={onClick}>Szczegóły</button></article>
}

function SpendingChart({ expenses, total }: { expenses: Expense[]; total: number }) {
  const points = buildSpendingPoints(expenses)
  return <article className="chart-card"><div className="section-header"><div><h3>Wydatki w czasie</h3><span>Suma narastająco na podstawie zapisów</span></div><span className="chart-pill">{money.format(total)}</span></div>{points ? <div className="line-chart"><svg viewBox="0 0 430 135" role="img" aria-label="Wykres wydatków w czasie"><path d={`M${points} L420,130 L0,130 Z`} className="chart-area" /><polyline points={points} className="chart-line" />{points.split(' ').map((point) => { const [x, y] = point.split(','); return <circle key={point} cx={x} cy={y} r="3" className="chart-dot" /> })}</svg><div className="chart-labels"><span>Początek</span><span>Środek</span><span>Najnowsze</span></div></div> : <div className="chart-empty">Brak dodatnich kwot do przedstawienia na wykresie.</div>}</article>
}

function CategoryChart({ categories, total }: { categories: CategoryTotal[]; total: number }) {
  let offset = 0
  const segments = categories.filter((category) => category.total > 0).slice(0, 4).map((category) => {
    const share = getCategoryShare(category.total, total)
    const segment = `${category.color} ${offset}% ${offset + share}%`
    offset += share
    return segment
  })
  const gradient = segments.length ? `conic-gradient(${segments.join(', ')})` : '#e5e7eb'

  return <article className="category-chart"><div className="section-header"><div><h3>Kategorie</h3><span>Udział w wydatkach</span></div></div><div className="donut" style={{ background: gradient }}><div><strong>{money.format(total)}</strong><span>łącznie</span></div></div><div className="category-legend">{categories.filter((category) => category.total > 0).slice(0, 4).map((category) => <span key={category.id}><i style={{ background: category.color }} />{category.name} {getCategoryShare(category.total, total)}%</span>)}{segments.length === 0 && <span>Brak danych</span>}</div></article>
}

function RecentExpenses({ expenses, categories, onNavigate }: { expenses: Expense[]; categories: Category[]; onNavigate: (view: View) => void }) {
  return <section className="recent-section"><div className="section-header"><div><h3>Ostatnie wydatki</h3><span>Najnowsze zapisane pozycje</span></div><button className="text-button" onClick={() => onNavigate('expenses')}>Wszystkie wydatki <ArrowRight size={15} /></button></div><ExpenseList expenses={expenses.slice(0, 4)} categories={categories} compact /></section>
}
