import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-header"><h3>{title}</h3><button className="icon-button" onClick={onClose} aria-label="Zamknij"><X size={19} /></button></div>
      {children}
    </div>
  </div>
}
