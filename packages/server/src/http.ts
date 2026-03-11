/**
 * Runtime-agnostic HTTP layer.
 *
 * Uses the global fetch() which is available in Node 18+, Deno, Bun,
 * Cloudflare Workers, and all modern edge runtimes. A custom fetch can
 * be injected via config for environments that need it.
 */

import type { ResolvedConfig, ApiResponse } from './types.js'
import {
  MetroneNetworkError,
  MetroneTimeoutError,
  MetroneAuthError,
  MetroneRateLimitError,
  MetroneServerError,
} from './errors.js'

export async function httpPost(
  config: ResolvedConfig,
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<ApiResponse> {
  return httpRequest(config, 'POST', path, body, headers)
}

export async function httpGet(
  config: ResolvedConfig,
  path: string,
  params?: Record<string, string | number | undefined>,
  headers?: Record<string, string>,
): Promise<ApiResponse> {
  let url = path
  if (params) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) qs.set(k, String(v))
    }
    const str = qs.toString()
    if (str) url += `?${str}`
  }
  return httpRequest(config, 'GET', url, undefined, headers)
}

async function httpRequest(
  config: ResolvedConfig,
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<ApiResponse> {
  const url = `${config.endpoint}${path}`
  const fetchFn = config.fetch

  const headers: Record<string, string> = {
    'X-Api-Key': config.apiKey,
    'User-Agent': 'metrone-server-sdk/1.0.0',
    ...extraHeaders,
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const response = await fetchFn(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    clearTimeout(timer)

    let data: unknown
    const ct = response.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    if (response.ok) {
      return { ok: true, status: response.status, data }
    }

    const errBody = data as Record<string, unknown> | undefined
    const errMsg = typeof errBody?.error === 'string'
      ? errBody.error
      : typeof errBody?.error === 'object' && errBody.error !== null
        ? (errBody.error as Record<string, unknown>).message as string ?? response.statusText
        : response.statusText

    if (response.status === 401) throw new MetroneAuthError(errMsg)
    if (response.status === 429) {
      const retryMs = typeof errBody?.retry_after_ms === 'number'
        ? errBody.retry_after_ms
        : 60_000
      throw new MetroneRateLimitError(retryMs)
    }
    if (response.status >= 500) throw new MetroneServerError(response.status, errMsg)

    return {
      ok: false,
      status: response.status,
      error: { code: 'API_ERROR', message: errMsg, details: errBody },
    }
  } catch (err) {
    clearTimeout(timer)

    if (err instanceof MetroneAuthError) throw err
    if (err instanceof MetroneRateLimitError) throw err
    if (err instanceof MetroneServerError) throw err

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new MetroneTimeoutError(config.timeoutMs)
    }
    if (err instanceof TypeError) {
      throw new MetroneNetworkError(err.message)
    }

    throw new MetroneNetworkError(
      err instanceof Error ? err.message : 'Unknown network error',
    )
  }
}

/**
 * Retry wrapper with exponential backoff.
 * Retries on MetroneNetworkError, MetroneTimeoutError, MetroneServerError,
 * and MetroneRateLimitError. Stops on auth or validation errors.
 */
export async function withRetry<T>(
  config: ResolvedConfig,
  fn: () => Promise<T>,
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      const isRetryable =
        err instanceof MetroneNetworkError ||
        err instanceof MetroneTimeoutError ||
        err instanceof MetroneServerError ||
        err instanceof MetroneRateLimitError

      if (!isRetryable || attempt >= config.maxRetries) throw err

      const baseDelay = err instanceof MetroneRateLimitError
        ? err.retryAfterMs
        : config.retryBaseMs * Math.pow(2, attempt)

      const jitter = Math.random() * baseDelay * 0.1
      const delay = baseDelay + jitter

      if (config.debug) {
        const errLabel = err instanceof Error ? err.message : String(err)
        console.error(
          `[metrone] Retry ${attempt + 1}/${config.maxRetries} after ${Math.round(delay)}ms: ${errLabel}`,
        )
      }

      await sleep(delay)
    }
  }

  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
