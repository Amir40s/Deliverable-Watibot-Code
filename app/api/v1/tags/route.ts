import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { clampLimit } from "@/lib/api/mobile-formatters";
import { formatTagRecord, optionalString, readJsonObject } from "@/lib/api/mobile-route-utils";

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const sp = req.nextUrl.searchParams;
  const limit = clampLimit(sp.get("limit"), 100, 200);
  const search = (sp.get("search") || sp.get("q") || "").trim();
  const category = (sp.get("category") || "").trim();

  const tags = await prisma.tag.findMany({
    where: {
      organizationId: org.id,
      ...(category ? { category } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    take: limit,
    include: { _count: { select: { contacts: true } } },
  });

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    total: tags.length,
    tags: tags.map(formatTagRecord),
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const { body, error } = await readJsonObject(req);
  if (error) return error;
  if (!body) return apiError(400, "Invalid JSON body.");

  const name = optionalString(body.name)?.trim();
  if (!name) return apiError(400, "Field 'name' is required.");

  const existing = await prisma.tag.findFirst({
    where: { organizationId: org.id, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return apiError(409, `A tag with the name "${name}" already exists.`);

  const tag = await prisma.tag.create({
    data: {
      organizationId: org.id,
      name,
      color: optionalString(body.color) || "#10B981",
      category: optionalString(body.category) || "General",
    },
    include: { _count: { select: { contacts: true } } },
  });

  return NextResponse.json({
    status: 201,
    success: true,
    tag: formatTagRecord(tag),
  }, { status: 201 });
}
