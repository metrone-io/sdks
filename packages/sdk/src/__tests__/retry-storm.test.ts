/**
 * Regression tests for the SDK ingestion path.
 *
 * In particular, the "retry storm" bug: prior to v1.4.2, flushBatch /
 * sendEvent / processQueue re-queued events on ANY failure — including
 * permanent 4xx responses such as 400 BATCH_ALL_INVALID. Combined with the
 * 5s flushInterval, that meant a single broken payload (e.g. clock-skewed
 * timestamps) would flood the network tab and the server with the same
 * doomed batch every 5 seconds, forever.
 *
 * The fix flags 4xx (non-429) responses as PermanentRequestError and the
 * three call sites drop those events instead of re-queueing them.
 */

import { Metrone } from '../core/Metrone'

declare const global: typeof globalThis & { fetch: jest.Mock }

// The SDK's sendHttp only reads .ok / .status / .statusText off the fetch
// response, so a plain object satisfies the contract without depending on
// jsdom's fetch implementation.
function makeResponse(status: number, statusText = ''): unknown {
  return { ok: status >= 200 && status < 300, status, statusText }
}

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('Metrone batch ingestion — retry storm regression', () => {
  let originalFetch: typeof global.fetch
  let sdk: Metrone

  beforeEach(() => {
    originalFetch = global.fetch
    global.fetch = jest.fn()

    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
        clear: () => undefined,
      },
      configurable: true,
    })
  })

  afterEach(() => {
    if (sdk) sdk.destroy()
    global.fetch = originalFetch
    jest.useRealTimers()
  })

  it('drops the batch on 400 (does not re-queue the same broken payload)', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(400, 'Bad Request'))

    sdk = new Metrone({
      apiKey: 'metrone_live_test_key_for_retry_storm_regression',
      autoTrack: false,
      autoTrackSPA: false,
      autoTrackClicks: false,
      batchSize: 10,
      flushInterval: 0,
    })

    sdk.track('pageview')
    sdk.track('pageview')
    sdk.track('pageview')
    sdk.flush()

    await flushPromises()

    expect((global.fetch as jest.Mock).mock.calls.length).toBe(1)

    sdk.flush()
    await flushPromises()

    expect((global.fetch as jest.Mock).mock.calls.length).toBe(1)
  })

  it('keeps events queued on 5xx (transient — retry is correct)', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(503, 'Service Unavailable'))

    sdk = new Metrone({
      apiKey: 'metrone_live_test_key_for_retry_storm_regression',
      autoTrack: false,
      autoTrackSPA: false,
      autoTrackClicks: false,
      batchSize: 10,
      flushInterval: 0,
    })

    sdk.track('pageview')

    // Drive the batch through the full retry sequence (3 attempts × backoff
    // ≈ 7s). The transient-error path should re-queue the events when the
    // retries are exhausted, in contrast to the permanent-error path which
    // drops them.
    await (sdk as unknown as { flushBatch: () => Promise<void> }).flushBatch()

    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2)
    expect((sdk as unknown as { eventQueue: unknown[] }).eventQueue.length).toBe(1)
  }, 20000)

  it('drops the event on 400 in single-event mode (no retry storm)', async () => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(400, 'Bad Request'))

    sdk = new Metrone({
      apiKey: 'metrone_live_test_key_for_retry_storm_regression',
      autoTrack: false,
      autoTrackSPA: false,
      autoTrackClicks: false,
      batchSize: 1,
      flushInterval: 0,
    })

    sdk.track('pageview')
    await flushPromises()

    const callsAfterFirstSend = (global.fetch as jest.Mock).mock.calls.length

    await flushPromises()
    await new Promise(r => setTimeout(r, 50))

    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsAfterFirstSend)
  })

  it('treats 429 as retryable (does NOT drop)', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeResponse(429, 'Too Many Requests'))
      .mockResolvedValueOnce(makeResponse(429, 'Too Many Requests'))
      .mockResolvedValueOnce(makeResponse(429, 'Too Many Requests'))
      .mockResolvedValueOnce(makeResponse(200, 'OK'))

    sdk = new Metrone({
      apiKey: 'metrone_live_test_key_for_retry_storm_regression',
      autoTrack: false,
      autoTrackSPA: false,
      autoTrackClicks: false,
      batchSize: 10,
      flushInterval: 0,
    })

    sdk.track('pageview')
    sdk.flush()

    await new Promise(r => setTimeout(r, 8000))

    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2)
  }, 15000)
})
