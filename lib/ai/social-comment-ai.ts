import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

interface GenerateSocialCommentReplyParams {
  organizationId: string;
  agentId?: string;
  postCaption?: string;
  commenterName: string;
  commentText: string;
  customPrompt?: string;
  channel: "comment" | "dm";
}

export async function generateSocialCommentAiReply(
  params: GenerateSocialCommentReplyParams
): Promise<string | null> {
  const {
    organizationId,
    agentId,
    postCaption,
    commenterName,
    commentText,
    customPrompt,
    channel,
  } = params;

  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        aiProvider: true,
        aiProviderApiKey: true,
        aiApiKeys: true,
        businessDescription: true,
      },
    });

    if (!org) return null;

    // Load AI Agent details if an agentId is supplied
    let agentInstructions = "";
    let agentModel = "gpt-4o-mini";
    let kbContent = "";

    if (agentId) {
      const agent = await prisma.aIAgent.findUnique({
        where: { id: agentId },
        include: {
          agentFiles: {
            include: {
              knowledgeBase: {
                select: { title: true, content: true },
              },
            },
          },
        },
      });

      if (agent) {
        agentInstructions = agent.instructions || "";
        agentModel = agent.model || "gpt-4o-mini";
        const kbParts = agent.agentFiles
          .map(
            (f) =>
              `### ${f.knowledgeBase.title}:\n${f.knowledgeBase.content || ""}`
          )
          .filter(Boolean);
        if (kbParts.length > 0) {
          kbContent = `\nKnowledge Base:\n${kbParts.join("\n\n")}`;
        }
      }
    }

    const systemPrompt = `You are a friendly, professional social media customer support assistant for "${org.name}".
Your task is to craft a helpful, engaging, and concise reply to a user's comment on our Facebook post.

Post Context:
${postCaption ? `Post Caption: "${postCaption}"` : "Post on our Facebook Page"}

Customer Name: ${commenterName}
Customer Comment: "${commentText}"
Reply Channel: ${channel === "dm" ? "Private Messenger DM" : "Public Facebook Comment Reply"}

${agentInstructions ? `Agent Guidelines:\n${agentInstructions}` : ""}
${customPrompt ? `Specific Post Instructions:\n${customPrompt}` : ""}
${kbContent}

Formatting Rules:
1. Greet the customer by name if appropriate (e.g. "Hi ${commenterName}, ...").
2. Keep the reply concise, warm, helpful, and under 3-4 sentences.
3. If they ask about price, features, or how to buy, provide clear information and invite them to send a message or visit our link.
4. Do NOT use markdown asterisks or code formatting in public comments. Keep it natural plain text with appropriate emojis.
5. Return ONLY the final reply text.`;

    // Try Gemini if available
    const geminiKey =
      (org.aiApiKeys as any)?.gemini ||
      (org.aiProvider === "gemini" ? org.aiProviderApiKey : null) ||
      process.env.GEMINI_API_KEY;

    if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(systemPrompt);
        const text = result.response.text()?.trim();
        if (text) return text;
      } catch (geminiErr: any) {
        logger.webhook.warn(`[SocialCommentAI] Gemini generation failed, trying OpenAI fallback: ${geminiErr?.message}`);
      }
    }

    // Try OpenAI
    const openAiKey =
      (org.aiApiKeys as any)?.openai ||
      (org.aiProvider === "openai" ? org.aiProviderApiKey : null) ||
      process.env.OPENAI_API_KEY;

    if (openAiKey) {
      const openai = new OpenAI({ apiKey: openAiKey });
      const completion = await openai.chat.completions.create({
        model: agentModel.includes("gpt") ? agentModel : "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Please reply to: "${commentText}"` },
        ],
        temperature: 0.7,
        max_tokens: 250,
      });

      const reply = completion.choices[0]?.message?.content?.trim();
      if (reply) return reply;
    }

    // Fallback friendly reply
    return `Hi ${commenterName}, thanks for reaching out! We've received your comment and our team is happy to assist you. Feel free to send us a direct message for more details!`;
  } catch (err: any) {
    logger.webhook.error(`[SocialCommentAI] Error generating AI comment reply: ${err?.message}`);
    return null;
  }
}
