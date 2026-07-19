import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { ReceiptParserVariant } from '../../types'

const labels: Record<ReceiptParserVariant, string> = { rules: 'PaddleOCR + reguły', qwen: 'PaddleOCR + Qwen + reguły (eksperymentalny)', gemini: 'Model AI — Gemini 3.5' }

export function SettingsPage({ initialVariant, isSaving, onSave }: { initialVariant: ReceiptParserVariant; isSaving: boolean; onSave: (variant: ReceiptParserVariant) => void }) {
  const [variant, setVariant] = useState(initialVariant)
  const changed = variant !== initialVariant
  const needsConfiguration = variant !== 'rules'
  return <div className="page"><div className="page-title"><div><h2>Ustawienia</h2><span>Zarządzaj sposobem analizy nowych paragonów</span></div></div><section className="settings-card"><header><strong>Analiza paragonów</strong><span>Wybierz parser używany przy nowych zadaniach.</span></header><label className="settings-field">Parser paragonów<select value={variant} onChange={(event) => setVariant(event.target.value as ReceiptParserVariant)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small>Wybór określa sposób odczytywania sklepu, daty, sumy i produktów.</small></label><div className="parser-preview"><span><Sparkles size={20} /></span><div><strong>{labels[variant]}</strong><p>{variant === 'rules' ? 'Lokalny parser PaddleOCR i reguły weryfikacji.' : 'Model AI wymaga konfiguracji wyłącznie po stronie zaufanego workera.'}</p></div>{needsConfiguration && <em>Wymaga konfiguracji</em>}</div><p className="settings-note">Zmiana dotyczy wyłącznie nowych analiz. Paragony przetworzone i zadania w toku pozostają bez zmian. Dane dostępowe modeli AI nie są przechowywane w przeglądarce.</p><footer><span>Niezapisane zmiany nie wpływają na analizę.</span><button className="button primary" disabled={!changed || isSaving} onClick={() => onSave(variant)}>Zapisz ustawienia</button></footer></section></div>
}
