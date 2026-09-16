"use strict";
"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activityLog";

export type AIFunctionFieldInput = {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
  description?: string;
};

export type AIFunctionInput = {
  name: string;
  description?: string;
  fields?: AIFunctionFieldInput[];
  googleSpreadsheetId?: string | null;
  googleSheetName?: string | null;
  finalMessage?: string;
  aiAgentId?: string | null;
  isActive?: boolean;
};

export type AIMcpServerInput = {
  name: string;
  description?: string;
  url: string;
  authType?: string;
  accessToken?: string;
  apiKey?: string;
  customHeaders?: Record<string, string> | null;
  aiAgentId?: string | null;
  isActive?: boolean;
};

const ALLOWED_FIELD_TYPES = new Set(["text", "email", "phone", "number", "date"]);
const ALLOWED_AUTH_TYPES = new Set(["none", "bearer", "api_key", "custom_headers"]);

function cleanText(value: unknown, maxLength = 5000) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeFieldName(value: string, fallbackIndex: number) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

  return normalized || `field_${fallbackIndex + 1}`;
}

function normalizeFields(fields: AIFunctionFieldInput[] = []) {
  const used = new Set<string>();

  return fields
    .slice(0, 12)
    .map((field, index) => {
      let name = normalizeFieldName(field.name || field.label || "", index);
      while (used.has(name)) {
        name = `${name}_${index + 1}`.slice(0, 48);
      }
      used.add(name);

      const label = cleanText(field.label || field.name || name, 80);
      const type = ALLOWED_FIELD_TYPES.has(String(field.type || "").toLowerCase())
        ? String(field.type).toLowerCase()
        : "text";

      return {
        name,
        label,
        type,
        required: field.required !== false,
        description: cleanText(field.description || label, 240),
      };
    })
    .filter((field) => field.label.length > 0);
}

function normalizeCustomHeaders(headers?: Record<string, string> | null) {
  if (!headers || typeof headers !== "object") return null;

  const entries = Object.entries(headers)
    .map(([key, value]) => [cleanText(key, 120), cleanText(value, 1000)] as const)
    .filter(([key, value]) => key.length > 0 && value.length > 0);

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

async function requireOrganization(organizationId?: string) {
  const session = await getServerSession(authOptions);
  const sessionOrgId = session?.user?.organizationId;

  if (!session?.user?.id || !sessionOrgId) {
    throw new Error("Unauthorized");
  }

  if (organizationId && organizationId !== sessionOrgId) {
    throw new Error("You do not have access to this organization.");
  }

  return { session, organizationId: sessionOrgId };
}

async function assertAgentBelongsToOrg(aiAgentId: string | null | undefined, organizationId: string) {
  if (!aiAgentId) return null;

  const agent = await prisma.aIAgent.findFirst({
    where: { id: aiAgentId, organizationId },
    select: { id: true },
  });

  if (!agent) {
    throw new Error("Selected AI agent was not found in this organization.");
  }

  return agent.id;
}

export async function getAIToolsSetup(organizationId: string) {
  const { organizationId: sessionOrgId } = await requireOrganization(organizationId);

  const [functions, mcpServers] = await Promise.all([
    prisma.aIFunction.findMany({
      where: { organizationId: sessionOrgId },
      include: {
        aiAgent: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.aIMcpServer.findMany({
      where: { organizationId: sessionOrgId },
      include: {
        aiAgent: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return {
    functions,
    mcpServers: mcpServers.map((server) => ({
      ...server,
      accessToken: undefined,
      apiKey: undefined,
      hasAccessToken: !!server.accessToken,
      hasApiKey: !!server.apiKey,
    })),
    flows: [], // Returning empty for backwards compatibility in other places if needed, though functions don't use it.
  };
}

export async function createAIFunction(organizationId: string, data: AIFunctionInput) {
  const { session, organizationId: sessionOrgId } = await requireOrganization(organizationId);
  const name = cleanText(data.name, 120);
  if (!name) throw new Error("Function name is required.");

  const aiAgentId = await assertAgentBelongsToOrg(data.aiAgentId, sessionOrgId);
  const fields = normalizeFields(data.fields);

  if (fields.length === 0) {
    throw new Error("Add at least one data field for the AI function to collect.");
  }

  if (data.googleSpreadsheetId) {
    const { validateSheetAccess } = await import("@/lib/flows/integrations/google-sheets");
    await validateSheetAccess(data.googleSpreadsheetId);
  }

  const aiFunction = await prisma.aIFunction.create({
    data: {
      organizationId: sessionOrgId,
      aiAgentId,
      name,
      description: cleanText(data.description),
      fields,
      googleSpreadsheetId: data.googleSpreadsheetId || null,
      googleSheetName: data.googleSheetName || null,
      finalMessage: cleanText(data.finalMessage || "Thanks. I have collected your details and our team will continue from here."),
      isActive: data.isActive !== false,
    },
  });

  await logActivity({
    organizationId: sessionOrgId,
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    action: "Created AI Function",
    module: "AI Tools",
    target: aiFunction.name,
    status: "success",
  }).catch(() => {});

  revalidatePath("/dashboard/knowledge-base");
  return { success: true, function: aiFunction };
}

export async function updateAIFunction(id: string, data: AIFunctionInput) {
  const current = await prisma.aIFunction.findUnique({
    where: { id },
    select: { organizationId: true, name: true },
  });

  if (!current) throw new Error("AI function not found.");

  const { session, organizationId } = await requireOrganization(current.organizationId);
  const name = cleanText(data.name, 120);
  if (!name) throw new Error("Function name is required.");

  const aiAgentId = await assertAgentBelongsToOrg(data.aiAgentId, organizationId);
  const fields = normalizeFields(data.fields);

  if (fields.length === 0) {
    throw new Error("Add at least one data field for the AI function to collect.");
  }

  if (data.googleSpreadsheetId) {
    const { validateSheetAccess } = await import("@/lib/flows/integrations/google-sheets");
    await validateSheetAccess(data.googleSpreadsheetId);
  }

  const aiFunction = await prisma.aIFunction.update({
    where: { id },
    data: {
      name,
      description: cleanText(data.description),
      fields,
      googleSpreadsheetId: data.googleSpreadsheetId || null,
      googleSheetName: data.googleSheetName || null,
      aiAgentId,
      finalMessage: cleanText(data.finalMessage || "Thanks. I have collected your details and our team will continue from here."),
      isActive: data.isActive !== false,
    },
  });

  await logActivity({
    organizationId,
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    action: "Updated AI Function",
    module: "AI Tools",
    target: aiFunction.name,
    status: "success",
  }).catch(() => {});

  revalidatePath("/dashboard/knowledge-base");
  return { success: true, function: aiFunction };
}

export async function deleteAIFunction(id: string) {
  const current = await prisma.aIFunction.findUnique({
    where: { id },
    select: { organizationId: true, name: true },
  });

  if (!current) return { success: true };

  const { session, organizationId } = await requireOrganization(current.organizationId);
  await prisma.aIFunction.delete({ where: { id } });

  await logActivity({
    organizationId,
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    action: "Deleted AI Function",
    module: "AI Tools",
    target: current.name,
    status: "success",
  }).catch(() => {});

  revalidatePath("/dashboard/knowledge-base");
  return { success: true };
}

export async function createAIMcpServer(organizationId: string, data: AIMcpServerInput) {
  const { session, organizationId: sessionOrgId } = await requireOrganization(organizationId);
  const name = cleanText(data.name, 120);
  const url = cleanText(data.url, 2000);

  if (!name) throw new Error("Server name is required.");
  if (!url) throw new Error("Server URL is required.");

  const parsedUrl = new URL(url);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Server URL must start with http:// or https://.");
  }

  const aiAgentId = await assertAgentBelongsToOrg(data.aiAgentId, sessionOrgId);
  const authType = ALLOWED_AUTH_TYPES.has(String(data.authType || "none")) ? String(data.authType || "none") : "none";

  const server = await prisma.aIMcpServer.create({
    data: {
      organizationId: sessionOrgId,
      aiAgentId,
      name,
      description: cleanText(data.description),
      url,
      authType,
      accessToken: data.accessToken ? cleanText(data.accessToken, 4000) : null,
      apiKey: data.apiKey ? cleanText(data.apiKey, 4000) : null,
      customHeaders: normalizeCustomHeaders(data.customHeaders) || undefined,
      isActive: data.isActive !== false,
    },
  });

  await logActivity({
    organizationId: sessionOrgId,
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    action: "Created MCP Server",
    module: "AI Tools",
    target: server.name,
    status: "success",
  }).catch(() => {});

  revalidatePath("/dashboard/knowledge-base");
  return { success: true, server: { ...server, accessToken: undefined, apiKey: undefined } };
}

export async function updateAIMcpServer(id: string, data: AIMcpServerInput) {
  const current = await prisma.aIMcpServer.findUnique({
    where: { id },
    select: { organizationId: true, name: true },
  });

  if (!current) throw new Error("MCP server not found.");

  const { session, organizationId } = await requireOrganization(current.organizationId);
  const name = cleanText(data.name, 120);
  const url = cleanText(data.url, 2000);

  if (!name) throw new Error("Server name is required.");
  if (!url) throw new Error("Server URL is required.");

  const parsedUrl = new URL(url);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Server URL must start with http:// or https://.");
  }

  const aiAgentId = await assertAgentBelongsToOrg(data.aiAgentId, organizationId);
  const authType = ALLOWED_AUTH_TYPES.has(String(data.authType || "none")) ? String(data.authType || "none") : "none";

  const updateData: any = {
    aiAgentId,
    name,
    description: cleanText(data.description),
    url,
    authType,
    customHeaders: normalizeCustomHeaders(data.customHeaders) || undefined,
    isActive: data.isActive !== false,
  };

  if (data.accessToken !== undefined) {
    updateData.accessToken = data.accessToken ? cleanText(data.accessToken, 4000) : null;
  }

  if (data.apiKey !== undefined) {
    updateData.apiKey = data.apiKey ? cleanText(data.apiKey, 4000) : null;
  }

  const server = await prisma.aIMcpServer.update({
    where: { id },
    data: updateData,
  });

  await logActivity({
    organizationId,
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    action: "Updated MCP Server",
    module: "AI Tools",
    target: server.name,
    status: "success",
  }).catch(() => {});

  revalidatePath("/dashboard/knowledge-base");
  return { success: true, server: { ...server, accessToken: undefined, apiKey: undefined } };
}

export async function deleteAIMcpServer(id: string) {
  const current = await prisma.aIMcpServer.findUnique({
    where: { id },
    select: { organizationId: true, name: true },
  });

  if (!current) return { success: true };

  const { session, organizationId } = await requireOrganization(current.organizationId);
  await prisma.aIMcpServer.delete({ where: { id } });

  await logActivity({
    organizationId,
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    action: "Deleted MCP Server",
    module: "AI Tools",
    target: current.name,
    status: "success",
  }).catch(() => {});

  revalidatePath("/dashboard/knowledge-base");
  return { success: true };
}

function buildServerHeaders(server: {
  authType: string;
  accessToken?: string | null;
  apiKey?: string | null;
  customHeaders?: any;
}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (server.authType === "bearer" && server.accessToken) {
    headers.Authorization = `Bearer ${server.accessToken}`;
  }

  if (server.authType === "api_key" && server.apiKey) {
    headers["X-API-Key"] = server.apiKey;
  }

  if (server.authType === "custom_headers" && server.customHeaders && typeof server.customHeaders === "object") {
    for (const [key, value] of Object.entries(server.customHeaders)) {
      if (typeof value === "string" && key.trim()) {
        headers[key.trim()] = value;
      }
    }
  }

  return headers;
}

export async function testAIMcpServer(id: string) {
  const server = await prisma.aIMcpServer.findUnique({
    where: { id },
  });

  if (!server) throw new Error("MCP server not found.");

  const { organizationId } = await requireOrganization(server.organizationId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(server.url, {
      method: "POST",
      headers: buildServerHeaders(server),
      body: JSON.stringify({
        query: "health_check",
        source: "watibot",
        organizationId,
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    return {
      success: response.ok,
      status: response.status,
      message: text.slice(0, 500) || response.statusText,
    };
  } catch (error: any) {
    return {
      success: false,
      status: 0,
      message: error?.name === "AbortError" ? "Connection timed out." : error?.message || "Connection failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
