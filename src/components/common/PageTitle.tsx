import type { ReactNode } from 'react'

export function PageTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-title"><div><h2>{title}</h2><span>{subtitle}</span></div>{action}</div>
}
