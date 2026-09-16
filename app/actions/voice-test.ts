"use server";

import { transcribeAudio, generateSpeech } from "@/lib/ai/openai";
import { getOrganizationAiConfig } from "./organization";

export async function testVoiceTranscription(formData: FormData) {
  const file = formData.get("file") as File;
  if (!file) {
    throw new Error("No file uploaded");
  }

  const provider = (formData.get("provider") as string) || "auto";
  const apiKey = (formData.get("apiKey") as string) || undefined;
  const model = (formData.get("model") as string) || undefined;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  try {
    let apiKeys: Record<string, string> = {};
    try {
      const config = await getOrganizationAiConfig();
      apiKeys = config.apiKeys || {};
    } catch {
      // Fallback gracefully
    }
    if (apiKey && provider && provider !== 'auto') {
      apiKeys[provider] = apiKey;
    }

    const text = await transcribeAudio(buffer, {
      fileName: file.name,
      mimeType: file.type || undefined,
      provider: (provider as any),
      apiKey,
      apiKeys,
      model,
    });
    
    // Estimate duration for 16kHz 16-bit Mono WAV
    // 16000 samples/sec * 2 bytes/sample = 32000 bytes/sec
    const durationSeconds = buffer.length / 32000;
    const estimatedCost = (durationSeconds / 60) * 0.006;

    return { 
      success: true, 
      text,
      usage: {
        duration: durationSeconds.toFixed(2),
        cost: estimatedCost.toFixed(6)
      }
    };
  } catch (error: any) {
    console.error("Transcription Error:", error);
    return { success: false, error: error.message };
  }
}

export async function testVoiceGeneration(
  text: string,
  options: { provider?: 'gemini' | 'openai' | 'elevenlabs' | 'auto'; apiKey?: string; voice?: string; model?: string; language?: string } = {}
) {
  try {
    if (!text || !text.trim()) {
      throw new Error("Text is required for voice generation");
    }

    let apiKeys: Record<string, string> = {};
    try {
      const config = await getOrganizationAiConfig();
      apiKeys = config.apiKeys || {};
    } catch {
      // Fallback gracefully
    }
    if (options.apiKey && options.provider && options.provider !== 'auto') {
      apiKeys[options.provider] = options.apiKey;
    }

    const buffer = await generateSpeech(text, {
      provider: options.provider || "auto",
      apiKey: options.apiKey,
      apiKeys,
      voice: options.voice,
      model: options.model,
      language: options.language,
    });

    const isWav = buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'RIFF';
    const mimeType = isWav ? 'audio/wav' : 'audio/mpeg';
    const base64Audio = `data:${mimeType};base64,${buffer.toString('base64')}`;

    return {
      success: true,
      audioUrl: base64Audio,
      bufferSize: buffer.length,
      mimeType,
    };
  } catch (error: any) {
    console.error("Voice Generation Error:", error);
    return { success: false, error: error.message };
  }
}
