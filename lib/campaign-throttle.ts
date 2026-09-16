/**
 * Campaign Broadcast Throttle Utilities
 * 
 * Implements Meta-compliant rate limiting for WhatsApp Business API message sending.
 * 
 * Strategy:
 * - Random 1.5–3s delay between individual messages
 * - Every 75–100 messages, take a 45–90 second batch break
 * - Exponential backoff with jitter for HTTP 429 / rate-limit errors
 * - Structured logging for all throttle events
 */

// ─── Configurable Constants ─────────────────────────────────────────────────

/** Parse helper for environment integer variables with fallback */
function getEnvNumber(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (!val) return defaultValue;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/** Batch size range: a random value between these two is picked per batch cycle */
export function getBatchBreakEvery(): number {
  return getEnvNumber('CAMPAIGN_BATCH_BREAK_EVERY', 300);
}

/** Batch break duration range (milliseconds) */
export function getBatchBreakMinMs(): number {
  return getEnvNumber('CAMPAIGN_BATCH_BREAK_MIN_MS', 45_000);  // 45 seconds
}
export function getBatchBreakMaxMs(): number {
  return getEnvNumber('CAMPAIGN_BATCH_BREAK_MAX_MS', 90_000);  // 90 seconds
}

/** Per-message delay range (milliseconds) */
export function getMsgDelayMinMs(): number {
  return getEnvNumber('CAMPAIGN_MIN_DELAY_MS', 50_000);     // 50 seconds default
}
export function getMsgDelayMaxMs(): number {
  return getEnvNumber('CAMPAIGN_MAX_DELAY_MS', 60_000);     // 60 seconds default
}

/** Retry configuration */
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 5_000;   // 5 seconds
const MAX_BACKOFF_MS = 60_000;      // 60 seconds cap

// ─── Delay Utilities ────────────────────────────────────────────────────────

/** Returns a random integer between min and max (inclusive) */
function randomBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/** Returns a per-message delay (supports dynamic min/max range or fixed seconds) */
export function getMessageDelay(minOrFixedSeconds?: number, maxSeconds?: number): number {
  if (typeof minOrFixedSeconds === 'number' && typeof maxSeconds === 'number' && minOrFixedSeconds > 0 && maxSeconds >= minOrFixedSeconds) {
    const minMs = Math.round(minOrFixedSeconds * 1000);
    const maxMs = Math.round(maxSeconds * 1000);
    return randomBetween(minMs, maxMs);
  }
  if (typeof minOrFixedSeconds === 'number' && minOrFixedSeconds > 0) {
    return Math.round(minOrFixedSeconds * 1000);
  }
  const minMs = getMsgDelayMinMs();
  const maxMs = getMsgDelayMaxMs();
  return randomBetween(minMs, Math.max(minMs, maxMs));
}

/** Returns a random batch break delay (45–90 seconds default) */
export function getBatchBreakDelay(): number {
  const minMs = getBatchBreakMinMs();
  const maxMs = getBatchBreakMaxMs();
  return randomBetween(minMs, Math.max(minMs, maxMs));
}

/** Async sleep helper */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Batch Break Tracker ────────────────────────────────────────────────────

/**
 * Creates a stateful batch break tracker.
 * Call `tracker.check()` before each message send.
 * It triggers a break when the configured threshold is reached.
 */
export function createBatchTracker(customBatchSize?: number, customBreakSeconds?: number) {
  const breakEvery = (typeof customBatchSize === 'number' && customBatchSize > 0) ? customBatchSize : getBatchBreakEvery();
  let messagesSinceBreak = 0;
  let batchNumber = 0;

  return {
    /**
     * Call this before each message send.
     * Returns the number of ms to wait if a batch break is needed, or 0 if not.
     */
    check(): number {
      messagesSinceBreak++;
      if (messagesSinceBreak >= breakEvery) {
        batchNumber++;
        const breakMs = (typeof customBreakSeconds === 'number' && customBreakSeconds > 0)
          ? Math.round(customBreakSeconds * 1000)
          : getBatchBreakDelay();
        messagesSinceBreak = 0;
        return breakMs;
      }
      return 0;
    },

    /** Returns the current batch number (how many breaks have occurred) */
    getBatchNumber(): number {
      return batchNumber;
    },

    /** Returns how many messages have been sent since the last break */
    getMessagesSinceBreak(): number {
      return messagesSinceBreak;
    },
  };
}

// ─── Rate Limit Detection ───────────────────────────────────────────────────

/** Known Meta API rate-limit error codes */
const RATE_LIMIT_ERROR_CODES = [
  131056,   // Rate limit hit
  130429,   // Rate limit hit (alternative)
  80007,    // Too many API calls
];

/**
 * Determines if an error is a transient/rate-limit error that should be retried.
 * Checks for:
 * - HTTP 429 status codes
 * - Meta-specific rate limit error codes (#131056, #130429, #80007)
 * - Common transient error patterns (ETIMEDOUT, ECONNRESET, 503, 502)
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  const msg = error instanceof Error ? error.message : String(error);
  const lowerMsg = msg.toLowerCase();

  // HTTP 429 / Rate limit patterns
  if (lowerMsg.includes('429') || lowerMsg.includes('rate limit') || lowerMsg.includes('too many')) {
    return true;
  }

  // Meta-specific error codes
  for (const code of RATE_LIMIT_ERROR_CODES) {
    if (lowerMsg.includes(String(code)) || lowerMsg.includes(`#${code}`)) {
      return true;
    }
  }

  // Transient network errors
  if (
    lowerMsg.includes('etimedout') ||
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('503') ||
    lowerMsg.includes('502') ||
    lowerMsg.includes('socket hang up') ||
    lowerMsg.includes('network error') ||
    lowerMsg.includes('fetch failed')
  ) {
    return true;
  }

  return false;
}

// ─── Exponential Backoff ────────────────────────────────────────────────────

/**
 * Calculates exponential backoff delay with jitter.
 * Formula: min(INITIAL_BACKOFF * 2^attempt + random_jitter, MAX_BACKOFF)
 */
export function getBackoffDelay(attempt: number): number {
  const exponential = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 2000; // 0–2s jitter
  return Math.min(exponential + jitter, MAX_BACKOFF_MS);
}

// ─── Retry Wrapper ──────────────────────────────────────────────────────────

export interface ThrottledRetryOptions {
  /** Tag for log messages (e.g. 'Scheduler', 'CampaignAPI') */
  tag: string;
  /** Identifier for the current message (e.g. contactId or phone number) */
  messageId: string;
  /** Maximum number of retries (defaults to MAX_RETRIES) */
  maxRetries?: number;
}

export interface ThrottledRetryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  wasRateLimited: boolean;
}

/**
 * Wraps a send function with retry logic and exponential backoff.
 * 
 * - On success: returns immediately
 * - On retryable error (429, rate limit, transient): waits with exponential backoff, then retries
 * - On permanent error: throws immediately without retrying
 */
export async function withThrottledRetry<T>(
  sendFn: () => Promise<T>,
  opts: ThrottledRetryOptions
): Promise<ThrottledRetryResult<T>> {
  const maxRetries = opts.maxRetries ?? MAX_RETRIES;
  let wasRateLimited = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendFn();
      if (attempt > 0) {
        logThrottleEvent(opts.tag, 'RETRY_SUCCESS', {
          messageId: opts.messageId,
          attempt,
          totalAttempts: attempt + 1,
        });
      }
      return { success: true, data: result, attempts: attempt + 1, wasRateLimited };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (isRetryableError(error) && attempt < maxRetries) {
        wasRateLimited = true;
        const backoffMs = getBackoffDelay(attempt);
        logThrottleEvent(opts.tag, 'RATE_LIMITED', {
          messageId: opts.messageId,
          attempt: attempt + 1,
          maxRetries,
          backoffMs,
          error: errorMsg,
        });
        await sleep(backoffMs);
        continue;
      }

      // Permanent error or max retries exhausted
      if (attempt >= maxRetries && isRetryableError(error)) {
        logThrottleEvent(opts.tag, 'MAX_RETRIES_EXHAUSTED', {
          messageId: opts.messageId,
          attempts: attempt + 1,
          error: errorMsg,
        });
      }

      return { success: false, error: errorMsg, attempts: attempt + 1, wasRateLimited };
    }
  }

  // Should not reach here, but just in case
  return { success: false, error: 'Unknown error', attempts: maxRetries + 1, wasRateLimited };
}

// ─── Structured Logging ─────────────────────────────────────────────────────

type ThrottleEventType =
  | 'BATCH_BREAK'
  | 'MSG_DELAY'
  | 'RATE_LIMITED'
  | 'RETRY_SUCCESS'
  | 'MAX_RETRIES_EXHAUSTED'
  | 'CAMPAIGN_PROGRESS';

/**
 * Logs a structured throttle event for debugging and monitoring.
 */
export function logThrottleEvent(
  tag: string,
  event: ThrottleEventType,
  data: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${tag}][Throttle]`;

  switch (event) {
    case 'BATCH_BREAK':
      console.log(
        `${prefix} 🛑 BATCH BREAK — Batch #${data.batchNumber}, sent ${data.messagesSent} msgs so far. Pausing for ${Math.round((data.breakDurationMs as number) / 1000)}s...`
      );
      break;
    case 'RATE_LIMITED':
      console.warn(
        `${prefix} ⚠️ RATE LIMITED — Message ${data.messageId}, attempt ${data.attempt}/${data.maxRetries}. Backing off ${Math.round((data.backoffMs as number) / 1000)}s. Error: ${data.error}`
      );
      break;
    case 'RETRY_SUCCESS':
      console.log(
        `${prefix} ✅ RETRY SUCCESS — Message ${data.messageId} succeeded on attempt ${data.totalAttempts}`
      );
      break;
    case 'MAX_RETRIES_EXHAUSTED':
      console.error(
        `${prefix} ❌ MAX RETRIES EXHAUSTED — Message ${data.messageId} failed after ${data.attempts} attempts. Error: ${data.error}`
      );
      break;
    case 'CAMPAIGN_PROGRESS':
      console.log(
        `${prefix} 📊 PROGRESS — ${data.sent}/${data.total} sent, ${data.failed} failed, batch #${data.batchNumber}`
      );
      break;
    default:
      console.log(`${prefix} [${event}] ${JSON.stringify(data)}`);
  }
}
