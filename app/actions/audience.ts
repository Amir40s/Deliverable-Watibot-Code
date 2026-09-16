'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
  "1": { name: "United States", code: "us" }, 
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

export async function getChatAudience() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
        throw new Error('Unauthorized');
    }

    const contactsWithChats = await prisma.contact.findMany({
        where: { 
            organizationId: session.user.organizationId,
            messages: { some: {} }
        },
        select: { waId: true, createdAt: true }
    });

    const countryCounts: Record<string, { count: number, name: string, code: string }> = {};
    let totalContactsWithWaId = 0;
    let last7DaysCount = 0;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (const contact of contactsWithChats) {
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
        .slice(0, 5)
        .map(c => ({
            name: c.name,
            code: c.code,
            percent: totalContactsWithWaId > 0 ? Number(((c.count / totalContactsWithWaId) * 100).toFixed(1)) : 0,
            flag: c.code !== "un" ? `https://flagcdn.com/w40/${c.code}.png` : ""
        }));

    return {
        id: "chat-audience",
        title: "Chat Audience",
        description: "All contacts with active chat history in the CRM.",
        contacts: contactsWithChats.length.toLocaleString(),
        growth,
        topCountries,
        created: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        updated: "recently",
        updatedBy: "System",
        status: "Active",
        color: "#00B074",
        isFavorite: true
    };
}
