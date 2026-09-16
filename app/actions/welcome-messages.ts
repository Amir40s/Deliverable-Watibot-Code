"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activityLog";

export type WelcomeCondition = {
  id: string;
  type: string;
  operator?: string;
  value?: string | number;
};

export type WelcomeMessageData = {
  name: string;
  content: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  isActive?: boolean;
  priority?: number;
  delaySeconds?: number;
  conditions?: WelcomeCondition[];
  conditionLogic?: "AND" | "OR";
  platform?: string;
  templateName?: string | null;
  templateLanguage?: string | null;
  templateParams?: any;
  buttons?: any;
  sequenceItems?: any;
  assignTagId?: string | null;
  assignAgentId?: string | null;
};

async function getOrg() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error("Unauthorized");
  return session.user.organizationId;
}

export async function getWelcomeMessages() {
  const organizationId = await getOrg();
  const messages = await prisma.welcomeMessage.findMany({
    where: { organizationId },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  return { messages };
}

export async function createWelcomeMessage(data: WelcomeMessageData) {
  const organizationId = await getOrg();
  const msg = await prisma.welcomeMessage.create({
    data: {
      organizationId,
      name: data.name,
      content: data.content,
      mediaUrl: data.mediaUrl ?? null,
      mediaType: data.mediaType ?? null,
      isActive: data.isActive ?? true,
      priority: data.priority ?? 0,
      delaySeconds: data.delaySeconds ?? 0,
      conditions: (data.conditions ?? []) as any,
      conditionLogic: data.conditionLogic ?? "OR",
      platform: data.platform ?? "ALL",
      templateName: data.templateName ?? null,
      templateLanguage: data.templateLanguage ?? null,
      templateParams: data.templateParams ?? null,
      buttons: data.buttons ?? null,
      sequenceItems: data.sequenceItems ?? [],
      assignTagId: (data as any).assignTagId ?? null,
      assignAgentId: (data as any).assignAgentId ?? null,
    },
  });
  // Log
  try { 
    const sess = await getServerSession(authOptions); 
    if (sess?.user?.organizationId) {
      await logActivity({ organizationId: sess.user.organizationId, userId: sess.user.id, userEmail: sess.user.email, userName: sess.user.name, action: "Created", module: "Welcome Messages", target: data.name, status: "success" }); 
    }
  } catch {}
  revalidatePath("/dashboard/welcome-messages");
  return { success: true, message: msg };
}

export async function updateWelcomeMessage(
  id: string,
  data: Partial<WelcomeMessageData>,
) {
  const organizationId = await getOrg();
  const msg = await (prisma as any).welcomeMessage.updateMany({
    where: { id, organizationId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.mediaUrl !== undefined && { mediaUrl: data.mediaUrl }),
      ...(data.mediaType !== undefined && { mediaType: data.mediaType }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.delaySeconds !== undefined && {
        delaySeconds: data.delaySeconds,
      }),
      ...(data.conditions !== undefined && {
        conditions: data.conditions as any,
      }),
      ...(data.conditionLogic !== undefined && {
        conditionLogic: data.conditionLogic,
      }),
      ...(data.platform !== undefined && { platform: data.platform }),
      ...(data.templateName !== undefined && { templateName: data.templateName }),
      ...(data.templateLanguage !== undefined && { templateLanguage: data.templateLanguage }),
      ...(data.templateParams !== undefined && { templateParams: data.templateParams }),
      ...(data.buttons !== undefined && { buttons: data.buttons }),
      ...(data.sequenceItems !== undefined && { sequenceItems: data.sequenceItems }),
      ...((data as any).assignTagId !== undefined && { assignTagId: (data as any).assignTagId }),
      ...((data as any).assignAgentId !== undefined && { assignAgentId: (data as any).assignAgentId }),
    },
  });
  try { 
    const sess = await getServerSession(authOptions); 
    if (sess?.user?.organizationId) {
      await logActivity({ organizationId: sess.user.organizationId, userId: sess.user.id, userEmail: sess.user.email, userName: sess.user.name, action: "Updated", module: "Welcome Messages", target: id, status: "success" }); 
    }
  } catch {}
  revalidatePath("/dashboard/welcome-messages");
  return { success: true };
}

export async function deleteWelcomeMessage(id: string) {
  const organizationId = await getOrg();
  await prisma.welcomeMessage.deleteMany({ where: { id, organizationId } });
  
  const sess = await getServerSession(authOptions);
  if (sess?.user?.organizationId) {
    try {
      await logActivity({
        organizationId: sess.user.organizationId,
        userId: sess.user.id,
        userEmail: sess.user.email,
        userName: sess.user.name,
        action: "Deleted",
        module: "Welcome Messages",
        target: id,
        status: "success"
      });
    } catch {}
  }

  revalidatePath("/dashboard/welcome-messages");
  return { success: true };
}

export async function toggleWelcomeMessage(id: string, isActive: boolean) {
  const organizationId = await getOrg();
  await prisma.welcomeMessage.updateMany({
    where: { id, organizationId },
    data: { isActive },
  });
  revalidatePath("/dashboard/welcome-messages");
  return { success: true };
}
