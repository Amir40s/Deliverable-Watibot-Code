import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

type ToolBuildOptions = {
  organizationId: string;
  contactId: string;
  baseTools?: any[];
  baseToolHandlers?: Record<string, (args: any) => Promise<any>>;
};

type AIFunctionField = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  description?: string;
};

type AIFunctionState = {
  functionId: string;
  collected: Record<string, string>;
  currentFieldName?: string;
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function isMissingConfiguredAIToolTableError(error: unknown) {
  const record = asRecord(error);
  const meta = asRecord(record.meta);
  const modelName = String(meta.modelName || meta.table || "");
  const message = error instanceof Error ? error.message : String(error || "");
  const mentionsConfiguredToolTable = /AI(Function|McpServer)/i.test(`${modelName} ${message}`);

  return (
    (record.code === "P2021" && mentionsConfiguredToolTable) ||
    (mentionsConfiguredToolTable && /(does not exist|not exist|relation|table)/i.test(message))
  );
}

function getFields(value: unknown): AIFunctionField[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((field: any) => ({
      name: String(field?.name || "").trim(),
      label: String(field?.label || field?.name || "").trim(),
      type: String(field?.type || "text").trim().toLowerCase(),
      required: field?.required !== false,
      description: String(field?.description || field?.label || field?.name || "").trim(),
    }))
    .filter((field) => field.name && field.label);
}

function compactId(id: string) {
  return id.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 44);
}

function functionToolName(id: string) {
  return `ai_fn_${compactId(id)}`;
}

function mcpToolName(id: string) {
  return `mcp_${compactId(id)}`;
}

function fieldPrompt(field: AIFunctionField) {
  const label = field.label || field.name;
  if (field.type === "email") return `Please share your ${label}.`;
  if (field.type === "phone") return `Please share your ${label}.`;
  if (field.type === "number") return `Please enter ${label}.`;
  if (field.type === "date") return `Please share the ${label}.`;
  return `Please share ${label}.`;
}

function validateFieldValue(field: AIFunctionField, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return `${fieldPrompt(field)}`;

  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return `Please enter a valid email address.`;
  }

  if (field.type === "phone") {
    const digits = trimmed.replace(/[^\d+]/g, "");
    if (digits.length < 7) return `Please enter a valid phone number.`;
  }

  if (field.type === "number" && Number.isNaN(Number(trimmed.replace(/,/g, "")))) {
    return `Please enter a valid number.`;
  }

  return null;
}

function nextMissingField(fields: AIFunctionField[], collected: Record<string, string>) {
  return fields.find((field) => field.required !== false && !String(collected[field.name] || "").trim()) || null;
}

async function getActiveAgentId(organizationId: string, contactId: string) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId },
    select: { aiAgentId: true },
  });

  if (contact?.aiAgentId) return contact.aiAgentId;

  const defaultAgent = await prisma.aIAgent.findFirst({
    where: { organizationId, isDefault: true },
    select: { id: true },
  });

  return defaultAgent?.id || null;
}

async function saveFunctionState(contactId: string, state: AIFunctionState) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { customAttributes: true },
  });

  const existing = asRecord(contact?.customAttributes);
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      customAttributes: {
        ...existing,
        aiFunctionState: state,
      } as any,
    },
  });
}

async function completeConfiguredFunction(params: {
  functionConfig: any;
  contactId: string;
  organizationId: string;
  collected: Record<string, string>;
  messageText: string;
}) {
  const { functionConfig, contactId, organizationId, collected, messageText } = params;
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId },
    select: { customAttributes: true, id: true, name: true, waId: true, platform: true },
  });

  const existing = asRecord(contact?.customAttributes);
  const previousSubmissions = Array.isArray(existing.aiFunctionSubmissions)
    ? existing.aiFunctionSubmissions.slice(-20)
    : [];
  const { aiFunctionState, ...restAttributes } = existing;

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      customAttributes: {
        ...restAttributes,
        aiFunctionSubmissions: [
          ...previousSubmissions,
          {
            functionId: functionConfig.id,
            functionName: functionConfig.name,
            collected,
            createdAt: new Date().toISOString(),
          },
        ],
      } as any,
    },
  });

  if (functionConfig.googleSpreadsheetId) {
    try {
      const { appendToGoogleSheet } = await import("@/lib/flows/integrations/google-sheets");
      
      const sheetName = functionConfig.googleSheetName || "Sheet1";
      
      // We also add timestamp and function name to the row
      const rowData = {
        Timestamp: new Date().toISOString(),
        FunctionName: functionConfig.name,
        ...collected
      };

      await appendToGoogleSheet(
        functionConfig.googleSpreadsheetId,
        sheetName,
        rowData,
        organizationId
      );
    } catch (error: any) {
      logger.flow.error(`[AI Tools] Failed to append to Google Sheet for function ${functionConfig.id}: ${error.message}`);
    }
  }

  return functionConfig.finalMessage || "Thanks. I have collected your details and our team will continue from here.";
}

export async function runConfiguredAIFunctionState(
  _message: string,
  _contactId: string,
  _organizationId: string,
): Promise<string | null> {
  return null;
}

function buildMcpHeaders(server: any) {
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

async function callMcpServer(server: any, args: any, organizationId: string, contactId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(server.url, {
      method: "POST",
      headers: buildMcpHeaders(server),
      body: JSON.stringify({
        query: args?.query || args?.input || "",
        arguments: args || {},
        organizationId,
        contactId,
        source: "watibot_ai_tool",
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    let data: any = text;

    try {
      data = JSON.parse(text);
    } catch {
      data = text.slice(0, 4000);
    }

    return {
      ok: response.ok,
      status: response.status,
      server: server.name,
      data,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function buildConfiguredAITools(options: ToolBuildOptions) {
  const activeAgentId = await getActiveAgentId(options.organizationId, options.contactId);
  const agentFilter = activeAgentId
    ? [{ aiAgentId: null }, { aiAgentId: activeAgentId }]
    : [{ aiAgentId: null }];

  let aiFunctions: any[] = [];
  let mcpServers: any[] = [];

  try {
    [aiFunctions, mcpServers] = await Promise.all([
      prisma.aIFunction.findMany({
        where: {
          organizationId: options.organizationId,
          isActive: true,
          OR: agentFilter,
        },
      }),
      prisma.aIMcpServer.findMany({
        where: {
          organizationId: options.organizationId,
          isActive: true,
          OR: agentFilter,
        },
      }),
    ]);
  } catch (error) {
    if (isMissingConfiguredAIToolTableError(error)) {
      logger.flow.warn("[AI Tools] Configured AI tool tables are missing. Continuing with base AI tools only.");
    } else {
      throw error;
    }
  }

  const tools = [...(options.baseTools || [])];
  const toolHandlers: Record<string, (args: any) => Promise<any>> = {
    ...(options.baseToolHandlers || {}),
  };

  for (const aiFunction of aiFunctions) {
    const fields = getFields(aiFunction.fields);
    if (fields.length === 0) continue;

    const toolName = functionToolName(aiFunction.id);
    tools.push({
      type: "function" as const,
      function: {
        name: toolName,
        description: [
          `Start the "${aiFunction.name}" AI function.`,
          aiFunction.description || "",
          "Use this when the customer wants this workflow. Pass any fields already provided; the system will ask for missing required fields.",
        ].filter(Boolean).join(" "),
        parameters: {
          type: "object",
          properties: Object.fromEntries(
            fields.map((field) => [
              field.name,
              {
                type: "string",
                description: field.description || field.label,
              },
            ]),
          ),
          additionalProperties: false,
        },
      },
    });

    toolHandlers[toolName] = async (args: any) => {
      const collected = Object.fromEntries(
        fields
          .map((field) => [field.name, String(args?.[field.name] || "").trim()] as const)
          .filter(([, value]) => value.length > 0),
      );
      const missingField = nextMissingField(fields, collected);

      if (missingField) {
        await saveFunctionState(options.contactId, {
          functionId: aiFunction.id,
          collected,
          currentFieldName: missingField.name,
        });

        return {
          status: "needs_input",
          message: fieldPrompt(missingField),
          missingField: missingField.name,
        };
      }

      const message = await completeConfiguredFunction({
        functionConfig: aiFunction,
        contactId: options.contactId,
        organizationId: options.organizationId,
        collected,
        messageText: "",
      });

      return {
        status: "completed",
        message,
        collected,
      };
    };
  }

  for (const server of mcpServers) {
    const toolName = mcpToolName(server.id);
    tools.push({
      type: "function" as const,
      function: {
        name: toolName,
        description: [
          `Fetch data from external system "${server.name}".`,
          server.description || "",
          "Use this when live external data or client-specific system data is needed.",
        ].filter(Boolean).join(" "),
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The exact lookup or action request to send to the external system.",
            },
          },
          required: ["query"],
          additionalProperties: true,
        },
      },
    });

    toolHandlers[toolName] = async (args: any) => {
      try {
        return await callMcpServer(server, args, options.organizationId, options.contactId);
      } catch (error: any) {
        return {
          ok: false,
          server: server.name,
          error: error?.name === "AbortError" ? "External server timed out." : error?.message || "External server call failed.",
        };
      }
    };
  }

  return { tools, toolHandlers };
}
