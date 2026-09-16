"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { checkQuota } from "@/lib/quota";
import { logActivity } from "@/lib/activityLog";

export async function createFlow(data: {
  name: string;
  description?: string;
  trigger?: any;
  platform?: string;
  selectedStoryIds?: string[];
  selectedPostIds?: string[];
}) {
  console.log("[CreateFlow] Received request:", data);
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });

  if (!user) {
    throw new Error("Session invalid. Please sign out and sign in again.");
  }

  if (!user.organizationId) {
    throw new Error("User is not associated with an organization.");
  }

  const organizationId = user.organizationId;

  // Quota Check
  const quota = await checkQuota(organizationId, "maxBotFlows");
  if (!quota.allowed) {
    return { success: false, error: quota.message };
  }

  try {
    const defaultTriggerNode = {
      id: "trigger_0",
      type: "trigger",
      position: { x: 100, y: 100 },
      data: {
        triggerType:
          data.platform === "INSTAGRAM_STORY_REPLY"
            ? "story_reply"
            : data.platform === "FACEBOOK_COMMENT"
              ? "facebook_comment"
              : data.platform === "INSTAGRAM_COMMENT"
                ? "instagram_comment"
                : data.platform === "SHOPIFY"
                  ? "shopify_event"
                  : "keyword",
        keyword: "",
        matchMode: "contains",
        selectedStoryIds: data.selectedStoryIds || [],
        selectedPostIds: data.selectedPostIds || [],
        shopifyEvent: data.platform === "SHOPIFY" ? "orders/create" : undefined,
      },
    };

    const flow = await prisma.flow.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
        platform: data.platform || "ALL",
        trigger: data.trigger || {
          type:
            data.platform === "INSTAGRAM_STORY_REPLY"
              ? "story_reply"
              : data.platform === "FACEBOOK_COMMENT"
                ? "facebook_comment"
                : data.platform === "INSTAGRAM_COMMENT"
                  ? "instagram_comment"
                  : data.platform === "SHOPIFY"
                    ? "shopify_event"
                    : "keyword",
          config: {
            selectedStoryIds: data.selectedStoryIds || [],
            selectedPostIds: data.selectedPostIds || [],
            shopifyEvent:
              data.platform === "SHOPIFY" ? "orders/create" : undefined,
          },
        },
        nodes: [defaultTriggerNode],
        edges: [],
        isActive: false,
      },
    });

    console.log("[CreateFlow] Success:", flow.id);
    logActivity({
      organizationId,
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      action: 'Created',
      module: 'Flows',
      target: data.name,
      details: `Flow ID: ${flow.id}`,
      status: 'success',
    });
    return {
      success: true,
      flow: {
        ...flow,
        _count: { executions: 0 },
      },
    };
  } catch (error: any) {
    console.error("[CreateFlow] Error:", error);
    return { success: false, error: error.message || "Failed to create flow" };
  }
}

export async function getFlows() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }

  const flows = await prisma.flow.findMany({
    where: {
      organizationId: session.user.organizationId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      _count: {
        select: {
          executions: true,
        },
      },
    },
  });

  return { flows };
}

export async function getFlow(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }

  const flow = await prisma.flow.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
  });

  if (!flow) {
    throw new Error("Flow not found");
  }

  return { flow };
}

export async function updateFlow(
  id: string,
  data: {
    name?: string;
    description?: string;
    nodes?: any;
    edges?: any;
    trigger?: any;
    isActive?: boolean;
    platform?: string;
  },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }

  // If nodes are provided but trigger is not, extract trigger info from nodes
  let trigger = data.trigger;
  if (!trigger && data.nodes && Array.isArray(data.nodes)) {
    const triggerNode = data.nodes.find((n: any) => n.type === "trigger");
    if (triggerNode) {
      trigger = {
        type: triggerNode.data?.triggerType || "keyword",
        config: {
          keyword: triggerNode.data?.keyword || "",
          isRegexEnabled: triggerNode.data?.isRegexEnabled || false,
          regexPattern: triggerNode.data?.regexPattern || "",
        },
      };
    }
  }

  const flow = await prisma.flow.updateMany({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
    data: {
      ...data,
      ...(trigger ? { trigger } : {}),
      updatedAt: new Date(),
    },
  });

  revalidatePath("/dashboard/flows");
  revalidatePath(`/dashboard/flows/${id}`);
  return { success: true };
}

export async function deleteFlow(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }

  await prisma.flow.deleteMany({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
  });

  logActivity({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Deleted',
    module: 'Flows',
    target: `Flow ID: ${id}`,
    status: 'success',
  });

  revalidatePath("/dashboard/flows");
  return { success: true };
}

export async function toggleFlowStatus(id: string, isActive: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }

  await prisma.flow.updateMany({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
    data: {
      isActive,
      updatedAt: new Date(),
    },
  });

  logActivity({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: isActive ? 'Activated' : 'Deactivated',
    module: 'Flows',
    target: `Flow ID: ${id}`,
    status: 'success',
  });

  revalidatePath("/dashboard/flows");
  return { success: true };
}

export async function duplicateFlow(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }

  const originalFlow = await prisma.flow.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
  });

  if (!originalFlow) {
    return { success: false, error: "Flow not found" };
  }

  // Quota Check
  const quota = await checkQuota(session.user.organizationId, "maxBotFlows");
  if (!quota.allowed) {
    return { success: false, error: quota.message };
  }

  const duplicatedFlow = await prisma.flow.create({
    data: {
      organizationId: session.user.organizationId,
      name: `${originalFlow.name} (Copy)`,
      description: originalFlow.description,
      platform: originalFlow.platform,
      trigger: originalFlow.trigger as any,
      nodes: originalFlow.nodes as any,
      edges: originalFlow.edges as any,
      isActive: false,
    },
  });

  revalidatePath("/dashboard/flows");
  return {
    success: true,
    flow: {
      ...duplicatedFlow,
      _count: { executions: 0 },
    },
  };
}

// Flow execution functions
export async function getFlowExecutions(flowId: string, limit = 50) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }

  const executions = await prisma.flowExecution.findMany({
    where: {
      flowId,
      flow: {
        organizationId: session.user.organizationId,
      },
    },
    orderBy: {
      startedAt: "desc",
    },
    take: limit,
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          waId: true,
        },
      },
    },
  });

  return { executions };
}

export async function getFlowExecution(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }

  const execution = await prisma.flowExecution.findFirst({
    where: {
      id,
      flow: {
        organizationId: session.user.organizationId,
      },
    },
    include: {
      flow: true,
      contact: true,
    },
  });

  if (!execution) {
    throw new Error("Execution not found");
  }

  return { execution };
}

export async function importFlow(data: {
  name: string;
  description?: string;
  trigger: any;
  nodes: any;
  edges: any;
  platform?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }

  // Quota Check
  const quota = await checkQuota(session.user.organizationId, "maxBotFlows");
  if (!quota.allowed) {
    return { success: false, error: quota.message };
  }

  try {
    const flow = await prisma.flow.create({
      data: {
        organizationId: session.user.organizationId,
        name: data.name,
        description: data.description || "",
        trigger: data.trigger || { type: "manual", config: {} },
        nodes: data.nodes || [],
        edges: data.edges || [],
        platform: data.platform || "ALL",
        isActive: false,
      },
    });

    revalidatePath("/dashboard/flows");
    return {
      success: true,
      flow: {
        ...flow,
        _count: { executions: 0 },
      },
    };
  } catch (error: any) {
    console.error("[ImportFlow] Error:", error);
    return { success: false, error: error.message || "Failed to import flow" };
  }
}

export async function validateGoogleSheet(spreadsheetId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const { validateSheetAccess } =
      await import("@/lib/flows/integrations/google-sheets");
    const result = await validateSheetAccess(spreadsheetId);
    return result;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
