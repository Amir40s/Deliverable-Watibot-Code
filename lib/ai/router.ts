import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Determines the most relevant AI Agent for a given message by using a lightweight LLM.
 * Returns the ID of the selected AI Agent, or null if none match or global should be used.
 */
export async function routeMessageToAgent(messageText: string, organizationId: string, platform?: string | null): Promise<string | null> {
  try {
    // 1. Fetch all active agents for this organization
    const rawAgents = await prisma.aIAgent.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        instructions: true,
        isDefault: true,
        platforms: true,
      },
    });

    const targetPlatform = platform ? platform.toUpperCase() : null;
    const agents = targetPlatform
      ? rawAgents.filter(a => {
          const pls = (a.platforms || []).map(p => p.toUpperCase());
          return pls.length === 0 || pls.includes('ALL') || pls.includes(targetPlatform);
        })
      : rawAgents;

    if (agents.length === 0) {
      return null;
    }

    if (agents.length === 1) {
      return agents[0].id;
    }

    // 2. Prepare the LLM prompt with agent descriptions
    const agentList = agents.map((a, i) => `[Agent ID: ${a.id}]\nName: ${a.name}\nDescription/Instructions: ${a.instructions || 'No specific instructions.'}`).join('\n\n');

    const prompt = `You are an intent router for a customer support system.
Your job is to read the customer's message and select the most appropriate AI Agent to handle it.

Here are the available AI Agents:
${agentList}

Customer Message:
"${messageText}"

Instructions:
Evaluate the customer's message against the provided AI Agents. Output ONLY the EXACT "Agent ID" of the most relevant agent. If no agent is particularly relevant, or if it's a general greeting, output "GLOBAL". Do not output any other text or reasoning.`;

    // 3. Use Gemini (or any fast/cheap LLM) to evaluate intent. 
    // We prefer a system-level key for routing if available, otherwise organization key.
    
    // First try system config key
    const config = await prisma.systemConfig.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { aiProviderApiKey: true }
    });
    let apiKey = process.env.GEMINI_API_KEY || "";
    
    // Fallback to org key if needed (though routing should ideally be handled by a global fast model)
    if (!apiKey) {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { aiApiKeys: true }
        });
        if (org && org.aiApiKeys && typeof org.aiApiKeys === 'object') {
            apiKey = (org.aiApiKeys as Record<string, string>)["gemini"] || "";
        }
    }

    if (!apiKey && process.env.OPENAI_API_KEY) {
        // Fallback to OpenAI if Gemini isn't available
        const { getAIResponse } = await import("@/lib/ai/openai");
        const reply = await getAIResponse(prompt, { 
            organizationId, // Uses org's OpenAI key implicitly
            // We just want a raw string response
        });
        const chosenId = reply?.trim() || "";
        if (chosenId && chosenId !== "GLOBAL" && agents.some(a => a.id === chosenId)) {
            return chosenId;
        }
        return null;
    }

    if (!apiKey) {
        console.warn("[Intent Router] No API key available for intent routing, falling back to default agent.");
        return agents.find(a => a.isDefault)?.id || agents[0].id;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Fast and cheap for routing

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.1, // Low temperature for deterministic routing
            maxOutputTokens: 10,
        }
    });

    const responseText = result.response.text().trim();
    
    if (responseText === "GLOBAL") {
        return null;
    }

    // Verify the LLM outputted a valid ID
    if (agents.some(a => a.id === responseText)) {
        return responseText;
    }

    // Fallback
    console.warn(`[Intent Router] Invalid agent ID returned by LLM: "${responseText}". Falling back.`);
    return agents.find(a => a.isDefault)?.id || null;
    
  } catch (error) {
    console.error("[Intent Router] Error routing message:", error);
    return null; // Fallback to global/default
  }
}
