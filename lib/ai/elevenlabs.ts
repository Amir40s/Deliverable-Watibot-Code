"use strict";

import { logger } from "@/lib/logger";

export interface ElevenLabsSpeechOptions {
    apiKey?: string;
    voiceId?: string;
}

/**
 * Generates high-quality speech using ElevenLabs API.
 * Uses the organization's own configured API key and chosen voice ID.
 */
export async function generateElevenLabsSpeech(
    text: string,
    optionsOrVoiceId?: string | ElevenLabsSpeechOptions,
    apiKeyOverride?: string
): Promise<Buffer> {
    let voiceId: string | undefined;
    let customApiKey: string | undefined = apiKeyOverride;

    if (typeof optionsOrVoiceId === "string") {
        if (optionsOrVoiceId) voiceId = optionsOrVoiceId;
    } else if (optionsOrVoiceId && typeof optionsOrVoiceId === "object") {
        if (optionsOrVoiceId.voiceId) voiceId = optionsOrVoiceId.voiceId;
        if (optionsOrVoiceId.apiKey) customApiKey = optionsOrVoiceId.apiKey;
    }

    const apiKey = customApiKey?.trim();
    if (!apiKey) {
        throw new Error("⚠️ ElevenLabs API Key is missing. Please enter your ElevenLabs API Key in Settings.");
    }

    if (!voiceId) {
        throw new Error("⚠️ No ElevenLabs Voice selected. Please select an ElevenLabs Voice in Settings.");
    }

    try {
        logger.flow.info(`[ElevenLabs] Generating speech for text: "${text.substring(0, 50)}..." using Voice ID: ${voiceId}`);
        
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': apiKey,
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const detailMsg = 
                errorData?.detail?.message ||
                (typeof errorData?.detail === 'string' ? errorData.detail : null) ||
                errorData?.message ||
                errorData?.error ||
                `HTTP ${response.status} ${response.statusText}`;

            const errorCode = errorData?.detail?.code || errorData?.code || response.status;
            const errorType = errorData?.detail?.type || errorData?.type || response.statusText;

            const formattedError = `ElevenLabs Error: ${detailMsg}`;

            logger.flow.error(`[ElevenLabs] API Error (${errorCode}): ${formattedError}`);
            console.error(`\n🚨 ==================== ELEVENLABS TTS ERROR ====================`);
            console.error(`Status:  ${response.status} (${response.statusText})`);
            console.error(`Type:    ${errorType}`);
            console.error(`Code:    ${errorCode}`);
            console.error(`Message: ${detailMsg}`);
            console.error(`Voice:   ${voiceId}`);
            console.error(`=================================================================\n`);

            throw new Error(formattedError);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        logger.flow.info(`[ElevenLabs] Successfully generated audio. Buffer size: ${buffer.length} bytes`);
        return buffer;
    } catch (error: any) {
        logger.flow.error(`[ElevenLabs] TTS failed: ${error.message}`);
        throw error;
    }
}
