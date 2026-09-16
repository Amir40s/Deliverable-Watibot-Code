import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const contact = await prisma.contact.findFirst({
            where: { waId: '923280132986' },
            include: {
                organization: {
                    select: { id: true, name: true, aiProvider: true, aiProviderApiKey: true }
                },
                aiAgent: true
            }
        });
        return NextResponse.json(contact);
    } catch (err: any) {
        return NextResponse.json({ error: err.message });
    }
}
