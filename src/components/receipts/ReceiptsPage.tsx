import { Camera } from 'lucide-react'
import { PageTitle } from '../common/PageTitle'

export function ReceiptsPage() {
  return <div className="page"><PageTitle title="Paragony" subtitle="Moduł automatycznego rozpoznawania jest w przygotowaniu" /><div className="receipt-empty"><span className="empty-icon"><Camera size={30} /></span><h3>Moduł skanowania paragonów</h3><p>W kolejnym etapie dodamy przesyłanie zdjęć, kolejkę przetwarzania oraz ekran korekty wyników OCR.</p><button className="button secondary" disabled><Camera size={17} />W przygotowaniu</button><small>Na tym etapie zdjęcia nie są wysyłane ani zapisywane.</small></div></div>
}
