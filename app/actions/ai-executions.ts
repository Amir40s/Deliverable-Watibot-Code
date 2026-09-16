"use strict";
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { unstable_noStore as noStore } from "next/cache";

export type AIAgentExecutionInput = {
  organizationId: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  aiAgentId?: string;
  aiAgentName?: string;
  provider?: string;
  model?: string;
  userPrompt: string;
  retrievedChunks?: string[];
  systemPromptUsed?: string;
  rawAiOutput?: string;
  parsedMessage?: string;
  extractedLeadData?: Record<string, any>;
  sheetSaved?: boolean;
  spreadsheetId?: string;
  sheetName?: string;
  sheetRowData?: Record<string, any>;
  durationMs?: number;
  status?: "success" | "failed";
  error?: string;
};

export async function logAIAgentExecution(data: AIAgentExecutionInput) {
  try {
    let validAgentId: string | null = null;
    if (data.aiAgentId) {
      const exists = await prisma.aIAgent.findUnique({
        where: { id: data.aiAgentId },
        select: { id: true },
      });
      if (exists) {
        validAgentId = exists.id;
      }
    }

    const record = await prisma.aIAgentExecution.create({
      data: {
        organizationId: data.organizationId,
        contactId: data.contactId || null,
        contactName: data.contactName || null,
        contactPhone: data.contactPhone || null,
        aiAgentId: validAgentId,
        aiAgentName: data.aiAgentName || "Global Agent",
        provider: data.provider || "openai",
        model: data.model || "gpt-4o-mini",
        userPrompt: data.userPrompt,
        retrievedChunks: data.retrievedChunks || [],
        systemPromptUsed: data.systemPromptUsed || null,
        rawAiOutput: data.rawAiOutput || null,
        parsedMessage: data.parsedMessage || null,
        extractedLeadData: data.extractedLeadData ? (data.extractedLeadData as any) : undefined,
        sheetSaved: !!data.sheetSaved,
        spreadsheetId: data.spreadsheetId || null,
        sheetName: data.sheetName || null,
        sheetRowData: data.sheetRowData ? (data.sheetRowData as any) : undefined,
        durationMs: data.durationMs || 0,
        status: data.status || "success",
        error: data.error || null,
      },
    });

    return { success: true, id: record.id };
  } catch (err: any) {
    console.error("[AIAgentExecution Log Error]:", err.message);
    return { success: false, error: err.message };
  }
}

export async function getAIAgentExecutions(
  organizationId: string,
  options?: {
    search?: string;
    status?: string;
    agentId?: string;
    limit?: number;
  }
) {
  noStore();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const limit = options?.limit || 50;
  const search = options?.search?.trim() || "";
  const statusFilter = options?.status && options.status !== "all" ? options.status : undefined;
  const agentFilter = options?.agentId && options.agentId !== "all" ? options.agentId : undefined;

  const where: any = {
    organizationId,
    ...(statusFilter && { status: statusFilter }),
    ...(agentFilter && { aiAgentId: agentFilter === "global" ? null : agentFilter }),
    ...(search && {
      OR: [
        { contactName: { contains: search, mode: "insensitive" } },
        { contactPhone: { contains: search, mode: "insensitive" } },
        { userPrompt: { contains: search, mode: "insensitive" } },
        { parsedMessage: { contains: search, mode: "insensitive" } },
        { aiAgentName: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const executions = await prisma.aIAgentExecution.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return executions;
}

export async function clearAIAgentExecutions(organizationId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.aIAgentExecution.deleteMany({
    where: { organizationId },
  });

  revalidatePath("/dashboard/knowledge-base");
  return { success: true };
}
