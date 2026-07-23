import { supabase } from './supabase'
import type { Receipt, ReceiptAnalysisMethod, ReceiptItem, ReceiptReview, ReceiptStatus } from '../types'

export const RECEIPT_BUCKET = 'receipt-images'
export const RECEIPT_MAX_SIZE = 10 * 1024 * 1024
export const RECEIPT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const GEMINI_ANALYSIS_TIMEOUT_MS = 75_000

type ReceiptItemRow = {
  id: string
  category_id: string | null
  line_number: number
  name: string
  quantity: number | string | null
  unit_price: number | string | null
  total_price: number | string
  confidence: number | string | null
  source_text: string | null
}

type ReceiptJobRow = {
  status: Receipt['jobStatus']
  error_message: string | null
}

type ReceiptRow = {
  id: string
  expense_id: string | null
  category_id: string | null
  status: ReceiptStatus
  analysis_method: ReceiptAnalysisMethod
  storage_path: string
  original_filename: string
  merchant: string | null
  purchased_at: string | null
  total_amount: number | string | null
  currency: string
  confidence: number | string | null
  validation_errors: unknown
  parser_version: string | null
  created_at: string
  receipt_items: ReceiptItemRow[] | null
  receipt_processing_jobs: ReceiptJobRow[] | null
}

function toNumber(value: number | string | null): number | null {
  return value === null ? null : Number(value)
}

function mapItem(row: ReceiptItemRow): ReceiptItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    lineNumber: row.line_number,
    name: row.name,
    quantity: toNumber(row.quantity),
    unitPrice: toNumber(row.unit_price),
    totalPrice: Number(row.total_price),
    confidence: toNumber(row.confidence),
    sourceText: row.source_text,
  }
}

function mapReceipt(row: ReceiptRow): Receipt {
  const job = row.receipt_processing_jobs?.[0]
  const validationErrors = Array.isArray(row.validation_errors)
    ? row.validation_errors.filter((item): item is string => typeof item === 'string')
    : []

  return {
    id: row.id,
    expenseId: row.expense_id,
    categoryId: row.category_id,
    status: row.status,
    analysisMethod: row.analysis_method,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    merchant: row.merchant,
    purchasedAt: row.purchased_at,
    totalAmount: toNumber(row.total_amount),
    currency: row.currency,
    confidence: toNumber(row.confidence),
    validationErrors,
    parserVersion: row.parser_version,
    createdAt: row.created_at,
    items: (row.receipt_items ?? []).map(mapItem).sort((a, b) => a.lineNumber - b.lineNumber),
    jobStatus: job?.status ?? null,
    processingError: job?.error_message ?? null,
  }
}

export function validateReceiptFile(file: File) {
  if (!RECEIPT_MIME_TYPES.includes(file.type as typeof RECEIPT_MIME_TYPES[number])) {
    throw new Error('Obsługiwane są wyłącznie pliki JPEG, PNG i WebP.')
  }
  if (file.size === 0 || file.size > RECEIPT_MAX_SIZE) {
    throw new Error('Zdjęcie musi mieć rozmiar od 1 bajta do 10 MB.')
  }
}

async function calculateFileHash(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: number | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId)
  }
}

export async function listReceipts(userId: string): Promise<Receipt[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select(`
      id, expense_id, category_id, status, analysis_method, storage_path, original_filename, merchant, purchased_at,
      total_amount, currency, confidence, validation_errors, parser_version, created_at,
      receipt_items (id, category_id, line_number, name, quantity, unit_price, total_price, confidence, source_text),
      receipt_processing_jobs (status, error_message)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as unknown as ReceiptRow[]).map(mapReceipt)
}

export async function uploadReceipt(userId: string, file: File): Promise<string> {
  validateReceiptFile(file)
  const sourceHash = await calculateFileHash(file)

  const { data: duplicate, error: duplicateError } = await supabase
    .from('receipts')
    .select('id')
    .eq('user_id', userId)
    .eq('source_hash', sourceHash)
    .maybeSingle()

  if (duplicateError) throw duplicateError
  if (duplicate) throw new Error('To zdjęcie zostało już dodane.')

  const receiptId = crypto.randomUUID()
  const storagePath = `${userId}/${receiptId}/original.${extensionForMimeType(file.type)}`
  const { error: uploadError } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) throw uploadError

  const { error: registerError } = await supabase.rpc('register_receipt_upload', {
    p_receipt_id: receiptId,
    p_storage_path: storagePath,
    p_original_filename: file.name,
    p_mime_type: file.type,
    p_file_size: file.size,
    p_source_hash: sourceHash,
  })

  if (registerError) {
    await supabase.storage.from(RECEIPT_BUCKET).remove([storagePath])
    throw registerError
  }

  return receiptId
}

export async function createReceiptImageUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(storagePath, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export async function updateReceiptReview(receiptId: string, review: ReceiptReview) {
  const { error } = await supabase.rpc('save_receipt_review', {
    p_receipt_id: receiptId,
    p_merchant: review.merchant.trim(),
    p_purchased_at: review.purchasedAt,
    p_total_amount: review.totalAmount,
    p_category_id: review.categoryId,
    p_items: review.items.map((item) => ({
      name: item.name.trim(),
      categoryId: item.categoryId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    })),
  })

  if (error) throw error
}

export async function deleteReceipt(receiptId: string): Promise<string> {
  const { data, error } = await supabase.rpc('delete_receipt', { p_receipt_id: receiptId })
  if (error) throw error
  return data as string
}

export async function analyzeReceiptWithGemini(receiptId: string): Promise<string> {
  const invocation = supabase.functions.invoke('analyze-receipt-gemini', {
    body: { receiptId },
  })
  const { data, error } = await withTimeout(
    invocation,
    GEMINI_ANALYSIS_TIMEOUT_MS,
    'Analiza Gemini trwa zbyt długo. Spróbuj ponownie za chwilę.',
  )

  if (error) {
    if (error.context instanceof Response) {
      const payload: unknown = await error.context.json().catch(() => null)
      if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
        throw new Error(payload.message)
      }
    }
    throw error
  }

  if (!data || typeof data !== 'object' || !('receiptId' in data) || typeof data.receiptId !== 'string') {
    throw new Error('Gemini zwrócił niepoprawną odpowiedź.')
  }

  return data.receiptId
}

export async function deleteReceiptImage(storagePath: string) {
  const { error } = await supabase.storage.from(RECEIPT_BUCKET).remove([storagePath])
  if (error) throw error
}

export async function approveReceipt(receiptId: string, categoryId: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('approve_receipt_as_expense', {
    p_receipt_id: receiptId,
    p_category_id: categoryId,
  })

  if (error) throw error
  return data as string
}
