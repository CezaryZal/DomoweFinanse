import { useState, type ChangeEvent, type ReactNode } from 'react'
import { Camera, Check, Clock3, FileWarning, LoaderCircle, Upload } from 'lucide-react'
import { FeedbackBanner } from '../common/FeedbackBanner'
import { PageTitle } from '../common/PageTitle'
import { useReceipts } from '../../hooks/useReceipts'
import type { Category, Receipt, ReceiptReview, ReceiptStatus } from '../../types'

const money = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })
const dateTime = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })

const statusLabels: Record<ReceiptStatus, string> = {
  uploading: 'Wysyłanie',
  queued: 'Oczekuje na OCR',
  processing: 'Przetwarzanie',
  needs_review: 'Do weryfikacji',
  approved: 'Zatwierdzony',
  failed: 'Błąd OCR',
}

export function ReceiptsPage({ userId, categories, onExpenseCreated }: { userId: string; categories: Category[]; onExpenseCreated: () => void }) {
  const { receipts, imageUrls, isLoading, isSaving, feedback, upload, saveReview, approve, clearFeedback } = useReceipts(userId, onExpenseCreated)

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void upload(file)
    event.target.value = ''
  }

  const uploadAction = <label className={`button primary receipt-upload-button ${isSaving ? 'disabled' : ''}`}><Upload size={17} />{isSaving ? 'Przesyłanie…' : 'Dodaj zdjęcie'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} disabled={isSaving} /></label>

  return <div className="page receipts-page">
    <PageTitle title="Paragony" subtitle="Prywatne zdjęcia, kolejka OCR i ręczna weryfikacja" action={uploadAction} />
    <FeedbackBanner feedback={feedback} error="" onDismiss={clearFeedback} />
    {isLoading ? <div className="receipt-loading"><LoaderCircle className="spin" size={22} />Pobieranie paragonów…</div> : receipts.length === 0 ? <EmptyReceipts onFileSelected={selectFile} disabled={isSaving} /> : <div className="receipt-grid">{receipts.map((receipt) => <ReceiptCard key={receipt.id} receipt={receipt} imageUrl={imageUrls[receipt.id]} categories={categories} isSaving={isSaving} onSave={saveReview} onApprove={approve} />)}</div>}
  </div>
}

function EmptyReceipts({ onFileSelected, disabled }: { onFileSelected: (event: ChangeEvent<HTMLInputElement>) => void; disabled: boolean }) {
  return <div className="receipt-empty"><span className="empty-icon"><Camera size={30} /></span><h3>Dodaj pierwszy paragon</h3><p>Zdjęcie zostanie zapisane w prywatnym Supabase Storage i ustawione w kolejce dla lokalnego workera PaddleOCR.</p><label className={`button secondary receipt-upload-button ${disabled ? 'disabled' : ''}`}><Upload size={17} />Wybierz zdjęcie<input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileSelected} disabled={disabled} /></label><small>JPEG, PNG lub WebP, maksymalnie 10 MB.</small></div>
}

function ReceiptCard({ receipt, imageUrl, categories, isSaving, onSave, onApprove }: { receipt: Receipt; imageUrl?: string; categories: Category[]; isSaving: boolean; onSave: (id: string, review: ReceiptReview) => Promise<boolean>; onApprove: (id: string, categoryId: string | null) => Promise<boolean> }) {
  return <article className="receipt-card">
    <div className="receipt-preview">{imageUrl ? <img src={imageUrl} alt={`Paragon ${receipt.originalFilename}`} /> : <Camera size={26} />}</div>
    <div className="receipt-content">
      <div className="receipt-card-header"><div><strong>{receipt.merchant ?? receipt.originalFilename}</strong><span>{dateTime.format(new Date(receipt.createdAt))}</span></div><span className={`receipt-status ${receipt.status}`}>{statusLabels[receipt.status]}</span></div>
      {receipt.status === 'queued' && <ReceiptProgress icon={<Clock3 size={18} />} text="Zadanie czeka na uruchomienie lokalnego workera." />}
      {receipt.status === 'processing' && <ReceiptProgress icon={<LoaderCircle className="spin" size={18} />} text="Worker analizuje obraz i sprawdza sumy." />}
      {receipt.status === 'failed' && <ReceiptProgress icon={<FileWarning size={18} />} text={receipt.processingError ?? 'Nie udało się rozpoznać paragonu.'} error />}
      {(receipt.status === 'needs_review' || receipt.status === 'approved') && <ReceiptResult receipt={receipt} categories={categories} isSaving={isSaving} onSave={onSave} onApprove={onApprove} />}
    </div>
  </article>
}

function ReceiptProgress({ icon, text, error = false }: { icon: ReactNode; text: string; error?: boolean }) {
  return <div className={`receipt-progress ${error ? 'error' : ''}`}>{icon}<span>{text}</span></div>
}

function ReceiptResult({ receipt, categories, isSaving, onSave, onApprove }: { receipt: Receipt; categories: Category[]; isSaving: boolean; onSave: (id: string, review: ReceiptReview) => Promise<boolean>; onApprove: (id: string, categoryId: string | null) => Promise<boolean> }) {
  const [merchant, setMerchant] = useState(receipt.merchant ?? '')
  const [purchasedAt, setPurchasedAt] = useState(receipt.purchasedAt ?? '')
  const [totalAmount, setTotalAmount] = useState(receipt.totalAmount === null ? '' : String(receipt.totalAmount).replace('.', ','))
  const [categoryId, setCategoryId] = useState('')
  const [formError, setFormError] = useState('')
  const isApproved = receipt.status === 'approved'

  function getReview(): ReceiptReview | null {
    const amount = Number(totalAmount.replace(',', '.'))
    if (!merchant.trim() || !purchasedAt || !Number.isFinite(amount) || amount <= 0) {
      setFormError('Uzupełnij sklep, datę i poprawną kwotę większą od zera.')
      return null
    }
    setFormError('')
    return { merchant: merchant.trim(), purchasedAt, totalAmount: amount }
  }

  async function save() {
    const review = getReview()
    if (review) await onSave(receipt.id, review)
  }

  async function approve() {
    const review = getReview()
    if (!review) return
    if (await onSave(receipt.id, review)) await onApprove(receipt.id, categoryId || null)
  }

  return <div className="receipt-result">
    {receipt.validationErrors.length > 0 && <div className="receipt-validation"><strong>Wymaga sprawdzenia:</strong>{receipt.validationErrors.map((error) => <span key={error}>{error}</span>)}</div>}
    <div className="receipt-review-grid"><label>Sklep<input value={merchant} onChange={(event) => setMerchant(event.target.value)} disabled={isApproved} /></label><label>Data<input type="date" value={purchasedAt} onChange={(event) => setPurchasedAt(event.target.value)} disabled={isApproved} /></label><label>Suma (PLN)<input inputMode="decimal" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} disabled={isApproved} /></label><label>Kategoria<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={isApproved}><option value="">Bez kategorii</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>
    {formError && <div className="form-error" role="alert">{formError}</div>}
    {receipt.items.length > 0 && <div className="receipt-items"><div className="receipt-items-header"><strong>Rozpoznane pozycje</strong><span>{receipt.items.length}</span></div>{receipt.items.map((item) => <div className="receipt-item" key={item.id}><span>{item.name}</span><strong>{money.format(item.totalPrice)}</strong><small>{item.confidence === null ? '' : `${Math.round(item.confidence * 100)}% pewności`}</small></div>)}</div>}
    <div className="receipt-result-footer"><span>{receipt.confidence === null ? 'Brak oceny pewności' : `Pewność OCR: ${Math.round(receipt.confidence * 100)}%`}{receipt.parserVersion ? ` · ${receipt.parserVersion}` : ''}</span>{isApproved ? <span className="approved-label"><Check size={15} />Wydatek utworzony</span> : <div><button className="button secondary" onClick={() => void save()} disabled={isSaving}>Zapisz korektę</button><button className="button primary" onClick={() => void approve()} disabled={isSaving}><Check size={16} />Zatwierdź jako wydatek</button></div>}</div>
  </div>
}
