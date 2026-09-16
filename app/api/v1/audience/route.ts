import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { toEpoch, toIso } from "@/lib/api/mobile-formatters";

const COUNTRY_PREFIXES: Record<string, { name: string; code: string }> = {
  "92": { name: "Pakistan", code: "pk" },
  "91": { name: "India", code: "in" },
  "880": { name: "Bangladesh", code: "bd" },
  "971": { name: "United Arab Emirates", code: "ae" },
  "44": { name: "United Kingdom", code: "gb" },
  "62": { name: "Indonesia", code: "id" },
  "55": { name: "Brazil", code: "br" },
  "234": { name: "Nigeria", code: "ng" },
  "63": { name: "Philippines", code: "ph" },
  "20": { name: "Egypt", code: "eg" },
  "27": { name: "South Africa", code: "za" },
  "33": { name: "France", code: "fr" },
  "49": { name: "Germany", code: "de" },
  "61": { name: "Australia", code: "au" },
  "86": { name: "China", code: "cn" },
  "81": { name: "Japan", code: "jp" },
  "966": { name: "Saudi Arabia", code: "sa" },
  "60": { name: "Malaysia", code: "my" },
  "65": { name: "Singapore", code: "sg" },
  "34": { name: "Spain", code: "es" },
  "39": { name: "Italy", code: "it" },
  "52": { name: "Mexico", code: "mx" },
  "94": { name: "Sri Lanka", code: "lk" },
  "977": { name: "Nepal", code: "np" },
  "1": { name: "United States", code: "us" },
};

function getCountryFromWaId(waId: string) {
  if (!waId) return { name: "Unknown", code: "un" };
  const digits = String(waId).replace(/\D/g, "");
  const p3 = digits.substring(0, 3);
  if (COUNTRY_PREFIXES[p3]) return COUNTRY_PREFIXES[p3];
  const p2 = digits.substring(0, 2);
  if (COUNTRY_PREFIXES[p2]) return COUNTRY_PREFIXES[p2];
  const p1 = digits.substring(0, 1);
  if (COUNTRY_PREFIXES[p1]) return COUNTRY_PREFIXES[p1];
  return { name: "Other", code: "un" };
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  try {
    const [contactsWithChats, tags, groups] = await Promise.all([
      prisma.contact.findMany({
        where: {
          organizationId: org.id,
          messages: { some: {} },
        },
        select: {
          id: true,
          waId: true,
          createdAt: true,
          platform: true,
        },
      }),
      prisma.tag.findMany({
        where: { organizationId: org.id },
        orderBy: { name: "asc" },
        include: { _count: { select: { contacts: true } } },
      }),
      prisma.contactGroup.findMany({
        where: { organizationId: org.id },
        orderBy: { name: "asc" },
        include: { _count: { select: { contacts: true } } },
      }),
    ]);

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const countryCounts: Record<string, { count: number; name: string; code: string }> = {};

    let newContactsLast7Days = 0;
    let totalContactsWithWaId = 0;
    for (const contact of contactsWithChats) {
      if (contact.createdAt.getTime() >= sevenDaysAgo) newContactsLast7Days += 1;
      if (!contact.waId) continue;
      totalContactsWithWaId += 1;
      const country = getCountryFromWaId(contact.waId);
      countryCounts[country.name] ??= { ...country, count: 0 };
      countryCounts[country.name].count += 1;
    }

    const topCountries = Object.values(countryCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((country) => ({
        name: country.name,
        code: country.code,
        count: country.count,
        percent: totalContactsWithWaId
          ? Number(((country.count / totalContactsWithWaId) * 100).toFixed(1))
          : 0,
        flag: country.code !== "un" ? `https://flagcdn.com/w40/${country.code}.png` : "",
      }));

    return NextResponse.json({
      status: 200,
      success: true,
      project_id: org.id,
      audience: {
        id: "chat-audience",
        title: "Chat Audience",
        description: "All contacts with active chat history in the CRM.",
        contacts: contactsWithChats.length,
        contacts_label: contactsWithChats.length.toLocaleString(),
        growth_last_7_days: newContactsLast7Days,
        growth: `+${newContactsLast7Days}`,
        status: "Active",
        top_countries: topCountries,
      },
      segments: [
        ...tags.map((tag) => ({
          id: tag.id,
          type: "tag",
          title: tag.name,
          color: tag.color,
          category: tag.category,
          contacts: tag._count.contacts,
          created_at: toEpoch(tag.createdAt),
          created_at_iso: toIso(tag.createdAt),
          updated_at: toEpoch(tag.updatedAt),
          updated_at_iso: toIso(tag.updatedAt),
        })),
        ...groups.map((group) => ({
          id: group.id,
          type: "group",
          title: group.name,
          color: group.color,
          description: group.description,
          contacts: group._count.contacts,
          created_at: toEpoch(group.createdAt),
          created_at_iso: toIso(group.createdAt),
          updated_at: toEpoch(group.updatedAt),
          updated_at_iso: toIso(group.updatedAt),
        })),
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load audience data.";
    return NextResponse.json({ status: 500, error: message }, { status: 500 });
  }
}
