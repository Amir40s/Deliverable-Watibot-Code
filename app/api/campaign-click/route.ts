import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Prisma } from "@/lib/generated/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function toJsonRecord(value: unknown): JsonRecord {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as JsonRecord)
        : { value };
    } catch {
      return { value };
    }
  }

  return typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function getCampaignIdFromRawBody(rawBody: unknown) {
  const raw = toJsonRecord(rawBody);
  const campaign = toJsonRecord(raw.campaign);
  return typeof campaign.scheduledMessageId === "string" ? campaign.scheduledMessageId : null;
}

function decodeTargetUrl(encodedUrl: string | null) {
  if (!encodedUrl) return null;

  try {
    const decoded = Buffer.from(encodedUrl, "base64url").toString("utf8");
    const url = new URL(decoded);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function appendCampaignClick(rawBody: unknown, click: JsonRecord) {
  const raw = toJsonRecord(rawBody);
  const campaign = toJsonRecord(raw.campaign);
  const clicks = Array.isArray(campaign.clicks) ? campaign.clicks : [];

  return {
    ...raw,
    campaign: {
      ...campaign,
      clicks: [...clicks, click],
    },
  } as Prisma.InputJsonValue;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const scheduledMessageId = searchParams.get("sid");
  const contactId = searchParams.get("cid");
  const targetUrl = decodeTargetUrl(searchParams.get("u"));
  const buttonText = searchParams.get("t") || "Button";

  if (!targetUrl) {
    return NextResponse.json({ success: false, error: "Invalid campaign link" }, { status: 400 });
  }

  const redirect = NextResponse.redirect(targetUrl, { status: 302 });
  if (!scheduledMessageId || !contactId) return redirect;

  try {
    const campaign = await prisma.scheduledMessage.findUnique({
      where: { id: scheduledMessageId },
      select: {
        id: true,
        type: true,
        contactId: true,
        groupId: true,
        scheduledAt: true,
        group: {
          select: {
            contacts: {
              select: { contactId: true },
            },
          },
        },
      },
    });

    if (!campaign || campaign.type !== "DRIP") return redirect;

    const targetContactIds = new Set<string>();
    if (campaign.contactId) targetContactIds.add(campaign.contactId);
    campaign.group?.contacts.forEach((member) => targetContactIds.add(member.contactId));
    if (!targetContactIds.has(contactId)) return redirect;

    const candidates = await prisma.message.findMany({
      where: {
        contactId,
        direction: "outbound",
        createdAt: {
          gte: new Date(new Date(campaign.scheduledAt).getTime() - 10 * 60 * 1000),
        },
      },
      select: {
        id: true,
        rawBody: true,
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    const outboundMessage = candidates.find((message) => getCampaignIdFromRawBody(message.rawBody) === scheduledMessageId);
    if (!outboundMessage) {
      logger.general.warn(
        "CampaignClick",
        `Tracked click received before outbound message was tagged. campaign=${scheduledMessageId} contact=${contactId}`
      );
      return redirect;
    }

    await prisma.message.update({
      where: { id: outboundMessage.id },
      data: {
        rawBody: appendCampaignClick(outboundMessage.rawBody, {
          scheduledMessageId,
          contactId,
          targetUrl,
          buttonText,
          clickedAt: new Date().toISOString(),
          userAgent: req.headers.get("user-agent") || null,
        }),
      },
    });
  } catch (error) {
    logger.general.warn("CampaignClick", `Failed to record campaign click: ${String(error)}`);
  }

  return redirect;
}
