import { useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { ModalShell } from './ModalShell'
import type { Category, Expense } from '../../types'

export function ExpenseModal({ categories, isSaving, onClose, onSubmit }: { categories: Category[]; isSaving: boolean; onClose: () => void; onSubmit: (expense: Omit<Expense, 'id'>) => void }) {
  const [merchant, setMerchant] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [formError, setFormError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsedAmount = Number(amount.replace(',', '.'))
    if (!merchant.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Podaj nazwę sklepu i kwotę większą od zera.')
      return
    }
    onSubmit({ merchant: merchant.trim(), amount: parsedAmount, currency: 'PLN', categoryId: categoryId || null, date: new Date().toISOString().slice(0, 10), source: 'manual' })
  }

  return <ModalShell title="Dodaj wydatek" onClose={onClose}><form className="modal-form" onSubmit={submit}>
    <label>Sklep lub opis<input value={merchant} onChange={(event) => setMerchant(event.target.value)} placeholder="np. Biedronka" autoFocus /></label>
    <label>Kwota (PLN)<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" /></label>
    <label>Kategoria<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Bez kategorii</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    {formError && <div className="form-error" role="alert">{formError}</div>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Anuluj</button><button className="button primary" type="submit" disabled={isSaving}><Check size={17} />{isSaving ? 'Zapisywanie…' : 'Zapisz wydatek'}</button></div>
  </form></ModalShell>
}

export function CategoryModal({ isSaving, onClose, onSubmit }: { isSaving: boolean; onClose: () => void; onSubmit: (category: Omit<Category, 'id'>) => void }) {
  const [name, setName] = useState('')
  const [formError, setFormError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setFormError('Podaj nazwę kategorii.')
      return
    }
    onSubmit({ name: name.trim(), color: '#7d72ea', icon: 'tag' })
  }

  return <ModalShell title="Nowa kategoria" onClose={onClose}><form className="modal-form" onSubmit={submit}>
    <label>Nazwa kategorii<input value={name} onChange={(event) => setName(event.target.value)} placeholder="np. Zwierzęta" autoFocus /></label>
    {formError && <div className="form-error" role="alert">{formError}</div>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Anuluj</button><button className="button primary" type="submit" disabled={isSaving}><Check size={17} />{isSaving ? 'Zapisywanie…' : 'Dodaj kategorię'}</button></div>
  </form></ModalShell>
}
