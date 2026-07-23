import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { analyzeReceiptWithGemini, approveReceipt, createReceiptImageUrl, deleteReceipt, deleteReceiptImage, listReceipts, updateReceiptReview, uploadReceipt } from '../lib/receipts'
import type { Feedback, Receipt, ReceiptParserVariant, ReceiptReview } from '../types'

export function useReceipts(userId: string, onExpenseCreated: () => void, parserVariant: ReceiptParserVariant) {
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
      setFeedback({
        type: 'success',
        message: parserVariant === 'gemini'
          ? 'Zdjęcie zapisano. Kliknij „Analizuj przez Gemini”, aby rozpocząć analizę.'
          : 'Zdjęcie zapisano i dodano do kolejki OCR.',
      })
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
      await updateReceiptReview(receiptId, review)
      setFeedback({ type: 'success', message: 'Korekta paragonu została zapisana.' })
      await refresh(false)
      onExpenseCreated()
      return true
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Nie udało się zapisać korekty.' })
      return false
    } finally {
      setSaving(false)
    }
  }

  async function analyzeWithGemini(receiptId: string) {
    setSaving(true)
    setFeedback(null)
    setReceipts((current) => current.map((receipt) => receipt.id === receiptId
      ? { ...receipt, status: 'processing', jobStatus: 'processing', processingError: null }
      : receipt))
    try {
      await analyzeReceiptWithGemini(receiptId)
      setFeedback({ type: 'success', message: 'Gemini zakończył analizę. Sprawdź wynik przed zatwierdzeniem.' })
      await refresh(false)
      return true
    } catch (error) {
      await refresh(false)
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Nie udało się uruchomić analizy Gemini.' })
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

  async function remove(receipt: Receipt) {
    setSaving(true)
    setFeedback(null)
    try {
      const storagePath = await deleteReceipt(receipt.id)
      try {
        await deleteReceiptImage(storagePath)
      } catch {
        setFeedback({ type: 'error', message: 'Usunięto dane paragonu, ale nie udało się usunąć zdjęcia ze Storage.' })
        await refresh(false)
        onExpenseCreated()
        return false
      }
      setFeedback({ type: 'success', message: 'Paragon, zdjęcie oraz powiązany wydatek zostały usunięte.' })
      await refresh(false)
      onExpenseCreated()
      return true
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Nie udało się usunąć paragonu.' })
      return false
    } finally {
      setSaving(false)
    }
  }

  return { receipts, imageUrls, isLoading, isSaving, feedback, upload, analyzeWithGemini, saveReview, approve, remove, clearFeedback: () => setFeedback(null) }
}
