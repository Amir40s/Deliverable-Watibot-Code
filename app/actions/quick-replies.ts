"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { logActivity } from "@/lib/activityLog"

export async function getQuickReplies() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return []

  return prisma.quickReply.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: 'desc' }
  })
}

export async function createQuickReply(data: {
  name: string
  type: string
  content?: string
  fileUrl?: string
  fileName?: string
  fileUrls?: string[]
  fileNames?: string[]
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) throw new Error("Unauthorized")

  const finalFileUrl = data.fileUrls
    ? (data.fileUrls.length > 1 ? JSON.stringify(data.fileUrls) : (data.fileUrls[0] || null))
    : data.fileUrl;

  const finalFileName = data.fileNames
    ? (data.fileNames.length > 1 ? JSON.stringify(data.fileNames) : (data.fileNames[0] || null))
    : data.fileName;

  const reply = await prisma.quickReply.create({
    data: {
      name: data.name,
      type: data.type,
      content: data.content,
      fileUrl: finalFileUrl,
      fileName: finalFileName,
      organizationId: session.user.organizationId
    }
  })

  revalidatePath("/manage/quick-replies")
  logActivity({ organizationId: session.user.organizationId!, userId: session.user.id, userEmail: session.user.email, userName: session.user.name, action: "Created", module: "Quick Replies", target: data.name, status: "success" });
  return reply
}

export async function updateQuickReply(id: string, data: {
  name?: string
  type?: string
  content?: string
  fileUrl?: string
  fileName?: string
  fileUrls?: string[]
  fileNames?: string[]
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) throw new Error("Unauthorized")

  const existing = await prisma.quickReply.findFirst({
    where: { id, organizationId: session.user.organizationId }
  })
  if (!existing) throw new Error("Not found")

  let finalFileUrl: string | null | undefined = data.fileUrl;
  if (data.fileUrls !== undefined) {
    finalFileUrl = data.fileUrls.length > 1 ? JSON.stringify(data.fileUrls) : (data.fileUrls[0] || null);
  }

  let finalFileName: string | null | undefined = data.fileName;
  if (data.fileNames !== undefined) {
    finalFileName = data.fileNames.length > 1 ? JSON.stringify(data.fileNames) : (data.fileNames[0] || null);
  }

  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.content !== undefined) updateData.content = data.content;
  if (finalFileUrl !== undefined) updateData.fileUrl = finalFileUrl;
  if (finalFileName !== undefined) updateData.fileName = finalFileName;

  const reply = await prisma.quickReply.update({
    where: { id },
    data: updateData
  })

  revalidatePath("/manage/quick-replies")
  logActivity({ organizationId: session.user.organizationId!, userId: session.user.id, userEmail: session.user.email, userName: session.user.name, action: "Updated", module: "Quick Replies", target: existing.name, status: "success" });
  return reply
}

export async function deleteQuickReply(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) throw new Error("Unauthorized")

  const existing = await prisma.quickReply.findFirst({
    where: { id, organizationId: session.user.organizationId }
  })
  if (!existing) throw new Error("Not found")

  await prisma.quickReply.delete({
    where: { id }
  })

  revalidatePath("/manage/quick-replies")
  logActivity({ organizationId: session.user.organizationId!, userId: session.user.id, userEmail: session.user.email, userName: session.user.name, action: "Deleted", module: "Quick Replies", target: existing.name, status: "success" });
}
