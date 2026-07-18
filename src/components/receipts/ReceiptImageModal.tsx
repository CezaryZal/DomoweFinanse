import { useEffect, useState } from 'react'
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'

type ReceiptImageModalProps = {
  filename: string
  imageUrl: string
  onClose: () => void
}

export function ReceiptImageModal({ filename, imageUrl, onClose }: ReceiptImageModalProps) {
  const [zoom, setZoom] = useState(1)
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null)

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="modal-backdrop receipt-image-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
      <section className="receipt-image-modal" role="dialog" aria-modal="true" aria-label={`Podgląd oryginału: ${filename}`}>
        <header className="receipt-image-modal-header">
          <div>
            <strong>{filename}</strong>
            <span>Oryginalna rozdzielczość</span>
          </div>
          <div className="receipt-image-modal-actions">
            <div className="receipt-image-zoom-controls" aria-label="Powiększenie zdjęcia">
              <button className="delete-button" type="button" onClick={() => setZoom((current) => Math.max(0.5, current - 0.25))} disabled={zoom <= 0.5} aria-label="Pomniejsz zdjęcie"><ZoomOut size={18} /></button>
              <span aria-live="polite">Skala {Math.round(zoom * 100)}%</span>
              <button className="delete-button" type="button" onClick={() => setZoom((current) => Math.min(3, current + 0.25))} disabled={zoom >= 3} aria-label="Powiększ zdjęcie"><ZoomIn size={18} /></button>
              <button className="delete-button" type="button" onClick={() => setZoom(1)} disabled={zoom === 1} aria-label="Przywróć oryginalną skalę"><RotateCcw size={17} /></button>
            </div>
            <button className="delete-button" type="button" onClick={onClose} aria-label="Zamknij podgląd zdjęcia"><X size={18} /></button>
          </div>
        </header>
        <div className="receipt-original-scroll">
          <img src={imageUrl} alt={`Oryginał paragonu ${filename}`} onLoad={(event) => setNaturalWidth(event.currentTarget.naturalWidth)} style={naturalWidth ? { width: `${naturalWidth * zoom}px` } : undefined} />
        </div>
      </section>
    </div>
  )
}
