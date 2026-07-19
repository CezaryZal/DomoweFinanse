import { useState, type ChangeEvent } from 'react'
import { Camera, Check, ChevronDown, ChevronUp, Pencil, Plus, Save, Trash2, Upload } from 'lucide-react'
import { FeedbackBanner } from '../common/FeedbackBanner'
import { PageTitle } from '../common/PageTitle'
import { useReceipts } from '../../hooks/useReceipts'
import type { Category, Receipt, ReceiptItemDraft, ReceiptReview } from '../../types'
import { ReceiptImageModal } from './ReceiptImageModal'
import { hasUncategorizedReceiptItems } from './receiptValidation'
import './ReceiptsPage.css'

const money = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })
const dateTime = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })

export function ReceiptsPage({ userId, categories, onExpenseCreated }: { userId: string; categories: Category[]; onExpenseCreated: () => void }) {
  const api = useReceipts(userId, onExpenseCreated)
  const [preview, setPreview] = useState<{ filename: string; imageUrl: string } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Receipt | null>(null)

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void api.upload(file)
    event.target.value = ''
  }

  return <div className="page receipt-workspace">
    <PageTitle title="Weryfikacja OCR" subtitle="Paragony" action={<label className="button primary receipt-upload-button"><Upload size={17} />Dodaj zdjęcie<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} /></label>} />
    <FeedbackBanner feedback={api.feedback} error="" onDismiss={api.clearFeedback} />
    {api.isLoading ? <p className="receipt-loading">Pobieranie paragonów…</p> : api.receipts.length ? <div className="receipt-review-list">
      {api.receipts.map((receipt) => <ReceiptCard key={receipt.id} receipt={receipt} imageUrl={api.imageUrls[receipt.id]} categories={categories} isSaving={api.isSaving} onPreview={(imageUrl) => setPreview({ filename: receipt.originalFilename, imageUrl })} onSave={api.saveReview} onApprove={api.approve} onDelete={() => setPendingDelete(receipt)} />)}
    </div> : <div className="receipt-empty"><Camera size={30} /><h3>Dodaj pierwszy paragon</h3><label className="button primary receipt-upload-button"><Upload size={17} />Wybierz zdjęcie<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} /></label></div>}
    {preview && <ReceiptImageModal {...preview} onClose={() => setPreview(null)} />}
    {pendingDelete && <DeleteModal receipt={pendingDelete} isSaving={api.isSaving} onCancel={() => setPendingDelete(null)} onConfirm={async () => { if (await api.remove(pendingDelete)) setPendingDelete(null) }} />}
  </div>
}

function ReceiptCard({ receipt, imageUrl, categories, isSaving, onPreview, onSave, onApprove, onDelete }: { receipt: Receipt; imageUrl?: string; categories: Category[]; isSaving: boolean; onPreview: (url: string) => void; onSave: (id: string, review: ReceiptReview) => Promise<boolean>; onApprove: (id: string, categoryId: string | null) => Promise<boolean>; onDelete: () => void }) {
  const approved = receipt.status === 'approved'
  const [expanded, setExpanded] = useState(!approved)
  const [editing, setEditing] = useState(false)
  const [merchant, setMerchant] = useState(receipt.merchant ?? '')
  const [purchasedAt, setPurchasedAt] = useState(receipt.purchasedAt ?? '')
  const [total, setTotal] = useState(receipt.totalAmount === null ? '' : String(receipt.totalAmount).replace('.', ','))
  const [categoryId, setCategoryId] = useState(receipt.categoryId ?? '')
  const [items, setItems] = useState<ReceiptItemDraft[]>(receipt.items.map((item) => ({ name: item.name, categoryId: item.categoryId, quantity: item.quantity, unitPrice: item.unitPrice, totalPrice: item.totalPrice })))
  const [openItem, setOpenItem] = useState<number | null>(null)
  const [error, setError] = useState('')
  const readOnly = approved && !editing
  const receiptTotal = Number(total.replace(',', '.'))
  const missingCategory = hasUncategorizedReceiptItems(items)
  const displayName = merchant || receipt.originalFilename
  const categorySummary = items.reduce<Array<{ categoryId: string | null; itemCount: number; total: number }>>((groups, item) => {
    const existing = groups.find((group) => group.categoryId === item.categoryId)
    if (existing) { existing.itemCount += 1; existing.total += item.totalPrice; return groups }
    groups.push({ categoryId: item.categoryId, itemCount: 1, total: item.totalPrice })
    return groups
  }, [])

  function update(index: number, field: keyof ReceiptItemDraft, value: string) {
    setItems((current) => current.map((item, itemIndex) => itemIndex !== index ? item : { ...item, [field]: field === 'name' || field === 'categoryId' ? value || null : value === '' ? null : Number(value.replace(',', '.')) }))
  }

  function review(): ReceiptReview | null {
    if (missingCategory) { setError('Przypisz kategorię do każdego produktu.'); return null }
    return { merchant: merchant.trim(), purchasedAt, totalAmount: receiptTotal, categoryId: categoryId || null, items }
  }

  async function saveChanges() {
    const value = review()
    if (value && await onSave(receipt.id, value)) setEditing(false)
  }

  return <section className={`receipt-review-layout ${expanded ? 'is-expanded' : 'is-collapsed'}`}>
    <aside className="receipt-image-panel"><div><strong>Zdjęcie paragonu</strong><span>{receipt.originalFilename} · {dateTime.format(new Date(receipt.createdAt))}</span></div>{imageUrl ? <button className="receipt-image-button" onClick={() => onPreview(imageUrl)}><img src={imageUrl} alt={`Paragon ${receipt.originalFilename}`} /></button> : <Camera size={28} />}</aside>
    <section className="receipt-review-card">
      <header className="receipt-summary-header" onClick={() => setExpanded((value) => !value)}>
        <div className="receipt-summary-copy"><strong>{expanded ? 'Zweryfikuj dane paragonu' : displayName}</strong><span>{expanded ? `${items.length} ${items.length === 1 ? 'produkt' : 'produktów'}` : `${purchasedAt || 'Brak daty'} · ${items.length} ${items.length === 1 ? 'produkt' : 'produktów'}`}</span>{!expanded && <strong className="receipt-summary-total">{Number.isFinite(receiptTotal) ? money.format(receiptTotal) : 'Brak sumy'}</strong>}</div>
        <div className="receipt-card-actions"><span className={`receipt-status ${receipt.status}`}>{approved ? 'Zatwierdzony' : 'Do weryfikacji'}</span>{approved && <button className="button secondary receipt-edit-button" onClick={(event) => { event.stopPropagation(); if (editing) { void saveChanges(); return } setExpanded(true); setEditing(true) }} disabled={isSaving}>{editing ? <><Save size={15} />Zapisz</> : <><Pencil size={15} />Edytuj</>}</button>}<button className="text-button receipt-toggle-button" aria-label={expanded ? 'Zwiń paragon' : 'Rozwiń paragon'} onClick={(event) => { event.stopPropagation(); setExpanded((value) => !value) }}>{expanded ? <>Zwiń <ChevronUp size={16} /></> : <>Szczegóły <ChevronDown size={16} /></>}</button><button className="delete-button" aria-label="Usuń paragon" onClick={(event) => { event.stopPropagation(); onDelete() }} disabled={isSaving}><Trash2 size={17} /></button></div>
      </header>
      {!expanded && <div className="receipt-category-summary">{categorySummary.length ? categorySummary.map((group) => { const category = categories.find((item) => item.id === group.categoryId); return <span key={group.categoryId ?? 'none'} style={category ? { backgroundColor: `${category.color}20`, color: category.color } : undefined}><strong>{category?.name ?? 'Bez kategorii'}</strong><small>{group.itemCount} {group.itemCount === 1 ? 'produkt' : 'produktów'} · {money.format(group.total)}</small></span> }) : <small>Brak rozpoznanych kategorii.</small>}</div>}
      {expanded && <>
        <div className="receipt-meta-grid"><label>Sklep<input value={merchant} disabled={readOnly} onChange={(event) => setMerchant(event.target.value)} /></label><label>Data<input type="date" value={purchasedAt} disabled={readOnly} onChange={(event) => setPurchasedAt(event.target.value)} /></label><label>Suma paragonu<input value={total} disabled={readOnly} onChange={(event) => setTotal(event.target.value)} /></label></div>
        {!readOnly && <div className="receipt-bulk"><label>Kategoria dla wszystkich produktów<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Wybierz kategorię</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button className="button secondary" disabled={!categoryId} onClick={() => setItems((current) => current.map((item) => ({ ...item, categoryId })))}>Zastosuj do wszystkich</button></div>}
        <div className="receipt-products-head"><strong>Produkty · {items.length} pozycji</strong>{!readOnly && <button className="button secondary" onClick={() => setItems((current) => [...current, { name: '', categoryId: null, quantity: null, unitPrice: null, totalPrice: 0 }])}><Plus size={16} />Dodaj produkt</button>}</div>
        {items.length ? <><div className="receipt-table-head"><span>Nazwa produktu</span><span>Cena</span><span>Kategoria</span><span /></div>{items.map((item, index) => <ProductRow key={`${index}-${item.name}`} item={item} source={receipt.items[index]?.sourceText} categories={categories} readOnly={readOnly} open={openItem === index} onToggle={() => setOpenItem(openItem === index ? null : index)} onUpdate={(field, value) => update(index, field, value)} />)}</> : <p className="receipt-items-empty">Brak rozpoznanych produktów.</p>}
        <footer className="receipt-review-footer">{error && <span className="form-error">{error}</span>}<div>{!readOnly && !approved && <button className="button secondary" disabled={isSaving} onClick={() => void saveChanges()}>Zapisz korektę</button>}{!approved && <button className="button primary" disabled={isSaving || missingCategory} onClick={async () => { const value = review(); if (value && await onSave(receipt.id, value)) await onApprove(receipt.id, value.categoryId) }}><Check size={16} />Zatwierdź jako wydatek</button>}</div></footer>
      </>}
    </section>
  </section>
}

function ProductRow({ item, source, categories, readOnly, open, onToggle, onUpdate }: { item: ReceiptItemDraft; source?: string | null; categories: Category[]; readOnly: boolean; open: boolean; onToggle: () => void; onUpdate: (field: keyof ReceiptItemDraft, value: string) => void }) {
  return <><div className="receipt-product-row"><div>{readOnly ? <strong>{item.name}</strong> : <input value={item.name} onChange={(event) => onUpdate('name', event.target.value)} />}</div>{readOnly ? <strong>{money.format(item.totalPrice)}</strong> : <input value={item.totalPrice || ''} onChange={(event) => onUpdate('totalPrice', event.target.value)} />}{readOnly ? <span>{categories.find((category) => category.id === item.categoryId)?.name ?? '—'}</span> : <select value={item.categoryId ?? ''} onChange={(event) => onUpdate('categoryId', event.target.value)}><option value="">Wybierz kategorię</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>}<button className="text-button" onClick={onToggle}>{open ? <>Zwiń <ChevronUp size={15} /></> : <>Szczegóły <ChevronDown size={15} /></>}</button></div>{open && <div className="receipt-product-details"><span>Ilość<strong>{item.quantity ?? '—'}</strong></span><span>Cena jednostkowa<strong>{item.unitPrice ?? '—'}</strong></span><span>Suma<strong>{money.format(item.totalPrice)}</strong></span><span>Źródło<strong>{source ? 'OCR' : 'Ręcznie'}</strong></span></div>}</>
}

function DeleteModal({ receipt, isSaving, onCancel, onConfirm }: { receipt: Receipt; isSaving: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop"><section className="modal"><div className="modal-header"><h3>Usunąć paragon?</h3></div><div className="receipt-delete-content"><p>Paragon „{receipt.merchant ?? receipt.originalFilename}” zostanie trwale usunięty.</p><div className="modal-actions"><button className="button secondary" onClick={onCancel}>Anuluj</button><button className="button danger" disabled={isSaving} onClick={() => void onConfirm()}>Usuń paragon</button></div></div></section></div>
}
