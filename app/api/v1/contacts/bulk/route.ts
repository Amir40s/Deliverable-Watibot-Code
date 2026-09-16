import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { normalizeWaId } from "@/lib/api/mobile-formatters";
import { prisma } from "@/lib/prisma";
import { Platform } from "@/lib/generated/prisma";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body.");
  }

  const rawContacts = Array.isArray(body.contacts) ? body.contacts : [];
  if (rawContacts.length === 0) {
    return apiError(400, "No contacts provided. Field 'contacts' must be a non-empty array.");
  }

  const tagIds: string[] = Array.isArray(body.tag_ids) ? body.tag_ids.map(String).filter(Boolean) : [];
  const groupId = typeof body.group_id === "string" && body.group_id.trim() ? body.group_id.trim() : null;

  const errors: string[] = [];
  const validContacts: Array<{
    waId: string;
    name: string;
    email?: string | null;
    notes?: string | null;
    customAttributes?: any;
  }> = [];

  for (let i = 0; i < rawContacts.length; i++) {
    const item = rawContacts[i];
    const rawNumber = String(item.mobile_number || item.phone || item.phoneNumber || item.waId || item.number || "");
    const rawName = String(item.name || item.fullName || item.first_name || "New Contact").trim();
    const rawEmail = item.email ? String(item.email).trim() : null;
    const rawNotes = item.notes ? String(item.notes).trim() : null;
    const customAttributes = item.custom_attributes || item.customAttributes || null;

    const waId = normalizeWaId(rawNumber);
    if (!waId || waId.length < 7) {
      errors.push(`Row ${i + 1} (${rawName}): Invalid phone number "${rawNumber}"`);
      continue;
    }

    validContacts.push({
      waId,
      name: rawName.length === 0 ? "New Contact" : rawName,
      email: rawEmail,
      notes: rawNotes,
      customAttributes,
    });
  }

  if (validContacts.length === 0) {
    return NextResponse.json({
      success: false,
      message: "No valid contacts found.",
      imported: 0,
      updated: 0,
      failed: errors.length,
      errors,
    }, { status: 400 });
  }

  // Deduplicate within the payload by waId
  const uniqueMap = new Map<string, typeof validContacts[0]>();
  for (const c of validContacts) {
    uniqueMap.set(c.waId, c);
  }
  const uniqueContacts = Array.from(uniqueMap.values());

  let importedCount = 0;
  let updatedCount = 0;

  try {
    // 1. Fetch existing contacts in organization
    const existingList = await prisma.contact.findMany({
      where: {
        organizationId: org.id,
        platform: Platform.WHATSAPP,
        waId: { in: uniqueContacts.map((c) => c.waId) },
      },
      select: { id: true, waId: true, name: true, email: true, notes: true },
    });

    const existingMap = new Map<string, typeof existingList[0]>();
    for (const ex of existingList) {
      existingMap.set(ex.waId, ex);
    }

    const toCreate: any[] = [];
    const toUpdate: any[] = [];

    for (const c of uniqueContacts) {
      const existing = existingMap.get(c.waId);
      if (existing) {
        toUpdate.push({
          id: existing.id,
          name: c.name && c.name !== "New Contact" ? c.name : existing.name,
          email: c.email || existing.email,
          notes: c.notes ? `${existing.notes || ""}\n${c.notes}`.trim() : existing.notes,
          ...(c.customAttributes ? { customAttributes: c.customAttributes } : {}),
        });
      } else {
        toCreate.push({
          id: randomUUID(),
          organizationId: org.id,
          platform: Platform.WHATSAPP,
          waId: c.waId,
          name: c.name || "New Contact",
          email: c.email || null,
          notes: c.notes || "",
          lastMessageAt: new Date(),
          isAutoCreated: false,
          ...(c.customAttributes ? { customAttributes: c.customAttributes } : {}),
        });
      }
    }

    // 2. Perform bulk creation
    if (toCreate.length > 0) {
      await prisma.contact.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
      importedCount = toCreate.length;
    }

    // 3. Perform parallel updates
    if (toUpdate.length > 0) {
      const updatePromises = toUpdate.map((upd) =>
        prisma.contact.update({
          where: { id: upd.id },
          data: {
            name: upd.name,
            email: upd.email,
            notes: upd.notes,
            ...(upd.customAttributes ? { customAttributes: upd.customAttributes } : {}),
          },
        })
      );
      await Promise.all(updatePromises);
      updatedCount = toUpdate.length;
    }

    // 4. Attach Tags & Groups if provided
    const allTargetWaIds = uniqueContacts.map((c) => c.waId);
    const allAffectedContacts = await prisma.contact.findMany({
      where: {
        organizationId: org.id,
        platform: Platform.WHATSAPP,
        waId: { in: allTargetWaIds },
      },
      select: { id: true },
    });

    const contactIds = allAffectedContacts.map((c) => c.id);

    if (tagIds.length > 0 && contactIds.length > 0) {
      const tagConnects = contactIds.map((cId) =>
        prisma.contact.update({
          where: { id: cId },
          data: {
            tags: { connect: tagIds.map((id: string) => ({ id })) },
          },
        })
      );
      await Promise.all(tagConnects);
    }

    if (groupId && contactIds.length > 0) {
      // Upsert into ContactGroup membership
      const groupCreates = contactIds.map((cId) =>
        prisma.contactGroupMember.upsert({
          where: {
            contactId_groupId: {
              contactId: cId,
              groupId: groupId,
            },
          },
          create: {
            contactId: cId,
            groupId: groupId,
          },
          update: {},
        })
      );
      await Promise.all(groupCreates);
    }
  } catch (err: any) {
    console.error("[BulkImportContacts] DB Error:", err);
    return apiError(500, `Database error during bulk import: ${err.message}`);
  }

  return NextResponse.json({
    success: true,
    message: `Successfully processed ${uniqueContacts.length} contacts (${importedCount} new, ${updatedCount} updated).`,
    total_processed: rawContacts.length,
    unique_processed: uniqueContacts.length,
    imported: importedCount,
    updated: updatedCount,
    failed: errors.length,
    errors,
  });
}
