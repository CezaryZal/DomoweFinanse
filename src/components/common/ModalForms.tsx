import { useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { ModalShell } from './ModalShell'
import type { Category, Expense } from '../../types'

export function ExpenseModal({ categories, initialExpense, isSaving, onClose, onSubmit }: { categories: Category[]; initialExpense?: Expense | null; isSaving: boolean; onClose: () => void; onSubmit: (expense: Omit<Expense, 'id'>) => void }) {
  const [merchant, setMerchant] = useState(initialExpense?.merchant ?? '')
  const [amount, setAmount] = useState(initialExpense ? String(initialExpense.amount).replace('.', ',') : '')
  const [categoryId, setCategoryId] = useState(initialExpense?.categoryId ?? categories[0]?.id ?? '')
  const [formError, setFormError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsedAmount = Number(amount.replace(',', '.'))
    if (!merchant.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) { setFormError('Podaj nazwę sklepu i kwotę większą od zera.'); return }
    onSubmit({ merchant: merchant.trim(), amount: parsedAmount, currency: initialExpense?.currency ?? 'PLN', categoryId: categoryId || null, date: initialExpense?.date ?? new Date().toISOString().slice(0, 10), notes: initialExpense?.notes ?? null, source: initialExpense?.source ?? 'manual' })
  }

  return <ModalShell title={initialExpense ? 'Edytuj wydatek' : 'Dodaj wydatek'} onClose={onClose}><form className="modal-form" onSubmit={submit}>
    <label>Sklep lub opis<input value={merchant} onChange={(event) => setMerchant(event.target.value)} placeholder="np. Biedronka" autoFocus /></label>
    <label>Kwota (PLN)<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" /></label>
    <label>Kategoria<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Bez kategorii</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    {formError && <div className="form-error" role="alert">{formError}</div>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Anuluj</button><button className="button primary" type="submit" disabled={isSaving}><Check size={17} />{isSaving ? 'Zapisywanie…' : initialExpense ? 'Zapisz zmiany' : 'Zapisz wydatek'}</button></div>
  </form></ModalShell>
}

export function CategoryModal({ initialCategory, isSaving, onClose, onSubmit }: { initialCategory?: Category | null; isSaving: boolean; onClose: () => void; onSubmit: (category: Omit<Category, 'id'>) => void }) {
  const [name, setName] = useState(initialCategory?.name ?? '')
  const [color, setColor] = useState(initialCategory?.color ?? '#7d72ea')
  const [formError, setFormError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) { setFormError('Podaj nazwę kategorii.'); return }
    onSubmit({ name: name.trim(), color, icon: initialCategory?.icon ?? 'tag' })
  }

  return <ModalShell title={initialCategory ? 'Edytuj kategorię' : 'Nowa kategoria'} onClose={onClose}><form className="modal-form" onSubmit={submit}>
    <label>Nazwa kategorii<input value={name} onChange={(event) => setName(event.target.value)} placeholder="np. Zwierzęta" autoFocus /></label>
    <label>Kolor kategorii<input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Kolor kategorii" /></label>
    {formError && <div className="form-error" role="alert">{formError}</div>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Anuluj</button><button className="button primary" type="submit" disabled={isSaving}><Check size={17} />{isSaving ? 'Zapisywanie…' : initialCategory ? 'Zapisz zmiany' : 'Dodaj kategorię'}</button></div>
  </form></ModalShell>
}
