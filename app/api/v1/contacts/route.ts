import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import {
  clampLimit,
  formatMobileContact,
  normalizeWaId,
} from "@/lib/api/mobile-formatters";
import { prisma } from "@/lib/prisma";
import { Platform, type Prisma } from "@/lib/generated/prisma";

function asBodyObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : undefined;
}

function normalizePlatform(value: unknown): Platform {
  const normalized = String(value || "WHATSAPP").toUpperCase();
  return Object.values(Platform).includes(normalized as Platform)
    ? normalized as Platform
    : Platform.WHATSAPP;
}

export async function POST(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  let body: Record<string, unknown>;
  try {
    const parsed = asBodyObject(await req.json());
    if (!parsed) return apiError(400, "Invalid JSON body.");
    body = parsed;
  } catch {
    return apiError(400, "Invalid JSON body.");
  }

  const name = optionalString(body.name);
  const mobileNumber = optionalString(body.mobile_number);
  if (!name) return apiError(400, "Field 'name' is required.");
  if (!mobileNumber) return apiError(400, "Field 'mobile_number' is required.");

  const platform = normalizePlatform(body.platform);
  const waId = normalizeWaId(mobileNumber);
  const tagIds = stringList(body.tag_ids);
  const groupIds = stringList(body.group_ids);
  const attributes = body.attributes as Prisma.InputJsonValue | undefined;

  const contact = await prisma.contact.upsert({
    where: {
      organizationId_platform_waId: {
        organizationId: org.id,
        platform,
        waId,
      },
    },
    update: {
      name,
      email: optionalString(body.email),
      firstName: optionalString(body.first_name),
      lastName: optionalString(body.last_name),
      notes: optionalString(body.notes),
      customAttributes: attributes,
      isAutoCreated: false,
      ...(tagIds !== undefined ? { tags: { set: tagIds.map((id) => ({ id })) } } : {}),
      ...(groupIds !== undefined
        ? {
            groups: {
              deleteMany: {},
              create: groupIds.map((groupId) => ({ groupId })),
            },
          }
        : {}),
    },
    create: {
      organizationId: org.id,
      waId,
      name,
      platform,
      email: optionalString(body.email),
      firstName: optionalString(body.first_name),
      lastName: optionalString(body.last_name),
      notes: optionalString(body.notes),
      customAttributes: attributes,
      isAutoCreated: false,
      ...(tagIds !== undefined ? { tags: { connect: tagIds.map((id) => ({ id })) } } : {}),
      ...(groupIds !== undefined
        ? { groups: { create: groupIds.map((groupId) => ({ groupId })) } }
        : {}),
    },
    include: contactInclude,
  });

  return NextResponse.json(formatContact(contact, org.id), { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const sp = req.nextUrl.searchParams;
  const mobileNumber = sp.get("mobile_number");
  const limit = clampLimit(sp.get("limit"), 100, 500);
  const page = Math.max(1, Number(sp.get("page") || 1) || 1);
  const search = (sp.get("search") || sp.get("q") || "").trim();
  const platform = (sp.get("platform") || "").trim().toUpperCase();
  const tagId = sp.get("tag_id");
  const groupId = sp.get("group_id");

  if (mobileNumber) {
    const waId = normalizeWaId(mobileNumber);
    const contact = await prisma.contact.findFirst({
      where: { organizationId: org.id, waId },
      include: contactInclude,
    });

    if (!contact) return apiError(404, "Contact not found.");
    return NextResponse.json(formatContact(contact, org.id));
  }

  const requestedUserId =
    req.headers.get("x-watibot-user-id") ||
    req.headers.get("x-user-id") ||
    sp.get("userId") ||
    sp.get("user_id");

  let currentUser = null;
  if (requestedUserId) {
    currentUser = await prisma.user.findFirst({
      where: { id: requestedUserId, organizationId: org.id },
      select: { id: true, role: true },
    });
  }

  const isAdminOrOwner = Boolean(
    currentUser &&
    (currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN" || currentUser.id === org.ownerId)
  );
  const isAgent = Boolean(currentUser && !isAdminOrOwner);

  const where: Prisma.ContactWhereInput = {
    organizationId: org.id,
    ...(isAgent && currentUser
      ? {
          OR: [
            { assignedAgentId: currentUser.id },
            { assignedUsers: { some: { id: currentUser.id } } },
          ],
        }
      : {}),
  };
  if (platform && platform !== "ALL") where.platform = normalizePlatform(platform);
  if (tagId) where.tags = { some: { id: tagId } };
  if (groupId) where.groups = { some: { groupId } };
  if (search) {
    const searchConditions: Prisma.ContactWhereInput[] = [
      { name: { contains: search, mode: "insensitive" } },
      { whatsappName: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { waId: { contains: search.replace(/\D/g, "") || search } },
      { email: { contains: search, mode: "insensitive" } },
    ];
    if (where.OR) {
      where.AND = [
        { OR: where.OR },
        { OR: searchConditions },
      ];
      delete where.OR;
    } else {
      where.OR = searchConditions;
    }
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: [
        { updatedAt: "desc" },
        { createdAt: "desc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
      include: contactInclude,
    }),
    prisma.contact.count({ where }),
  ]);

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit),
    contacts: contacts.map((contact) => formatContact(contact, org.id)),
  });
}

export function formatContact(contact: unknown, orgId: string) {
  const item = contact && typeof contact === "object" ? contact as Record<string, unknown> : {};
  return {
    ...formatMobileContact(contact, orgId),
    is_closed: item.isBlocked ?? false,
    is_intermediate: false,
    is_commenting: false,
    interacted_by: null,
    country_code: null,
    first_message: null,
    timezone: "Asia/Kolkata",
  };
}

const contactInclude = {
  tags: true,
  groups: { include: { group: true } },
  assignedUsers: { select: { id: true, name: true, email: true } },
  aiAgent: true,
  organization: { select: { isAiBotEnabled: true } },
  _count: { select: { messages: true } },
};
