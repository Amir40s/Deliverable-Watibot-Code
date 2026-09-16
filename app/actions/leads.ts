"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function getAdLeadsReport() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized")
  }

  // Fetch messages with referral data in rawBody
  // We use raw query for Postgres JSON extraction to ensure accuracy
  const leads = await prisma.$queryRaw`
    SELECT 
      m.id, 
      m."contactId", 
      c."waId", 
      c.name as "contactName",
      m.content, 
      m."rawBody", 
      m."createdAt"
    FROM "Message" m
    JOIN "Contact" c ON m."contactId" = c.id
    WHERE c."organizationId" = ${session.user.organizationId}
      AND m."rawBody"->'referral' IS NOT NULL
    ORDER BY m."createdAt" DESC
  ` as any[]

  return leads.map(lead => ({
    id: lead.id,
    waId: lead.waId,
    contactName: lead.contactName,
    message: lead.content,
    createdAt: lead.createdAt,
    referral: lead.rawBody.referral
  }))
}
