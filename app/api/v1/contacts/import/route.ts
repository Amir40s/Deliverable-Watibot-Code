import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { normalizeWaId } from "@/lib/api/mobile-formatters";
import { prisma } from "@/lib/prisma";
import { Platform } from "@/lib/generated/prisma";
import { randomUUID } from "crypto";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const isPreview = req.nextUrl.searchParams.get("preview") === "true";

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return apiError(400, "No file uploaded. Form field 'file' is required.");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return apiError(400, "Excel/CSV file is empty or has no sheets.");
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    if (rawRows.length === 0) {
      return apiError(400, "Spreadsheet contains no data rows.");
    }

    const headers = Object.keys(rawRows[0] || {});

    // If preview only: Return headers and first 5 sample rows
    if (isPreview) {
      return NextResponse.json({
        success: true,
        file_name: file.name,
        total_rows: rawRows.length,
        headers,
        sample_rows: rawRows.slice(0, 5),
      });
    }

    // Mapping fields
    const nameCol = (formData.get("name_column") as string) || "";
    const phoneCol = (formData.get("phone_column") as string) || "";
    const emailCol = (formData.get("email_column") as string) || "";
    const notesCol = (formData.get("notes_column") as string) || "";
    const defaultCountryCode = ((formData.get("default_country_code") as string) || "+91").replace(/\D/g, "");
    const tagIds = (formData.getAll("tag_ids") as string[]).filter(Boolean);
    const groupId = (formData.get("group_id") as string) || null;

    if (!phoneCol) {
      return apiError(400, "Field 'phone_column' is required to map phone numbers.");
    }

    const errors: string[] = [];
    const validContacts: Array<{
      waId: string;
      name: string;
      email?: string | null;
      notes?: string | null;
    }> = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      let rawPhone = String(row[phoneCol] || "").trim();
      const rawName = nameCol && row[nameCol] ? String(row[nameCol]).trim() : "New Contact";
      const rawEmail = emailCol && row[emailCol] ? String(row[emailCol]).trim() : null;
      const rawNotes = notesCol && row[notesCol] ? String(row[notesCol]).trim() : null;

      if (!rawPhone) {
        errors.push(`Row ${i + 2}: Empty phone number`);
        continue;
      }

      // If phone number doesn't have country code (e.g. local 10-digit or starts with 0/3)
      let digits = rawPhone.replace(/\D/g, "");
      if (digits.startsWith("0")) {
        digits = digits.substring(1);
      }
      if (digits.length <= 10 && defaultCountryCode) {
        digits = defaultCountryCode + digits;
      }

      const waId = normalizeWaId(digits);
      if (!waId || waId.length < 7) {
        errors.push(`Row ${i + 2} (${rawName}): Invalid phone number "${rawPhone}"`);
        continue;
      }

      validContacts.push({
        waId,
        name: rawName.length === 0 ? "New Contact" : rawName,
        email: rawEmail,
        notes: rawNotes,
      });
    }

    if (validContacts.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No valid contacts found in the uploaded file.",
        total_rows: rawRows.length,
        imported: 0,
        updated: 0,
        failed: errors.length,
        errors,
      }, { status: 400 });
    }

    // Deduplicate within the file
    const uniqueMap = new Map<string, typeof validContacts[0]>();
    for (const c of validContacts) {
      uniqueMap.set(c.waId, c);
    }
    const uniqueContacts = Array.from(uniqueMap.values());

    // 1. Fetch existing contacts
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
        });
      }
    }

    let importedCount = 0;
    let updatedCount = 0;

    if (toCreate.length > 0) {
      await prisma.contact.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
      importedCount = toCreate.length;
    }

    if (toUpdate.length > 0) {
      const updatePromises = toUpdate.map((upd) =>
        prisma.contact.update({
          where: { id: upd.id },
          data: {
            name: upd.name,
            email: upd.email,
            notes: upd.notes,
          },
        })
      );
      await Promise.all(updatePromises);
      updatedCount = toUpdate.length;
    }

    // Connect Tags & Group
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
            tags: { connect: tagIds.map((id) => ({ id })) },
          },
        })
      );
      await Promise.all(tagConnects);
    }

    if (groupId && contactIds.length > 0) {
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

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${uniqueContacts.length} contacts (${importedCount} new, ${updatedCount} updated).`,
      file_name: file.name,
      total_rows: rawRows.length,
      imported: importedCount,
      updated: updatedCount,
      failed: errors.length,
      errors: errors.slice(0, 20), // Return first 20 errors to keep payload clean
    });
  } catch (err: any) {
    console.error("[ImportContacts] Error:", err);
    return apiError(500, `Failed to parse and import spreadsheet: ${err.message}`);
  }
}
