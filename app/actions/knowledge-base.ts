"use strict";
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { syncKnowledgeToAssistant } from "@/lib/ai/openai";
import { logActivity } from "@/lib/activityLog";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Asserts whether the current session is allowed to modify the Knowledge Base.
 * - Allowed if Knowledge Base Management is "user".
 * - Allowed if session is an Admin impersonating the user (originalAdminId is set).
 * - Allowed if user is SUPER_ADMIN.
 * - Denied if Knowledge Base Management is "admin" and request is from the regular user.
 */
async function assertKnowledgeBaseAccess(organizationId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const isImpersonating = !!(session.user.originalAdminId && session.user.originalAdminId !== session.user.id);

  if (isSuperAdmin || isImpersonating) {
    return session;
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { vendorConfig: true }
  });

  const config = (org?.vendorConfig as Record<string, any> | null) || {};
  const kbManagement = config.knowledgeBaseManagement || "user";
  if (kbManagement === "admin") {
    throw new Error("Knowledge Base management is restricted to administrators.");
  }

  return session;
}

export async function addKnowledgeEntry(formData: FormData, organizationId: string) {
  await assertKnowledgeBaseAccess(organizationId);

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;

  const aiAgentId = formData.get("aiAgentId") as string || null;

  const knowledgeBase = await prisma.knowledgeBase.create({
    data: {
      organizationId,
      title,
      content,
      status: "active",
      ...(aiAgentId ? { agentFiles: { create: { aiAgentId } } } : {})
    }
  });

  revalidatePath("/dashboard/knowledge-base");
  
  await syncKnowledgeToAssistant(organizationId, aiAgentId || undefined);

  const session = await getServerSession(authOptions);
  logActivity({ 
    organizationId, 
    userId: session?.user?.id,
    userName: session?.user?.name,
    userEmail: session?.user?.email,
    action: "Created", 
    module: "Knowledge Base", 
    target: title, 
    status: "success" 
  });
  return { success: true };
}

export async function deleteKnowledgeEntry(id: string) {
  let entry: any = null;
  try {
    entry = await prisma.knowledgeBase.findUnique({ 
      where: { id }, 
      select: { organizationId: true } 
    });

    if (entry) {
      await assertKnowledgeBaseAccess(entry.organizationId);

      await prisma.knowledgeBase.delete({ where: { id } });
      const session = await getServerSession(authOptions);
      if (session?.user) {
        await logActivity({
          organizationId: session.user.organizationId!,
          userId: session.user.id,
          action: 'Deleted Knowledge Base Entry',
          module: 'Knowledge Base',
          target: id,
          details: `Deleted entry`,
          status: 'success',
          userEmail: session.user.email,
          userName: session.user.name
        }).catch(() => {});
      }

      revalidatePath("/dashboard/knowledge-base");
      await syncKnowledgeToAssistant(entry.organizationId);
    }
  } catch (error: any) {
    console.error("Database deletion failed:", error);
    return { success: false, error: error?.message || "Failed to delete knowledge entry" };
  }

  const session = await getServerSession(authOptions);
  if (entry) {
    logActivity({ 
      organizationId: entry.organizationId, 
      userId: session?.user?.id,
      userName: session?.user?.name,
      userEmail: session?.user?.email,
      action: "Deleted", 
      module: "Knowledge Base", 
      target: id, 
      status: "success" 
    });
  }
  return { success: true };
}

export async function syncKnowledgeAction(organizationId: string, aiAgentId?: string | null) {
  try {
    await assertKnowledgeBaseAccess(organizationId);
    const result = await syncKnowledgeToAssistant(organizationId, aiAgentId || undefined);
    return { success: true, assistantId: result?.assistantId || undefined };
  } catch (error: any) {
    console.error("Sync Error:", error);
    return { success: false, error: error.message };
  }
}

export async function updateKnowledgeEntry(id: string, title: string, content: string, aiAgentId?: string | null) {
  if (!id || !title || !content) {
    throw new Error("ID, Title, and Content are required");
  }

  const existing = await prisma.knowledgeBase.findUnique({
    where: { id },
    select: { organizationId: true }
  });

  if (!existing) {
    throw new Error("Knowledge Base entry not found");
  }

  await assertKnowledgeBaseAccess(existing.organizationId);

  const updated = await prisma.knowledgeBase.update({
    where: { id },
    data: {
      title,
      content,
    }
  });

  if (aiAgentId) {
    // Only upsert the agent file linkage if explicitly provided
    await prisma.agentFile.upsert({
      where: { aiAgentId_knowledgeBaseId: { aiAgentId, knowledgeBaseId: id } },
      create: { aiAgentId, knowledgeBaseId: id },
      update: {}
    });
  }

  revalidatePath("/dashboard/knowledge-base");

  await syncKnowledgeToAssistant(updated.organizationId);

  const session = await getServerSession(authOptions);
  logActivity({
    organizationId: updated.organizationId,
    userId: session?.user?.id,
    userName: session?.user?.name,
    userEmail: session?.user?.email,
    action: "Updated",
    module: "Knowledge Base",
    target: title,
    status: "success"
  });

  return { success: true };
}

export async function addGoogleSheetKnowledgeEntry(
  title: string,
  spreadsheetId: string,
  sheetName: string = "Sheet1",
  organizationId: string,
  aiAgentId?: string | null
) {
  await assertKnowledgeBaseAccess(organizationId);

  const { getGoogleSheetContent } = await import("@/lib/flows/integrations/google-sheets");

  if (!title || !spreadsheetId) {
    throw new Error("Title and Spreadsheet ID are required");
  }

  const content = await getGoogleSheetContent(spreadsheetId, sheetName);
  if (!content) {
    throw new Error("No data found in the spreadsheet or sheet is empty.");
  }

  const sourceUrl = `googlesheets://${spreadsheetId}/${sheetName}`;

  const existing = await prisma.knowledgeBase.findFirst({
    where: {
      organizationId,
      sourceUrl,
    }
  });

  let entry;
  if (existing) {
    entry = await prisma.knowledgeBase.update({
      where: { id: existing.id },
      data: {
        title,
        content,
        updatedAt: new Date()
      }
    });

    if (aiAgentId) {
      await prisma.agentFile.upsert({
        where: { aiAgentId_knowledgeBaseId: { aiAgentId, knowledgeBaseId: existing.id } },
        create: { aiAgentId, knowledgeBaseId: existing.id },
        update: {}
      });
    }
  } else {
    entry = await prisma.knowledgeBase.create({
      data: {
        organizationId,
        title,
        content,
        sourceUrl,
        fileName: spreadsheetId,
        status: "active",
        ...(aiAgentId ? { agentFiles: { create: { aiAgentId } } } : {})
      }
    });
  }

  revalidatePath("/dashboard/knowledge-base");

  await syncKnowledgeToAssistant(organizationId, aiAgentId || undefined);

  const session = await getServerSession(authOptions);
  logActivity({ 
    organizationId, 
    userId: session?.user?.id,
    userName: session?.user?.name,
    userEmail: session?.user?.email,
    action: existing ? "Updated Google Sheet" : "Added Google Sheet", 
    module: "Knowledge Base", 
    target: title, 
    status: "success" 
  });

  return { success: true, id: entry.id };
}

export async function syncGoogleSheetKnowledgeEntry(id: string) {
  const entry = await prisma.knowledgeBase.findUnique({
    where: { id }
  });

  if (!entry) {
    throw new Error("Knowledge base entry not found");
  }

  await assertKnowledgeBaseAccess(entry.organizationId);

  const { getGoogleSheetContent } = await import("@/lib/flows/integrations/google-sheets");

  if (!entry.sourceUrl || !entry.sourceUrl.startsWith("googlesheets://")) {
    throw new Error("This entry is not linked to a Google Sheet");
  }

  const parts = entry.sourceUrl.replace("googlesheets://", "").split("/");
  const spreadsheetId = parts[0];
  const sheetName = parts[1] || "Sheet1";

  const content = await getGoogleSheetContent(spreadsheetId, sheetName);
  if (!content) {
    throw new Error("No data found in the spreadsheet or sheet is empty.");
  }

  await prisma.knowledgeBase.update({
    where: { id },
    data: {
      content,
      updatedAt: new Date()
    }
  });

  revalidatePath("/dashboard/knowledge-base");

  await syncKnowledgeToAssistant(entry.organizationId);

  const session = await getServerSession(authOptions);
  logActivity({ 
    organizationId: entry.organizationId, 
    userId: session?.user?.id,
    userName: session?.user?.name,
    userEmail: session?.user?.email,
    action: "Synced Google Sheet", 
    module: "Knowledge Base", 
    target: entry.title, 
    status: "success" 
  });

  return { success: true };
}

export async function getGoogleServiceAccountEmail() {
  return process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
}

export interface AddWebsiteKnowledgeParams {
  url: string;
  customTitle?: string;
  organizationId: string;
  crawlMode?: 'single' | 'deep';
  maxPages?: number;
  aiAgentId?: string | null;
}

export async function addWebsiteKnowledgeEntry(params: AddWebsiteKnowledgeParams) {
  const { url, customTitle, organizationId, crawlMode = 'single', maxPages = 5, aiAgentId } = params;
  await assertKnowledgeBaseAccess(organizationId);

  if (!url || !url.trim()) {
    throw new Error("Website URL is required");
  }

  const { crawlWebsite, normalizeUrl } = await import("@/lib/ai/web-scraper");
  const normalizedUrl = normalizeUrl(url);

  // Scrape website (single page or deep crawl)
  const pages = await crawlWebsite(normalizedUrl, {
    crawlMode,
    maxPages: crawlMode === 'deep' ? Math.min(Math.max(maxPages, 2), 10) : 1,
  });

  if (!pages || pages.length === 0) {
    throw new Error("Could not extract any content from the provided URL.");
  }

  const createdIds: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const entryTitle = i === 0 && customTitle && customTitle.trim()
      ? customTitle.trim()
      : `[Web] ${page.title || new URL(page.url).pathname}`;

    // Check if an entry for this exact URL already exists for this org
    const existing = await prisma.knowledgeBase.findFirst({
      where: {
        organizationId,
        sourceUrl: page.url,
      }
    });

    let entry;
    if (existing) {
      entry = await prisma.knowledgeBase.update({
        where: { id: existing.id },
        data: {
          title: entryTitle,
          content: page.content,
          updatedAt: new Date(),
        }
      });

      if (aiAgentId) {
        await prisma.agentFile.upsert({
          where: { aiAgentId_knowledgeBaseId: { aiAgentId, knowledgeBaseId: existing.id } },
          create: { aiAgentId, knowledgeBaseId: existing.id },
          update: {}
        });
      }
    } else {
      entry = await prisma.knowledgeBase.create({
        data: {
          organizationId,
          title: entryTitle,
          content: page.content,
          sourceUrl: page.url,
          fileName: new URL(page.url).hostname,
          status: "active",
          ...(aiAgentId ? { agentFiles: { create: { aiAgentId } } } : {})
        }
      });
    }

    createdIds.push(entry.id);
  }

  revalidatePath("/dashboard/knowledge-base");
  await syncKnowledgeToAssistant(organizationId, aiAgentId || undefined);

  const session = await getServerSession(authOptions);
  logActivity({
    organizationId,
    userId: session?.user?.id,
    userName: session?.user?.name,
    userEmail: session?.user?.email,
    action: pages.length > 1 ? `Scraped Website (${pages.length} pages)` : "Scraped Website",
    module: "Knowledge Base",
    target: customTitle || normalizedUrl,
    details: `Scraped ${pages.length} page(s) from ${normalizedUrl}`,
    status: "success"
  });

  return {
    success: true,
    count: pages.length,
    pages: pages.map(p => ({ url: p.url, title: p.title })),
  };
}

export async function syncWebsiteKnowledgeEntry(id: string) {
  const entry = await prisma.knowledgeBase.findUnique({
    where: { id }
  });

  if (!entry) {
    throw new Error("Knowledge base entry not found");
  }

  await assertKnowledgeBaseAccess(entry.organizationId);

  if (!entry.sourceUrl || (!entry.sourceUrl.startsWith("http://") && !entry.sourceUrl.startsWith("https://"))) {
    throw new Error("This entry is not linked to a valid website URL");
  }

  const { scrapeSinglePage } = await import("@/lib/ai/web-scraper");
  const scraped = await scrapeSinglePage(entry.sourceUrl);

  if (!scraped || !scraped.content) {
    throw new Error("Failed to fetch fresh content from website.");
  }

  await prisma.knowledgeBase.update({
    where: { id },
    data: {
      content: scraped.content,
      updatedAt: new Date(),
    }
  });

  revalidatePath("/dashboard/knowledge-base");
  await syncKnowledgeToAssistant(entry.organizationId);

  const session = await getServerSession(authOptions);
  logActivity({
    organizationId: entry.organizationId,
    userId: session?.user?.id,
    userName: session?.user?.name,
    userEmail: session?.user?.email,
    action: "Re-scraped Website",
    module: "Knowledge Base",
    target: entry.title,
    details: `Refreshed content from ${entry.sourceUrl}`,
    status: "success"
  });

  return { success: true };
}

export async function discoverWebsiteRoutesAction(url: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (!url || !url.trim()) {
    throw new Error("Website URL is required");
  }

  const { discoverWebsiteRoutes } = await import("@/lib/ai/web-scraper");
  const routes = await discoverWebsiteRoutes(url);

  return {
    success: true,
    routes,
  };
}

export async function importSelectedWebsitePagesAction(options: {
  organizationId: string;
  aiAgentId?: string;
  pages: Array<{ url: string; title?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const { organizationId, aiAgentId, pages } = options;

  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  if (!pages || pages.length === 0) {
    throw new Error("No pages selected for import");
  }

  const { scrapeSinglePage } = await import("@/lib/ai/web-scraper");
  const importedEntries: Array<{ id: string; title: string; url: string }> = [];

  for (const page of pages) {
    try {
      const scraped = await scrapeSinglePage(page.url);
      if (!scraped || !scraped.content || scraped.content.trim().length < 30) {
        continue;
      }

      const entryTitle = page.title && page.title.trim()
        ? `[Web] ${page.title.trim()}`
        : `[Web] ${scraped.title || new URL(page.url).pathname}`;

      // Check if entry with this sourceUrl already exists in organization
      const existing = await prisma.knowledgeBase.findFirst({
        where: {
          organizationId,
          sourceUrl: page.url,
        },
      });

      let entry;
      if (existing) {
        entry = await prisma.knowledgeBase.update({
          where: { id: existing.id },
          data: {
            title: entryTitle,
            content: scraped.content,
            updatedAt: new Date(),
          },
        });
      } else {
        entry = await prisma.knowledgeBase.create({
          data: {
            organizationId,
            title: entryTitle,
            content: scraped.content,
            sourceUrl: page.url,
            fileName: new URL(page.url).hostname,
            status: "active",
          },
        });
      }

      if (aiAgentId && entry) {
        await prisma.agentFile.upsert({
          where: { aiAgentId_knowledgeBaseId: { aiAgentId, knowledgeBaseId: entry.id } },
          create: { aiAgentId, knowledgeBaseId: entry.id },
          update: {},
        });
      }

      if (entry) {
        importedEntries.push({ id: entry.id, title: entryTitle, url: page.url });
      }
    } catch (pageErr: any) {
      console.warn(`[KnowledgeBase] Failed to scrape selected page ${page.url}:`, pageErr.message);
    }
  }

  if (importedEntries.length === 0) {
    throw new Error("Could not extract content from the selected pages. Please verify the URLs are accessible.");
  }

  revalidatePath("/dashboard/knowledge-base");
  await syncKnowledgeToAssistant(organizationId, aiAgentId || undefined);

  logActivity({
    organizationId,
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    action: `Imported ${importedEntries.length} Page(s) from Website`,
    module: "Knowledge Base",
    target: pages[0]?.url || "Website Pages",
    details: `Imported ${importedEntries.map(e => e.title).join(", ")}`,
    status: "success",
  });

  return {
    success: true,
    count: importedEntries.length,
    importedEntries,
  };
}

export async function importSingleWebsitePageAction(options: {
  organizationId: string;
  aiAgentId?: string;
  page: { url: string; title?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const { organizationId, aiAgentId, page } = options;

  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  if (!page || !page.url) {
    throw new Error("Page URL is required");
  }

  const { scrapeSinglePage } = await import("@/lib/ai/web-scraper");
  const scraped = await scrapeSinglePage(page.url, 12000);

  if (!scraped || !scraped.content || scraped.content.trim().length < 30) {
    return {
      success: false,
      error: "Content too short or inaccessible",
      url: page.url,
    };
  }

  const entryTitle = page.title && page.title.trim()
    ? `[Web] ${page.title.trim()}`
    : `[Web] ${scraped.title || new URL(page.url).pathname}`;

  // Check if entry with this sourceUrl already exists in organization
  const existing = await prisma.knowledgeBase.findFirst({
    where: {
      organizationId,
      sourceUrl: page.url,
    },
  });

  let entry;
  if (existing) {
    entry = await prisma.knowledgeBase.update({
      where: { id: existing.id },
      data: {
        title: entryTitle,
        content: scraped.content,
        updatedAt: new Date(),
      },
    });
  } else {
    entry = await prisma.knowledgeBase.create({
      data: {
        organizationId,
        title: entryTitle,
        content: scraped.content,
        sourceUrl: page.url,
        fileName: new URL(page.url).hostname,
        status: "active",
      },
    });
  }

  if (aiAgentId && entry) {
    await prisma.agentFile.upsert({
      where: { aiAgentId_knowledgeBaseId: { aiAgentId, knowledgeBaseId: entry.id } },
      create: { aiAgentId, knowledgeBaseId: entry.id },
      update: {},
    });
  }

  return {
    success: true,
    entry: {
      id: entry.id,
      title: entryTitle,
      url: page.url,
      content: scraped.content,
      charCount: scraped.charCount,
    },
  };
}

export async function finalizeWebsiteImportAction(options: {
  organizationId: string;
  aiAgentId?: string;
  count: number;
  sampleUrl?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const { organizationId, aiAgentId, count, sampleUrl } = options;

  revalidatePath("/dashboard/knowledge-base");
  await syncKnowledgeToAssistant(organizationId, aiAgentId || undefined);

  logActivity({
    organizationId,
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    action: `Imported ${count} Page(s) from Website`,
    module: "Knowledge Base",
    target: sampleUrl || "Website Pages",
    details: `Successfully scraped and synchronized ${count} web page(s)`,
    status: "success",
  });

  return { success: true };
}
