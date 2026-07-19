import { BarChart3, Camera, FileText, LayoutDashboard, LogOut, Menu, Plus, ReceiptText, Settings, Tag } from 'lucide-react'
import type { View } from '../../types'

export function Sidebar({ activeView, onNavigate, onSignOut }: { activeView: View; onNavigate: (view: View) => void; onSignOut: () => void }) {
  const items: { view: View; label: string; icon: typeof LayoutDashboard }[] = [
    { view: 'dashboard', label: 'Pulpit', icon: LayoutDashboard },
    { view: 'expenses', label: 'Wydatki', icon: FileText },
    { view: 'receipts', label: 'Paragony', icon: ReceiptText },
    { view: 'categories', label: 'Kategorie', icon: Tag },
    { view: 'settings', label: 'Ustawienia', icon: Settings },
  ]

  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark"><BarChart3 size={18} /></span><span>Domowe<br /><strong>Finanse</strong></span></div>
    <nav aria-label="Główna nawigacja">{items.map(({ view, label, icon: Icon }) => <button key={view} className={activeView === view ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate(view)}><Icon size={17} />{label}</button>)}</nav>
    <div className="sidebar-bottom"><button className="nav-item" onClick={onSignOut}><LogOut size={17} />Wyloguj</button><div className="household"><span className="avatar">D</span><div><small>Użytkownik</small><strong>Twoje finanse</strong><span>Dane prywatne</span></div></div></div>
  </aside>
}

export function Topbar({ onAddExpense, onOpenReceipt, onMenu, userEmail, onSignOut }: { onAddExpense: () => void; onOpenReceipt: () => void; onMenu: () => void; userEmail: string; onSignOut: () => void }) {
  const currentDate = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  return <header className="topbar"><button className="mobile-menu" onClick={onMenu} aria-label="Otwórz menu"><Menu size={21} /></button><div className="greeting"><span>{currentDate}</span><h1>Dzień dobry</h1></div><div className="top-actions"><span className="user-email">{userEmail}</span><button className="button secondary" onClick={onAddExpense}><Plus size={17} />Dodaj wydatek</button><button className="button primary" onClick={onOpenReceipt}><Camera size={16} />Skanuj paragon</button><button className="icon-button" onClick={onSignOut} aria-label="Wyloguj"><LogOut size={19} /></button></div></header>
}
