/**
 * Normalizes a phone number to international format (without +).
 * Specifically handles Pakistani numbers (03xx -> 923xx).
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
    if (!phone) return '';

    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');

    // Handle Pakistani local format: 03xx... (11 digits) -> 923xx...
    if (cleaned.startsWith('03') && cleaned.length === 11) {
        cleaned = '92' + cleaned.substring(1);
    }
    
    // Handle leading 00: 0092... -> 92...
    if (cleaned.startsWith('00')) {
        cleaned = cleaned.substring(2);
    }

    // Standardize: if it starts with +, the \D replace already removed it.
    // If it's already in 923xx... format, we leave it.

    return cleaned;
}
