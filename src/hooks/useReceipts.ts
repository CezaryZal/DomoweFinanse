import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { approveReceipt, createReceiptImageUrl, listReceipts, updateReceiptReview, uploadReceipt } from '../lib/receipts'
import type { Feedback, Receipt, ReceiptReview } from '../types'

export function useReceipts(userId: string, onExpenseCreated: () => void) {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const imageUrlsRef = useRef<Record<string, string>>({})
  const [isLoading, setLoading] = useState(true)
  const [isSaving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const refresh = useCallback(async (showLoading = false) => {
    if (!userId) return
    if (showLoading) setLoading(true)
    try {
      const loaded = await listReceipts(userId)
      setReceipts(loaded)
      const missingImages = loaded.filter((receipt) => !imageUrlsRef.current[receipt.id])
      if (missingImages.length) {
        const urls = await Promise.all(missingImages.map(async (receipt) => [receipt.id, await createReceiptImageUrl(receipt.storagePath)] as const))
        const nextUrls = { ...imageUrlsRef.current, ...Object.fromEntries(urls) }
        imageUrlsRef.current = nextUrls
        setImageUrls(nextUrls)
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Nie udało się pobrać paragonów.' })
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh(true)
  }, [refresh])

  const hasActiveJobs = useMemo(() => receipts.some((receipt) => receipt.status === 'queued' || receipt.status === 'processing'), [receipts])

  useEffect(() => {
    if (!hasActiveJobs) return
    const timer = window.setInterval(() => void refresh(false), 5000)
    return () => window.clearInterval(timer)
  }, [hasActiveJobs, refresh])

  async function upload(file: File) {
    setSaving(true)
    setFeedback(null)
    try {
      await uploadReceipt(userId, file)
      setFeedback({ type: 'success', message: 'Zdjęcie zapisano. Paragon czeka na lokalnego workera OCR.' })
      await refresh(false)
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Nie udało się przesłać zdjęcia.' })
    } finally {
      setSaving(false)
    }
  }

  async function saveReview(receiptId: string, review: ReceiptReview) {
    setSaving(true)
    setFeedback(null)
    try {
      await updateReceiptReview(userId, receiptId, review)
      setFeedback({ type: 'success', message: 'Korekta paragonu została zapisana.' })
      await refresh(false)
      return true
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Nie udało się zapisać korekty.' })
      return false
    } finally {
      setSaving(false)
    }
  }

  async function approve(receiptId: string, categoryId: string | null) {
    setSaving(true)
    setFeedback(null)
    try {
      await approveReceipt(receiptId, categoryId)
      setFeedback({ type: 'success', message: 'Paragon zatwierdzono i utworzono wydatek.' })
      await refresh(false)
      onExpenseCreated()
      return true
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Nie udało się zatwierdzić paragonu.' })
      return false
    } finally {
      setSaving(false)
    }
  }

  return { receipts, imageUrls, isLoading, isSaving, feedback, upload, saveReview, approve, clearFeedback: () => setFeedback(null) }
}
