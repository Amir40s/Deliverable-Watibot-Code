import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncKnowledgeToAssistant } from '@/lib/ai/openai';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const orgs = await prisma.organization.findMany({
      select: { id: true },
    });

    for (const org of orgs) {
      try {
        await syncKnowledgeToAssistant(org.id);
      } catch (err: any) {
        console.error(`Error syncing org ${org.id}:`, err.message);
      }
    }

    return NextResponse.json({ success: true, message: `Rebuilt vectors for ${orgs.length} organizations.` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
