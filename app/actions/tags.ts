'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activityLog';

const COUNTRY_PREFIXES: Record<string, { name: string, code: string }> = {
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
  "1": { name: "United States", code: "us" }, // General NA
};

function getCountryFromWaId(waId: string) {
  if (!waId) return { name: "Unknown", code: "un" };
  const p3 = waId.substring(0, 3);
  if (COUNTRY_PREFIXES[p3]) return COUNTRY_PREFIXES[p3];
  const p2 = waId.substring(0, 2);
  if (COUNTRY_PREFIXES[p2]) return COUNTRY_PREFIXES[p2];
  const p1 = waId.substring(0, 1);
  if (COUNTRY_PREFIXES[p1]) return COUNTRY_PREFIXES[p1];
  return { name: "Other", code: "un" };
}

export async function getTags() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
        throw new Error('Unauthorized');
    }

    const tags = await prisma.tag.findMany({
        where: {
            organizationId: session.user.organizationId,
        },
        include: {
            contacts: {
                select: { waId: true, createdAt: true }
            },
            _count: {
                select: { contacts: true }
            }
        },
        orderBy: {
            name: 'asc',
        },
    });

    return tags.map(tag => {
        const countryCounts: Record<string, { count: number, name: string, code: string }> = {};
        let totalContactsWithWaId = 0;

        let last7DaysCount = 0;
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        for (const contact of tag.contacts) {
            if (contact.waId) {
                totalContactsWithWaId++;
                const country = getCountryFromWaId(contact.waId);
                if (!countryCounts[country.name]) {
                    countryCounts[country.name] = { count: 0, name: country.name, code: country.code };
                }
                countryCounts[country.name].count++;
            }
            if (contact.createdAt) {
                const created = new Date(contact.createdAt);
                if (created >= sevenDaysAgo) {
                    last7DaysCount++;
                }
            }
        }

        const growth = `+${last7DaysCount}`;

        const topCountries = Object.values(countryCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5) // top 5
            .map(c => ({
                name: c.name,
                code: c.code,
                percent: totalContactsWithWaId > 0 ? Number(((c.count / totalContactsWithWaId) * 100).toFixed(1)) : 0,
                flag: c.code !== "un" ? `https://flagcdn.com/w40/${c.code}.png` : "" // No flag for unknown
            }));

        // Remove contacts array to save bandwidth
        const { contacts, ...rest } = tag;
        return {
            ...rest,
            growth,
            topCountries
        };
    });
}

import { isValidHexColor, normalizeHexColor } from '@/lib/utils';

export async function createTag(name: string, color?: string, category?: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.organizationId) {
            return { error: 'Unauthorized' };
        }

        const tagName = name.trim();
        if (!tagName) {
            return { error: 'Tag name is required.' };
        }

        const tagColor = color?.trim() || "#10B981";
        if (!isValidHexColor(tagColor)) {
            return { error: 'Invalid color format. Please provide a valid HEX color code.' };
        }
        const normalizedColor = normalizeHexColor(tagColor);

        // Check if exists (case-insensitive)
        const existing = await prisma.tag.findFirst({
            where: {
                organizationId: session.user.organizationId,
                name: { equals: tagName, mode: 'insensitive' },
            },
        });

        if (existing) {
            return { error: `A tag with the name "${tagName}" already exists.` };
        }

        const tag = await prisma.tag.create({
            data: {
                organizationId: session.user.organizationId,
                name: tagName,
                color: normalizedColor,
                category: category || "General",
            },
        });

        logActivity({
          organizationId: session.user.organizationId!,
          userId: session.user.id,
          userEmail: session.user.email,
          userName: session.user.name,
          action: 'Created',
          module: 'Tags',
          target: tagName,
          status: 'success',
        });
        return { success: true, data: tag };
    } catch (error: any) {
        console.error("[createTag] Error:", error);
        return { error: error.message || "Failed to create tag" };
    }
}

export async function updateTag(id: string, name: string, color?: string, category?: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.organizationId) {
            return { error: 'Unauthorized' };
        }

        const tagName = name.trim();
        if (!tagName) {
            return { error: 'Tag name is required.' };
        }

        const tagColor = color?.trim() || "#10B981";
        if (!isValidHexColor(tagColor)) {
            return { error: 'Invalid color format. Please provide a valid HEX color code.' };
        }
        const normalizedColor = normalizeHexColor(tagColor);

        // Check for conflict (case-insensitive)
        const conflict = await prisma.tag.findFirst({
            where: {
                organizationId: session.user.organizationId,
                name: { equals: tagName, mode: 'insensitive' },
                id: { not: id }
            }
        });

        if (conflict) {
            return { error: `A tag with the name "${tagName}" already exists.` };
        }

        const tag = await prisma.tag.update({
            where: {
                id,
                organizationId: session.user.organizationId,
            },
            data: {
                name: tagName,
                color: normalizedColor,
                category: category || "General",
            },
        });

        logActivity({
          organizationId: session.user.organizationId!,
          userId: session.user.id,
          userEmail: session.user.email,
          userName: session.user.name,
          action: 'Updated',
          module: 'Tags',
          target: tagName,
          status: 'success',
        });
        return { success: true, data: tag };
    } catch (error: any) {
        console.error("[updateTag] Error:", error);
        return { error: error.message || "Failed to update tag" };
    }
}

export async function deleteTag(id: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
        throw new Error('Unauthorized');
    }

    await prisma.tag.delete({
        where: {
            id,
            organizationId: session.user.organizationId,
        },
    });

    logActivity({
      organizationId: session.user.organizationId!,
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      action: 'Deleted',
      module: 'Tags',
      target: `Tag ID: ${id}`,
      status: 'success',
    });
    return { success: true };
}
