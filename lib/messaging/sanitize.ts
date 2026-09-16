export const PROVIDER_ERROR_FALLBACK =
    "I'm sorry, I couldn't generate a response right now. Please try again later or contact our support team.";

const PROVIDER_ERROR_PATTERNS = [
    /❌\s*ai\s*error/i,
    /\bai\s*error\s*:/i,
    /incorrect\s+api\s+key/i,
    /invalid[_\s-]?api[_\s-]?key/i,
    /api\s+key\s+(provided|is\s+missing|is\s+invalid)/i,
    /openai\s+api\s+key/i,
    /platform\.openai\.com\/account\/api-keys/i,
];

export function isProviderErrorMessage(text?: string | null) {
    if (!text) return false;
    return PROVIDER_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

const STALE_ASSISTANT_HISTORY_PATTERNS = [
    /\bi.?m sorry,\s*i don.?t have information on that/i,
    /please contact our support team/i,
    /\bi couldn.?t generate a response right now/i,
    /\bi am watibot assistant/i,
    /\bmain watibot assistant hoon/i,
    /welcome to asaan khata/i,
    /pos software/i,
    /whatsapp ban issues/i,
    /bulk messaging/i,
    /chatbot automation/i,
    /ai automation/i,
];

export function isStaleAssistantHistoryMessage(text?: string | null) {
    if (!text) return false;
    return isProviderErrorMessage(text) || STALE_ASSISTANT_HISTORY_PATTERNS.some((pattern) => pattern.test(text));
}

export function sanitizeCustomerMessage(text: string) {
    return isProviderErrorMessage(text) ? PROVIDER_ERROR_FALLBACK : text;
}
