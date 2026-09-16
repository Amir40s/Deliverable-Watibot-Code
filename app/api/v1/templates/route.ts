import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { formatTemplate } from "@/lib/api/mobile-route-utils";
import { enrichComponentsWithExamples } from "@/lib/whatsapp/templateUtils";

/**
 * GET /api/v1/templates
 *
 * List all WhatsApp templates for the project with full Web CRM parity.
 * Fetches directly from the Meta Graph API using the organization's access token.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  let metaAccessToken = org.metaAccessToken;
  let whatsappBusinessId = org.whatsappBusinessId;
  let instagramAccessToken = org.instagramAccessToken;

  if (!metaAccessToken || !whatsappBusinessId) {
    if (org.ownerId) {
      const parentOrg = await prisma.organization.findFirst({
        where: {
          ownerId: org.ownerId,
          metaAccessToken: { not: null },
          whatsappBusinessId: { not: null },
        },
      });
      if (parentOrg) {
        metaAccessToken = metaAccessToken || parentOrg.metaAccessToken;
        whatsappBusinessId = whatsappBusinessId || parentOrg.whatsappBusinessId;
        instagramAccessToken = instagramAccessToken || parentOrg.instagramAccessToken;
      }
    }
  }

  if (!metaAccessToken || !whatsappBusinessId || whatsappBusinessId.startsWith('qr_')) {
    return NextResponse.json({
      status: 200,
      success: true,
      project_id: org.id,
      business_id: null,
      total: 0,
      count: 0,
      data: [],
      templates: [],
      message: whatsappBusinessId?.startsWith('qr_')
        ? "QR WhatsApp sessions do not use Cloud API templates."
        : "WhatsApp is not configured for this account.",
    });
  }

  const sp = req.nextUrl.searchParams;
  const searchQuery = (sp.get("q") || sp.get("search") || "").trim().toLowerCase();
  const filterCategory = (sp.get("category") || "ALL").trim().toUpperCase();
  const filterStatus = (sp.get("status") || "ALL").trim().toUpperCase();
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 250), 1), 250);
  const page = Math.max(Number(sp.get("page") ?? 1), 1);
  const offset = sp.get("offset") ? Math.max(Number(sp.get("offset")), 0) : (page - 1) * limit;

  let targetWabaId = whatsappBusinessId;
  const getTemplateUrl = (id: string) => `https://graph.facebook.com/v21.0/${id}/message_templates?limit=250`;

  let res = await fetch(getTemplateUrl(targetWabaId), {
    headers: {
      Authorization: `Bearer ${metaAccessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  let data = await res.json();
  let tokenToUse = metaAccessToken;

  // Fallback to instagramAccessToken if metaAccessToken fails with 403 / permission error / data.error
  if (
    (res.status === 403 || data?.error) &&
    instagramAccessToken &&
    instagramAccessToken !== metaAccessToken
  ) {
    const fallbackRes = await fetch(getTemplateUrl(targetWabaId), {
      headers: {
        Authorization: `Bearer ${instagramAccessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const fallbackData = await fallbackRes.json();
    if (fallbackRes.ok && !fallbackData.error) {
      res = fallbackRes;
      data = fallbackData;
      tokenToUse = instagramAccessToken;
    }
  }

  // If Meta returns error #200 (You do not have permission to access this field), check if whatsappBusinessId is actually a Phone Number ID
  if (data?.error?.code === 200 || data?.error?.message?.includes("permission to access this field")) {
    try {
      const nodeRes = await fetch(`https://graph.facebook.com/v21.0/${targetWabaId}?fields=whatsapp_business_account`, {
        headers: { Authorization: `Bearer ${tokenToUse}` },
      });
      const nodeData = await nodeRes.json();
      const realWabaId = nodeData?.whatsapp_business_account?.id;
      if (realWabaId && realWabaId !== targetWabaId) {
        targetWabaId = realWabaId;
        const retryRes = await fetch(getTemplateUrl(targetWabaId), {
          headers: {
            Authorization: `Bearer ${tokenToUse}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });
        const retryData = await retryRes.json();
        if (retryRes.ok && !retryData.error) {
          res = retryRes;
          data = retryData;
        }
      }
    } catch (_) {}
  }

  if (data.error || !Array.isArray(data.data)) {
    console.error("[GET /api/v1/templates] Meta Error:", JSON.stringify(data?.error ?? data));
    return NextResponse.json({
      status: 200,
      success: true,
      project_id: org.id,
      business_id: org.whatsappBusinessId,
      total: 0,
      count: 0,
      data: [],
      templates: [],
      error: null,
    });
  }

  const rawList: any[] = data.data ?? [];

  // Fetch individual live details for each template using template ID API (exact Web CRM parity)
  const enrichedTemplates = await Promise.all(
    rawList.map(async (tmpl: any) => {
      if (!tmpl.id) return tmpl;
      try {
        const detailRes = await fetch(`https://graph.facebook.com/v21.0/${tmpl.id}`, {
          headers: {
            Authorization: `Bearer ${tokenToUse}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });
        const detailData = await detailRes.json();
        if (detailData && !detailData.error) {
          return detailData;
        }
      } catch (_) {}
      return tmpl;
    })
  );

  // Filter according to Web CRM business logic
  let filtered = enrichedTemplates.filter((t: any) => {
    // 1. Search Query: Matches template name OR body text
    const bodyText = t.components?.find((c: any) => c.type === "BODY")?.text?.toLowerCase() || "";
    const nameText = (t.name || "").toLowerCase();
    const matchesSearch = !searchQuery || nameText.includes(searchQuery) || bodyText.includes(searchQuery);

    // 2. Category Filter
    const matchesCategory = filterCategory === "ALL" || (t.category || "").toUpperCase() === filterCategory;

    // 3. Status Filter
    const matchesStatus = filterStatus === "ALL" || (t.status || "").toUpperCase() === filterStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalFiltered = filtered.length;

  // Apply offset / pagination if specified
  if (sp.has("page") || sp.has("offset")) {
    filtered = filtered.slice(offset, offset + limit);
  }

  const formattedTemplates = filtered.map((t: any) => formatTemplate(t, org.id, org.whatsappBusinessId));

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    business_id: org.whatsappBusinessId,
    total: totalFiltered,
    count: formattedTemplates.length,
    data: formattedTemplates,
    templates: formattedTemplates,
    paging: data?.paging ?? {},
  });
}

/**
 * POST /api/v1/templates
 *
 * Submit a new WhatsApp template message for approval.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  if (!org.metaAccessToken || !org.whatsappBusinessId) {
    return NextResponse.json({ status: 533, error: "WhatsApp is not connected for this account." }, { status: 503 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: 400, error: "Invalid JSON body." }, { status: 400 });
  }

  const { name, language, category, components, text, bodyText, body: bodyContent, buttons, footer, footerText, header } = body;
  if (!name) return NextResponse.json({ status: 400, error: "'name' is required." }, { status: 400 });
  if (!language) return NextResponse.json({ status: 400, error: "'language' is required." }, { status: 400 });
  if (!category) return NextResponse.json({ status: 400, error: "'category' is required." }, { status: 400 });

  let payloadComponents: any[] = Array.isArray(components) ? [...components] : [];

  if (payloadComponents.length === 0) {
    const mainBody = (typeof bodyContent === "string" ? bodyContent : null) || bodyText || text;
    if (mainBody) {
      payloadComponents.push({ type: "BODY", text: mainBody });
    }
    if (header) {
      if (typeof header === "string") {
        payloadComponents.unshift({ type: "HEADER", format: "TEXT", text: header });
      } else if (typeof header === "object") {
        const format = (header.format || header.type || "TEXT").toUpperCase();
        if (format === "IMAGE" || format === "VIDEO" || format === "DOCUMENT" || format === "LOCATION") {
          const mediaUrl = header.example?.header_url?.[0] || header.header_url || header.handle || header.url;
          payloadComponents.unshift({
            type: "HEADER",
            format,
            ...(mediaUrl ? { example: { header_url: [mediaUrl] } } : {}),
          });
        } else {
          // TEXT Header
          payloadComponents.unshift({
            type: "HEADER",
            format: "TEXT",
            text: header.text || header.value || header.headerText || "",
          });
        }
      }
    }
    const mainFooter = footerText || footer;
    if (mainFooter) {
      payloadComponents.push({ type: "FOOTER", text: mainFooter });
    }
    if (Array.isArray(buttons) && buttons.length > 0) {
      payloadComponents.push({ type: "BUTTONS", buttons });
    }
  }

  // 1. Sanitize Body Component & Add Example for Variables {{1}}, {{2}}
  const bodyComp = payloadComponents.find((c: any) => c.type === "BODY");
  if (bodyComp && bodyComp.text) {
    const matches = bodyComp.text.match(/\{\{\d+\}\}/g);
    if (matches && matches.length > 0 && (!bodyComp.example || !bodyComp.example.body_text)) {
      const samples = matches.map((_: any, idx: number) => `Sample ${idx + 1}`);
      bodyComp.example = {
        body_text: [samples],
      };
    }
  }

  // 2. Sanitize Buttons Component & Ensure URL buttons have http:// or https://
  const buttonsComp = payloadComponents.find((c: any) => c.type === "BUTTONS");
  if (buttonsComp && Array.isArray(buttonsComp.buttons)) {
    buttonsComp.buttons = buttonsComp.buttons.map((b: any) => {
      if (b.type === "URL" && b.url) {
        let cleanUrl = String(b.url).trim();
        if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
          cleanUrl = `https://${cleanUrl}`;
        }
        return { ...b, url: cleanUrl };
      }
      return b;
    });
  }

  // 3. Sanitize Header Component for Media Headers (Generate Meta header_handle if media URL provided)
  const headerComp = payloadComponents.find((c: any) => c.type === "HEADER");
  if (headerComp && (headerComp.format === "IMAGE" || headerComp.format === "VIDEO" || headerComp.format === "DOCUMENT")) {
    const mediaUrl = headerComp.example?.header_handle?.[0] || headerComp.example?.header_url?.[0] || headerComp.header_url || headerComp.handle || headerComp.url;
    if (mediaUrl && String(mediaUrl).startsWith("http")) {
      const handle = await getMetaHeaderHandle(String(mediaUrl), org.metaAccessToken, org.whatsappBusinessId);
      if (handle) {
        headerComp.example = { header_handle: [handle] };
      } else {
        headerComp.example = { header_url: [String(mediaUrl)] };
      }
    }
  }

  const formattedName = String(name).toLowerCase().replace(/\s+/g, "_");

  const metaRes = await fetch(
    `https://graph.facebook.com/v21.0/${org.whatsappBusinessId}/message_templates`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${org.metaAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: formattedName,
        language,
        category,
        allow_category_change: true,
        components: enrichComponentsWithExamples(payloadComponents),
      }),
    }
  );
  const metaData = await metaRes.json();

  if (metaData.error) {
    const errMsg = metaData.error.error_user_msg || metaData.error.message || "Invalid parameter";
    return NextResponse.json({ status: 422, error: `Meta API error: ${errMsg}` }, { status: 422 });
  }

  const createdTemplate = formatTemplate(
    {
      id: metaData.id,
      name: formattedName,
      status: metaData.status || "PENDING",
      category,
      language,
      components: payloadComponents,
    },
    org.id,
    org.whatsappBusinessId
  );

  return NextResponse.json(
    {
      status: 201,
      success: true,
      data: createdTemplate,
      template: createdTemplate,
    },
    { status: 201 }
  );
}

/**
 * Uploads media from public URL to Meta Upload API to get a header_handle for template creation.
 */
async function getMetaHeaderHandle(mediaUrl: string, accessToken: string, wabaId: string): Promise<string | null> {
  try {
    const mediaRes = await fetch(mediaUrl);
    if (!mediaRes.ok) return null;
    const arrayBuffer = await mediaRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = mediaRes.headers.get("content-type") || "image/jpeg";
    const fileSize = buffer.length;

    // 1. Create upload session with Meta WABA / App
    const sessionRes = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/uploads?file_length=${fileSize}&file_type=${encodeURIComponent(contentType)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    let sessionData = await sessionRes.json();

    // Fallback to app uploads if WABA uploads endpoint returns error
    if (!sessionData.id) {
      const appSessionRes = await fetch(
        `https://graph.facebook.com/v21.0/app/uploads?file_length=${fileSize}&file_type=${encodeURIComponent(contentType)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      sessionData = await appSessionRes.json();
    }

    if (!sessionData.id) return null;

    // 2. Upload file content to session
    const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${sessionData.id}`, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${accessToken}`,
        file_offset: "0",
        "Content-Type": contentType,
      },
      body: buffer,
    });
    const uploadData = await uploadRes.json();
    return uploadData.h || null;
  } catch (err) {
    console.error("Failed to generate Meta header handle:", err);
    return null;
  }
}
