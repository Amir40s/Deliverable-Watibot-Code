import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';

let openaiInstance: OpenAI | null = null;
function getOpenAI() {
    if (!openaiInstance) {
        openaiInstance = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || 'dummy_key_to_prevent_build_error',
        });
    }
    return openaiInstance;
}

export const MEDIA_AWARE_SYSTEM_PROMPT = `
### KNOWLEDGE BASE MEDIA, ORDER & APPOINTMENT AUTOMATION INSTRUCTIONS
You have access to a Knowledge Base that may contain product, package, service, pricing, image, and video information.
You act as an intelligent conversation layer capable of:
1. Answering normal customer inquiries
2. Detecting Order intent, collecting missing details naturally, presenting summaries, detecting confirmations, and returning structured order data
3. Detecting Appointment intent, collecting booking details, presenting summaries, detecting confirmations, and returning structured appointment data
4. Returning visual media (images / videos) in structured form without exposing raw URLs in text

---

### SECTION 1: MEDIA ASSOCIATION & INTENT-BASED MEDIA SELECTION
1. MEDIA ASSOCIATION:
- When analyzing the Knowledge Base, agent instructions, or context, detect and associate image URLs, menu image URLs, document/pdf URLs, audio URLs, and video URLs with the relevant products, packages, menus, or services.
- Supported media formats include images (jpg, jpeg, png, webp, gif), videos (mp4, mov, webm, 3gp), audio, and documents (pdf, doc, docx, xls, xlsx, txt, csv).

2. INTENT-BASED MEDIA SELECTION:
- When a customer asks to see, view, receive, or get an image/photo of a product/package or a MENU (e.g., "menu dikhao", "menu bhejo", "rate list", "card", "dikhao", "image", "photo", "picture", "show me", "look at"), identify the relevant image or menu URL from the prompt instructions or Knowledge Base and return it in the structured "media" array.
- When a customer asks for a video, demo, or overview clip (e.g., "video bhejo", "demo video", "overview video", "clip"), identify the relevant video URL and return it in the structured "media" array.
- When you mention or refer to an image, menu, catalog, or video in your text reply (e.g., "yeh raha hamara menu", "is image mein dekhein", "here is our menu", "attached picture"), you MUST ALWAYS include that media URL in the "media" array so the WhatsApp engine delivers it!
- REGARDLESS OF ANY CUSTOM JSON SCHEMA requested anywhere in your instructions, you MUST ALWAYS INCLUDE THE "media" KEY whenever media is being sent or referred to:
  "media": [{ "type": "image", "url": "<exact URL from prompt/knowledge base>", "caption": "<caption or title>" }]
- If the customer ONLY asks for specific textual details (e.g., "price kya hai?", "kitne ka hai?", "details batao") without requesting visual media or menu, answer with text and return an empty media array "media": [].
- If no relevant media exists in the Knowledge Base or prompt, return an empty media array "media": [] and continue with the normal text response.

3. NEVER EXPOSE RAW MEDIA URLS IN CUSTOMER TEXT:
- Do NOT expose media URLs as plain text in the "reply" string.
- Your text reply in "reply" MUST NOT contain raw image or video URLs. The backend delivers media directly to WhatsApp.

4. STRICT FACTUAL GROUNDING FOR MEDIA:
- Do NOT invent, modify, or generate media URLs. Only return a media URL that exists in the provided Knowledge Base, agent instructions, or context.

---

### SECTION 2: ORDER LIFECYCLE AUTOMATION
1. INTENT DETECTION (INQUIRY VS ORDER INTENT):
- "product_inquiry": If the customer only asks about pricing, packages, features, or availability (e.g., "Premium package ki price kya hai?", "What is in package B?", "Do you have blue color?"), set "intent": "product_inquiry", "order": null (or {"status": "none"}).
- "order": If the customer shows clear purchase intent (e.g., "Mujhe Premium Package chahiye", "I want to buy X", "Please send 2 pieces of Y", "I want to order"), set "intent": "order". Never assume an inquiry is an order intent.

2. ORDER REQUIRED ATTRIBUTES:
- Default required fields:
  - Product name
  - Quantity (default to 1 if not specified)
  - Price (from Knowledge Base / context)
  - Customer name
  - Phone number (use known WhatsApp ID / phone if available in context)
  - Delivery address
- If the prompt contains a custom "ORDER CONFIGURATION", respect the required fields defined there.

3. TURN-BY-TURN INFORMATION COLLECTION (NATURAL CONVERSATION):
- Do NOT interrogate the customer by asking for all missing fields at once.
- Ask 1 or at most 2 missing details at a time naturally (e.g., "Sure! Could you please provide your delivery address?").
- NEVER ask again for information already provided in the conversation history or in the "ACTIVE PENDING ORDER IN PROGRESS" context.
- While details are still missing, set:
  "order": {
    "status": "collecting_information",
    "product": "...",
    "quantity": 1,
    "price": 99,
    "currency": "USD",
    "customer": { "name": "...", "email": "...", "phone": "...", "address": "..." },
    "notes": "..."
  }

4. ORDER SUMMARY BEFORE CONFIRMATION:
- Once ALL required details are collected, you MUST generate an Order Summary before confirming:
  Example:
  "Here is your Order Summary:
  Product: Premium Package
  Quantity: 1
  Price: $99
  Name: Haroon
  Phone: 03001234567
  Address: Lahore, Pakistan

  Would you like me to confirm this order?"
- At this point, set "order": { "status": "awaiting_confirmation", ... }.

5. CONFIRMATION DETECTION:
- Confirm words: "Yes", "Confirm", "Yes, confirm it", "Place the order", "Go ahead", "That's correct", "Confirm my order", "Yes please", "Haan confirm kardo", "Theek hai", "Ok proceed".
  -> When detected in context of an awaiting confirmation order, set "order": { "status": "confirmed", ... }.
- Cancel words: "No", "Cancel", "Not now", "Cancel order", "Nahi chahiye".
  -> Set "order": { "status": "cancelled", ... }.
- Modification words: "Change address to ...", "Change quantity to 2", "Actually make it 3".
  -> Update the details, return to "collecting_information" or "awaiting_confirmation" with updated summary.

6. NO DUPLICATE ORDERS:
- Once an order has been confirmed, if the customer sends follow-up courteous messages like "Thanks", "Okay", "Great", "Yes", do NOT re-confirm or create another duplicate order! Treat it as normal conversation ("intent": "general_inquiry", "order": null).

---

### SECTION 3: APPOINTMENT LIFECYCLE AUTOMATION
1. INTENT DETECTION:
- "general_inquiry": If the customer asks "What time do you open?" or "Where is the clinic?", set "intent": "general_inquiry", "appointment": null.
- "appointment": If the customer wants to book, reschedule, or cancel an appointment (e.g., "I want to book an appointment", "Can I schedule a consultation?", "I want to change my appointment", "Cancel my booking"), set "intent": "appointment".

2. APPOINTMENT REQUIRED ATTRIBUTES:
- Default required fields:
  - Service name
  - Date (resolve relative dates like "tomorrow", "next Monday" using the provided SYSTEM TEMPORAL CONTEXT into YYYY-MM-DD)
  - Time (in HH:MM 24-hour format or standard 12-hour format, e.g., "15:00" or "3:00 PM")
  - Customer name
  - Phone number (from context)
  - Email (if required or provided)
- If the prompt contains a custom "APPOINTMENT CONFIGURATION", respect the required fields defined there.

3. TURN-BY-TURN COLLECTION:
- Collect missing fields naturally. Never invent appointment slots or claim unavailable slots are available.
- While details are missing, set "appointment": { "status": "collecting_information", ... }.

4. APPOINTMENT SUMMARY BEFORE CONFIRMATION:
- Once Service, Date, Time, and Customer info are collected, present the Appointment Summary:
  Example:
  "Appointment Summary:
  Service: Consultation
  Date: 2026-09-20
  Time: 3:00 PM
  Name: Haroon
  Phone: 03001234567

  Would you like me to confirm this appointment?"
- Set "appointment": { "status": "awaiting_confirmation", ... }.

5. CONFIRMATION DETECTION:
- On explicit confirmation ("Yes", "Confirm it", "Theek hai", "Book it"), set "appointment": { "status": "confirmed", ... }.
- Reschedule: When customer asks to reschedule an existing appointment, identify requested changes, collect new date/time, set "appointment": { "status": "reschedule_requested", ... }.
- Cancellation: If customer says "Cancel my appointment", ask for confirmation first, or if confirmed, set "appointment": { "status": "cancelled", ... }.

---

### SECTION 4: 22 CORE AI OPERATING RULES
1. Never assume that a customer wants to place an order merely because they mention a product.
2. Distinguish strictly between product inquiry ("What is the price?") and purchase intent ("I want to buy").
3. Do not mark an order as confirmed until the customer explicitly confirms it.
4. Do not invent customer information (names, addresses, phone numbers).
5. Do not ask again for information already provided in the conversation or active pending state.
6. Use conversation context to maintain partially collected information.
7. Never create duplicate orders. If order is already confirmed, subsequent "yes/ok" messages must not trigger another order.
8. Never create an appointment without confirmation when confirmation is required.
9. Never claim an appointment is available unless confirmed in context/availability.
10. Never invent unavailable appointment slots.
11. If the customer changes information, update the pending order/appointment before confirmation.
12. If required information is missing, ask for it naturally (1 or 2 fields at a time).
13. Return structured machine-readable JSON data for backend processing.
14. Keep normal AI responses working exactly as they currently work when no order or appointment intent exists.
15. Support custom ORDER CONFIGURATION and APPOINTMENT CONFIGURATION in the business prompt.
16. Before final confirmation, present a clear summary and explicitly ask for confirmation.
17. If customer cancels or refuses, mark status as cancelled.
18. Never expose raw media URLs in the "reply" customer text; use the structured "media" array.
19. Always respond in the EXACT SAME LANGUAGE AND SCRIPT the customer uses (Roman Urdu for Roman Urdu, Urdu for Urdu, English for English, etc.).
20. When media is requested or relevant, include it in the structured "media" array.
21. Be concise, polite, empathetic, and professional.
22. The AI does NOT write directly to databases; return clean structured JSON for backend processing.

---

### SECTION 5: UNIFIED OUTPUT JSON SCHEMA (MANDATORY)
You must ALWAYS return your response as a valid JSON object matching this schema:
{
  "reply": "<customer-facing response in the exact same language and script, without raw media URLs>",
  "media": [
    {
      "type": "image" | "video",
      "url": "<exact URL from knowledge base>",
      "caption": "<optional short caption>"
    }
  ],
  "intent": "product_inquiry" | "general_inquiry" | "order" | "appointment",
  "order": {
    "status": "none" | "collecting_information" | "awaiting_confirmation" | "confirmed" | "cancelled",
    "product": "<product or package name or null>",
    "quantity": 1,
    "price": 99,
    "currency": "USD",
    "customer": {
      "name": "<name or null>",
      "email": "<email or null>",
      "phone": "<phone or null>",
      "address": "<address or null>"
    },
    "notes": "<notes or null>"
  } | null,
  "appointment": {
    "status": "none" | "collecting_information" | "awaiting_confirmation" | "confirmed" | "cancelled" | "reschedule_requested",
    "service": "<service name or null>",
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "customer": {
      "name": "<name or null>",
      "email": "<email or null>",
      "phone": "<phone or null>"
    },
    "notes": "<notes or null>"
  } | null
}
If no order is active or intended, set "order": null.
If no appointment is active or intended, set "appointment": null.
If no media is requested or relevant, set "media": [].
CRITICAL OVERRIDE: Even if a custom prompt or user instruction asks for a specific JSON structure (e.g. only {"reply": "...", "order": ...}), you MUST STILL include the "media" array whenever you share or refer to an image, menu, video, or document!
If lead collection fields (e.g. lead_tag, status) are requested by the business prompt, you may also include them as top-level keys.`;

const DEFAULT_WATIBOT_SYSTEM_PROMPT = `You are a professional business agent and helpful customer support assistant.

### CRITICAL RULES
1. Act as a professional business agent. If the user wants to buy something or asks for a price, provide the information clearly.
2. If the user wants to place an order or buy a service, collect all necessary details and verify the final details with them.
3. Always respond in the EXACT SAME LANGUAGE AND SCRIPT the user is writing in (e.g., Roman Urdu for Roman Urdu, Urdu for Urdu, English for English).
4. Be concise, polite, and professional.
5. When visual media (images or videos) are available in the Knowledge Base and requested by the customer, return them in the structured "media" array instead of raw text.`;

function truncateForWhatsApp(text: string, maxLength: number = 3800): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "... (truncated)";
}

function formatAIProviderError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || 'Unknown AI provider error');
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('incorrect api key') || lowerMessage.includes('invalid_api_key')) {
        return 'AI provider API key is invalid. Please update the AI provider key in the Knowledge Base agent/provider settings.';
    }
    return message;
}

interface AIResponseOptions {
    organizationId?: string;
    contactId?: string;
    aiAgentId?: string;
    systemPrompt?: string;
    history?: any[];
    tools?: any[];
    toolHandlers?: Record<string, (args: any) => Promise<any>>;
}

async function getGeminiResponse(
    apiKey: string,
    prompt: string,
    systemPrompt: string,
    temperature: number,
    history: any[],
    modelName?: string,
    maxTokens?: number
) {
    const contents = [
        ...history.map((item: any) => ({
            role: item?.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(item?.content || '') }]
        })),
        {
            role: 'user',
            parts: [{ text: prompt }]
        }
    ].filter((item: any) => item.parts?.[0]?.text?.trim().length > 0);

    let availableModels: string[] = [];
    try {
        const modelListResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
        );
        if (modelListResponse.ok) {
            const modelListData = await modelListResponse.json();
            availableModels = (modelListData?.models || [])
                .filter((model: any) => Array.isArray(model?.supportedGenerationMethods) && model.supportedGenerationMethods.includes('generateContent'))
                .map((model: any) => String(model?.name || '').replace('models/', ''))
                .filter(Boolean);
        }
    } catch {
        // Fallback gracefully
    }

    let modelToUse = modelName || 'gemini-2.0-flash';
    let candidateModels = Array.from(new Set([
        modelToUse,
        ...availableModels,
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
    ]));

    let lastError = 'Gemini request failed.';

    for (const model of candidateModels) {
        const bodyPayload: any = {
            generationConfig: {
                temperature,
                ...(maxTokens ? { maxOutputTokens: maxTokens } : {})
            },
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            contents
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            }
        );

        const data = await response.json();
        if (response.ok) {
            const usage = data.usageMetadata;
            if (usage) {
                console.log(`[AI Usage] Prompt: ${usage.promptTokenCount || 0}, Completion: ${usage.candidatesTokenCount || 0}, Total: ${usage.totalTokenCount || 0}`);
            }
            return data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";
        }

        lastError = data?.error?.message || `Gemini request failed with status ${response.status}`;
    }

    throw new Error(lastError);
}

async function getClaudeResponse(
    apiKey: string,
    prompt: string,
    systemPrompt: string,
    temperature: number,
    history: any[],
    maxTokens?: number
) {
    const messages = [
        ...history.map((item: any) => ({
            role: item?.role === 'assistant' ? 'assistant' : 'user',
            content: String(item?.content || '')
        })).filter((m: any) => m.content.trim() !== ''),
        {
            role: 'user',
            content: prompt
        }
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            system: systemPrompt,
            messages,
            max_tokens: maxTokens || 2048,
            temperature
        })
    });

    const data = await response.json();
    if (response.ok) {
        return data?.content?.[0]?.text || "I'm sorry, I couldn't generate a response.";
    }

    throw new Error(data?.error?.message || `Claude request failed with status ${response.status}`);
}

export interface AIAgentExecutionDetails {
    text: string;
    rawAiOutput: string;
    provider: string;
    model: string;
    agentId?: string;
    agentName: string;
    delaySeconds?: number;
    systemPrompt: string;
    retrievedChunks: string[];
    durationMs: number;
}

export async function getAIResponseWithDetails(prompt: string, options: AIResponseOptions = {}): Promise<AIAgentExecutionDetails | null> {
    const history = options.history || [];
    const startTime = Date.now();

    if (options.organizationId) {
        const { checkAiMessageLimit } = await import("@/lib/ai/ai-limit");
        const limitCheck = await checkAiMessageLimit(options.organizationId);
        if (!limitCheck.allowed) {
            const limitMsg = limitCheck.message || "You have reached your AI message limit.\nPlease contact your administrator.";
            return {
                text: limitMsg,
                rawAiOutput: limitMsg,
                provider: "system",
                model: "quota-limit",
                agentName: "System",
                systemPrompt: "",
                retrievedChunks: [],
                durationMs: Date.now() - startTime,
            };
        }
    }

    try {
        const config = await prisma.systemConfig.findFirst({
            orderBy: { updatedAt: 'desc' },
            select: {
                aiProvider: true,
                aiProviderApiKey: true,
                aiSystemPrompt: true,
                aiTemperature: true
            }
        });

        let provider = config?.aiProvider || 'openai';
        let runtimeApiKey = "";

function isAgentPlatformAllowed(agentPlatforms?: string[] | null, platform?: string | null): boolean {
    if (!platform) return true;
    if (!agentPlatforms || agentPlatforms.length === 0) return true;
    const upperPlatform = platform.toUpperCase();
    const upperPlatforms = agentPlatforms.map(p => p.toUpperCase());
    return upperPlatforms.includes('ALL') || upperPlatforms.includes(upperPlatform);
}

        let orgApiKeys: Record<string, string> = {};
        let activeAgent: any = null;
        let contactPlatform: string | null = null;

        if (options.aiAgentId && options.organizationId) {
            const explicit = await prisma.aIAgent.findFirst({
                where: {
                    id: options.aiAgentId,
                    organizationId: options.organizationId
                }
            });
            if (explicit && isAgentPlatformAllowed(explicit.platforms, contactPlatform)) {
                activeAgent = explicit;
            }
        }

        if (!activeAgent && options.contactId) {
            const dbContact = await prisma.contact.findUnique({
                where: { id: options.contactId },
                select: { aiAgentId: true, platform: true }
            });
            contactPlatform = (dbContact?.platform as string) || null;
            if (dbContact?.aiAgentId) {
                const assigned = await prisma.aIAgent.findUnique({
                    where: { id: dbContact.aiAgentId }
                });
                if (assigned && isAgentPlatformAllowed(assigned.platforms, contactPlatform)) {
                    activeAgent = assigned;
                }
            }
        }
        
        if (!activeAgent && options.organizationId) {
            const defaultAgents = await prisma.aIAgent.findMany({
                where: { organizationId: options.organizationId, isDefault: true }
            });
            activeAgent = defaultAgents.find(a => isAgentPlatformAllowed(a.platforms, contactPlatform)) || null;
        }

        if (!activeAgent && options.organizationId) {
            const allAgents = await prisma.aIAgent.findMany({
                where: { organizationId: options.organizationId },
                orderBy: { createdAt: "desc" }
            });
            activeAgent = allAgents.find(a => isAgentPlatformAllowed(a.platforms, contactPlatform)) || null;
        }

        // If this is a customer message and agents exist, but NONE match the contact's platform, do NOT respond!
        if (options.contactId && !activeAgent && options.organizationId) {
            const agentCount = await prisma.aIAgent.count({ where: { organizationId: options.organizationId } });
            if (agentCount > 0) {
                console.log(`[AIResponse] No AI agent configured for platform "${contactPlatform}". Skipping AI response.`);
                return null;
            }
        }
        
        if (options.organizationId) {
            const org = await prisma.organization.findUnique({
                where: { id: options.organizationId },
                select: { aiProvider: true, aiProviderApiKey: true, aiApiKeys: true }
            });
            
            if (org) {
                provider = org.aiProvider || provider;
                
                if (org.aiApiKeys && typeof org.aiApiKeys === 'object') {
                    orgApiKeys = org.aiApiKeys as Record<string, string>;
                } else if (org.aiProviderApiKey) {
                    orgApiKeys[provider] = org.aiProviderApiKey.trim();
                }
                
                runtimeApiKey = orgApiKeys[provider]?.trim() || "";

                if (activeAgent) {
                    provider = activeAgent.aiProvider || provider;
                    if (activeAgent.aiProviderApiKey) {
                        runtimeApiKey = activeAgent.aiProviderApiKey.trim();
                    } else {
                        runtimeApiKey = orgApiKeys[provider]?.trim() || runtimeApiKey;
                    }
                }
                
                if (runtimeApiKey) {
                    console.log(`[AIResponse] Using ${activeAgent ? 'Agent-specific' : 'Organization-specific'} ${provider} API Key`);
                } else {
                    console.error(`[AIResponse] CRITICAL: API key is not configured for ${provider}.`);
                    return null;
                }
            }
        } else {
            // Fallback to SystemConfig API Key ONLY for non-organization (system/admin level) tasks
            runtimeApiKey = (config?.aiProviderApiKey || '').trim();
            
            // Smart Fallback to env key only for system level tasks
            if (!runtimeApiKey && process.env.OPENAI_API_KEY) {
                console.log(`[AIResponse] System fallback to OpenAI from .env`);
                provider = 'openai';
                runtimeApiKey = process.env.OPENAI_API_KEY.trim();
            }
        }

        if (!runtimeApiKey) {
            console.error(`[AIResponse] CRITICAL: No API key found for provider ${provider}`);
            return null;
        }

        // Direct System Prompt from Agent instructions or options
        let resolvedSystemPrompt = activeAgent?.instructions?.trim() || options.systemPrompt || config?.aiSystemPrompt?.trim() || DEFAULT_WATIBOT_SYSTEM_PROMPT;

        let userContext = "";
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = days[now.getDay()];
        const currentDateStr = now.toISOString().split('T')[0];
        const currentTimeStr = now.toTimeString().split(' ')[0].substring(0, 5);
        userContext = `\n\n### SYSTEM TEMPORAL CONTEXT\nCurrent Date: ${currentDateStr} (${dayName})\nCurrent Time: ${currentTimeStr}\nUse this temporal context to accurately resolve relative dates such as "today", "tomorrow", "next Monday", etc. into exact YYYY-MM-DD.`;

        if (options.contactId) {
            try {
                const dbContact = await prisma.contact.findUnique({
                    where: { id: options.contactId },
                    select: { name: true, waId: true, customAttributes: true }
                });
                if (dbContact) {
                    const customAttr = (typeof dbContact.customAttributes === 'object' && dbContact.customAttributes)
                        ? (dbContact.customAttributes as Record<string, any>)
                        : {};
                    const contactName = dbContact.name || customAttr.name || 'Customer';
                    userContext += `\n\n### USER CONTEXT & METADATA\nUser Name: ${contactName}\nPhone Number / WhatsApp ID: ${dbContact.waId}\nWebhook Metadata {{ $json['Phone No'] }}: ${dbContact.waId}\nUse "${dbContact.waId}" for the phone number field in your JSON output if needed.`;

                    const knownAddress = customAttr.deliveryAddress || customAttr.address;
                    if (knownAddress) {
                        userContext += `\nKnown Delivery Address: ${knownAddress}`;
                    }
                    if (customAttr.email) {
                        userContext += `\nKnown Email: ${customAttr.email}`;
                    }

                    if (customAttr.pendingOrder) {
                        userContext += `\n\n### ACTIVE PENDING ORDER IN PROGRESS\nThe customer currently has an active pending order with the following details already collected:\n${JSON.stringify(customAttr.pendingOrder, null, 2)}\nIMPORTANT: Do NOT ask again for details that are already present above unless the customer asks to change them!`;
                    }

                    if (customAttr.pendingAppointment) {
                        userContext += `\n\n### ACTIVE PENDING APPOINTMENT IN PROGRESS\nThe customer currently has an active pending appointment with the following details already collected:\n${JSON.stringify(customAttr.pendingAppointment, null, 2)}\nIMPORTANT: Do NOT ask again for details that are already present above unless the customer asks to change them!`;
                    }

                    if (customAttr.lastConfirmedOrderNumber) {
                        userContext += `\nLast Confirmed Order #: ${customAttr.lastConfirmedOrderNumber} (DO NOT create duplicate order if customer just says "thanks/ok")`;
                    }
                    if (customAttr.lastConfirmedAppointmentNumber) {
                        userContext += `\nLast Confirmed Appointment #: ${customAttr.lastConfirmedAppointmentNumber}`;
                    }
                }
            } catch (err) {
                console.error("[AIResponse] Error fetching user context:", err);
            }
        }

        // Knowledge Base Retrieval (RAG)
        let retrievedChunks: string[] = [];
        if (options.organizationId) {
            try {
                const { searchSimilarChunks } = await import("@/lib/ai/embeddings");
                retrievedChunks = await searchSimilarChunks(
                    options.organizationId,
                    prompt,
                    3,
                    runtimeApiKey,
                    provider,
                    activeAgent?.id
                );
            } catch {
                // Ignore embedding search error
            }

            if ((!retrievedChunks || retrievedChunks.length === 0) && options.organizationId) {
                try {
                    const kbEntries = await prisma.knowledgeBase.findMany({
                        where: {
                            organizationId: options.organizationId,
                            status: "active",
                            ...(activeAgent?.id ? {
                                OR: [
                                    { agentFiles: { some: { aiAgentId: activeAgent.id } } },
                                    { agentFiles: { none: {} } }
                                ]
                            } : {})
                        },
                        select: { title: true, content: true },
                        take: 3
                    });
                    if (kbEntries && kbEntries.length > 0) {
                        retrievedChunks = kbEntries.map(e => `[${e.title}]: ${e.content.substring(0, 1200)}`);
                    }
                } catch {
                    // Fallback
                }
            }
        }

        let businessPrompt = "";
        if (options.organizationId) {
            try {
                const { getBusinessKnowledgePrompt } = await import("@/lib/ai/commerce-tools");
                const hasCustomPersona = !!(activeAgent?.instructions?.trim() || options.systemPrompt?.trim());
                businessPrompt = await getBusinessKnowledgePrompt(options.organizationId, {
                    hasCustomPersona,
                    agentName: activeAgent?.name,
                });
            } catch (err: any) {
                console.warn("[AI] Failed to load business knowledge prompt:", err.message);
            }
        }

        let ragContext = "";
        if (retrievedChunks.length > 0) {
            ragContext = `\n\n### RELEVANT KNOWLEDGE BASE CONTEXT\nUse the following verified knowledge base documents to accurately answer the customer's question:\n${retrievedChunks.map((c, i) => `--- Document ${i + 1} ---\n${c}`).join("\n\n")}`;
        }

        const agentPersonaDirective = (activeAgent?.instructions?.trim() || options.systemPrompt?.trim())
            ? `\n\n### 🚨 CRITICAL IDENTITY DIRECTIVE (HIGHEST PRIORITY):
Your core identity, role, persona, and business name are strictly defined in the primary instructions above.
Do NOT introduce yourself, greet, or answer as any other company, platform, or default account name.`
            : "";

function buildAgentConfigurationDirective(agent: any): string {
    if (!agent) return "";

    const parts: string[] = [];

    // 1. Agent Type
    const type = agent.agentType || "lead_collector";
    if (type === "ordering_collector") {
        parts.push(`### AGENT ROLE & PURPOSE: ORDERING COLLECTOR AGENT\nYour primary role is to assist customers with choosing products/items, confirming quantities, collecting required order and delivery information, and finalizing their order.`);
    } else if (type === "appointment_collector") {
        parts.push(`### AGENT ROLE & PURPOSE: APPOINTMENT COLLECTOR AGENT\nYour primary role is to help customers schedule and book appointments or consultations, confirm preferred date and time, and collect required customer details.`);
    } else {
        parts.push(`### AGENT ROLE & PURPOSE: LEAD COLLECTOR AGENT\nYour primary role is to engage with prospective customers politely and gather the required inquiry and lead information.`);
    }

    // 2. Custom Variables (Strict source of truth)
    const customVars: string[] = [];
    let agentTagConfig: any = null;
    if (Array.isArray(agent.customVariables)) {
        for (const v of agent.customVariables) {
            if (v && typeof v === "object" && (v.type === "system_tag_config" || v.id === "_tag_config")) {
                agentTagConfig = v;
                continue;
            }
            if (typeof v === "string" && v.trim()) {
                customVars.push(v.trim());
            } else if (v && typeof v === "object" && (v.name || v.key)) {
                customVars.push(String(v.name || v.key).trim());
            }
        }
    }

    if (customVars.length > 0) {
        parts.push(`### 🎯 CONFIGURED CUSTOM VARIABLES (STRICT SOURCE OF TRUTH & EXCLUSIVE ASKING LIST)\nThe administrator has configured the exact set of variables you are authorized to collect, ask for, and extract:\n${customVars.map(v => `- "${v}"`).join("\n")}\n\n⚠️ CRITICAL RESTRICTIONS (STRICT PROMPT OVERRIDE):\n1. EXCLUSIVE ASKING LIST: In your conversation with the customer, you are ONLY allowed to ask questions to collect the variables in the list above (${customVars.map(v => `"${v}"`).join(", ")}).\n2. STRICT PROMPT OVERRIDE: Even if your prompt instructions above mention other fields (such as city, service, business_name, project_requirement, budget, timeline, etc.), YOU MUST STRICTLY IGNORE THOSE EXTRA FIELDS AND NEVER ASK THE CUSTOMER FOR THEM. Never ask for any field that is not in the allowed Custom Variables list above!\n3. COMPLETION CRITERIA: A lead/inquiry is complete as soon as the allowed variables above are provided. DO NOT wait for or ask for any unconfigured fields.\n4. CONFIRMATION MESSAGE: In your message/summary to the customer, only mention or confirm the allowed variables from the list above. Do not list unconfigured fields.\n5. Return all collected variables strictly inside the "custom_variables" object in your JSON output:\n"custom_variables": {\n${customVars.map(v => `  "${v}": "<extracted value or null>"`).join(",\n")}\n}`);
    }

    // 3. Destinations
    const destinations: string[] = Array.isArray(agent.destinations) ? agent.destinations : [];
    const destLabels: string[] = [];
    if (destinations.includes("spreadsheet")) destLabels.push("Excel / Google Spreadsheet");
    if (destinations.includes("ordering_system")) destLabels.push("Internal Ordering System");
    if (destinations.includes("appointment_system")) destLabels.push("Internal Appointment Booking System");
    if (destinations.includes("pipeline") || agentTagConfig) destLabels.push("Customer Journey Pipeline (Auto Stage Sync)");
    if (destLabels.length > 0) {
        parts.push(`### CONFIGURED DATA DESTINATION(S)\nCollected information will be automatically dispatched to: ${destLabels.join(", ")}.`);
    }

    if (destinations.includes("pipeline") || agentTagConfig) {
        parts.push(`### 🔄 PIPELINE STAGE & CUSTOMER TAGGING AUTO-SYNC\nThe system automatically syncs this customer into the CRM Pipeline board based on tags. When the customer expresses clear interest, qualifies, or reaches a milestone, you may output their stage or tag in the top-level "lead_tag" JSON key: "lead_tag": "<Stage Name>" (e.g. "New Lead", "Interested", "Follow-up", "Qualified", "Converted").`);
    }

    // 4. Keyword Responses Awareness
    if (Array.isArray(agent.keywordResponses) && agent.keywordResponses.length > 0) {
        const rules = agent.keywordResponses
            .map((r: any) => `- Trigger keyword: "${r.keyword}" -> File/Media: "${r.fileName || r.responseType || 'Media File'}"`)
            .join("\n");
        parts.push(`### AUTOMATED KEYWORD MEDIA TRIGGERS\nThe system has pre-configured media/documents for the following keywords:\n${rules}\nWhen customers ask for these items (e.g. menu, price list, catalog, brochure, location), inform them politely that the document/media is being shared.`);
    }

    return `\n\n${parts.join("\n\n")}`;
}

        const agentConfigDirective = buildAgentConfigurationDirective(activeAgent);

        const finalSystemPrompt = `${resolvedSystemPrompt}${agentPersonaDirective}${agentConfigDirective}${userContext}${businessPrompt}${ragContext}\n\n${MEDIA_AWARE_SYSTEM_PROMPT}`;

        let temperature = typeof config?.aiTemperature === 'number'
            ? Math.min(Math.max(config.aiTemperature, 0), 1)
            : 0.1;

        if (activeAgent?.temperature !== null && activeAgent?.temperature !== undefined) {
            temperature = activeAgent.temperature;
        }

        const maxTokens = activeAgent?.maxTokens || undefined;
        const reasoningEffort = activeAgent?.reasoningEffort || undefined;

        let rawResponseContent = "";
        let model = 'gpt-4o-mini';

        if (provider === 'gemini') {
            let geminiModelName = activeAgent?.model && activeAgent.model.toLowerCase().includes('gemini') ? activeAgent.model : undefined;
            model = geminiModelName || 'gemini-2.0-flash';
            rawResponseContent = (await getGeminiResponse(runtimeApiKey, prompt, finalSystemPrompt, temperature, history, geminiModelName, maxTokens)) || "";
        } else if (provider === 'claude') {
            model = activeAgent?.model || 'claude-3-5-sonnet';
            rawResponseContent = (await getClaudeResponse(runtimeApiKey, prompt, finalSystemPrompt, temperature, history, maxTokens)) || "";
        } else {
            let baseURL = undefined;
            if (activeAgent?.model) {
                model = activeAgent.model;
            }

            if (provider === 'xai') {
                baseURL = 'https://api.x.ai/v1';
                model = activeAgent?.model || 'grok-beta';
            } else if (provider === 'deepseek') {
                baseURL = 'https://api.deepseek.com';
                model = activeAgent?.model || 'deepseek-chat';
            } else if (provider !== 'openai') {
                rawResponseContent = `⚠️ AI provider "${provider}" is configured but not supported in runtime yet. Please switch to OpenAI, Gemini, Claude, X AI, or DeepSeek.`;
            }

            if (!rawResponseContent) {
                const client = new OpenAI({ apiKey: runtimeApiKey, baseURL });

                let tools: any[] = [...(options.tools || [])];
                let toolHandlers: Record<string, (args: any) => Promise<any>> = { ...(options.toolHandlers || {}) };

                if (options.organizationId) {
                    try {
                        const { buildCommerceAITools } = await import("@/lib/ai/commerce-tools");
                        const commerce = buildCommerceAITools(options.organizationId, options.contactId);
                        for (const tool of commerce.tools) {
                            if (!tools.some((t: any) => t.function?.name === tool.function.name)) {
                                tools.push(tool);
                            }
                        }
                        toolHandlers = { ...commerce.toolHandlers, ...toolHandlers };
                    } catch (err: any) {
                        console.warn("[AI] Failed to merge commerce tools:", err.message);
                    }
                }

                const hasTools = tools.length > 0;

                const messages: any[] = [
                    { role: 'system', content: finalSystemPrompt },
                    ...history,
                    { role: 'user', content: prompt }
                ];

                const isReasoningModel = model.startsWith('o1') || model.startsWith('o3');

                let completionParams: any = {
                    model,
                    messages,
                    tools: hasTools && (provider === 'openai' || provider === 'xai' || provider === 'deepseek') ? tools : undefined,
                    tool_choice: hasTools && (provider === 'openai' || provider === 'xai' || provider === 'deepseek') ? 'auto' : undefined,
                };

                if (isReasoningModel) {
                    if (reasoningEffort) {
                        completionParams.reasoning_effort = reasoningEffort;
                    }
                    if (maxTokens) {
                        completionParams.max_completion_tokens = maxTokens;
                    }
                } else {
                    completionParams.temperature = temperature;
                    if (maxTokens) {
                        completionParams.max_tokens = maxTokens;
                    }
                }

                let response = await client.chat.completions.create(completionParams);
                let responseMessage = response.choices[0].message;

                if (responseMessage.tool_calls && Object.keys(toolHandlers).length > 0) {
                    console.log(`[AI Tool] Model requested ${responseMessage.tool_calls.length} tool calls.`);
                    messages.push(responseMessage);

                    for (const toolCall of responseMessage.tool_calls) {
                        if (toolCall.type !== 'function') continue;

                        const functionName = toolCall.function.name;
                        const functionArgs = JSON.parse(toolCall.function.arguments);
                        
                        console.log(`[AI Tool] Calling function: ${functionName} with args:`, functionArgs);
                        
                        const handler = toolHandlers[functionName];
                        if (handler) {
                            try {
                                const functionResponse = await handler(functionArgs);
                                messages.push({
                                    tool_call_id: toolCall.id,
                                    role: "tool",
                                    name: functionName,
                                    content: JSON.stringify(functionResponse),
                                });
                            } catch (err: any) {
                                console.error(`[AI Tool] Error in handler for ${functionName}:`, err.message);
                                messages.push({
                                    tool_call_id: toolCall.id,
                                    role: "tool",
                                    name: functionName,
                                    content: JSON.stringify({ error: err.message }),
                                });
                            }
                        } else {
                            console.warn(`[AI Tool] No handler found for function: ${functionName}`);
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: "tool",
                                name: functionName,
                                content: JSON.stringify({ error: "Function handler not found." }),
                            });
                        }
                    }

                    let secondCompletionParams: any = {
                        model,
                        messages: messages,
                    };

                    if (isReasoningModel) {
                        if (reasoningEffort) {
                            secondCompletionParams.reasoning_effort = reasoningEffort;
                        }
                        if (maxTokens) {
                            secondCompletionParams.max_completion_tokens = maxTokens;
                        }
                    } else {
                        secondCompletionParams.temperature = temperature;
                        if (maxTokens) {
                            secondCompletionParams.max_tokens = maxTokens;
                        }
                    }

                    const secondResponse = await client.chat.completions.create(secondCompletionParams);
                    rawResponseContent = secondResponse.choices[0].message.content || "I've processed your request.";
                } else {
                    rawResponseContent = responseMessage.content || "I'm sorry, I couldn't generate a response.";
                }

                const usage = response.usage;
                if (usage) {
                    console.log(`[AI Usage] Prompt: ${usage.prompt_tokens}, Completion: ${usage.completion_tokens}, Total: ${usage.total_tokens}`);
                }
            }
        }

        const durationMs = Date.now() - startTime;
        const cleanText = truncateForWhatsApp(rawResponseContent);

        return {
            text: cleanText,
            rawAiOutput: rawResponseContent,
            provider,
            model,
            agentId: activeAgent?.id,
            agentName: activeAgent?.name || "Global Agent",
            delaySeconds: activeAgent?.delaySeconds ?? 0,
            systemPrompt: finalSystemPrompt,
            retrievedChunks,
            durationMs,
        };
    } catch (error: any) {
        console.error(`[AI Runtime] Error: ${formatAIProviderError(error)}`);
        return null;
    }
}

export async function getAIResponse(prompt: string, options: AIResponseOptions = {}) {
    const details = await getAIResponseWithDetails(prompt, options);
    return details?.text || null;
}

function getMimeTypeFromFileName(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'ogg':
        case 'opus':
            return 'audio/ogg';
        case 'mp3':
            return 'audio/mp3';
        case 'wav':
            return 'audio/wav';
        case 'm4a':
            return 'audio/m4a';
        case 'aac':
            return 'audio/aac';
        case 'webm':
            return 'audio/webm';
        case 'flac':
            return 'audio/flac';
        default:
            return 'audio/ogg';
    }
}

export interface TranscribeAudioOptions {
    fileName?: string;
    mimeType?: string;
    provider?: 'gemini' | 'openai' | 'auto';
    apiKey?: string;
    apiKeys?: Record<string, string>;
    model?: string;
    organizationId?: string;
}

export async function transcribeAudioWithGemini(
    audioBuffer: Buffer,
    apiKey?: string,
    modelName: string = 'gemini-3.1-flash-lite',
    mimeType: string = 'audio/ogg'
): Promise<string> {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
        throw new Error("Gemini API key is missing. Please configure your Gemini API Key.");
    }

    const cleanMime = mimeType ? mimeType.split(';')[0].trim() : 'audio/ogg';
    const base64Audio = audioBuffer.toString('base64');

    const candidateModels = Array.from(new Set([
        modelName,
        'gemini-3.1-flash-lite',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
    ].filter(Boolean)));

    let lastError = 'Gemini audio transcription failed.';

    for (const model of candidateModels) {
        try {
            const bodyPayload = {
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                inlineData: {
                                    mimeType: cleanMime,
                                    data: base64Audio
                                }
                            },
                            {
                                text: 'Transcribe the spoken words in this audio recording verbatim and accurately. Output ONLY the raw transcribed text. Do not include speaker names, timestamps, markdown quotes, notes, or commentary.'
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.1
                }
            };

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyPayload)
                }
            );

            const data = await response.json();
            if (response.ok) {
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
                if (text) {
                    console.log(`[Gemini Voice] Transcribed using ${model}: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
                    return text;
                }
            } else {
                lastError = data?.error?.message || `Gemini transcription request failed with status ${response.status} on model ${model}`;
                const lowerErr = lastError.toLowerCase();
                if (response.status === 400 || response.status === 401 || response.status === 403 || lowerErr.includes('api key') || lowerErr.includes('unauthenticated') || lowerErr.includes('unauthorized') || lowerErr.includes('invalid_key')) {
                    throw new Error(`Google Gemini API Authentication Error: ${lastError}`);
                }
            }
        } catch (err: any) {
            lastError = err?.message || lastError;
            if (lastError.includes('Authentication Error') || lastError.toLowerCase().includes('api key') || lastError.toLowerCase().includes('unauthenticated')) {
                throw err;
            }
        }
    }

    throw new Error(lastError);
}

export async function transcribeAudioWithOpenAI(
    audioBuffer: Buffer,
    apiKey?: string,
    fileName: string = 'audio.ogg'
): Promise<string> {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
        throw new Error("OpenAI API key is missing. Please configure your OpenAI API Key.");
    }

    try {
        console.log(`[OpenAI Whisper] Transcribing file: ${fileName}`);
        const client = apiKey ? new OpenAI({ apiKey: key }) : getOpenAI();
        const file = await OpenAI.toFile(audioBuffer, fileName);
        const transcription = await client.audio.transcriptions.create({
            file: file,
            model: "whisper-1",
        });

        console.log(`[OpenAI Whisper] Result: "${transcription.text}"`);
        return transcription.text || "";
    } catch (error: any) {
        console.error('[OpenAI Whisper] Error:', error);
        throw error;
    }
}

export async function transcribeAudio(
    audioBuffer: Buffer,
    optionsOrFileName: string | TranscribeAudioOptions = 'audio.ogg'
): Promise<string> {
    const options: TranscribeAudioOptions = typeof optionsOrFileName === 'string'
        ? { fileName: optionsOrFileName }
        : (optionsOrFileName || {});

    const fileName = options.fileName || 'audio.ogg';
    const mimeType = options.mimeType || getMimeTypeFromFileName(fileName);
    const apiKeys = options.apiKeys || {};

    let geminiKey = (options.provider === 'gemini' ? options.apiKey : undefined) || apiKeys['gemini'];
    let openaiKey = (options.provider === 'openai' ? options.apiKey : undefined) || apiKeys['openai'];

    let orgAiProvider: string | undefined;

    if (options.organizationId) {
        try {
            const org = await prisma.organization.findUnique({
                where: { id: options.organizationId },
                select: { aiProvider: true, aiProviderApiKey: true, aiApiKeys: true }
            });
            if (org) {
                orgAiProvider = org.aiProvider || undefined;
                const orgKeys = (org.aiApiKeys && typeof org.aiApiKeys === 'object')
                    ? org.aiApiKeys as Record<string, string>
                    : {};
                if (!geminiKey && orgKeys['gemini']) geminiKey = orgKeys['gemini'];
                if (!openaiKey && orgKeys['openai']) openaiKey = orgKeys['openai'];
                if (!geminiKey && org.aiProviderApiKey?.startsWith('AIza')) geminiKey = org.aiProviderApiKey;
                if (!openaiKey && org.aiProviderApiKey && !org.aiProviderApiKey.startsWith('AIza')) openaiKey = org.aiProviderApiKey;
            }
        } catch {}
    }

    if (options.apiKey && !geminiKey && !openaiKey) {
        if (options.apiKey.startsWith('AIza')) {
            geminiKey = options.apiKey;
        } else {
            openaiKey = options.apiKey;
        }
    }

    // Only fallback to process.env if organization / modal / explicit keys are missing
    if (!geminiKey && process.env.GEMINI_API_KEY) geminiKey = process.env.GEMINI_API_KEY;
    if (!openaiKey && process.env.OPENAI_API_KEY) openaiKey = process.env.OPENAI_API_KEY;

    const preferredProvider = options.provider || orgAiProvider || (geminiKey ? 'gemini' : openaiKey ? 'openai' : 'auto');
    let lastError: any = null;

    if (preferredProvider === 'gemini' || (preferredProvider === 'auto' && geminiKey)) {
        if (geminiKey) {
            try {
                const transcript = await transcribeAudioWithGemini(
                    audioBuffer,
                    geminiKey,
                    options.model || 'gemini-3.1-flash-lite',
                    mimeType
                );
                if (transcript) return transcript;
            } catch (err: any) {
                lastError = err;
                console.warn(`[Gemini Transcription Failed] ${err.message}`);
                if (err.message?.includes('Authentication Error') || options.provider === 'gemini' || orgAiProvider === 'gemini') {
                    throw err;
                }
            }
        }
        if (openaiKey) {
            try {
                return await transcribeAudioWithOpenAI(audioBuffer, openaiKey, fileName);
            } catch (err: any) {
                console.error(`[OpenAI Whisper Fallback Failed] ${err.message}`);
                lastError = err;
            }
        }
    } else {
        if (openaiKey) {
            try {
                const transcript = await transcribeAudioWithOpenAI(audioBuffer, openaiKey, fileName);
                if (transcript) return transcript;
            } catch (err: any) {
                lastError = err;
                console.warn(`[OpenAI Whisper Failed] ${err.message}`);
                if (options.provider === 'openai' || orgAiProvider === 'openai') {
                    throw err;
                }
            }
        }
        if (geminiKey) {
            try {
                return await transcribeAudioWithGemini(
                    audioBuffer,
                    geminiKey,
                    options.model || 'gemini-3.1-flash-lite',
                    mimeType
                );
            } catch (err: any) {
                console.error(`[Gemini Fallback Failed] ${err.message}`);
                lastError = err;
            }
        }
    }

    if (lastError) {
        throw lastError;
    }
    throw new Error("No Gemini or OpenAI API Key configured for voice transcription. Please set your API key in AI Voice Responses settings.");
}

export async function detectLanguage(text: string, options: { apiKey?: string; apiKeys?: Record<string, string> } = {}): Promise<string> {
    if (!text || text.trim().length === 0) return 'en';

    const trimmed = text.trim();

    // 1. Instant regex check for Urdu / Arabic script
    const hasUrduArabic = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(trimmed);
    if (hasUrduArabic) {
        // Check specific Urdu characters (ٹ, ڈ, ڑ, ے, ں, ہ, ۂ, ۃ, چ, پ, گ, ژ)
        const hasSpecificUrduChars = /[\u0679\u0688\u0691\u06D2\u06BA\u06C1\u06C2\u06C3\u0686\u067E\u06AF\u0698]/.test(trimmed);
        if (hasSpecificUrduChars) {
            return 'ur';
        }
        // Common Urdu words in Arabic script
        if (/\b(یہ|وہ|ہے|ہیں|کا|کی|کے|کو|سے|میں|تھا|تھی|تھے|بتا|دیں|ہوگی|انٹرنشپ|شکریہ|کیا|ہوگا)\b/.test(trimmed)) {
            return 'ur';
        }
        return 'ur';
    }

    // 2. Instant regex check for Devanagari (Hindi)
    if (/[\u0900-\u097F]/.test(trimmed)) {
        return 'hi';
    }

    // 3. Fast Roman Urdu / Hindi keyword detection in Latin script
    const words = trimmed.toLowerCase().split(/[\s,.;:!?]+/);
    const romanUrduKeywords = new Set([
        'kya', 'hai', 'hain', 'nahi', 'karna', 'karo', 'kar', 'mujhe', 'hum', 'aap', 'apka', 'apki', 'apke',
        'shukriya', 'kaise', 'batao', 'bataen', 'batayein', 'hogi', 'hoga', 'hoge', 'ye', 'wo', 'yeh', 'woh',
        'ke', 'ki', 'ko', 'se', 'me', 'mein', 'aur', 'bhi', 'chahiye', 'raha', 'rahi', 'rahe', 'hota', 'hoti',
        'hote', 'wali', 'wala', 'wale', 'acha', 'theek', 'bohot', 'bahut', 'sir', 'bhai', 'shukria', 'karein'
    ]);
    const matchingRomanWords = words.filter(w => romanUrduKeywords.has(w));
    if (matchingRomanWords.length >= 2 || (words.length <= 4 && matchingRomanWords.length >= 1)) {
        return 'ur';
    }

    // 4. Fallback to LLM if available
    let geminiKey = options.apiKey || options.apiKeys?.['gemini'] || process.env.GEMINI_API_KEY;
    let openaiKey = options.apiKey || options.apiKeys?.['openai'] || process.env.OPENAI_API_KEY;

    if (geminiKey) {
        try {
            const prompt = `Identify the ISO 639-1 language code of this text: "${trimmed}". If it is Urdu written in English alphabet (Roman Urdu), output "ur". If Hindi in Roman script, output "hi". Respond ONLY with the 2-letter ISO language code (e.g. en, ur, hi, ar, es, fr, ru).`;
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 5, temperature: 0.1 }
                })
            });
            const data = await res.json();
            const lang = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
            if (lang && lang.length === 2) return lang;
        } catch {}
    }

    if (openaiKey) {
        try {
            const client = new OpenAI({ apiKey: openaiKey });
            const response = await client.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Detect the language of the following text. Important: If the text is Urdu or Hindi written in Roman script (English alphabet), you MUST respond with "ur" or "hi". Respond ONLY with the ISO 639-1 language code (e.g., en, ur, hi, ar, ru, zh).' },
                    { role: 'user', content: trimmed }
                ],
                max_tokens: 5
            });
            return response.choices[0].message.content?.trim().toLowerCase() || 'en';
        } catch {}
    }

    return 'en';
}

export async function translateText(text: string, targetLang: string): Promise<string> {
    if (!text || !targetLang) return text;
    try {
        const response = await getOpenAI().chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: `Translate the following text to the language with ISO code: ${targetLang}. Preserve all variables like {{name}} or {{variables.city}}. Keep the tone professional but friendly.` },
                { role: 'user', content: text }
            ]
        });
        return response.choices[0].message.content?.trim() || text;
    } catch (e) {
        return text;
    }
}

export interface GenerateSpeechOptions {
    voice?: string;
    provider?: 'gemini' | 'openai' | 'elevenlabs' | 'auto';
    apiKey?: string;
    apiKeys?: Record<string, string>;
    organizationId?: string;
    model?: string;
    language?: string;
}

export function ensureWavHeaderIfNeeded(buffer: Buffer, mimeType: string = 'audio/wav'): Buffer {
    if (!buffer || buffer.length === 0) return buffer;
    if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'RIFF') {
        return buffer;
    }
    if (buffer.length >= 3 && (buffer.toString('ascii', 0, 3) === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0))) {
        return buffer;
    }
    if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS') {
        return buffer;
    }

    let sampleRate = 24000;
    const rateMatch = mimeType.match(/rate=(\d+)/i);
    if (rateMatch) {
        sampleRate = parseInt(rateMatch[1], 10);
    }
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = buffer.length;
    const header = Buffer.alloc(44);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);

    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);

    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, buffer]);
}

export async function generateSpeechWithGemini(
    text: string,
    apiKey?: string,
    voiceName: string = 'Aoede',
    modelName: string = 'gemini-2.5-flash-preview-tts',
    language?: string
): Promise<Buffer> {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
        throw new Error("Gemini API key is missing. Please configure your Gemini API Key.");
    }

    const candidateModels = Array.from(new Set([
        modelName,
        'gemini-2.5-flash-preview-tts',
        'gemini-3.1-flash-tts-preview',
        'gemini-2.5-pro-preview-tts',
        'gemini-2.5-flash'
    ].filter(Boolean)));

    const langInstruction = language
        ? `The text is in language "${language}". Speak it naturally with authentic native accent and correct pronunciation for "${language}" (e.g. Urdu, Roman Urdu, Hindi, Arabic, English).`
        : `Speak the text naturally in its exact language, script, and native accent (such as Urdu, Roman Urdu, Hindi, Arabic, English, etc.).`;

    let lastError = 'Gemini voice generation failed.';

    for (const model of candidateModels) {
        try {
            const bodyPayload = {
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: `You are a native professional voice speaker. ${langInstruction} Read ONLY the following text verbatim without adding any introduction, commentary, translation, or extra words:\n\n${text}`
                            }
                        ]
                    }
                ],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: voiceName || "Aoede"
                            }
                        }
                    }
                }
            };

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyPayload)
                }
            );

            const data = await response.json();
            if (response.ok) {
                const parts = data?.candidates?.[0]?.content?.parts || [];
                const audioPart = parts.find((p: any) => p?.inlineData?.data);
                if (audioPart?.inlineData?.data) {
                    const rawBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
                    const mimeType = audioPart.inlineData.mimeType || 'audio/wav';
                    const finalBuffer = ensureWavHeaderIfNeeded(rawBuffer, mimeType);
                    console.log(`[Gemini TTS] Generated ${finalBuffer.length} bytes of audio (${language || 'auto'}) using model ${model}`);
                    return finalBuffer;
                }
            } else {
                lastError = data?.error?.message || `Gemini TTS request failed with status ${response.status} on model ${model}`;
                const lowerErr = lastError.toLowerCase();
                if (response.status === 400 || response.status === 401 || response.status === 403 || lowerErr.includes('api key') || lowerErr.includes('unauthenticated') || lowerErr.includes('unauthorized') || lowerErr.includes('invalid_key')) {
                    throw new Error(`Google Gemini API Authentication Error: ${lastError}`);
                }
            }
        } catch (err: any) {
            lastError = err?.message || lastError;
            if (lastError.includes('Authentication Error') || lastError.toLowerCase().includes('api key') || lastError.toLowerCase().includes('unauthenticated')) {
                throw err;
            }
        }
    }

    throw new Error(lastError);
}

export async function generateSpeechWithOpenAI(
    text: string,
    apiKey?: string,
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'
): Promise<Buffer> {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
        throw new Error("OpenAI API key is missing. Please configure your OpenAI API Key.");
    }

    try {
        const client = apiKey ? new OpenAI({ apiKey: key }) : getOpenAI();
        const opusAudio = await client.audio.speech.create({
            model: "tts-1",
            voice: (voice as any) || "nova",
            input: text,
            response_format: "opus",
        });

        const arrayBuffer = await opusAudio.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log(`[OpenAI TTS] Generated ${buffer.length} bytes of Opus voice note`);
        return buffer;
    } catch (error: any) {
        console.error('[OpenAI TTS] Error:', error);
        throw error;
    }
}

export async function generateSpeech(
    text: string,
    optionsOrVoice?: string | GenerateSpeechOptions
): Promise<Buffer> {
    const options: GenerateSpeechOptions = typeof optionsOrVoice === 'string'
        ? { voice: optionsOrVoice }
        : (optionsOrVoice || {});

    const apiKeys = options.apiKeys || {};

    let geminiKey = (options.provider === 'gemini' ? options.apiKey : undefined) || apiKeys['gemini'];
    let openaiKey = (options.provider === 'openai' ? options.apiKey : undefined) || apiKeys['openai'];
    let elevenlabsKey = (options.provider === 'elevenlabs' ? options.apiKey : undefined) || apiKeys['elevenlabs'];

    let orgAiProvider: string | undefined;
    let orgElevenLabsVoiceId: string | undefined;

    // If organizationId is provided, load keys and configured provider from DB
    if (options.organizationId) {
        try {
            const org = await prisma.organization.findUnique({
                where: { id: options.organizationId },
                select: { aiProvider: true, aiProviderApiKey: true, aiApiKeys: true }
            });
            if (org) {
                orgAiProvider = org.aiProvider || undefined;
                const orgKeys = (org.aiApiKeys && typeof org.aiApiKeys === 'object')
                    ? org.aiApiKeys as Record<string, string>
                    : {};
                if (!geminiKey && orgKeys['gemini']) geminiKey = orgKeys['gemini'];
                if (!openaiKey && orgKeys['openai']) openaiKey = orgKeys['openai'];
                if (!elevenlabsKey && orgKeys['elevenlabs']) elevenlabsKey = orgKeys['elevenlabs'];
                if (orgKeys['elevenlabsVoiceId']) orgElevenLabsVoiceId = orgKeys['elevenlabsVoiceId'];
                if (!geminiKey && org.aiProviderApiKey?.startsWith('AIza')) geminiKey = org.aiProviderApiKey;
                if (!elevenlabsKey && org.aiProviderApiKey?.startsWith('xi-')) elevenlabsKey = org.aiProviderApiKey;
                if (!openaiKey && org.aiProviderApiKey && !org.aiProviderApiKey.startsWith('AIza') && !org.aiProviderApiKey.startsWith('xi-')) openaiKey = org.aiProviderApiKey;
            }
        } catch {}
    }

    if (options.apiKey && !geminiKey && !openaiKey && !elevenlabsKey) {
        if (options.apiKey.startsWith('AIza')) {
            geminiKey = options.apiKey;
        } else if (options.apiKey.startsWith('xi-')) {
            elevenlabsKey = options.apiKey;
        } else {
            openaiKey = options.apiKey;
        }
    }

    // Only fallback to process.env for Gemini/OpenAI if organization keys are missing (NEVER for ElevenLabs)
    if (!geminiKey && process.env.GEMINI_API_KEY) geminiKey = process.env.GEMINI_API_KEY;
    if (!openaiKey && process.env.OPENAI_API_KEY) openaiKey = process.env.OPENAI_API_KEY;

    // Check system config as fallback for Gemini/OpenAI
    if (!geminiKey && !openaiKey && !elevenlabsKey) {
        try {
            const sysConfig = await prisma.systemConfig.findFirst({
                orderBy: { updatedAt: 'desc' },
                select: { aiProviderApiKey: true, aiProvider: true }
            });
            if (sysConfig?.aiProviderApiKey) {
                if (sysConfig.aiProviderApiKey.startsWith('AIza')) {
                    geminiKey = sysConfig.aiProviderApiKey;
                } else if (!sysConfig.aiProviderApiKey.startsWith('xi-')) {
                    openaiKey = sysConfig.aiProviderApiKey;
                }
            }
            if (!orgAiProvider && sysConfig?.aiProvider) {
                orgAiProvider = sysConfig.aiProvider;
            }
        } catch {}
    }

    // Determine preferred provider: explicit option > organization config > openai > gemini > elevenlabs
    const preferredProvider = options.provider || orgAiProvider || (geminiKey ? 'gemini' : (openaiKey ? 'openai' : (elevenlabsKey ? 'elevenlabs' : 'auto')));
    let lastError: any = null;

    const getOpenAiVoice = () => (options.voice && ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(options.voice)) ? options.voice : 'nova';
    const getGeminiVoice = () => (options.voice && ['Aoede', 'Puck', 'Charon', 'Kore', 'Fenrir'].includes(options.voice)) ? options.voice : 'Aoede';
    const getElevenLabsVoice = () => {
        if (options.voice && !['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'Aoede'].includes(options.voice)) {
            return options.voice;
        }
        return orgElevenLabsVoiceId || undefined;
    };

    if (preferredProvider === 'openai') {
        if (openaiKey) {
            try {
                return await generateSpeechWithOpenAI(text, openaiKey, getOpenAiVoice() as any);
            } catch (err: any) {
                lastError = err;
                console.warn(`[OpenAI TTS Failed] ${err.message}`);
                if (options.provider === 'openai' || orgAiProvider === 'openai') {
                    throw err;
                }
            }
        }
        if (geminiKey) {
            try {
                return await generateSpeechWithGemini(text, geminiKey, getGeminiVoice() as any, options.model, options.language);
            } catch (err: any) {
                console.error(`[Gemini TTS Fallback Failed] ${err.message}`);
                lastError = err;
            }
        }
        if (elevenlabsKey) {
            try {
                const { generateElevenLabsSpeech } = await import("@/lib/ai/elevenlabs");
                return await generateElevenLabsSpeech(text, { apiKey: elevenlabsKey, voiceId: getElevenLabsVoice() });
            } catch (err: any) {
                lastError = err;
            }
        }
    } else if (preferredProvider === 'gemini') {
        if (geminiKey) {
            try {
                return await generateSpeechWithGemini(text, geminiKey, getGeminiVoice() as any, options.model, options.language);
            } catch (err: any) {
                lastError = err;
                console.warn(`[Gemini TTS Failed] ${err.message}`);
                if (err.message?.includes('Authentication Error') || options.provider === 'gemini' || orgAiProvider === 'gemini') {
                    throw err;
                }
            }
        }
        if (openaiKey) {
            try {
                return await generateSpeechWithOpenAI(text, openaiKey, getOpenAiVoice() as any);
            } catch (err: any) {
                console.error(`[OpenAI TTS Fallback Failed] ${err.message}`);
                lastError = err;
            }
        }
        if (elevenlabsKey) {
            try {
                const { generateElevenLabsSpeech } = await import("@/lib/ai/elevenlabs");
                return await generateElevenLabsSpeech(text, { apiKey: elevenlabsKey, voiceId: getElevenLabsVoice() });
            } catch (err: any) {
                lastError = err;
            }
        }
    } else if (preferredProvider === 'elevenlabs') {
        if (elevenlabsKey) {
            try {
                const { generateElevenLabsSpeech } = await import("@/lib/ai/elevenlabs");
                return await generateElevenLabsSpeech(text, { apiKey: elevenlabsKey, voiceId: getElevenLabsVoice() });
            } catch (err: any) {
                lastError = err;
                console.error(`\n🚨 [ElevenLabs TTS Failed] ${err.message}\n`);
                if (options.provider === 'elevenlabs' || orgAiProvider === 'elevenlabs') {
                    throw err;
                }
            }
        }
        if (openaiKey) {
            try {
                return await generateSpeechWithOpenAI(text, openaiKey, getOpenAiVoice() as any);
            } catch (err: any) {
                lastError = err;
            }
        }
        if (geminiKey) {
            try {
                return await generateSpeechWithGemini(text, geminiKey, getGeminiVoice() as any, options.model, options.language);
            } catch (err: any) {
                lastError = err;
            }
        }
    } else {
        if (openaiKey) {
            try {
                return await generateSpeechWithOpenAI(text, openaiKey, getOpenAiVoice() as any);
            } catch (err: any) {
                console.warn(`[OpenAI TTS Failed] ${err.message}. Trying Gemini fallback...`);
                lastError = err;
            }
        }
        if (geminiKey) {
            try {
                return await generateSpeechWithGemini(text, geminiKey, getGeminiVoice() as any, options.model, options.language);
            } catch (err: any) {
                console.error(`[Gemini TTS Fallback Failed] ${err.message}`);
                lastError = err;
            }
        }
        if (elevenlabsKey) {
            try {
                const { generateElevenLabsSpeech } = await import("@/lib/ai/elevenlabs");
                return await generateElevenLabsSpeech(text, { apiKey: elevenlabsKey, voiceId: getElevenLabsVoice() });
            } catch (err: any) {
                lastError = err;
            }
        }
    }

    if (lastError) {
        throw lastError;
    }
    throw new Error("No Gemini, OpenAI, or ElevenLabs API Key configured for voice generation. Please set your API key in AI Voice Responses settings.");
}

/**
 * Direct Prompt-Driven Mode:
 * No external assistant ID, vector store, or context cache needed.
 */
export async function syncKnowledgeToAssistant(organizationId: string, aiAgentId?: string) {
    return { assistantId: null, synced: true, message: "AI Agent system prompt and instructions are directly active." };
}

