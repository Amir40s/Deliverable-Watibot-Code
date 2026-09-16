import { translate } from 'google-translate-api-x';
import { logger } from '@/lib/logger';

export async function translateToEnglish(text: string): Promise<{ translatedText: string, detectedLanguage: string }> {
    if (!text || text.length < 2) return { translatedText: text, detectedLanguage: 'en' };
    try {
        const res = await translate(text, { to: 'en' });
        const detectedLanguage = res.from.language.iso.toLowerCase() || 'en';
        return { 
            translatedText: res.text, 
            detectedLanguage 
        };
    } catch (e: any) {
        logger.flow.error(`[Translate] Translation to English failed: ${e.message}`);
        return { translatedText: text, detectedLanguage: 'en' };
    }
}

export async function translateText(text: string, targetLang: string): Promise<string> {
    if (!text || !targetLang) return text;
    // If target is the same as source (though we don't always know source yet), 
    // we can let the library handle it or check if it's already in that lang.
    try {
        const res = await translate(text, { to: targetLang });
        return res.text;
    } catch (e: any) {
        logger.flow.error(`[Translate] Translation to ${targetLang} failed: ${e.message}`);
        return text;
    }
}
