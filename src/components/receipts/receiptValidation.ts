export function hasUncategorizedReceiptItems(items: Array<{ categoryId: string | null }>) {
  return items.some((item) => !item.categoryId)
}
