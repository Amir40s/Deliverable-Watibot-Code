import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { formatTagRecord, optionalString, readJsonObject } from "@/lib/api/mobile-route-utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tagId: string }> }
) {
  const { tagId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const existing = await prisma.tag.findFirst({
    where: { id: tagId, organizationId: org.id },
  });
  if (!existing) return apiError(404, "Tag not found.");

  const { body, error } = await readJsonObject(req);
  if (error) return error;
  if (!body) return apiError(400, "Invalid JSON body.");

  const name = optionalString(body.name)?.trim();
  if (body.name !== undefined && !name) return apiError(400, "Field 'name' cannot be empty.");

  if (name && name.toLowerCase() !== existing.name.toLowerCase()) {
    const conflict = await prisma.tag.findFirst({
      where: { organizationId: org.id, name: { equals: name, mode: "insensitive" }, id: { not: tagId } },
    });
    if (conflict) return apiError(409, `A tag with the name "${name}" already exists.`);
  }

  const tag = await prisma.tag.update({
    where: { id: tagId },
    data: {
      ...(name ? { name } : {}),
      ...(body.color !== undefined ? { color: optionalString(body.color) || "#10B981" } : {}),
      ...(body.category !== undefined ? { category: optionalString(body.category) || "General" } : {}),
    },
    include: { _count: { select: { contacts: true } } },
  });

  return NextResponse.json({
    status: 200,
    success: true,
    tag: formatTagRecord(tag),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tagId: string }> }
) {
  const { tagId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const existing = await prisma.tag.findFirst({
    where: { id: tagId, organizationId: org.id },
    select: { id: true },
  });
  if (!existing) return apiError(404, "Tag not found.");

  await prisma.tag.delete({ where: { id: tagId } });

  return NextResponse.json({
    status: 200,
    success: true,
    deleted: true,
    id: tagId,
  });
}
