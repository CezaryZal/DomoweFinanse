import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { ReceiptParserVariant } from '../../types'

const labels: Record<ReceiptParserVariant, string> = { rules: 'PaddleOCR + reguły', qwen: 'PaddleOCR + Qwen + reguły (eksperymentalny)', gemini: 'Model AI — Gemini 3.5' }

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : 'Nie udało się zapisać ustawień parsera. Spróbuj ponownie.'
}

export function SettingsPage({ initialVariant, onSave }: { initialVariant: ReceiptParserVariant; onSave: (variant: ReceiptParserVariant) => Promise<void> }) {
  const [variant, setVariant] = useState(initialVariant)
  const [isSaving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  useEffect(() => setVariant(initialVariant), [initialVariant])
  const changed = variant !== initialVariant
  const needsConfiguration = variant !== 'rules'
  async function save() {
    setSaving(true)
    setMessage(null)
    setSaveError(null)
    try {
      await onSave(variant)
      setMessage(`Zapisano parser: ${labels[variant]}. Nowe paragony użyją tego wariantu.`)
    } catch (error) {
      setSaveError(formatError(error))
    } finally {
      setSaving(false)
    }
  }

  return <div className="page"><div className="page-title"><div><h2>Ustawienia</h2><span>Zarządzaj sposobem analizy nowych paragonów</span></div></div><section className="settings-card"><header><strong>Analiza paragonów</strong><span>Wybierz parser używany przy nowych zadaniach.</span></header><label className="settings-field" htmlFor="receipt-parser-variant">Parser paragonów<select id="receipt-parser-variant" aria-label="Parser paragonów" value={variant} disabled={isSaving} onChange={(event) => { setVariant(event.target.value as ReceiptParserVariant); setMessage(null); setSaveError(null) }}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small>Wybór określa sposób odczytywania sklepu, daty, sumy i produktów.</small></label><div className="parser-preview"><span><Sparkles size={20} /></span><div><strong>{labels[variant]}</strong><p>{variant === 'rules' ? 'Lokalny parser PaddleOCR i reguły weryfikacji.' : 'Wybrany model będzie używany przez lokalny worker dla nowych paragonów.'}</p></div>{needsConfiguration && <em>Model AI</em>}</div><p className="settings-note">Zmiana dotyczy wyłącznie nowych analiz. Paragony przetworzone i zadania w toku pozostają bez zmian. Klucz API modelu jest przechowywany lokalnie w workerze i nie jest widoczny w przeglądarce.</p>{message && <p className="settings-feedback success" role="status">{message}</p>}{saveError && <p className="settings-feedback error" role="alert">{saveError}</p>}<footer><span>Niezapisane zmiany nie wpływają na analizę.</span><button className="button primary" disabled={!changed || isSaving} onClick={() => void save()}>{isSaving ? 'Zapisywanie…' : 'Zapisz ustawienia'}</button></footer></section></div>
}
