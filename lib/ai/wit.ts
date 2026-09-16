import { logger } from '@/lib/logger';

/**
 * Transcribes an audio buffer using the Wit.ai Speech API.
 * Supports multilingual speech including Urdu, Arabic, Hindi, and English.
 * @param audioBuffer - Raw audio bytes (OGG/Opus format from WhatsApp)
 * @returns Transcribed text, or null if transcription failed.
 */
export async function transcribeAudioWithWit(audioBuffer: Buffer): Promise<string | null> {
    const token = process.env.WIT_AI_ACCESS_TOKEN;
    if (!token) {
        logger.flow.warn('[Wit.ai] WIT_AI_ACCESS_TOKEN is not set. Skipping transcription.');
        return null;
    }

    try {
        logger.flow.info('[Wit.ai] Sending audio for transcription...');
        const contentType = audioBuffer.slice(0, 4).toString() === 'RIFF' 
            ? 'audio/wav' 
            : 'audio/ogg';

        const response = await fetch('https://api.wit.ai/speech?v=20231120', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': contentType,
            },
            body: new Uint8Array(audioBuffer),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            logger.flow.error(`[Wit.ai] API error ${response.status}: ${errorBody}`);
            return null;
        }

        const responseText = await response.text();
        logger.flow.info(`[Wit.ai] Raw Response: ${responseText}`);

        // Wit.ai can return multiple JSON objects in one response. We need to parse them individually.
        const jsonBlocks = responseText.split('\r\n').filter(line => line.trim().startsWith('{'));
        
        let transcript = '';
        for (const block of jsonBlocks) {
            try {
                const data = JSON.parse(block);
                if (data.text) {
                    transcript = data.text;
                }
            } catch (e) {
                logger.flow.error(`[Wit.ai] Failed to parse JSON block: ${block}`);
            }
        }

        transcript = transcript.trim();
        if (transcript) {
            logger.flow.info(`[Wit.ai] Final Transcription: "${transcript}"`);
        } else {
            logger.flow.warn('[Wit.ai] No transcript found in the response stream.');
        }

        return transcript || null;
    } catch (error: any) {
        logger.flow.error(`[Wit.ai] Request failed: ${error.message}`);
        return null;
    }
}

/**
 * Downloads a WhatsApp media file using its media ID and returns it as a Buffer.
 * @param mediaId - The WhatsApp media ID from the webhook payload.
 * @param accessToken - The Meta Access Token for the organization.
 */
export async function downloadWhatsAppMedia(mediaId: string, accessToken: string): Promise<Buffer | null> {
    try {
        // Step 1: Get the download URL from the media ID
        const urlResponse = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!urlResponse.ok) {
            logger.flow.error(`[Wit.ai] Failed to get media URL for ID ${mediaId}: ${urlResponse.status}`);
            return null;
        }

        const urlData = await urlResponse.json();
        const downloadUrl = urlData?.url;

        if (!downloadUrl) {
            logger.flow.error(`[Wit.ai] No URL returned for media ID ${mediaId}`);
            return null;
        }

        // Step 2: Download the actual media file
        const mediaResponse = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!mediaResponse.ok) {
            logger.flow.error(`[Wit.ai] Failed to download media from URL: ${mediaResponse.status}`);
            return null;
        }

        const arrayBuffer = await mediaResponse.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error: any) {
        logger.flow.error(`[Wit.ai] Media download failed: ${error.message}`);
        return null;
    }
}
