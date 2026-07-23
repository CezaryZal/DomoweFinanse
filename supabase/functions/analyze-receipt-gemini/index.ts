import { createClient } from 'npm:@supabase/supabase-js@2.110.2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2.110.2/cors'

const RECEIPT_BUCKET = 'receipt-images'
const WORKER_ID = 'supabase-edge-gemini'
const MAX_ITEMS = 200
const prompt = [
  'Przeanalizuj zdjęcie paragonu i zwróć wyłącznie dane, które są faktycznie widoczne.',
  'Nie zgaduj ani nie uzupełniaj braków. Nazwy produktów zachowaj możliwie wiernie.',
  'Kwoty zwróć jako liczby dziesiętne bez symbolu waluty, datę jako YYYY-MM-DD.',
  'Jeśli sklep, data lub suma nie są czytelne, zwróć null.',
  'Dla każdego produktu zwróć końcową kwotę pozycji; niewidoczną ilość lub cenę jednostkową zwróć jako null.',
  'Wynik będzie poddany ręcznej weryfikacji, więc nie wyrównuj sum ani nie poprawiaj danych.',
].join('\n') + '\nZwróć wyłącznie poprawny JSON bez formatowania Markdown w postaci: {"merchant": string|null, "purchased_at": string|null, "total_amount": number|null, "items": [{"name": string, "quantity": number|null, "unit_price": number|null, "total_price": number|null}]}.'

type GeminiItem = {
  name: string
  quantity: number | null
  unit_price: number | null
  total_price: number
}

type GeminiReceipt = {
  merchant: string | null
  purchased_at: string | null
  total_amount: number | null
  items: GeminiItem[]
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function environmentKey(name: string, legacyName: string) {
  const values = Deno.env.get(name)
  if (values) {
    const parsed = JSON.parse(values) as Record<string, string>
    if (parsed.default) return parsed.default
  }
  const legacy = Deno.env.get(legacyName)
  if (!legacy) throw new Error(`Brakuje konfiguracji ${legacyName} Edge Function.`)
  return legacy
}

function nonEmptyText(value: unknown, field: string, maxLength = 240): string | null {
  if (value === null) return null
  if (typeof value !== 'string') throw new Error(`Gemini zwrócił niepoprawne pole ${field}.`)
  const result = value.trim()
  if (!result) return null
  if (result.length > maxLength) throw new Error(`Gemini zwrócił zbyt długie pole ${field}.`)
  return result
}

function numberValue(value: unknown, field: string, required = false, positive = false): number | null {
  if (value === null) {
    if (required) throw new Error(`Gemini nie zwrócił wymaganej wartości: ${field}.`)
    return null
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (positive && value === 0)) {
    throw new Error(`Gemini zwrócił niepoprawną wartość pola ${field}.`)
  }
  return value
}

function dateValue(value: unknown): string | null {
  const result = nonEmptyText(value, 'purchased_at', 10)
  if (!result) return null
  const parsed = new Date(`${result}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== result) {
    throw new Error('Gemini zwrócił datę w niepoprawnym formacie.')
  }
  return result
}

function parseGeminiReceipt(value: unknown): GeminiReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Gemini zwrócił niepoprawną strukturę danych.')
  const payload = value as Record<string, unknown>
  if (!Array.isArray(payload.items) || payload.items.length > MAX_ITEMS) throw new Error('Gemini zwrócił niepoprawną listę produktów.')

  const items = payload.items.map((item, index): GeminiItem => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Gemini zwrócił niepoprawną pozycję produktu.')
    const row = item as Record<string, unknown>
    const name = nonEmptyText(row.name, `items[${index}].name`)
    if (!name) throw new Error('Gemini zwrócił produkt bez nazwy.')
    return {
      name,
      quantity: numberValue(row.quantity, `items[${index}].quantity`, false, true),
      unit_price: numberValue(row.unit_price, `items[${index}].unit_price`),
      total_price: numberValue(row.total_price, `items[${index}].total_price`, true)!,
    }
  })

  return {
    merchant: nonEmptyText(payload.merchant, 'merchant', 160),
    purchased_at: dateValue(payload.purchased_at),
    total_amount: numberValue(payload.total_amount, 'total_amount'),
    items,
  }
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function geminiErrorDetail(responseBody: string) {
  try {
    const payload: unknown = JSON.parse(responseBody)
    if (payload && typeof payload === 'object' && 'error' in payload) {
      const error = payload.error
      if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        return error.message.trim().slice(0, 400)
      }
    }
  } catch {
    // The API can return an HTML error page; do not expose it to the client.
  }
  return null
}

async function requestGemini(image: Uint8Array, mimeType: string, apiKey: string, model: string): Promise<GeminiReceipt> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ inlineData: { mimeType, data: toBase64(image) } }, { text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
    signal: AbortSignal.timeout(55_000),
  })

  if (!response.ok) {
    const responseBody = await response.text()
    const detail = geminiErrorDetail(responseBody)
    console.error('Gemini API rejected receipt analysis', {
      status: response.status,
      response: responseBody.slice(0, 1_000),
    })
    throw new Error(detail
      ? `Gemini odrzucił żądanie (HTTP ${response.status}): ${detail}`
      : `Gemini nie zwrócił wyniku analizy (HTTP ${response.status}).`)
  }
  const body: unknown = await response.json()
  if (!body || typeof body !== 'object' || !('candidates' in body) || !Array.isArray(body.candidates)) {
    throw new Error('Gemini zwrócił niepoprawną odpowiedź.')
  }
  const parts = (body.candidates[0] as { content?: { parts?: Array<{ text?: unknown }> } } | undefined)?.content?.parts
  const text = parts?.map((part) => typeof part.text === 'string' ? part.text : '').join('').trim()
  if (!text) throw new Error('Gemini nie zwrócił danych paragonu.')

  try {
    return parseGeminiReceipt(JSON.parse(text))
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Gemini zwrócił odpowiedź, której nie można odczytać jako JSON.', { cause: error })
    throw error
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ message: 'Metoda nie jest obsługiwana.' }, 405)

  const authorization = request.headers.get('Authorization')
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (!accessToken) return json({ message: 'Wymagane jest zalogowanie.' }, 401)

  let receiptId: string
  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || !('receiptId' in body) || typeof body.receiptId !== 'string') {
      return json({ message: 'Niepoprawny identyfikator paragonu.' }, 400)
    }
    receiptId = body.receiptId
  } catch {
    return json({ message: 'Niepoprawne dane żądania.' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!supabaseUrl) return json({ message: 'Brakuje konfiguracji Supabase Edge Function.' }, 500)

  try {
    const publishableKey = environmentKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
    const secretKey = environmentKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
    const userClient = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    const adminClient = createClient(supabaseUrl, secretKey)
    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken)
    if (userError || !userData.user) return json({ message: 'Sesja wygasła. Zaloguj się ponownie.' }, 401)

    const { data: jobs, error: startError } = await userClient.rpc('start_gemini_receipt_analysis', { p_receipt_id: receiptId })
    if (startError || !Array.isArray(jobs) || jobs.length !== 1) {
      return json({ message: startError?.message || 'Paragon nie jest gotowy do analizy Gemini.' }, 409)
    }
    const job = jobs[0] as { job_id: string; storage_path: string; mime_type: string; attempt: number }

    try {
      const { data: image, error: downloadError } = await adminClient.storage.from(RECEIPT_BUCKET).download(job.storage_path)
      if (downloadError || !image) throw new Error('Nie udało się pobrać zdjęcia paragonu.')

      const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash'
      const apiKey = Deno.env.get('GEMINI_API_KEY')
      if (!apiKey) throw new Error('Brakuje konfiguracji GEMINI_API_KEY w Supabase Edge Functions.')
      const result = await requestGemini(new Uint8Array(await image.arrayBuffer()), job.mime_type, apiKey, model)
      const validationErrors = ['Wynik Gemini wymaga ręcznej weryfikacji.']
      if (!result.merchant) validationErrors.push('Nie rozpoznano sklepu.')
      if (!result.purchased_at) validationErrors.push('Nie rozpoznano daty zakupu.')
      if (result.total_amount === null) validationErrors.push('Nie rozpoznano sumy paragonu.')
      if (!result.items.length) validationErrors.push('Nie rozpoznano produktów.')

      const { data: completed, error: completeError } = await adminClient.rpc('complete_receipt_processing_job', {
        p_job_id: job.job_id,
        p_worker_id: WORKER_ID,
        p_expected_attempt: job.attempt,
        p_merchant: result.merchant,
        p_purchased_at: result.purchased_at,
        p_total_amount: result.total_amount,
        p_confidence: result.items.length ? 0.65 : 0.3,
        p_raw_ocr: { provider: 'gemini', model, structured_result: result },
        p_validation_errors: validationErrors,
        p_parser_version: `gemini-${model}`,
        p_items: result.items.map((item, index) => ({
          line_number: index + 1,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          confidence: 0.65,
          source_text: item.name,
          source_bbox: [],
        })),
      })
      if (completeError || completed !== true) throw new Error('Nie udało się zapisać wyniku Gemini.')

      return json({ receiptId, status: 'needs_review' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Analiza Gemini nie powiodła się.'
      await adminClient.rpc('fail_gemini_receipt_analysis', {
        p_job_id: job.job_id,
        p_expected_attempt: job.attempt,
        p_error_message: message,
      })
      return json({ message }, 502)
    }
  } catch (error) {
    console.error('Gemini receipt analysis failed', error instanceof Error ? error.message : 'unknown error')
    return json({ message: 'Nie udało się uruchomić analizy Gemini.' }, 500)
  }
})
