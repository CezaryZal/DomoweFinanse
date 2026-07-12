import { CarFront, CircleHelp, Home, ShoppingBasket, Sparkles, Tag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  basket: ShoppingBasket,
  home: Home,
  car: CarFront,
  heart: CircleHelp,
  sparkles: Sparkles,
  tag: Tag,
}

export function getCategoryIcon(icon: string | undefined): LucideIcon {
  return iconMap[icon ?? 'tag'] ?? Tag
}
