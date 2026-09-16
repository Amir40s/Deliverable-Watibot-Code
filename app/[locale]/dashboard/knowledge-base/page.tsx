import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import KnowledgeBaseClient from "./KnowledgeBaseClient";

export default async function KnowledgeBasePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return <div>Unauthorized</div>;

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const isImpersonating = !!(session.user.originalAdminId && session.user.originalAdminId !== session.user.id);

  if (!isSuperAdmin && !isImpersonating) {
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { vendorConfig: true },
    });
    const config = (org?.vendorConfig as Record<string, any> | null) || {};
    const kbManagement = config.knowledgeBaseManagement || "user";
    if (kbManagement === "admin") {
      redirect("/dashboard");
    }
  }

  let initialAgents: any[] = [];
  try {
    const loaded = await getAIAgents(session.user.organizationId);
    initialAgents = loaded ? JSON.parse(JSON.stringify(loaded)) : [];
  } catch (err) {
    console.error("Failed to prefetch AI agents for knowledge base:", err);
  }

  return (
    <KnowledgeBaseClient
      params={{ orgId: session.user.organizationId }}
      initialAgents={initialAgents}
    />
  );
}

