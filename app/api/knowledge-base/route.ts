import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");

  if (!orgId) return NextResponse.json({ error: "Org ID required" }, { status: 400 });

  const session = await getServerSession(authOptions);
  if (session?.user) {
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";
    const isImpersonating = !!(session.user.originalAdminId && session.user.originalAdminId !== session.user.id);
    if (!isSuperAdmin && !isImpersonating) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { vendorConfig: true }
      });
      const config = (org?.vendorConfig as Record<string, any> | null) || {};
      if (config.knowledgeBaseManagement === "admin") {
        return NextResponse.json({ error: "Forbidden: Knowledge Base is managed by administrator." }, { status: 403 });
      }
    }
  }

  const entries = await prisma.knowledgeBase.findMany({
    where: { organizationId: orgId },
    include: { 
      agentFiles: {
        include: {
          aiAgent: {
            select: { id: true, name: true }
          }
        }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json(entries);
}
