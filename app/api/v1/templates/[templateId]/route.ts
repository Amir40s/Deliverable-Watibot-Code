import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { formatTemplate } from "@/lib/api/mobile-route-utils";

/**
 * GET /api/v1/templates/:templateId
 *
 * Get a specific WhatsApp template by its Meta template ID.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  if (!org.metaAccessToken || !org.whatsappBusinessId) {
    return apiError(503, "WhatsApp is not connected for this account.");
  }

  const fetchMetaTemplate = async (token: string, fields?: string) => {
    const url = fields && fields.trim().length > 0
      ? `https://graph.facebook.com/v21.0/${templateId}?fields=${fields.trim()}`
      : `https://graph.facebook.com/v21.0/${templateId}`;
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  };

  let metaRes = await fetchMetaTemplate(org.metaAccessToken);
  let metaData = await metaRes.json();

  // Fallback to instagramAccessToken if metaAccessToken fails
  if (
    (metaRes.status === 401 || metaRes.status === 403 || metaData.error) &&
    org.instagramAccessToken &&
    org.instagramAccessToken !== org.metaAccessToken
  ) {
    const fallbackRes = await fetchMetaTemplate(org.instagramAccessToken);
    const fallbackData = await fallbackRes.json();
    if (fallbackRes.ok && !fallbackData.error) {
      metaRes = fallbackRes;
      metaData = fallbackData;
    }
  }

  if (metaData.error) {
    return apiError(
      metaData.error.code === 100 ? 404 : 422,
      `Meta API error: ${metaData.error.message}`
    );
  }

  const template = formatTemplate(metaData, org.id, org.whatsappBusinessId);

  return NextResponse.json({
    status: 200,
    success: true,
    data: template,
    template: template,
  });
}

/**
 * DELETE /api/v1/templates/:templateId
 *
 * Delete a WhatsApp template message.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  if (!org.metaAccessToken || !org.whatsappBusinessId) {
    return apiError(503, "WhatsApp is not connected for this account.");
  }

  const fetchMetaName = async (token: string) => {
    return fetch(
      `https://graph.facebook.com/v21.0/${templateId}?fields=name`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  };

  let fetchRes = await fetchMetaName(org.metaAccessToken);
  let fetchData = await fetchRes.json();

  if ((fetchRes.status === 401 || fetchRes.status === 403 || fetchData.error) && org.instagramAccessToken && org.instagramAccessToken !== org.metaAccessToken) {
    const fallbackRes = await fetchMetaName(org.instagramAccessToken);
    const fallbackData = await fallbackRes.json();
    if (fallbackRes.ok && !fallbackData.error) {
      fetchRes = fallbackRes;
      fetchData = fallbackData;
    }
  }

  if (fetchData.error) {
    return apiError(404, `Template not found or Meta API error: ${fetchData.error.message}`);
  }

  const templateName = fetchData.name;

  const deleteMetaTemplate = async (token: string) => {
    return fetch(
      `https://graph.facebook.com/v21.0/${org.whatsappBusinessId}/message_templates?hsm_id=${templateId}&name=${encodeURIComponent(templateName)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  };

  let metaRes = await deleteMetaTemplate(org.metaAccessToken);
  let metaData = await metaRes.json();

  if ((metaRes.status === 401 || metaRes.status === 403 || metaData.error) && org.instagramAccessToken && org.instagramAccessToken !== org.metaAccessToken) {
    const fallbackRes = await deleteMetaTemplate(org.instagramAccessToken);
    const fallbackData = await fallbackRes.json();
    if (fallbackRes.ok && !fallbackData.error) {
      metaRes = fallbackRes;
      metaData = fallbackData;
    }
  }

  if (metaData.error) {
    return apiError(422, `Meta API error: ${metaData.error.message}`);
  }

  return NextResponse.json({
    status: 200,
    success: true,
    message: "Template deleted successfully",
  });
}

